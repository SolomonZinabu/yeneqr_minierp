// GET /api/finance/reports/profit-and-loss
import { withTenant, HttpError } from "@/lib/api-helpers";
import { GlService } from "@/lib/services/gl-service";

export const GET = withTenant(async ({ req }) => {
  const url = new URL(req.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  if (!from || !to) throw new HttpError(400, "Both 'from' and 'to' query params are required (ISO dates)");
  const pnl = await GlService.profitAndLoss(new Date(from), new Date(to));
  return Response.json({ from, to, ...pnl });
});
