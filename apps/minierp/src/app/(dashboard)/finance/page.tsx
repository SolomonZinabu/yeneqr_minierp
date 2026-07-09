import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Wallet } from "lucide-react";

export default function FinancePage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Wallet className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Finance & GL</h1>
          <p className="text-sm text-muted-foreground">Phase 2</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">What you&apos;ll get in Phase 2</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>• <strong>Chart of accounts</strong> — flat COA seeded for Ethiopian restaurants (~30 accounts).</li>
            <li>• <strong>Double-entry GL</strong> — JournalHeader + JournalLine, all entries must balance.</li>
            <li>• <strong>Auto-posting engine</strong> — hardcoded PostingRule table. Every YeneQR order → Dr Cash / Cr Revenue + Cr VAT. Every GRN → Dr Inventory / Cr AP. Every wastage → Dr COGS / Cr Inventory.</li>
            <li>• <strong>P&L statement</strong> — real-time, per branch or consolidated, any date range.</li>
            <li>• <strong>Balance sheet</strong> — Cash, Bank, Inventory, AP, VAT Payable, PIT Payable, Pension Payable, Equity.</li>
            <li>• <strong>Bank reconciliation</strong> — CSV import from CBE/Dashen/Awash, match to journal lines.</li>
            <li>• <strong>Supplier invoices</strong> — 2-way match to GRN, track amount owed per supplier.</li>
            <li>• <strong>Number series</strong> — sequential, gap-free, branch-prefixable document numbers (PO-000123, GRN-000045).</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
