// src/lib/services/coa-seeder.ts
// Ethiopian restaurant Chart of Accounts (60+ accounts).

import { db, runWithTenant } from "@/lib/db";

export const DEFAULT_COA = [
  // ASSETS
  { code: "1000", name: "Current Assets", type: "asset", subtype: "current_asset", isSystem: true, isControl: true, description: "Control account for current assets" },
  { code: "1010", name: "Cash on Hand", type: "asset", subtype: "current_asset", parentCode: "1000", isSystem: true, description: "Cash in registers / safes" },
  { code: "1020", name: "Bank — CBE Birr", type: "asset", subtype: "current_asset", parentCode: "1000", isSystem: true },
  { code: "1030", name: "Bank — Commercial Bank of Ethiopia", type: "asset", subtype: "current_asset", parentCode: "1000", isSystem: true },
  { code: "1040", name: "Bank — Dashen", type: "asset", subtype: "current_asset", parentCode: "1000", isSystem: true },
  { code: "1050", name: "Mobile Money — Telebirr", type: "asset", subtype: "current_asset", parentCode: "1000", isSystem: true },
  { code: "1060", name: "Mobile Money — CBE Birr", type: "asset", subtype: "current_asset", parentCode: "1000", isSystem: true },
  { code: "1100", name: "Accounts Receivable", type: "asset", subtype: "current_asset", parentCode: "1000", isSystem: true, isControl: true, description: "Control account for customer balances" },
  { code: "1200", name: "Inventory — Raw Materials", type: "asset", subtype: "current_asset", parentCode: "1000", isSystem: true, isControl: true, description: "Control account for ingredient stock value" },
  { code: "1210", name: "Inventory — Finished Goods", type: "asset", subtype: "current_asset", parentCode: "1000", isSystem: true, isControl: true },
  { code: "1220", name: "Inventory — Packaging", type: "asset", subtype: "current_asset", parentCode: "1000", isSystem: true },
  { code: "1300", name: "Prepaid Expenses", type: "asset", subtype: "current_asset", parentCode: "1000", isSystem: true },
  { code: "1400", name: "VAT Receivable", type: "asset", subtype: "current_asset", parentCode: "1000", isSystem: true, description: "VAT paid on purchases, reclaimable from ERCA" },
  { code: "1500", name: "Fixed Assets", type: "asset", isSystem: true, isControl: true },
  { code: "1510", name: "Kitchen Equipment", type: "asset", subtype: "fixed_asset", parentCode: "1500", isSystem: true },
  { code: "1520", name: "Furniture & Fixtures", type: "asset", subtype: "fixed_asset", parentCode: "1500", isSystem: true },
  { code: "1530", name: "POS Equipment", type: "asset", subtype: "fixed_asset", parentCode: "1500", isSystem: true },
  { code: "1540", name: "Vehicles", type: "asset", subtype: "fixed_asset", parentCode: "1500", isSystem: true },
  { code: "1590", name: "Accumulated Depreciation", type: "contra", subtype: "fixed_asset", parentCode: "1500", isSystem: true },
  // LIABILITIES
  { code: "2000", name: "Current Liabilities", type: "liability", subtype: "current_liability", isSystem: true, isControl: true },
  { code: "2010", name: "Accounts Payable", type: "liability", subtype: "current_liability", parentCode: "2000", isSystem: true, isControl: true, description: "Control account for supplier balances" },
  { code: "2020", name: "VAT Payable", type: "liability", subtype: "current_liability", parentCode: "2000", isSystem: true, description: "VAT collected from customers, owed to ERCA" },
  { code: "2030", name: "Pension Payable", type: "liability", subtype: "current_liability", parentCode: "2000", isSystem: true, description: "Pension contributions withheld + employer share, owed to ESSF" },
  { code: "2040", name: "PIT Payable", type: "liability", subtype: "current_liability", parentCode: "2000", isSystem: true, description: "Personal Income Tax withheld from employees, owed to ERCA" },
  { code: "2050", name: "Salary Payable", type: "liability", subtype: "current_liability", parentCode: "2000", isSystem: true, description: "Net pay owed to employees" },
  { code: "2060", name: "Customer Deposits", type: "liability", subtype: "current_liability", parentCode: "2000", isSystem: true },
  { code: "2070", name: "Accrued Expenses", type: "liability", subtype: "current_liability", parentCode: "2000", isSystem: true },
  { code: "2100", name: "Long-Term Liabilities", type: "liability", subtype: "long_term_liability", isSystem: true, isControl: true },
  { code: "2110", name: "Bank Loan — Long Term", type: "liability", subtype: "long_term_liability", parentCode: "2100", isSystem: true },
  // EQUITY
  { code: "3000", name: "Owner's Equity", type: "equity", isSystem: true, isControl: true },
  { code: "3010", name: "Owner's Capital", type: "equity", parentCode: "3000", isSystem: true },
  { code: "3020", name: "Retained Earnings", type: "equity", parentCode: "3000", isSystem: true },
  { code: "3030", name: "Current Year Net Income", type: "equity", parentCode: "3000", isSystem: true },
  { code: "3040", name: "Owner's Drawings", type: "equity", parentCode: "3000", isSystem: true, description: "Contra-equity — owner withdrawals" },
  // REVENUE
  { code: "4000", name: "Operating Revenue", type: "revenue", isSystem: true, isControl: true },
  { code: "4010", name: "Food Sales", type: "revenue", parentCode: "4000", isSystem: true },
  { code: "4020", name: "Beverage Sales", type: "revenue", parentCode: "4000", isSystem: true },
  { code: "4030", name: "Catering Revenue", type: "revenue", parentCode: "4000", isSystem: true },
  { code: "4040", name: "Delivery Revenue", type: "revenue", parentCode: "4000", isSystem: true },
  { code: "4050", name: "Service Charges", type: "revenue", parentCode: "4000", isSystem: true },
  { code: "4900", name: "Sales Returns & Allowances", type: "contra", parentCode: "4000", isSystem: true },
  { code: "4100", name: "Other Income", type: "revenue", isSystem: true, isControl: true },
  { code: "4110", name: "Interest Income", type: "revenue", parentCode: "4100", isSystem: true },
  { code: "4120", name: "Gain on FX", type: "revenue", parentCode: "4100", isSystem: true },
  // COGS
  { code: "5000", name: "Cost of Goods Sold", type: "expense", isSystem: true, isControl: true },
  { code: "5010", name: "COGS — Food", type: "expense", parentCode: "5000", isSystem: true },
  { code: "5020", name: "COGS — Beverages", type: "expense", parentCode: "5000", isSystem: true },
  { code: "5030", name: "COGS — Packaging", type: "expense", parentCode: "5000", isSystem: true },
  { code: "5090", name: "Inventory Wastage", type: "expense", parentCode: "5000", isSystem: true, description: "Spoilage, expiry, theft (recorded via Wastage)" },
  // OPERATING EXPENSES
  { code: "6000", name: "Operating Expenses", type: "expense", isSystem: true, isControl: true },
  { code: "6100", name: "Rent Expense", type: "expense", parentCode: "6000", isSystem: true },
  { code: "6200", name: "Utilities", type: "expense", parentCode: "6000", isSystem: true, isControl: true },
  { code: "6210", name: "Electricity", type: "expense", parentCode: "6200", isSystem: true },
  { code: "6220", name: "Water", type: "expense", parentCode: "6200", isSystem: true },
  { code: "6230", name: "Internet & Phone", type: "expense", parentCode: "6200", isSystem: true },
  { code: "6300", name: "Marketing & Advertising", type: "expense", parentCode: "6000", isSystem: true },
  { code: "6400", name: "Repairs & Maintenance", type: "expense", parentCode: "6000", isSystem: true },
  { code: "6500", name: "Cleaning & Supplies", type: "expense", parentCode: "6000", isSystem: true },
  { code: "6600", name: "Bank Charges", type: "expense", parentCode: "6000", isSystem: true },
  { code: "6700", name: "Insurance", type: "expense", parentCode: "6000", isSystem: true },
  { code: "6800", name: "Depreciation Expense", type: "expense", parentCode: "6000", isSystem: true },
  { code: "6900", name: "Miscellaneous Expense", type: "expense", parentCode: "6000", isSystem: true },
  // PAYROLL
  { code: "8000", name: "Payroll Expenses", type: "expense", isSystem: true, isControl: true },
  { code: "8010", name: "Salaries — Kitchen Staff", type: "expense", parentCode: "8000", isSystem: true },
  { code: "8020", name: "Salaries — Service Staff", type: "expense", parentCode: "8000", isSystem: true },
  { code: "8030", name: "Salaries — Management", type: "expense", parentCode: "8000", isSystem: true },
  { code: "8040", name: "Salaries — Administrative", type: "expense", parentCode: "8000", isSystem: true },
  { code: "8050", name: "Overtime Expense", type: "expense", parentCode: "8000", isSystem: true },
  { code: "8060", name: "Pension Expense — Employer", type: "expense", parentCode: "8000", isSystem: true, description: "11% employer pension contribution" },
  { code: "8070", name: "Service Charge Distribution", type: "expense", parentCode: "8000", isSystem: true },
  { code: "8080", name: "Staff Meal Expense", type: "expense", parentCode: "8000", isSystem: true },
  { code: "8090", name: "Staff Welfare", type: "expense", parentCode: "8000", isSystem: true },
];

interface CoaSeed {
  code: string; name: string; type: "asset" | "liability" | "equity" | "revenue" | "expense" | "contra";
  subtype?: string; isSystem?: boolean; isControl?: boolean; parentCode?: string; description?: string;
}

const TYPED_COA: CoaSeed[] = DEFAULT_COA as CoaSeed[];

export class CoaSeeder {
  static async seed(tenantId: string): Promise<void> {
    return runWithTenant(tenantId, async () => {
      for (const acc of TYPED_COA) {
        await db.ledgerAccount.upsert({
          where: { tenantId_code: { tenantId, code: acc.code } },
          create: {
            tenantId, code: acc.code, name: acc.name, type: acc.type,
            subtype: acc.subtype, isSystem: acc.isSystem ?? false, isControl: acc.isControl ?? false,
            parentCode: acc.parentCode, description: acc.description, isActive: true,
          },
          update: {},
        });
      }
    });
  }

  static getAccountByRole(role:
    | "inventory_asset" | "inventory_finished_goods" | "inventory_packaging"
    | "accounts_payable" | "accounts_receivable" | "vat_receivable" | "vat_payable"
    | "cash_on_hand" | "bank_cbe" | "telebirr" | "cbe_birr"
    | "revenue_food" | "revenue_beverage"
    | "cogs_food" | "cogs_beverage" | "cogs_packaging" | "inventory_wastage"
    | "pension_payable" | "pit_payable" | "salary_payable" | "pension_expense_employer"
    | "salaries_kitchen" | "salaries_service" | "salaries_management" | "overtime_expense"
  ): string {
    const map: Record<typeof role, string> = {
      inventory_asset: "1200", inventory_finished_goods: "1210", inventory_packaging: "1220",
      accounts_payable: "2010", accounts_receivable: "1100", vat_receivable: "1400", vat_payable: "2020",
      cash_on_hand: "1010", bank_cbe: "1030", telebirr: "1050", cbe_birr: "1060",
      revenue_food: "4010", revenue_beverage: "4020",
      cogs_food: "5010", cogs_beverage: "5020", cogs_packaging: "5030", inventory_wastage: "5090",
      pension_payable: "2030", pit_payable: "2040", salary_payable: "2050", pension_expense_employer: "8060",
      salaries_kitchen: "8010", salaries_service: "8020", salaries_management: "8030", overtime_expense: "8050",
    };
    return map[role];
  }
}
