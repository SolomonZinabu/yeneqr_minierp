'use client';

// ============================================================
// CustomerProfileDrawer — shows player identity, points, rewards
// ============================================================
// Embedded in the customer menu page (top-right corner).
// Flow:
//   1. Guest scans QR → drawer shows "Get on the Leaderboard" prompt
//   2. Guest enters name (+ optional phone) → calls identify API
//   3. After identification: shows name, loyalty points, unclaimed
//      rewards, best scores per game, with a "Claim at counter" hint
//
// Also exposed as a hook useCustomerProfile() so the menu page can
// pass the player's name to the game arena (replacing hardcoded
// 'Guest') and trigger a refresh after game completion.
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Trophy, Gift, Star, Phone, X, Sparkles, Award, TrendingUp, CheckCircle2 } from 'lucide-react';

interface CustomerProfile {
  identified: boolean;
  hasSession?: boolean;
  name?: string;
  phone?: string;
  customer?: {
    id: string;
    name: string | null;
    phone: string | null;
    loyaltyPoints: number;
    totalSpentCents: number;
    visitCount: number;
  };
  unclaimedRewards: Array<{
    id: string;
    gameType: string;
    period: string;
    position: number;
    rewardType: string;
    rewardValue: any;
    createdAt: string;
    expiresAt: string | null;
  }>;
  bestScores: Array<{
    gameType: string;
    bestScore: number;
    totalPlays: number;
  }>;
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

export function CustomerProfileDrawer({
  restaurantId,
  sessionToken,
  isOpen,
  onOpenChange,
  onIdentified,
}: {
  restaurantId: string;
  sessionToken: string | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onIdentified?: (name: string) => void;
}) {
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [justIdentified, setJustIdentified] = useState(false);

  // Fetch profile when drawer opens
  const fetchProfile = useCallback(async () => {
    if (!restaurantId || !sessionToken) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/restaurants/${restaurantId}/sessions/identify`, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      const data = await res.json();
      setProfile(data.data);
      if (data.data?.name) {
        setName(data.data.name);
        onIdentified?.(data.data.name);
      }
      if (data.data?.phone) {
        setPhone(data.data.phone);
      }
    } catch {
      // ignore — drawer will show identification prompt
    } finally {
      setLoading(false);
    }
  }, [restaurantId, sessionToken, onIdentified]);

  useEffect(() => {
    if (isOpen) fetchProfile();
  }, [isOpen, fetchProfile]);

  const handleIdentify = async () => {
    if (!name.trim()) {
      setError('Please enter your name');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/restaurants/${restaurantId}/sessions/identify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({ name: name.trim(), phone: phone.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to identify');
        return;
      }
      setProfile(data.data);
      setJustIdentified(true);
      onIdentified?.(name.trim());
      setTimeout(() => setJustIdentified(false), 3000);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => onOpenChange(false)}
        >
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
            onClick={e => e.stopPropagation()}
            className="bg-card w-full max-w-md max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl shadow-2xl"
          >
            {/* Header */}
            <div className="sticky top-0 bg-card border-b border-border px-5 py-4 flex items-center justify-between">
              <h3 className="font-bold text-base flex items-center gap-2">
                <User className="w-4 h-4" />
                Your Profile
              </h3>
              <button
                onClick={() => onOpenChange(false)}
                className="p-1.5 rounded-lg hover:bg-accent"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {loading ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  Loading profile...
                </div>
              ) : profile?.identified ? (
                <>
                  {/* Identified — show profile */}
                  {justIdentified && (
                    <motion.div
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 p-3 flex items-center gap-2"
                    >
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                      <p className="text-sm font-medium text-green-700 dark:text-green-400">
                        You're on the leaderboard!
                      </p>
                    </motion.div>
                  )}

                  {/* Identity card */}
                  <div className="rounded-2xl bg-gradient-to-br from-purple-500/10 via-pink-500/10 to-orange-500/10 border border-purple-500/20 p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-lg">
                        {profile.name?.[0]?.toUpperCase() || '?'}
                      </div>
                      <div className="flex-1">
                        <p className="font-bold text-base">{profile.name}</p>
                        {profile.phone && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {profile.phone}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Loyalty points */}
                  {profile.customer && (
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 text-center">
                        <div className="flex items-center justify-center gap-1 text-amber-600 dark:text-amber-400 mb-1">
                          <Star className="w-3.5 h-3.5" />
                          <span className="text-[10px] uppercase font-bold">Loyalty Pts</span>
                        </div>
                        <p className="font-bold text-lg text-amber-700 dark:text-amber-300">
                          {profile.customer.loyaltyPoints}
                        </p>
                      </div>
                      <div className="rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-3 text-center">
                        <div className="flex items-center justify-center gap-1 text-blue-600 dark:text-blue-400 mb-1">
                          <TrendingUp className="w-3.5 h-3.5" />
                          <span className="text-[10px] uppercase font-bold">Visits</span>
                        </div>
                        <p className="font-bold text-lg text-blue-700 dark:text-blue-300">
                          {profile.customer.visitCount}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Unclaimed rewards */}
                  {profile.unclaimedRewards.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-1">
                        <Gift className="w-3.5 h-3.5" />
                        Your Rewards ({profile.unclaimedRewards.length})
                      </h4>
                      {profile.unclaimedRewards.map(reward => (
                        <RewardCard key={reward.id} reward={reward} />
                      ))}
                    </div>
                  )}

                  {/* Best scores */}
                  {profile.bestScores.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-1">
                        <Trophy className="w-3.5 h-3.5" />
                        Your Best Scores
                      </h4>
                      <div className="space-y-1.5">
                        {profile.bestScores.map(score => (
                          <div
                            key={score.gameType}
                            className="flex items-center gap-2 rounded-lg bg-muted/50 p-2"
                          >
                            <span className="text-lg">{GAME_ICONS[score.gameType] || '🎮'}</span>
                            <div className="flex-1">
                              <p className="text-sm font-medium">{GAME_NAMES[score.gameType] || score.gameType}</p>
                              <p className="text-[10px] text-muted-foreground">
                                {score.totalPlays} {score.totalPlays === 1 ? 'play' : 'plays'}
                              </p>
                            </div>
                            <p className="font-bold text-sm">{score.bestScore.toLocaleString()}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <p className="text-[10px] text-muted-foreground text-center pt-2">
                    Show this screen to staff to claim your rewards at the counter.
                  </p>
                </>
              ) : (
                <>
                  {/* Not identified — show identification form */}
                  <div className="text-center py-2">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center mb-3"
                    >
                      <Trophy className="w-8 h-8 text-white" />
                    </motion.div>
                    <h4 className="font-bold text-base mb-1">Get on the Leaderboard!</h4>
                    <p className="text-xs text-muted-foreground mb-4">
                      Enter your name to track your scores, earn loyalty points, and win rewards.
                      Your name appears on the leaderboard so other diners can see who's winning.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">
                        Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="e.g. Abraham T."
                        maxLength={50}
                        className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleIdentify();
                        }}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block flex items-center justify-between">
                        <span>Phone (optional)</span>
                        <span className="text-[10px] text-muted-foreground/70">links visits across days</span>
                      </label>
                      <input
                        type="tel"
                        value={phone}
                        onChange={e => setPhone(e.target.value)}
                        placeholder="e.g. +251911234567"
                        className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleIdentify();
                        }}
                      />
                    </div>

                    {error && (
                      <p className="text-xs text-red-500">{error}</p>
                    )}

                    <button
                      onClick={handleIdentify}
                      disabled={submitting || !name.trim()}
                      className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      {submitting ? (
                        'Saving...'
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          Get on the Leaderboard
                        </>
                      )}
                    </button>
                  </div>

                  <div className="rounded-xl bg-muted/50 p-3 space-y-1.5">
                    <p className="text-[11px] font-medium text-muted-foreground">What you get:</p>
                    <ul className="text-[11px] text-muted-foreground space-y-1">
                      <li className="flex items-start gap-1.5">
                        <span className="text-purple-500">🏆</span>
                        <span>Real name on the daily + weekly leaderboards</span>
                      </li>
                      <li className="flex items-start gap-1.5">
                        <span className="text-amber-500">⭐</span>
                        <span>Loyalty points for top 3 finishes (25-100 pts daily)</span>
                      </li>
                      <li className="flex items-start gap-1.5">
                        <span className="text-pink-500">🎁</span>
                        <span>Free desserts and rewards for weekly champions</span>
                      </li>
                      {phone.trim() && (
                        <li className="flex items-start gap-1.5">
                          <span className="text-blue-500">🔗</span>
                          <span>Visits linked across days — points accumulate forever</span>
                        </li>
                      )}
                    </ul>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function RewardCard({ reward }: { reward: CustomerProfile['unclaimedRewards'][number] }) {
  const isExpired = reward.expiresAt && new Date(reward.expiresAt) < new Date();
  const daysLeft = reward.expiresAt
    ? Math.ceil((new Date(reward.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  let rewardLabel = 'Reward';
  let rewardDetail = '';
  if (reward.rewardType === 'loyalty_points') {
    rewardLabel = `+${reward.rewardValue?.points || 0} Loyalty Points`;
  } else if (reward.rewardType === 'free_item') {
    rewardLabel = reward.rewardValue?.description || 'Free Item';
    rewardDetail = reward.rewardValue?.badge || '';
  } else if (reward.rewardType === 'discount_coupon') {
    rewardLabel = `${reward.rewardValue?.discountCents ? `${reward.rewardValue.discountCents / 100} ETB off` : 'Discount'}`;
  } else if (reward.rewardType === 'badge') {
    rewardLabel = reward.rewardValue?.badge || 'Badge Earned';
  }

  return (
    <div className={`rounded-xl border-2 p-3 ${
      isExpired
        ? 'border-muted bg-muted/30 opacity-60'
        : 'border-amber-300 bg-amber-50 dark:bg-amber-950/30'
    }`}>
      <div className="flex items-start gap-2">
        <div className="text-2xl">
          {reward.position === 1 ? '🥇' : reward.position === 2 ? '🥈' : reward.position === 3 ? '🥉' : '🎁'}
        </div>
        <div className="flex-1">
          <p className="font-bold text-sm text-amber-700 dark:text-amber-400">
            {rewardLabel}
          </p>
          <p className="text-[10px] text-muted-foreground">
            {GAME_NAMES[reward.gameType] || reward.gameType} • {reward.period} #{reward.position}
          </p>
          {rewardDetail && (
            <p className="text-[10px] text-amber-600 dark:text-amber-500 mt-0.5">{rewardDetail}</p>
          )}
          {daysLeft !== null && !isExpired && (
            <p className="text-[10px] text-orange-600 dark:text-orange-500 mt-0.5">
              ⏰ Claim within {daysLeft} day{daysLeft === 1 ? '' : 's'}
            </p>
          )}
          {isExpired && (
            <p className="text-[10px] text-red-500 mt-0.5">Expired</p>
          )}
        </div>
      </div>
    </div>
  );
}
