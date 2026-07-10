// scripts/setup-dev.ts
// One-shot setup — run anytime the session restarts to get a fully working
// dev environment with demo data + 6 demo users (one per role).
// Usage: npm run db:setup

import { PrismaClient } from "@prisma/client";
import { execSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const prisma = new PrismaClient();
const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = resolve(__dirname, "..");

const DEMO_PASSWORD = "demo1234";
const DEMO_USERS: { email: string; name: string; role: "owner" | "accountant" | "manager" | "chef" | "waiter" | "staff" }[] = [
  { email: "owner@demo.et",      name: "Hana Tesfaye",    role: "owner" },
  { email: "accountant@demo.et", name: "Dawit Haile",     role: "accountant" },
  { email: "manager@demo.et",    name: "Sara Bekele",     role: "manager" },
  { email: "chef@demo.et",       name: "Tigist Bekele",   role: "chef" },
  { email: "waiter@demo.et",     name: "Mulu Girma",      role: "waiter" },
  { email: "staff@demo.et",      name: "Abebe Kebede",    role: "staff" },
];

const PLANS = [
  { slug: "erp_starter", name: "Starter", description: "For single-location restaurants", priceCents: 4900, yearlyPriceCents: 49000, features: ["inventory", "po", "grn", "basic_gl"], sortOrder: 1 },
  { slug: "erp_pro", name: "Professional", description: "For multi-branch groups", priceCents: 9900, yearlyPriceCents: 99000, features: ["inventory", "po", "grn", "full_gl", "payroll", "custom_fields", "multi_branch"], sortOrder: 2 },
  { slug: "erp_enterprise", name: "Enterprise", description: "For chains with SSO + audit needs", priceCents: 24900, yearlyPriceCents: 249000, features: ["inventory", "po", "grn", "full_gl", "payroll", "custom_fields", "multi_branch", "sso", "audit_log", "api_access", "white_label"], sortOrder: 3 },
];

async function main() {
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  Mini ERP — Dev Environment Setup");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  console.log("▶ Step 1/10: Pushing Prisma schema to DB...");
  try { execSync("npx prisma db push --skip-generate", { cwd: APP_ROOT, stdio: "inherit" }); }
  catch { console.error("  ✗ prisma db push failed."); process.exit(1); }

  console.log("\n▶ Step 2/10: Seeding ERP plans...");
  for (const plan of PLANS) await prisma.erpPlan.upsert({ where: { slug: plan.slug }, create: { ...plan, features: plan.features, isActive: true }, update: {} });
  console.log("  ✓ 3 plans");

  console.log("\n▶ Step 3/10: Seeding demo tenant...");
  const apiKey = `merp_${randomBytes(24).toString("hex")}`;
  const tenant = await prisma.tenant.upsert({
    where: { slug: "demo-restaurant" },
    create: { name: "Demo Restaurant Group", slug: "demo-restaurant", currency: "ETB", taxRate: 0.15, erpEnabled: true, erpPlanSlug: "erp_pro", externalYeneqrId: "demo-yeneqr-restaurant-id", apiKey, settings: {} },
    update: { erpEnabled: true, apiKey },
  });
  console.log(`  ✓ Tenant: ${tenant.name} (id: ${tenant.id})`);

  console.log("\n▶ Step 4-5: Seeding demo users + linking to tenant + setting passwords...");
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  for (const demo of DEMO_USERS) {
    const user = await prisma.user.upsert({ where: { email: demo.email }, create: { email: demo.email, name: demo.name, isActive: true }, update: { name: demo.name, isActive: true } });
    await prisma.tenantUser.upsert({ where: { tenantId_userId: { tenantId: tenant.id, userId: user.id } }, create: { tenantId: tenant.id, userId: user.id, role: demo.role, isPrimary: demo.role === "owner", acceptedAt: new Date(), permissions: [] }, update: { role: demo.role, isPrimary: demo.role === "owner" } });
    const existingAccount = await (prisma as unknown as { account: { findFirst: (a: unknown) => Promise<{ id: string } | null> } }).account.findFirst({ where: { userId: user.id, providerId: "credential" } });
    if (existingAccount) await (prisma as unknown as { account: { update: (a: unknown) => Promise<unknown> } }).account.update({ where: { id: existingAccount.id }, data: { password: passwordHash } });
    else await (prisma as unknown as { account: { create: (a: unknown) => Promise<unknown> } }).account.create({ data: { id: `acc_${user.id}`, userId: user.id, providerId: "credential", accountId: user.id, password: passwordHash, createdAt: new Date(), updatedAt: new Date() } });
  }
  console.log(`  ✓ ${DEMO_USERS.length} users (all passwords: "${DEMO_PASSWORD}")`);

  console.log("\n▶ Step 6: Seeding Main Branch org node (linked to YeneQR)...");
  await prisma.organizationNode.upsert({ where: { tenantId_code: { tenantId: tenant.id, code: "MAIN" } }, create: { tenantId: tenant.id, name: "Main Branch", code: "MAIN", type: "branch", externalYeneqrBranchId: "demo-yeneqr-restaurant-id", isActive: true }, update: { externalYeneqrBranchId: "demo-yeneqr-restaurant-id" } });
  console.log("  ✓ Main Branch");

  console.log("\n▶ Step 7: Seeding YeneQR tenant integration...");
  await prisma.tenantIntegration.upsert({ where: { tenantId_provider: { tenantId: tenant.id, provider: "yeneqr" } }, create: { tenantId: tenant.id, provider: "yeneqr", externalId: "demo-yeneqr-restaurant-id", apiKey, isActive: true, config: {} }, update: { apiKey } });
  console.log(`  ✓ Integration (API key: ${apiKey})`);

  console.log("\n▶ Step 8: Seeding default number series...");
  const { NumberService } = await import("../src/lib/services/number-service");
  const { runWithTenant } = await import("../src/lib/db");
  await runWithTenant(tenant.id, async () => { await NumberService.seedDefaults(tenant.id); });
  console.log("  ✓ 8 series");

  console.log("\n▶ Step 9: Seeding Ethiopian restaurant Chart of Accounts...");
  const { CoaSeeder } = await import("../src/lib/services/coa-seeder");
  await runWithTenant(tenant.id, async () => { await CoaSeeder.seed(tenant.id); });
  console.log("  ✓ 60+ accounts");

  console.log("\n▶ Step 10: Seeding sample data...");
  await seedSampleData(tenant.id);
  console.log("  ✓ 9 items, 3 suppliers, 4 employees, 7 days attendance");

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  ✅ Setup complete!");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  console.log("📋 Demo accounts (all passwords: " + DEMO_PASSWORD + "):");
  for (const u of DEMO_USERS) console.log(`   ${u.email.padEnd(22)} ${u.role.padEnd(12)} ${u.name}`);
  console.log(`\n🔑 YeneQR webhook API key: ${apiKey}`);
  console.log(`   Webhook URL: http://localhost:3000/api/integrations/yeneqr/webhook`);
  console.log(`\n🚀 Start the dev server:`);
  console.log(`   cd /home/z/my-project/yeneqr_minierp && npm run dev:minierp`);
  console.log(`   → http://localhost:3000\n`);
}

async function seedSampleData(tenantId: string) {
  const orgNode = await prisma.organizationNode.findFirstOrThrow({ where: { tenantId, code: "MAIN" } });
  const suppliers = [
    { code: "SUP-001", name: "Bole Meat Supply", contactName: "Abebe", phone: "+251911111111", city: "Addis Ababa", paymentTerms: "Net 15", leadTimeDays: 2 },
    { code: "SUP-002", name: "Fresh Produce PLC", contactName: "Sara", phone: "+251911222222", city: "Addis Ababa", paymentTerms: "COD", leadTimeDays: 1 },
    { code: "SUP-003", name: "Beverage Distributors", contactName: "Yonas", phone: "+251911333333", city: "Addis Ababa", paymentTerms: "Net 30", leadTimeDays: 5 },
  ];
  for (const s of suppliers) await prisma.supplier.upsert({ where: { tenantId_code: { tenantId, code: s.code } }, create: { tenantId, ...s, currency: "ETB", country: "Ethiopia", isActive: true }, update: {} });

  const items = [
    { sku: "BEEF-KG", name: "Beef (boneless)", category: "Meat", uom: "kg", itemType: "ingredient", costPrice: 450, sellPrice: 0, reorderPoint: 10, reorderQty: 30 },
    { sku: "ONION-KG", name: "Onions", category: "Produce", uom: "kg", itemType: "ingredient", costPrice: 35, sellPrice: 0, reorderPoint: 5, reorderQty: 20 },
    { sku: "OIL-L", name: "Cooking Oil", category: "Dry Goods", uom: "L", itemType: "ingredient", costPrice: 180, sellPrice: 0, reorderPoint: 8, reorderQty: 24 },
    { sku: "RICE-KG", name: "Long Grain Rice", category: "Dry Goods", uom: "kg", itemType: "ingredient", costPrice: 90, sellPrice: 0, reorderPoint: 15, reorderQty: 50 },
    { sku: "SPICE-PCK", name: "Berbere Spice Mix", category: "Dry Goods", uom: "pack", itemType: "ingredient", costPrice: 60, sellPrice: 0, reorderPoint: 5, reorderQty: 15 },
    { sku: "TEA-BAG", name: "Black Tea Bags", category: "Beverage", uom: "pack", itemType: "ingredient", costPrice: 80, sellPrice: 0, reorderPoint: 3, reorderQty: 10 },
    { sku: "COKE-BTL", name: "Coca-Cola 500mL", category: "Beverage", uom: "each", itemType: "finished_good", costPrice: 18, sellPrice: 35, reorderPoint: 24, reorderQty: 96, externalYeneqrMenuItemId: "yeneqr-coke-001" },
    { sku: "BIRYANI-PLT", name: "Chicken Biryani Plate", category: "Food", uom: "each", itemType: "finished_good", costPrice: 0, sellPrice: 280, reorderPoint: 0, reorderQty: 0, externalYeneqrMenuItemId: "yeneqr-biryani-001" },
    { sku: "BOX-MED", name: "Medium Takeout Box", category: "Packaging", uom: "each", itemType: "packaging", costPrice: 4, sellPrice: 0, reorderPoint: 100, reorderQty: 500 },
  ];
  for (const i of items) await prisma.inventoryItem.upsert({ where: { tenantId_sku: { tenantId, sku: i.sku } }, create: { tenantId, ...i, isStockable: true, isActive: true }, update: {} });

  const employees = [
    { firstName: "Tigist", lastName: "Bekele", department: "Kitchen", jobTitle: "Head Chef", baseSalary: 12000, allowsOvertime: false },
    { firstName: "Mulu", lastName: "Girma", department: "Service", jobTitle: "Waiter", baseSalary: 6500, allowsOvertime: true },
    { firstName: "Dawit", lastName: "Haile", department: "Service", jobTitle: "Cashier", baseSalary: 8000, allowsOvertime: false },
    { firstName: "Hana", lastName: "Tesfaye", department: "Management", jobTitle: "Branch Manager", baseSalary: 18000, allowsOvertime: false },
  ];
  let empCounter = 1;
  for (const e of employees) {
    const employeeNumber = `EMP-${String(empCounter).padStart(4, "0")}`;
    const fullName = `${e.firstName} ${e.lastName}`;
    await prisma.employee.upsert({ where: { tenantId_employeeNumber: { tenantId, employeeNumber } }, create: { tenantId, orgNodeId: orgNode.id, employeeNumber, firstName: e.firstName, lastName: e.lastName, fullName, employmentType: "permanent", jobTitle: e.jobTitle, department: e.department, baseSalary: e.baseSalary, currency: "ETB", payFrequency: "monthly", allowsOvertime: e.allowsOvertime, employmentStatus: "active", isActive: true, hireDate: new Date(), nationality: "Ethiopian" }, update: {} });
    empCounter++;
  }

  const allEmployees = await prisma.employee.findMany({ where: { tenantId } });
  for (let i = 0; i < 7; i++) {
    const date = new Date(); date.setDate(date.getDate() - i); date.setHours(0, 0, 0, 0);
    for (const emp of allEmployees) {
      const existing = await prisma.attendanceRecord.findUnique({ where: { tenantId_employeeId_date: { tenantId, employeeId: emp.id, date } } });
      if (existing) continue;
      const isWeekend = date.getDay() === 6;
      await prisma.attendanceRecord.create({ data: { tenantId, employeeId: emp.id, orgNodeId: emp.orgNodeId, date, workedHours: isWeekend ? 4 : 8, otHoursRegular: emp.allowsOvertime ? Math.floor(Math.random() * 3) : 0, otHoursRest: isWeekend && emp.allowsOvertime ? 4 : 0, otHoursPublic: 0, status: isWeekend ? "rest_day" : "present" } });
    }
  }
}

main().catch((e) => { console.error("\n❌ Setup failed:", e); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });
