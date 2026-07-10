// GET/PATCH/DELETE /api/hr/employees/[id]
import { withTenant, parseAndValidate, db, HttpError } from "@/lib/api-helpers";
import { getCurrentTenantId } from "@/lib/db";
import { z } from "zod";

const updateSchema = z.object({
  firstName: z.string().min(1).max(100).optional(), middleName: z.string().max(100).optional().nullable(),
  lastName: z.string().min(1).max(100).optional(), phone: z.string().max(50).optional().nullable(),
  email: z.string().email().optional().nullable(), address: z.string().max(500).optional().nullable(),
  jobTitle: z.string().max(100).optional().nullable(), department: z.string().max(100).optional().nullable(),
  payGrade: z.string().max(50).optional().nullable(), orgNodeId: z.string().optional().nullable(),
  baseSalary: z.number().min(0).optional(), taxExemptionAmount: z.number().min(0).optional(),
  allowsOvertime: z.boolean().optional(), bankAccount: z.string().max(50).optional().nullable(),
  bankName: z.string().max(100).optional().nullable(),
  employmentStatus: z.enum(["active", "on_leave", "suspended", "terminated"]).optional(),
  terminationDate: z.string().datetime().optional().nullable(), terminationReason: z.string().max(500).optional().nullable(),
});

export const GET = withTenant(async ({ params }) => {
  const employee = await db.employee.findUnique({
    where: { id: params.id },
    include: { orgNode: true, attendanceRecords: { orderBy: { date: "desc" }, take: 30 }, payrollItems: { orderBy: { createdAt: "desc" }, take: 12, include: { payrollRun: { select: { id: true, runNumber: true, period: true, status: true } } } } },
  });
  if (!employee) throw new HttpError(404, "Employee not found");
  return Response.json({ employee });
});

export const PATCH = withTenant(async ({ req, params }) => {
  const data = await parseAndValidate(req, updateSchema);
  const existing = await db.employee.findUnique({ where: { id: params.id } });
  if (!existing) throw new HttpError(404, "Employee not found");
  const fullName = [data.firstName ?? existing.firstName, data.middleName ?? existing.middleName, data.lastName ?? existing.lastName].filter(Boolean).join(" ");
  const employee = await db.employee.update({
    where: { id: params.id },
    data: {
      ...(data.firstName !== undefined ? { firstName: data.firstName } : {}),
      ...(data.middleName !== undefined ? { middleName: data.middleName } : {}),
      ...(data.lastName !== undefined ? { lastName: data.lastName } : {}),
      fullName,
      ...(data.phone !== undefined ? { phone: data.phone } : {}),
      ...(data.email !== undefined ? { email: data.email } : {}),
      ...(data.address !== undefined ? { address: data.address } : {}),
      ...(data.jobTitle !== undefined ? { jobTitle: data.jobTitle } : {}),
      ...(data.department !== undefined ? { department: data.department } : {}),
      ...(data.payGrade !== undefined ? { payGrade: data.payGrade } : {}),
      ...(data.orgNodeId !== undefined ? { orgNodeId: data.orgNodeId } : {}),
      ...(data.baseSalary !== undefined ? { baseSalary: data.baseSalary } : {}),
      ...(data.taxExemptionAmount !== undefined ? { taxExemptionAmount: data.taxExemptionAmount } : {}),
      ...(data.allowsOvertime !== undefined ? { allowsOvertime: data.allowsOvertime } : {}),
      ...(data.bankAccount !== undefined ? { bankAccount: data.bankAccount } : {}),
      ...(data.bankName !== undefined ? { bankName: data.bankName } : {}),
      ...(data.employmentStatus !== undefined ? { employmentStatus: data.employmentStatus } : {}),
      ...(data.terminationDate !== undefined ? { terminationDate: data.terminationDate ? new Date(data.terminationDate) : null } : {}),
      ...(data.terminationReason !== undefined ? { terminationReason: data.terminationReason } : {}),
    },
  });
  return Response.json({ employee });
});

export const DELETE = withTenant(async ({ params }) => {
  await db.employee.update({ where: { id: params.id }, data: { employmentStatus: "terminated", terminationDate: new Date(), isActive: false } });
  return Response.json({ ok: true });
});
