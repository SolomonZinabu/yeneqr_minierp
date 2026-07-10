// GET/POST /api/hr/salary-components
import { withTenant, parseAndValidate, db, HttpError } from "@/lib/api-helpers";
import { getCurrentTenantId } from "@/lib/db";
import { z } from "zod";

const componentSchema = z.object({
  code: z.string().min(1).max(32), name: z.string().min(1).max(100),
  type: z.enum(["earning", "deduction", "contribution_employer"]),
  category: z.string().max(50).optional().nullable(),
  calcType: z.enum(["formula", "fixed", "percentage_of_basic"]).default("formula"),
  formula: z.string().max(500).optional().nullable(), amount: z.number().min(0).optional().nullable(),
  isTaxable: z.boolean().default(false), isPensionable: z.boolean().default(false),
  affectsCostOfSales: z.boolean().default(false), glAccountId: z.string().optional().nullable(),
  sortOrder: z.number().default(0), isActive: z.boolean().default(true),
});

export const GET = withTenant(async () => {
  const components = await db.salaryComponent.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  return Response.json({ components });
});

export const POST = withTenant(async ({ req }) => {
  const data = await parseAndValidate(req, componentSchema);
  const existing = await db.salaryComponent.findUnique({ where: { tenantId_code: { tenantId: "", code: data.code } as never } }).catch(() => null);
  if (existing) throw new HttpError(409, `Salary component ${data.code} already exists`);
  const component = await db.salaryComponent.create({
    data: {
      tenantId: getCurrentTenantId()!, code: data.code, name: data.name, type: data.type,
      category: data.category ?? null, calcType: data.calcType, formula: data.formula ?? null,
      amount: data.amount ?? null, isTaxable: data.isTaxable, isPensionable: data.isPensionable,
      affectsCostOfSales: data.affectsCostOfSales, glAccountId: data.glAccountId ?? null,
      sortOrder: data.sortOrder, isActive: data.isActive,
    },
  });
  return Response.json({ component }, { status: 201 });
});
