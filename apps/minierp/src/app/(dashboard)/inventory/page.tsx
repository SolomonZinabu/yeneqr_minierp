import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package } from "lucide-react";

export default function InventoryPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Package className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Inventory & SCM</h1>
          <p className="text-sm text-muted-foreground">Phase 1 — coming next</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">What you&apos;ll get in Phase 1</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>• <strong>Stock ledger</strong> — append-only <code>StockMovement</code> table replaces direct mutations. Full audit trail of every stock change.</li>
            <li>• <strong>Suppliers</strong> — proper supplier directory with contact info, lead times, payment terms.</li>
            <li>• <strong>Purchase orders</strong> — draft → send → receive (partial or full) → close. Auto-restock on receipt.</li>
            <li>• <strong>Goods receipts</strong> — link to PO, update weighted-average cost per unit on receipt.</li>
            <li>• <strong>Costing</strong> — <code>ItemCostSnapshot</code> auto-computed from ingredient costs × recipe quantities. Real margin reports.</li>
            <li>• <strong>Stocktake</strong> — count sheet → variance review → approve → auto-adjustment.</li>
            <li>• <strong>Branch transfers</strong> — request → in-transit → received, with automatic stock movements.</li>
            <li>• <strong>Wastage</strong> — record spillage/expiry/theft with cost, auto-post to GL in Phase 2.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
