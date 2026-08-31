import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowRight, CheckCircle2 } from 'lucide-react';
import { formatRupees } from '../../utils/format';
import type { PaymentEvent } from '../../types';

interface PaymentActivityListProps {
  payments: PaymentEvent[];
  /** Home shows a short, calmer version of the same rows. */
  compact?: boolean;
}

/**
 * Reconciliation made visible: each payment says what it matched to, or
 * openly says it could not be identified. This is the core differentiator,
 * so the match state is the loudest thing in the row after the amount.
 */
export function PaymentActivityList({ payments, compact = false }: PaymentActivityListProps) {
  const navigate = useNavigate();

  return (
    <ul className={compact ? 'divide-y divide-vp-line' : 'space-y-2.5'}>
      {payments.map((p) => {
        const review = p.state === 'needsReview';
        return (
          <li
            key={p.id}
            className={
            compact ?
            'py-3 first:pt-0 last:pb-0' :
            `rounded-vp border bg-vp-surface p-4 shadow-vp ${
            review ? 'border-vp-review-line' : 'border-vp-line'}`

            }>
            
            <div className="flex items-start gap-3">
              <span
                className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                review ? 'bg-vp-review-soft text-vp-review' : 'bg-vp-paid-soft text-vp-paid'}`
                }>
                
                {review ?
                <AlertTriangle size={16} strokeWidth={2.6} aria-hidden="true" /> :

                <CheckCircle2 size={16} strokeWidth={2.6} aria-hidden="true" />
                }
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="vp-num shrink-0 text-vp-h2 font-extrabold text-vp-ink">
                    {formatRupees(p.amount)}
                  </p>
                  <p className="shrink-0 text-vp-small text-vp-ink-3">{p.time}</p>
                </div>
                <p className="mt-0.5 truncate text-vp-body font-semibold text-vp-ink-2">
                  {p.senderName}
                </p>
                <p
                  className={`mt-1 flex items-start gap-1.5 text-vp-small font-bold ${
                  review ? 'text-vp-review' : 'text-vp-paid'}`
                  }>
                  
                  {review ?
                  `Needs your review · ${p.candidates?.length ?? 2} possible sales` :
                  `Matched automatically · sale ${p.matchedRef}`}
                </p>

                {review ?
                <button
                  type="button"
                  onClick={() => navigate(`/payments/${p.id}`)}
                  className="vp-focus mt-2.5 flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-vp bg-vp-review px-3 text-vp-body font-bold text-white">
                  
                    Review match
                    <ArrowRight size={16} strokeWidth={2.6} aria-hidden="true" />
                  </button> :
                null}
              </div>
            </div>
          </li>);

      })}
    </ul>);

}