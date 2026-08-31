import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Search, Users } from 'lucide-react';
import { AppBar } from '../components/shell/AppBar';
import { Surface } from '../components/ui/Surface';
import { StatusBadge } from '../components/ui/StatusBadge';
import { EmptyState, SkeletonRows } from '../components/ui/States';
import { formatRupees } from '../utils/format';
import { useApp } from '../contexts/AppContext';

export function Customers() {
  const navigate = useNavigate();
  const { customers, dataState } = useApp();
  const [query, setQuery] = React.useState('');

  const visible = customers.filter((c) =>
  c.name.toLowerCase().includes(query.trim().toLowerCase())
  );
  const totalPending = customers.reduce((s, c) => s + c.pending, 0);
  const owing = customers.filter((c) => c.pending > 0).length;

  return (
    <div className="pb-6">
      <AppBar title="Customers" subtitle="Who owes you, and who pays on time" back={false} />

      <div className="space-y-4 px-4 pt-4">
        {customers.length ?
        <Surface tone="muted">
            <p className="text-vp-caption font-bold uppercase text-vp-ink-3">Still to collect</p>
            <p className="vp-num mt-0.5 whitespace-nowrap text-vp-num font-extrabold text-vp-ink">
              {formatRupees(totalPending)}
            </p>
            <p className="text-vp-body text-vp-ink-2">
              Across all open sales · {owing} of {customers.length} customers
            </p>
          </Surface> :
        null}

        <div className="relative">
          <Search
            size={18}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-vp-ink-3"
            aria-hidden="true" />
          
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search a customer"
            aria-label="Search customers"
            className="vp-focus min-h-[48px] w-full rounded-vp border border-vp-line-strong bg-vp-surface pl-10 pr-3 text-vp-body font-semibold text-vp-ink placeholder:font-normal placeholder:text-vp-ink-3" />
          
        </div>

        {dataState === 'loading' ? <SkeletonRows rows={5} /> : null}

        {dataState !== 'loading' && visible.length === 0 ?
        <EmptyState
          icon={<Users size={22} strokeWidth={2.3} />}
          title={query ? 'No customer found' : 'Customers will appear here'}
          body={
          query ?
          `Nothing matches “${query}”. Customers are added automatically the first time you record a sale for them.` :
          'As you record sales, each customer is added here with what they have bought and what they still owe.'
          }
          actionLabel={query ? undefined : 'Record a sale'}
          onAction={query ? undefined : () => navigate('/sell')} /> :

        null}

        {dataState !== 'loading' && visible.length > 0 ?
        <ul className="divide-y divide-vp-line overflow-hidden rounded-vp border border-vp-line bg-vp-surface">
            {visible.map((c) =>
          <li key={c.id}>
                <button
              type="button"
              onClick={() => navigate(`/customers/${c.id}`)}
              className="vp-focus vp-press flex w-full flex-col px-4 py-4 text-left hover:bg-vp-surface-2 active:bg-vp-surface-2">
              
                  <span className="flex w-full items-center gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-vp-brand-soft text-vp-body font-bold text-vp-brand">
                      {c.initials}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-vp-label font-bold text-vp-ink">
                        {c.name}
                      </span>
                      <span className="block truncate text-vp-small text-vp-ink-3">
                        {c.transactionCount} sales · last{' '}
                        {c.lastPurchase.replace('Today · ', '')}
                      </span>
                    </span>
                    <ChevronRight size={18} className="shrink-0 text-vp-ink-3" aria-hidden="true" />
                  </span>

                  {/* Money lives on its own line so it can never be ellipsized. */}
                  <span className="mt-2 flex w-full flex-wrap items-center gap-x-3 gap-y-1.5 pl-[56px]">
                    <span className="vp-num whitespace-nowrap text-vp-body font-bold text-vp-ink">
                      {formatRupees(c.totalPurchases)}
                      <span className="font-semibold text-vp-ink-3"> total</span>
                    </span>
                    {c.pending > 0 ?
                <StatusBadge
                  status="pending"
                  note={`${formatRupees(c.pending)} due`} /> :


                <StatusBadge status="paid" note="all settled" />
                }
                  </span>
                </button>
              </li>
          )}
          </ul> :
        null}
      </div>
    </div>);

}