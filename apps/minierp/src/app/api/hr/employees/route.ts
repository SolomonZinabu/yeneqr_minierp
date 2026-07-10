// GET/POST /api/hr/employees
import { withTenant, parseAndValidate, db } from "@/lib/api-helpers";
import { getCurrentTenantId } from "@/lib/db";
import { NumberService } from "@/lib/services/number-service";
import { z } from "zod";

const employeeSchema = z.object({
  orgNodeId: z.string().optional().nullable(),
  firstName: z.string().min(1).max(100), middleName: z.string().max(100).optional().nullable(),
  lastName: z.string().min(1).max(100),
  gender: z.enum(["male", "female"]).optional().nullable(),
  dateOfBirth: z.string().datetime().optional().nullable(),
  nationality: z.string().default("Ethiopian"),
  maritalStatus: z.enum(["single", "married", "divorced", "widowed"]).optional().nullable(),
  idNumber: z.string().max(50).optional().nullable(), tinNumber: z.string().max(50).optional().nullable(),
  pensionNumber: z.string().max(50).optional().nullable(),
  phone: z.string().max(50).optional().nullable(), email: z.string().email().optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  emergencyContact: z.string().max(100).optional().nullable(), emergencyPhone: z.string().max(50).optional().nullable(),
  hireDate: z.string().datetime().optional(), probationEndDate: z.string().datetime().optional().nullable(),
  employmentType: z.enum(["permanent", "contract", "casual", "intern"]).default("permanent"),
  jobTitle: z.string().max(100).optional().nullable(), department: z.string().max(100).optional().nullable(),
  payGrade: z.string().max(50).optional().nullable(),
  bankAccount: z.string().max(50).optional().nullable(), bankName: z.string().max(100).optional().nullable(),
  baseSalary: z.number().min(0).default(0), currency: z.string().default("ETB"),
  payFrequency: z.string().default("monthly"), taxExemptionAmount: z.number().min(0).default(0),
  allowsOvertime: z.boolean().default(false),
});

export const GET = withTenant(async ({ req }) => {
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const department = url.searchParams.get("department");
  const orgNodeId = url.searchParams.get("orgNodeId");
  const search = url.searchParams.get("q");
  const employees = await db.employee.findMany({
    where: {
      ...(status ? { employmentStatus: status } : {}),
      ...(department ? { department } : {}),
      ...(orgNodeId ? { orgNodeId } : {}),
      ...(search ? { OR: [{ firstName: { contains: search } }, { lastName: { contains: search } }, { employeeNumber: { contains: search } }, { phone: { contains: search } }] } : {}),
    },
    include: { orgNode: { select: { id: true, name: true, code: true } } },
    orderBy: { firstName: "asc" }, take: 500,
  });
  return Response.json({ employees });
});

export const POST = withTenant(async ({ req, user }) => {
  const data = await parseAndValidate(req, employeeSchema);
  const tenantId = getCurrentTenantId()!;
  const employeeNumber = await NumberService.next(tenantId, "EMP");
  const fullName = [data.firstName, data.middleName, data.lastName].filter(Boolean).join(" ");
  const employee = await db.employee.create({
    data: {
      tenantId, employeeNumber, orgNodeId: data.orgNodeId ?? null,
      firstName: data.firstName, middleName: data.middleName ?? null, lastName: data.lastName, fullName,
      gender: data.gender ?? null, dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
      nationality: data.nationality, maritalStatus: data.maritalStatus ?? null,
      idNumber: data.idNumber ?? null, tinNumber: data.tinNumber ?? null, pensionNumber: data.pensionNumber ?? null,
      phone: data.phone ?? null, email: data.email ?? null, address: data.address ?? null,
      emergencyContact: data.emergencyContact ?? null, emergencyPhone: data.emergencyPhone ?? null,
      hireDate: data.hireDate ? new Date(data.hireDate) : new Date(),
      probationEndDate: data.probationEndDate ? new Date(data.probationEndDate) : null,
      employmentType: data.employmentType, jobTitle: data.jobTitle ?? null, department: data.department ?? null,
      payGrade: data.payGrade ?? null, bankAccount: data.bankAccount ?? null, bankName: data.bankName ?? null,
      baseSalary: data.baseSalary, currency: data.currency, payFrequency: data.payFrequency,
      taxExemptionAmount: data.taxExemptionAmount, allowsOvertime: data.allowsOvertime, userId: user.id,
    },
  });
  return Response.json({ employee }, { status: 201 });
});
