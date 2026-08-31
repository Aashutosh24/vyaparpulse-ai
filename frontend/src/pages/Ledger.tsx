import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Receipt } from 'lucide-react';
import { AppBar } from '../components/shell/AppBar';
import { FilterChips } from '../components/ui/FilterChips';
import { TransactionRow } from '../components/ui/TransactionRow';
import { Surface } from '../components/ui/Surface';
import { CollectionBar } from '../components/charts/CollectionBar';
import { EmptyState, ErrorState, SkeletonRows } from '../components/ui/States';
import { formatRupees } from '../utils/format';
import { useApp } from '../contexts/AppContext';
import type { PaymentStatus } from '../types';

type Filter = 'all' | 'pending' | 'paid' | 'needsReview';

const matches: Record<Filter, (s: PaymentStatus) => boolean> = {
  all: () => true,
  pending: (s) => s === 'pending' || s === 'partial',
  paid: (s) => s === 'paid',
  needsReview: (s) => s === 'needsReview'
};

export function Ledger() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { transactions, dataState, today, reload } = useApp();
  const [filter, setFilter] = React.useState<Filter>(
    params.get('filter') as Filter ?? 'all'
  );

  const counts = React.useMemo(
    () => ({
      all: transactions.length,
      pending: transactions.filter((t) => matches.pending(t.status)).length,
      paid: transactions.filter((t) => matches.paid(t.status)).length,
      needsReview: transactions.filter((t) => matches.needsReview(t.status)).length
    }),
    [transactions]
  );

  const visible = transactions.filter((t) => matches[filter](t.status));
  const groups: {day: string;items: typeof visible;}[] = [
  { day: 'Today', items: visible.filter((t) => t.dayLabel === 'Today') },
  { day: 'Yesterday', items: visible.filter((t) => t.dayLabel === 'Yesterday') }].
  filter((g) => g.items.length > 0);

  return (
    <div className="pb-6">
      <AppBar title="Ledger" subtitle="Every sale and what is still owed" back={false} />

      <div className="space-y-5 px-4 pt-4">
        <Surface tone="muted">
          <div className="flex items-baseline justify-between gap-3">
            <div className="min-w-0">
              <p className="text-vp-caption font-bold uppercase text-vp-ink-3">Today's sales</p>
              <p className="vp-num whitespace-nowrap text-vp-num font-extrabold text-vp-ink">
                {formatRupees(today.sales)}
              </p>
            </div>
            <p className="shrink-0 text-vp-small font-semibold text-vp-ink-2">
              {today.saleCount} transactions
            </p>
          </div>
          <div className="mt-3">
            <CollectionBar received={today.received} pending={today.pending} />
          </div>
        </Surface>

        <div className="-mx-4 px-4">
          <FilterChips
            label="Filter transactions"
            value={filter}
            onChange={setFilter}
            options={[
            { value: 'all', label: 'All', count: counts.all },
            { value: 'pending', label: 'Pending', count: counts.pending },
            { value: 'paid', label: 'Paid', count: counts.paid },
            { value: 'needsReview', label: 'Needs review', count: counts.needsReview }]
            } />
          
        </div>

        {dataState === 'loading' ? <SkeletonRows rows={5} /> : null}

        {dataState === 'error' ?
        <ErrorState
          title="We couldn’t load your latest payments"
          body="The ledger you see may be a few minutes behind."
          reassurance="Your saved sales are safe."
          onRetry={reload} /> :

        null}

        {dataState !== 'loading' && dataState !== 'error' && groups.length === 0 ?
        <EmptyState
          icon={<Receipt size={22} strokeWidth={2.3} />}
          title={filter === 'all' ? 'No sales recorded yet' : 'Nothing in this filter'}
          body={
          filter === 'all' ?
          'Record your first sale and it will appear here with its payment status.' :
          'Try another filter to see the rest of your ledger.'
          }
          actionLabel={filter === 'all' ? 'Record a sale' : undefined}
          onAction={filter === 'all' ? () => navigate('/sell') : undefined} /> :

        null}

        {dataState !== 'loading' && dataState !== 'error' ?
        groups.map((group) =>
        <section key={group.day} aria-label={group.day}>
                <h2 className="mb-2 text-vp-caption font-bold uppercase text-vp-ink-3">
                  {group.day}
                </h2>
                <ul className="divide-y divide-vp-line overflow-hidden rounded-vp border border-vp-line bg-vp-surface">
                  {group.items.map((txn) =>
            <TransactionRow
              key={txn.id}
              txn={txn}
              onOpen={() =>
              txn.status === 'needsReview' ?
              navigate('/payments') :
              navigate(`/customers/${txn.customerId}`)
              } />

            )}
                </ul>
              </section>
        ) :
        null}
      </div>
    </div>);

}