import React from 'react';
import { IndianRupee, Zap } from 'lucide-react';
import { AppBar } from '../components/shell/AppBar';
import { Surface } from '../components/ui/Surface';
import { Button } from '../components/ui/Button';
import { PaymentActivityList } from '../components/payments/PaymentActivityList';
import { PrototypeNote } from '../components/ui/PrototypeNote';
import { EmptyState, SkeletonRows } from '../components/ui/States';
import { formatRupees } from '../utils/format';
import { useApp } from '../contexts/AppContext';

/** A payment timeline where the match state is the headline, not a footnote. */
export function PaymentActivity() {
  const { payments, dataState, reviewCount, today, transactions, simulateIncomingPayment } =
  useApp();
  const matched = payments.filter((p) => p.state === 'matched').length;
  const openSale = transactions.find(
    (t) => t.dayLabel === 'Today' && t.amount > t.receivedAmount && t.status !== 'needsReview'
  );

  return (
    <div className="pb-8">
      <AppBar title="Payment activity" subtitle="Money arriving, and what it belongs to" />

      <div className="space-y-5 px-4 pt-4">
        <Surface tone="muted">
          <dl className="grid grid-cols-3 gap-3">
            <div>
              <dt className="text-vp-small text-vp-ink-2">Received today</dt>
              <dd className="vp-num whitespace-nowrap text-vp-h2 font-extrabold text-vp-ink">
                {formatRupees(today.received)}
              </dd>
            </div>
            <div>
              <dt className="text-vp-small text-vp-ink-2">Matched</dt>
              <dd className="vp-num text-vp-h2 font-extrabold text-vp-paid">{matched}</dd>
            </div>
            <div>
              <dt className="text-vp-small text-vp-ink-2">Need review</dt>
              <dd
                className={`vp-num text-vp-h2 font-extrabold ${
                reviewCount > 0 ? 'text-vp-review' : 'text-vp-ink-3'}`
                }>
                
                {reviewCount}
              </dd>
            </div>
          </dl>
        </Surface>

        {reviewCount > 0 ?
        <div className="rounded-vp border border-vp-review-line bg-vp-review-soft p-4">
            <p className="text-vp-label font-bold text-vp-ink">
              {reviewCount} payment{reviewCount > 1 ? 's' : ''} need your confirmation
            </p>
            <p className="mt-1 text-vp-body text-vp-ink-2">
              We couldn’t confidently identify which sale they belong to, so we’ve left them for
              you rather than guessing.
            </p>
          </div> :
        null}

        {dataState === 'loading' ? <SkeletonRows rows={4} /> : null}

        {dataState !== 'loading' && payments.length === 0 ?
        <EmptyState
          icon={<IndianRupee size={22} strokeWidth={2.3} />}
          title="No payments yet today"
          body="UPI and cash payments appear here the moment they arrive, already matched to a sale where possible." /> :

        null}

        {dataState !== 'loading' && payments.length > 0 ?
        <section aria-label="Today">
            <h2 className="mb-2 text-vp-caption font-bold uppercase text-vp-ink-3">Today</h2>
            <PaymentActivityList payments={payments} />
          </section> :
        null}

        <section aria-label="Prototype behaviour" className="space-y-2.5">
          <PrototypeNote>
            this build is not connected to a real UPI feed. Payment events are generated inside the
            app so the matching journey can be shown end to end.
          </PrototypeNote>
          {openSale ?
          <Button
            variant="secondary"
            block
            icon={<Zap size={16} aria-hidden="true" />}
            onClick={simulateIncomingPayment}>
            
              Simulate {formatRupees(openSale.amount - openSale.receivedAmount)} arriving
            </Button> :
          null}
        </section>
      </div>
    </div>);

}