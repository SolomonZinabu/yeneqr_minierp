// GET/POST /api/inventory/items
import { withTenant, parseAndValidate, db, HttpError } from "@/lib/api-helpers";
import { getCurrentTenantId } from "@/lib/db";
import { z } from "zod";

const itemSchema = z.object({
  sku: z.string().min(1).max(64),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  category: z.string().max(100).optional().nullable(),
  uom: z.string().max(20).default("each"),
  itemType: z.enum(["ingredient", "finished_good", "packaging", "consumable"]).default("ingredient"),
  isStockable: z.boolean().default(true),
  reorderPoint: z.number().min(0).default(0),
  reorderQty: z.number().min(0).default(0),
  costPrice: z.number().min(0).default(0),
  sellPrice: z.number().min(0).default(0),
  taxRate: z.number().min(0).max(1).optional().nullable(),
  barcode: z.string().max(100).optional().nullable(),
  orgNodeId: z.string().optional().nullable(),
  externalYeneqrMenuItemId: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
});

export const GET = withTenant(async ({ req }) => {
  const url = new URL(req.url);
  const category = url.searchParams.get("category");
  const orgNodeId = url.searchParams.get("orgNodeId");
  const isActive = url.searchParams.get("isActive");
  const search = url.searchParams.get("q");
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "100"), 500);
  const offset = parseInt(url.searchParams.get("offset") ?? "0");
  const items = await db.inventoryItem.findMany({
    where: {
      ...(category ? { category } : {}),
      ...(orgNodeId ? { orgNodeId } : {}),
      ...(isActive !== null ? { isActive: isActive === "true" } : {}),
      ...(search ? { OR: [{ name: { contains: search } }, { sku: { contains: search } }, { barcode: { contains: search } }] } : {}),
    },
    orderBy: { name: "asc" }, take: limit, skip: offset,
  });
  return Response.json({ items, count: items.length });
});

export const POST = withTenant(async ({ req }) => {
  const data = await parseAndValidate(req, itemSchema);
  const existing = await db.inventoryItem.findUnique({ where: { tenantId_sku: { tenantId: "", sku: data.sku } as never } }).catch(() => null);
  if (existing) throw new HttpError(409, `Item with SKU "${data.sku}" already exists`);
  const item = await db.inventoryItem.create({
    data: {
      tenantId: getCurrentTenantId()!, sku: data.sku, name: data.name,
      description: data.description ?? null, category: data.category ?? null, uom: data.uom,
      itemType: data.itemType, isStockable: data.isStockable,
      reorderPoint: data.reorderPoint, reorderQty: data.reorderQty,
      costPrice: data.costPrice, sellPrice: data.sellPrice, taxRate: data.taxRate ?? null,
      barcode: data.barcode ?? null, orgNodeId: data.orgNodeId ?? null,
      externalYeneqrMenuItemId: data.externalYeneqrMenuItemId ?? null, isActive: data.isActive,
    },
  });
  return Response.json({ item }, { status: 201 });
});
