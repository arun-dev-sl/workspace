import { z } from "zod";

// ── User-provided JSON shapes ──────────────────────────────────────────

export const DividendEntrySchema = z.object({
  companyName: z.string().min(1),
  isin: z.string().min(1),
  exDate: z.string().date(), // ISO yyyy-mm-dd
  shares: z.number().int().positive(),
  dividendPerShare: z.number().positive(),
  amount: z.number().positive(),
});

export type DividendEntry = z.infer<typeof DividendEntrySchema>;

export const DividendReportSchema = z.object({
  reportPeriod: z.object({
    from: z.string().date(),
    to: z.string().date(),
  }),
  totalAmount: z.number(),
  entries: z.array(DividendEntrySchema).min(1),
});

export type DividendReport = z.infer<typeof DividendReportSchema>;

// ── DB row shape (API responses) ───────────────────────────────────────

export const DividendSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  companyName: z.string(),
  isin: z.string(),
  exDate: z.string(),
  shares: z.number().int(),
  dividendPerShare: z.string(),
  amount: z.string(),
  investedValue: z.string().nullable(),
  reportPeriodFrom: z.string().nullable(),
  reportPeriodTo: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Dividend = z.infer<typeof DividendSchema>;

// ── Yield enrichment (PATCH body) ──────────────────────────────────────

export const DividendYieldUpdateSchema = z.object({
  investedValue: z.number().positive(),
});

export type DividendYieldUpdate = z.infer<typeof DividendYieldUpdateSchema>;

// ── Dashboard analytics types ──────────────────────────────────────────

export const YearlyGrowthSchema = z.object({
  currentYear: z.number(),
  currentYearTotal: z.number(),
  previousYearTotal: z.number(),
  growthPercent: z.number(),
  absoluteIncrease: z.number(),
});

export type YearlyGrowth = z.infer<typeof YearlyGrowthSchema>;

export const CompanyDividendSchema = z.object({
  companyName: z.string(),
  isin: z.string(),
  totalAmount: z.number(),
  payoutCount: z.number(),
  avgDividendPerShare: z.number(),
  totalShares: z.number(),
});

export type CompanyDividend = z.infer<typeof CompanyDividendSchema>;

export const MonthlyDividendSchema = z.object({
  month: z.number().int().min(1).max(12),
  monthName: z.string(),
  totalAmount: z.number(),
  entryCount: z.number(),
});

export type MonthlyDividend = z.infer<typeof MonthlyDividendSchema>;

export const YieldAnalysisItemSchema = z.object({
  companyName: z.string(),
  isin: z.string(),
  totalDividend: z.number(),
  investedValue: z.number(),
  yieldPercent: z.number(),
});

export type YieldAnalysisItem = z.infer<typeof YieldAnalysisItemSchema>;

export const RepeatPayoutItemSchema = z.object({
  companyName: z.string(),
  isin: z.string(),
  payoutCount: z.number(),
  totalAmount: z.number(),
  exDates: z.array(z.string()),
});

export type RepeatPayoutItem = z.infer<typeof RepeatPayoutItemSchema>;

export const LifetimeCompanyDividendSchema = z.object({
  companyName: z.string(),
  isin: z.string(),
  totalAmount: z.number(),
});

export type LifetimeCompanyDividend = z.infer<typeof LifetimeCompanyDividendSchema>;

export const DividendDashboardSchema = z.object({
  yearlyGrowth: YearlyGrowthSchema,
  perCompany: z.array(CompanyDividendSchema),
  monthlyTrend: z.array(MonthlyDividendSchema),
  monthlyAverage: z.number(),
  yieldAnalysis: z.array(YieldAnalysisItemSchema),
  repeatPayouts: z.array(RepeatPayoutItemSchema),
  topStocks: z.array(CompanyDividendSchema),
  totalDividendAllTime: z.number(),
  distinctCompanies: z.number(),
  totalPayouts: z.number(),
  lifetimePerCompany: z.array(LifetimeCompanyDividendSchema),
});

export type DividendDashboard = z.infer<typeof DividendDashboardSchema>;
