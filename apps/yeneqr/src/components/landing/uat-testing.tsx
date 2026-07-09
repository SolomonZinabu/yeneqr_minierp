'use client';

import React, { useState, useCallback } from 'react';
import { useI18n } from '@/hooks/useI18n';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  QrCode,
  Store,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  Loader2,
  ExternalLink,
  MapPin,
  Users,
  Eye,
  Layers,
  FlaskConical,
  ScanLine,
  TableProperties,
  CircleDot,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';

// ── Types ──

interface UATQRCode {
  id: string;
  type: 'static' | 'dynamic' | 'temporary';
  isActive: boolean;
  payload: string;
  signature: string;
  scanCount: number;
  createdAt: string;
  qrUrl?: string;
}

interface UATTable {
  id: string;
  number: string;
  capacity: number;
  status: string;
  shape: string;
  floor: { id: string; name: string } | null;
  qrCode: UATQRCode | null;
}

interface UATBranch {
  id: string;
  name: string;
  nameAm: string | null;
  isMainBranch: boolean;
  tables: UATTable[];
}

interface UATRestaurant {
  id: string;
  name: string;
  nameAm: string | null;
  nameI18n: any;
  slug: string;
  logo: string | null;
  banner: string | null;
  cuisineType: string | null;
  city: string | null;
  defaultLanguage: string;
  currency: string;
  branches: UATBranch[];
}

interface UATStats {
  restaurants: number;
  branches: number;
  tables: number;
  qrCodes: number;
}

// ── Main UAT Section Component ──

export function UATTestingSection() {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const [restaurants, setRestaurants] = useState<UATRestaurant[]>([]);
  const [stats, setStats] = useState<UATStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedRestaurant, setSelectedRestaurant] = useState<string | null>(null);

  const tf = (key: string, fallback: string) => {
    const val = t(key);
    return val === key ? fallback : val;
  };

  const fetchUATData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get<{ data: UATRestaurant[]; stats: UATStats }>('/api/uat');
      setRestaurants(res.data || []);
      setStats(res.stats || null);
    } catch (err: any) {
      setError(err.message || 'Failed to load UAT data');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleExpand = useCallback(() => {
    const next = !expanded;
    setExpanded(next);
    if (next && restaurants.length === 0) {
      fetchUATData();
    }
  }, [expanded, restaurants.length, fetchUATData]);

  const handleRestaurantClick = useCallback((restaurantId: string) => {
    setSelectedRestaurant((prev) => (prev === restaurantId ? null : restaurantId));
  }, []);

  const handleSimulateScan = useCallback((qrUrl: string) => {
    // Navigate to the customer menu page directly.
    //
    // The customer menu at /menu/[payload] is a standalone Next.js page,
    // NOT a hash-routed SPA view. We must navigate to the actual page path
    // (not #/menu/...) because:
    // 1. The hash router's extractSlug() treats 'menu' as a restaurant slug,
    //    so #/menu/{token} would never match the customer-menu route
    // 2. Even if it matched, the menu page needs its own standalone layout
    // 3. A real QR scan would navigate to the full URL directly
    //
    // Extract just the path portion (e.g. /menu/...) from the full URL
    try {
      const url = new URL(qrUrl, window.location.origin);
      const path = url.pathname + url.search;
      // Navigate directly to the standalone Next.js page
      window.location.href = path;
    } catch {
      // Fallback: if URL parsing fails, try the raw URL
      window.location.href = qrUrl;
    }
  }, []);

  return (
    <Card className="group hover:shadow-lg transition-all hover:border-emerald-500/30 border-2 border-dashed border-emerald-500/30 bg-gradient-to-b from-emerald-500/5 to-transparent">
      <CardContent className="p-6 space-y-4">
        {/* Header - Clickable to expand */}
        <button
          type="button"
          className="w-full text-center space-y-3 cursor-pointer"
          onClick={handleExpand}
        >
          <div className="mx-auto w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center group-hover:bg-emerald-500/20 transition-colors">
            <FlaskConical className="w-7 h-7 text-emerald-600" />
          </div>
          <h3 className="text-lg font-semibold">
            {tf('landing.uat.customer_title', 'Customer Testing (UAT)')}
          </h3>
          <p className="text-sm text-muted-foreground">
            {tf(
              'landing.uat.customer_desc',
              'Simulate the customer experience by scanning QR codes for any restaurant. Test the full ordering flow end-to-end.',
            )}
          </p>
          <div className="flex items-center justify-center gap-2 text-emerald-600 font-medium text-sm">
            {expanded ? (
              <>
                <ChevronDown className="w-4 h-4" />
                {tf('landing.uat.collapse', 'Collapse UAT Environment')}
              </>
            ) : (
              <>
                <ChevronRight className="w-4 h-4" />
                {tf('landing.uat.expand', 'Open UAT Environment')}
              </>
            )}
          </div>
        </button>

        {/* Expanded UAT Content */}
        {expanded && (
          <div className="space-y-4 pt-2 border-t border-dashed border-emerald-500/20">
            {/* Stats Bar */}
            {stats && (
              <div className="grid grid-cols-4 gap-2">
                {[
                  { icon: Store, label: 'Restaurants', value: stats.restaurants },
                  { icon: Layers, label: 'Branches', value: stats.branches },
                  { icon: TableProperties, label: 'Tables', value: stats.tables },
                  { icon: QrCode, label: 'QR Codes', value: stats.qrCodes },
                ].map((s, i) => (
                  <div
                    key={i}
                    className="flex flex-col items-center p-2 rounded-lg bg-emerald-500/5 border border-emerald-500/10"
                  >
                    <s.icon className="w-4 h-4 text-emerald-600 mb-1" />
                    <span className="text-lg font-bold text-foreground">{s.value}</span>
                    <span className="text-[10px] text-muted-foreground">{s.label}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Loading State */}
            {loading && (
              <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm">Loading restaurants...</span>
              </div>
            )}

            {/* Error State */}
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 text-sm">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                {error}
                <Button variant="ghost" size="sm" onClick={fetchUATData} className="ml-auto">
                  Retry
                </Button>
              </div>
            )}

            {/* No Restaurants */}
            {!loading && !error && restaurants.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Store className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No active restaurants found.</p>
                <p className="text-xs mt-1">Restaurants will appear here once they are registered and set up.</p>
              </div>
            )}

            {/* Restaurant List */}
            {!loading && restaurants.length > 0 && (
              <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                {restaurants.map((restaurant) => (
                  <RestaurantCard
                    key={restaurant.id}
                    restaurant={restaurant}
                    isExpanded={selectedRestaurant === restaurant.id}
                    onToggle={() => handleRestaurantClick(restaurant.id)}
                    onSimulateScan={handleSimulateScan}
                    tf={tf}
                  />
                ))}
              </div>
            )}

            {/* UAT Info Footer */}
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/5 border border-amber-500/15 text-xs text-muted-foreground">
              <FlaskConical className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-amber-600 mb-0.5">UAT Environment</p>
                <p>
                  This section is for testing purposes only during development. Clicking &quot;Scan &amp; Test&quot;
                  will navigate to the customer menu in this tab, simulating a real QR scan. Orders placed
                  here will be sent to the restaurant&apos;s kitchen display.
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Restaurant Card Component ──

function RestaurantCard({
  restaurant,
  isExpanded,
  onToggle,
  onSimulateScan,
  tf,
}: {
  restaurant: UATRestaurant;
  isExpanded: boolean;
  onToggle: () => void;
  onSimulateScan: (qrUrl: string) => void;
  tf: (key: string, fallback: string) => string;
}) {
  const totalTables = restaurant.branches.reduce((sum, b) => sum + b.tables.length, 0);
  const totalQRCodes = restaurant.branches.reduce(
    (sum, b) => sum + b.tables.filter((t) => t.qrCode?.isActive).length,
    0,
  );

  return (
    <div className="rounded-lg border bg-card overflow-hidden transition-all">
      {/* Restaurant Header - Clickable */}
      <button
        type="button"
        className="w-full flex items-center gap-3 p-3 hover:bg-accent/30 transition-colors text-left"
        onClick={onToggle}
      >
        {/* Logo */}
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
          {restaurant.logo ? (
            <img src={restaurant.logo} alt={restaurant.name} className="w-full h-full object-cover" />
          ) : (
            <Store className="w-5 h-5 text-primary" />
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm truncate">{restaurant.name}</span>
            {restaurant.cuisineType && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">
                {restaurant.cuisineType}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
            {restaurant.city && (
              <span className="flex items-center gap-0.5">
                <MapPin className="w-3 h-3" />
                {restaurant.city}
              </span>
            )}
            <span className="flex items-center gap-0.5">
              <TableProperties className="w-3 h-3" />
              {totalTables} tables
            </span>
            <span className="flex items-center gap-0.5">
              <QrCode className="w-3 h-3" />
              {totalQRCodes} QR
            </span>
          </div>
        </div>

        {/* Expand Icon */}
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
        )}
      </button>

      {/* Expanded: Branches & QR Codes */}
      {isExpanded && (
        <div className="border-t bg-muted/20">
          {restaurant.branches.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No branches set up yet.
            </div>
          ) : (
            restaurant.branches.map((branch) => (
              <BranchSection
                key={branch.id}
                branch={branch}
                restaurantSlug={restaurant.slug}
                onSimulateScan={onSimulateScan}
                tf={tf}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ── Branch Section Component ──

function BranchSection({
  branch,
  restaurantSlug,
  onSimulateScan,
  tf,
}: {
  branch: UATBranch;
  restaurantSlug: string;
  onSimulateScan: (qrUrl: string) => void;
  tf: (key: string, fallback: string) => string;
}) {
  const tablesWithQR = branch.tables.filter((t) => t.qrCode?.isActive);
  const tablesWithoutQR = branch.tables.filter((t) => !t.qrCode?.isActive);

  return (
    <div className="border-b last:border-0">
      {/* Branch Header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/30 border-b">
        <Layers className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-sm font-medium">{branch.name}</span>
        {branch.isMainBranch && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-primary/30 text-primary">
            Main
          </Badge>
        )}
        <span className="text-xs text-muted-foreground ml-auto">
          {tablesWithQR.length}/{branch.tables.length} tables have QR codes
        </span>
      </div>

      {/* Tables Grid */}
      {branch.tables.length === 0 ? (
        <div className="px-4 py-3 text-xs text-muted-foreground text-center">
          No tables configured for this branch.
        </div>
      ) : (
        <div className="p-2 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {branch.tables.map((table) => (
            <TableQRCard
              key={table.id}
              table={table}
              restaurantSlug={restaurantSlug}
              onSimulateScan={onSimulateScan}
              tf={tf}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Table QR Card Component ──

function TableQRCard({
  table,
  restaurantSlug,
  onSimulateScan,
  tf,
}: {
  table: UATTable;
  restaurantSlug: string;
  onSimulateScan: (qrUrl: string) => void;
  tf: (key: string, fallback: string) => string;
}) {
  const hasQR = table.qrCode?.isActive && table.qrCode?.qrUrl;
  const statusColors: Record<string, string> = {
    available: 'text-emerald-500',
    occupied: 'text-amber-500',
    reserved: 'text-blue-500',
    cleaning: 'text-orange-500',
  };

  return (
    <div
      className={`relative rounded-lg border p-2.5 text-center transition-all ${
        hasQR
          ? 'border-emerald-500/20 bg-emerald-500/5 hover:border-emerald-500/40 hover:bg-emerald-500/10 cursor-pointer'
          : 'border-dashed border-muted-foreground/20 bg-muted/10 opacity-60'
      }`}
      onClick={() => {
        if (hasQR && table.qrCode?.qrUrl) {
          onSimulateScan(table.qrCode.qrUrl);
        }
      }}
    >
      {/* Table Number */}
      <div className="flex items-center justify-center gap-1.5 mb-1.5">
        <CircleDot className={`w-3 h-3 ${statusColors[table.status] || 'text-gray-400'}`} />
        <span className="text-sm font-bold">T{table.number}</span>
      </div>

      {/* Capacity */}
      <div className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground mb-1.5">
        <Users className="w-3 h-3" />
        {table.capacity} seats
      </div>

      {/* Floor */}
      {table.floor && (
        <div className="text-[10px] text-muted-foreground mb-1.5 truncate">
          {table.floor.name}
        </div>
      )}

      {/* QR Status */}
      {hasQR ? (
        <div className="space-y-1.5">
          <div className="flex items-center justify-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
            <span className="text-[10px] font-medium text-emerald-600">
              {table.qrCode!.type.toUpperCase()}
            </span>
          </div>
          <Button
            size="sm"
            className="w-full h-7 text-[11px] gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={(e) => {
              e.stopPropagation();
              if (table.qrCode?.qrUrl) {
                onSimulateScan(table.qrCode.qrUrl);
              }
            }}
          >
            <ScanLine className="w-3 h-3" />
            Scan & Test
          </Button>
          {table.qrCode!.scanCount > 0 && (
            <div className="text-[9px] text-muted-foreground">
              {table.qrCode!.scanCount} scans
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-1">
          <div className="flex items-center justify-center gap-1">
            <AlertTriangle className="w-3 h-3 text-amber-500" />
            <span className="text-[10px] text-amber-600">No QR</span>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="w-full h-7 text-[11px] gap-1"
            onClick={(e) => {
              e.stopPropagation();
              // Navigate to restaurant dashboard where they can generate QR codes
              navigateToDashboard(restaurantSlug);
            }}
          >
            <ExternalLink className="w-3 h-3" />
            Generate
          </Button>
        </div>
      )}
    </div>
  );
}

function navigateToDashboard(slug: string) {
  // Use hash router navigation
  window.location.hash = `/${slug}/login`;
}
