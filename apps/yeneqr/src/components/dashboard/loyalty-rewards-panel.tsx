'use client';
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Star, Gift, Loader2, Trash2 } from 'lucide-react';
import { api } from '@/lib/api-client';
import { toast } from 'sonner';

interface Reward { id: string; name: string; description: string | null; type: string; pointsCost: number; menuItemId: string | null; discountCents: number | null; isActive: boolean; }
interface MenuItem { id: string; name: string; priceCents: number; }

export function LoyaltyRewardsPanel({ restaurantId }: { restaurantId: string }) {
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState(''); const [type, setType] = useState('discount');
  const [points, setPoints] = useState(''); const [discount, setDiscount] = useState('');
  const [menuItemId, setMenuItemId] = useState('');

  const fetch = useCallback(async () => {
    try { const res = await api.get<{ data: Reward[] }>(`/api/restaurants/${restaurantId}/loyalty/rewards`); setRewards(res.data || []); }
    catch { setRewards([]); } finally { setLoading(false); }
  }, [restaurantId]);

  const fetchMenuItems = useCallback(async () => {
    try {
      const res = await api.get<{ data: MenuItem[] }>(`/api/restaurants/${restaurantId}/menus`);
      const menus = res.data || [];
      // Fetch items from the first menu (or all menus)
      if (menus.length > 0) {
        const itemsRes = await api.get<{ data: MenuItem[] }>(`/api/restaurants/${restaurantId}/menus/${menus[0].id}/items`);
        setMenuItems(itemsRes.data || []);
      }
    } catch { setMenuItems([]); }
  }, [restaurantId]);

  useEffect(() => { fetch(); }, [fetch]);
  useEffect(() => { if (showAdd) fetchMenuItems(); }, [showAdd, fetchMenuItems]);

  const handleAdd = async () => {
    if (!name || !points) return;
    if (type === 'free_item' && !menuItemId) {
      toast.error('Please select a menu item for free item rewards');
      return;
    }
    try {
      await api.post(`/api/restaurants/${restaurantId}/loyalty/rewards`, {
        name, type, pointsCost: parseInt(points),
        ...(type === 'discount' ? { discountCents: Math.round(parseFloat(discount) * 100) } : {}),
        ...(type === 'free_item' ? { menuItemId } : {}),
      });
      toast.success('Reward added'); setShowAdd(false); setName(''); setPoints(''); setDiscount(''); setMenuItemId('');
      fetch();
    } catch { toast.error('Failed to add reward'); }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/api/restaurants/${restaurantId}/loyalty/rewards/${id}`);
      toast.success('Reward deleted');
      fetch();
    } catch { toast.error('Failed to delete reward'); }
  };

  if (loading) return <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold flex items-center gap-2"><Gift className="h-4 w-4" />Loyalty Rewards Catalog</h3>
          <p className="text-xs text-muted-foreground">Rewards customers can redeem with loyalty points</p>
        </div>
        <Button size="sm" onClick={() => setShowAdd(!showAdd)}><Plus className="h-4 w-4 mr-1" />Add Reward</Button>
      </div>

      {showAdd && (
        <Card><CardContent className="pt-4 space-y-3">
          <div><Label>Reward Name</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="Free Doro Wot" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="discount">Discount (ETB off)</SelectItem>
                  <SelectItem value="free_item">Free Item</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Points Cost</Label><Input type="number" value={points} onChange={e => setPoints(e.target.value)} placeholder="500" /></div>
          </div>
          {type === 'discount' && <div><Label>Discount Amount (ETB)</Label><Input type="number" step="0.01" value={discount} onChange={e => setDiscount(e.target.value)} placeholder="50.00" /></div>}
          {type === 'free_item' && (
            <div>
              <Label>Menu Item</Label>
              {menuItems.length === 0 ? (
                <p className="text-xs text-muted-foreground mt-1">No menu items found. Create menu items first.</p>
              ) : (
                <Select value={menuItemId} onValueChange={setMenuItemId}>
                  <SelectTrigger><SelectValue placeholder="Select a menu item..." /></SelectTrigger>
                  <SelectContent>
                    {menuItems.map(item => (
                      <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}
          <Button size="sm" onClick={handleAdd} disabled={type === 'free_item' && !menuItemId}>Save Reward</Button>
        </CardContent></Card>
      )}

      {rewards.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center justify-center py-8">
          <Gift className="h-10 w-10 text-muted-foreground/30 mb-2" />
          <p className="text-sm text-muted-foreground">No rewards configured</p>
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {rewards.map(reward => (
            <Card key={reward.id}><CardContent className="py-3">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <Gift className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">{reward.name}</span>
                </div>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(reward.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-[10px]">
                  {reward.type === 'discount' ? 'Discount' : 'Free Item'}
                </Badge>
                <Badge variant="secondary" className="text-[10px] gap-1">
                  <Star className="h-2.5 w-2.5" /> {reward.pointsCost} pts
                </Badge>
                {reward.type === 'discount' && reward.discountCents && (
                  <span className="text-xs text-muted-foreground">
                    {reward.discountCents / 100} ETB off
                  </span>
                )}
                {reward.type === 'free_item' && (
                  <span className="text-xs text-muted-foreground">Free menu item</span>
                )}
              </div>
            </CardContent></Card>
          ))}
        </div>
      )}
    </div>
  );
}
