import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Minus, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import { Surface } from '../ui/Surface';
import { useApp } from '../../contexts/AppContext';
import type { FactorTone } from '../../types';

const toneText: Record<FactorTone, string> = {
  strong: 'text-vp-paid',
  positive: 'text-vp-paid',
  stable: 'text-vp-brand',
  watch: 'text-vp-pending'
};

interface BusinessHealthCardProps {
  onExplain: () => void;
  /** Home uses the compact read: score, band, three signals. */
  compact?: boolean;
}

/**
 * Business Health — VyaparPulse's own explainable read on the shop, computed
 * from the live ledger. Deliberately not a credit score.
 */
export function BusinessHealthCard({ onExplain, compact = false }: BusinessHealthCardProps) {
  const { health, week, healthJustChanged } = useApp();
  const growing = week.growthPercent >= 0;

  const chips = [
  {
    label: 'Revenue',
    value: `${growing ? '+' : ''}${week.growthPercent}%`,
    Icon: growing ? TrendingUp : TrendingDown
  },
  { label: 'Payments', value: `${week.collectionRate}%`, Icon: Wallet },
  {
    label: 'Cash flow',
    value: week.variability <= 18 ? 'Strong' : 'Stable',
    Icon: Minus
  }];


  return (
    <Surface>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-vp-caption font-bold uppercase text-vp-ink-3">Business health</h2>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <motion.span
              key={health.score}
              initial={healthJustChanged ? { y: 8, opacity: 0 } : false}
              animate={{ y: 0, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 420, damping: 28 }}
              className="vp-num text-vp-hero font-extrabold text-vp-ink">
              
              {health.score}
            </motion.span>
            <span className="vp-num text-vp-label font-bold text-vp-ink-3">/ 100</span>
            <span className="rounded-full bg-vp-paid-soft px-2 py-0.5 text-vp-small font-bold text-vp-paid">
              {health.band}
            </span>
          </div>
          <p
            className={`mt-1.5 inline-flex items-center gap-1 text-vp-small font-semibold ${
            health.delta >= 0 ? 'text-vp-paid' : 'text-vp-pending'}`
            }>
            
            {health.delta >= 0 ?
            <TrendingUp size={14} strokeWidth={2.6} aria-hidden="true" /> :

            <TrendingDown size={14} strokeWidth={2.6} aria-hidden="true" />
            }
            {healthJustChanged ?
            'Updated just now' :
            `${health.delta >= 0 ? '+' : ''}${health.delta} vs last week`}
          </p>
        </div>
        <ScoreDial score={health.score} />
      </div>

      {compact ?
      <ul className="mt-4 grid grid-cols-3 gap-2">
          {chips.map((chip) =>
        <li key={chip.label} className="rounded-vp-sm bg-vp-surface-2 px-2 py-2 text-center">
              <chip.Icon
            size={16}
            strokeWidth={2.6}
            aria-hidden="true"
            className="mx-auto text-vp-brand" />
          
              <p className="mt-1 text-[11px] font-semibold text-vp-ink-3">{chip.label}</p>
              <p className="vp-num text-vp-small font-bold text-vp-ink">{chip.value}</p>
            </li>
        )}
        </ul> :

      <dl className="mt-4 divide-y divide-vp-line border-t border-vp-line">
          {health.factors.map((f) =>
        <div key={f.label} className="flex items-baseline justify-between gap-3 py-2.5">
              <dt className="min-w-0 text-vp-body text-vp-ink-2">{f.label}</dt>
              <dd className={`shrink-0 text-vp-body font-bold ${toneText[f.tone]}`}>{f.value}</dd>
            </div>
        )}
        </dl>
      }

      <button
        type="button"
        onClick={onExplain}
        className="vp-focus mt-4 flex min-h-[48px] w-full items-center justify-between gap-2 rounded-vp bg-vp-brand-soft px-3.5 text-left text-vp-body font-bold text-vp-brand">
        
        Why is my score {health.score}?
        <ArrowRight size={18} strokeWidth={2.6} aria-hidden="true" />
      </button>
    </Surface>);

}

function ScoreDial({ score }: {score: number;}) {
  const r = 30;
  const c = 2 * Math.PI * r;
  const pct = Math.min(Math.max(score, 0), 100) / 100;
  return (
    <svg width="76" height="76" viewBox="0 0 76 76" aria-hidden="true" className="shrink-0">
      <circle cx="38" cy="38" r={r} fill="none" stroke="var(--vp-surface-2)" strokeWidth="8" />
      <motion.circle
        cx="38"
        cy="38"
        r={r}
        fill="none"
        stroke="var(--vp-brand)"
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={c}
        animate={{ strokeDashoffset: c * (1 - pct) }}
        initial={{ strokeDashoffset: c }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
        transform="rotate(-90 38 38)" />
      
    </svg>);

}