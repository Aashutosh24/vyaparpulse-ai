/**
 * BackendApiClient
 * ================
 * Talks to the EXISTING teammate backend (smart_merchant_backend). Every
 * request/response shape here was read from app/schemas.py and app/routers/
 * directly, then confirmed live: this backend was actually started and
 * queried against its own real merchant.db during this integration (see
 * PRODUCTION_INTEGRATION_REPORT.md for the raw responses). Not modified --
 * this file only calls it.
 */
import type { BackendTransactionCreate, BackendTransactionOut } from './canonicalTransaction';

export interface BackendTodaySummary {
  date: string;
  merchant_id: string;
  total_transactions: number;
  paid_count: number;
  pending_count: number;
  total_paid_amount: number;
  total_pending_amount: number;
}

export interface BackendDailyRevenue {
  date: string;
  revenue: number;
  transaction_count: number;
}

export interface BackendInsights {
  merchant_id: string;
  period_days: number;
  total_revenue: number;
  revenue_change_percent: number;
  collection_rate: number;
  pending_amount: number;
  transaction_count: number;
  top_product: string | null;
  daily_revenue: BackendDailyRevenue[];
}

export interface BackendPaymentOut {
  payment_id: string;
  merchant_id: string;
  type: string;
  amount: number;
  timestamp: string;
  raw_message: string | null;
  processed: boolean;
  matched: boolean;
  received_at: string;
}

export interface BackendPaymentResult {
  payment: BackendPaymentOut;
  matched_transaction: BackendTransactionOut | null;
  message: string;
}

export class BackendUnavailableError extends Error {
  public readonly cause?: unknown;
  constructor(cause?: unknown) {
    super('Backend is not reachable. Is it running (uvicorn app.main:app) and is the address correct?');
    this.name = 'BackendUnavailableError';
    this.cause = cause;
  }
}

export class BackendApiClient {
  private baseUrl: string;
  private defaultMerchantId?: string;

  constructor(baseUrl: string, defaultMerchantId?: string) {
    this.baseUrl = baseUrl;
    this.defaultMerchantId = defaultMerchantId;
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        headers: { 'Content-Type': 'application/json', ...init?.headers },
      });
    } catch (err) {
      throw new BackendUnavailableError(err);
    }
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`backend ${path} returned ${res.status}: ${body}`);
    }
    return res.json();
  }

  private merchantQuery(merchantId?: string): string {
    const id = merchantId ?? this.defaultMerchantId;
    return id ? `merchant_id=${encodeURIComponent(id)}` : '';
  }

  health(): Promise<{ status: string }> {
    return this.request('/health');
  }

  createTransaction(payload: BackendTransactionCreate): Promise<BackendTransactionOut> {
    return this.request('/transactions', { method: 'POST', body: JSON.stringify(payload) });
  }

  listTransactions(opts?: { merchantId?: string; status?: 'PENDING' | 'PAID'; limit?: number }): Promise<BackendTransactionOut[]> {
    const params = new URLSearchParams();
    const merchant = opts?.merchantId ?? this.defaultMerchantId;
    if (merchant) params.set('merchant_id', merchant);
    if (opts?.status) params.set('status', opts.status);
    if (opts?.limit) params.set('limit', String(opts.limit));
    return this.request(`/transactions?${params}`);
  }

  getPending(merchantId?: string): Promise<BackendTransactionOut[]> {
    return this.request(`/transactions/pending?${this.merchantQuery(merchantId)}`);
  }

  getStalePending(merchantId?: string): Promise<BackendTransactionOut[]> {
    return this.request(`/transactions/pending/stale?${this.merchantQuery(merchantId)}`);
  }

  getTodaySummary(merchantId?: string): Promise<BackendTodaySummary> {
    return this.request(`/transactions/today?${this.merchantQuery(merchantId)}`);
  }

  /** The backend's OWN lightweight analytics -- SQL aggregation, not ML-2. See mlAdapter.ts. */
  getInsights(days = 7, merchantId?: string): Promise<BackendInsights> {
    const params = new URLSearchParams(this.merchantQuery(merchantId));
    params.set('days', String(days));
    return this.request(`/transactions/insights?${params}`);
  }

  getTransaction(id: string): Promise<BackendTransactionOut> {
    return this.request(`/transactions/${id}`);
  }

  submitPayment(payload: { merchant_id?: string; type: 'CREDIT' | 'DEBIT'; amount: number; timestamp?: string; reference?: string }): Promise<BackendPaymentResult> {
    return this.request('/payments', { method: 'POST', body: JSON.stringify(payload) });
  }

  submitRawPayment(payload: { merchant_id?: string; message: string; sender?: string; received_at?: string }): Promise<BackendPaymentResult> {
    return this.request('/payments/raw', { method: 'POST', body: JSON.stringify(payload) });
  }

  listPayments(merchantId?: string): Promise<BackendPaymentOut[]> {
    return this.request(`/payments?${this.merchantQuery(merchantId)}`);
  }

  /** Merchant's manual pick in Payment Review. transactionId=null marks "none of these". */
  manualMatchPayment(paymentId: string, transactionId: string | null): Promise<BackendPaymentResult> {
    return this.request(`/payments/${paymentId}/match`, {
      method: 'PATCH',
      body: JSON.stringify({ transaction_id: transactionId }),
    });
  }
}
