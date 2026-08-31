import React from 'react';
import { RefreshCw, Sparkles } from 'lucide-react';
import { Surface } from './Surface';
import { Button } from './Button';

export function Skeleton({ className = '' }: {className?: string;}) {
  return (
    <div
      className={`animate-pulse rounded-vp-sm bg-vp-surface-2 ${className}`}
      aria-hidden="true" />);


}

export function SkeletonCard({ lines = 3 }: {lines?: number;}) {
  return (
    <Surface>
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-3 h-8 w-40" />
      <div className="mt-4 space-y-2">
        {Array.from({ length: lines }).map((_, i) =>
        <Skeleton key={i} className="h-3" />
        )}
      </div>
    </Surface>);

}

export function SkeletonRows({ rows = 4 }: {rows?: number;}) {
  return (
    <div className="divide-y divide-vp-line rounded-vp border border-vp-line bg-vp-surface">
      {Array.from({ length: rows }).map((_, i) =>
      <div key={i} className="flex items-center gap-3 p-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-2/5" />
            <Skeleton className="h-3 w-3/5" />
          </div>
          <Skeleton className="h-6 w-16" />
        </div>
      )}
    </div>);

}

/** Honest processing copy — never claims work the system is not doing. */
export function AnalyzingNote({ label }: {label: string;}) {
  return (
    <div
      role="status"
      className="flex items-center gap-2 rounded-vp border border-vp-insight-line bg-vp-insight-soft px-3 py-2.5 text-vp-small font-medium text-vp-insight">
      
      <Sparkles size={16} className="animate-pulse" aria-hidden="true" />
      {label}
    </div>);

}

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  body: string;
  bullets?: string[];
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  icon,
  title,
  body,
  bullets,
  actionLabel,
  onAction
}: EmptyStateProps) {
  return (
    <Surface className="px-5 py-7 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-vp-brand-soft text-vp-brand">
        {icon}
      </div>
      <h3 className="mt-4 text-vp-h2 font-bold text-vp-ink">{title}</h3>
      <p className="mx-auto mt-1.5 max-w-[36ch] text-vp-body text-vp-ink-2">{body}</p>
      {bullets ?
      <ul className="mx-auto mt-4 max-w-[32ch] space-y-1.5 text-left">
          {bullets.map((b) =>
        <li key={b} className="flex gap-2 text-vp-body text-vp-ink-2">
              <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-vp-brand" />
              {b}
            </li>
        )}
        </ul> :
      null}
      {actionLabel && onAction ?
      <Button className="mt-5" onClick={onAction} size="lg">
          {actionLabel}
        </Button> :
      null}
    </Surface>);

}

interface ErrorStateProps {
  title: string;
  body: string;
  reassurance?: string;
  onRetry: () => void;
}

export function ErrorState({ title, body, reassurance, onRetry }: ErrorStateProps) {
  return (
    <Surface className="px-5 py-6">
      <h3 className="text-vp-h2 font-bold text-vp-ink">{title}</h3>
      <p className="mt-1.5 text-vp-body text-vp-ink-2">{body}</p>
      {reassurance ?
      <p className="mt-3 rounded-vp-sm bg-vp-paid-soft px-3 py-2 text-vp-small font-semibold text-vp-paid">
          {reassurance}
        </p> :
      null}
      <Button
        className="mt-4"
        variant="secondary"
        onClick={onRetry}
        icon={<RefreshCw size={16} aria-hidden="true" />}>
        
        Try again
      </Button>
    </Surface>);

}

/**
 * Positive "not enough history yet" state — used instead of inventing a
 * Business Health score, a forecast or a confidence level.
 */
export function LearningState({
  onAction,
  actionLabel



}: {onAction?: () => void;actionLabel?: string;}) {
  return (
    <EmptyState
      icon={<Sparkles size={22} strokeWidth={2.3} />}
      title="We’re learning your business"
      body="Record a few more sales and these unlock. Until then we won’t show numbers we can’t stand behind."
      bullets={[
      'Revenue trends',
      'Business Health',
      'Cash-flow prediction',
      'Financial profile']
      }
      actionLabel={actionLabel}
      onAction={onAction} />);


}