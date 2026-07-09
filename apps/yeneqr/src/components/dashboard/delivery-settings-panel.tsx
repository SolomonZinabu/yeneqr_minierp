'use client';
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Loader2, Truck, MapPin } from 'lucide-react';
import { api } from '@/lib/api-client';
import { toast } from 'sonner';

interface Zone { id: string; name: string; deliveryFeeCents: number; estimatedMinutes: number; isActive: boolean; }

export function DeliverySettingsPanel({ restaurantId }: { restaurantId: string }) {
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState(''); const [fee, setFee] = useState(''); const [eta, setEta] = useState('');

  const fetch = useCallback(async () => {
    try { const res = await api.get<{ data: Zone[] }>(`/api/restaurants/${restaurantId}/delivery/zones`); setZones(res.data || []); }
    catch { setZones([]); } finally { setLoading(false); }
  }, [restaurantId]);

  useEffect(() => { fetch(); }, [fetch]);

  const handleAdd = async () => {
    if (!name || !fee || !eta) return;
    try {
      await api.post(`/api/restaurants/${restaurantId}/delivery/zones`, {
        name, deliveryFeeCents: Math.round(parseFloat(fee) * 100), estimatedMinutes: parseInt(eta),
      });
      toast.success('Delivery zone added'); setShowAdd(false); setName(''); setFee(''); setEta('');
      fetch();
    } catch { toast.error('Failed to add zone'); }
  };

  if (loading) return <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold flex items-center gap-2"><Truck className="h-4 w-4" />Delivery Zones</h3>
          <p className="text-xs text-muted-foreground">Set delivery fees and estimated times per area</p>
        </div>
        <Button size="sm" onClick={() => setShowAdd(!showAdd)}><Plus className="h-4 w-4 mr-1" />Add Zone</Button>
      </div>

      {showAdd && (
        <Card><CardContent className="pt-4 space-y-3">
          <div><Label>Zone Name</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="Bole" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Delivery Fee (ETB)</Label><Input type="number" step="0.01" value={fee} onChange={e => setFee(e.target.value)} placeholder="5.00" /></div>
            <div><Label>Est. Minutes</Label><Input type="number" value={eta} onChange={e => setEta(e.target.value)} placeholder="30" /></div>
          </div>
          <Button size="sm" onClick={handleAdd}>Save Zone</Button>
        </CardContent></Card>
      )}

      {zones.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center justify-center py-8">
          <MapPin className="h-10 w-10 text-muted-foreground/30 mb-2" />
          <p className="text-sm text-muted-foreground">No delivery zones configured</p>
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {zones.map(zone => (
            <Card key={zone.id}><CardContent className="py-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium">{zone.name}</span>
                {zone.isActive ? <Badge className="bg-emerald-500 text-white text-[9px]">Active</Badge> : <Badge variant="secondary" className="text-[9px]">Inactive</Badge>}
              </div>
              <div className="flex gap-4 text-xs text-muted-foreground">
                <span>Fee: ETB {(zone.deliveryFeeCents / 100).toFixed(2)}</span>
                <span>ETA: {zone.estimatedMinutes} min</span>
              </div>
            </CardContent></Card>
          ))}
        </div>
      )}
    </div>
  );
}
