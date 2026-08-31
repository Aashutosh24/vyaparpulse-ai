import React from 'react';
import { AlertTriangle, CheckCircle2, Clock, HelpCircle, PieChart, XCircle } from 'lucide-react';
import type { PaymentStatus } from '../../types';

export type StatusKey = PaymentStatus | 'matched' | 'unmatched' | 'failed' | 'verified';

interface StatusMeta {
  label: string;
  Icon: typeof CheckCircle2;
  text: string;
  bg: string;
  border: string;
  dot: string;
}

/**
 * Status never relies on colour alone: every state carries an icon and a word.
 */
export const statusMeta: Record<StatusKey, StatusMeta> = {
  paid: {
    label: 'Paid',
    Icon: CheckCircle2,
    text: 'text-vp-paid',
    bg: 'bg-vp-paid-soft',
    border: 'border-vp-paid-line',
    dot: 'bg-vp-paid'
  },
  matched: {
    label: 'Matched',
    Icon: CheckCircle2,
    text: 'text-vp-paid',
    bg: 'bg-vp-paid-soft',
    border: 'border-vp-paid-line',
    dot: 'bg-vp-paid'
  },
  verified: {
    label: 'Verified',
    Icon: CheckCircle2,
    text: 'text-vp-brand',
    bg: 'bg-vp-brand-soft',
    border: 'border-vp-brand-line',
    dot: 'bg-vp-brand'
  },
  partial: {
    label: 'Part paid',
    Icon: PieChart,
    text: 'text-vp-pending',
    bg: 'bg-vp-pending-soft',
    border: 'border-vp-pending-line',
    dot: 'bg-vp-pending'
  },
  pending: {
    label: 'Pending',
    Icon: Clock,
    text: 'text-vp-pending',
    bg: 'bg-vp-pending-soft',
    border: 'border-vp-pending-line',
    dot: 'bg-vp-pending'
  },
  needsReview: {
    label: 'Needs review',
    Icon: AlertTriangle,
    text: 'text-vp-review',
    bg: 'bg-vp-review-soft',
    border: 'border-vp-review-line',
    dot: 'bg-vp-review'
  },
  unmatched: {
    label: 'Unmatched',
    Icon: HelpCircle,
    text: 'text-vp-review',
    bg: 'bg-vp-review-soft',
    border: 'border-vp-review-line',
    dot: 'bg-vp-review'
  },
  failed: {
    label: 'Failed',
    Icon: XCircle,
    text: 'text-vp-danger',
    bg: 'bg-vp-danger-soft',
    border: 'border-vp-danger-line',
    dot: 'bg-vp-danger'
  }
};

interface StatusBadgeProps {
  status: StatusKey;
  note?: string;
  size?: 'sm' | 'md';
  className?: string;
}

export function StatusBadge({ status, note, size = 'sm', className = '' }: StatusBadgeProps) {
  const meta = statusMeta[status];
  const { Icon } = meta;
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-vp-sm border px-2 py-1 font-semibold ${
      meta.bg} ${
      meta.border} ${meta.text} ${size === 'sm' ? 'text-vp-small' : 'text-vp-body'} ${className}`}>
      
      <Icon size={size === 'sm' ? 14 : 16} strokeWidth={2.4} aria-hidden="true" />
      <span className="whitespace-nowrap">
        {meta.label}
        {note ? <span className="font-medium opacity-80"> · {note}</span> : null}
      </span>
    </span>);

}