import React from 'react';
import { Minus, Plus } from 'lucide-react';
import { Surface } from '../ui/Surface';
import { Button } from '../ui/Button';
import { quickItems } from '../../data/mockData';
import { formatRupees } from '../../utils/format';
import type { LineItem } from '../../types';

interface ManualSaleFormProps {
  onReview: (customerName: string, items: LineItem[]) => void;
  onCancel: () => void;
}

export function ManualSaleForm({ onReview, onCancel }: ManualSaleFormProps) {
  const [customer, setCustomer] = React.useState('');
  const [qty, setQty] = React.useState<Record<string, number>>({});

  const items: LineItem[] = quickItems.
  filter((q) => (qty[q.name] ?? 0) > 0).
  map((q) => ({ name: q.name, qty: qty[q.name], unitPrice: q.price }));
  const total = items.reduce((s, i) => s + i.qty * i.unitPrice, 0);

  const bump = (name: string, delta: number) =>
  setQty((prev) => ({ ...prev, [name]: Math.max((prev[name] ?? 0) + delta, 0) }));

  return (
    <div className="space-y-3">
      <Surface>
        <label htmlFor="customer" className="text-vp-caption font-bold uppercase text-vp-ink-3">
          Customer
        </label>
        <input
          id="customer"
          value={customer}
          onChange={(e) => setCustomer(e.target.value)}
          placeholder="Name or phone"
          className="vp-focus mt-1.5 min-h-[48px] w-full rounded-vp border border-vp-line-strong bg-vp-surface px-3 text-vp-label font-semibold text-vp-ink placeholder:font-normal placeholder:text-vp-ink-3" />
        
      </Surface>

      <Surface>
        <p className="text-vp-caption font-bold uppercase text-vp-ink-3">Your regular items</p>
        <ul className="mt-1 divide-y divide-vp-line">
          {quickItems.map((q) => {
            const count = qty[q.name] ?? 0;
            return (
              <li key={q.name} className="flex items-center gap-3 py-2.5">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-vp-body font-bold text-vp-ink">
                    {q.name}
                  </span>
                  <span className="vp-num block text-vp-small text-vp-ink-3">
                    {formatRupees(q.price)}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => bump(q.name, -1)}
                    disabled={count === 0}
                    aria-label={`Remove one ${q.name}`}
                    className="vp-focus flex h-11 w-11 items-center justify-center rounded-vp border border-vp-line text-vp-ink disabled:opacity-40">
                    
                    <Minus size={18} strokeWidth={2.6} aria-hidden="true" />
                  </button>
                  <span className="vp-num w-8 text-center text-vp-label font-bold text-vp-ink">
                    {count}
                  </span>
                  <button
                    type="button"
                    onClick={() => bump(q.name, 1)}
                    aria-label={`Add one ${q.name}`}
                    className="vp-focus flex h-11 w-11 items-center justify-center rounded-vp border border-vp-brand bg-vp-brand-soft text-vp-brand">
                    
                    <Plus size={18} strokeWidth={2.6} aria-hidden="true" />
                  </button>
                </span>
              </li>);

          })}
        </ul>
      </Surface>

      <Surface tone="muted">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-vp-label font-bold text-vp-ink-2">Total</span>
          <span className="vp-num text-vp-num font-extrabold text-vp-ink">
            {formatRupees(total)}
          </span>
        </div>
      </Surface>

      <Button
        size="lg"
        block
        disabled={!items.length || customer.trim().length < 2}
        onClick={() => onReview(customer.trim(), items)}>
        
        Review sale
      </Button>
      <Button variant="ghost" block onClick={onCancel}>
        Back to voice
      </Button>
    </div>);

}