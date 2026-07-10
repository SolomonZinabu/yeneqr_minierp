// GET/POST /api/finance/journal-entries
import { withTenant, parseAndValidate, db } from "@/lib/api-helpers";
import { GlService } from "@/lib/services/gl-service";
import { z } from "zod";

const lineSchema = z.object({
  accountCode: z.string().min(1), debit: z.number().min(0).default(0), credit: z.number().min(0).default(0),
  description: z.string().max(500).optional().nullable(), entityType: z.string().max(50).optional().nullable(),
  entityId: z.string().optional().nullable(),
});
const entrySchema = z.object({
  entryDate: z.string().datetime().optional(), description: z.string().min(1).max(500),
  source: z.string().max(50).default("manual"), sourceRefId: z.string().optional().nullable(),
  lines: z.array(lineSchema).min(2), postImmediately: z.boolean().default(true),
});

export const GET = withTenant(async ({ req }) => {
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const source = url.searchParams.get("source");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50"), 200);
  const entries = await db.journalEntry.findMany({
    where: {
      ...(status ? { status } : {}), ...(source ? { source } : {}),
      ...(from || to ? { entryDate: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } } : {}),
    },
    include: { lines: { include: { account: { select: { code: true, name: true, type: true } } }, orderBy: { lineNo: "asc" } } },
    orderBy: [{ entryDate: "desc" }, { entryNumber: "desc" }], take: limit,
  });
  return Response.json({ entries });
});

export const POST = withTenant(async ({ req, user }) => {
  const data = await parseAndValidate(req, entrySchema);
  const entry = await GlService.postEntry({
    entryDate: data.entryDate ? new Date(data.entryDate) : undefined,
    description: data.description, source: data.source, sourceRefId: data.sourceRefId ?? undefined,
    lines: data.lines.map((l) => ({
      accountCode: l.accountCode, debit: l.debit, credit: l.credit,
      description: l.description ?? undefined, entityType: l.entityType ?? undefined, entityId: l.entityId ?? undefined,
    })),
    createdBy: user.id, postImmediately: data.postImmediately,
  });
  return Response.json({ entry }, { status: 201 });
});
