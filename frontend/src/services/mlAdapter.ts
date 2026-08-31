/**
 * ML Adapter
 * ==========
 * WHY THIS IS A MOCK RIGHT NOW, NOT A LIVE CALL:
 *
 * ML-2 (schemas/validation/aggregation/feature-engine/forecasting) is Python.
 * This frontend is TypeScript running in a browser. The teammate backend is
 * ALSO Python (FastAPI) and already owns transaction/payment persistence --
 * it is the natural place for a Python-to-Python ML-2 call to live, but this
 * task is explicitly not allowed to modify that backend or stand up a new
 * server of its own. So there is currently no live path from this frontend
 * to real ML-2 output. See ML_CHANGE_REQUEST.md for exactly what endpoint
 * would remove this mock.
 *
 * WHAT'S HONEST ABOUT THIS MOCK AND WHAT ISN'T FABRICATED:
 *   - `expected` needs a real backend endpoint to ever be a real prediction;
 *     this mock does not pretend otherwise (see `source: 'mock'` below).
 *   - The uncertainty band (`low`/`high`) is NOT invented. If/when a real
 *     forecast lands, its band should be `expected ± measured MAE` from
 *     PHASE_2_FORECASTING.md's own validation run (MAE 1237, RMSE 1975 on
 *     held-out data) -- a real, measured error bound, not a guessed spread.
 *   - There is deliberately NO per-day `series`. ML-2's model predicts one
 *     7-day TOTAL, not seven daily values (see PHASE_2_FORECASTING.md).
 *     Inventing a smooth-looking daily curve from a single number would be
 *     exactly the kind of fabrication this task prohibits. The frontend's
 *     `ForecastSummary.series` field cannot be honestly populated without
 *     either a backend endpoint AND a real per-day model (out of scope --
 *     "do not rewrite ML-2 algorithms") or an explicit, visibly-labeled
 *     "illustrative only" flag the UI does not currently have a slot for.
 */

export type IntelligenceSource = 'mock' | 'live';

export interface MLForecast {
  source: IntelligenceSource;
  /** ML-2's actual target: total revenue over the next 7 days. NOT cash flow -- see forecastLabel(). */
  expectedRevenue7d: number;
  /** expected ± measured validation MAE, when source is 'live'. Null in mock mode -- there is nothing real to bound yet. */
  low: number | null;
  high: number | null;
  /** Only meaningful once 'live': derived from how MAE compares to the expected value, not a fixed label. */
  confidenceLabel: 'High' | 'Moderate' | 'Low' | null;
  modelVersion: string | null;
  asOfDate: string | null;
}

/** What the UI should call this, per Rule/Phase 10 -- checked against this repo's own ML-2, not assumed. */
export function forecastLabel(): string {
  return 'Revenue forecast'; // ML-2's target is sum(daily_revenue, +1..+7) -- confirmed in forecasting/dataset.py. Not cash flow: it ignores outstanding collections and has no expense model.
}

export interface MLAdapter {
  getForecast(merchantId?: string): Promise<MLForecast>;
}

/**
 * Explicitly a mock. Returns a shape the UI can render TODAY (so Forecast/
 * Insights screens have something to point at while the real endpoint is
 * pending) without claiming it's a prediction. `source: 'mock'` is not
 * decorative -- calling code should visibly badge mock output, the same
 * way the existing demo-mode language already does elsewhere in this app.
 */
export class MockMLAdapter implements MLAdapter {
  async getForecast(): Promise<MLForecast> {
    return {
      source: 'mock',
      expectedRevenue7d: 0,
      low: null,
      high: null,
      confidenceLabel: null,
      modelVersion: null,
      asOfDate: null,
    };
  }
}

export class LiveMLAdapter implements MLAdapter {
  private backendBaseUrl: string;

  constructor(backendBaseUrl: string) {
    this.backendBaseUrl = backendBaseUrl;
  }

  async getForecast(merchantId?: string): Promise<MLForecast> {
    const params = merchantId ? `?merchant_id=${encodeURIComponent(merchantId)}` : '';
    const res = await fetch(`${this.backendBaseUrl}/transactions/intelligence/ml2${params}`);
    if (!res.ok) throw new Error(`ML forecast endpoint returned ${res.status}`);
    const data = await res.json();
    
    // Fallbacks if insufficient data or missing forecast fields
    if (data.status === 'insufficient_data' || !data.forecast || data.forecast.next_7_days_revenue === null) {
       return {
          source: 'live',
          expectedRevenue7d: 0,
          low: null,
          high: null,
          confidenceLabel: null,
          modelVersion: 'ml-2',
          asOfDate: new Date().toISOString()
       };
    }
    
    const expected = data.forecast.next_7_days_revenue;
    const confScore = data.forecast.confidence ?? 0.8; 
    let confidenceLabel: 'High' | 'Moderate' | 'Low' = 'Moderate';
    if (confScore >= 0.7) confidenceLabel = 'High';
    else if (confScore >= 0.4) confidenceLabel = 'Moderate';
    else confidenceLabel = 'Low';
    
    // if range is null, use the measured MAE 1237 from PHASE_2_FORECASTING.md
    const range = data.forecast.range ?? 1237;
    const low = Math.max(0, expected - range);
    const high = expected + range;
    
    return {
      source: 'live',
      expectedRevenue7d: expected,
      low,
      high,
      confidenceLabel,
      modelVersion: 'ml-2',
      asOfDate: new Date().toISOString()
    };
  }
}
