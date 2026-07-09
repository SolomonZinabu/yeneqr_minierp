'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useAppStore } from '@/lib/store';
import { api } from '@/lib/api-client';
import { useBranchChange } from '@/hooks/use-branch-change';
import { Users, Clock, Phone, Plus, Check, X, Loader2, UserCheck } from 'lucide-react';
import { toast } from 'sonner';

interface WaitlistEntry {
  id: string; customerName: string; customerPhone?: string | null;
  partySize: number; status: string; quotedWaitMinutes?: number | null;
  position?: number | null; estimatedWaitMinutes?: number | null;
  notes?: string | null; createdAt: string;
}

export function WaitlistView() {
  const { user, selectedBranchId, branchChangeVersion } = useAppStore();
  const restaurantId = user?.restaurantId || '';
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newParty, setNewParty] = useState('2');
  const [adding, setAdding] = useState(false);
  const fetchRef = useRef<(() => Promise<void>) | undefined>(undefined);

  const handleBranchChange = useCallback(() => { setLoading(true); fetchRef.current?.(); }, []);
  useBranchChange(handleBranchChange);

  const fetchEntries = useCallback(async () => {
    if (!restaurantId) return;
    try {
      const branchId = useAppStore.getState().selectedBranchId;
      const params: Record<string, string> = { status: 'all' };
      if (branchId) params.branchId = branchId;
      const res = await api.get<{ data: WaitlistEntry[]; waitingCount: number }>(`/api/restaurants/${restaurantId}/waitlist`, params);
      setEntries(res.data || []);
    } catch { setEntries([]); }
    finally { setLoading(false); }
  }, [restaurantId]);

  useEffect(() => { fetchRef.current = fetchEntries; }, [fetchEntries]);
  useEffect(() => { fetchEntries(); }, [fetchEntries, selectedBranchId, branchChangeVersion]);

  const handleAdd = async () => {
    if (!newName || !newParty) return;
    setAdding(true);
    try {
      const branchId = useAppStore.getState().selectedBranchId;
      await api.post(`/api/restaurants/${restaurantId}/waitlist`, {
        customerName: newName, customerPhone: newPhone, partySize: parseInt(newParty), branchId,
      });
      toast.success(`${newName} added to waitlist`);
      setNewName(''); setNewPhone(''); setNewParty('2'); setShowAdd(false);
      fetchEntries();
    } catch { toast.error('Failed to add'); }
    finally { setAdding(false); }
  };

  const handleSeat = async (id: string) => {
    try {
      await api.patch(`/api/restaurants/${restaurantId}/waitlist`, { entryId: id, status: 'seated' });
      toast.success('Marked as seated');
      fetchEntries();
    } catch { toast.error('Failed to update'); }
  };

  const handleCancel = async (id: string) => {
    try {
      await api.patch(`/api/restaurants/${restaurantId}/waitlist`, { entryId: id, status: 'cancelled' });
      fetchEntries();
    } catch { toast.error('Failed to update'); }
  };

  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  const waiting = entries.filter(e => e.status === 'waiting');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Waitlist</h2>
          <p className="text-sm text-muted-foreground">{waiting.length} party{waiting.length !== 1 ? 'ies' : ''} waiting</p>
        </div>
        <Button size="sm" onClick={() => setShowAdd(true)}><Plus className="h-4 w-4 mr-1" />Add Party</Button>
      </div>

      {waiting.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center justify-center py-12">
          <Users className="h-12 w-12 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">No parties waiting</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {waiting.map((entry, i) => (
            <Card key={entry.id} className="hover:shadow-md transition-shadow">
              <CardContent className="py-3 flex items-center gap-3">
                <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary/10 text-primary font-bold text-lg shrink-0">
                  {entry.position || i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate">{entry.customerName}</p>
                    <Badge variant="secondary" className="text-[10px]">{entry.partySize} guests</Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                    {entry.customerPhone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{entry.customerPhone}</span>}
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" />~{entry.estimatedWaitMinutes || entry.quotedWaitMinutes || 0} min wait</span>
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="sm" variant="default" className="h-8 gap-1" onClick={() => handleSeat(entry.id)}>
                    <Check className="h-3.5 w-3.5" />Seat
                  </Button>
                  <Button size="sm" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleCancel(entry.id)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Seated history */}
      {entries.filter(e => e.status === 'seated').length > 0 && (
        <div className="pt-4">
          <p className="text-xs text-muted-foreground mb-2">Recently Seated</p>
          <div className="space-y-1">
            {entries.filter(e => e.status === 'seated').slice(0, 5).map(entry => (
              <div key={entry.id} className="flex items-center gap-2 text-xs text-muted-foreground py-1">
                <UserCheck className="h-3 w-3 text-emerald-500" />
                <span>{entry.customerName}</span>
                <span>· {entry.partySize} guests</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Add Party to Waitlist</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Customer Name *</Label><Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Abebe Kebede" /></div>
            <div><Label>Phone (optional)</Label><Input value={newPhone} onChange={e => setNewPhone(e.target.value)} placeholder="0912345678" /></div>
            <div><Label>Party Size *</Label><Input type="number" min="1" value={newParty} onChange={e => setNewParty(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={adding || !newName}>{adding ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}Add to Waitlist</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
