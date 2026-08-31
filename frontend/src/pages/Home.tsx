import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Store } from 'lucide-react';
import { HomeHeader } from '../components/home/HomeHeader';
import { TodaySummary } from '../components/home/TodaySummary';
import { BusinessHealthCard } from '../components/home/BusinessHealthCard';
import { QuickActions } from '../components/home/QuickActions';
import { HealthExplainSheet } from '../components/health/HealthExplainSheet';
import { InsightCard } from '../components/ui/InsightCard';
import { SectionHeader } from '../components/ui/SectionHeader';
import { FilterChips } from '../components/ui/FilterChips';
import { TrendChart } from '../components/charts/TrendChart';
import { ChartContainer } from '../components/ui/ChartContainer';
import { PaymentActivityList } from '../components/payments/PaymentActivityList';
import {
  EmptyState,
  ErrorState,
  LearningState,
  Skeleton,
  SkeletonRows } from
'../components/ui/States';
import { formatRupees } from '../utils/format';
import { useApp } from '../contexts/AppContext';

type Range = '7D' | '30D' | '90D';

const rangeLabel: Record<Range, string> = {
  '7D': 'Sales per day, last 7 days',
  '30D': 'Sales per week, last 30 days',
  '90D': 'Sales per month, last 90 days'
};

export function Home() {
  const navigate = useNavigate();
  const { dataState, transactions, payments, insights, series, week, hasEnoughHistory, reload } =
  useApp();
  const [range, setRange] = React.useState<Range>('7D');
  const [explainOpen, setExplainOpen] = React.useState(false);

  if (dataState === 'loading') return <HomeLoading />;

  if (dataState === 'error') {
    return (
      <div className="pb-8">
        <HomeHeader />
        <div className="px-4">
          <ErrorState
            title="We couldn’t load today’s figures"
            body="Your connection dropped while refreshing. Nothing you recorded has been lost."
            reassurance="All saved sales are safe on this device."
            onRetry={reload} />
          
        </div>
      </div>);

  }

  const todays = transactions.filter((t) => t.dayLabel === 'Today');

  if (todays.length === 0) {
    return (
      <div className="pb-8">
        <HomeHeader />
        <div className="space-y-3 px-4">
          <EmptyState
            icon={<Store size={22} strokeWidth={2.3} />}
            title="No sales yet today"
            body="Record your first sale and VyaparPulse starts building your business history."
            actionLabel="Record a sale"
            onAction={() => navigate('/sell')} />
          
          <LearningState />
        </div>
      </div>);

  }

  // Insights arrive pre-ranked; Home shows only what deserves attention.
  const lead = insights[0];
  const secondary = insights.find((i) => i.kind === 'forecast') ?? insights[1];
  const trendReading =
  range === '7D' ?
  week.reading :
  range === '30D' ?
  `This week is ${week.growthPercent >= 0 ? 'ahead of' : 'behind'} last week by ${Math.abs(
    week.growthPercent
  )}%.` :
  'Your monthly revenue is trending upward.';

  return (
    <div className="pb-8">
      <HomeHeader />

      <div className="space-y-6 px-4">
        <TodaySummary onPendingClick={() => navigate('/ledger?filter=pending')} />

        {hasEnoughHistory ?
        <BusinessHealthCard compact onExplain={() => setExplainOpen(true)} /> :

        <LearningState />
        }

        {lead ?
        <section aria-label="What needs your attention">
            <SectionHeader
            title="Worth knowing"
            hint="Picked from your own sales and payments"
            actionLabel="All insights"
            onAction={() => navigate('/insights')} />
          
            <div className="space-y-2.5">
              <InsightCard insight={lead} alwaysOpen />
              {secondary ?
            <InsightCard
              insight={secondary}
              onOpen={() =>
              navigate(secondary.kind === 'forecast' ? '/forecast' : '/insights')
              }
              openLabel={secondary.kind === 'forecast' ? 'See the forecast' : 'See detail'} /> :

            null}
            </div>
          </section> :
        null}

        <section aria-label="Revenue trend">
          <ChartContainer
            title="Revenue trend"
            unit={rangeLabel[range]}
            reading={trendReading}
            period={
            <FilterChips
              label="Trend period"
              size="sm"
              value={range}
              onChange={setRange}
              options={[
              { value: '7D', label: '7D' },
              { value: '30D', label: '30D' },
              { value: '90D', label: '90D' }]
              } />

            }>
            
            <TrendChart
              data={series[range]}
              ariaLabel={`Revenue trend. ${rangeLabel[range]}. ${trendReading}`} />
            
          </ChartContainer>
        </section>

        <section aria-label="Quick actions">
          <QuickActions />
        </section>

        <section aria-label="Payment activity">
          <SectionHeader
            title="Payment activity"
            hint="Matched to your sales as money arrives"
            actionLabel="See all"
            onAction={() => navigate('/payments')} />
          
          <div className="rounded-vp border border-vp-line bg-vp-surface px-4 py-3.5 shadow-vp">
            {payments.length ?
            <PaymentActivityList payments={payments.slice(0, 3)} compact /> :

            <p className="text-vp-body text-vp-ink-2">
                No payments yet. Recorded sales are matched automatically as money arrives.
              </p>
            }
            {week.outstanding > 0 ?
            <button
              type="button"
              onClick={() => navigate('/ledger?filter=pending')}
              className="vp-focus mt-3 flex min-h-[44px] w-full items-center justify-between gap-2 border-t border-vp-line pt-3 text-left text-vp-body font-bold text-vp-brand">
              
                <span className="min-w-0">
                  {formatRupees(week.outstanding)} still to collect from{' '}
                  {week.outstandingCustomers} customer
                  {week.outstandingCustomers === 1 ? '' : 's'}
                </span>
                <ChevronRight size={18} strokeWidth={2.6} className="shrink-0" aria-hidden="true" />
              </button> :
            null}
          </div>
        </section>
      </div>

      <HealthExplainSheet open={explainOpen} onClose={() => setExplainOpen(false)} />
    </div>);

}

function HomeLoading() {
  return (
    <div className="pb-8" aria-busy="true">
      <HomeHeader />
      <div className="space-y-6 px-4">
        <Skeleton className="h-[196px] rounded-vp-lg" />
        <Skeleton className="h-[188px] rounded-vp" />
        <Skeleton className="h-[172px] rounded-vp" />
        <SkeletonRows rows={3} />
      </div>
    </div>);

}