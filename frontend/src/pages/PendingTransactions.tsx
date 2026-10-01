import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, IndianRupee, Zap, ChevronRight } from 'lucide-react';
import { AppBar } from '../components/shell/AppBar';
import { Surface } from '../components/ui/Surface';
import { Button } from '../components/ui/Button';
import { EmptyState, SkeletonRows } from '../components/ui/States';
import { TransactionRow } from '../components/ui/TransactionRow';
import { formatRupees } from '../utils/format';
import { useApp } from '../contexts/AppContext';

/**
 * Pending Transactions — shows every PENDING sale clearly.
 *
 * In live mode the list reflects the backend's real state: once a bank SMS
 * is parsed and matched by the backend (via the /payments/raw endpoint), that
 * transaction flips to PAID and disappears from this screen on next reload.
 */
export function PendingTransactions() {
  const navigate = useNavigate();
  const { transactions, dataState, simulateIncomingPayment, mode, reload } = useApp();

  const pending = transactions.filter(
    (t) => t.status === 'pending' || t.status === 'partial'
  );

  const totalPending = pending.reduce((sum, t) => sum + (t.amount - t.receivedAmount), 0);
  const oldestFirst = [...pending].sort((a, b) => {
    // "Today" comes last in age-sorting (newest); "Yesterday" is older
    if (a.dayLabel === b.dayLabel) return 0;
    if (a.dayLabel === 'Yesterday') return -1;
    return 1;
  });

  const groups: { day: string; items: typeof pending }[] = [
    { day: 'Yesterday', items: oldestFirst.filter((t) => t.dayLabel === 'Yesterday') },
    { day: 'Today', items: oldestFirst.filter((t) => t.dayLabel === 'Today') },
  ].filter((g) => g.items.length > 0);

  const openSale = transactions.find(
    (t) => t.dayLabel === 'Today' && t.amount > t.receivedAmount && t.status !== 'needsReview'
  );

  return (
    <div className="pb-8">
      <AppBar
        title="Pending collections"
        subtitle="Sales waiting for payment confirmation"
      />

      <div className="space-y-5 px-4 pt-4">
        {/* Summary card */}
        <Surface tone="muted">
          <div className="flex items-start gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-vp-review-soft text-vp-review">
              <IndianRupee size={20} strokeWidth={2.5} aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-vp-caption font-bold uppercase text-vp-ink-3">
                Total outstanding
              </p>
              <p className="vp-num mt-0.5 text-vp-h2 font-extrabold text-vp-ink">
                {formatRupees(totalPending)}
              </p>
              <p className="mt-1 text-vp-body text-vp-ink-2">
                {pending.length} sale{pending.length !== 1 ? 's' : ''} awaiting payment
              </p>
            </div>
          </div>

          {pending.length > 0 && (
            <button
              type="button"
              id="go-to-payments-btn"
              onClick={() => navigate('/payments')}
              className="vp-focus mt-4 flex min-h-[44px] w-full items-center justify-between gap-2 border-t border-vp-line pt-3 text-left text-vp-body font-bold text-vp-brand"
            >
              <span>View payment activity</span>
              <ChevronRight size={18} strokeWidth={2.6} className="shrink-0" aria-hidden="true" />
            </button>
          )}
        </Surface>

        {/* How payment matching works */}
        {pending.length > 0 && (
          <div className="rounded-vp border border-vp-line bg-vp-surface px-4 py-3 shadow-vp">
            <div className="flex items-start gap-3">
              <Clock size={16} strokeWidth={2.3} className="mt-0.5 shrink-0 text-vp-ink-3" aria-hidden="true" />
              <div>
                <p className="text-vp-label font-semibold text-vp-ink">
                  Real-time SMS matching
                </p>
                <p className="mt-0.5 text-vp-small text-vp-ink-2">
                  {mode === 'live'
                    ? 'When a UPI credit SMS arrives, the backend parses it and automatically matches it to the right pending sale. This list updates as payments are confirmed.'
                    : 'In demo mode, use "Simulate payment" to see how a UPI credit SMS would be parsed and matched to a pending sale.'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Simulate button (only when there's an open sale) */}
        {openSale && (
          <Button
            id="simulate-payment-btn"
            variant="secondary"
            block
            icon={<Zap size={16} aria-hidden="true" />}
            onClick={simulateIncomingPayment}
          >
            {mode === 'live' ? 'Submit test payment via SMS' : 'Simulate'} {formatRupees(openSale.amount - openSale.receivedAmount)} arriving
          </Button>
        )}

        {/* Loading skeleton */}
        {dataState === 'loading' && <SkeletonRows rows={4} />}

        {/* Empty state */}
        {dataState !== 'loading' && pending.length === 0 && (
          <EmptyState
            icon={<IndianRupee size={22} strokeWidth={2.3} />}
            title="All caught up"
            body="No outstanding collections. Every recorded sale has been paid or matched to an incoming payment."
            actionLabel="Record a sale"
            onAction={() => navigate('/sell')}
          />
        )}

        {/* Transaction groups */}
        {dataState !== 'loading' &&
          groups.map((group) => (
            <section key={group.day} aria-label={`Pending from ${group.day}`}>
              <h2 className="mb-2 text-vp-caption font-bold uppercase text-vp-ink-3">
                {group.day}
              </h2>
              <ul
                id={`pending-${group.day.toLowerCase()}`}
                className="divide-y divide-vp-line overflow-hidden rounded-vp border border-vp-line bg-vp-surface"
              >
                {group.items.map((txn) => (
                  <TransactionRow
                    key={txn.id}
                    txn={txn}
                    onOpen={() =>
                      txn.status === 'needsReview'
                        ? navigate('/payments')
                        : navigate(`/customers/${txn.customerId}`)
                    }
                  />
                ))}
              </ul>
            </section>
          ))}

        {pending.length > 0 && (
          <button
            type="button"
            id="reload-pending-btn"
            onClick={reload}
            className="vp-focus w-full py-2 text-center text-vp-small font-semibold text-vp-ink-3 underline underline-offset-2"
          >
            Refresh
          </button>
        )}
      </div>
    </div>
  );
}
