'use client';

// ============================================================
// Yene QR — CRM Dashboard View (Phase 4.3)
// ============================================================
// Customer profiles, segmentation (new/regular/VIP/at-risk),
// lifetime value, visit frequency, loyalty points.
// ============================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useAppStore } from '@/lib/store';
import { api, getTimeAgo } from '@/lib/api-client';
import { useBranchChange } from '@/hooks/use-branch-change';
import { Search, Users, Crown, TrendingUp, AlertCircle, UserPlus, Phone, Mail, Star, Loader2 } from 'lucide-react';

interface CustomerData {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  loyaltyPoints: number;
  totalSpentCents: number;
  visitCount: number;
  lastVisitAt: string | null;
  createdAt: string;
  segment: string;
}

interface CRMSummary {
  totalCustomers: number;
  avgLTVCents: number;
  totalRevenueCents: number;
  segments: { new: number; regular: number; vip: number; at_risk: number };
}

const segmentConfig: Record<string, { label: string; color: string; bgColor: string; icon: React.ElementType }> = {
  new: { label: 'New', color: 'text-blue-600', bgColor: 'bg-blue-100 dark:bg-blue-900/30', icon: UserPlus },
  regular: { label: 'Regular', color: 'text-emerald-600', bgColor: 'bg-emerald-100 dark:bg-emerald-900/30', icon: Users },
  vip: { label: 'VIP', color: 'text-purple-600', bgColor: 'bg-purple-100 dark:bg-purple-900/30', icon: Crown },
  at_risk: { label: 'At Risk', color: 'text-orange-600', bgColor: 'bg-orange-100 dark:bg-orange-900/30', icon: AlertCircle },
};

function formatCents(cents: number): string {
  return `ETB ${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function CRMView() {
  const { user, selectedBranchId, branchChangeVersion } = useAppStore();
  const restaurantId = user?.restaurantId || '';

  const [customers, setCustomers] = useState<CustomerData[]>([]);
  const [summary, setSummary] = useState<CRMSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSegment, setActiveSegment] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchRef = useRef<(() => Promise<void>) | undefined>(undefined);

  const handleBranchChange = useCallback((newBranchId: string) => {
    setLoading(true);
    setCustomers([]);
    fetchRef.current?.();
  }, []);

  useBranchChange(handleBranchChange);

  const fetchCRM = useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);
    try {
      const branchId = useAppStore.getState().selectedBranchId;
      const params: Record<string, string> = { limit: '50', page: String(page) };
      if (branchId) params.branchId = branchId;
      if (activeSegment) params.segment = activeSegment;

      const res = await api.get<{ data: CustomerData[]; pagination: { totalPages: number }; summary: CRMSummary }>(
        `/api/restaurants/${restaurantId}/crm`,
        params
      );
      setCustomers(res.data || []);
      setSummary(res.summary || null);
      setTotalPages(res.pagination?.totalPages || 1);
    } catch {
      setCustomers([]);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [restaurantId, page, activeSegment]);

  useEffect(() => { fetchRef.current = fetchCRM; }, [fetchCRM]);
  useEffect(() => { fetchCRM(); }, [fetchCRM, selectedBranchId, branchChangeVersion]);

  // Filter by search query locally
  const filtered = searchQuery
    ? customers.filter(c =>
        c.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.phone?.includes(searchQuery) ||
        c.email?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : customers;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Loading CRM...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-1">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Total Customers</span>
              </div>
              <p className="text-2xl font-bold">{summary.totalCustomers}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Avg LTV</span>
              </div>
              <p className="text-2xl font-bold">{formatCents(summary.avgLTVCents)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-1">
                <Star className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Total Revenue</span>
              </div>
              <p className="text-2xl font-bold">{formatCents(summary.totalRevenueCents)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-1">
                <Crown className="h-4 w-4 text-purple-600" />
                <span className="text-xs text-muted-foreground">VIP Customers</span>
              </div>
              <p className="text-2xl font-bold text-purple-600">{summary.segments.vip}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Segment Filters */}
      {summary && (
        <div className="flex flex-wrap gap-2">
          <Button
            variant={activeSegment === null ? 'default' : 'outline'}
            size="sm"
            onClick={() => { setActiveSegment(null); setPage(1); }}
          >
            All ({summary.totalCustomers})
          </Button>
          {Object.entries(segmentConfig).map(([key, config]) => (
            <Button
              key={key}
              variant={activeSegment === key ? 'default' : 'outline'}
              size="sm"
              onClick={() => { setActiveSegment(key); setPage(1); }}
              className="gap-1.5"
            >
              <config.icon className="h-3.5 w-3.5" />
              {config.label} ({summary.segments[key as keyof typeof summary.segments] || 0})
            </Button>
          ))}
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, phone, or email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Customer List */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Users className="h-12 w-12 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">No customers found</p>
            </CardContent>
          </Card>
        ) : (
          filtered.map((customer) => {
            const seg = segmentConfig[customer.segment] || segmentConfig.new;
            const initials = (customer.name || '?').split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase().slice(0, 2);

            return (
              <Card key={customer.id} className="hover:shadow-md transition-shadow">
                <CardContent className="py-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className={`text-xs font-semibold ${seg.bgColor} ${seg.color}`}>
                        {initials}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">{customer.name || 'Unknown'}</p>
                        <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${seg.bgColor} ${seg.color} border-0`}>
                          {seg.label}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                        {customer.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {customer.phone}
                          </span>
                        )}
                        {customer.lastVisitAt && (
                          <span>Last visit: {getTimeAgo(customer.lastVisitAt)}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <div className="flex items-center gap-3 text-xs">
                        <div className="text-right">
                          <p className="font-semibold">{formatCents(customer.totalSpentCents)}</p>
                          <p className="text-muted-foreground">LTV</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">{customer.visitCount}</p>
                          <p className="text-muted-foreground">visits</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-primary">{customer.loyaltyPoints}</p>
                          <p className="text-muted-foreground">points</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage(p => p - 1)}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage(p => p + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
