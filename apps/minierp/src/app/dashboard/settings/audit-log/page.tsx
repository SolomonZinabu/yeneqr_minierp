"use client";
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { History } from "lucide-react";

interface AuditLog { id: string; action: string; entityType: string; entityId: string | null; ipAddress: string | null; createdAt: string; userId: string | null }
const fmtDate = (s: string) => new Date(s).toLocaleString("en-ET", { dateStyle: "short", timeStyle: "short" });

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  useEffect(() => { fetch("/api/audit-logs?limit=200").then(r => r.json()).then(d => setLogs(d.logs ?? [])).catch(() => setLogs([])).finally(() => setLoading(false)); }, []);
  const filtered = logs.filter(l => !filter || l.action.toLowerCase().includes(filter.toLowerCase()) || l.entityType.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold tracking-tight">Audit Log</h1><p className="text-sm text-muted-foreground">Append-only history of every change to tenant data</p></div>
      <Card><CardContent className="p-4"><Input placeholder="Filter by action or entity type..." value={filter} onChange={(e) => setFilter(e.target.value)} className="max-w-sm" /></CardContent></Card>
      <Card><CardContent className="p-0">{loading ? <p className="py-8 text-center text-sm text-muted-foreground">Loading...</p> : filtered.length === 0 ? (
        <div className="py-12 text-center"><History className="mx-auto h-10 w-10 text-muted-foreground" /><p className="mt-3 text-sm font-medium">No audit logs yet</p></div>
      ) : (
        <Table><TableHeader><TableRow><TableHead>Timestamp</TableHead><TableHead>Action</TableHead><TableHead>Entity</TableHead><TableHead>Entity ID</TableHead><TableHead>User</TableHead><TableHead>IP</TableHead></TableRow></TableHeader>
          <TableBody>{filtered.map(l => (<TableRow key={l.id}><TableCell className="text-xs">{fmtDate(l.createdAt)}</TableCell><TableCell><Badge variant="outline" className="text-xs font-mono">{l.action}</Badge></TableCell><TableCell className="text-xs">{l.entityType}</TableCell><TableCell className="font-mono text-xs">{l.entityId?.slice(-8) ?? "—"}</TableCell><TableCell className="font-mono text-xs">{l.userId?.slice(-8) ?? "system"}</TableCell><TableCell className="text-xs">{l.ipAddress ?? "—"}</TableCell></TableRow>))}</TableBody>
        </Table>
      )}</CardContent></Card>
    </div>
  );
}
