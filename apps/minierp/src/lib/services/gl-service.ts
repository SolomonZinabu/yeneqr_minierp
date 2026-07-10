// src/lib/services/gl-service.ts
// General Ledger — single source of truth for journal entries + auto-posting.

import { db, getCurrentTenantId } from "@/lib/db";
import { NumberService } from "./number-service";
import { CoaSeeder } from "./coa-seeder";

export interface JournalLineInput {
  accountCode: string;
  debit?: number;
  credit?: number;
  description?: string;
  entityType?: string;
  entityId?: string;
}

export class GlService {
  static async postEntry(input: {
    entryDate?: Date;
    source?: string;
    sourceRefId?: string;
    description?: string;
    lines: JournalLineInput[];
    createdBy?: string;
    postImmediately?: boolean;
  }): Promise<{ entryId: string; entryNumber: string; totalDebit: number; totalCredit: number }> {
    const tenantId = getCurrentTenantId();
    if (!tenantId) throw new Error("GlService.postEntry requires tenant context");

    const totalDebit = input.lines.reduce((s, l) => s + (l.debit ?? 0), 0);
    const totalCredit = input.lines.reduce((s, l) => s + (l.credit ?? 0), 0);
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      throw new Error(`Journal entry not balanced — debit=${totalDebit}, credit=${totalCredit}, diff=${totalDebit - totalCredit}`);
    }

    const entryNumber = await NumberService.next(tenantId, "JV");
    const entryDate = input.entryDate ?? new Date();
    const periodId = `${entryDate.getFullYear()}-${String(entryDate.getMonth() + 1).padStart(2, "0")}`;

    return db.$transaction(async (tx) => {
      const accountCodes = [...new Set(input.lines.map((l) => l.accountCode))];
      const accounts = await tx.ledgerAccount.findMany({ where: { code: { in: accountCodes } }, select: { id: true, code: true, isActive: true } });
      const accountMap = new Map(accounts.map((a) => [a.code, a]));
      for (const code of accountCodes) {
        const acc = accountMap.get(code);
        if (!acc) throw new Error(`Account ${code} does not exist`);
        if (!acc.isActive) throw new Error(`Account ${code} is inactive`);
      }

      const entry = await tx.journalEntry.create({
        data: {
          tenantId, entryNumber, entryDate, periodId,
          source: input.source, sourceRefId: input.sourceRefId, description: input.description,
          status: input.postImmediately === false ? "draft" : "posted",
          totalDebit, totalCredit,
          postedBy: input.createdBy, postedAt: input.postImmediately === false ? null : new Date(),
          createdBy: input.createdBy,
          lines: {
            create: input.lines.map((line, idx) => ({
              tenantId, accountId: accountMap.get(line.accountCode)!.id, lineNo: idx + 1,
              description: line.description, debit: line.debit ?? 0, credit: line.credit ?? 0,
              entityType: line.entityType, entityId: line.entityId,
            })),
          },
        },
        include: { lines: true },
      });

      return { entryId: entry.id, entryNumber: entry.entryNumber, totalDebit, totalCredit };
    });
  }

  static async reverseEntry(entryId: string, reason: string, createdBy?: string) {
    const original = await db.journalEntry.findUniqueOrThrow({ where: { id: entryId }, include: { lines: { include: { account: true } } } });
    if (original.status !== "posted") throw new Error("Only posted entries can be reversed");
    if (original.isReversed) throw new Error("Entry already reversed");
    const reversal = await this.postEntry({
      entryDate: new Date(), source: "reversal", sourceRefId: original.id,
      description: `REVERSAL of ${original.entryNumber}: ${reason}`, createdBy,
      lines: original.lines.map((l) => ({
        accountCode: l.account.code, debit: l.credit, credit: l.debit,
        description: l.description ?? undefined, entityType: l.entityType ?? undefined, entityId: l.entityId ?? undefined,
      })),
    });
    await db.journalEntry.update({ where: { id: entryId }, data: { isReversed: true, reversedByEntryId: reversal.entryId } });
    return { reversalEntryId: reversal.entryId, reversalEntryNumber: reversal.entryNumber };
  }

  static async postGoodsReceipt(grnId: string, createdBy?: string): Promise<string | null> {
    const grn = await db.goodsReceipt.findUniqueOrThrow({ where: { id: grnId }, include: { lines: true, supplier: true } });
    if (grn.journalEntryId) return grn.journalEntryId;
    if (grn.subtotal === 0) return null;
    const lines: JournalLineInput[] = [];
    for (const line of grn.lines) {
      const lineNet = line.quantityReceived * line.unitCost;
      const lineVat = lineNet * line.taxRate;
      lines.push({ accountCode: CoaSeeder.getAccountByRole("inventory_asset"), debit: lineNet, description: `GRN ${grn.grnNumber} — line ${line.lineNo}`, entityType: "inventory_item", entityId: line.itemId });
      if (lineVat > 0) lines.push({ accountCode: CoaSeeder.getAccountByRole("vat_receivable"), debit: lineVat, description: `VAT on GRN ${grn.grnNumber} — line ${line.lineNo}` });
    }
    lines.push({ accountCode: CoaSeeder.getAccountByRole("accounts_payable"), credit: grn.subtotal + grn.taxTotal, description: `AP for GRN ${grn.grnNumber}${grn.supplier ? ` — ${grn.supplier.name}` : ""}`, entityType: "supplier", entityId: grn.supplierId ?? undefined });
    const entry = await this.postEntry({ source: "goods_receipt", sourceRefId: grnId, description: `Goods Receipt ${grn.grnNumber}`, createdBy, lines });
    await db.goodsReceipt.update({ where: { id: grnId }, data: { journalEntryId: entry.entryId } });
    return entry.entryId;
  }

  static async postSale(input: {
    orderId: string;
    paymentMethod: "cash" | "telebirr" | "cbe_birr" | "bank_cbe" | "card" | "credit";
    items: { itemId?: string; name: string; category?: string; qty: number; unitPrice: number; taxRate?: number }[];
    taxRate?: number;
    createdBy?: string;
  }): Promise<string> {
    const defaultTax = input.taxRate ?? 0.15;
    const cashAccount = (() => {
      switch (input.paymentMethod) {
        case "cash": return CoaSeeder.getAccountByRole("cash_on_hand");
        case "telebirr": return CoaSeeder.getAccountByRole("telebirr");
        case "cbe_birr": return CoaSeeder.getAccountByRole("cbe_birr");
        case "bank_cbe": return CoaSeeder.getAccountByRole("bank_cbe");
        default: return CoaSeeder.getAccountByRole("accounts_receivable");
      }
    })();
    const lines: JournalLineInput[] = [];
    let totalGross = 0, totalTax = 0;
    for (const item of input.items) {
      const gross = item.qty * item.unitPrice;
      const taxRate = item.taxRate ?? defaultTax;
      const net = gross / (1 + taxRate);
      const tax = gross - net;
      totalGross += gross; totalTax += tax;
      const revenueAccount = item.category === "beverage" ? CoaSeeder.getAccountByRole("revenue_beverage") : CoaSeeder.getAccountByRole("revenue_food");
      lines.push({ accountCode: revenueAccount, credit: net, description: `Sale ${input.orderId} — ${item.name} × ${item.qty}`, entityType: "inventory_item", entityId: item.itemId });
    }
    lines.push({ accountCode: cashAccount, debit: totalGross, description: `Sale ${input.orderId} — ${input.paymentMethod} received` });
    if (totalTax > 0) lines.push({ accountCode: CoaSeeder.getAccountByRole("vat_payable"), credit: totalTax, description: `VAT on sale ${input.orderId}` });
    const entry = await this.postEntry({ source: "yeneqr_webhook", sourceRefId: input.orderId, description: `Sale ${input.orderId}`, createdBy: input.createdBy, lines });
    return entry.entryId;
  }

  static async postWastage(wastageId: string, createdBy?: string): Promise<string | null> {
    const wastage = await db.wastage.findUniqueOrThrow({ where: { id: wastageId }, include: { lines: true } });
    if (wastage.journalEntryId) return wastage.journalEntryId;
    if (wastage.totalValue === 0) return null;
    const lines: JournalLineInput[] = wastage.lines.map((l) => ({
      accountCode: CoaSeeder.getAccountByRole("inventory_wastage"), debit: l.lineTotal,
      description: `Wastage ${wastage.wastageNumber} — line ${l.lineNo}`, entityType: "inventory_item", entityId: l.itemId,
    }));
    lines.push({ accountCode: CoaSeeder.getAccountByRole("inventory_asset"), credit: wastage.totalValue, description: `Inventory relieved for wastage ${wastage.wastageNumber}` });
    const entry = await this.postEntry({ source: "wastage", sourceRefId: wastageId, description: `Wastage ${wastage.wastageNumber} (${wastage.wastageType})`, createdBy, lines });
    await db.wastage.update({ where: { id: wastageId }, data: { journalEntryId: entry.entryId } });
    return entry.entryId;
  }

  static async postStocktakeVariance(stocktakeId: string, createdBy?: string): Promise<string | null> {
    const stocktake = await db.stocktake.findUniqueOrThrow({ where: { id: stocktakeId }, include: { lines: true } });
    const posTotal = stocktake.lines.filter((l) => l.variance > 0).reduce((s, l) => s + l.varianceValue, 0);
    const negTotal = Math.abs(stocktake.lines.filter((l) => l.variance < 0).reduce((s, l) => s + l.varianceValue, 0));
    if (posTotal === 0 && negTotal === 0) return null;
    const lines: JournalLineInput[] = [];
    if (posTotal > 0) {
      lines.push({ accountCode: CoaSeeder.getAccountByRole("inventory_asset"), debit: posTotal, description: `Stocktake ${stocktake.stocktakeNumber} — positive variance` });
      lines.push({ accountCode: "4100", credit: posTotal, description: `Stocktake ${stocktake.stocktakeNumber} — variance income` });
    }
    if (negTotal > 0) {
      lines.push({ accountCode: CoaSeeder.getAccountByRole("inventory_wastage"), debit: negTotal, description: `Stocktake ${stocktake.stocktakeNumber} — negative variance` });
      lines.push({ accountCode: CoaSeeder.getAccountByRole("inventory_asset"), credit: negTotal, description: `Stocktake ${stocktake.stocktakeNumber} — inventory relief` });
    }
    return (await this.postEntry({ source: "stocktake", sourceRefId: stocktakeId, description: `Stocktake ${stocktake.stocktakeNumber} variance posting`, createdBy, lines })).entryId;
  }

  static async postPayrollRun(payrollRunId: string, createdBy?: string): Promise<string | null> {
    const run = await db.payrollRun.findUniqueOrThrow({ where: { id: payrollRunId }, include: { items: { include: { employee: true } } } });
    if (run.journalEntryId) return run.journalEntryId;
    if (run.totalGross === 0) return null;
    const lines: JournalLineInput[] = [];
    const byDept = new Map<string, number>();
    for (const item of run.items) {
      const dept = item.employee.department ?? "Administrative";
      byDept.set(dept, (byDept.get(dept) ?? 0) + item.grossEarnings);
    }
    for (const [dept, amount] of byDept) {
      const accCode = (() => {
        switch (dept.toLowerCase()) {
          case "kitchen": return CoaSeeder.getAccountByRole("salaries_kitchen");
          case "service": return CoaSeeder.getAccountByRole("salaries_service");
          case "management": return CoaSeeder.getAccountByRole("salaries_management");
          default: return "8040";
        }
      })();
      lines.push({ accountCode: accCode, debit: amount, description: `Payroll ${run.period} — ${dept} salaries` });
    }
    if (run.totalEmployerContribution > 0) lines.push({ accountCode: CoaSeeder.getAccountByRole("pension_expense_employer"), debit: run.totalEmployerContribution, description: `Pension employer contribution — ${run.period}` });
    if (run.totalTax > 0) lines.push({ accountCode: CoaSeeder.getAccountByRole("pit_payable"), credit: run.totalTax, description: `PIT withheld — ${run.period}` });
    if (run.totalPension > 0) lines.push({ accountCode: CoaSeeder.getAccountByRole("pension_payable"), credit: run.totalPension, description: `Pension contributions (EE + ER) — ${run.period}` });
    if (run.totalNet > 0) lines.push({ accountCode: CoaSeeder.getAccountByRole("salary_payable"), credit: run.totalNet, description: `Net salary payable — ${run.period}` });
    const entry = await this.postEntry({ source: "payroll", sourceRefId: payrollRunId, description: `Payroll ${run.period} — ${run.runNumber}`, createdBy, lines });
    await db.payrollRun.update({ where: { id: payrollRunId }, data: { journalEntryId: entry.entryId } });
    return entry.entryId;
  }

  // ── REPORTING ──
  static async trialBalance(asOf?: Date) {
    const date = asOf ? new Date(asOf) : new Date();
    if (asOf) date.setHours(23, 59, 59, 999);
    const lines = await db.journalLine.findMany({
      where: { journalEntry: { status: "posted", isReversed: false, entryDate: { lte: date } } },
      include: { account: true },
    });
    const byAccount = new Map<string, { name: string; type: string; debit: number; credit: number }>();
    for (const line of lines) {
      const cur = byAccount.get(line.account.code) ?? { name: line.account.name, type: line.account.type, debit: 0, credit: 0 };
      cur.debit += line.debit; cur.credit += line.credit;
      byAccount.set(line.account.code, cur);
    }
    return Array.from(byAccount.entries())
      .map(([code, v]) => ({ accountCode: code, accountName: v.name, accountType: v.type, debitBalance: v.debit > v.credit ? v.debit - v.credit : 0, creditBalance: v.credit > v.debit ? v.credit - v.debit : 0 }))
      .sort((a, b) => a.accountCode.localeCompare(b.accountCode));
  }

  static async profitAndLoss(from: Date, to: Date) {
    const fromDate = new Date(from); fromDate.setHours(0, 0, 0, 0);
    const toDate = new Date(to); toDate.setHours(23, 59, 59, 999);
    const lines = await db.journalLine.findMany({
      where: { journalEntry: { status: "posted", isReversed: false, entryDate: { gte: fromDate, lte: toDate } } },
      include: { account: true },
    });
    const byAccount = new Map<string, { code: string; name: string; type: string; debit: number; credit: number }>();
    for (const line of lines) {
      const key = line.account.code;
      const cur = byAccount.get(key) ?? { code: line.account.code, name: line.account.name, type: line.account.type, debit: 0, credit: 0 };
      cur.debit += line.debit; cur.credit += line.credit;
      byAccount.set(key, cur);
    }
    const rev = Array.from(byAccount.values()).filter((a) => a.type === "revenue");
    const cogs = Array.from(byAccount.values()).filter((a) => a.code.startsWith("50"));
    const opex = Array.from(byAccount.values()).filter((a) => a.code.startsWith("6") && !a.code.startsWith("68"));
    const payroll = Array.from(byAccount.values()).filter((a) => a.code.startsWith("8"));
    const revTotal = rev.reduce((s, a) => s + (a.credit - a.debit), 0);
    const cogsTotal = cogs.reduce((s, a) => s + (a.debit - a.credit), 0);
    const opexTotal = opex.reduce((s, a) => s + (a.debit - a.credit), 0);
    const payrollTotal = payroll.reduce((s, a) => s + (a.debit - a.credit), 0);
    return {
      revenue: rev.map((a) => ({ code: a.code, name: a.name, amount: a.credit - a.debit })).filter((a) => a.amount !== 0),
      cogs: cogs.map((a) => ({ code: a.code, name: a.name, amount: a.debit - a.credit })).filter((a) => a.amount !== 0),
      grossProfit: revTotal - cogsTotal,
      operatingExpenses: opex.map((a) => ({ code: a.code, name: a.name, amount: a.debit - a.credit })).filter((a) => a.amount !== 0),
      payrollExpenses: payroll.map((a) => ({ code: a.code, name: a.name, amount: a.debit - a.credit })).filter((a) => a.amount !== 0),
      totalRevenue: revTotal, totalCogs: cogsTotal, totalOperating: opexTotal, totalPayroll: payrollTotal,
      netProfit: revTotal - cogsTotal - opexTotal - payrollTotal,
    };
  }
}
