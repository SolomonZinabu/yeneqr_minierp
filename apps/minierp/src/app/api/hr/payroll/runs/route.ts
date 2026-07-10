// GET/POST /api/hr/payroll/runs
import { withTenant, parseAndValidate, db, HttpError } from "@/lib/api-helpers";
import { PayrollService } from "@/lib/services/payroll-service";
import { z } from "zod";

const runSchema = z.object({
  period: z.string().regex(/^\d{4}-\d{2}$/, "Period must be YYYY-MM, e.g. 2026-07"),
  startDate: z.string().datetime(), endDate: z.string().datetime(), payDate: z.string().datetime(),
  employeeIds: z.array(z.string()).optional(),
});

export const GET = withTenant(async ({ req }) => {
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const period = url.searchParams.get("period");
  const runs = await db.payrollRun.findMany({ where: { ...(status ? { status } : {}), ...(period ? { period } : {}) }, orderBy: { period: "desc" }, take: 50 });
  return Response.json({ runs });
});

export const POST = withTenant(async ({ req, user }) => {
  const data = await parseAndValidate(req, runSchema);
  const existing = await db.payrollRun.findFirst({ where: { period: data.period, status: { notIn: ["reversed"] } } });
  if (existing) throw new HttpError(409, `Payroll for period ${data.period} already exists (${existing.runNumber})`);
  const result = await PayrollService.runPayroll({
    period: data.period, startDate: new Date(data.startDate), endDate: new Date(data.endDate),
    payDate: new Date(data.payDate), employeeIds: data.employeeIds, createdBy: user.id,
  });
  return Response.json({ run: result }, { status: 201 });
});
