import React from 'react';
import { AlertTriangle, Check } from 'lucide-react';
import { BottomSheet } from '../ui/BottomSheet';
import { ExplainBlock } from '../ui/ExplainBlock';
import { dataSources } from '../../data/mockData';
import { useApp } from '../../contexts/AppContext';
import type { FactorTone } from '../../types';

interface HealthExplainSheetProps {
  open: boolean;
  onClose: () => void;
}

const toneStyle: Record<FactorTone, {text: string;bg: string;}> = {
  strong: { text: 'text-vp-paid', bg: 'bg-vp-paid-soft' },
  positive: { text: 'text-vp-paid', bg: 'bg-vp-paid-soft' },
  stable: { text: 'text-vp-brand', bg: 'bg-vp-brand-soft' },
  watch: { text: 'text-vp-pending', bg: 'bg-vp-pending-soft' }
};

/** The score is only trustworthy if the merchant can see how it was built. */
export function HealthExplainSheet({ open, onClose }: HealthExplainSheetProps) {
  const { health, week } = useApp();

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={`Why is your score ${health.score}?`}
      subtitle={`Recalculated from ${week.transactionCount} sales this week`}>
      
      <section aria-label="Summary">
        <p className="text-vp-caption font-bold uppercase text-vp-ink-3">What happened</p>
        <p className="mt-1 text-vp-h2 font-bold leading-snug text-vp-ink">{health.summary}</p>
        <div className="mt-3">
          <ExplainBlock why={health.why} action={health.action} />
        </div>
      </section>

      <h3 className="mb-2 mt-6 text-vp-h2 font-bold text-vp-ink">What goes into it</h3>
      <ul className="space-y-2">
        {health.factors.map((f) => {
          const tone = toneStyle[f.tone];
          const positive = f.tone !== 'watch';
          return (
            <li key={f.label} className="rounded-vp border border-vp-line bg-vp-surface p-3.5">
              <div className="flex items-start gap-2.5">
                <span
                  className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${tone.bg} ${tone.text}`}>
                  
                  {positive ?
                  <Check size={14} strokeWidth={3} aria-hidden="true" /> :

                  <AlertTriangle size={14} strokeWidth={2.6} aria-hidden="true" />
                  }
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <p className="text-vp-label font-bold text-vp-ink">{f.label}</p>
                    <p className={`vp-num shrink-0 text-vp-body font-bold ${tone.text}`}>
                      {f.value}
                    </p>
                  </div>
                  <p className="mt-1 text-vp-body text-vp-ink-2">{f.detail}</p>
                  <p className={`mt-1.5 text-vp-small font-semibold ${tone.text}`}>{f.impact}</p>
                </div>
              </div>
            </li>);

        })}
      </ul>

      <h3 className="mb-2 mt-6 text-vp-h2 font-bold text-vp-ink">How we know</h3>
      <ul className="space-y-1.5">
        {dataSources.map((s) =>
        <li key={s} className="flex gap-2 text-vp-body text-vp-ink-2">
            <span
            aria-hidden="true"
            className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-vp-brand" />
          
            {s}
          </li>
        )}
      </ul>

      <p className="mt-5 rounded-vp bg-vp-surface-2 p-3 text-vp-small text-vp-ink-2">
        Business Health is VyaparPulse’s own view of how your shop is running. It is not a bank or
        government credit score, and in this prototype it is not shared anywhere.
      </p>
    </BottomSheet>);

}