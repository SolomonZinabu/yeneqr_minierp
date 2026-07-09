// src/types/index.ts
// Shared application types.

export interface ApiError {
  status: number;
  code?: string;
  message: string;
  details?: unknown;
}

export interface ApiResponse<T> {
  data: T;
  error?: never;
}

export interface ApiErrorResponse {
  data?: never;
  error: ApiError;
}

// ────────────────────────────────────────────────────────────
//  Auth / session
// ────────────────────────────────────────────────────────────

export type UserRole =
  | "owner"
  | "accountant"
  | "manager"
  | "chef"
  | "waiter"
  | "staff";

export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  isActive: boolean;
}

// ────────────────────────────────────────────────────────────
//  Tenants & org nodes
// ────────────────────────────────────────────────────────────

export type ErpPlanSlug = "erp_starter" | "erp_pro" | "erp_enterprise";

export type OrganizationNodeType =
  | "group"
  | "branch"
  | "kitchen_station"
  | "bar"
  | "commissary";

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  currency: string;
  taxRate: number;
  erpEnabled: boolean;
  erpPlanSlug: ErpPlanSlug;
  erpMonthlyPriceCents: number | null;
  externalYeneqrId: string | null;
  apiKey: string | null;
  settings: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProvisionTenantResponse {
  tenantId: string;
  apiKey: string;
  userId: string;
}

// ────────────────────────────────────────────────────────────
//  Integration events
// ────────────────────────────────────────────────────────────

export type IntegrationProvider = "yeneqr" | "toast" | "square" | "manual";
export type IntegrationEventStatus = "received" | "processed" | "failed";

export interface IntegrationEventRecord {
  id: string;
  tenantId: string;
  provider: IntegrationProvider;
  eventType: string;
  externalId: string | null;
  payload: Record<string, unknown>;
  status: IntegrationEventStatus;
  error: string | null;
  receivedAt: Date;
  processedAt: Date | null;
}

// ────────────────────────────────────────────────────────────
//  Audit log
// ────────────────────────────────────────────────────────────

export interface AuditLogEntry {
  id: string;
  tenantId: string;
  userId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
}
