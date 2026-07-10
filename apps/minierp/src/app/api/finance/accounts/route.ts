// GET/POST /api/finance/accounts
import { withTenant, parseAndValidate, db, HttpError } from "@/lib/api-helpers";
import { getCurrentTenantId } from "@/lib/db";
import { z } from "zod";

const accountSchema = z.object({
  code: z.string().min(1).max(20), name: z.string().min(1).max(200),
  type: z.enum(["asset", "liability", "equity", "revenue", "expense", "contra"]),
  subtype: z.string().max(50).optional().nullable(), parentCode: z.string().max(20).optional().nullable(),
  description: z.string().max(500).optional().nullable(), isActive: z.boolean().default(true),
  openingBalance: z.number().default(0),
});

export const GET = withTenant(async ({ req }) => {
  const url = new URL(req.url);
  const type = url.searchParams.get("type");
  const accounts = await db.ledgerAccount.findMany({ where: type ? { type } : {}, orderBy: { code: "asc" }, take: 500 });
  return Response.json({ accounts });
});

export const POST = withTenant(async ({ req }) => {
  const data = await parseAndValidate(req, accountSchema);
  const existing = await db.ledgerAccount.findUnique({ where: { tenantId_code: { tenantId: "", code: data.code } as never } }).catch(() => null);
  if (existing) throw new HttpError(409, `Account ${data.code} already exists`);
  const account = await db.ledgerAccount.create({
    data: {
      tenantId: getCurrentTenantId()!, code: data.code, name: data.name, type: data.type,
      subtype: data.subtype ?? null, parentCode: data.parentCode ?? null,
      description: data.description ?? null, isActive: data.isActive,
      openingBalance: data.openingBalance, isSystem: false, isControl: false,
    },
  });
  return Response.json({ account }, { status: 201 });
});
