"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Users } from "lucide-react";

interface Supplier { id: string; code: string; name: string; contactName: string | null; email: string | null; phone: string | null; city: string | null; paymentTerms: string | null; leadTimeDays: number; isActive: boolean; _count: { purchaseOrders: number } }

export default function SuppliersListPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(async () => {
      const params = new URLSearchParams();
      if (search) params.set("q", search);
      const res = await fetch(`/api/inventory/suppliers?${params}`);
      if (res.ok) { const d = await res.json(); setSuppliers(d.suppliers ?? []); }
      setLoading(false);
    }, 250);
    return () => clearTimeout(t);
  }, [search]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between"><div><h1 className="text-2xl font-bold tracking-tight">Suppliers</h1><p className="text-sm text-muted-foreground">Vendor directory</p></div><Button asChild><Link href="/dashboard/inventory/suppliers/new"><Plus className="mr-2 h-4 w-4" /> New Supplier</Link></Button></div>
      <Card><CardHeader><div className="flex items-center gap-2"><Search className="h-4 w-4 text-muted-foreground" /><Input placeholder="Search by name, code, or contact..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" /></div></CardHeader>
        <CardContent>{loading ? <p className="py-8 text-center text-sm text-muted-foreground">Loading...</p> : suppliers.length === 0 ? (
          <div className="py-12 text-center"><Users className="mx-auto h-10 w-10 text-muted-foreground" /><p className="mt-3 text-sm font-medium">No suppliers yet</p><Button asChild className="mt-4"><Link href="/dashboard/inventory/suppliers/new"><Plus className="mr-2 h-4 w-4" /> Add Supplier</Link></Button></div>
        ) : (
          <Table><TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>Contact</TableHead><TableHead>City</TableHead><TableHead>Payment Terms</TableHead><TableHead className="text-right">Lead (days)</TableHead><TableHead className="text-right">POs</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>{suppliers.map(s => (
              <TableRow key={s.id}><TableCell className="font-mono text-xs">{s.code}</TableCell><TableCell className="font-medium">{s.name}</TableCell><TableCell className="text-xs">{s.contactName ?? s.email ?? s.phone ?? "—"}</TableCell><TableCell className="text-xs">{s.city ?? "—"}</TableCell><TableCell className="text-xs">{s.paymentTerms ?? "—"}</TableCell><TableCell className="text-right text-xs">{s.leadTimeDays}</TableCell><TableCell className="text-right text-xs">{s._count?.purchaseOrders ?? 0}</TableCell><TableCell><Badge variant={s.isActive ? "default" : "secondary"} className="text-xs">{s.isActive ? "Active" : "Inactive"}</Badge></TableCell></TableRow>
            ))}</TableBody>
          </Table>
        )}</CardContent>
      </Card>
    </div>
  );
}
