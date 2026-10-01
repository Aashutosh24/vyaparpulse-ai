import React from 'react';
import {
  customers as seedCustomers,
  paymentEvents as seedPayments,
  transactions as seedTransactions } from
'../data/mockData';
import { formatRupees, initialsOf, isPartialNameMatch } from '../utils/format';
import {
  buildInsights,
  computeCustomerAccounts,
  computeForecast,
  computeHealth,
  computeProfile,
  computeSeries,
  computeToday,
  computeWeek } from
'../utils/metrics';
import type {
  BusinessHealth,
  ChangeImpact,
  CustomerAccount,
  EconomicMemoryEntry,
  ForecastSummary,
  Insight,
  LineItem,
  PaymentEvent,
  ProductDemandIntel,
  ReorderRecommendation,
  SakshamIntent,
  SakshamResponse,
  StockoutPrediction,
  SupplierInvoiceType,
  TodayTotals,
  Transaction,
  TrendPoint,
  WeekMetrics } from
'../types';
import { BackendApiClient } from '../services/backendClient';
import { mapBackendToFrontendTransaction, mapCanonicalToBackendRequests, type CanonicalSale } from '../services/canonicalTransaction';
import { LiveMLAdapter, MockMLAdapter, type MLForecast } from '../services/mlAdapter';
// SAKSHAM Economic Engine
import {
  DemandEngine,
  InventoryEngine,
  StockoutPredictor,
  ReorderEngine,
  MarginEngine,
  analyseProduct,
  buildEconomicMemory,
} from '../engine/economicEngine';
import { IntentEngine } from '../engine/intentEngine';
import { LocalReasoner } from '../engine/sakshamReasoner';
import {
  sakshamProducts,
  sakshamInventory,
  supplierPriceHistory,
  teaDailyHistory,
  economicChangeSummary,
} from '../data/sakshamDemoData';

/**
 * 'demo' (default, unchanged behavior): mockData + local simulated timers,
 * exactly as before this integration.
 * 'live': sales still update local state instantly (same optimistic UX),
 * but are also persisted to the real backend in the background, and the
 * backend's assigned transaction_id becomes authoritative once it returns.
 * Nothing about the demo path changes when this isn't set to 'live'.
 */
export type AppMode = 'demo' | 'live';

/** Same-machine default; override via VITE_BACKEND_URL for a device/emulator (see README addition). */
const DEFAULT_BACKEND_URL = (import.meta as any).env?.VITE_BACKEND_URL ?? 'http://127.0.0.1:8000';


export type DataState = 'ready' | 'loading' | 'empty' | 'error';
export type SaveState = 'idle' | 'saving' | 'saved';

export interface Banner {
  kind: 'saved' | 'received' | 'matched';
  title: string;
  detail: string;
  /** Structured fields so the reconciliation moment can be staged visually. */
  amount?: number;
  party?: string;
  ref?: string;
}

interface NewSaleInput {
  customerName: string;
  items: LineItem[];
  method: 'upi' | 'cash' | 'credit';
  source: 'voice' | 'manual';
}

export interface DemoStep {
  id: string;
  label: string;
  hint: string;
  route: string;
  done: boolean;
  /** Steps that drive real app state rather than just navigating. */
  action?: 'simulate';
}

interface AppContextValue {
  dataState: DataState;
  offline: boolean;
  saveState: SaveState;
  localOnlyCount: number;
  hasEnoughHistory: boolean;
  demoSteps: DemoStep[];
  openSaleAmount: number | null;
  mode: AppMode;
  backendSyncError: string | null;

  transactions: Transaction[];
  payments: PaymentEvent[];
  customers: CustomerAccount[];

  today: TodayTotals;
  week: WeekMetrics;
  series: Record<'7D' | '30D' | '90D', TrendPoint[]>;
  health: BusinessHealth;
  forecast: ForecastSummary;
  insights: Insight[];
  profile: ReturnType<typeof computeProfile>;

  healthJustChanged: boolean;
  reviewCount: number;
  banner: Banner | null;
  impact: ChangeImpact | null;
  lastSale: Transaction | null;

  // ─── SAKSHAM Economic Intelligence ─────────────────────────────
  /** Demand analysis for all tracked products */
  productIntel: ProductDemandIntel[];
  /** Highest-priority stockout — null if none are urgent */
  topAlert: StockoutPrediction | null;
  /** Top reorder recommendation — null if no urgent reorders */
  topRecommendation: ReorderRecommendation | null;
  /** What changed in this business (economic memory entries) */
  economicMemory: EconomicMemoryEntry[];
  /** Supplier invoices added by the merchant (evidence stream) */
  supplierInvoices: SupplierInvoiceType[];
  /** Add a supplier invoice to the evidence stream */
  addSupplierInvoice: (invoice: SupplierInvoiceType) => void;
  /** Ask SAKSHAM a business question — returns deterministic response */
  askSaksham: (text: string) => SakshamResponse;

  addSale: (input: NewSaleInput) => Transaction;
  resolveReview: (paymentId: string, customerName: string) => void;
  simulateIncomingPayment: () => void;
  dismissBanner: () => void;
  reload: () => void;
  resetDemo: () => void;
}

const AppContext = React.createContext<AppContextValue | null>(null);

const reviewCountOf = (payments: PaymentEvent[]) =>
payments.filter((p) => p.state === 'needsReview').length;

export function useApp(): AppContextValue {
  const ctx = React.useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}

interface AppProviderProps {
  children: React.ReactNode;
  dataState: DataState;
  offline: boolean;
  /** Defaults to 'demo' -- existing <AppProvider> call sites need no changes. */
  mode?: AppMode;
  backendUrl?: string;
}

const emptyWeek: WeekMetrics = {
  revenue: 0,
  lastWeekRevenue: 0,
  growthPercent: 0,
  collectionRate: 0,
  outstanding: 0,
  outstandingCustomers: 0,
  transactionCount: 0,
  strongestDay: '—',
  strongestDayValue: 0,
  variability: 0,
  daysWithSales: 0,
  reading: 'Not enough sales recorded yet.'
};

const emptyHealth: BusinessHealth = {
  score: 0,
  previousScore: 0,
  delta: 0,
  band: 'Not enough history',
  factors: [],
  summary: 'We need a few more days of sales before scoring your business.',
  why: 'Business Health needs at least a week of recorded sales and payments.',
  action: 'Keep recording sales and this unlocks on its own.'
};

const emptyForecast: ForecastSummary = {
  low: 0,
  expected: 0,
  high: 0,
  confidence: 'Low',
  confidenceReason: 'There is not enough history to predict your cash flow yet.',
  basis: 'A forecast needs at least two weeks of recorded sales.',
  action: 'Keep recording sales to unlock this.',
  series: []
};

export function AppProvider({ children, dataState, offline, mode = 'demo', backendUrl }: AppProviderProps) {
  const empty = dataState === 'empty';
  const [transactions, setTransactions] = React.useState<Transaction[]>(
    empty ? [] : seedTransactions
  );
  const [payments, setPayments] = React.useState<PaymentEvent[]>(empty ? [] : seedPayments);
  const backendClient = React.useMemo(
    () => (mode === 'live' ? new BackendApiClient(backendUrl ?? DEFAULT_BACKEND_URL) : null),
    [mode, backendUrl]
  );
  const [backendSyncError, setBackendSyncError] = React.useState<string | null>(null);
  const [banner, setBanner] = React.useState<Banner | null>(null);
  // Live mode: replace the mock-seeded ledger with the real backend's data
  // once, on mount. Demo mode is completely untouched by this block.
  React.useEffect(() => {
    if (mode !== 'live' || !backendClient) return;
    let cancelled = false;
    backendClient
      .listTransactions({ limit: 200 })
      .then((rows) => {
        if (cancelled) return;
        setTransactions(rows.map(mapBackendToFrontendTransaction) as Transaction[]);
        setBackendSyncError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        // Do NOT fall back to mock transactions here -- showing demo data
        // labeled as real would be exactly the fabrication this integration
        // must avoid. Empty + a visible error is the honest state.
        setTransactions([]);
        setBackendSyncError(err instanceof Error ? err.message : 'Could not reach the backend.');
      });
    return () => {
      cancelled = true;
    };
  }, [mode, backendClient]);


  const [impact, setImpact] = React.useState<ChangeImpact | null>(null);
  const [lastSale, setLastSale] = React.useState<Transaction | null>(null);
  const [saveState, setSaveState] = React.useState<SaveState>('idle');
  const [healthJustChanged, setHealthJustChanged] = React.useState(false);
  const [nonce, setNonce] = React.useState(0);
  const timers = React.useRef<number[]>([]);

  // ─── SAKSHAM Economic Engine state ────────────────────────────────
  const [supplierInvoices, setSupplierInvoices] = React.useState<SupplierInvoiceType[]>([]);

  // Run Economic Engine on mount (from demo data, offline, deterministic)
  const sakshamAnalyses = React.useMemo(() => {
    const teaDemandHistory = DemandEngine.fromTeaHistory(teaDailyHistory);
    const teaProduct = sakshamProducts.find((p) => p.id === 'tea')!;
    const teaStockSnap = sakshamInventory.find((s) => s.productId === 'tea')!;
    return [analyseProduct(
      teaProduct,
      teaDemandHistory,
      teaStockSnap.quantity,
      supplierPriceHistory,
    )];
  }, []);

  const productIntel = React.useMemo(
    () => sakshamAnalyses.map((a) => a.demand),
    [sakshamAnalyses]
  );

  const topAlert = React.useMemo(() => {
    const urgent = sakshamAnalyses
      .map((a) => a.stockout)
      .filter((s) => s.isUrgent)
      .sort((a, b) => a.daysUntilStockout - b.daysUntilStockout);
    return urgent[0] ?? null;
  }, [sakshamAnalyses]);

  const topRecommendation = React.useMemo(() => {
    const urgent = sakshamAnalyses
      .filter((a) => a.recommendation.priority === 'urgent')
      .sort((a, b) => a.stockout.daysUntilStockout - b.stockout.daysUntilStockout);
    return urgent[0]?.recommendation ?? null;
  }, [sakshamAnalyses]);

  const economicMemory = React.useMemo(
    () => buildEconomicMemory(
      sakshamAnalyses,
      economicChangeSummary.revenueGrowthPercent,
      economicChangeSummary.paymentCollectionChange,
    ),
    [sakshamAnalyses]
  );

  const addSupplierInvoice = React.useCallback((invoice: SupplierInvoiceType) => {
    setSupplierInvoices((prev) => [invoice, ...prev]);
  }, []);

  const askSaksham = React.useCallback((text: string): SakshamResponse => {
    const intent = IntentEngine.extract(text);
    return LocalReasoner.answer(intent, sakshamAnalyses, economicMemory);
  }, [sakshamAnalyses, economicMemory]);

  // Delayed handlers (the payment lands seconds after the sale) must read the
  // latest ledger, not the one captured when they were created.
  const txnsRef = React.useRef(transactions);
  const paymentsRef = React.useRef(payments);
  React.useEffect(() => {
    txnsRef.current = transactions;
    paymentsRef.current = payments;
  }, [transactions, payments]);

  React.useEffect(() => {
    setTransactions(empty ? [] : seedTransactions);
    setPayments(empty ? [] : seedPayments);
    setBanner(null);
    setImpact(null);
    setLastSale(null);
    setSaveState('idle');
  }, [empty, nonce]);

  React.useEffect(
    () => () => {
      timers.current.forEach((t) => window.clearTimeout(t));
    },
    []
  );

  // ---- Single derivation pass. Every screen reads these. ----
  const today = React.useMemo(() => computeToday(transactions), [transactions]);
  const week = React.useMemo(
    () => empty ? emptyWeek : computeWeek(transactions, today),
    [empty, transactions, today]
  );
  const series = React.useMemo(
    () => empty ? { '7D': [], '30D': [], '90D': [] } : computeSeries(today),
    [empty, today]
  );
  const health = React.useMemo(
    () => empty ? emptyHealth : computeHealth(week, today),
    [empty, week, today]
  );

  const [mlForecast, setMlForecast] = React.useState<MLForecast | null>(null);
  React.useEffect(() => {
    let cancelled = false;
    const adapter = mode === 'live' 
        ? new LiveMLAdapter(backendUrl ?? DEFAULT_BACKEND_URL) 
        : new MockMLAdapter();
    adapter.getForecast().then(f => {
        if (!cancelled) setMlForecast(f);
    }).catch(err => {
        console.error("Failed to fetch ML forecast:", err);
    });
    return () => { cancelled = true; };
  }, [mode, backendUrl, nonce]);

  const forecast = React.useMemo(
    () => empty ? emptyForecast : computeForecast(today, week, mlForecast),
    [empty, today, week, mlForecast]
  );
  const insights = React.useMemo(
    () => empty ? [] : buildInsights(today, week, forecast),
    [empty, today, week, forecast]
  );
  const customers = React.useMemo(
    () => empty ? [] : computeCustomerAccounts(seedCustomers, transactions),
    [empty, transactions]
  );
  const profile = React.useMemo(() => computeProfile(week, health), [week, health]);

  // Flash the score when a reconciliation moves it.
  const prevScore = React.useRef(health.score);
  React.useEffect(() => {
    if (prevScore.current !== health.score) {
      prevScore.current = health.score;
      setHealthJustChanged(true);
      const t = window.setTimeout(() => setHealthJustChanged(false), 6000);
      timers.current.push(t);
    }
  }, [health.score]);

  const reviewCount = reviewCountOf(payments);

  /**
   * Works out exactly which merchant-facing figures an action moves, before
   * it is applied, so the UI can show the causal before → after.
   */
  const projectImpact = React.useCallback(
    (
    current: Transaction[],
    nextTransactions: Transaction[],
    reason: string,
    saleRef?: string)
    : ChangeImpact => {
      const beforeToday = computeToday(current);
      const afterToday = computeToday(nextTransactions);
      const beforeWeek = computeWeek(current, beforeToday);
      const afterWeek = computeWeek(nextTransactions, afterToday);
      const beforeHealth = computeHealth(beforeWeek, beforeToday);
      const afterHealth = computeHealth(afterWeek, afterToday);

      const rows: ChangeImpact['rows'] = [];
      if (beforeToday.pending !== afterToday.pending) {
        rows.push({
          label: 'Pending',
          before: formatRupees(beforeToday.pending),
          after: formatRupees(afterToday.pending)
        });
      }
      if (beforeToday.collectionRate !== afterToday.collectionRate) {
        rows.push({
          label: 'Collected',
          before: `${beforeToday.collectionRate}%`,
          after: `${afterToday.collectionRate}%`
        });
      }
      if (beforeHealth.score !== afterHealth.score) {
        rows.push({
          label: 'Health',
          before: String(beforeHealth.score),
          after: String(afterHealth.score)
        });
      }
      return { reason, saleRef, rows };
    },
    []
  );

  /**
   * PROTOTYPE BEHAVIOUR: there is no UPI integration. This generates the
   * payment event that a real UPI feed would deliver, so the reconciliation
   * journey can be demonstrated end to end. Events are flagged `simulated`.
   */
  const matchPaymentToSale = React.useCallback(
    (sale: Transaction) => {
      const current = txnsRef.current;
      const nextTransactions = current.map((t): Transaction =>
      t.id === sale.id ? { ...t, status: 'paid', receivedAmount: t.amount } : t
      );

      setImpact(
        projectImpact(
          current,
          nextTransactions,
          'Payment reliability improved — this sale is now collected.',
          sale.ref
        )
      );
      setTransactions(nextTransactions);
      setPayments((prev) => [
      {
        id: `p-${sale.id}`,
        amount: sale.amount,
        senderName: sale.name,
        handle: `${sale.name.split(' ')[0].toLowerCase()}@upi`,
        time: sale.time,
        state: 'matched',
        matchedRef: sale.ref,
        simulated: true
      },
      ...prev]
      );
      setBanner({
        kind: 'received',
        title: 'Payment received',
        detail: `Matched automatically to sale ${sale.ref}`,
        amount: sale.amount,
        party: sale.name,
        ref: sale.ref
      });

      // Live mode: also tell the backend about this payment so it persists.
      if (mode === 'live' && backendClient) {
        backendClient
          .submitPayment({ type: 'CREDIT', amount: sale.amount })
          .catch(() => {
            // Local state already updated optimistically; backend sync failure
            // is not critical for the demo — the payment still shows locally.
          });
      }
    },
    [projectImpact, mode, backendClient]
  );

  const addSale = React.useCallback(
    (input: NewSaleInput) => {
      const amount = input.items.reduce((s, i) => s + i.qty * i.unitPrice, 0);
      const id = `t-${Date.now()}`;
      const known = seedCustomers.find(
        (c) => isPartialNameMatch(c.name, input.customerName)
      );
      const sale: Transaction = {
        id,
        ref: `#${1043 + Math.floor(Math.random() * 5)}`,
        customerId: known?.id ?? 'unassigned',
        name: input.customerName,
        initials: known?.initials ?? initialsOf(input.customerName),
        items: input.items,
        amount,
        receivedAmount: input.method === 'cash' ? amount : 0,
        time: new Date().toLocaleTimeString('en-IN', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        }),
        dayLabel: 'Today',
        status: input.method === 'cash' ? 'paid' : 'pending',
        method: input.method,
        syncedOffline: offline
      };

      setTransactions((prev) => [sale, ...prev]);
      setLastSale(sale);
      setSaveState('saving');
      timers.current.push(
        window.setTimeout(() => setSaveState('saved'), 700),
        window.setTimeout(() => setSaveState('idle'), 5000)
      );
      setBanner({
        kind: 'saved',
        title: 'Sale recorded',
        detail: offline ?
        'Saved on this device. Matching resumes when you reconnect.' :
        input.method === 'cash' ?
        'Cash received and closed.' :
        'Waiting for the payment to arrive.',
        amount,
        party: sale.name,
        ref: sale.ref
      });

      if (mode === 'live' && backendClient && !offline) {
        // Backend is single-item-per-transaction (see canonicalTransaction.ts
        // gap #2) -- one POST per line item, reconciled back onto the SAME
        // local optimistic card by matching on the temp id below.
        const canonical: CanonicalSale = {
          items: input.items,
          amount,
          customerName: input.customerName,
          status: input.method === 'cash' ? 'paid' : 'pending',
          timestamp: new Date().toISOString(),
          source: input.source
        };
        const requests = mapCanonicalToBackendRequests(canonical);
        Promise.all(requests.map((r) => backendClient!.createTransaction(r))).
        then((created) => {
          const primary = created[0];
          if (!primary) return;
          setTransactions((prev) =>
          prev.map((t) => t.id === id ? { ...t, id: primary.transaction_id, ref: `#${primary.transaction_id.slice(0, 6).toUpperCase()}`, syncedOffline: false } : t)
          );
          setBackendSyncError(null);
        }).
        catch((err) => {
          // Local card stays visible (still true that the merchant recorded
          // a sale) -- just flagged as not yet synced, honestly, rather than
          // silently retried forever or silently dropped.
          setTransactions((prev) =>
          prev.map((t) => t.id === id ? { ...t, syncedOffline: true } : t)
          );
          setBackendSyncError(err instanceof Error ? err.message : 'Could not save this sale to the backend.');
        });
      }

      // Demo mode only: simulate the UPI payment arriving a few seconds after
      // the sale so the full reconciliation journey can be shown end-to-end.
      // In live mode the real backend does the matching via /payments/raw above;
      // firing this timer on top would create a phantom "matched" state in local
      // state before the backend has confirmed anything, causing the ledger to
      // show the sale as Pending while the banner says Payment Received.
      if (input.method === 'upi' && !offline && mode === 'demo') {
        const t = window.setTimeout(() => matchPaymentToSale(sale), 3400);
        timers.current.push(t);
      }

      return sale;
    },
    [offline, matchPaymentToSale, mode, backendClient]
  );

  /** Manual trigger for the same simulated payment, for walking through the demo. */
  const simulateIncomingPayment = React.useCallback(() => {
    const open = txnsRef.current.find(
      (t) => t.dayLabel === 'Today' && t.amount > t.receivedAmount && t.status !== 'needsReview'
    );
    if (!open) return;

    if (mode === 'live' && backendClient) {
      // In live mode, submit a real raw payment to the backend. If the backend
      // auto-matches it, we update the local transaction. If not, we push a
      // needsReview event so the PaymentReview screen can handle it.
      // Format as a realistic bank-SMS so payment_parser.py's CREDIT_WORDS and
      // AMOUNT_PATTERN regexes both match — "received" triggers CREDIT classification,
      // "Rs." prefix matches AMOUNT_PATTERN, and UPI Ref captures a reference number.
      const ref = `UPI${Date.now().toString().slice(-8)}`;
      const message = `Rs.${open.amount} credited to your A/c via UPI from ${open.name}. UPI Ref ${ref}`;
      backendClient
        .submitRawPayment({ message, sender: open.name })
        .then((result) => {
          if (result.matched_transaction) {
            // Backend matched — reconcile locally
            matchPaymentToSale(open);
          } else {
            // Backend couldn't match — add as needsReview
            setPayments((prev) => [
              {
                id: result.payment.payment_id,
                amount: result.payment.amount,
                senderName: open.name,
                handle: `${open.name.split(' ')[0].toLowerCase()}@upi`,
                time: open.time,
                state: 'needsReview' as const,
                simulated: true,
                candidates: [
                  {
                    txnId: open.id,
                    name: open.name,
                    amount: open.amount,
                    time: open.time,
                    reason: 'Amount and timing match this open sale.',
                  },
                ],
              },
              ...prev,
            ]);
            setBanner({
              kind: 'received',
              title: 'Payment received',
              detail: 'Could not auto-match — please review.',
              amount: result.payment.amount,
              party: open.name,
            });
          }
        })
        .catch(() => {
          // Backend unreachable — fall back to local simulation so the demo
          // journey isn't broken.
          matchPaymentToSale(open);
        });
    } else {
      matchPaymentToSale(open);
    }
  }, [matchPaymentToSale, mode, backendClient]);

  const resolveReview = React.useCallback(
    (paymentId: string, customerName: string) => {
      const current = txnsRef.current;
      const payment = paymentsRef.current.find((p) => p.id === paymentId);
      if (!payment) return;
      const known = seedCustomers.find((c) => isPartialNameMatch(c.name, customerName));
      const target =
      current.find((t) => t.status === 'needsReview' && t.amount === payment.amount) ??
      current.find((t) => t.status === 'needsReview');

      const nextTransactions = current.map((t): Transaction =>
      target && t.id === target.id ?
      {
        ...t,
        status: 'paid',
        receivedAmount: t.amount,
        name: customerName,
        initials: known?.initials ?? initialsOf(customerName),
        customerId: known?.id ?? t.customerId
      } :
      t
      );

      setImpact(
        projectImpact(
          current,
          nextTransactions,
          `The payment now has a sale attached, so ${customerName}'s balance and your collection rate are correct.`,
          target?.ref
        )
      );
      setTransactions(nextTransactions);
      setPayments((prev) =>
      prev.map((p): PaymentEvent =>
      p.id === paymentId ?
      {
        ...p,
        state: 'matched',
        senderName: customerName,
        matchedRef: target?.ref ?? p.matchedRef
      } :
      p
      )
      );
      setBanner({
        kind: 'matched',
        title: 'Payment matched',
        detail: target ? `Confirmed against ${customerName} · sale ${target.ref}` : `Confirmed against ${customerName}`,
        amount: payment.amount,
        party: customerName,
        ref: target?.ref
      });

      // Live mode: persist the manual match to the backend.
      if (mode === 'live' && backendClient && target) {
        backendClient
          .manualMatchPayment(paymentId, target.id)
          .catch(() => {
            // Optimistic local update already applied.
            // Backend sync failure is non-critical for the demo.
          });
      }
    },
    [projectImpact, mode, backendClient]
  );

  // ---- Guided demo progress, derived from what has actually happened ----
  const baselineScore = React.useRef(health.score);
  React.useEffect(() => {
    baselineScore.current = health.score;
    // Re-baseline only when the whole prototype is reset.
  }, [nonce, empty]); // eslint-disable-line react-hooks/exhaustive-deps

  const openSale = transactions.find(
    (t) => t.dayLabel === 'Today' && t.amount > t.receivedAmount && t.status !== 'needsReview'
  );
  const recordedSale = lastSale ? transactions.find((t) => t.id === lastSale.id) : undefined;

  const unresolved = payments.find((p) => p.state === 'needsReview');

  const demoSteps: DemoStep[] = [
  {
    id: 'record',
    label: 'Record a sale',
    hint: 'Speak it or tap it in — takes seconds',
    route: '/sell',
    done: Boolean(lastSale)
  },
  {
    id: 'payment',
    label: 'Receive a payment',
    hint: 'Generates the payment a UPI feed would deliver',
    route: '/payments',
    action: 'simulate',
    done: payments.some((p) => p.simulated && p.state === 'matched')
  },
  {
    id: 'reconcile',
    label: 'Reconcile automatically',
    hint: 'The sale closes itself in your ledger',
    route: '/ledger',
    done: Boolean(recordedSale && recordedSale.status === 'paid')
  },
  {
    id: 'review',
    label: 'Resolve an ambiguous payment',
    hint: 'Two sales look alike — you decide, not the app',
    route: unresolved ? `/payments/${unresolved.id}` : '/payments',
    done: reviewCountOf(payments) === 0
  },
  {
    id: 'impact',
    label: 'See the business impact',
    hint: 'Health, insights and forecast recompute',
    route: '/insights',
    done: health.score !== baselineScore.current
  }];


  const value: AppContextValue = {
    dataState,
    offline,
    saveState,
    localOnlyCount: transactions.filter((t) => t.syncedOffline).length,
    hasEnoughHistory: !empty && week.daysWithSales >= 3,
    demoSteps,
    openSaleAmount: openSale ? openSale.amount - openSale.receivedAmount : null,
    mode,
    backendSyncError,

    transactions,
    payments,
    customers,

    today,
    week,
    series,
    health,
    forecast,
    insights,
    profile,

    healthJustChanged,
    reviewCount,
    banner,
    impact,
    lastSale,

    // SAKSHAM
    productIntel,
    topAlert,
    topRecommendation,
    economicMemory,
    supplierInvoices,
    addSupplierInvoice,
    askSaksham,

    addSale,
    resolveReview,
    simulateIncomingPayment,
    dismissBanner: () => {
      setBanner(null);
      setImpact(null);
    },
    reload: () => setNonce((n) => n + 1),
    resetDemo: () => setNonce((n) => n + 1)
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}