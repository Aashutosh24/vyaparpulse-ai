import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Clock, Mic, Receipt } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';

/** Three actions, one clear primary. Never five competing CTAs. */
export function QuickActions() {
  const navigate = useNavigate();
  const { reviewCount, transactions } = useApp();
  const pendingCount = transactions.filter(
    (t) => t.status === 'pending' || t.status === 'partial'
  ).length;

  return (
    <div className="grid grid-cols-2 gap-2.5">
      <button
        type="button"
        id="quick-action-record-sale"
        onClick={() => navigate('/sell')}
        className="vp-focus col-span-2 flex min-h-[60px] items-center gap-3 rounded-vp bg-vp-brand px-4 text-left text-vp-ink-inv shadow-vp-raised">
        
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15">
          <Mic size={20} strokeWidth={2.5} aria-hidden="true" />
        </span>
        <span className="min-w-0">
          <span className="block text-vp-label font-bold">Record a sale</span>
          <span className="block truncate text-vp-small text-white/80">
            Speak it or type it — takes seconds
          </span>
        </span>
      </button>

      <button
        type="button"
        id="quick-action-pending"
        onClick={() => navigate('/pending')}
        className="vp-focus flex min-h-[56px] items-center gap-2.5 rounded-vp border border-vp-line bg-vp-surface px-3 text-left">
        
        <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-vp-review-soft text-vp-pending">
          <Clock size={18} strokeWidth={2.4} aria-hidden="true" />
          {pendingCount > 0 ?
          <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-vp-pending px-1 text-[11px] font-bold text-white">
              {pendingCount}
            </span> :
          null}
        </span>
        <span className="min-w-0">
          <span className="block text-vp-body font-bold text-vp-ink">Pending dues</span>
          <span className="block truncate text-vp-small text-vp-ink-3">
            {pendingCount > 0 ? `${pendingCount} awaiting payment` : 'All collected'}
          </span>
        </span>
      </button>

      <button
        type="button"
        id="quick-action-review"
        onClick={() => navigate('/payments')}
        className="vp-focus flex min-h-[56px] items-center gap-2.5 rounded-vp border border-vp-line bg-vp-surface px-3 text-left">
        
        <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-vp-review-soft text-vp-review">
          <AlertTriangle size={18} strokeWidth={2.4} aria-hidden="true" />
          {reviewCount > 0 ?
          <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-vp-review px-1 text-[11px] font-bold text-white">
              {reviewCount}
            </span> :
          null}
        </span>
        <span className="min-w-0">
          <span className="block text-vp-body font-bold text-vp-ink">Review payments</span>
          <span className="block truncate text-vp-small text-vp-ink-3">
            {reviewCount > 0 ? `${reviewCount} need you` : 'All matched'}
          </span>
        </span>
      </button>

      <button
        type="button"
        id="quick-action-ledger"
        onClick={() => navigate('/ledger')}
        className="vp-focus col-span-2 flex min-h-[56px] items-center gap-2.5 rounded-vp border border-vp-line bg-vp-surface px-3 text-left">
        
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-vp-surface-2 text-vp-ink-2">
          <Receipt size={18} strokeWidth={2.4} aria-hidden="true" />
        </span>
        <span className="min-w-0">
          <span className="block text-vp-body font-bold text-vp-ink">View ledger</span>
          <span className="block truncate text-vp-small text-vp-ink-3">All sales & dues</span>
        </span>
      </button>
    </div>);

}