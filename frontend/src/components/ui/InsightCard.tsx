import React from 'react';
import { AlertTriangle, CalendarDays, ChevronDown, Sparkles, TrendingUp } from 'lucide-react';
import { ExplainBlock } from './ExplainBlock';
import type { Insight, InsightKind } from '../../types';

const kindMeta: Record<
  InsightKind,
  {Icon: typeof Sparkles;label: string;text: string;bg: string;border: string;}> =
{
  change: {
    Icon: TrendingUp,
    label: 'What changed',
    text: 'text-vp-paid',
    bg: 'bg-vp-paid-soft',
    border: 'border-vp-paid-line'
  },
  watch: {
    Icon: AlertTriangle,
    label: 'Needs your attention',
    text: 'text-vp-pending',
    bg: 'bg-vp-pending-soft',
    border: 'border-vp-pending-line'
  },
  pattern: {
    Icon: CalendarDays,
    label: 'Your pattern',
    text: 'text-vp-insight',
    bg: 'bg-vp-insight-soft',
    border: 'border-vp-insight-line'
  },
  forecast: {
    Icon: Sparkles,
    label: 'What’s ahead',
    text: 'text-vp-forecast',
    bg: 'bg-vp-forecast-soft',
    border: 'border-vp-forecast-line'
  }
};

interface InsightCardProps {
  insight: Insight;
  /** Open shows why + what to do immediately, with no toggle. */
  alwaysOpen?: boolean;
  onOpen?: () => void;
  openLabel?: string;
}

/**
 * What happened → why → what to do. The headline is a sentence a shopkeeper
 * can act on; the number supports it rather than leading.
 */
export function InsightCard({ insight, alwaysOpen = false, onOpen, openLabel }: InsightCardProps) {
  const [open, setOpen] = React.useState(alwaysOpen);
  const meta = kindMeta[insight.kind];
  const { Icon } = meta;
  const showBody = alwaysOpen || open;

  return (
    <article className={`rounded-vp border bg-vp-surface p-4 shadow-vp ${meta.border}`}>
      <div className="flex items-start gap-3">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-vp-sm ${meta.bg} ${meta.text}`}>
          
          <Icon size={18} strokeWidth={2.4} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className={`text-vp-caption font-bold uppercase ${meta.text}`}>{meta.label}</p>
          <h3 className="mt-1 text-vp-label font-bold leading-snug text-vp-ink">
            {insight.headline}
          </h3>
          <p className="vp-num mt-1 text-vp-h2 font-extrabold text-vp-ink">{insight.metric}</p>
        </div>
      </div>

      {showBody ?
      <div className="mt-3 border-t border-vp-line pt-3">
          <ExplainBlock why={insight.why} action={insight.action} />
        </div> :
      null}

      {alwaysOpen && !onOpen ? null :
      <button
        type="button"
        onClick={() => onOpen ? onOpen() : setOpen((o) => !o)}
        aria-expanded={onOpen ? undefined : open}
        className="vp-focus mt-2 inline-flex min-h-[40px] items-center gap-1 text-vp-body font-bold text-vp-brand">
        
          {onOpen ? openLabel ?? 'See detail' : open ? 'Hide explanation' : 'Why?'}
          <ChevronDown
          size={16}
          strokeWidth={2.6}
          aria-hidden="true"
          className={open && !onOpen ? 'rotate-180 transition-transform' : 'transition-transform'} />
        
        </button>
      }
    </article>);

}