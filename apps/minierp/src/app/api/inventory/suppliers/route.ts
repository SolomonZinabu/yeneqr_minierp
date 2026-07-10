// GET/POST /api/inventory/suppliers
import { withTenant, parseAndValidate, db, HttpError } from "@/lib/api-helpers";
import { getCurrentTenantId } from "@/lib/db";
import { z } from "zod";

const supplierSchema = z.object({
  code: z.string().min(1).max(32), name: z.string().min(1).max(200),
  legalName: z.string().max(200).optional().nullable(), taxId: z.string().max(50).optional().nullable(),
  contactName: z.string().max(100).optional().nullable(), email: z.string().email().optional().nullable(),
  phone: z.string().max(50).optional().nullable(), address: z.string().max(500).optional().nullable(),
  city: z.string().max(100).optional().nullable(), region: z.string().max(100).optional().nullable(),
  country: z.string().max(100).default("Ethiopia"), paymentTerms: z.string().max(50).optional().nullable(),
  currency: z.string().max(10).default("ETB"), leadTimeDays: z.number().min(0).default(0),
  rating: z.number().min(1).max(5).optional().nullable(), bankAccount: z.string().max(50).optional().nullable(),
  bankName: z.string().max(100).optional().nullable(), notes: z.string().max(2000).optional().nullable(),
  isActive: z.boolean().default(true),
});

export const GET = withTenant(async ({ req }) => {
  const url = new URL(req.url);
  const search = url.searchParams.get("q");
  const isActive = url.searchParams.get("isActive");
  const suppliers = await db.supplier.findMany({
    where: {
      ...(search ? { OR: [{ name: { contains: search } }, { code: { contains: search } }, { contactName: { contains: search } }] } : {}),
      ...(isActive !== null ? { isActive: isActive === "true" } : {}),
    },
    orderBy: { name: "asc" }, take: 500,
  });
  return Response.json({ suppliers });
});

export const POST = withTenant(async ({ req }) => {
  const data = await parseAndValidate(req, supplierSchema);
  const existing = await db.supplier.findUnique({ where: { tenantId_code: { tenantId: "", code: data.code } as never } }).catch(() => null);
  if (existing) throw new HttpError(409, `Supplier with code "${data.code}" already exists`);
  const supplier = await db.supplier.create({
    data: {
      tenantId: getCurrentTenantId()!, code: data.code, name: data.name,
      legalName: data.legalName ?? null, taxId: data.taxId ?? null, contactName: data.contactName ?? null,
      email: data.email ?? null, phone: data.phone ?? null, address: data.address ?? null,
      city: data.city ?? null, region: data.region ?? null, country: data.country,
      paymentTerms: data.paymentTerms ?? null, currency: data.currency, leadTimeDays: data.leadTimeDays,
      rating: data.rating ?? null, bankAccount: data.bankAccount ?? null, bankName: data.bankName ?? null,
      notes: data.notes ?? null, isActive: data.isActive,
    },
  });
  return Response.json({ supplier }, { status: 201 });
});
