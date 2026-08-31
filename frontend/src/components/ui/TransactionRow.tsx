import React from 'react';
import { ChevronRight, CloudOff } from 'lucide-react';
import { StatusBadge } from './StatusBadge';
import { formatRupees, itemSummary } from '../../utils/format';
import type { Transaction } from '../../types';

interface TransactionRowProps {
  txn: Transaction;
  onOpen?: (txn: Transaction) => void;
  showDay?: boolean;
}

/**
 * Money and payment state get their own line so neither can ever be
 * truncated. Only the item summary — genuinely secondary — may clip.
 */
export function TransactionRow({ txn, onOpen, showDay = false }: TransactionRowProps) {
  const due = txn.amount - txn.receivedAmount;
  const note =
  txn.status === 'partial' ?
  `${formatRupees(due)} still due` :
  txn.status === 'pending' ?
  `${formatRupees(due)} to collect` :
  txn.status === 'paid' ?
  'received' :
  'sale unclear';

  const Wrapper = onOpen ? 'button' : 'div';

  return (
    <li>
      <Wrapper
        {...onOpen ? { type: 'button' as const, onClick: () => onOpen(txn) } : {}}
        className={`flex w-full flex-col px-4 py-3.5 text-left ${
        onOpen ? 'vp-focus vp-press hover:bg-vp-surface-2 active:bg-vp-surface-2' : ''}`
        }>
        
        <div className="flex w-full items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-vp-surface-2 text-vp-small font-bold text-vp-ink-2">
            {txn.initials}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-vp-label font-bold text-vp-ink">{txn.name}</span>
            <span className="mt-0.5 block truncate text-vp-small text-vp-ink-2">
              {itemSummary(txn.items)}
            </span>
          </span>
          <span className="flex shrink-0 flex-col items-end">
            <span className="vp-num whitespace-nowrap text-vp-h2 font-extrabold text-vp-ink">
              {formatRupees(txn.amount)}
            </span>
            <span className="whitespace-nowrap text-vp-small text-vp-ink-3">
              {showDay ? `${txn.dayLabel} · ` : ''}
              {txn.time}
            </span>
          </span>
        </div>

        <div className="mt-2 flex w-full items-center gap-2 pl-[52px]">
          <StatusBadge status={txn.status} note={note} />
          {txn.syncedOffline ?
          <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-[11px] font-semibold text-vp-gold-ink">
              <CloudOff size={12} aria-hidden="true" /> On device
            </span> :
          null}
          <span className="flex-1" />
          {onOpen ?
          <ChevronRight size={18} className="shrink-0 text-vp-ink-3" aria-hidden="true" /> :
          null}
        </div>
      </Wrapper>
    </li>);

}