'use client';

// ============================================================
// Rewards Redemption Dashboard (staff)
// ============================================================
// Shows pending game rewards (loyalty points, free items, discounts)
// earned by customers via the YeneQR Arena. Staff can:
//   - View unclaimed rewards
//   - Search by customer name or phone
//   - Filter by game type / period
//   - Mark a reward as claimed (with optional note)
//   - View claimed history
//
// Access: any staff with payment:view (managers, cashiers, owners)
// Claim: any staff with payment:manage (managers, owners)
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Gift, Phone, Search, CheckCircle2, Clock, X, Filter, RefreshCw } from 'lucide-react';

interface Reward {
  id: string;
  gameType: string;
  period: string;
  position: number;
  rewardType: string; // loyalty_points, free_item, discount_coupon, badge
  rewardValue: any;
  customerName: string | null;
  customerPhone: string | null;
  customerId: string | null;
  isClaimed: boolean;
  claimedAt: string | null;
  claimedBy: string | null;
  claimNote: string | null;
  createdAt: string;
  expiresAt: string | null;
  isExpired: boolean;
}

const GAME_NAMES: Record<string, string> = {
  wot_crush: 'Wot Crush',
  trivia_royale: 'Trivia Royale',
  speed_order: 'Speed Order',
  emoji_guess: 'Emoji Guess',
};

const GAME_ICONS: Record<string, string> = {
  wot_crush: '🫓',
  trivia_royale: '🧠',
  speed_order: '⚡',
  emoji_guess: '🎯',
};

export function RewardsRedemptionDashboard({ restaurantId }: { restaurantId: string }) {
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'unclaimed' | 'claimed' | 'all'>('unclaimed');
  const [gameFilter, setGameFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [claimNote, setClaimNote] = useState('');
  const [showClaimModal, setShowClaimModal] = useState(false);

  const fetchRewards = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ status: statusFilter });
      if (gameFilter !== 'all') params.set('gameType', gameFilter);
      const res = await fetch(`/api/restaurants/${restaurantId}/rewards?${params}`, {
        credentials: 'include',
      });
      const data = await res.json();
      setRewards(data.data || []);
    } catch {
      setRewards([]);
    } finally {
      setLoading(false);
    }
  }, [restaurantId, statusFilter, gameFilter]);

  useEffect(() => {
    fetchRewards();
  }, [fetchRewards]);

  const handleClaimClick = (rewardId: string) => {
    setClaimingId(rewardId);
    setClaimNote('');
    setShowClaimModal(true);
  };

  const handleClaimConfirm = async () => {
    if (!claimingId) return;
    try {
      const res = await fetch(`/api/restaurants/${restaurantId}/rewards/${claimingId}/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ note: claimNote || undefined }),
      });
      if (res.ok) {
        setShowClaimModal(false);
        setClaimingId(null);
        setClaimNote('');
        fetchRewards(); // Refresh list
      }
    } catch {
      // ignore
    }
  };

  // Filter by search
  const filteredRewards = rewards.filter(r => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      r.customerName?.toLowerCase().includes(q) ||
      r.customerPhone?.toLowerCase().includes(q) ||
      GAME_NAMES[r.gameType]?.toLowerCase().includes(q)
    );
  });

  const unclaimedCount = rewards.filter(r => !r.isClaimed).length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Gift className="w-5 h-5 text-amber-500" />
            Game Rewards
          </h2>
          <p className="text-sm text-muted-foreground">
            Redeem rewards earned by customers in YeneQR Arena
          </p>
        </div>
        <button
          onClick={fetchRewards}
          className="p-2 rounded-lg hover:bg-accent"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3">
          <p className="text-[10px] uppercase font-bold text-amber-600 dark:text-amber-400">Unclaimed</p>
          <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">{unclaimedCount}</p>
        </div>
        <div className="rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 p-3">
          <p className="text-[10px] uppercase font-bold text-green-600 dark:text-green-400">Claimed</p>
          <p className="text-2xl font-bold text-green-700 dark:text-green-300">
            {rewards.filter(r => r.isClaimed).length}
          </p>
        </div>
        <div className="rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 p-3">
          <p className="text-[10px] uppercase font-bold text-red-600 dark:text-red-400">Expired</p>
          <p className="text-2xl font-bold text-red-700 dark:text-red-300">
            {rewards.filter(r => r.isExpired && !r.isClaimed).length}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex gap-1 bg-muted rounded-lg p-1">
          {(['unclaimed', 'claimed', 'all'] as const).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                statusFilter === s
                  ? 'bg-background shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {s === 'unclaimed' ? 'Pending' : s === 'claimed' ? 'Redeemed' : 'All'}
            </button>
          ))}
        </div>
        <select
          value={gameFilter}
          onChange={e => setGameFilter(e.target.value)}
          className="text-xs rounded-lg border bg-background px-2 py-1.5"
        >
          <option value="all">All Games</option>
          <option value="wot_crush">🫓 Wot Crush</option>
          <option value="trivia_royale">🧠 Trivia Royale</option>
          <option value="speed_order">⚡ Speed Order</option>
          <option value="emoji_guess">🎯 Emoji Guess</option>
        </select>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by customer name, phone, or game..."
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border bg-background"
          />
        </div>
      </div>

      {/* Rewards list */}
      {loading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">Loading rewards...</div>
      ) : filteredRewards.length === 0 ? (
        <div className="py-12 text-center">
          <Trophy className="w-10 h-10 mx-auto text-muted-foreground/40 mb-2" />
          <p className="text-sm text-muted-foreground">No rewards found</p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            {statusFilter === 'unclaimed'
              ? 'When customers earn rewards in the Arena, they\'ll appear here for redemption.'
              : 'Try changing your filters.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filteredRewards.map(reward => (
            <RewardCard
              key={reward.id}
              reward={reward}
              onClaim={() => handleClaimClick(reward.id)}
            />
          ))}
        </div>
      )}

      {/* Claim Modal */}
      <AnimatePresence>
        {showClaimModal && claimingId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setShowClaimModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-card rounded-2xl shadow-2xl max-w-sm w-full p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-base">Redeem Reward</h3>
                <button onClick={() => setShowClaimModal(false)} className="p-1 rounded hover:bg-accent">
                  <X className="w-4 h-4" />
                </button>
              </div>
              {(() => {
                const r = rewards.find(rw => rw.id === claimingId);
                if (!r) return null;
                return (
                  <>
                    <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 mb-3">
                      <p className="font-bold text-sm text-amber-700 dark:text-amber-400">
                        {r.position === 1 ? '🥇' : r.position === 2 ? '🥈' : r.position === 3 ? '🥉' : '🎁'}{' '}
                        {r.rewardType === 'loyalty_points'
                          ? `${r.rewardValue.points} loyalty points`
                          : r.rewardType === 'free_item'
                            ? r.rewardValue.description || 'Free item'
                            : r.rewardType === 'discount_coupon'
                              ? 'Discount coupon'
                              : r.rewardValue.badge || 'Badge'}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {r.customerName || 'Anonymous guest'}
                        {r.customerPhone && ` • ${r.customerPhone}`}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {GAME_NAMES[r.gameType] || r.gameType} • {r.period} #{r.position}
                      </p>
                    </div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">
                      Note (optional)
                    </label>
                    <input
                      type="text"
                      value={claimNote}
                      onChange={e => setClaimNote(e.target.value)}
                      placeholder="e.g., Served chocolate cake"
                      maxLength={200}
                      className="w-full px-3 py-2 rounded-lg border bg-background text-sm mb-4"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowClaimModal(false)}
                        className="flex-1 border py-2.5 rounded-lg text-sm font-medium"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleClaimConfirm}
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-1.5"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Mark Redeemed
                      </button>
                    </div>
                  </>
                );
              })()}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function RewardCard({ reward, onClaim }: { reward: Reward; onClaim: () => void }) {
  const isExpired = reward.isExpired && !reward.isClaimed;
  const daysLeft = reward.expiresAt
    ? Math.ceil((new Date(reward.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  let rewardLabel = 'Reward';
  let rewardIcon = '🎁';
  if (reward.rewardType === 'loyalty_points') {
    rewardLabel = `+${reward.rewardValue?.points || 0} Loyalty Points`;
    rewardIcon = '⭐';
  } else if (reward.rewardType === 'free_item') {
    rewardLabel = reward.rewardValue?.description || 'Free Item';
    rewardIcon = '🍰';
  } else if (reward.rewardType === 'discount_coupon') {
    rewardLabel = reward.rewardValue?.discountCents
      ? `${reward.rewardValue.discountCents / 100} ETB Off`
      : 'Discount';
    rewardIcon = '💳';
  } else if (reward.rewardType === 'badge') {
    rewardLabel = reward.rewardValue?.badge || 'Badge Earned';
    rewardIcon = '🏅';
  }

  return (
    <div
      className={`rounded-xl border-2 p-4 transition-all ${
        reward.isClaimed
          ? 'border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20'
          : isExpired
            ? 'border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20'
            : 'border-amber-300 bg-amber-50 dark:bg-amber-950/30 hover:shadow-md'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="text-3xl">{rewardIcon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm">
                {rewardLabel}
                {reward.rewardValue?.badge && (
                  <span className="ml-1.5 text-xs text-amber-600 dark:text-amber-400">
                    {reward.rewardValue.badge}
                  </span>
                )}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {reward.customerName || 'Anonymous guest'}
                {reward.customerPhone && (
                  <span className="ml-1.5 inline-flex items-center gap-0.5">
                    • <Phone className="w-2.5 h-2.5" /> {reward.customerPhone}
                  </span>
                )}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {GAME_ICONS[reward.gameType] || '🎮'} {GAME_NAMES[reward.gameType] || reward.gameType} • {reward.period} champion #{reward.position}
              </p>
            </div>
            <div className="text-right shrink-0">
              <div className="text-lg">
                {reward.position === 1 ? '🥇' : reward.position === 2 ? '🥈' : reward.position === 3 ? '🥉' : '🏆'}
              </div>
            </div>
          </div>

          {/* Status / Action */}
          <div className="mt-3 flex items-center justify-between gap-2">
            {reward.isClaimed ? (
              <div className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Redeemed {reward.claimedAt && new Date(reward.claimedAt).toLocaleDateString()}
                {reward.claimNote && ` • ${reward.claimNote}`}
              </div>
            ) : isExpired ? (
              <div className="text-xs text-red-500 font-medium">Expired — no longer claimable</div>
            ) : daysLeft !== null ? (
              <div className="text-xs text-orange-600 dark:text-orange-500 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                Expires in {daysLeft} day{daysLeft === 1 ? '' : 's'}
              </div>
            ) : (
              <div />
            )}

            {!reward.isClaimed && !isExpired && (
              <button
                onClick={onClaim}
                className="bg-green-600 hover:bg-green-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Redeem
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
