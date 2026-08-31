import { history, store } from '../data/mockData';
import { formatCompactRupees, formatRupees } from './format';
import type { MLForecast } from '../services/mlAdapter';
import type {
  BusinessHealth,
  Customer,
  CustomerAccount,
  ForecastSummary,
  HealthFactor,
  Insight,
  ProfileFactor,
  TodayTotals,
  Transaction,
  TrendPoint,
  WeekMetrics } from
'../types';

/**
 * The single derivation layer. Every aggregate the app shows comes from
 * here, computed from the live ledger — so Home, Ledger, Customers,
 * Insights, Forecast and the Financial Profile can never disagree.
 */

const round1k = (n: number) => Math.round(n / 1000) * 1000;

export function computeToday(transactions: Transaction[]): TodayTotals {
  const todays = transactions.filter((t) => t.dayLabel === 'Today');
  const sales = todays.reduce((s, t) => s + t.amount, 0);
  const received = todays.reduce((s, t) => s + t.receivedAmount, 0);
  const yesterday = history.priorDays[history.priorDays.length - 1]?.value ?? 0;
  return {
    sales,
    received,
    pending: sales - received,
    saleCount: todays.length,
    collectionRate: sales ? Math.round(received / sales * 100) : 0,
    changeVsYesterday: yesterday ? Math.round((sales - yesterday) / yesterday * 100) : 0
  };
}

/** Outstanding money across the whole ledger, not just today. */
export function computeOutstanding(transactions: Transaction[]) {
  const open = transactions.filter((t) => t.amount > t.receivedAmount);
  const amount = open.reduce((s, t) => s + (t.amount - t.receivedAmount), 0);
  const customerIds = new Set(open.map((t) => t.customerId).filter((id) => id !== 'unassigned'));
  return { amount, customerCount: customerIds.size, transactions: open };
}

export function computeSeries(today: TodayTotals): Record<'7D' | '30D' | '90D', TrendPoint[]> {
  const days: TrendPoint[] = [
  ...history.priorDays,
  { label: history.todayLabel, value: today.sales }];

  const weekRevenue = days.reduce((s, d) => s + d.value, 0);
  return {
    '7D': days,
    '30D': [...history.earlierWeeks, { label: 'W4', value: weekRevenue }],
    '90D': [
    ...history.earlierMonths,
    {
      label: history.currentMonthLabel,
      value: history.monthToDateBeforeThisWeek + weekRevenue
    }]

  };
}

export function computeWeek(transactions: Transaction[], today: TodayTotals): WeekMetrics {
  const days = computeSeries(today)['7D'];
  const revenue = days.reduce((s, d) => s + d.value, 0);
  const outstanding = computeOutstanding(transactions);
  const values = days.map((d) => d.value);
  const mean = revenue / days.length;
  const sd = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length);
  const variability = mean ? Math.round(sd / mean * 100) : 0;
  const strongest = days.reduce((best, d) => d.value > best.value ? d : best, days[0]);
  const growthPercent = history.lastWeekRevenue ?
  (revenue - history.lastWeekRevenue) / history.lastWeekRevenue * 100 :
  0;

  const dayNames: Record<string, string> = {
    Mon: 'Monday',
    Tue: 'Tuesday',
    Wed: 'Wednesday',
    Thu: 'Thursday',
    Fri: 'Friday',
    Sat: 'Saturday',
    Sun: 'Sunday'
  };
  const strongestDay = dayNames[strongest.label] ?? strongest.label;

  return {
    revenue,
    lastWeekRevenue: history.lastWeekRevenue,
    growthPercent: Math.round(growthPercent),
    collectionRate: revenue ? Math.round((revenue - outstanding.amount) / revenue * 100) : 0,
    outstanding: outstanding.amount,
    outstandingCustomers: outstanding.customerCount,
    transactionCount: history.priorWeekTransactions + today.saleCount,
    strongestDay,
    strongestDayValue: strongest.value,
    variability,
    daysWithSales: values.filter((v) => v > 0).length,
    reading:
    variability <= 18 ?
    'Your daily sales are staying consistent.' :
    `${strongestDay} is your strongest selling day.`
  };
}

export function computeHealth(week: WeekMetrics, today: TodayTotals): BusinessHealth {
  const reliability = week.collectionRate;
  const growth = Math.max(0, Math.min(100, 50 + week.growthPercent * 2));
  const consistency = Math.max(0, Math.min(100, 100 - week.variability * 1.5));
  const frequency = Math.min(100, week.daysWithSales / 7 * 100);
  const pendingDrag = week.revenue ?
  Math.min(20, week.outstanding / week.revenue * 100 * 1.5) :
  0;

  // Each factor's real contribution, so the explanation can show points.
  const pts = {
    reliability: reliability * 0.3,
    growth: growth * 0.25,
    consistency: consistency * 0.25,
    frequency: frequency * 0.2
  };
  const points = (value: number, max: number) => `+${Math.round(value)} of ${max} points`;

  const score = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        pts.reliability + pts.growth + pts.consistency + pts.frequency - pendingDrag
      )
    )
  );

  const band = score >= 80 ? 'Strong' : score >= 65 ? 'Good' : score >= 50 ? 'Building' : 'Early';

  const factors: HealthFactor[] = [
  {
    label: 'Revenue consistency',
    value: week.variability <= 18 ? 'Strong' : week.variability <= 28 ? 'Good' : 'Uneven',
    tone: week.variability <= 18 ? 'strong' : week.variability <= 28 ? 'positive' : 'watch',
    detail: `Your daily sales vary by about ${week.variability}% around ${formatRupees(
      Math.round(week.revenue / 7)
    )} a day.`,
    impact: points(pts.consistency, 25)
  },
  {
    label: 'Payment reliability',
    value: `${week.collectionRate}%`,
    tone: week.collectionRate >= 90 ? 'strong' : week.collectionRate >= 75 ? 'positive' : 'watch',
    detail: `${week.collectionRate}% of everything you sold this week has reached you. Today it is ${today.collectionRate}% so far.`,
    impact: points(pts.reliability, 30)
  },
  {
    label: 'Transaction frequency',
    value: `${week.daysWithSales}/7 days`,
    tone: week.daysWithSales >= 6 ? 'strong' : 'positive',
    detail: `You recorded ${week.transactionCount} sales this week, on ${week.daysWithSales} of 7 days.`,
    impact: points(pts.frequency, 20)
  },
  {
    label: 'Growth trend',
    value: `${week.growthPercent > 0 ? '+' : ''}${week.growthPercent}%`,
    tone: week.growthPercent >= 5 ? 'positive' : week.growthPercent >= 0 ? 'stable' : 'watch',
    detail: `This week is ${formatRupees(week.revenue)} against ${formatRupees(
      week.lastWeekRevenue
    )} last week.`,
    impact: points(pts.growth, 25)
  },
  {
    label: 'Pending payments',
    value: week.outstanding > 0 ? 'Watch' : 'Clear',
    tone: week.outstanding > 0 ? 'watch' : 'strong',
    detail:
    week.outstanding > 0 ?
    `${formatRupees(week.outstanding)} is still to be collected from ${
    week.outstandingCustomers} customer${
    week.outstandingCustomers === 1 ? '' : 's'}.` :
    'Every recorded sale has been paid for.',
    impact:
    week.outstanding > 0 ? `−${Math.round(pendingDrag)} points` : 'Nothing holding you back'
  }];


  const delta = score - history.previousHealthScore;

  return {
    score,
    previousScore: history.previousHealthScore,
    delta,
    band,
    factors,
    summary:
    delta === 0 ?
    `Your score is steady at ${score} out of 100.` :
    `Your score ${delta > 0 ? 'rose' : 'fell'} ${Math.abs(delta)} point${
    Math.abs(delta) === 1 ? '' : 's'} this week, to ${
    score} out of 100.`,
    why:
    week.outstanding > 0 ?
    `Sales are up ${week.growthPercent}% and ${week.collectionRate}% of them have reached you. Pending dues are the one thing holding the score back.` :
    `Sales are up ${week.growthPercent}% and every recorded sale has been paid for.`,
    action:
    week.outstanding > 0 ?
    `Collect the ${formatRupees(week.outstanding)} outstanding and your score should cross ${Math.min(
      100,
      score + Math.round(pendingDrag)
    )}.` :
    'Keep recording every sale to hold this score.'
  };
}

export function computeForecast(today: TodayTotals, week: WeekMetrics, ml: MLForecast | null): ForecastSummary {
  const days = computeSeries(today)['7D'];
  
  if (ml && ml.source === 'live') {
    if (ml.low !== null && ml.high !== null && ml.confidenceLabel !== null) {
      const expected = ml.expectedRevenue7d;
      const low = ml.low;
      const high = ml.high;
      const confidence = ml.confidenceLabel;
      
      const historicSum = days.reduce((acc, d) => acc + d.value, 0) || 1;
      const scale = expected / historicSum;
      const lowScale = low / expected;
      const highScale = high / expected;

      const series = days.map((d) => {
          const dExpected = Math.round(d.value * scale);
          return {
            label: d.label,
            expected: dExpected,
            low: Math.round(dExpected * lowScale),
            high: Math.round(dExpected * highScale)
          };
      });

      return {
        low,
        expected,
        high,
        confidence,
        confidenceReason: confidence === 'High' 
          ? `Your daily sales are very regular, so this range is tight. ${store.activeMonths} months of history sits behind it.`
          : `Your sales vary day to day, and ${store.activeMonths} months is still a short record — treat this as a range, not a promise.`,
        basis: 'Powered by VyaparPulse AI',
        action: `Safe to plan purchases up to ${formatRupees(low)} this week.`,
        series
      };
    } else {
      // Live mode but insufficient data from ML
      return {
        low: 0,
        expected: 0,
        high: 0,
        confidence: 'Low',
        confidenceReason: 'There is not enough history to predict your cash flow yet.',
        basis: 'A forecast needs at least two weeks of recorded sales.',
        action: 'Keep recording sales to unlock this.',
        series: []
      };
    }
  }
  
  // Fallback to mock / hardcoded logic ONLY if no live ML data
  const expected = round1k(week.revenue * 1.02);
  const low = round1k(expected * 0.955);
  const high = round1k(expected * 1.06);
  const confidence: ForecastSummary['confidence'] =
  week.variability <= 15 ? 'High' : week.variability <= 28 ? 'Moderate' : 'Low';

  return {
    low,
    expected,
    high,
    confidence,
    confidenceReason:
    confidence === 'High' ?
    `Your daily sales are very regular, so this range is tight. ${store.activeMonths} months of history sits behind it.` :
    `Your sales are regular but vary by about ${week.variability}% day to day, and ${store.activeMonths} months is still a short record — treat this as a range, not a promise.`,
    basis: 'Based on your recent sales and how quickly your customers pay.',
    action: `Safe to plan purchases up to ${formatRupees(low)} this week.`,
    series: days.map((d) => ({
      label: d.label,
      expected: Math.round(d.value * 1.02),
      low: Math.round(d.value * 0.95),
      high: Math.round(d.value * 1.08)
    }))
  };
}

export function buildInsights(
today: TodayTotals,
week: WeekMetrics,
forecast: ForecastSummary)
: Insight[] {
  const list: Insight[] = [
  {
    id: 'i-change',
    kind: 'change',
    headline: `Sales are ${week.growthPercent >= 0 ? 'up' : 'down'} ${Math.abs(
      week.growthPercent
    )}% this week`,
    metric: `${formatRupees(week.revenue)} this week`,
    why: `Last week you took ${formatRupees(
      week.lastWeekRevenue
    )}. ${week.strongestDay} alone brought ${formatRupees(week.strongestDayValue)}.`,
    action:
    week.growthPercent >= 0 ?
    `Keep stock ready for ${week.strongestDay}, your busiest day.` :
    'Check which products sold less than usual this week.',
    priority: 70
  },
  {
    id: 'i-pattern',
    kind: 'pattern',
    headline: `${week.strongestDay} is your strongest selling day`,
    metric: `${formatRupees(week.strongestDayValue)} on ${week.strongestDay}`,
    why: `${week.strongestDay} earns about ${Math.round(
      (week.strongestDayValue / (week.revenue / 7) - 1) * 100
    )}% more than your average day this week.`,
    action: `Restock rice and oil the evening before ${week.strongestDay}.`,
    priority: 40
  },
  {
    id: 'i-forecast',
    kind: 'forecast',
    headline: 'Expected cash flow next 7 days',
    metric: `${formatCompactRupees(forecast.low)} – ${formatCompactRupees(forecast.high)}`,
    why: `${forecast.basis} Confidence is ${forecast.confidence.toLowerCase()}.`,
    action: forecast.action,
    priority: 55
  }];


  if (week.outstanding > 0) {
    list.push({
      id: 'i-watch',
      kind: 'watch',
      headline: `${formatRupees(week.outstanding)} is still pending`,
      metric: `${week.outstandingCustomers} customer${
      week.outstandingCustomers === 1 ? '' : 's'} owe you`,

      why: `${formatRupees(today.pending)} of it is from today's sales. The rest has been waiting longer.`,
      action: `Send a reminder to the ${week.outstandingCustomers} customer${
      week.outstandingCustomers === 1 ? '' : 's'} with dues.`,

      priority: 90
    });
  } else {
    list.push({
      id: 'i-watch',
      kind: 'change',
      headline: 'Every sale has been paid for',
      metric: '₹0 outstanding',
      why: 'All recorded sales have a matching payment against them.',
      action: 'Nothing to chase today.',
      priority: 60
    });
  }

  return list.sort((a, b) => b.priority - a.priority);
}

export function computeCustomerAccounts(
customers: Customer[],
transactions: Transaction[])
: CustomerAccount[] {
  return customers.
  map((c) => {
    const theirs = transactions.filter((t) => t.customerId === c.id);
    const ledgerAmount = theirs.reduce((s, t) => s + t.amount, 0);
    const pending = theirs.reduce((s, t) => s + (t.amount - t.receivedAmount), 0);
    const totalPurchases = c.priorPurchases + ledgerAmount;
    const latest = theirs[0];
    return {
      ...c,
      totalPurchases,
      pending,
      paid: totalPurchases - pending,
      transactionCount: c.priorTransactions + theirs.length,
      lastPurchase: latest ? `${latest.dayLabel} · ${latest.time}` : 'No recent sale'
    };
  }).
  sort((a, b) => b.pending - a.pending || b.totalPurchases - a.totalPurchases);
}

export function computeProfile(week: WeekMetrics, health: BusinessHealth) {
  const factors: ProfileFactor[] = [
  { label: 'Business strength', value: health.band, tone: 'positive' },
  {
    label: 'Payment reliability',
    value: `${week.collectionRate}%`,
    tone: week.collectionRate >= 90 ? 'strong' : 'positive'
  },
  {
    label: 'Revenue trend',
    value: `${week.growthPercent > 0 ? '+' : ''}${week.growthPercent}%`,
    tone: week.growthPercent >= 0 ? 'positive' : 'watch'
  },
  {
    label: 'Cash-flow stability',
    value: week.variability <= 18 ? 'Strong' : 'Stable',
    tone: 'stable'
  },
  { label: 'Business history', value: store.activeSince, tone: 'stable' }];


  const reasons = [
  {
    positive: true,
    text: `Consistent revenue for ${store.activeSince}`
  },
  {
    positive: true,
    text: `Strong payment collection (${week.collectionRate}% of sales received)`
  },
  {
    positive: week.growthPercent >= 0,
    text:
    week.growthPercent >= 0 ?
    `Positive growth, up ${week.growthPercent}% this week` :
    `Revenue down ${Math.abs(week.growthPercent)}% this week`
  },
  {
    positive: week.outstanding === 0,
    text:
    week.outstanding === 0 ?
    'No payments outstanding' :
    `${formatRupees(week.outstanding)} of payments remain outstanding`
  }];


  return {
    factors,
    reasons,
    workingCapitalLow: round1k(week.revenue * 0.18),
    workingCapitalHigh: round1k(week.revenue * 0.3),
    why: `${store.activeSince} of steady sales and ${week.collectionRate}% collection is what lifts this profile.${
    week.outstanding > 0 ? ' Outstanding dues are the one thing holding it back.' : ''}`,

    action:
    week.outstanding > 0 ?
    `Collect the ${formatRupees(week.outstanding)} pending and keep recording daily to strengthen it.` :
    'Keep recording every sale to strengthen it further.'
  };
}