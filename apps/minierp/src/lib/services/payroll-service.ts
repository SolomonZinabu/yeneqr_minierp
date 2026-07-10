// src/lib/services/payroll-service.ts
// Ethiopian-compliant payroll (PIT Proc 979/2016, pension Proc 715/2011, OT Proc 1156/2019).

import { db, getCurrentTenantId } from "@/lib/db";
import { NumberService } from "./number-service";
import { GlService } from "./gl-service";

export const PIT_BRACKETS = [
  { from: 0,     to: 600,    rate: 0.00 },
  { from: 600,   to: 1650,   rate: 0.10 },
  { from: 1650,  to: 3200,   rate: 0.15 },
  { from: 3200,  to: 5250,   rate: 0.20 },
  { from: 5250,  to: 7800,   rate: 0.25 },
  { from: 7800,  to: 10900,  rate: 0.30 },
  { from: 10900, to: null,   rate: 0.35 },
];
export const PENSION_RATE_EMPLOYEE = 0.07;
export const PENSION_RATE_EMPLOYER = 0.11;
export const PENSION_BASE_CAP = 2800;
export const TRANSPORT_ALLOWANCE_TAX_FREE = 600;
export const OT_HOURLY_DIVISOR = 240;

export class PayrollService {
  static calculatePit(taxableIncome: number): number {
    if (taxableIncome <= 0) return 0;
    let tax = 0;
    for (const bracket of PIT_BRACKETS) {
      if (taxableIncome <= bracket.from) break;
      const upper = bracket.to ?? taxableIncome;
      const taxableInBracket = Math.min(taxableIncome, upper) - bracket.from;
      if (taxableInBracket > 0) tax += taxableInBracket * bracket.rate;
    }
    return Math.round(tax);
  }

  static calculatePension(pensionableBase: number) {
    const base = Math.min(pensionableBase, PENSION_BASE_CAP);
    return { employee: Math.round(base * PENSION_RATE_EMPLOYEE), employer: Math.round(base * PENSION_RATE_EMPLOYER) };
  }

  static calculateOt(monthlySalary: number, hoursRegular: number, hoursRest: number, hoursPublic: number) {
    const hourly = monthlySalary / OT_HOURLY_DIVISOR;
    const regular = Math.round(hourly * 1.25 * hoursRegular);
    const rest = Math.round(hourly * 1.50 * hoursRest);
    const publicHoliday = Math.round(hourly * 2.00 * hoursPublic);
    return { regular, rest, publicHoliday, total: regular + rest + publicHoliday };
  }

  static calculate(input: {
    employee: { id: string; baseSalary: number; taxExemptionAmount: number };
    attendance: { workedHours: number; otHoursRegular: number; otHoursRest: number; otHoursPublic: number };
    overrides?: { basicSalary?: number; transportAllowance?: number; mealAllowance?: number; otherAllowance?: number; otherDeduction?: number };
  }) {
    const basic = input.overrides?.basicSalary ?? input.employee.baseSalary;
    const transportAllowance = input.overrides?.transportAllowance ?? 0;
    const mealAllowance = input.overrides?.mealAllowance ?? 0;
    const otherAllowance = input.overrides?.otherAllowance ?? 0;
    const otherDeduction = input.overrides?.otherDeduction ?? 0;
    const ot = this.calculateOt(basic, input.attendance.otHoursRegular, input.attendance.otHoursRest, input.attendance.otHoursPublic);
    const grossEarnings = basic + transportAllowance + mealAllowance + otherAllowance + ot.total;
    const taxableTransport = Math.max(0, transportAllowance - TRANSPORT_ALLOWANCE_TAX_FREE);
    const taxableIncome = Math.max(0, basic + taxableTransport + otherAllowance + ot.total - input.employee.taxExemptionAmount);
    const pit = this.calculatePit(taxableIncome);
    const pension = this.calculatePension(basic);
    const totalDeductions = pit + pension.employee + otherDeduction;
    const netPay = grossEarnings - totalDeductions;
    return {
      employeeId: input.employee.id, basicSalary: basic, transportAllowance, mealAllowance, otherAllowance,
      otRegularAmount: ot.regular, otRestAmount: ot.rest, otPublicAmount: ot.publicHoliday,
      grossEarnings, taxableIncome, pitAmount: pit,
      pensionEmployee: pension.employee, pensionEmployer: pension.employer,
      otherDeduction, totalDeductions, netPay,
      details: {
        basic, transport_allowance: transportAllowance, meal_allowance: mealAllowance, other_allowance: otherAllowance,
        ot_regular: ot.regular, ot_rest: ot.rest, ot_public: ot.publicHoliday,
        gross: grossEarnings, taxable: taxableIncome, pit,
        pension_employee: pension.employee, pension_employer: pension.employer,
        other_deduction: otherDeduction, total_deductions: totalDeductions, net: netPay,
      },
    };
  }

  static async runPayroll(input: {
    period: string; startDate: Date; endDate: Date; payDate: Date;
    employeeIds?: string[]; createdBy?: string;
  }) {
    const tenantId = getCurrentTenantId();
    if (!tenantId) throw new Error("PayrollService.runPayroll requires tenant context");
    const runNumber = await NumberService.next(tenantId, "PAY");
    return db.$transaction(async (tx) => {
      const where: { employmentStatus: string; id?: { in: string[] } } = { employmentStatus: "active" };
      if (input.employeeIds && input.employeeIds.length > 0) where.id = { in: input.employeeIds };
      const employees = await tx.employee.findMany({ where });
      const items = [];
      for (const emp of employees) {
        const attendance = await tx.attendanceRecord.aggregate({
          where: { employeeId: emp.id, date: { gte: input.startDate, lte: input.endDate } },
          _sum: { workedHours: true, otHoursRegular: true, otHoursRest: true, otHoursPublic: true },
        });
        items.push(this.calculate({
          employee: { id: emp.id, baseSalary: emp.baseSalary, taxExemptionAmount: emp.taxExemptionAmount },
          attendance: {
            workedHours: attendance._sum.workedHours ?? 0,
            otHoursRegular: attendance._sum.otHoursRegular ?? 0,
            otHoursRest: attendance._sum.otHoursRest ?? 0,
            otHoursPublic: attendance._sum.otHoursPublic ?? 0,
          },
        }));
      }
      const totalGross = items.reduce((s, i) => s + i.grossEarnings, 0);
      const totalTax = items.reduce((s, i) => s + i.pitAmount, 0);
      const totalPensionEmployee = items.reduce((s, i) => s + i.pensionEmployee, 0);
      const totalEmployerContribution = items.reduce((s, i) => s + i.pensionEmployer, 0);
      const totalPension = totalPensionEmployee + totalEmployerContribution;
      const totalDeductions = items.reduce((s, i) => s + i.totalDeductions, 0);
      const totalNet = items.reduce((s, i) => s + i.netPay, 0);
      const run = await tx.payrollRun.create({
        data: {
          tenantId, runNumber, period: input.period,
          startDate: input.startDate, endDate: input.endDate, payDate: input.payDate,
          status: "calculated", totalGross, totalTax, totalPension, totalDeductions, totalNet,
          totalEmployerContribution, employeeCount: employees.length, createdBy: input.createdBy,
          items: {
            create: items.map((calc) => ({
              tenantId, employeeId: calc.employeeId, basicSalary: calc.basicSalary,
              grossEarnings: calc.grossEarnings, taxableIncome: calc.taxableIncome,
              taxAmount: calc.pitAmount, pensionEmployee: calc.pensionEmployee, pensionEmployer: calc.pensionEmployer,
              totalDeductions: calc.totalDeductions, netPay: calc.netPay,
              otAmount: calc.otRegularAmount + calc.otRestAmount + calc.otPublicAmount, details: calc.details,
            })),
          },
        },
        include: { items: true },
      });
      return { runId: run.id, runNumber, employeeCount: employees.length, totalGross, totalNet, journalEntryId: null };
    });
  }

  static async approveAndPost(runId: string, approvedBy: string) {
    const run = await db.payrollRun.findUniqueOrThrow({ where: { id: runId } });
    if (run.status !== "calculated") throw new Error(`Payroll run ${run.runNumber} is in status ${run.status} — only 'calculated' runs can be approved`);
    const journalEntryId = await GlService.postPayrollRun(runId, approvedBy);
    await db.payrollRun.update({ where: { id: runId }, data: { status: "approved", approvedBy, approvedAt: new Date(), journalEntryId } });
    return { status: "approved", journalEntryId };
  }
}
