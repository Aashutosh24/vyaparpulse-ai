import React from 'react';

interface ExplainBlockProps {
  why: string;
  action: string;
  /** Compact drops the labels for tight surfaces like Home. */
  compact?: boolean;
}

/**
 * The signature VyaparPulse explanation pattern — used by insights,
 * Business Health, the forecast and the financial profile so intelligence
 * always arrives as: what happened → why → what to do.
 */
export function ExplainBlock({ why, action, compact = false }: ExplainBlockProps) {
  return (
    <dl className="space-y-2.5">
      <div>
        {compact ? null :
        <dt className="text-vp-caption font-bold uppercase text-vp-ink-3">Why</dt>
        }
        <dd className={`text-vp-body text-vp-ink-2 ${compact ? '' : 'mt-0.5'}`}>{why}</dd>
      </div>
      <div className="rounded-vp-sm border-l-[3px] border-vp-brand bg-vp-brand-soft px-3 py-2">
        {compact ? null :
        <dt className="text-vp-caption font-bold uppercase text-vp-brand">What to do</dt>
        }
        <dd className={`text-vp-body font-semibold text-vp-ink ${compact ? '' : 'mt-0.5'}`}>
          {action}
        </dd>
      </div>
    </dl>);

}