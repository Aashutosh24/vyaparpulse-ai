import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MessageSquare, Phone, Users } from 'lucide-react';
import { AppBar } from '../components/shell/AppBar';
import { Surface } from '../components/ui/Surface';
import { Button } from '../components/ui/Button';
import { TransactionRow } from '../components/ui/TransactionRow';
import { CollectionBar } from '../components/charts/CollectionBar';
import { EmptyState, Skeleton, SkeletonRows } from '../components/ui/States';
import { SectionHeader } from '../components/ui/SectionHeader';
import { formatRupees } from '../utils/format';
import { useApp } from '../contexts/AppContext';

export function CustomerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { customers, transactions, dataState } = useApp();
  const customer = customers.find((c) => c.id === id);

  if (dataState === 'loading') {
    return (
      <div className="pb-8" aria-busy="true">
        <AppBar title="Customer" />
        <div className="space-y-4 px-4 pt-4">
          <Skeleton className="h-[248px] rounded-vp" />
          <SkeletonRows rows={3} />
        </div>
      </div>);

  }

  if (!customer) {
    return (
      <div className="pb-6">
        <AppBar title="Customer" />
        <div className="px-4 pt-4">
          <EmptyState
            icon={<Users size={22} strokeWidth={2.3} />}
            title="Customer not found"
            body="This sale isn’t linked to a saved customer yet."
            actionLabel="Back to customers"
            onAction={() => navigate('/customers')} />
          
        </div>
      </div>);

  }

  const theirs = transactions.filter((t) => t.customerId === customer.id);

  return (
    <div className="pb-8">
      <AppBar title={customer.name} subtitle={`Customer since ${customer.since}`} />

      <div className="space-y-4 px-4 pt-4">
        <Surface>
          <div className="flex items-center gap-3">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-vp-brand-soft text-vp-h2 font-bold text-vp-brand">
              {customer.initials}
            </span>
            <div className="min-w-0">
              <p className="truncate text-vp-h2 font-bold text-vp-ink">{customer.name}</p>
              <p className="vp-num truncate text-vp-small text-vp-ink-3">{customer.phone}</p>
            </div>
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-3">
            <div>
              <dt className="text-vp-small text-vp-ink-3">Total purchases</dt>
              <dd className="vp-num whitespace-nowrap text-vp-h2 font-extrabold text-vp-ink">
                {formatRupees(customer.totalPurchases)}
              </dd>
            </div>
            <div>
              <dt className="text-vp-small text-vp-ink-3">Transactions</dt>
              <dd className="vp-num text-vp-h2 font-extrabold text-vp-ink">
                {customer.transactionCount}
              </dd>
            </div>
            <div>
              <dt className="text-vp-small text-vp-ink-3">Paid</dt>
              <dd className="vp-num whitespace-nowrap text-vp-h2 font-extrabold text-vp-paid">
                {formatRupees(customer.paid)}
              </dd>
            </div>
            <div>
              <dt className="text-vp-small text-vp-ink-3">Pending</dt>
              <dd
                className={`vp-num whitespace-nowrap text-vp-h2 font-extrabold ${
                customer.pending > 0 ? 'text-vp-pending' : 'text-vp-ink-3'}`
                }>
                
                {formatRupees(customer.pending)}
              </dd>
            </div>
          </dl>

          <div className="mt-4">
            <CollectionBar received={customer.paid} pending={customer.pending} />
          </div>
        </Surface>

        {customer.pending > 0 ?
        <div className="grid grid-cols-2 gap-2.5">
            <Button icon={<MessageSquare size={16} aria-hidden="true" />}>Send reminder</Button>
            <Button variant="secondary" icon={<Phone size={16} aria-hidden="true" />}>
              Call
            </Button>
          </div> :
        null}

        <section aria-label="Their transactions">
          <SectionHeader title="Their transactions" hint={`Last purchase ${customer.lastPurchase}`} />
          {theirs.length ?
          <ul className="divide-y divide-vp-line overflow-hidden rounded-vp border border-vp-line bg-vp-surface">
              {theirs.map((t) =>
            <TransactionRow key={t.id} txn={t} showDay />
            )}
            </ul> :

          <EmptyState
            icon={<Users size={22} strokeWidth={2.3} />}
            title="No recent transactions"
            body="Sales for this customer will show up here as you record them." />

          }
        </section>
      </div>
    </div>);

}