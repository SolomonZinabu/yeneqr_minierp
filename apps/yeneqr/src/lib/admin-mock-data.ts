// ⚠️ DEPRECATED — This file is no longer the source of truth for types or helpers.
// All types and utility functions have been moved to @/lib/types.
// This file is kept temporarily for any remaining references and will be removed in a future cleanup.
// Please import from '@/lib/types' instead.

export type RestaurantStatus = 'active' | 'suspended' | 'pending';
export type SubscriptionPlanId = 'basic' | 'pro' | 'premium';
export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface AdminRestaurant {
  id: string;
  name: string;
  slug: string;
  ownerName: string;
  ownerEmail: string;
  cuisine: string;
  city: string;
  plan: SubscriptionPlanId;
  status: RestaurantStatus;
  tables: number;
  branches: number;
  monthlyOrders: number;
  monthlyRevenue: number;
  joinedAt: string;
  lastActiveAt: string;
}

export interface SubscriptionPlan {
  id: string;
  slug?: string;
  name: string;
  description?: string;
  price: number;
  yearlyPrice?: number | null;
  features: string[];
  limits?: {
    maxBranches: number;
    maxTables: number;
    maxStaff: number;
    maxMenuItems: number;
    maxQRCodes?: number;
  };
  maxTables: number;
  maxBranches: number;
  maxStaff: number;
  restaurants: number;
  revenue: number;
  isActive?: boolean;
  sortOrder?: number;
}

export interface SupportTicket {
  id: string;
  subject: string;
  description: string;
  restaurantName: string;
  restaurantId: string;
  status: TicketStatus;
  priority: TicketPriority;
  category: string;
  assignedTo: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FeatureFlag {
  id: string;
  name: string;
  key: string;
  description: string;
  enabled: boolean;
  rolloutPercentage: number;
  updatedAt: string;
}

export interface MonthlyRevenue {
  month: string;
  revenue: number;
  subscriptions: number;
  newRestaurants: number;
}

export interface CuisineStat {
  cuisine: string;
  count: number;
  percentage: number;
}

export interface GeoStat {
  city: string;
  restaurants: number;
  revenue: number;
}

// ==================== HELPER FUNCTIONS ====================

export function formatETB(cents: number): string {
  return `${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB`;
}

export function getPlanLabel(plan: SubscriptionPlanId): string {
  const labels: Record<SubscriptionPlanId, string> = {
    basic: 'Basic',
    pro: 'Pro',
    premium: 'Premium',
  };
  return labels[plan];
}

export function getStatusColor(status: RestaurantStatus): string {
  const colors: Record<RestaurantStatus, string> = {
    active: 'bg-emerald-500/10 text-emerald-700 border-emerald-200',
    suspended: 'bg-red-500/10 text-red-700 border-red-200',
    pending: 'bg-amber-500/10 text-amber-700 border-amber-200',
  };
  return colors[status];
}

export function getTicketStatusColor(status: TicketStatus): string {
  const colors: Record<TicketStatus, string> = {
    open: 'bg-amber-500/10 text-amber-700 border-amber-200',
    in_progress: 'bg-blue-500/10 text-blue-700 border-blue-200',
    resolved: 'bg-emerald-500/10 text-emerald-700 border-emerald-200',
    closed: 'bg-gray-500/10 text-gray-700 border-gray-200',
  };
  return colors[status];
}

export function getPriorityColor(priority: TicketPriority): string {
  const colors: Record<TicketPriority, string> = {
    low: 'bg-gray-500/10 text-gray-600',
    medium: 'bg-blue-500/10 text-blue-600',
    high: 'bg-amber-500/10 text-amber-600',
    urgent: 'bg-red-500/10 text-red-600',
  };
  return colors[priority];
}
