// DEPRECATED: Mock data — all dashboard views now use real APIs. Types are kept for reference.

// Re-export shared types from the canonical types module
export type { OrderStatus, KitchenItemStatus, TableStatus, StaffRole } from './types';

export interface Restaurant {
  id: string;
  name: string;
  nameAm?: string;
  slug: string;
  cuisine: string;
  description: string;
  logo?: string;
  branches: Branch[];
}

export interface Branch {
  id: string;
  name: string;
  address: string;
  phone: string;
  isMain: boolean;
  floors: Floor[];
}

export interface Floor {
  id: string;
  name: string;
  sortOrder: number;
  tables: TableItem[];
}

export interface TableItem {
  id: string;
  number: number;
  capacity: number;
  status: TableStatus;
  shape: 'round' | 'square' | 'rectangle';
  floorId: string;
  branchId: string;
  x: number;
  y: number;
  notes?: string;
}

export interface MenuCategory {
  id: string;
  name: string;
  nameAm: string;
  description: string;
  icon: string;
  sortOrder: number;
  items: MenuItem[];
}

export interface MenuItem {
  id: string;
  name: string;
  nameAm: string;
  description: string;
  descriptionAm?: string;
  price: number;
  categoryId: string;
  image?: string;
  isAvailable: boolean;
  preparationTime: number; // minutes
  modifiers: ModifierGroup[];
  translations?: { en: string; am: string };
}

export interface ModifierGroup {
  id: string;
  name: string;
  required: boolean;
  multiple: boolean;
  options: ModifierOption[];
}

export interface ModifierOption {
  id: string;
  name: string;
  price: number;
}

export interface Order {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  tableId: string;
  tableName: string;
  branchId: string;
  customerName?: string;
  items: OrderItem[];
  subtotal: number;
  tax: number;
  serviceCharge: number;
  total: number;
  createdAt: string;
  updatedAt: string;
  notes?: string;
  waiter?: string;
}

export interface OrderItem {
  id: string;
  menuItemId: string;
  name: string;
  quantity: number;
  price: number;
  kitchenStatus: KitchenItemStatus;
  modifiers?: string[];
  notes?: string;
  preparationStartedAt?: string;
  preparationCompletedAt?: string;
}

export interface StaffMember {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: StaffRole;
  branchId: string;
  branchName: string;
  avatar?: string;
  isActive: boolean;
  lastLogin?: string;
}

export interface QRCode {
  id: string;
  tableId: string;
  tableName: string;
  branchName: string;
  type: 'static' | 'dynamic' | 'temporary';
  isActive: boolean;
  scanCount: number;
  createdAt: string;
  imageUrl: string;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'order' | 'payment' | 'system' | 'waiter_call' | 'review';
  isRead: boolean;
  createdAt: string;
  actionUrl?: string;
}

// ==================== UTILITY FUNCTIONS ====================
// These are kept as they are used by other modules (also duplicated in api-client.ts).

export function formatCurrency(amount: number): string {
  return `ETB ${amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export function getTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}
