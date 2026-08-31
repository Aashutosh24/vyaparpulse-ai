export type PaymentStatus = 'paid' | 'partial' | 'pending' | 'needsReview';

export type PaymentMethod = 'upi' | 'cash' | 'credit';

export interface LineItem {
  name: string;
  qty: number;
  unitPrice: number;
}

export interface Transaction {
  id: string;
  ref: string;
  customerId: string;
  name: string;
  initials: string;
  items: LineItem[];
  amount: number;
  receivedAmount: number;
  time: string;
  dayLabel: 'Today' | 'Yesterday';
  status: PaymentStatus;
  method: PaymentMethod;
  syncedOffline?: boolean;
}

/** Identity + everything that happened before the visible ledger window. */
export interface Customer {
  id: string;
  name: string;
  initials: string;
  phone: string;
  since: string;
  /** Settled business recorded before the ledger window shown in the app. */
  priorPurchases: number;
  priorTransactions: number;
}

/** A customer with balances derived from the live ledger. Never hand-written. */
export interface CustomerAccount extends Customer {
  totalPurchases: number;
  paid: number;
  pending: number;
  transactionCount: number;
  lastPurchase: string;
}

export type PaymentState = 'matched' | 'needsReview';

export interface MatchCandidate {
  txnId: string;
  name: string;
  amount: number;
  time: string;
  /** Plain-language reason this sale is a candidate — no fake percentages. */
  reason: string;
}

export interface PaymentEvent {
  id: string;
  amount: number;
  senderName: string;
  handle: string;
  time: string;
  state: PaymentState;
  matchedRef?: string;
  candidates?: MatchCandidate[];
  /** True when this prototype generated the event rather than a real UPI feed. */
  simulated?: boolean;
}

export type FactorTone = 'strong' | 'positive' | 'stable' | 'watch';

export interface HealthFactor {
  label: string;
  value: string;
  tone: FactorTone;
  /** Plain-language reason this factor reads the way it does. */
  detail: string;
  /** What it does to the score, in merchant words. */
  impact: string;
}

export interface BusinessHealth {
  score: number;
  previousScore: number;
  delta: number;
  band: string;
  factors: HealthFactor[];
  summary: string;
  why: string;
  action: string;
}

export type InsightKind = 'change' | 'watch' | 'pattern' | 'forecast';

/**
 * Every insight follows the signature VyaparPulse pattern:
 * what happened (headline + metric), why, and what to do.
 */
export interface Insight {
  id: string;
  kind: InsightKind;
  headline: string;
  metric: string;
  why: string;
  action: string;
  /** Higher wins when the app picks what to surface on Home. */
  priority: number;
}

export interface TrendPoint {
  label: string;
  value: number;
}

export interface ForecastPoint {
  label: string;
  expected: number;
  low: number;
  high: number;
}

export interface ForecastSummary {
  low: number;
  expected: number;
  high: number;
  confidence: 'High' | 'Moderate' | 'Low';
  confidenceReason: string;
  basis: string;
  action: string;
  series: ForecastPoint[];
}

export interface WeekMetrics {
  revenue: number;
  lastWeekRevenue: number;
  growthPercent: number;
  collectionRate: number;
  outstanding: number;
  outstandingCustomers: number;
  transactionCount: number;
  strongestDay: string;
  strongestDayValue: number;
  variability: number;
  daysWithSales: number;
  reading: string;
}

export interface TodayTotals {
  sales: number;
  received: number;
  pending: number;
  saleCount: number;
  collectionRate: number;
  changeVsYesterday: number;
}

/** Before → after figures for a single action, shown as transient feedback. */
export interface ChangeImpact {
  reason: string;
  saleRef?: string;
  rows: {label: string;before: string;after: string;}[];
}

export interface ProfileFactor {
  label: string;
  value: string;
  tone: FactorTone;
}

export interface ParsedSaleItem {
  name: string;
  qty: number;
  unitPrice: number;
}

export interface ParsedSale {
  transcript: string;
  items: ParsedSaleItem[];
  total: number;
  customerName: string;
  customerAmbiguous: boolean;
  customerOptions: string[];
  confidence: 'high' | 'medium' | 'low';
}