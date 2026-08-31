import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { HelpCircle, IndianRupee, ShieldCheck } from 'lucide-react';
import { AppBar } from '../components/shell/AppBar';
import { Surface } from '../components/ui/Surface';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/States';
import { formatRupees } from '../utils/format';
import { useApp } from '../contexts/AppContext';

/**
 * Ambiguity is shown, never resolved silently. No invented confidence
 * percentages — just the reason each sale is a candidate, and the merchant
 * makes the call in one tap.
 */
export function PaymentReview() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { payments, resolveReview } = useApp();
  const payment = payments.find((p) => p.id === id);

  if (!payment) {
    return (
      <div className="pb-8">
        <AppBar title="Review payment" />
        <div className="px-4 pt-4">
          <EmptyState
            icon={<ShieldCheck size={22} strokeWidth={2.3} />}
            title="Nothing left to review"
            body="This payment has already been matched to a sale."
            actionLabel="Back to payments"
            onAction={() => navigate('/payments')} />
          
        </div>
      </div>);

  }

  if (payment.state === 'matched') {
    return (
      <div className="pb-8">
        <AppBar title="Payment matched" />
        <div className="px-4 pt-4">
          <EmptyState
            icon={<ShieldCheck size={22} strokeWidth={2.3} />}
            title={`${formatRupees(payment.amount)} confirmed`}
            body={`Matched to sale ${payment.matchedRef} for ${payment.senderName}.`}
            actionLabel="Back to payments"
            onAction={() => navigate('/payments')} />
          
        </div>
      </div>);

  }

  return (
    <div className="pb-8">
      <AppBar title="Payment needs review" subtitle="Two sales look alike" />

      <div className="space-y-5 px-4 pt-4">
        <Surface className="border-vp-review-line bg-vp-review-soft text-center">
          <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-vp-surface text-vp-review">
            <IndianRupee size={20} strokeWidth={2.6} aria-hidden="true" />
          </span>
          <p className="vp-num mt-2.5 whitespace-nowrap text-vp-hero font-extrabold text-vp-ink">
            {formatRupees(payment.amount)}
          </p>
          <p className="text-vp-label font-bold text-vp-ink-2">Received</p>
          <p className="mt-0.5 text-vp-small text-vp-ink-3">
            {payment.time} · {payment.handle}
          </p>
          <p className="mx-auto mt-3 flex max-w-[36ch] items-start gap-2 text-left text-vp-body font-semibold text-vp-review">
            <HelpCircle
              size={18}
              strokeWidth={2.5}
              className="mt-0.5 shrink-0"
              aria-hidden="true" />
            
            We couldn’t confidently identify the sale this belongs to, so we haven’t guessed.
          </p>
        </Surface>

        <section aria-label="Possible matches">
          <h2 className="mb-2 text-vp-caption font-bold uppercase text-vp-ink-3">
            Possible matches
          </h2>
          <ul className="space-y-2.5">
            {payment.candidates?.map((c) =>
            <li key={c.name} className="rounded-vp border border-vp-line bg-vp-surface p-4 shadow-vp">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="min-w-0 truncate text-vp-label font-bold text-vp-ink">{c.name}</p>
                  <p className="vp-num shrink-0 whitespace-nowrap text-vp-label font-bold text-vp-ink">
                    {formatRupees(c.amount)}
                  </p>
                </div>
                <p className="mt-0.5 text-vp-small text-vp-ink-3">Sale · {c.time}</p>
                <p className="mt-2 text-vp-body text-vp-ink-2">{c.reason}</p>
                <Button
                className="mt-3"
                size="lg"
                block
                onClick={() => {
                  resolveReview(payment.id, c.name);
                  navigate('/payments');
                }}>
                
                  Confirm {c.name}
                </Button>
              </li>
            )}
          </ul>
        </section>

        <Button variant="secondary" size="lg" block onClick={() => navigate('/ledger')}>
          Keep unmatched
        </Button>
        <p className="px-1 text-vp-small text-vp-ink-3">
          Unmatched payments stay in your ledger as received money with no sale attached, so your
          totals are never quietly wrong.
        </p>
      </div>
    </div>);

}