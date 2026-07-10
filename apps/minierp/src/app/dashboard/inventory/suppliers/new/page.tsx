"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, Save } from "lucide-react";

export default function NewSupplierPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ code: "", name: "", legalName: "", taxId: "", contactName: "", email: "", phone: "", address: "", city: "", paymentTerms: "Net 30", currency: "ETB", leadTimeDays: 0, bankAccount: "", bankName: "", notes: "" });
  const update = (k: string, v: string | number) => setForm(f => ({ ...f, [k]: v }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true);
    try {
      const res = await fetch("/api/inventory/suppliers", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, legalName: form.legalName || null, taxId: form.taxId || null, contactName: form.contactName || null, email: form.email || null, phone: form.phone || null, address: form.address || null, city: form.city || null, bankAccount: form.bankAccount || null, bankName: form.bankName || null, notes: form.notes || null, leadTimeDays: Number(form.leadTimeDays) || 0 }),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error ?? "Failed"); }
      toast.success("Supplier created"); router.push("/dashboard/inventory/suppliers"); router.refresh();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setSaving(false); }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between"><div><h1 className="text-2xl font-bold tracking-tight">New Supplier</h1><p className="text-sm text-muted-foreground">Add a vendor to your supplier directory</p></div><Button asChild variant="outline"><Link href="/dashboard/inventory/suppliers"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Link></Button></div>
      <form onSubmit={handleSubmit}>
        <Card><CardHeader><CardTitle className="text-sm">Supplier Details</CardTitle></CardHeader><CardContent className="grid gap-4 md:grid-cols-2">
          <div><Label htmlFor="code">Code *</Label><Input id="code" required placeholder="SUP-001" value={form.code} onChange={(e) => update("code", e.target.value)} /></div>
          <div><Label htmlFor="name">Name *</Label><Input id="name" required value={form.name} onChange={(e) => update("name", e.target.value)} /></div>
          <div><Label htmlFor="taxId">TIN</Label><Input id="taxId" value={form.taxId} onChange={(e) => update("taxId", e.target.value)} /></div>
          <div><Label htmlFor="contactName">Contact Person</Label><Input id="contactName" value={form.contactName} onChange={(e) => update("contactName", e.target.value)} /></div>
          <div><Label htmlFor="phone">Phone</Label><Input id="phone" value={form.phone} onChange={(e) => update("phone", e.target.value)} /></div>
          <div><Label htmlFor="email">Email</Label><Input id="email" type="email" value={form.email} onChange={(e) => update("email", e.target.value)} /></div>
          <div><Label htmlFor="city">City</Label><Input id="city" value={form.city} onChange={(e) => update("city", e.target.value)} /></div>
          <div><Label htmlFor="paymentTerms">Payment Terms</Label><Input id="paymentTerms" placeholder="Net 30, COD, Net 15" value={form.paymentTerms} onChange={(e) => update("paymentTerms", e.target.value)} /></div>
          <div><Label htmlFor="leadTimeDays">Lead Time (days)</Label><Input id="leadTimeDays" type="number" min="0" value={form.leadTimeDays} onChange={(e) => update("leadTimeDays", e.target.value)} /></div>
          <div><Label htmlFor="bankName">Bank Name</Label><Input id="bankName" value={form.bankName} onChange={(e) => update("bankName", e.target.value)} /></div>
          <div><Label htmlFor="bankAccount">Bank Account</Label><Input id="bankAccount" value={form.bankAccount} onChange={(e) => update("bankAccount", e.target.value)} /></div>
          <div className="md:col-span-2"><Label htmlFor="address">Address</Label><Input id="address" value={form.address} onChange={(e) => update("address", e.target.value)} /></div>
          <div className="md:col-span-2"><Label htmlFor="notes">Notes</Label><Input id="notes" value={form.notes} onChange={(e) => update("notes", e.target.value)} /></div>
        </CardContent></Card>
        <div className="mt-6 flex justify-end gap-2"><Button asChild variant="outline"><Link href="/dashboard/inventory/suppliers">Cancel</Link></Button><Button type="submit" disabled={saving}><Save className="mr-2 h-4 w-4" /> {saving ? "Saving..." : "Save Supplier"}</Button></div>
      </form>
    </div>
  );
}
