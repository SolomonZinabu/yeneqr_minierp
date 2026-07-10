"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, ShoppingCart } from "lucide-react";

interface PurchaseOrder { id: string; poNumber: string; status: string; orderDate: string; totalAmount: number; supplier: { id: string; name: string; code: string }; orgNode: { id: string; name: string; code: string } | null; _count: { lines: number; goodsReceipts: number } }
const fmtETB = (n: number) => new Intl.NumberFormat("en-ET", { style: "currency", currency: "ETB", maximumFractionDigits: 0 }).format(n);
const fmtDate = (s: string) => new Date(s).toLocaleDateString("en-ET", { month: "short", day: "numeric", year: "numeric" });
const statusColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = { draft: "secondary", submitted: "outline", approved: "default", sent: "default", partial: "outline", received: "default", closed: "secondary", cancelled: "destructive" };

export default function PurchaseOrdersListPage() {
  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch("/api/inventory/purchase-orders?limit=100").then(r => r.json()).then(d => setPos(d.purchaseOrders ?? [])).catch(() => setPos([])).finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between"><div><h1 className="text-2xl font-bold tracking-tight">Purchase Orders</h1><p className="text-sm text-muted-foreground">Draft → submit → approve → send → receive → close</p></div><Button asChild><Link href="/dashboard/inventory/purchase-orders/new"><Plus className="mr-2 h-4 w-4" /> New PO</Link></Button></div>
      <Card><CardContent className="p-0">{loading ? <p className="py-8 text-center text-sm text-muted-foreground">Loading...</p> : pos.length === 0 ? (
        <div className="py-12 text-center"><ShoppingCart className="mx-auto h-10 w-10 text-muted-foreground" /><p className="mt-3 text-sm font-medium">No purchase orders yet</p><Button asChild className="mt-4"><Link href="/dashboard/inventory/purchase-orders/new"><Plus className="mr-2 h-4 w-4" /> Create First PO</Link></Button></div>
      ) : (
        <Table><TableHeader><TableRow><TableHead>PO #</TableHead><TableHead>Supplier</TableHead><TableHead>Branch</TableHead><TableHead>Date</TableHead><TableHead className="text-right">Amount</TableHead><TableHead className="text-right">Lines</TableHead><TableHead className="text-right">GRNs</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
          <TableBody>{pos.map(po => (
            <TableRow key={po.id}><TableCell><Link href={`/dashboard/inventory/purchase-orders/${po.id}`} className="font-mono font-medium hover:underline">{po.poNumber}</Link></TableCell><TableCell className="text-sm">{po.supplier?.name ?? "—"}</TableCell><TableCell className="text-xs">{po.orgNode?.name ?? "—"}</TableCell><TableCell className="text-xs">{fmtDate(po.orderDate)}</TableCell><TableCell className="text-right font-medium">{fmtETB(po.totalAmount)}</TableCell><TableCell className="text-right text-xs">{po._count?.lines ?? 0}</TableCell><TableCell className="text-right text-xs">{po._count?.goodsReceipts ?? 0}</TableCell><TableCell><Badge variant={statusColors[po.status] ?? "outline"} className="text-xs capitalize">{po.status}</Badge></TableCell></TableRow>
          ))}</TableBody>
        </Table>
      )}</CardContent>
      </Card>
    </div>
  );
}
