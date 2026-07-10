// GET /api/finance/reports/trial-balance
import { withTenant } from "@/lib/api-helpers";
import { GlService } from "@/lib/services/gl-service";

export const GET = withTenant(async ({ req }) => {
  const url = new URL(req.url);
  const asOf = url.searchParams.get("asOf");
  const balance = await GlService.trialBalance(asOf ? new Date(asOf) : undefined);
  const totalDebit = balance.reduce((s, b) => s + b.debitBalance, 0);
  const totalCredit = balance.reduce((s, b) => s + b.creditBalance, 0);
  return Response.json({ asOf: asOf ?? new Date().toISOString(), accounts: balance, totals: { debit: totalDebit, credit: totalCredit, diff: totalDebit - totalCredit } });
});
