'use client';
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Plus, Trash2, Loader2, Plug, ExternalLink } from 'lucide-react';
import { api } from '@/lib/api-client';
import { toast } from 'sonner';

interface Integration { id: string; name: string; type: string; webhookUrl: string | null; apiKey: string | null; isActive: boolean; syncOrders: boolean; syncPayments: boolean; syncMenu: boolean; lastSyncAt: string | null; }

export function POSIntegrationsPanel({ restaurantId }: { restaurantId: string }) {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState(''); const [type, setType] = useState('webhook');
  const [webhookUrl, setWebhookUrl] = useState(''); const [apiKey, setApiKey] = useState('');

  const fetch = useCallback(async () => {
    try { const res = await api.get<{ data: Integration[] }>(`/api/restaurants/${restaurantId}/integrations`); setIntegrations(res.data || []); }
    catch { setIntegrations([]); } finally { setLoading(false); }
  }, [restaurantId]);

  useEffect(() => { fetch(); }, [fetch]);

  const handleAdd = async () => {
    if (!name) return;
    try {
      await api.post(`/api/restaurants/${restaurantId}/integrations`, { name, type, webhookUrl, apiKey, syncOrders: true, syncPayments: true });
      toast.success('Integration added'); setShowAdd(false); setName(''); setWebhookUrl(''); setApiKey('');
      fetch();
    } catch { toast.error('Failed to add'); }
  };

  const handleToggle = async (id: string, field: string, value: boolean) => {
    // Optimistic update
    setIntegrations(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i));
    try {
      await api.patch(`/api/restaurants/${restaurantId}/integrations/${id}`, { [field]: value });
      toast.success('Sync setting updated');
    } catch {
      // Revert on failure
      setIntegrations(prev => prev.map(i => i.id === id ? { ...i, [field]: !value } : i));
      toast.error('Failed to update setting');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/api/restaurants/${restaurantId}/integrations/${id}`);
      setIntegrations(prev => prev.filter(i => i.id !== id));
      toast.success('Integration removed');
    } catch { toast.error('Failed to remove integration'); }
  };

  if (loading) return <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold flex items-center gap-2"><Plug className="h-4 w-4" />POS Integrations</h3>
          <p className="text-xs text-muted-foreground">Send order & payment events to external systems via webhook</p>
        </div>
        <Button size="sm" onClick={() => setShowAdd(!showAdd)}><Plus className="h-4 w-4 mr-1" />Add</Button>
      </div>

      {showAdd && (
        <Card><CardContent className="pt-4 space-y-3">
          <div><Label>Name</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="QuickBooks Sync" /></div>
          <div><Label>Webhook URL</Label><Input value={webhookUrl} onChange={e => setWebhookUrl(e.target.value)} placeholder="https://your-server.com/webhook" /></div>
          <div><Label>API Key (optional)</Label><Input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="For authentication" /></div>
          <Button size="sm" onClick={handleAdd}>Save Integration</Button>
        </CardContent></Card>
      )}

      {integrations.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center justify-center py-8">
          <Plug className="h-10 w-10 text-muted-foreground/30 mb-2" />
          <p className="text-sm text-muted-foreground">No integrations configured</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {integrations.map(integ => (
            <Card key={integ.id}><CardContent className="py-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{integ.name}</span>
                  <Badge variant="outline" className="text-[9px]">{integ.type}</Badge>
                  {integ.isActive ? <Badge className="bg-emerald-500 text-white text-[9px]">Active</Badge> : <Badge variant="secondary" className="text-[9px]">Inactive</Badge>}
                </div>
                <div className="flex items-center gap-2">
                  {integ.lastSyncAt && <span className="text-[10px] text-muted-foreground">Last sync: {new Date(integ.lastSyncAt).toLocaleString()}</span>}
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(integ.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              {integ.webhookUrl && <p className="text-xs text-muted-foreground truncate mb-2">{integ.webhookUrl}</p>}
              <div className="flex gap-4">
                <label className="flex items-center gap-1.5 text-xs"><Switch checked={integ.syncOrders} onCheckedChange={v => handleToggle(integ.id, 'syncOrders', v)} />Orders</label>
                <label className="flex items-center gap-1.5 text-xs"><Switch checked={integ.syncPayments} onCheckedChange={v => handleToggle(integ.id, 'syncPayments', v)} />Payments</label>
                <label className="flex items-center gap-1.5 text-xs"><Switch checked={integ.syncMenu} onCheckedChange={v => handleToggle(integ.id, 'syncMenu', v)} />Menu</label>
              </div>
            </CardContent></Card>
          ))}
        </div>
      )}
    </div>
  );
}
