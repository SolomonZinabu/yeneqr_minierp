"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { ArrowLeft, Check, X } from "lucide-react";

interface PurchaseOrder { id: string; poNumber: string; status: string; orderDate: string; expectedDate: string | null; currency: string; subtotal: number; taxTotal: number; totalAmount: number; notes: string | null; approvedBy: string | null; approvedAt: string | null; supplier: { id: string; name: string; code: string; phone: string | null; email: string | null }; orgNode: { id: string; name: string; code: string } | null; lines: { id: string; lineNo: number; quantity: number; uom: string; unitCost: number; taxRate: number; lineTotal: number; receivedQty: number; item: { id: string; sku: string; name: string } }[]; goodsReceipts: { id: string; grnNumber: string; receiptDate: string; status: string; totalAmount: number }[] }
const fmtETB = (n: number) => new Intl.NumberFormat("en-ET", { style: "currency", currency: "ETB" }).format(n);
const fmtDate = (s: string) => new Date(s).toLocaleDateString("en-ET", { dateStyle: "medium" });
const statusColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = { draft: "secondary", submitted: "outline", approved: "default", sent: "default", partial: "outline", received: "default", closed: "secondary", cancelled: "destructive" };

export default function PurchaseOrderDetailPage() {
  const params = useParams<{ id: string }>();
  const [po, setPo] = useState<PurchaseOrder | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetch(`/api/inventory/purchase-orders/${params.id}`).then(r => r.json()).then(d => setPo(d.purchaseOrder)).catch(() => toast.error("Failed to load PO")).finally(() => setLoading(false)); }, [params.id]);

  async function transitionStatus(newStatus: string) {
    const res = await fetch(`/api/inventory/purchase-orders/${params.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: newStatus }) });
    if (res.ok) { toast.success(`PO ${newStatus}`); const fresh = await res.json(); setPo(fresh.purchaseOrder); }
    else toast.error("Failed");
  }
  async function approve() {
    const res = await fetch(`/api/inventory/purchase-orders/${params.id}/approve`, { method: "POST" });
    if (res.ok) { toast.success("PO approved"); const fresh = await fetch(`/api/inventory/purchase-orders/${params.id}`).then(r => r.json()); setPo(fresh.purchaseOrder); }
    else { const err = await res.json(); toast.error(err.error ?? "Failed"); }
  }

  if (loading) return <p className="py-8 text-center text-sm text-muted-foreground">Loading...</p>;
  if (!po) return <p className="py-8 text-center text-sm text-red-600">PO not found</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3"><Button asChild variant="ghost" size="icon"><Link href="/dashboard/inventory/purchase-orders"><ArrowLeft className="h-4 w-4" /></Link></Button><div><div className="flex items-center gap-2"><h1 className="text-2xl font-bold tracking-tight">{po.poNumber}</h1><Badge variant={statusColors[po.status] ?? "outline"}>{po.status}</Badge></div><p className="text-sm text-muted-foreground">{po.supplier?.name} · Ordered {fmtDate(po.orderDate)} · {po.currency}</p></div></div>
        <div className="flex gap-2">
          {po.status === "draft" && <Button onClick={() => transitionStatus("submitted")}>Submit for Approval</Button>}
          {po.status === "submitted" && (<><Button variant="outline" onClick={() => transitionStatus("draft")}>Send Back</Button><Button onClick={approve}><Check className="mr-2 h-4 w-4" /> Approve</Button></>)}
          {po.status === "approved" && <Button onClick={() => transitionStatus("sent")}>Mark as Sent</Button>}
          {(po.status === "sent" || po.status === "partial") && <Button asChild><Link href={`/dashboard/inventory/goods-receipts/new?poId=${po.id}`}>Receive Goods</Link></Button>}
          {(po.status === "received" || po.status === "partial") && <Button variant="outline" onClick={() => transitionStatus("closed")}>Close PO</Button>}
          {["draft", "submitted"].includes(po.status) && <Button variant="destructive" size="icon" onClick={() => transitionStatus("cancelled")}><X className="h-4 w-4" /></Button>}
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2"><CardHeader><CardTitle className="text-sm">Line Items</CardTitle></CardHeader><CardContent>
          <Table><TableHeader><TableRow><TableHead>#</TableHead><TableHead>Item</TableHead><TableHead className="text-right">Ordered</TableHead><TableHead className="text-right">Received</TableHead><TableHead>UoM</TableHead><TableHead className="text-right">Unit Cost</TableHead><TableHead className="text-right">Tax</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
            <TableBody>{po.lines.map(line => (
              <TableRow key={line.id}><TableCell className="text-xs">{line.lineNo}</TableCell><TableCell><div className="font-medium">{line.item.name}</div><div className="font-mono text-xs text-muted-foreground">{line.item.sku}</div></TableCell><TableCell className="text-right">{line.quantity}</TableCell><TableCell className="text-right"><span className={line.receivedQty >= line.quantity ? "text-green-600" : line.receivedQty > 0 ? "text-amber-600" : "text-muted-foreground"}>{line.receivedQty}</span></TableCell><TableCell className="text-xs">{line.uom}</TableCell><TableCell className="text-right">{fmtETB(line.unitCost)}</TableCell><TableCell className="text-right text-xs">{(line.taxRate * 100).toFixed(0)}%</TableCell><TableCell className="text-right font-medium">{fmtETB(line.lineTotal)}</TableCell></TableRow>
            ))}</TableBody>
          </Table>
          <div className="mt-4 flex justify-end"><div className="w-64 space-y-1 text-sm"><div className="flex justify-between"><span className="text-muted-foreground">Subtotal:</span><span>{fmtETB(po.subtotal)}</span></div><div className="flex justify-between"><span className="text-muted-foreground">Tax:</span><span>{fmtETB(po.taxTotal)}</span></div><div className="flex justify-between border-t pt-1 font-bold"><span>Total:</span><span>{fmtETB(po.totalAmount)}</span></div></div></div>
        </CardContent></Card>
        <div className="space-y-4">
          <Card><CardHeader><CardTitle className="text-sm">Supplier</CardTitle></CardHeader><CardContent className="text-sm space-y-1"><p className="font-medium">{po.supplier.name}</p><p className="text-xs text-muted-foreground">Code: {po.supplier.code}</p>{po.supplier.phone && <p className="text-xs">{po.supplier.phone}</p>}{po.supplier.email && <p className="text-xs">{po.supplier.email}</p>}</CardContent></Card>
          {po.expectedDate && <Card><CardHeader><CardTitle className="text-sm">Expected Date</CardTitle></CardHeader><CardContent className="text-sm">{fmtDate(po.expectedDate)}</CardContent></Card>}
          {po.approvedAt && <Card><CardHeader><CardTitle className="text-sm">Approved</CardTitle></CardHeader><CardContent className="text-sm">{fmtDate(po.approvedAt)}</CardContent></Card>}
          {po.goodsReceipts.length > 0 && <Card><CardHeader><CardTitle className="text-sm">Goods Receipts</CardTitle></CardHeader><CardContent className="space-y-2">{po.goodsReceipts.map(gr => <Link key={gr.id} href={`/dashboard/inventory/goods-receipts/${gr.id}`} className="block rounded-md border p-2 text-xs hover:bg-slate-50"><div className="flex justify-between"><span className="font-mono font-medium">{gr.grnNumber}</span><Badge variant="outline" className="text-xs">{gr.status}</Badge></div><div className="mt-1 flex justify-between text-muted-foreground"><span>{fmtDate(gr.receiptDate)}</span><span>{fmtETB(gr.totalAmount)}</span></div></Link>)}</CardContent></Card>}
          {po.notes && <Card><CardHeader><CardTitle className="text-sm">Notes</CardTitle></CardHeader><CardContent className="text-sm">{po.notes}</CardContent></Card>}
        </div>
      </div>
    </div>
  );
}
