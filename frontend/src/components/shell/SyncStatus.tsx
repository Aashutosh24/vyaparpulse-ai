import React from 'react';
import { motion } from 'framer-motion';
import { Check, CloudOff, Loader2, Smartphone } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';

interface SyncStatusProps {
  onOpenDemo: () => void;
}

/**
 * One quiet, always-truthful line about where the merchant's data lives.
 * Nothing here claims cloud sync, because nothing is synced to a server yet.
 * The walkthrough trigger lives here to keep it out of the merchant content.
 */
export function SyncStatus({ onOpenDemo }: SyncStatusProps) {
  const { offline, saveState, localOnlyCount } = useApp();

  const state = offline ?
  {
    Icon: CloudOff,
    text: 'Offline · changes saved on this device',
    detail:
    localOnlyCount > 0 ?
    `${localOnlyCount} waiting to match` :
    'Recording works as normal',
    tone: 'border-vp-gold-line bg-vp-gold-soft text-vp-gold-ink',
    spin: false
  } :
  saveState === 'saving' ?
  {
    Icon: Loader2,
    text: 'Saving to this device…',
    detail: null,
    tone: 'border-vp-line bg-vp-surface-2 text-vp-ink-2',
    spin: true
  } :
  saveState === 'saved' ?
  {
    Icon: Check,
    text: 'Saved on this device',
    detail: 'Just now',
    tone: 'border-vp-paid-line bg-vp-paid-soft text-vp-paid',
    spin: false
  } :
  {
    Icon: Smartphone,
    text: 'Saved on this device',
    detail: 'This session',
    tone: 'border-vp-line bg-vp-surface-2 text-vp-ink-2',
    spin: false
  };

  const { Icon } = state;

  return (
    <div className={`flex shrink-0 items-center gap-2 border-b pl-4 pr-2 ${state.tone}`}>
      <motion.div layout className="flex min-w-0 flex-1 items-center gap-2 py-1.5" role="status">
        <Icon
          size={14}
          strokeWidth={2.6}
          aria-hidden="true"
          className={state.spin ? 'animate-spin' : undefined} />
        
        <p className="min-w-0 truncate text-vp-small font-semibold">{state.text}</p>
        {state.detail ?
        <p className="shrink-0 text-[11px] font-semibold opacity-80">{state.detail}</p> :
        null}
      </motion.div>
      <button
        type="button"
        onClick={onOpenDemo}
        aria-label="Open guided walkthrough"
        className="vp-focus vp-press my-0.5 shrink-0 rounded-full border border-current px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide opacity-80">
        
        Demo
      </button>
    </div>);

}