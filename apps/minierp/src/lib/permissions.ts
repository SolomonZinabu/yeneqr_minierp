// src/lib/permissions.ts
// Permission-based RBAC. Effective perms = ROLE_PERMISSIONS[role] ∪ user.permissions.

export const PERMISSIONS = [
  "inventory.items.read","inventory.items.create","inventory.items.update","inventory.items.delete",
  "inventory.suppliers.read","inventory.suppliers.create","inventory.suppliers.update","inventory.suppliers.delete",
  "inventory.po.read","inventory.po.create","inventory.po.update","inventory.po.approve","inventory.po.cancel",
  "inventory.grn.read","inventory.grn.create","inventory.grn.post",
  "inventory.stocktake.read","inventory.stocktake.create","inventory.stocktake.post",
  "inventory.transfer.read","inventory.transfer.create","inventory.transfer.receive",
  "inventory.wastage.read","inventory.wastage.create","inventory.wastage.post",
  "inventory.stock.read",
  "finance.accounts.read","finance.accounts.create","finance.accounts.update",
  "finance.journal.read","finance.journal.create","finance.journal.reverse",
  "finance.reports.read",
  "hr.employees.read","hr.employees.create","hr.employees.update","hr.employees.terminate",
  "hr.attendance.read","hr.attendance.create","hr.attendance.update",
  "hr.payroll.read","hr.payroll.run","hr.payroll.approve",
  "hr.salary_components.read","hr.salary_components.create","hr.salary_components.update",
  "settings.read","settings.update","settings.audit_log.read","settings.number_series.read",
  "system.org_nodes.read","system.tenant.manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];
export type Role = "owner" | "accountant" | "manager" | "chef" | "waiter" | "staff";
export const ROLES: Role[] = ["owner", "accountant", "manager", "chef", "waiter", "staff"];

export const ROLE_LABELS: Record<Role, string> = {
  owner: "Owner", accountant: "Accountant", manager: "Manager",
  chef: "Chef / Kitchen Lead", waiter: "Waiter / Service Staff", staff: "Staff",
};

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  owner: [...PERMISSIONS],
  accountant: [
    "finance.accounts.read","finance.accounts.create","finance.accounts.update",
    "finance.journal.read","finance.journal.create","finance.journal.reverse","finance.reports.read",
    "hr.employees.read","hr.employees.create","hr.employees.update","hr.employees.terminate",
    "hr.attendance.read","hr.attendance.create","hr.attendance.update",
    "hr.payroll.read","hr.payroll.run","hr.payroll.approve",
    "hr.salary_components.read","hr.salary_components.create","hr.salary_components.update",
    "inventory.items.read","inventory.suppliers.read","inventory.po.read",
    "inventory.grn.read","inventory.grn.create","inventory.grn.post",
    "inventory.stocktake.read","inventory.stocktake.create","inventory.stocktake.post",
    "inventory.transfer.read","inventory.wastage.read","inventory.wastage.create","inventory.wastage.post",
    "inventory.stock.read",
    "settings.read","settings.audit_log.read","settings.number_series.read",
    "system.org_nodes.read","system.tenant.manage",
  ],
  manager: [
    "inventory.items.read","inventory.items.create","inventory.items.update",
    "inventory.suppliers.read","inventory.suppliers.create","inventory.suppliers.update",
    "inventory.po.read","inventory.po.create","inventory.po.update","inventory.po.approve","inventory.po.cancel",
    "inventory.grn.read","inventory.grn.create",
    "inventory.stocktake.read","inventory.stocktake.create","inventory.stocktake.post",
    "inventory.transfer.read","inventory.transfer.create","inventory.transfer.receive",
    "inventory.wastage.read","inventory.wastage.create","inventory.wastage.post",
    "inventory.stock.read",
    "hr.employees.read","hr.employees.create","hr.employees.update",
    "hr.attendance.read","hr.attendance.create","hr.attendance.update","hr.payroll.read",
    "finance.accounts.read","finance.journal.read","finance.reports.read",
    "settings.read","settings.audit_log.read","settings.number_series.read","system.org_nodes.read",
  ],
  chef: [
    "inventory.items.read","inventory.stock.read",
    "inventory.wastage.read","inventory.wastage.create",
    "inventory.transfer.read","inventory.transfer.receive",
    "inventory.stocktake.read","inventory.stocktake.create",
    "hr.attendance.read","settings.read","system.org_nodes.read",
  ],
  waiter: [
    "inventory.items.read","inventory.stock.read",
    "hr.attendance.read","hr.attendance.create",
    "settings.read","system.org_nodes.read",
  ],
  staff: [
    "inventory.items.read","inventory.stock.read",
    "hr.attendance.read","hr.attendance.create",
    "settings.read","system.org_nodes.read",
  ],
};

export function getEffectivePermissions(role: string, userPermissions: string[] = []): Set<string> {
  const rolePerms = ROLE_PERMISSIONS[role as Role] ?? [];
  return new Set([...rolePerms, ...userPermissions]);
}

export const PERMISSION_LABELS: Record<string, string> = {
  "inventory.items.read":"View items","inventory.items.create":"Create items","inventory.items.update":"Edit items","inventory.items.delete":"Deactivate items",
  "inventory.suppliers.read":"View suppliers","inventory.suppliers.create":"Create suppliers","inventory.suppliers.update":"Edit suppliers","inventory.suppliers.delete":"Deactivate suppliers",
  "inventory.po.read":"View purchase orders","inventory.po.create":"Create purchase orders","inventory.po.update":"Edit purchase orders","inventory.po.approve":"Approve purchase orders","inventory.po.cancel":"Cancel purchase orders",
  "inventory.grn.read":"View goods receipts","inventory.grn.create":"Create goods receipts","inventory.grn.post":"Post GRN to GL",
  "inventory.stocktake.read":"View stocktakes","inventory.stocktake.create":"Create stocktakes","inventory.stocktake.post":"Post stocktake variances",
  "inventory.transfer.read":"View transfers","inventory.transfer.create":"Create transfers","inventory.transfer.receive":"Receive transfers",
  "inventory.wastage.read":"View wastage","inventory.wastage.create":"Create wastage","inventory.wastage.post":"Post wastage to GL",
  "inventory.stock.read":"View stock on hand & movements",
  "finance.accounts.read":"View chart of accounts","finance.accounts.create":"Create accounts","finance.accounts.update":"Edit accounts",
  "finance.journal.read":"View journal entries","finance.journal.create":"Create journal entries","finance.journal.reverse":"Reverse journal entries",
  "finance.reports.read":"View financial reports",
  "hr.employees.read":"View employees","hr.employees.create":"Create employees","hr.employees.update":"Edit employees","hr.employees.terminate":"Terminate employees",
  "hr.attendance.read":"View attendance","hr.attendance.create":"Record attendance","hr.attendance.update":"Edit attendance",
  "hr.payroll.read":"View payroll runs","hr.payroll.run":"Run payroll (calculate)","hr.payroll.approve":"Approve & post payroll",
  "hr.salary_components.read":"View salary components","hr.salary_components.create":"Create salary components","hr.salary_components.update":"Edit salary components",
  "settings.read":"View settings","settings.update":"Edit settings","settings.audit_log.read":"View audit log","settings.number_series.read":"View number series",
  "system.org_nodes.read":"View branches","system.tenant.manage":"Manage tenant (billing, plan)",
};

export const PERMISSION_GROUPS: { module: string; label: string; permissions: string[] }[] = [
  { module: "inventory_items", label: "Inventory — Items", permissions: ["inventory.items.read","inventory.items.create","inventory.items.update","inventory.items.delete"] },
  { module: "inventory_suppliers", label: "Inventory — Suppliers", permissions: ["inventory.suppliers.read","inventory.suppliers.create","inventory.suppliers.update","inventory.suppliers.delete"] },
  { module: "inventory_po", label: "Inventory — Purchase Orders", permissions: ["inventory.po.read","inventory.po.create","inventory.po.update","inventory.po.approve","inventory.po.cancel"] },
  { module: "inventory_grn", label: "Inventory — Goods Receipts", permissions: ["inventory.grn.read","inventory.grn.create","inventory.grn.post"] },
  { module: "inventory_stocktake", label: "Inventory — Stocktakes", permissions: ["inventory.stocktake.read","inventory.stocktake.create","inventory.stocktake.post"] },
  { module: "inventory_transfer", label: "Inventory — Transfers", permissions: ["inventory.transfer.read","inventory.transfer.create","inventory.transfer.receive"] },
  { module: "inventory_wastage", label: "Inventory — Wastage", permissions: ["inventory.wastage.read","inventory.wastage.create","inventory.wastage.post"] },
  { module: "inventory_stock", label: "Inventory — Stock Ledger", permissions: ["inventory.stock.read"] },
  { module: "finance_accounts", label: "Finance — Chart of Accounts", permissions: ["finance.accounts.read","finance.accounts.create","finance.accounts.update"] },
  { module: "finance_journal", label: "Finance — Journal Entries", permissions: ["finance.journal.read","finance.journal.create","finance.journal.reverse"] },
  { module: "finance_reports", label: "Finance — Reports", permissions: ["finance.reports.read"] },
  { module: "hr_employees", label: "HR — Employees", permissions: ["hr.employees.read","hr.employees.create","hr.employees.update","hr.employees.terminate"] },
  { module: "hr_attendance", label: "HR — Attendance", permissions: ["hr.attendance.read","hr.attendance.create","hr.attendance.update"] },
  { module: "hr_payroll", label: "HR — Payroll", permissions: ["hr.payroll.read","hr.payroll.run","hr.payroll.approve"] },
  { module: "hr_salary_components", label: "HR — Salary Components", permissions: ["hr.salary_components.read","hr.salary_components.create","hr.salary_components.update"] },
  { module: "settings", label: "Settings", permissions: ["settings.read","settings.update","settings.audit_log.read","settings.number_series.read"] },
  { module: "system", label: "System", permissions: ["system.org_nodes.read","system.tenant.manage"] },
];
