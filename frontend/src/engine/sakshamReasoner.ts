/**
 * SAKSHAM Local Reasoner
 * =======================
 * Converts structured Economic Engine output into natural-language responses.
 *
 * Architecture rule: The Reasoner NEVER performs business math.
 * It ONLY narrates what the Economic Engine calculated.
 *
 * Current implementation: deterministic template responses.
 * The interface is designed so a local LLM (e.g. Ollama) can replace
 * the templates without touching any other code.
 *
 * If the LLM is unavailable: templates run. The product still works.
 */

import type {
  EconomicMemoryEntry,
  MarginIntel,
  ProductDemandIntel,
  ReorderRecommendation,
  SakshamIntent,
  SakshamResponse,
  StockoutPrediction,
} from '../types';
import type { ProductAnalysis } from './economicEngine';
import { formatRupees } from '../utils/format';

// ─────────────────────────────────────────────────────────────────────────────
// Response templates
// ─────────────────────────────────────────────────────────────────────────────

function explainReorder(rec: ReorderRecommendation): string {
  const { productName, recommendedQuantity, unit, estimatedCost, supplierName, stockoutPrediction, demandIntel } = rec;
  return (
    `Buy ${recommendedQuantity} ${unit} of ${productName} from ${supplierName}. ` +
    `Stock runs out ${stockoutPrediction.stockoutTimeEstimate.toLowerCase()} ` +
    `at the current demand of ${demandIntel.avgDailyDemand.toFixed(1)} ${unit}/day. ` +
    `This covers approximately ${rec.daysOfStockProvided} days and will cost ${formatRupees(estimatedCost)}.`
  );
}

function explainDemand(demand: ProductDemandIntel): string {
  const dir = demand.demandTrendPercent >= 0 ? 'up' : 'down';
  return (
    `${demand.productName} demand is ${dir} ${Math.abs(demand.demandTrendPercent)}% ` +
    `compared to the previous ${Math.round(demand.period / 2)}-day period. ` +
    `You're selling an average of ${demand.avgDailyDemand.toFixed(1)} ${demand.unit}/day.`
  );
}

function explainMargin(margin: MarginIntel): string {
  if (margin.marginChange === null) {
    return `${margin.productName} margin is ${margin.currentMarginPercent.toFixed(1)}%. No price change detected.`;
  }
  const dir = margin.marginChange >= 0 ? 'improved' : 'fell';
  return (
    `${margin.productName} margin ${dir} from ${margin.previousMarginPercent?.toFixed(1)}% ` +
    `to ${margin.currentMarginPercent.toFixed(1)}% ` +
    `because ${margin.supplierName} raised the purchase price ` +
    `from ₹${margin.previousPurchasePrice} to ₹${margin.currentPurchasePrice} per ${margin.unit ?? 'unit'}.`
  );
}

function explainStockout(stockout: StockoutPrediction): string {
  return (
    `${stockout.productName} has ${stockout.currentStock} ${stockout.unit} remaining. ` +
    `At ${stockout.dailyDemand.toFixed(1)} ${stockout.unit}/day, ` +
    `it runs out ${stockout.stockoutTimeEstimate.toLowerCase()}.`
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LocalReasoner
// ─────────────────────────────────────────────────────────────────────────────

export class LocalReasoner {
  /**
   * Answer a business intent using pre-computed Economic Engine data.
   * Never calls an LLM. Returns a SakshamResponse backed by real calculations.
   */
  static answer(
    intent: SakshamIntent,
    analyses: ProductAnalysis[],
    memoryEntries: EconomicMemoryEntry[],
  ): SakshamResponse {
    const computedOffline = true; // always true for template reasoner

    switch (intent.kind) {
      case 'what_to_buy':
        return LocalReasoner.answerWhatToBuy(intent, analyses, computedOffline);

      case 'fastest_selling':
        return LocalReasoner.answerFastestSelling(intent, analyses, computedOffline);

      case 'why_low_stock':
        return LocalReasoner.answerWhyLowStock(intent, analyses, computedOffline);

      case 'why_margin_fell':
        return LocalReasoner.answerWhyMarginFell(intent, analyses, computedOffline);

      case 'which_supplier_raised_price':
        return LocalReasoner.answerSupplierPrice(intent, analyses, computedOffline);

      case 'working_capital_needed':
        return LocalReasoner.answerWorkingCapital(intent, analyses, computedOffline);

      case 'what_changed':
        return LocalReasoner.answerWhatChanged(intent, memoryEntries, computedOffline);

      case 'stockout_risk':
        return LocalReasoner.answerStockoutRisk(intent, analyses, computedOffline);

      case 'revenue_today':
        return {
          intent,
          headline: 'Check your home screen',
          explanation: "Today's sales are shown on your home screen and update as you record sales.",
          evidence: [],
          actionRoute: '/',
          actionLabel: 'Go to Home',
          computedOffline,
        };

      default:
        return {
          intent,
          headline: "I'm not sure what you're asking",
          explanation:
            "Try asking: 'What should I buy?', 'Which product sells fastest?', or 'What changed this week?'",
          evidence: [],
          computedOffline,
        };
    }
  }

  private static answerWhatToBuy(
    intent: SakshamIntent,
    analyses: ProductAnalysis[],
    computedOffline: boolean,
  ): SakshamResponse {
    const urgent = analyses
      .filter((a) => a.stockout.isUrgent)
      .sort((a, b) => a.stockout.daysUntilStockout - b.stockout.daysUntilStockout);

    if (urgent.length === 0) {
      const soon = analyses
        .filter((a) => a.stockout.riskLevel === 'medium')
        .sort((a, b) => a.stockout.daysUntilStockout - b.stockout.daysUntilStockout);
      if (soon.length === 0) {
        return {
          intent,
          headline: 'All products look adequately stocked',
          explanation: 'No immediate restocking needed based on current inventory and demand.',
          evidence: [{ label: 'Products analysed', value: String(analyses.length) }],
          computedOffline,
        };
      }
      const top = soon[0];
      return {
        intent,
        headline: `Consider restocking ${top.product.name} soon`,
        keyMetric: `${top.recommendation.recommendedQuantity} ${top.product.unit} — ${formatRupees(top.recommendation.estimatedCost)}`,
        explanation: explainReorder(top.recommendation),
        evidence: [
          { label: 'Current stock', value: `${top.stockout.currentStock} ${top.product.unit}` },
          { label: 'Daily demand', value: `${top.demand.avgDailyDemand.toFixed(1)} ${top.product.unit}/day` },
          { label: 'Days remaining', value: `${top.inventory.daysRemaining.toFixed(1)} days` },
        ],
        actionRoute: `/recommendation/${top.product.id}`,
        actionLabel: 'See recommendation',
        recommendation: top.recommendation,
        computedOffline,
      };
    }

    const top = urgent[0];
    return {
      intent,
      headline: `Buy ${top.recommendation.recommendedQuantity} ${top.product.unit} of ${top.product.name}`,
      keyMetric: `${formatRupees(top.recommendation.estimatedCost)} from ${top.product.supplierName}`,
      explanation: explainReorder(top.recommendation),
      evidence: [
        { label: 'Current stock', value: `${top.stockout.currentStock} ${top.product.unit}` },
        { label: 'Daily demand', value: `${top.demand.avgDailyDemand.toFixed(1)} ${top.product.unit}/day` },
        { label: 'Stockout', value: top.stockout.stockoutTimeEstimate },
        { label: 'Demand trend', value: `${top.demand.demandTrendPercent > 0 ? '+' : ''}${top.demand.demandTrendPercent}%` },
      ],
      actionRoute: `/recommendation/${top.product.id}`,
      actionLabel: 'See full recommendation',
      recommendation: top.recommendation,
      computedOffline,
    };
  }

  private static answerFastestSelling(
    intent: SakshamIntent,
    analyses: ProductAnalysis[],
    computedOffline: boolean,
  ): SakshamResponse {
    const rising = analyses
      .filter((a) => a.demand.demandVelocity === 'rising')
      .sort((a, b) => b.demand.demandTrendPercent - a.demand.demandTrendPercent);

    if (rising.length === 0) {
      const byDemand = [...analyses].sort(
        (a, b) => b.demand.avgDailyDemand - a.demand.avgDailyDemand,
      );
      const top = byDemand[0];
      return {
        intent,
        headline: `${top.product.name} has the highest daily demand`,
        keyMetric: `${top.demand.avgDailyDemand.toFixed(1)} ${top.product.unit}/day`,
        explanation: explainDemand(top.demand),
        evidence: [
          { label: 'Avg daily demand', value: `${top.demand.avgDailyDemand.toFixed(1)} ${top.product.unit}/day` },
          { label: '14-day total', value: `${top.demand.totalSold.toFixed(1)} ${top.product.unit}` },
        ],
        computedOffline,
      };
    }

    const top = rising[0];
    return {
      intent,
      headline: `${top.product.name} is growing fastest at +${top.demand.demandTrendPercent}%`,
      keyMetric: `${top.demand.avgDailyDemand.toFixed(1)} ${top.product.unit}/day`,
      explanation: explainDemand(top.demand),
      evidence: [
        { label: 'Demand trend', value: `+${top.demand.demandTrendPercent}%` },
        { label: 'Week 1 avg', value: `${top.demand.week1AvgDemand.toFixed(1)} ${top.product.unit}/day` },
        { label: 'Week 2 avg', value: `${top.demand.week2AvgDemand.toFixed(1)} ${top.product.unit}/day` },
      ],
      computedOffline,
    };
  }

  private static answerWhyLowStock(
    intent: SakshamIntent,
    analyses: ProductAnalysis[],
    computedOffline: boolean,
  ): SakshamResponse {
    const target = intent.productId
      ? analyses.find((a) => a.product.id === intent.productId)
      : analyses
          .filter((a) => a.stockout.isUrgent)
          .sort((a, b) => a.stockout.daysUntilStockout - b.stockout.daysUntilStockout)[0];

    if (!target) {
      return {
        intent,
        headline: 'No product with critically low stock right now',
        explanation: 'All tracked products appear adequately stocked for the coming days.',
        evidence: [],
        computedOffline,
      };
    }

    return {
      intent,
      headline: `${target.product.name} stock is low because demand has risen ${Math.abs(target.demand.demandTrendPercent)}%`,
      keyMetric: `${target.stockout.currentStock} ${target.product.unit} remaining`,
      explanation: explainStockout(target.stockout) + ' ' + explainDemand(target.demand),
      evidence: [
        { label: 'Current stock', value: `${target.stockout.currentStock} ${target.product.unit}` },
        { label: 'Demand trend', value: `+${target.demand.demandTrendPercent}%` },
        { label: 'Days remaining', value: `${target.inventory.daysRemaining.toFixed(1)} days` },
      ],
      actionRoute: `/recommendation/${target.product.id}`,
      actionLabel: 'See recommendation',
      computedOffline,
    };
  }

  private static answerWhyMarginFell(
    intent: SakshamIntent,
    analyses: ProductAnalysis[],
    computedOffline: boolean,
  ): SakshamResponse {
    const declined = analyses
      .filter((a) => a.margin.marginTrend === 'declining')
      .sort((a, b) => (a.margin.marginChange ?? 0) - (b.margin.marginChange ?? 0));

    if (declined.length === 0) {
      return {
        intent,
        headline: 'No margin decline detected in tracked products',
        explanation: 'Your margins are holding steady. Keep an eye on supplier invoices.',
        evidence: [],
        computedOffline,
      };
    }

    const top = declined[0];
    return {
      intent,
      headline: `${top.product.name} margin fell from ${top.margin.previousMarginPercent?.toFixed(1)}% to ${top.margin.currentMarginPercent.toFixed(1)}%`,
      keyMetric: `${top.margin.marginChange?.toFixed(1)} percentage points`,
      explanation: explainMargin(top.margin),
      evidence: [
        { label: 'Old purchase price', value: `₹${top.margin.previousPurchasePrice}/${top.product.unit}` },
        { label: 'New purchase price', value: `₹${top.margin.currentPurchasePrice}/${top.product.unit}` },
        { label: 'Selling price', value: `₹${top.margin.sellingPrice}/${top.product.unit}` },
        { label: 'Margin change', value: `${top.margin.marginChange?.toFixed(1)}pp` },
      ],
      actionRoute: '/memory',
      actionLabel: 'See Economic Memory',
      computedOffline,
    };
  }

  private static answerSupplierPrice(
    intent: SakshamIntent,
    analyses: ProductAnalysis[],
    computedOffline: boolean,
  ): SakshamResponse {
    const changed = analyses
      .filter((a) => a.margin.previousPurchasePrice !== null)
      .sort(
        (a, b) =>
          (b.margin.currentPurchasePrice - (b.margin.previousPurchasePrice ?? 0)) -
          (a.margin.currentPurchasePrice - (a.margin.previousPurchasePrice ?? 0)),
      );

    if (changed.length === 0) {
      return {
        intent,
        headline: 'No supplier price changes recorded recently',
        explanation: 'All product prices are the same as in previous invoices.',
        evidence: [],
        computedOffline,
      };
    }

    const lines = changed.map((a) => ({
      label: `${a.product.supplierName} — ${a.product.name}`,
      value: `₹${a.margin.previousPurchasePrice} → ₹${a.margin.currentPurchasePrice}/${a.product.unit}`,
    }));

    return {
      intent,
      headline: `${changed[0].product.supplierName} raised ${changed[0].product.name} price`,
      keyMetric: `₹${changed[0].margin.previousPurchasePrice} → ₹${changed[0].margin.currentPurchasePrice}/${changed[0].product.unit}`,
      explanation: `${changed.length} product${changed.length > 1 ? 's have' : ' has'} seen price changes. ${explainMargin(changed[0].margin)}`,
      evidence: lines.slice(0, 4),
      actionRoute: '/memory',
      actionLabel: 'See Economic Memory',
      computedOffline,
    };
  }

  private static answerWorkingCapital(
    intent: SakshamIntent,
    analyses: ProductAnalysis[],
    computedOffline: boolean,
  ): SakshamResponse {
    const urgent = analyses.filter(
      (a) => a.recommendation.priority === 'urgent' || a.recommendation.priority === 'soon',
    );

    if (urgent.length === 0) {
      return {
        intent,
        headline: 'No immediate restocking capital required',
        explanation: 'Your current stock levels are adequate. No urgent purchases needed.',
        evidence: [],
        computedOffline,
      };
    }

    const total = urgent.reduce((s, a) => s + a.recommendation.estimatedCost, 0);
    const lines = urgent.map((a) => ({
      label: `${a.product.name} (${a.recommendation.recommendedQuantity} ${a.product.unit})`,
      value: formatRupees(a.recommendation.estimatedCost),
    }));

    return {
      intent,
      headline: `You need ${formatRupees(total)} for immediate restocking`,
      keyMetric: formatRupees(total),
      explanation: `${urgent.length} product${urgent.length > 1 ? 's need' : ' needs'} urgent restocking. The total purchase cost is ${formatRupees(total)}.`,
      evidence: [{ label: 'Total required', value: formatRupees(total) }, ...lines],
      computedOffline,
    };
  }

  private static answerWhatChanged(
    intent: SakshamIntent,
    memoryEntries: EconomicMemoryEntry[],
    computedOffline: boolean,
  ): SakshamResponse {
    if (memoryEntries.length === 0) {
      return {
        intent,
        headline: 'No significant business changes detected',
        explanation: 'Your business metrics are stable compared to the previous period.',
        evidence: [],
        computedOffline,
      };
    }

    const top = memoryEntries[0];
    const evidence = memoryEntries.slice(0, 4).map((e) => ({
      label: e.headline,
      value: `${e.beforeValue} → ${e.afterValue}`,
    }));

    return {
      intent,
      headline: `${memoryEntries.length} business changes detected`,
      keyMetric: top.headline,
      explanation: `The most significant change: ${top.headline}. ${memoryEntries.length > 1 ? `Plus ${memoryEntries.length - 1} more change${memoryEntries.length - 1 > 1 ? 's' : ''}.` : ''}`,
      evidence,
      actionRoute: '/memory',
      actionLabel: 'See all changes',
      computedOffline,
    };
  }

  private static answerStockoutRisk(
    intent: SakshamIntent,
    analyses: ProductAnalysis[],
    computedOffline: boolean,
  ): SakshamResponse {
    const target = intent.productId
      ? analyses.find((a) => a.product.id === intent.productId)
      : analyses
          .filter((a) => a.stockout.isUrgent)
          .sort((a, b) => a.stockout.daysUntilStockout - b.stockout.daysUntilStockout)[0];

    if (!target) {
      return {
        intent,
        headline: 'No immediate stockout risk',
        explanation: 'All products have enough stock for the coming days.',
        evidence: [],
        computedOffline,
      };
    }

    return {
      intent,
      headline: `${target.product.name}: ${target.stockout.stockoutTimeEstimate}`,
      keyMetric: `${target.stockout.currentStock} ${target.product.unit} remaining`,
      explanation: explainStockout(target.stockout),
      evidence: [
        { label: 'Current stock', value: `${target.stockout.currentStock} ${target.product.unit}` },
        { label: 'Daily demand', value: `${target.stockout.dailyDemand.toFixed(1)} ${target.product.unit}/day` },
        { label: 'Stockout', value: target.stockout.stockoutTimeEstimate },
      ],
      actionRoute: `/recommendation/${target.product.id}`,
      actionLabel: 'See recommendation',
      recommendation: target.recommendation,
      computedOffline,
    };
  }
}
