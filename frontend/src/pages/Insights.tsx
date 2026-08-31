import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, CalendarCheck, Info } from 'lucide-react';
import { AppBar } from '../components/shell/AppBar';
import { Surface } from '../components/ui/Surface';
import { SectionHeader } from '../components/ui/SectionHeader';
import { InsightCard } from '../components/ui/InsightCard';
import { BusinessHealthCard } from '../components/home/BusinessHealthCard';
import { HealthExplainSheet } from '../components/health/HealthExplainSheet';
import { ChartContainer } from '../components/ui/ChartContainer';
import { TrendChart } from '../components/charts/TrendChart';
import { CollectionBar } from '../components/charts/CollectionBar';
import { AnalyzingNote, ErrorState, LearningState, Skeleton } from '../components/ui/States';
import { dataSources, topProducts } from '../data/mockData';
import { formatCompactRupees, formatRupees } from '../utils/format';
import { useApp } from '../contexts/AppContext';

export function Insights() {
  const navigate = useNavigate();
  const {
    dataState,
    today,
    week,
    health,
    forecast,
    insights,
    series,
    hasEnoughHistory,
    reload
  } = useApp();
  const [explainOpen, setExplainOpen] = React.useState(false);

  if (dataState === 'loading') {
    return (
      <div className="pb-8" aria-busy="true">
        <AppBar title="Business insights" back={false} />
        <div className="space-y-4 px-4 pt-4">
          <AnalyzingNote label="Going through your recent sales and payments…" />
          <Skeleton className="h-[128px] rounded-vp" />
          <Skeleton className="h-[196px] rounded-vp" />
          <Skeleton className="h-[176px] rounded-vp" />
        </div>
      </div>);

  }

  if (dataState === 'error') {
    return (
      <div className="pb-8">
        <AppBar title="Business insights" back={false} />
        <div className="px-4 pt-4">
          <ErrorState
            title="We couldn’t refresh your insights"
            body="The figures below may be out of date. Your sales and payments are unaffected."
            reassurance="Nothing you recorded has been lost."
            onRetry={reload} />
          
        </div>
      </div>);

  }

  if (!hasEnoughHistory) {
    return (
      <div className="pb-8">
        <AppBar title="Business insights" back={false} />
        <div className="px-4 pt-4">
          <LearningState actionLabel="Record a sale" onAction={() => navigate('/sell')} />
        </div>
      </div>);

  }

  const changed = insights.find((i) => i.kind === 'change');
  const watch = insights.find((i) => i.kind === 'watch');
  const pattern = insights.find((i) => i.kind === 'pattern');

  return (
    <div className="pb-8">
      <AppBar
        title="Business insights"
        subtitle="Built from your sales and payments"
        back={false} />
      

      <div className="space-y-6 px-4 pt-4">
        <section aria-label="Your business">
          <h2 className="mb-2 text-vp-caption font-bold uppercase text-vp-ink-3">Your business</h2>
          <Surface>
            <dl className="grid grid-cols-3 gap-3">
              <div>
                <dt className="text-vp-small text-vp-ink-2">Today</dt>
                <dd className="vp-num whitespace-nowrap text-vp-h1 font-extrabold text-vp-ink">
                  {formatCompactRupees(today.sales)}
                </dd>
              </div>
              <div>
                <dt className="text-vp-small text-vp-ink-2">This week</dt>
                <dd className="vp-num whitespace-nowrap text-vp-h1 font-extrabold text-vp-ink">
                  {formatCompactRupees(week.revenue)}
                </dd>
              </div>
              <div>
                <dt className="text-vp-small text-vp-ink-2">Health</dt>
                <dd className="vp-num whitespace-nowrap text-vp-h1 font-extrabold text-vp-ink">
                  {health.score}
                  <span className="text-vp-body text-vp-ink-3">/100</span>
                </dd>
              </div>
            </dl>
          </Surface>
        </section>

        {changed ?
        <section aria-label="What changed">
            <SectionHeader title="What changed" hint="Compared with last week" />
            <InsightCard insight={changed} alwaysOpen />
          </section> :
        null}

        <section aria-label="Watch this">
          <SectionHeader title="Watch this" hint="Money still to come in" />
          {watch ? <InsightCard insight={watch} alwaysOpen /> : null}
          <div className="mt-2.5">
            <ChartContainer
              title="Payment collection"
              unit={`This week · ${formatRupees(week.revenue)} sold`}
              footnote={`${week.collectionRate}% collected. ${formatRupees(
                week.outstanding
              )} outstanding across ${week.outstandingCustomers} customer${
              week.outstandingCustomers === 1 ? '' : 's'}.`
              }>
              
              <CollectionBar
                received={week.revenue - week.outstanding}
                pending={week.outstanding} />
              
            </ChartContainer>
          </div>
        </section>

        <section aria-label="What is ahead">
          <SectionHeader title="What’s ahead" hint="Next 7 days" />
          <Surface className="border-vp-forecast-line">
            <p className="text-vp-caption font-bold uppercase text-vp-forecast">
              Expected cash flow
            </p>
            <p className="vp-num mt-1 whitespace-nowrap text-vp-num font-extrabold text-vp-ink">
              {formatCompactRupees(forecast.low)} – {formatCompactRupees(forecast.high)}
            </p>
            <p className="mt-1 text-vp-body text-vp-ink-2">{forecast.basis}</p>
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-vp-forecast-soft px-2.5 py-1 text-vp-small font-bold text-vp-forecast">
              Prediction confidence: {forecast.confidence}
            </p>
            <button
              type="button"
              onClick={() => navigate('/forecast')}
              className="vp-focus mt-3 flex min-h-[48px] w-full items-center justify-between gap-2 rounded-vp bg-vp-forecast-soft px-3.5 text-vp-body font-bold text-vp-forecast">
              
              Open cash-flow forecast
              <ArrowRight size={18} strokeWidth={2.6} aria-hidden="true" />
            </button>
          </Surface>
        </section>

        <section aria-label="Strongest period">
          <SectionHeader title="Strongest period" hint="When your shop earns most" />
          <Surface>
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-vp bg-vp-brand-soft text-vp-brand">
                <CalendarCheck size={20} strokeWidth={2.4} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-vp-h1 font-bold text-vp-ink">{week.strongestDay}</p>
                <p className="vp-num text-vp-body text-vp-ink-2">
                  {formatRupees(week.strongestDayValue)} that day
                </p>
              </div>
            </div>
            <div className="mt-4">
              <TrendChart
                data={series['7D']}
                ariaLabel={`Sales by day for the last 7 days. ${week.reading}`} />
              
            </div>
          </Surface>
          {pattern ?
          <div className="mt-2.5">
              <InsightCard insight={pattern} alwaysOpen />
            </div> :
          null}
        </section>

        <section aria-label="What sells for you">
          <SectionHeader title="What sells for you" hint="By revenue, last 7 days" />
          <Surface>
            <ul className="space-y-3">
              {topProducts.map((p) => {
                const max = topProducts[0].revenue;
                return (
                  <li key={p.name}>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="min-w-0 truncate text-vp-body font-semibold text-vp-ink">
                        {p.name}
                      </span>
                      <span className="vp-num shrink-0 whitespace-nowrap text-vp-body font-bold text-vp-ink">
                        {formatCompactRupees(p.revenue)}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-vp-surface-2">
                        <div
                          className="h-full rounded-full bg-vp-brand-mid"
                          style={{ width: `${p.revenue / max * 100}%` }} />
                        
                      </div>
                      <span className="w-16 shrink-0 text-right text-vp-small text-vp-ink-3">
                        {p.units} units
                      </span>
                    </div>
                  </li>);

              })}
            </ul>
          </Surface>
        </section>

        <section aria-label="Business health">
          <SectionHeader title="Business health" hint="Explainable, and yours alone" />
          <BusinessHealthCard onExplain={() => setExplainOpen(true)} />
          <button
            type="button"
            onClick={() => navigate('/profile')}
            className="vp-focus mt-2.5 flex min-h-[52px] w-full items-center justify-between gap-2 rounded-vp border border-vp-line bg-vp-surface px-4 text-vp-body font-bold text-vp-ink">
            
            View financial profile
            <ArrowRight size={18} strokeWidth={2.6} aria-hidden="true" />
          </button>
        </section>

        <section aria-label="How we know">
          <SectionHeader title="How we know" hint="No jargon, no outside data" />
          <Surface tone="muted">
            <ul className="space-y-2">
              {dataSources.map((s) =>
              <li key={s} className="flex gap-2.5 text-vp-body text-vp-ink-2">
                  <Info
                  size={16}
                  strokeWidth={2.4}
                  className="mt-1 shrink-0 text-vp-ink-3"
                  aria-hidden="true" />
                
                  {s}
                </li>
              )}
            </ul>
          </Surface>
        </section>
      </div>

      <HealthExplainSheet open={explainOpen} onClose={() => setExplainOpen(false)} />
    </div>);

}