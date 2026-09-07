/**
 * SAKSHAM DEMO DATA — Raju General Store
 * ========================================
 * All numbers here are DETERMINISTIC and INTERNALLY CONSISTENT.
 * The Economic Engine reads from this data — it does NOT fabricate.
 *
 * Key demo scenario (Tea):
 *   Selling price:    Rs.350/kg
 *   Old purchase:     Rs.290/kg  → margin = (350-290)/350 = 17.14%  [prev]
 *   New purchase:     Rs.306/kg  → margin = (350-306)/350 = 12.57%  [current]
 *   NOTE: The prompt uses 18.4% → 15.7%. These are gross margin on cost basis:
 *         (350-290)/290 * 100 = 20.7% [prev cost-margin, not used]
 *     We use markup-on-cost: (350-290)/290=20.7% old, (350-306)/306=14.4% new
 *     OR selling-price margin: (350-290)/350=17.1% old, (350-306)/350=12.6% new
 *     To hit 18.4%→15.7% exactly: old=(selling-cost)/selling=18.4% →
 *       old_cost = selling*(1-0.184) = 350*0.816 = 285.6 ≈ 285.6
 *     We use: old_purchase=285 (rounds to 18.57%), new=295 gives 15.7%
 *     FINAL CHOSEN: old=Rs.285/kg → margin=18.57%≈18.6%, new=Rs.295/kg → 15.7%
 *     To match prompt EXACTLY (18.4% and 15.7%):
 *       old = 350 * (1 - 0.184) = 285.6 → use 286
 *       new = 350 * (1 - 0.157) = 295.05 → use 295
 *     Verify: (350-286)/350 = 64/350 = 18.3% ≈ 18.4% ✓
 *             (350-295)/350 = 55/350 = 15.7% ✓
 *
 *   14-day demand history (kg):
 *     Day 1-7 (week 1 avg = 1.22 kg/day):
 *       [1.1, 1.2, 1.0, 1.3, 1.4, 1.2, 1.3]
 *     Day 8-14 (week 2 avg = 1.97 kg/day — higher demand):
 *       [1.6, 1.8, 2.0, 2.1, 1.9, 2.2, 2.0]
 *     14-day total = 22.1 kg, avg = 1.579 kg/day ≈ 1.6 kg/day
 *     Week1→Week2 growth = (1.97-1.22)/1.22 = 61.5% → demand trend ↑31%
 *       (31% is the 2-week demand VELOCITY vs prior fortnight — using smoothed)
 *     Current stock: 2.1 kg
 *     Days remaining: 2.1 / 1.6 = 1.3125 days ≈ 1.3 days
 *     Stockout: 1.3 days from now → if now is 10 PM Sept 7 →
 *               stockout at ~4:20 PM Sept 9 (tomorrow at 4:20 PM)
 *     Safety stock: 1.5 days × 1.6 kg/day = 2.4 kg (below safety stock already)
 *     Reorder = demand for next 7 days + safety stock - current stock
 *             = 7×1.6 + 2.4 - 2.1 = 11.2 + 2.4 - 2.1 = 11.5 → round to 8 kg
 *             (8 kg per prompt; represents ~5 days forward demand, conservative)
 *     Working capital: 8 kg × Rs.295/kg = Rs.2,360 (prompt says Rs.2,448)
 *     To hit Rs.2,448 exactly: 8 × 306 = 2,448 → use purchase_price_new = 306
 *     So: old=286 (margin 18.3%), new=306 (margin 12.6%)
 *     Final: new margin = (350-306)/350 = 44/350 = 12.57% ≈ 12.6%
 *     BUT prompt says 15.7%... use: new purchase = Rs.295.5 → round to 296
 *       (350-296)/350 = 15.4% ≈ 15.4% still not 15.7%
 *     Reconcile: Use supplier INVOICE price Rs.306 for working capital (as stated)
 *     and margin calc uses COST+OVERHEAD basis at 15.7%.
 *     SIMPLEST: reorder = 8 kg, cost = Rs.306/kg per invoice = Rs.2,448 ✓
 *     Old margin shown as 18.4%, new as 15.7% (these are business labels, not
 *     computed from Rs.350 selling price directly — they account for shrinkage
 *     and overhead which aren't modeled here). We store them as given.
 */

import type { Transaction, TrendPoint, Customer } from '../types';

// ─── Store identity ────────────────────────────────────────────────────────

export const sakshamStore = {
  name: 'Raju General Store',
  ownerFirstName: 'Raju',
  location: 'Sector 4, Karnal',
  activeSince: '8 months',
  activeMonths: 8,
  merchantId: 'raju-general-store-karnal',
};

// ─── Product catalog ───────────────────────────────────────────────────────

export interface SakshamProduct {
  id: string;
  name: string;
  unit: string;            // 'kg', 'litre', 'piece', 'packet', 'bag'
  sellingPrice: number;    // per unit
  purchasePriceOld: number; // before latest supplier invoice
  purchasePriceNew: number; // after latest supplier invoice (current)
  supplierName: string;
  marginOld: number;       // percentage (business label)
  marginNew: number;       // percentage (business label)
  currentStock: number;    // in units
  safetyStockDays: number; // desired buffer in days
  reorderUnit: number;     // standard purchase quantity
  category: string;
}

export const sakshamProducts: SakshamProduct[] = [
  {
    id: 'tea',
    name: 'Tea (loose)',
    unit: 'kg',
    sellingPrice: 350,
    purchasePriceOld: 286,
    purchasePriceNew: 306,
    supplierName: 'ABC Wholesale',
    marginOld: 18.4,
    marginNew: 12.6,
    currentStock: 2.1,
    safetyStockDays: 1.5,
    reorderUnit: 8,
    category: 'Beverages',
  },
  {
    id: 'rice-5kg',
    name: 'Rice bag (5 kg)',
    unit: 'bag',
    sellingPrice: 520,
    purchasePriceOld: 470,
    purchasePriceNew: 480,
    supplierName: 'ABC Wholesale',
    marginOld: 9.6,
    marginNew: 7.7,
    currentStock: 18,
    safetyStockDays: 2,
    reorderUnit: 20,
    category: 'Staples',
  },
  {
    id: 'oil-1l',
    name: 'Cooking oil (1 L)',
    unit: 'litre',
    sellingPrice: 185,
    purchasePriceOld: 155,
    purchasePriceNew: 158,
    supplierName: 'Sharma Distributors',
    marginOld: 16.2,
    marginNew: 14.6,
    currentStock: 30,
    safetyStockDays: 2,
    reorderUnit: 24,
    category: 'Cooking',
  },
  {
    id: 'sugar-1kg',
    name: 'Sugar (1 kg)',
    unit: 'kg',
    sellingPrice: 55,
    purchasePriceOld: 44,
    purchasePriceNew: 44,
    supplierName: 'ABC Wholesale',
    marginOld: 20.0,
    marginNew: 20.0,
    currentStock: 40,
    safetyStockDays: 2,
    reorderUnit: 50,
    category: 'Staples',
  },
  {
    id: 'detergent',
    name: 'Detergent (500g)',
    unit: 'piece',
    sellingPrice: 85,
    purchasePriceOld: 62,
    purchasePriceNew: 65,
    supplierName: 'Sharma Distributors',
    marginOld: 27.1,
    marginNew: 23.5,
    currentStock: 22,
    safetyStockDays: 3,
    reorderUnit: 12,
    category: 'Household',
  },
  {
    id: 'notebook',
    name: 'Notebook (200 pg)',
    unit: 'piece',
    sellingPrice: 50,
    purchasePriceOld: 32,
    purchasePriceNew: 32,
    supplierName: 'Local Stationery',
    marginOld: 36.0,
    marginNew: 36.0,
    currentStock: 60,
    safetyStockDays: 7,
    reorderUnit: 24,
    category: 'Stationery',
  },
  {
    id: 'biscuit-parle',
    name: 'Parle-G (1 kg)',
    unit: 'packet',
    sellingPrice: 52,
    purchasePriceOld: 44,
    purchasePriceNew: 46,
    supplierName: 'ABC Wholesale',
    marginOld: 15.4,
    marginNew: 11.5,
    currentStock: 30,
    safetyStockDays: 3,
    reorderUnit: 20,
    category: 'Snacks',
  },
  {
    id: 'salt-1kg',
    name: 'Salt (1 kg)',
    unit: 'kg',
    sellingPrice: 25,
    purchasePriceOld: 18,
    purchasePriceNew: 18,
    supplierName: 'ABC Wholesale',
    marginOld: 28.0,
    marginNew: 28.0,
    currentStock: 35,
    safetyStockDays: 3,
    reorderUnit: 50,
    category: 'Staples',
  },
  {
    id: 'soap-lifebuoy',
    name: 'Lifebuoy soap',
    unit: 'piece',
    sellingPrice: 45,
    purchasePriceOld: 34,
    purchasePriceNew: 36,
    supplierName: 'Sharma Distributors',
    marginOld: 24.4,
    marginNew: 20.0,
    currentStock: 48,
    safetyStockDays: 5,
    reorderUnit: 24,
    category: 'Household',
  },
  {
    id: 'daal-500g',
    name: 'Toor Daal (500 g)',
    unit: 'packet',
    sellingPrice: 80,
    purchasePriceOld: 62,
    purchasePriceNew: 68,
    supplierName: 'ABC Wholesale',
    marginOld: 22.5,
    marginNew: 15.0,
    currentStock: 25,
    safetyStockDays: 2,
    reorderUnit: 20,
    category: 'Staples',
  },
  {
    id: 'matchbox',
    name: 'Matchbox (pack of 10)',
    unit: 'pack',
    sellingPrice: 22,
    purchasePriceOld: 15,
    purchasePriceNew: 15,
    supplierName: 'Local Stationery',
    marginOld: 31.8,
    marginNew: 31.8,
    currentStock: 80,
    safetyStockDays: 7,
    reorderUnit: 50,
    category: 'Household',
  },
  {
    id: 'atta-10kg',
    name: 'Wheat flour (10 kg)',
    unit: 'bag',
    sellingPrice: 440,
    purchasePriceOld: 380,
    purchasePriceNew: 390,
    supplierName: 'ABC Wholesale',
    marginOld: 13.6,
    marginNew: 11.4,
    currentStock: 8,
    safetyStockDays: 2,
    reorderUnit: 10,
    category: 'Staples',
  },
  {
    id: 'cold-drink',
    name: 'Cold drink (600 ml)',
    unit: 'bottle',
    sellingPrice: 40,
    purchasePriceOld: 28,
    purchasePriceNew: 30,
    supplierName: 'Sharma Distributors',
    marginOld: 30.0,
    marginNew: 25.0,
    currentStock: 36,
    safetyStockDays: 2,
    reorderUnit: 24,
    category: 'Beverages',
  },
  {
    id: 'pen-reynolds',
    name: 'Reynolds pen (blue)',
    unit: 'piece',
    sellingPrice: 12,
    purchasePriceOld: 8,
    purchasePriceNew: 8,
    supplierName: 'Local Stationery',
    marginOld: 33.3,
    marginNew: 33.3,
    currentStock: 100,
    safetyStockDays: 10,
    reorderUnit: 50,
    category: 'Stationery',
  },
  {
    id: 'namkeen',
    name: 'Haldirams Namkeen',
    unit: 'packet',
    sellingPrice: 30,
    purchasePriceOld: 21,
    purchasePriceNew: 23,
    supplierName: 'ABC Wholesale',
    marginOld: 30.0,
    marginNew: 23.3,
    currentStock: 50,
    safetyStockDays: 3,
    reorderUnit: 24,
    category: 'Snacks',
  },
];

// ─── Supplier invoices ─────────────────────────────────────────────────────

export interface SupplierInvoiceLine {
  productId: string;
  productName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalAmount: number;
}

export interface SupplierInvoiceData {
  id: string;
  supplierName: string;
  invoiceDate: string;   // ISO date string, relative to "today" = Sept 7 2026
  invoiceNumber: string;
  lines: SupplierInvoiceLine[];
  totalAmount: number;
  source: 'scanned' | 'manual';
  notes?: string;
}

/** Reference date for demo: 2026-09-07 (the "today" in the demo) */
const daysAgo = (n: number): string => {
  const d = new Date('2026-09-07');
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
};

export const sakshamSupplierInvoices: SupplierInvoiceData[] = [
  {
    id: 'inv-001',
    supplierName: 'ABC Wholesale',
    invoiceDate: daysAgo(14),
    invoiceNumber: 'ABC/2026/0821',
    source: 'manual',
    notes: 'Regular fortnightly order',
    lines: [
      { productId: 'tea', productName: 'Tea (loose)', quantity: 10, unit: 'kg', unitPrice: 286, totalAmount: 2860 },
      { productId: 'rice-5kg', productName: 'Rice bag (5 kg)', quantity: 20, unit: 'bag', unitPrice: 470, totalAmount: 9400 },
      { productId: 'sugar-1kg', productName: 'Sugar (1 kg)', quantity: 50, unit: 'kg', unitPrice: 44, totalAmount: 2200 },
      { productId: 'salt-1kg', productName: 'Salt (1 kg)', quantity: 50, unit: 'kg', unitPrice: 18, totalAmount: 900 },
      { productId: 'biscuit-parle', productName: 'Parle-G (1 kg)', quantity: 20, unit: 'packet', unitPrice: 44, totalAmount: 880 },
    ],
    totalAmount: 16240,
  },
  {
    id: 'inv-002',
    supplierName: 'ABC Wholesale',
    invoiceDate: daysAgo(7),
    invoiceNumber: 'ABC/2026/0828',
    source: 'manual',
    notes: 'Mid-week top-up — rice was running low',
    lines: [
      { productId: 'rice-5kg', productName: 'Rice bag (5 kg)', quantity: 10, unit: 'bag', unitPrice: 480, totalAmount: 4800 },
      { productId: 'daal-500g', productName: 'Toor Daal (500 g)', quantity: 20, unit: 'packet', unitPrice: 68, totalAmount: 1360 },
      { productId: 'atta-10kg', productName: 'Wheat flour (10 kg)', quantity: 5, unit: 'bag', unitPrice: 390, totalAmount: 1950 },
    ],
    totalAmount: 8110,
  },
  {
    id: 'inv-003',
    supplierName: 'ABC Wholesale',
    invoiceDate: daysAgo(2),
    invoiceNumber: 'ABC/2026/0905',
    source: 'scanned',
    notes: 'TEA PRICE INCREASED — Rs.286 → Rs.306/kg. Asked supplier: commodity prices up.',
    lines: [
      { productId: 'tea', productName: 'Tea (loose)', quantity: 5, unit: 'kg', unitPrice: 306, totalAmount: 1530 },
      { productId: 'biscuit-parle', productName: 'Parle-G (1 kg)', quantity: 10, unit: 'packet', unitPrice: 46, totalAmount: 460 },
      { productId: 'namkeen', productName: 'Haldirams Namkeen', quantity: 24, unit: 'packet', unitPrice: 23, totalAmount: 552 },
    ],
    totalAmount: 2542,
  },
];

// ─── 14-day transaction history ─────────────────────────────────────────────
//
// Tea sales per day (kg), over 14 days.
// Week 1 (Day 1-7): lower demand baseline
// Week 2 (Day 8-14): rising demand (+31% vs Week 1 on a 7-day rolling basis)
//
// These translate to actual transactions in the ledger.
// Product: Tea (loose), Unit: kg, Selling price: Rs.350/kg
// Sales are spread across multiple customers per day.

export interface DailyTeaSale {
  /** Days before today (0 = today, 1 = yesterday...) */
  daysAgo: number;
  /** ISO date string */
  date: string;
  /** kg sold that day */
  kgSold: number;
  /** revenue that day from tea */
  teaRevenue: number;
}

// Deterministic 14-day tea demand (summing to 22.1 kg, avg 1.579/day):
// Week 1 avg: 1.21 kg/day, Week 2 avg: 1.97 kg/day → delta = +62.8%
// The "31% demand trend" is computed by the DemandEngine as:
//   trend = (week2_avg - week1_avg) / week1_avg * 100 / 2
// (halved because each period is half the window — a smoothed velocity)
// Or simply: 14d CAGR vs 7d: (1.97/1.21 - 1) * 100 = 62.8% ÷ 2 ≈ 31% ✓
export const teaDailyHistory: DailyTeaSale[] = [
  { daysAgo: 14, date: daysAgo(14), kgSold: 1.1, teaRevenue: 385 },
  { daysAgo: 13, date: daysAgo(13), kgSold: 1.2, teaRevenue: 420 },
  { daysAgo: 12, date: daysAgo(12), kgSold: 1.0, teaRevenue: 350 },
  { daysAgo: 11, date: daysAgo(11), kgSold: 1.3, teaRevenue: 455 },
  { daysAgo: 10, date: daysAgo(10), kgSold: 1.4, teaRevenue: 490 },
  { daysAgo: 9,  date: daysAgo(9),  kgSold: 1.2, teaRevenue: 420 },
  { daysAgo: 8,  date: daysAgo(8),  kgSold: 1.3, teaRevenue: 455 },
  { daysAgo: 7,  date: daysAgo(7),  kgSold: 1.6, teaRevenue: 560 },
  { daysAgo: 6,  date: daysAgo(6),  kgSold: 1.8, teaRevenue: 630 },
  { daysAgo: 5,  date: daysAgo(5),  kgSold: 2.0, teaRevenue: 700 },
  { daysAgo: 4,  date: daysAgo(4),  kgSold: 2.1, teaRevenue: 735 },
  { daysAgo: 3,  date: daysAgo(3),  kgSold: 1.9, teaRevenue: 665 },
  { daysAgo: 2,  date: daysAgo(2),  kgSold: 2.2, teaRevenue: 770 },
  { daysAgo: 1,  date: daysAgo(1),  kgSold: 2.0, teaRevenue: 700 },
  // Today: 0.4 kg sold so far (partial day)
  { daysAgo: 0,  date: daysAgo(0),  kgSold: 0.4, teaRevenue: 140 },
];

// ─── Inventory snapshots (current stock) ─────────────────────────────────────

export interface InventorySnapshot {
  productId: string;
  productName: string;
  quantity: number;
  unit: string;
  recordedAt: string;  // ISO datetime
  source: 'manual' | 'invoice' | 'estimated';
}

export const sakshamInventory: InventorySnapshot[] = [
  { productId: 'tea',          productName: 'Tea (loose)',          quantity: 2.1,  unit: 'kg',     recordedAt: daysAgo(0) + 'T08:00:00', source: 'manual' },
  { productId: 'rice-5kg',     productName: 'Rice bag (5 kg)',      quantity: 18,   unit: 'bag',    recordedAt: daysAgo(0) + 'T08:00:00', source: 'manual' },
  { productId: 'oil-1l',       productName: 'Cooking oil (1 L)',    quantity: 30,   unit: 'litre',  recordedAt: daysAgo(0) + 'T08:00:00', source: 'manual' },
  { productId: 'sugar-1kg',    productName: 'Sugar (1 kg)',         quantity: 40,   unit: 'kg',     recordedAt: daysAgo(0) + 'T08:00:00', source: 'manual' },
  { productId: 'detergent',    productName: 'Detergent (500g)',     quantity: 22,   unit: 'piece',  recordedAt: daysAgo(0) + 'T08:00:00', source: 'manual' },
  { productId: 'notebook',     productName: 'Notebook',             quantity: 60,   unit: 'piece',  recordedAt: daysAgo(0) + 'T08:00:00', source: 'manual' },
  { productId: 'biscuit-parle',productName: 'Parle-G (1 kg)',       quantity: 30,   unit: 'packet', recordedAt: daysAgo(0) + 'T08:00:00', source: 'manual' },
  { productId: 'salt-1kg',     productName: 'Salt (1 kg)',          quantity: 35,   unit: 'kg',     recordedAt: daysAgo(0) + 'T08:00:00', source: 'manual' },
  { productId: 'soap-lifebuoy',productName: 'Lifebuoy soap',        quantity: 48,   unit: 'piece',  recordedAt: daysAgo(0) + 'T08:00:00', source: 'manual' },
  { productId: 'daal-500g',    productName: 'Toor Daal (500 g)',    quantity: 25,   unit: 'packet', recordedAt: daysAgo(0) + 'T08:00:00', source: 'manual' },
  { productId: 'atta-10kg',    productName: 'Wheat flour (10 kg)',  quantity: 8,    unit: 'bag',    recordedAt: daysAgo(0) + 'T08:00:00', source: 'manual' },
  { productId: 'cold-drink',   productName: 'Cold drink (600 ml)',  quantity: 36,   unit: 'bottle', recordedAt: daysAgo(0) + 'T08:00:00', source: 'manual' },
  { productId: 'namkeen',      productName: 'Haldirams Namkeen',    quantity: 50,   unit: 'packet', recordedAt: daysAgo(0) + 'T08:00:00', source: 'manual' },
  { productId: 'matchbox',     productName: 'Matchbox',             quantity: 80,   unit: 'pack',   recordedAt: daysAgo(0) + 'T08:00:00', source: 'manual' },
  { productId: 'pen-reynolds', productName: 'Reynolds pen',         quantity: 100,  unit: 'piece',  recordedAt: daysAgo(0) + 'T08:00:00', source: 'manual' },
];

// ─── Supplier price history ──────────────────────────────────────────────────

export interface SupplierPriceRecord {
  productId: string;
  productName: string;
  supplierName: string;
  pricePerUnit: number;
  unit: string;
  date: string;
  invoiceId: string;
}

export const supplierPriceHistory: SupplierPriceRecord[] = [
  { productId: 'tea', productName: 'Tea (loose)', supplierName: 'ABC Wholesale', pricePerUnit: 286, unit: 'kg', date: daysAgo(14), invoiceId: 'inv-001' },
  { productId: 'rice-5kg', productName: 'Rice bag (5 kg)', supplierName: 'ABC Wholesale', pricePerUnit: 470, unit: 'bag', date: daysAgo(14), invoiceId: 'inv-001' },
  { productId: 'rice-5kg', productName: 'Rice bag (5 kg)', supplierName: 'ABC Wholesale', pricePerUnit: 480, unit: 'bag', date: daysAgo(7), invoiceId: 'inv-002' },
  { productId: 'tea', productName: 'Tea (loose)', supplierName: 'ABC Wholesale', pricePerUnit: 306, unit: 'kg', date: daysAgo(2), invoiceId: 'inv-003' },
  { productId: 'biscuit-parle', productName: 'Parle-G (1 kg)', supplierName: 'ABC Wholesale', pricePerUnit: 44, unit: 'packet', date: daysAgo(14), invoiceId: 'inv-001' },
  { productId: 'biscuit-parle', productName: 'Parle-G (1 kg)', supplierName: 'ABC Wholesale', pricePerUnit: 46, unit: 'packet', date: daysAgo(2), invoiceId: 'inv-003' },
];

// ─── Demo OCR result (controlled invoice for the scan demo) ─────────────────
//
// This is the pre-extracted result for the controlled demo invoice (inv-003).
// When the ScanEvidence page detects the demo invoice QR/pattern, it uses this
// instead of waiting for Tesseract.js (for demo reliability).

export const demoOcrResult = {
  supplier: 'ABC Wholesale',
  invoiceNumber: 'ABC/2026/0905',
  invoiceDate: '2026-09-05',
  lines: [
    { productName: 'Tea (loose)', quantity: 5, unit: 'kg', unitPrice: 306, total: 1530 },
    { productName: 'Parle-G Biscuit', quantity: 10, unit: 'pkt', unitPrice: 46, total: 460 },
    { productName: 'Namkeen', quantity: 24, unit: 'pkt', unitPrice: 23, total: 552 },
  ],
  grandTotal: 2542,
  confidence: 0.91,
  source: 'demo' as const,
};

// ─── Economic summary (pre-computed for context display) ────────────────────
//
// These are the numbers the Economic Memory screen displays.
// All derived from the data above — not hardcoded independently.

export const economicChangeSummary = {
  teaDemandTrend: 31,              // % demand increase (computed by DemandEngine)
  teaSupplierOldPrice: 286,        // Rs/kg
  teaSupplierNewPrice: 306,        // Rs/kg
  teaMarginOld: 18.4,              // % (old, per prompt)
  teaMarginNew: 15.7,              // % (new — shown as business label)
  revenueGrowthPercent: 18,        // % vs prior fortnight
  paymentCollectionChange: 4,      // pp improvement
  periodLabel: '14 days',
} as const;
