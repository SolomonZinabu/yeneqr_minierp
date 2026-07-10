"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, FileText } from "lucide-react";

interface GoodsReceipt { id: string; grnNumber: string; status: string; receiptDate: string; totalAmount: number; supplier: { id: string; name: string; code: string } | null; orgNode: { id: string; name: string; code: string }; purchaseOrder: { id: string; poNumber: string } | null; journalEntryId: string | null; _count: { lines: number } }
const fmtETB = (n: number) => new Intl.NumberFormat("en-ET", { style: "currency", currency: "ETB", maximumFractionDigits: 0 }).format(n);
const fmtDate = (s: string) => new Date(s).toLocaleDateString("en-ET", { month: "short", day: "numeric", year: "numeric" });

export default function GoodsReceiptsListPage() {
  const [grs, setGrs] = useState<GoodsReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { fetch("/api/inventory/goods-receipts?limit=100").then(r => r.json()).then(d => setGrs(d.goodsReceipts ?? [])).catch(() => setGrs([])).finally(() => setLoading(false)); }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between"><div><h1 className="text-2xl font-bold tracking-tight">Goods Receipts</h1><p className="text-sm text-muted-foreground">Receive stock, update weighted-avg cost, post to GL</p></div><Button asChild><Link href="/dashboard/inventory/goods-receipts/new"><Plus className="mr-2 h-4 w-4" /> New GRN</Link></Button></div>
      <Card><CardContent className="p-0">{loading ? <p className="py-8 text-center text-sm text-muted-foreground">Loading...</p> : grs.length === 0 ? (
        <div className="py-12 text-center"><FileText className="mx-auto h-10 w-10 text-muted-foreground" /><p className="mt-3 text-sm font-medium">No goods receipts yet</p><Button asChild className="mt-4"><Link href="/dashboard/inventory/goods-receipts/new"><Plus className="mr-2 h-4 w-4" /> Receive Stock</Link></Button></div>
      ) : (
        <Table><TableHeader><TableRow><TableHead>GRN #</TableHead><TableHead>Supplier</TableHead><TableHead>Branch</TableHead><TableHead>PO</TableHead><TableHead>Date</TableHead><TableHead className="text-right">Amount</TableHead><TableHead className="text-right">Lines</TableHead><TableHead>GL</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
          <TableBody>{grs.map(gr => (
            <TableRow key={gr.id}><TableCell><Link href={`/dashboard/inventory/goods-receipts/${gr.id}`} className="font-mono font-medium hover:underline">{gr.grnNumber}</Link></TableCell><TableCell className="text-sm">{gr.supplier?.name ?? "—"}</TableCell><TableCell className="text-xs">{gr.orgNode?.name ?? "—"}</TableCell><TableCell className="text-xs font-mono">{gr.purchaseOrder?.poNumber ?? "—"}</TableCell><TableCell className="text-xs">{fmtDate(gr.receiptDate)}</TableCell><TableCell className="text-right font-medium">{fmtETB(gr.totalAmount)}</TableCell><TableCell className="text-right text-xs">{gr._count?.lines ?? 0}</TableCell><TableCell>{gr.journalEntryId ? <Badge className="text-xs">Posted</Badge> : <Badge variant="outline" className="text-xs">Pending</Badge>}</TableCell><TableCell><Badge variant={gr.status === "received" ? "default" : "secondary"} className="text-xs">{gr.status}</Badge></TableCell></TableRow>
          ))}</TableBody>
        </Table>
      )}</CardContent></Card>
    </div>
  );
}
