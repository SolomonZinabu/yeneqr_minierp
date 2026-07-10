// POST /api/hr/payroll/runs/[id]/approve  (requires hr.payroll.approve)
import { withPermission } from "@/lib/api-helpers";
import { PayrollService } from "@/lib/services/payroll-service";

export const POST = withPermission("hr.payroll.approve", async ({ params, user }) => {
  const result = await PayrollService.approveAndPost(params.id, user.id);
  return Response.json({ result });
});
