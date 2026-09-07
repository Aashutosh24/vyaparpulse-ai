/**
 * SAKSHAM OCR Engine
 * ==================
 * Camera → Invoice → Structured Evidence
 *
 * Two paths:
 * 1. DEMO PATH: If the image matches the demo invoice (by embedded QR
 *    or detection pattern), return pre-extracted data instantly.
 * 2. REAL PATH: Tesseract.js — runs locally in the browser, no cloud.
 *
 * Tesseract.js is loaded lazily (dynamic import) so it doesn't bloat
 * the main bundle. The OCR worker is initialized once and reused.
 *
 * LIMITATIONS (honest):
 * - Works best on clear, printed invoices in good lighting.
 * - Handwritten invoices are NOT supported.
 * - Hindi/Tamil invoice text extraction is not reliable in this version.
 * - The extraction logic is tuned for the ABC Wholesale invoice format.
 *
 * For the demo: always use the demo fast-path for the controlled invoice.
 */

import { demoOcrResult } from '../data/sakshamDemoData';
import type { SupplierInvoiceType } from '../types';

// ─── Tesseract lazy loader ────────────────────────────────────────────────────

type TesseractWorker = {
  recognize: (image: string | Blob | HTMLImageElement | HTMLCanvasElement) => Promise<{ data: { text: string } }>;
  terminate: () => void;
};

let _worker: TesseractWorker | null = null;

async function getTesseractWorker(): Promise<TesseractWorker | null> {
  try {
    // Dynamic import — only loaded when OCR is actually needed
    const Tesseract = await import(/* @vite-ignore */ 'tesseract.js');
    if (_worker) return _worker;
    _worker = await Tesseract.createWorker('eng', 1, {
      // Keeps the worker lean for mobile
      logger: () => {},
    });
    return _worker;
  } catch {
    console.warn('OCR: Tesseract.js not available. Using demo path only.');
    return null;
  }
}

// ─── Demo detection ───────────────────────────────────────────────────────────

/**
 * Detect if the OCR text matches the demo invoice.
 * Looks for distinctive text patterns from the ABC Wholesale invoice.
 */
function isDemoInvoice(text: string): boolean {
  const normalized = text.toLowerCase();
  return (
    normalized.includes('abc wholesale') ||
    normalized.includes('abc/2026/0905') ||
    (normalized.includes('tea') && normalized.includes('306'))
  );
}

// ─── Invoice line parser ──────────────────────────────────────────────────────

interface ParsedLine {
  productName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  total: number;
}

/**
 * Extract structured line items from raw OCR text.
 *
 * Handles common printed invoice formats:
 *   Tea (loose)    5 kg    306    1530
 *   Tea loose 5kg @306 = 1530
 *
 * Returns empty array if parsing fails — never fabricates data.
 */
function parseInvoiceLines(text: string): ParsedLine[] {
  const lines: ParsedLine[] = [];
  const rows = text.split('\n').map((l) => l.trim()).filter(Boolean);

  for (const row of rows) {
    // Pattern: Name | Qty | Unit | Price | Total
    // Try to extract numbers at end of line
    const numbers = row.match(/[\d,.]+/g)?.map((n) => parseFloat(n.replace(/,/g, ''))) ?? [];
    if (numbers.length < 2) continue;

    // Last number is likely total, second-to-last is price
    const total = numbers[numbers.length - 1];
    const unitPrice = numbers[numbers.length - 2];
    const qty = numbers.length >= 3 ? numbers[numbers.length - 3] : total / unitPrice;

    // Extract product name: text before the first number
    const namePart = row.replace(/[\d,. ×x@=]+.*$/, '').trim();
    if (!namePart || namePart.length < 2) continue;

    // Extract unit if present (kg, L, pkt, pcs)
    const unitMatch = row.match(/\b(kg|kgs|litre|ltr|L|pkt|pkts|pcs|piece|bag|bags|pack)\b/i);
    const unit = unitMatch ? unitMatch[1].toLowerCase() : 'unit';

    if (unitPrice > 0 && total > 0 && qty > 0) {
      lines.push({
        productName: namePart,
        quantity: qty,
        unit,
        unitPrice,
        total,
      });
    }
  }

  return lines;
}

/**
 * Extract supplier name from OCR text.
 * Looks for common patterns: first line, "Supplier:", "FROM:", etc.
 */
function extractSupplierName(text: string): string {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

  // Check first few lines for supplier name
  for (const line of lines.slice(0, 5)) {
    if (/wholesale|trader|supplier|distributor|store|mart/i.test(line)) {
      return line.replace(/[^\w\s]/g, '').trim();
    }
  }

  // Look for "From:" or "Supplier:" prefix
  const supplierMatch = text.match(/(?:from|supplier|vendor)[:\s]+([A-Z][^\n]+)/i);
  if (supplierMatch) return supplierMatch[1].trim();

  return lines[0] ?? 'Unknown Supplier';
}

/**
 * Extract invoice number from OCR text.
 */
function extractInvoiceNumber(text: string): string | undefined {
  const match = text.match(/(?:invoice|inv|bill|no)[.\s#:]+([A-Z0-9/\-]+)/i);
  return match ? match[1].trim() : undefined;
}

/**
 * Extract invoice date from OCR text.
 */
function extractInvoiceDate(text: string): string {
  // Try DD/MM/YYYY or DD-MM-YYYY or YYYY-MM-DD
  const dateMatch = text.match(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\b/);
  if (dateMatch) {
    const [, d, m, y] = dateMatch;
    const year = y.length === 2 ? `20${y}` : y;
    return `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return new Date().toISOString().split('T')[0];
}

// ─── OCREngine ────────────────────────────────────────────────────────────────

export interface OCRResult {
  invoice: SupplierInvoiceType;
  rawText: string;
  source: 'demo' | 'tesseract' | 'failed';
  confidence: number;
}

export class OCREngine {
  /**
   * Parse an invoice image and return structured data.
   *
   * @param imageSource - base64 data URL, Blob, or canvas element
   * @param forceDemo - always return demo result (for reliable demo path)
   */
  static async parseInvoice(
    imageSource: string | Blob | HTMLCanvasElement,
    forceDemo = false,
  ): Promise<OCRResult> {
    const id = `inv-scanned-${Date.now()}`;
    const now = new Date().toISOString();

    // DEMO PATH: immediately return pre-extracted data
    if (forceDemo) {
      return {
        invoice: {
          id,
          supplierName: demoOcrResult.supplier,
          invoiceNumber: demoOcrResult.invoiceNumber,
          invoiceDate: demoOcrResult.invoiceDate,
          lines: demoOcrResult.lines.map((l) => ({
            productName: l.productName,
            quantity: l.quantity,
            unit: l.unit,
            unitPrice: l.unitPrice,
            totalAmount: l.total,
          })),
          grandTotal: demoOcrResult.grandTotal,
          source: 'demo',
          ocrConfidence: demoOcrResult.confidence,
          addedAt: now,
        },
        rawText: '',
        source: 'demo',
        confidence: demoOcrResult.confidence,
      };
    }

    // REAL PATH: use Tesseract.js
    const worker = await getTesseractWorker();

    if (!worker) {
      // OCR unavailable — return a failed result rather than fabricating data
      return {
        invoice: {
          id,
          supplierName: 'Unknown',
          invoiceDate: new Date().toISOString().split('T')[0],
          lines: [],
          grandTotal: 0,
          source: 'scanned',
          ocrConfidence: 0,
          addedAt: now,
        },
        rawText: '',
        source: 'failed',
        confidence: 0,
      };
    }

    try {
      const result = await worker.recognize(imageSource as any);
      const rawText = result.data.text;

      // Check if this is the demo invoice
      if (isDemoInvoice(rawText)) {
        return OCREngine.parseInvoice(imageSource, true);
      }

      // Parse the OCR text
      const lines = parseInvoiceLines(rawText);
      const supplierName = extractSupplierName(rawText);
      const invoiceNumber = extractInvoiceNumber(rawText);
      const invoiceDate = extractInvoiceDate(rawText);
      const grandTotal = lines.reduce((s, l) => s + l.total, 0);

      // Confidence heuristic: more valid lines = higher confidence
      const confidence = lines.length > 0 ? Math.min(0.9, 0.4 + lines.length * 0.1) : 0.1;

      return {
        invoice: {
          id,
          supplierName,
          invoiceNumber,
          invoiceDate,
          lines: lines.map((l) => ({
            productName: l.productName,
            quantity: l.quantity,
            unit: l.unit,
            unitPrice: l.unitPrice,
            totalAmount: l.total,
          })),
          grandTotal: Math.round(grandTotal * 100) / 100,
          source: 'scanned',
          ocrConfidence: confidence,
          addedAt: now,
        },
        rawText,
        source: 'tesseract',
        confidence,
      };
    } catch (err) {
      console.error('OCR failed:', err);
      return {
        invoice: {
          id,
          supplierName: 'Could not read',
          invoiceDate: new Date().toISOString().split('T')[0],
          lines: [],
          grandTotal: 0,
          source: 'scanned',
          ocrConfidence: 0,
          addedAt: now,
        },
        rawText: '',
        source: 'failed',
        confidence: 0,
      };
    }
  }

  /** Clean up the Tesseract worker when done. Call on app unmount if needed. */
  static terminate() {
    _worker?.terminate();
    _worker = null;
  }
}
