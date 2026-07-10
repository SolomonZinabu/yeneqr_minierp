"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ChefHat, Crown, Calculator, Briefcase, ChefHat as ChefIcon, UtensilsCrossed, User } from "lucide-react";
import { toast } from "sonner";
import type { LucideIcon } from "lucide-react";

interface DemoAccount { email: string; password: string; role: string; name: string; icon: LucideIcon; description: string }

const DEMO_ACCOUNTS: DemoAccount[] = [
  { email: "owner@demo.et",      password: "demo1234", role: "owner",      name: "Hana Tesfaye",   icon: Crown,           description: "Full access — everything" },
  { email: "accountant@demo.et", password: "demo1234", role: "accountant", name: "Dawit Haile",    icon: Calculator,      description: "Finance, payroll, GL posting" },
  { email: "manager@demo.et",    password: "demo1234", role: "manager",    name: "Sara Bekele",    icon: Briefcase,       description: "Inventory, POs, HR (no payroll)" },
  { email: "chef@demo.et",       password: "demo1234", role: "chef",       name: "Tigist Bekele",  icon: ChefIcon,        description: "Kitchen — wastage + transfers" },
  { email: "waiter@demo.et",     password: "demo1234", role: "waiter",     name: "Mulu Girma",     icon: UtensilsCrossed, description: "Service — read inventory + attendance" },
  { email: "staff@demo.et",      password: "demo1234", role: "staff",      name: "Abebe Kebede",   icon: User,            description: "Minimal — read inventory + own attendance" },
];

export default function LoginPage() {
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get("next") ?? "/dashboard";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedDemo, setSelectedDemo] = useState<string | null>(null);

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    const signInEmail = email, signInPassword = password;
    if (!signInEmail || !signInPassword) return;
    setLoading(true);
    try {
      const { error } = await authClient.signIn.email({ email: signInEmail, password: signInPassword });
      if (error) { toast.error(error.message ?? "Sign-in failed"); return; }
      toast.success("Welcome back");
      router.push(next); router.refresh();
    } catch (err) { console.error("[LOGIN_ERROR]", err); toast.error("Something went wrong"); }
    finally { setLoading(false); }
  }

  function pickDemo(account: DemoAccount) {
    setEmail(account.email); setPassword(account.password); setSelectedDemo(account.email);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 px-4 py-8">
      <div className="w-full max-w-5xl grid gap-6 lg:grid-cols-2 items-start">
        <Card className="w-full max-w-md mx-auto shadow-lg">
          <CardHeader className="space-y-2 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10"><ChefHat className="h-6 w-6 text-primary" /></div>
            <CardTitle className="text-2xl">Mini ERP</CardTitle>
            <CardDescription>Sign in to your restaurant back-office</CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" placeholder="owner@restaurant.com" value={email} onChange={(e) => { setEmail(e.target.value); setSelectedDemo(null); }} required disabled={loading} autoComplete="email" autoFocus />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" value={password} onChange={(e) => { setPassword(e.target.value); setSelectedDemo(null); }} required disabled={loading} autoComplete="current-password" />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-3">
              <Button type="submit" className="w-full" disabled={loading || !email || !password}>
                {loading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Signing in…</>) : ("Sign in")}
              </Button>
              <p className="text-xs text-muted-foreground text-center">Don&apos;t have an account? Ask your restaurant owner to invite you, or enable ERP from your YeneQR dashboard.</p>
            </CardFooter>
          </form>
        </Card>

        <Card className="w-full shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg">Demo Accounts</CardTitle>
            <CardDescription>Click an account to auto-fill the form, then click <strong>Sign in</strong>. All demo passwords are <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">demo1234</code>.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {DEMO_ACCOUNTS.map((account) => {
              const isSelected = selectedDemo === account.email;
              return (
                <button key={account.email} type="button" onClick={() => pickDemo(account)} disabled={loading}
                  className={`w-full text-left rounded-lg border p-3 transition-all ${isSelected ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"} disabled:opacity-50`}>
                  <div className="flex items-start gap-3">
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${isSelected ? "bg-primary text-primary-foreground" : "bg-slate-100 text-slate-600"}`}>
                      <account.icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium truncate">{account.name}</p>
                        <Badge variant={isSelected ? "default" : "outline"} className="text-xs capitalize">{account.role}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{account.email}</p>
                      <p className="text-xs text-muted-foreground mt-1">{account.description}</p>
                    </div>
                  </div>
                </button>
              );
            })}
            <div className="mt-4 rounded-md bg-blue-50 border border-blue-200 p-3 text-xs text-blue-700">
              <p className="font-medium">💡 Testing RBAC</p>
              <p className="mt-1">Each role has different permissions. Try signing in as <strong>chef</strong> and notice that Finance &amp; HR nav items are hidden, and the &quot;Approve PO&quot; button returns 403. The <strong>owner</strong> sees everything.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
