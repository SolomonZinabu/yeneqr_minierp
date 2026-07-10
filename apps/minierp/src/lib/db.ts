// src/lib/db.ts
// Prisma client singleton with $extends for automatic tenant isolation.
//
// All tenant-scoped models (TenantUser, OrganizationNode, AuditLog,
// IntegrationEvent, TenantIntegration) get an automatic `where: { tenantId }`
// filter on reads and `data: { tenantId }` injection on writes — driven by
// AsyncLocalStorage set in middleware on every request.
//
// `Tenant` itself is NOT auto-filtered — only super-admin / provisioning code
// should query it directly.

import { PrismaClient } from "@prisma/client";
import { AsyncLocalStorage } from "node:async_hooks";

// ────────────────────────────────────────────────────────────
//  Tenant context via AsyncLocalStorage
// ────────────────────────────────────────────────────────────

/**
 * AsyncLocalStorage slot holding the current request's tenantId.
 * Set by `runWithTenant(tenantId, fn)` in middleware / API routes.
 *
 * `null` means "no tenant context" (e.g. system-level operations like
 * provisioning, health checks, auth). Tenant-scoped model queries will
 * throw in this mode unless explicitly opted out via `bypassTenant()`.
 */
export const tenantContext = new AsyncLocalStorage<string | null>();

/**
 * Run an async function with a specific tenantId as the current context.
 * All Prisma queries on tenant-scoped models inside `fn` will be
 * automatically filtered by this tenantId.
 */
export function runWithTenant<T>(
  tenantId: string,
  fn: () => Promise<T>,
): Promise<T> {
  return tenantContext.run(tenantId, fn);
}

/**
 * Run an async function with NO tenant context (system mode).
 * Use this only for: provisioning, super-admin operations, auth lookups.
 * Tenant-scoped queries will throw unless each call opts out explicitly.
 */
export function runWithoutTenant<T>(fn: () => Promise<T>): Promise<T> {
  return tenantContext.run(null, fn);
}

/**
 * Get the current tenantId from the AsyncLocalStorage context.
 * Returns null if no context is set.
 */
export function getCurrentTenantId(): string | null {
  return tenantContext.getStore() ?? null;
}

// ────────────────────────────────────────────────────────────
//  Prisma client (singleton — avoid exhausting connections in dev)
// ────────────────────────────────────────────────────────────

const globalForPrisma = globalThis as unknown as {
  prismaRaw?: PrismaClient;
};

const basePrisma: PrismaClient =
  globalForPrisma.prismaRaw ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prismaRaw = basePrisma;
}

// ────────────────────────────────────────────────────────────
//  Tenant-scoped models — list of model names that have `tenantId`.
// ────────────────────────────────────────────────────────────

const TENANT_SCOPED_MODELS = [
  "TenantUser",
  "OrganizationNode",
  "AuditLog",
  "IntegrationEvent",
  "TenantIntegration",
  "NumberSeries",
  "NumberSequenceValue",
  "CustomField",
  "CustomFieldValue",
  "InventoryItem",
  "StockMovement",
  "Supplier",
  "PurchaseOrder",
  "PurchaseOrderLine",
  "GoodsReceipt",
  "GoodsReceiptLine",
  "Stocktake",
  "StocktakeLine",
  "StockTransfer",
  "StockTransferLine",
  "Wastage",
  "WastageLine",
  "ItemCostSnapshot",
  "BillOfMaterial",
  "BillOfMaterialLine",
  "LedgerAccount",
  "JournalEntry",
  "JournalLine",
  "Employee",
  "AttendanceRecord",
  "SalaryComponent",
  "PayrollRun",
  "PayrollItem",
] as const;

type TenantScopedModel = (typeof TENANT_SCOPED_MODELS)[number];

const READ_OPERATIONS = ["findFirst", "findMany", "findUnique", "count", "groupBy", "aggregate"];
const WRITE_OPERATIONS = ["create", "createMany", "createManyAndReturn", "upsert"];
const UPDATE_OPERATIONS = ["update", "updateMany", "upsert"];
const DELETE_OPERATIONS = ["delete", "deleteMany"];

/**
 * Build the $extends query extension for a single tenant-scoped model.
 * Behavior:
 *   - Reads  → inject `where: { tenantId }` (merged with caller's where)
 *   - Writes → inject `data: { tenantId }`
 *   - Updates / Deletes → inject `where: { tenantId }` (single-row ops)
 *                         or `where: { tenantId }` (multi-row ops)
 *   - If no tenant context → THROW (unless bypassTenant flag is set on args)
 */
function buildTenantExtension(model: TenantScopedModel) {
  return {
    async $allOperations({
      args,
      query,
      operation,
    }: {
      args: Record<string, unknown>;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      query: (args: Record<string, unknown>) => Promise<any>;
      operation: string;
      model?: string;
    }) {
      // Bypass flag — escape hatch for system operations (provisioning, etc.)
      const bypass = (args as { __bypassTenant?: boolean }).__bypassTenant === true;
      if (bypass) {
        // Strip the bypass flag before forwarding to Prisma
        const { __bypassTenant, ...cleanArgs } = args;
        void __bypassTenant;
        return query(cleanArgs);
      }

      const tenantId = tenantContext.getStore();

      if (!tenantId) {
        throw new Error(
          `Tenant context required for ${model}.${operation} — ` +
            `wrap the call in runWithTenant(tenantId, ...) or set __bypassTenant: true for system ops.`,
        );
      }

      // Inject tenantId into where-clause for read / update / delete
      if (
        READ_OPERATIONS.includes(operation) ||
        UPDATE_OPERATIONS.includes(operation) ||
        DELETE_OPERATIONS.includes(operation)
      ) {
        const where = (args.where ?? {}) as Record<string, unknown>;
        args.where = { ...where, tenantId };
      }

      // Inject tenantId into data for create / createMany (NOT upsert — handled below)
      if (WRITE_OPERATIONS.includes(operation) && operation !== "upsert") {
        if (operation === "createMany" || operation === "createManyAndReturn") {
          const data = args.data as unknown;
          if (Array.isArray(data)) {
            args.data = data.map((row) => ({ ...row, tenantId }));
          } else {
            args.data = { ...(data as Record<string, unknown>), tenantId };
          }
        } else {
          const data = (args.data ?? {}) as Record<string, unknown>;
          args.data = { ...data, tenantId };
        }
      }

      // upsert has both `where`, `create` and `update` — handle each
      if (operation === "upsert") {
        const where = (args.where ?? {}) as Record<string, unknown>;
        const create = (args.create ?? {}) as Record<string, unknown>;
        const update = (args.update ?? {}) as Record<string, unknown>;
        args.where = { ...where, tenantId };
        args.create = { ...create, tenantId };
        // update must NOT set tenantId (immutable); merge where-filter happens above
        void update;
      }

      return query(args);
    },
  };
}

// Build the full $extends config for all tenant-scoped models.
// Note: Prisma's $extends query keys use the CAMEL-CASE model name
// (e.g. `organizationNode`, not `OrganizationNode`).
const TENANT_SCOPED_MODELS_CAMEL: Record<TenantScopedModel, string> = {
  TenantUser: "tenantUser",
  OrganizationNode: "organizationNode",
  AuditLog: "auditLog",
  IntegrationEvent: "integrationEvent",
  TenantIntegration: "tenantIntegration",
  NumberSeries: "numberSeries",
  NumberSequenceValue: "numberSequenceValue",
  CustomField: "customField",
  CustomFieldValue: "customFieldValue",
  InventoryItem: "inventoryItem",
  StockMovement: "stockMovement",
  Supplier: "supplier",
  PurchaseOrder: "purchaseOrder",
  PurchaseOrderLine: "purchaseOrderLine",
  GoodsReceipt: "goodsReceipt",
  GoodsReceiptLine: "goodsReceiptLine",
  Stocktake: "stocktake",
  StocktakeLine: "stocktakeLine",
  StockTransfer: "stockTransfer",
  StockTransferLine: "stockTransferLine",
  Wastage: "wastage",
  WastageLine: "wastageLine",
  ItemCostSnapshot: "itemCostSnapshot",
  BillOfMaterial: "billOfMaterial",
  BillOfMaterialLine: "billOfMaterialLine",
  LedgerAccount: "ledgerAccount",
  JournalEntry: "journalEntry",
  JournalLine: "journalLine",
  Employee: "employee",
  AttendanceRecord: "attendanceRecord",
  SalaryComponent: "salaryComponent",
  PayrollRun: "payrollRun",
  PayrollItem: "payrollItem",
};

const tenantExtensionConfig = {
  query: Object.fromEntries(
    TENANT_SCOPED_MODELS.map((m) => [
      TENANT_SCOPED_MODELS_CAMEL[m],
      buildTenantExtension(m),
    ]),
  ) as Record<string, ReturnType<typeof buildTenantExtension>>,
};

// ────────────────────────────────────────────────────────────
//  Extended client
// ────────────────────────────────────────────────────────────

/**
 * `db` is the singleton Prisma client with tenant isolation baked in.
 *
 * Usage:
 *   import { db, runWithTenant } from "@/lib/db";
 *   await runWithTenant(tenantId, async () => {
 *     const nodes = await db.organizationNode.findMany(); // auto-filtered
 *   });
 *
 * System operations (provisioning):
 *   await db.tenant.create({ data: {...} }); // Tenant itself is NOT filtered
 *   await db.tenantUser.create({
 *     data: {...},
 *     __bypassTenant: true, // escape hatch for system-level writes
 *   } as Record<string, unknown>);
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const typedExtension = tenantExtensionConfig as any;
export const db = basePrisma.$extends(typedExtension);

export type DbClient = typeof db;

// Re-export the raw (un-extended) client for system-level operations
// that genuinely need to bypass tenant isolation entirely.
export const dbRaw = basePrisma;

export default db;
