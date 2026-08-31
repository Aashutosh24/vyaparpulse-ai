import React from 'react';
import { ArrowRight } from 'lucide-react';
import type { ChangeImpact } from '../../types';

interface ChangeChipsProps {
  impact: ChangeImpact;
  /** Compact drops the reason line for tight surfaces. */
  compact?: boolean;
}

/**
 * "Because of this": the exact figures an action moved, shown as before → after.
 * Transient by design — it appears with the confirmation and leaves with it.
 */
export function ChangeChips({ impact, compact = false }: ChangeChipsProps) {
  return (
    <div>
      <ul className="flex flex-wrap gap-1.5">
        {impact.rows.map((row) =>
        <li
          key={row.label}
          className="flex items-center gap-1.5 rounded-full border border-vp-paid-line bg-vp-paid-soft px-2 py-1">
          
            <span className="text-[11px] font-semibold text-vp-ink-2">{row.label}</span>
            <span className="vp-num whitespace-nowrap text-[11px] font-bold text-vp-ink-3 line-through">
              {row.before}
            </span>
            <ArrowRight size={11} strokeWidth={3} className="text-vp-paid" aria-hidden="true" />
            <span className="vp-num whitespace-nowrap text-vp-small font-extrabold text-vp-paid">
              {row.after}
            </span>
          </li>
        )}
      </ul>
      {compact ? null :
      <p className="mt-2 text-vp-small text-vp-ink-2">
          <span className="font-bold text-vp-ink">Because: </span>
          {impact.reason}
        </p>
      }
    </div>);

}