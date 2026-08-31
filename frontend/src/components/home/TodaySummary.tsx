import React from 'react';
import { ArrowDownRight, ArrowUpRight, CheckCircle2, Clock, Minus } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { formatPercent, formatRupees } from '../../utils/format';

interface TodaySummaryProps {
  onPendingClick: () => void;
}

/**
 * Answers the first three merchant questions in one glance: how much did I
 * sell, how much reached me, what is still out there. Every figure is derived
 * from the ledger, so recording a sale moves all of them.
 */
export function TodaySummary({ onPendingClick }: TodaySummaryProps) {
  const { today } = useApp();
  const change = today.changeVsYesterday;
  const ChangeIcon = change > 0 ? ArrowUpRight : change < 0 ? ArrowDownRight : Minus;

  return (
    <section
      aria-label="Today's money"
      className="rounded-vp-lg bg-vp-brand p-4 pb-3.5 text-vp-ink-inv shadow-vp-raised">
      
      <div className="flex items-center justify-between gap-3">
        <p className="text-vp-caption font-bold uppercase text-white/70">
          Today · {today.saleCount} sales
        </p>
        <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-white/15 px-2 py-1 text-vp-small font-bold text-white">
          <ChangeIcon size={14} strokeWidth={2.6} aria-hidden="true" />
          {Math.abs(change)}% vs yesterday
        </span>
      </div>

      <p className="vp-num mt-1.5 whitespace-nowrap text-vp-hero font-extrabold text-white">
        {formatRupees(today.sales)}
      </p>
      <p className="text-vp-body font-medium text-white/75">Today's sales</p>

      <div className="mt-4 grid grid-cols-2 gap-2.5">
        <div className="rounded-vp bg-white/12 px-3 py-2.5">
          <p className="flex items-center gap-1.5 text-vp-small font-bold text-white/80">
            <CheckCircle2 size={14} strokeWidth={2.6} aria-hidden="true" />
            Received
          </p>
          <p className="vp-num mt-0.5 whitespace-nowrap text-vp-num font-extrabold text-white">
            {formatRupees(today.received)}
          </p>
        </div>
        <button
          type="button"
          onClick={onPendingClick}
          className="vp-focus rounded-vp bg-white px-3 py-2.5 text-left">
          
          <p className="flex items-center gap-1.5 text-vp-small font-bold text-vp-pending">
            <Clock size={14} strokeWidth={2.6} aria-hidden="true" />
            Pending
          </p>
          <p className="vp-num mt-0.5 whitespace-nowrap text-vp-num font-extrabold text-vp-ink">
            {formatRupees(today.pending)}
          </p>
        </button>
      </div>

      <div className="mt-3.5">
        <div
          className="flex h-2 overflow-hidden rounded-full bg-white/20"
          role="img"
          aria-label={`${formatPercent(today.collectionRate)} of today's sales collected`}>
          
          <div className="h-full bg-white" style={{ width: `${today.collectionRate}%` }} />
        </div>
        <p className="mt-2 text-vp-small font-semibold text-white/80">
          {formatPercent(today.collectionRate)} collected — {formatRupees(today.pending)} still to
          come in
        </p>
      </div>
    </section>);

}