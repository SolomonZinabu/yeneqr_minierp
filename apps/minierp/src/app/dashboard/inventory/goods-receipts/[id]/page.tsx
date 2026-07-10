"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { ArrowLeft, BookOpen } from "lucide-react";

interface GoodsReceipt { id: string; grnNumber: string; status: string; receiptDate: string; invoiceNumber: string | null; subtotal: number; taxTotal: number; totalAmount: number; journalEntryId: string | null; notes: string | null; supplier: { name: string; code: string } | null; orgNode: { name: string; code: string }; purchaseOrder: { poNumber: string } | null; lines: { id: string; lineNo: number; quantityOrdered: number | null; quantityReceived: number; quantityRejected: number; uom: string; unitCost: number; taxRate: number; lineTotal: number; batchNo: string | null; expiryDate: string | null; item: { sku: string; name: string } }[] }
const fmtETB = (n: number) => new Intl.NumberFormat("en-ET", { style: "currency", currency: "ETB" }).format(n);
const fmtDate = (s: string) => new Date(s).toLocaleDateString("en-ET", { dateStyle: "medium" });

export default function GoodsReceiptDetailPage() {
  const params = useParams<{ id: string }>();
  const [gr, setGr] = useState<GoodsReceipt | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetch(`/api/inventory/goods-receipts/${params.id}`).then(r => r.json()).then(d => setGr(d.goodsReceipt)).catch(() => toast.error("Failed to load GRN")).finally(() => setLoading(false)); }, [params.id]);

  async function postToGL() {
    const res = await fetch(`/api/inventory/goods-receipts/${params.id}/post`, { method: "POST" });
    if (res.ok) { const data = await res.json(); if (data.alreadyPosted) toast.info("Already posted to GL"); else toast.success("Posted to GL"); setGr(g => g ? { ...g, journalEntryId: data.journalEntryId } : g); }
    else { const err = await res.json(); toast.error(err.error ?? "Failed to post"); }
  }

  if (loading) return <p className="py-8 text-center text-sm text-muted-foreground">Loading...</p>;
  if (!gr) return <p className="py-8 text-center text-sm text-red-600">GRN not found</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3"><Button asChild variant="ghost" size="icon"><Link href="/dashboard/inventory/goods-receipts"><ArrowLeft className="h-4 w-4" /></Link></Button><div><div className="flex items-center gap-2"><h1 className="text-2xl font-bold tracking-tight">{gr.grnNumber}</h1><Badge variant={gr.status === "received" ? "default" : "secondary"}>{gr.status}</Badge>{gr.journalEntryId && <Badge>GL Posted</Badge>}</div><p className="text-sm text-muted-foreground">{gr.supplier?.name ?? "—"} · Received {fmtDate(gr.receiptDate)}</p></div></div>
        {!gr.journalEntryId && gr.status === "received" && <Button onClick={postToGL}><BookOpen className="mr-2 h-4 w-4" /> Post to GL</Button>}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2"><CardHeader><CardTitle className="text-sm">Items Received</CardTitle></CardHeader><CardContent>
          <Table><TableHeader><TableRow><TableHead>#</TableHead><TableHead>Item</TableHead><TableHead className="text-right">Ordered</TableHead><TableHead className="text-right">Received</TableHead><TableHead className="text-right">Rejected</TableHead><TableHead>UoM</TableHead><TableHead className="text-right">Unit Cost</TableHead><TableHead className="text-right">Total</TableHead><TableHead>Batch</TableHead></TableRow></TableHeader>
            <TableBody>{gr.lines.map(line => (
              <TableRow key={line.id}><TableCell className="text-xs">{line.lineNo}</TableCell><TableCell><div className="font-medium">{line.item.name}</div><div className="font-mono text-xs text-muted-foreground">{line.item.sku}</div></TableCell><TableCell className="text-right text-xs">{line.quantityOrdered ?? "—"}</TableCell><TableCell className="text-right">{line.quantityReceived}</TableCell><TableCell className="text-right text-xs text-red-600">{line.quantityRejected || "—"}</TableCell><TableCell className="text-xs">{line.uom}</TableCell><TableCell className="text-right">{fmtETB(line.unitCost)}</TableCell><TableCell className="text-right font-medium">{fmtETB(line.lineTotal)}</TableCell><TableCell className="text-xs font-mono">{line.batchNo ?? "—"}</TableCell></TableRow>
            ))}</TableBody>
          </Table>
          <div className="mt-4 flex justify-end"><div className="w-64 space-y-1 text-sm"><div className="flex justify-between"><span className="text-muted-foreground">Subtotal:</span><span>{fmtETB(gr.subtotal)}</span></div><div className="flex justify-between"><span className="text-muted-foreground">Tax:</span><span>{fmtETB(gr.taxTotal)}</span></div><div className="flex justify-between border-t pt-1 font-bold"><span>Total:</span><span>{fmtETB(gr.totalAmount)}</span></div></div></div>
        </CardContent></Card>
        <div className="space-y-4">
          <Card><CardHeader><CardTitle className="text-sm">Receipt Info</CardTitle></CardHeader><CardContent className="text-sm space-y-2"><div className="flex justify-between"><span className="text-muted-foreground">Branch:</span><span>{gr.orgNode?.name}</span></div><div className="flex justify-between"><span className="text-muted-foreground">Supplier:</span><span>{gr.supplier?.name ?? "—"}</span></div><div className="flex justify-between"><span className="text-muted-foreground">PO:</span><span className="font-mono">{gr.purchaseOrder?.poNumber ?? "—"}</span></div><div className="flex justify-between"><span className="text-muted-foreground">Invoice #:</span><span>{gr.invoiceNumber ?? "—"}</span></div><div className="flex justify-between"><span className="text-muted-foreground">Receipt Date:</span><span>{fmtDate(gr.receiptDate)}</span></div></CardContent></Card>
          {gr.notes && <Card><CardHeader><CardTitle className="text-sm">Notes</CardTitle></CardHeader><CardContent className="text-sm">{gr.notes}</CardContent></Card>}
        </div>
      </div>
    </div>
  );
}
