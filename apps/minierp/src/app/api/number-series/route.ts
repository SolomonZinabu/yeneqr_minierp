// GET /api/number-series
import { withTenant, db } from "@/lib/api-helpers";
import { NumberService, DEFAULT_NUMBER_SERIES } from "@/lib/services/number-service";
import { getCurrentTenantId } from "@/lib/db";

export const GET = withTenant(async ({ req }) => {
  const url = new URL(req.url);
  const peekCode = url.searchParams.get("peek");
  if (peekCode) {
    const tenantId = getCurrentTenantId()!;
    const next = await NumberService.peek(tenantId, peekCode);
    return Response.json({ code: peekCode, nextNumber: next });
  }
  const series = await db.numberSeries.findMany({ orderBy: { code: "asc" } });
  const tenantId = getCurrentTenantId();
  const year = new Date().getFullYear();
  const enriched = await Promise.all(series.map(async (s) => {
    const yearSeq = tenantId ? await db.numberSequenceValue.findUnique({ where: { tenantId_seriesId_fiscalYear: { tenantId, seriesId: s.id, fiscalYear: year } } }) : null;
    return { ...s, nextValueForCurrentYear: yearSeq?.nextValue ?? s.nextValue, peekNext: `${s.prefix}${String(yearSeq?.nextValue ?? s.nextValue).padStart(s.padding, "0")}` };
  }));
  const existingCodes = new Set(series.map((s) => s.code));
  const pending = DEFAULT_NUMBER_SERIES.filter((d) => !existingCodes.has(d.code));
  return Response.json({ series: enriched, pendingDefaults: pending });
});
