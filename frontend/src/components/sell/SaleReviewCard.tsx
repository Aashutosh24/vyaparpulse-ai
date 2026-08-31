import React from 'react';
import { AlertTriangle, CheckCircle2, HelpCircle, Mic, Pencil } from 'lucide-react';
import { Surface } from '../ui/Surface';
import { Button } from '../ui/Button';
import { formatRupees } from '../../utils/format';
import type { LineItem, PaymentMethod } from '../../types';

interface SaleReviewCardProps {
  items: LineItem[];
  total: number;
  customerOptions: string[];
  customerName: string | null;
  ambiguous: boolean;
  method: PaymentMethod;
  /** Actual confidence from the voice agent (0–1). Null = demo/manual (show "High confidence"). */
  voiceConfidence?: number | null;
  onPickCustomer: (name: string) => void;
  onMethodChange: (method: PaymentMethod) => void;
  onConfirm: () => void;
  onEdit: () => void;
  onRecordAgain: () => void;
}

const methods: {value: PaymentMethod;label: string;hint: string;}[] = [
{ value: 'upi', label: 'UPI', hint: 'Awaiting payment' },
{ value: 'cash', label: 'Cash', hint: 'Paid now' },
{ value: 'credit', label: 'Udhaar', hint: 'Pay later' }];

function confidenceBadge(value: number | null | undefined) {
  // Null/undefined = demo or manual entry — default to "High confidence" to preserve existing demo UX.
  if (value == null || value >= 0.85) {
    return {
      label: 'High confidence',
      icon: <CheckCircle2 size={14} strokeWidth={2.6} aria-hidden="true" />,
      className: 'bg-vp-paid-soft text-vp-paid',
    };
  }
  if (value >= 0.60) {
    return {
      label: 'Medium confidence',
      icon: <AlertTriangle size={14} strokeWidth={2.6} aria-hidden="true" />,
      className: 'bg-amber-50 text-amber-700',
    };
  }
  return {
    label: 'Please review — speech was unclear',
    icon: <HelpCircle size={14} strokeWidth={2.6} aria-hidden="true" />,
    className: 'bg-vp-review-soft text-vp-review',
  };
}

/** Nothing is saved until the merchant confirms — and ambiguity is never guessed. */
export function SaleReviewCard({
  items,
  total,
  customerOptions,
  customerName,
  ambiguous,
  method,
  voiceConfidence,
  onPickCustomer,
  onMethodChange,
  onConfirm,
  onEdit,
  onRecordAgain
}: SaleReviewCardProps) {
  const needsChoice = ambiguous && !customerName;
  const badge = confidenceBadge(voiceConfidence);

  return (
    <div className="space-y-3">
      <Surface>
        <div className="flex items-center justify-between gap-3">
          <p className="text-vp-caption font-bold uppercase text-vp-ink-3">I heard</p>
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-vp-small font-bold ${badge.className}`}>
            {badge.icon}
            {badge.label}
          </span>
        </div>

        <ul className="mt-3 divide-y divide-vp-line">
          {items.map((item) =>
          <li key={item.name} className="flex items-baseline justify-between gap-3 py-2.5">
              <span className="min-w-0">
                <span className="block truncate text-vp-label font-bold text-vp-ink">
                  {item.qty} × {item.name}
                </span>
                <span className="vp-num block text-vp-small text-vp-ink-3">
                  {formatRupees(item.unitPrice)} each
                </span>
              </span>
              <span className="vp-num shrink-0 text-vp-label font-bold text-vp-ink">
                {formatRupees(item.qty * item.unitPrice)}
              </span>
            </li>
          )}
        </ul>

        <div className="mt-2 flex items-baseline justify-between gap-3 border-t-2 border-vp-line-strong pt-3">
          <span className="text-vp-label font-bold text-vp-ink-2">Total</span>
          <span className="vp-num text-vp-num font-extrabold text-vp-ink">
            {formatRupees(total)}
          </span>
        </div>
      </Surface>

      {needsChoice ?
      <Surface className="border-vp-review-line bg-vp-review-soft">
          <p className="flex items-center gap-2 text-vp-caption font-bold uppercase text-vp-review">
            <HelpCircle size={15} strokeWidth={2.6} aria-hidden="true" />
            Please verify
          </p>
          <p className="mt-1.5 text-vp-label font-bold text-vp-ink">
            Two customers match “Rahul”. Which one is this?
          </p>
          <div className="mt-3 grid gap-2">
            {customerOptions.map((name) =>
          <button
            key={name}
            type="button"
            onClick={() => onPickCustomer(name)}
            className="vp-focus min-h-[48px] rounded-vp border border-vp-line-strong bg-vp-surface px-3 text-left text-vp-label font-bold text-vp-ink">
            
                {name}
              </button>
          )}
          </div>
        </Surface> :

      <Surface>
          <p className="text-vp-caption font-bold uppercase text-vp-ink-3">Customer</p>
          <div className="mt-1.5 flex items-center justify-between gap-3">
            <p className="truncate text-vp-label font-bold text-vp-ink">{customerName}</p>
            <button
            type="button"
            onClick={onEdit}
            className="vp-focus min-h-[36px] shrink-0 text-vp-small font-bold text-vp-brand">
            
              Change
            </button>
          </div>
        </Surface>
      }

      <Surface>
        <p className="text-vp-caption font-bold uppercase text-vp-ink-3">How is it being paid?</p>
        <div className="mt-2.5 grid grid-cols-3 gap-2">
          {methods.map((m) => {
            const active = m.value === method;
            return (
              <button
                key={m.value}
                type="button"
                onClick={() => onMethodChange(m.value)}
                aria-pressed={active}
                className={`vp-focus min-h-[60px] rounded-vp border px-2 py-2 text-center ${
                active ?
                'border-vp-brand bg-vp-brand-soft' :
                'border-vp-line bg-vp-surface'}`
                }>
                
                <span
                  className={`block text-vp-body font-bold ${
                  active ? 'text-vp-brand' : 'text-vp-ink'}`
                  }>
                  
                  {m.label}
                </span>
                <span className="mt-0.5 block text-[11px] font-semibold text-vp-ink-3">
                  {m.hint}
                </span>
              </button>);

          })}
        </div>
      </Surface>

      <Button size="lg" block onClick={onConfirm} disabled={needsChoice}>
        Confirm sale · {formatRupees(total)}
      </Button>
      <div className="grid grid-cols-2 gap-2.5">
        <Button
          variant="secondary"
          onClick={onEdit}
          icon={<Pencil size={16} aria-hidden="true" />}>
          
          Edit
        </Button>
        <Button
          variant="secondary"
          onClick={onRecordAgain}
          icon={<Mic size={16} aria-hidden="true" />}>
          
          Record again
        </Button>
      </div>
    </div>);

}