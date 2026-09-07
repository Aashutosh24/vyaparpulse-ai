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

// ─────────────────────────────────────────────────────────────────────────────
// SAKSHAM Economic Intelligence Types
// All Business logic lives in the Economic Engine — LLM only explains results.
// ─────────────────────────────────────────────────────────────────────────────

/** Daily demand data point for a single product */
export interface DailyDemandPoint {
  date: string;
  quantity: number;  // units sold
  revenue: number;
}

/** Output of DemandEngine.calculate() for a single product */
export interface ProductDemandIntel {
  productId: string;
  productName: string;
  unit: string;
  period: number;            // days of history used
  totalSold: number;
  avgDailyDemand: number;    // units per day (simple avg over period)
  week1AvgDemand: number;    // first half of period
  week2AvgDemand: number;    // second half of period
  demandTrendPercent: number; // % change week2 vs week1 (positive = growing)
  demandVelocity: 'rising' | 'stable' | 'falling';
  forecastNextDayDemand: number;  // simple projection
  forecastNextWeekDemand: number; // 7-day projection
  dailyHistory: DailyDemandPoint[];
  dataConfidence: 'high' | 'moderate' | 'low'; // based on days of history
}

/** Output of InventoryEngine.calculate() */
export interface InventoryIntel {
  productId: string;
  currentStock: number;
  unit: string;
  dailyUsageRate: number;     // same as avg daily demand
  daysRemaining: number;      // currentStock / dailyUsageRate
  safetyStockDays: number;
  safetyStockQuantity: number; // safetyStockDays * dailyUsageRate
  isBelowSafetyStock: boolean;
  stockStatus: 'critical' | 'low' | 'adequate' | 'excess';
}

/** Output of StockoutPredictor.predict() */
export interface StockoutPrediction {
  productId: string;
  productName: string;
  unit: string;
  currentStock: number;
  dailyDemand: number;
  daysUntilStockout: number;         // exact decimal
  stockoutDate: string;              // ISO date
  stockoutTimeEstimate: string;      // human readable: "Tomorrow ~4:20 PM"
  isUrgent: boolean;                 // daysUntilStockout <= safetyStockDays
  riskLevel: 'critical' | 'high' | 'medium' | 'low';
}

/** Output of ReorderEngine.calculate() */
export interface ReorderRecommendation {
  productId: string;
  productName: string;
  unit: string;
  recommendedQuantity: number;       // how much to buy
  currentSupplierPrice: number;      // per unit
  estimatedCost: number;             // recommendedQuantity * currentSupplierPrice
  supplierName: string;
  basis: string;                     // plain-language explanation of the calculation
  daysOfStockProvided: number;       // how many days this reorder covers
  priority: 'urgent' | 'soon' | 'routine';
  stockoutPrediction: StockoutPrediction;
  demandIntel: ProductDemandIntel;
}

/** Output of MarginEngine.calculate() */
export interface MarginIntel {
  productId: string;
  productName: string;
  sellingPrice: number;
  currentPurchasePrice: number;
  previousPurchasePrice: number | null;
  currentMarginPercent: number;       // (selling - purchase) / selling * 100
  previousMarginPercent: number | null;
  marginChange: number | null;        // current - previous (negative = margin fell)
  marginTrend: 'improving' | 'stable' | 'declining';
  supplierName: string;
  priceChangeDate: string | null;     // when supplier changed price
}

/** A single entry in the Economic Memory */
export interface EconomicMemoryEntry {
  id: string;
  type: 'demand_change' | 'supplier_price_change' | 'margin_change' | 'revenue_change' | 'payment_change' | 'stockout_risk';
  productId?: string;
  productName?: string;
  headline: string;              // e.g. "Tea demand ↑31%"
  beforeValue: string;           // e.g. "₹290/kg"
  afterValue: string;            // e.g. "₹306/kg"
  changePercent?: number;        // signed percentage change
  date: string;                  // when this change was detected
  evidence: string[];            // list of evidence sources
  significance: 'high' | 'medium' | 'low';
}

/** A supplier invoice extracted from camera/OCR or entered manually */
export interface SupplierInvoiceType {
  id: string;
  supplierName: string;
  invoiceNumber?: string;
  invoiceDate: string;
  lines: {
    productName: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    totalAmount: number;
    productId?: string;  // matched to catalog if possible
  }[];
  grandTotal: number;
  source: 'scanned' | 'manual' | 'demo';
  ocrConfidence?: number;   // 0-1, present only for scanned
  addedAt: string;
}

/** SAKSHAM intent extracted from voice or text query */
export type SakshamIntentKind =
  | 'what_to_buy'
  | 'fastest_selling'
  | 'why_low_stock'
  | 'why_margin_fell'
  | 'which_supplier_raised_price'
  | 'working_capital_needed'
  | 'what_changed'
  | 'stockout_risk'
  | 'revenue_today'
  | 'unknown';

export interface SakshamIntent {
  kind: SakshamIntentKind;
  rawText: string;
  productId?: string;       // if query is about a specific product
  confidence: number;       // 0-1, how sure we are about the intent
  extractedAt: string;
}

/** SAKSHAM response — always backed by Economic Engine data, not LLM math */
export interface SakshamResponse {
  intent: SakshamIntent;
  /** The primary recommendation or answer */
  headline: string;
  /** The key metric (e.g. "8 kg — ₹2,448") */
  keyMetric?: string;
  /** Plain-language explanation from the Local Reasoner */
  explanation: string;
  /** Evidence list supporting the answer */
  evidence: { label: string; value: string }[];
  /** Link to deeper screen if applicable */
  actionRoute?: string;
  actionLabel?: string;
  /** The raw recommendation if one was triggered */
  recommendation?: ReorderRecommendation;
  /** Offline: was this computed locally without network? */
  computedOffline: boolean;
}

/** Working capital estimate for a set of reorder recommendations */
export interface WorkingCapitalEstimate {
  totalRequired: number;       // sum of all recommended reorder costs
  breakdownByProduct: {
    productId: string;
    productName: string;
    quantity: number;
    unit: string;
    pricePerUnit: number;
    totalCost: number;
  }[];
  coversDays: number;          // how many days of stock this buys
  computedAt: string;
}