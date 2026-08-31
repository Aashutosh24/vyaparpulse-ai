/**
 * CANONICAL TRANSACTION CONTRACT
 * ================================
 * One frontend-side shape that every source (voice agent, manual entry,
 * backend sync) maps onto before touching AppContext. This is NOT a new
 * transaction type replacing `Transaction` in `types/index.ts` -- it's the
 * intermediate shape adapters produce on the way to the existing type,
 * because the four real systems disagree on structure and this is where
 * that gets resolved once, explicitly, instead of ad hoc in three places.
 *
 * Verified against the ACTUAL running systems (not just their docs):
 *   - Voice agent:  POST /api/voice/text on a live server, real response
 *   - Backend:      GET /transactions against its own real merchant.db
 *   - Frontend:     src/types/index.ts, src/data/mockData.ts (read directly)
 *   - ML-2:         schemas/transaction.schema.json (this repo's own Phase 1)
 *
 * ---------------------------------------------------------------------------
 * FIELD-BY-FIELD, WHAT EACH SYSTEM ACTUALLY CALLS IT
 * ---------------------------------------------------------------------------
 *                 Voice agent      Backend           Frontend (existing)        ML-2
 * id              id               transaction_id    id                        transaction_id
 * item(s)         item (1 string)  item (1 string)   items: LineItem[]         items: [{product,...}]
 * qty             quantity         quantity          items[].qty               items[].quantity
 * amount          amount           amount            amount                    amount
 * when            timestamp        created_at        time + dayLabel (display) timestamp
 * status          PENDING|PAID     PENDING|PAID|      'paid'|'partial'|         paid|partial|pending
 *                                  EXPIRED            'pending'|'needsReview'
 * customer        --               customer_name      customerId+name+initials  customer (string|null)
 * confidence      confidence       -- (not stored)     -- (hardcoded in UI)     confidence (optional)
 * raw text        raw_text         -- (not stored)     -- (not shown)           --
 * merchant        --               merchant_id         -- (single-merchant app) merchant_id
 *
 * ---------------------------------------------------------------------------
 * GAPS THIS FILE DOES NOT PAPER OVER (see BACKEND_CHANGE_REQUESTS.md)
 * ---------------------------------------------------------------------------
 * 1. The backend has no column for raw_text or confidence. A voice sale
 *    posted to `POST /transactions` loses both today. mapVoiceToBackend()
 *    below still sends what it can; the rest is a documented backend gap,
 *    not something faked on the frontend.
 * 2. The backend is single-item-per-transaction. A multi-item manual sale
 *    (ManualSaleForm supports a real cart) has no single-request backend
 *    equivalent -- mapCanonicalToBackendRequests() below deliberately
 *    returns ONE request per line item rather than inventing a batch
 *    endpoint the backend doesn't have.
 * 3. 'partial' (frontend PaymentStatus) has no backend equivalent at all --
 *    the backend is binary paid-in-full-or-not. Mapped to 'pending' rather
 *    than guessed at.
 */

export type CanonicalStatus = 'pending' | 'paid' | 'needsReview';

/** What every adapter converges on before it becomes a frontend `Transaction`. */
export interface CanonicalSaleItem {
  name: string;
  qty: number;
  unitPrice: number;
}

export interface CanonicalSale {
  /** Present once the backend has assigned one; absent for a not-yet-synced voice/manual draft. */
  backendTransactionId?: string;
  items: CanonicalSaleItem[];
  amount: number;
  customerName: string | null;
  status: CanonicalStatus;
  timestamp: string; // ISO 8601
  source: 'voice' | 'manual';
  /** Voice-only metadata. Undefined for manual entry. */
  voice?: {
    rawText: string;
    confidence: number;
  };
}

// ---------------------------------------------------------------------------
// Voice agent -> canonical
// ---------------------------------------------------------------------------

/** Exact shape confirmed live from `POST /api/voice/text` (see voiceAgentClient.ts). */
export interface VoiceTransaction {
  id: string;
  item: string | null;
  quantity: number | null;
  amount: number;
  unit_price: number | null;
  timestamp: string;
  status: 'PENDING' | 'PAID';
  raw_text: string;
  confidence: number | null;
}

export function mapVoiceToCanonical(voice: VoiceTransaction): CanonicalSale {
  const qty = voice.quantity ?? 1;
  const unitPrice = voice.unit_price ?? (qty > 0 ? voice.amount / qty : voice.amount);
  return {
    items: [{ name: voice.item ?? 'Unspecified item', qty, unitPrice }],
    amount: voice.amount,
    customerName: null, // voice agent never captures a customer name
    status: voice.status === 'PAID' ? 'paid' : 'pending',
    timestamp: voice.timestamp,
    source: 'voice',
    voice: { rawText: voice.raw_text, confidence: voice.confidence ?? 0 },
  };
}

// ---------------------------------------------------------------------------
// Canonical -> backend request(s)
// ---------------------------------------------------------------------------

export interface BackendTransactionCreate {
  merchant_id?: string;
  customer_name?: string | null;
  item: string;
  quantity: number;
  amount: number;
  created_at?: string;
}

/**
 * One request per line item -- see gap #2 above. A single-item voice sale
 * produces exactly one request; a multi-item manual sale produces N.
 */
export function mapCanonicalToBackendRequests(
  sale: CanonicalSale,
  merchantId?: string
): BackendTransactionCreate[] {
  return sale.items.map((item) => ({
    merchant_id: merchantId,
    customer_name: sale.customerName,
    item: item.name,
    quantity: item.qty,
    amount: item.qty * item.unitPrice,
    created_at: sale.timestamp,
  }));
}

// ---------------------------------------------------------------------------
// Backend -> frontend `Transaction` (types/index.ts)
// ---------------------------------------------------------------------------

/** Exact shape confirmed live from `GET /transactions` against the real merchant.db. */
export interface BackendTransactionOut {
  transaction_id: string;
  merchant_id: string;
  customer_name: string | null;
  item: string;
  quantity: number;
  amount: number;
  created_at: string;
  status: 'PENDING' | 'PAID' | 'EXPIRED';
  paid_at: string | null;
  payment_id: string | null;
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] ?? '?').toUpperCase() + (parts[1]?.[0]?.toUpperCase() ?? '');
}

function dayLabelOf(iso: string): 'Today' | 'Yesterday' | string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (sameDay(d, today)) return 'Today';
  if (sameDay(d, yesterday)) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

/**
 * Maps one backend row to the shape `types/index.ts`'s `Transaction` expects.
 * Backend status EXPIRED has no frontend equivalent yet -- mapped to
 * 'needsReview' as the closest existing state rather than adding a new one
 * to the approved type (see BACKEND_CHANGE_REQUESTS.md).
 */
export function mapBackendToFrontendTransaction(row: BackendTransactionOut) {
  const status: 'paid' | 'pending' | 'needsReview' =
    row.status === 'PAID' ? 'paid' : row.status === 'EXPIRED' ? 'needsReview' : 'pending';
  const name = row.customer_name ?? 'Walk-in customer';

  return {
    id: row.transaction_id,
    ref: `#${row.transaction_id.slice(0, 6).toUpperCase()}`,
    customerId: row.transaction_id, // backend has no separate customer entity yet
    name,
    initials: initialsOf(name),
    items: [{ name: row.item, qty: row.quantity, unitPrice: row.amount / row.quantity }],
    amount: row.amount,
    receivedAmount: row.status === 'PAID' ? row.amount : 0,
    time: new Date(row.created_at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }),
    dayLabel: dayLabelOf(row.created_at),
    status,
    method: 'upi' as const, // backend doesn't record how payment arrived, only that it did
    syncedOffline: false,
  };
}
