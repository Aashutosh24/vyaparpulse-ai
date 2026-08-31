import React from 'react';
import { formatRupees } from '../../utils/format';

interface CollectionBarProps {
  received: number;
  pending: number;
  compact?: boolean;
}

/** One bar answers "how much of what I sold has actually reached me?". */
export function CollectionBar({ received, pending, compact = false }: CollectionBarProps) {
  const total = Math.max(received + pending, 1);
  const receivedPct = Math.round(received / total * 100);

  return (
    <div>
      <div
        className="flex h-3 w-full overflow-hidden rounded-full bg-vp-surface-2"
        role="img"
        aria-label={`${formatRupees(received)} received, ${formatRupees(pending)} pending. ${receivedPct}% collected.`}>
        
        <div className="h-full bg-vp-paid" style={{ width: `${receivedPct}%` }} />
        <div
          className="h-full bg-vp-pending"
          style={{
            width: `${100 - receivedPct}%`,
            backgroundImage:
            'repeating-linear-gradient(135deg, transparent 0 4px, rgba(255,255,255,0.35) 4px 8px)'
          }} />
        
      </div>
      {compact ? null :
      <div className="mt-2.5 flex flex-wrap justify-between gap-x-4 gap-y-1.5">
          <p className="whitespace-nowrap text-vp-small text-vp-ink-2">
            <span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm bg-vp-paid align-middle" />
            Received <span className="vp-num font-bold text-vp-ink">{formatRupees(received)}</span>
          </p>
          <p className="whitespace-nowrap text-vp-small text-vp-ink-2">
            <span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm bg-vp-pending align-middle" />
            Pending <span className="vp-num font-bold text-vp-ink">{formatRupees(pending)}</span>
          </p>
        </div>
      }
    </div>);

}