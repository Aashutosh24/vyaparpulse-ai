import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Info } from 'lucide-react';
import { AppBar } from '../components/shell/AppBar';
import { Surface } from '../components/ui/Surface';
import { ChartContainer } from '../components/ui/ChartContainer';
import { ForecastChart } from '../components/charts/ForecastChart';
import { ExplainBlock } from '../components/ui/ExplainBlock';
import { LearningState, Skeleton } from '../components/ui/States';
import { formatCompactRupees } from '../utils/format';
import { useApp } from '../contexts/AppContext';

/**
 * A range, a confidence level in words, and a clear line between what
 * happened and what is predicted. No single number pretending to be certain.
 */
export function Forecast() {
  const navigate = useNavigate();
  const { forecast, series, hasEnoughHistory, dataState } = useApp();

  if (dataState === 'loading') {
    return (
      <div className="pb-8" aria-busy="true">
        <AppBar title="Cash-flow forecast" subtitle="Next 7 days" />
        <div className="space-y-5 px-4 pt-4">
          <Skeleton className="h-[232px] rounded-vp" />
          <Skeleton className="h-[248px] rounded-vp" />
        </div>
      </div>);

  }

  if (!hasEnoughHistory) {
    return (
      <div className="pb-8">
        <AppBar title="Cash-flow forecast" />
        <div className="px-4 pt-4">
          <LearningState actionLabel="Record a sale" onAction={() => navigate('/sell')} />
        </div>
      </div>);

  }

  return (
    <div className="pb-8">
      <AppBar title="Cash-flow forecast" subtitle="Next 7 days" />

      <div className="space-y-5 px-4 pt-4">
        <Surface>
          <p className="text-vp-caption font-bold uppercase text-vp-forecast">Expected</p>
          <p className="vp-num mt-1 whitespace-nowrap text-vp-hero font-extrabold text-vp-ink">
            {formatCompactRupees(forecast.expected)}
          </p>
          <p className="vp-num text-vp-label font-semibold text-vp-ink-2">
            Likely range {formatCompactRupees(forecast.low)} – {formatCompactRupees(forecast.high)}
          </p>

          <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-vp-forecast-soft px-2.5 py-1 text-vp-small font-bold text-vp-forecast">
            Prediction confidence: {forecast.confidence}
          </p>
          <p className="mt-2 text-vp-body text-vp-ink-2">{forecast.confidenceReason}</p>

          <div className="mt-4 border-t border-vp-line pt-3.5">
            <ExplainBlock why={forecast.basis} action={forecast.action} />
          </div>
        </Surface>

        <ChartContainer
          title="Money in"
          unit="Last 7 days actual · next 7 days predicted"
          legend={[
          {
            label: 'Actual',
            swatch: <span className="h-0.5 w-5 rounded-full bg-vp-brand" aria-hidden="true" />
          },
          {
            label: 'Predicted range',
            swatch:
            <span
              className="h-3 w-5 rounded-sm border border-vp-forecast-line bg-vp-forecast-soft"
              aria-hidden="true" />


          }]
          }
          footnote="The shaded side of the line has not happened yet. The range widens when your sales are less regular.">
          
          <div className="mb-2 flex items-center justify-between">
            <span className="text-vp-small font-bold text-vp-brand">Actual</span>
            <span className="text-vp-small font-bold text-vp-forecast">Predicted</span>
          </div>
          <ForecastChart actual={series['7D']} forecast={forecast.series} />
        </ChartContainer>

        <Surface tone="muted">
          <p className="flex items-start gap-2 text-vp-body text-vp-ink-2">
            <Info
              size={18}
              strokeWidth={2.4}
              className="mt-0.5 shrink-0 text-vp-ink-3"
              aria-hidden="true" />
            
            This forecast uses only your own sales history and how quickly your customers pay. It
            is worked out inside the app and updates as you record more sales.
          </p>
        </Surface>
      </div>
    </div>);

}