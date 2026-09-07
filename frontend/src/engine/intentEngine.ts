/**
 * SAKSHAM Intent Engine
 * =====================
 * Extracts business query intent from natural language (voice or text).
 *
 * Pattern matching only — no LLM. This runs offline.
 * Handles English and common transliterated Hindi/Tamil keywords.
 *
 * Design: if a query is ambiguous, we return 'unknown' with low confidence
 * rather than guessing wrong and giving a misleading recommendation.
 */

import type { SakshamIntent, SakshamIntentKind } from '../types';

// ─── Pattern definitions ─────────────────────────────────────────────────────

interface IntentPattern {
  kind: SakshamIntentKind;
  patterns: RegExp[];
  productHints?: string[]; // productId hints if the pattern implies a product
  confidence: number;      // base confidence for this pattern (0-1)
}

const INTENT_PATTERNS: IntentPattern[] = [
  {
    kind: 'what_to_buy',
    patterns: [
      /what\s+(should\s+i\s+)?buy/i,
      /what\s+to\s+(buy|order|purchase|stock)/i,
      /kal\s+kya\s+lena/i,          // Hindi: "tomorrow what to get"
      /naalaiku.*stock/i,            // Tamil: "tomorrow stock"
      /kal.*kharidna/i,              // Hindi: "tomorrow buy"
      /reorder|re.?order/i,
      /kya\s+manga/i,                // Hindi: "what to order"
      /stock\s+(karna|bharna)/i,     // Hindi: "fill stock"
      /purchase\s+list/i,
      /shopping\s+list/i,
    ],
    confidence: 0.9,
  },
  {
    kind: 'fastest_selling',
    patterns: [
      /fastest\s+selling/i,
      /best\s+selling/i,
      /most\s+popular/i,
      /top\s+product/i,
      /highest\s+demand/i,
      /what\s+(is\s+)?selling/i,
      /kya\s+zyada\s+bik/i,          // Hindi: "what sells more"
      /ziyada.*bikta/i,
    ],
    confidence: 0.85,
  },
  {
    kind: 'why_low_stock',
    patterns: [
      /why\s+(is\s+)?(stock|inventory)\s+low/i,
      /why\s+(is\s+)?(my\s+)?(\w+)\s+(stock|inventory)\s+low/i,
      /stock\s+kum\s+kyu/i,          // Hindi: "stock low why"
      /kam\s+(stock|maal)/i,         // Hindi: "less stock"
      /(\w+)\s+khatam\s+hoga/i,      // Hindi: "X will finish"
      /(\w+)\s+kab\s+khatam/i,       // Hindi: "X when finish"
      /(\w+)\s+stock.*low/i,
      /running\s+out\s+of/i,
      /low\s+stock/i,
    ],
    confidence: 0.8,
  },
  {
    kind: 'why_margin_fell',
    patterns: [
      /why\s+(did\s+)?(my\s+)?margin\s+(fall|drop|decrease|reduce)/i,
      /margin\s+(gir|kum)\s+kyu/i,  // Hindi: "margin fell why"
      /profit\s+(kam|gira)/i,        // Hindi: "profit less/fell"
      /margin.*fall/i,
      /profit.*down/i,
    ],
    confidence: 0.85,
  },
  {
    kind: 'which_supplier_raised_price',
    patterns: [
      /which\s+supplier\s+(increased|raised|hiked)\s+price/i,
      /supplier\s+(ne\s+)?(price|rate)\s+badha/i, // Hindi
      /price\s+(badha|increase)/i,
      /rate\s+change/i,
      /supplier.*price.*up/i,
      /price.*increase.*supplier/i,
      /kaunse\s+supplier/i,          // Hindi: "which supplier"
    ],
    confidence: 0.85,
  },
  {
    kind: 'working_capital_needed',
    patterns: [
      /how\s+much\s+money/i,
      /kitne\s+(paise|rupee|rupaye)/i, // Hindi: "how much money"
      /working\s+capital/i,
      /how\s+much.*stock/i,
      /kitna\s+lagega/i,             // Hindi: "how much will it cost"
      /cash\s+(needed|required|chahiye)/i,
      /stock.*kitne\s+ka/i,          // Hindi: "stock how much worth"
    ],
    confidence: 0.8,
  },
  {
    kind: 'what_changed',
    patterns: [
      /what\s+changed/i,
      /kya\s+badla/i,                // Hindi: "what changed"
      /this\s+week.*change/i,
      /business.*change/i,
      /aaj.*kya\s+hua/i,             // Hindi: "today what happened"
      /is\s+hafte.*kya/i,            // Hindi: "this week what"
      /economic\s+memory/i,
    ],
    confidence: 0.85,
  },
  {
    kind: 'stockout_risk',
    patterns: [
      /stockout/i,
      /kab.*khatam/i,                // Hindi: "when finish"
      /when.*run.*out/i,
      /kitne\s+din.*stock/i,         // Hindi: "how many days stock"
      /days.*left/i,
      /stock.*remaining/i,
    ],
    confidence: 0.8,
  },
  {
    kind: 'revenue_today',
    patterns: [
      /today.*revenue/i,
      /today.*sales/i,
      /aaj.*kitna/i,                 // Hindi: "today how much"
      /aaj.*bikri/i,                 // Hindi: "today sales"
    ],
    confidence: 0.9,
  },
];

// ─── Product name → ID mapping ────────────────────────────────────────────────

const PRODUCT_KEYWORDS: { keywords: RegExp[]; productId: string }[] = [
  { keywords: [/\btea\b/i, /\bchai\b/i, /\bchay\b/i], productId: 'tea' },
  { keywords: [/\brice\b/i, /\bchawal\b/i], productId: 'rice-5kg' },
  { keywords: [/\boil\b/i, /\btel\b/i, /\btail\b/i], productId: 'oil-1l' },
  { keywords: [/\bsugar\b/i, /\bcheeni\b/i, /\bchini\b/i], productId: 'sugar-1kg' },
  { keywords: [/\bdetergent\b/i, /\bsabun\b/i, /\bwashing\b/i], productId: 'detergent' },
  { keywords: [/\bnotebook\b/i, /\bcopy\b/i, /\bkitab\b/i], productId: 'notebook' },
  { keywords: [/\bbiscuit\b/i, /\bparle\b/i], productId: 'biscuit-parle' },
  { keywords: [/\bsalt\b/i, /\bnamak\b/i], productId: 'salt-1kg' },
  { keywords: [/\bdaal\b/i, /\bdal\b/i, /\blentil\b/i], productId: 'daal-500g' },
  { keywords: [/\batta\b/i, /\bflour\b/i, /\bgehun\b/i], productId: 'atta-10kg' },
];

// ─── Intent extraction ────────────────────────────────────────────────────────

export class IntentEngine {
  /**
   * Extract business intent from text.
   *
   * Returns the highest-confidence matching intent.
   * If multiple patterns match, picks the most specific one.
   */
  static extract(text: string): SakshamIntent {
    const normalized = text.trim().toLowerCase();
    const now = new Date().toISOString();

    // Try to find a matching product
    let productId: string | undefined;
    for (const { keywords, productId: pid } of PRODUCT_KEYWORDS) {
      if (keywords.some((k) => k.test(normalized))) {
        productId = pid;
        break;
      }
    }

    // Score all intent patterns
    const scored: { kind: SakshamIntentKind; score: number }[] = [];
    for (const { kind, patterns, confidence } of INTENT_PATTERNS) {
      const matchCount = patterns.filter((p) => p.test(normalized)).length;
      if (matchCount > 0) {
        // More matching patterns = higher confidence
        scored.push({ kind, score: confidence * (1 + (matchCount - 1) * 0.1) });
      }
    }

    if (scored.length === 0) {
      return {
        kind: 'unknown',
        rawText: text,
        productId,
        confidence: 0,
        extractedAt: now,
      };
    }

    // Pick highest score
    scored.sort((a, b) => b.score - a.score);
    const best = scored[0];

    return {
      kind: best.kind,
      rawText: text,
      productId,
      confidence: Math.min(1, Math.round(best.score * 100) / 100),
      extractedAt: now,
    };
  }
}
