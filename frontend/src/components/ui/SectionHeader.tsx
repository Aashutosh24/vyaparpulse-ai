import React from 'react';
import { ChevronRight } from 'lucide-react';

interface SectionHeaderProps {
  title: string;
  hint?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function SectionHeader({ title, hint, actionLabel, onAction }: SectionHeaderProps) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-vp-h2 font-bold text-vp-ink">{title}</h2>
        {hint ? <p className="mt-0.5 text-vp-small text-vp-ink-3">{hint}</p> : null}
      </div>
      {actionLabel && onAction ?
      <button
        type="button"
        onClick={onAction}
        className="vp-focus -mr-1 inline-flex min-h-[36px] shrink-0 items-center gap-0.5 rounded-vp-sm px-1 text-vp-small font-semibold text-vp-brand">
        
          {actionLabel}
          <ChevronRight size={16} strokeWidth={2.5} aria-hidden="true" />
        </button> :
      null}
    </div>);

}