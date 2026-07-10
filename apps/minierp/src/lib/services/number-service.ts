// src/lib/services/number-service.ts
// Gap-free document number series (PO/GRN/JV/STK/TRF/WST/PAY/EMP).

import { db, runWithTenant } from "@/lib/db";

export const DEFAULT_NUMBER_SERIES = [
  { code: "PO",  name: "Purchase Order",    prefix: "PO-",  padding: 5, documentType: "purchase_order" },
  { code: "GRN", name: "Goods Receipt",     prefix: "GRN-", padding: 5, documentType: "goods_receipt" },
  { code: "JV",  name: "Journal Entry",     prefix: "JV-",  padding: 5, documentType: "journal_entry" },
  { code: "STK", name: "Stocktake",         prefix: "STK-", padding: 5, documentType: "stocktake" },
  { code: "TRF", name: "Stock Transfer",    prefix: "TRF-", padding: 5, documentType: "stock_transfer" },
  { code: "WST", name: "Wastage",           prefix: "WST-", padding: 5, documentType: "wastage" },
  { code: "PAY", name: "Payroll Run",       prefix: "PAY-", padding: 5, documentType: "payroll_run" },
  { code: "EMP", name: "Employee Number",   prefix: "EMP-", padding: 4, documentType: "employee" },
];

export class NumberService {
  static async next(tenantId: string, code: string, fiscalYear?: number): Promise<string> {
    const year = fiscalYear ?? new Date().getFullYear();
    return runWithTenant(tenantId, async () => {
      return db.$transaction(async (tx) => {
        let series = await tx.numberSeries.findUnique({ where: { tenantId_code: { tenantId, code } } });
        if (!series) {
          const def = DEFAULT_NUMBER_SERIES.find((d) => d.code === code);
          if (!def) throw new Error(`Unknown number series: ${code}`);
          series = await tx.numberSeries.create({
            data: { tenantId, code: def.code, name: def.name, prefix: def.prefix, padding: def.padding, nextValue: 1, documentType: def.documentType },
          });
        }
        let yearSeq = await tx.numberSequenceValue.findUnique({
          where: { tenantId_seriesId_fiscalYear: { tenantId, seriesId: series.id, fiscalYear: year } },
        });
        if (!yearSeq) {
          yearSeq = await tx.numberSequenceValue.create({
            data: { tenantId, seriesId: series.id, fiscalYear: year, nextValue: series.nextValue },
          });
        }
        const currentValue = yearSeq.nextValue;
        const formatted = `${series.prefix}${String(currentValue).padStart(series.padding, "0")}`;
        await tx.numberSequenceValue.update({ where: { id: yearSeq.id }, data: { nextValue: currentValue + 1 } });
        await tx.numberSeries.update({ where: { id: series.id }, data: { nextValue: currentValue + 1 } });
        return formatted;
      });
    });
  }

  static async peek(tenantId: string, code: string, fiscalYear?: number): Promise<string> {
    const year = fiscalYear ?? new Date().getFullYear();
    return runWithTenant(tenantId, async () => {
      const series = await db.numberSeries.findUnique({ where: { tenantId_code: { tenantId, code } } });
      if (!series) {
        const def = DEFAULT_NUMBER_SERIES.find((d) => d.code === code);
        if (!def) throw new Error(`Unknown number series: ${code}`);
        return `${def.prefix}${String(1).padStart(def.padding, "0")}`;
      }
      const yearSeq = await db.numberSequenceValue.findUnique({
        where: { tenantId_seriesId_fiscalYear: { tenantId, seriesId: series.id, fiscalYear: year } },
      });
      const nextValue = yearSeq?.nextValue ?? series.nextValue;
      return `${series.prefix}${String(nextValue).padStart(series.padding, "0")}`;
    });
  }

  static async seedDefaults(tenantId: string): Promise<void> {
    return runWithTenant(tenantId, async () => {
      for (const def of DEFAULT_NUMBER_SERIES) {
        await db.numberSeries.upsert({
          where: { tenantId_code: { tenantId, code: def.code } },
          create: { tenantId, code: def.code, name: def.name, prefix: def.prefix, padding: def.padding, nextValue: 1, documentType: def.documentType },
          update: {},
        });
      }
    });
  }
}
