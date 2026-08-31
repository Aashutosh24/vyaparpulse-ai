import React from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { CheckCircle2, IndianRupee, Link2, X } from 'lucide-react';
import { ChangeChips } from '../ui/ChangeChips';
import { formatRupees } from '../../utils/format';
import { useApp } from '../../contexts/AppContext';

const STAGES = ['Payment detected', 'Identifying the sale', 'Matched', 'Reconciled'] as const;
const STAGE_AT = [0, 260, 560, 900];

/**
 * The reconciliation moment, staged over about one second: money arrives,
 * VyaparPulse works out which sale it belongs to, the sale closes — then the
 * figures it moved are shown as before → after. No celebration, just proof.
 */
export function ActivityBanner() {
  const { banner, impact, dismissBanner } = useApp();
  const reduced = useReducedMotion();
  const [stage, setStage] = React.useState(STAGES.length - 1);
  const isReconciliation = banner?.kind === 'received' || banner?.kind === 'matched';
  const settled = stage >= STAGES.length - 1;

  React.useEffect(() => {
    if (!banner) return;
    const timers: number[] = [];
    if (isReconciliation && !reduced) {
      setStage(0);
      STAGE_AT.forEach((at, i) => {
        if (i === 0) return;
        timers.push(window.setTimeout(() => setStage(i), at));
      });
    } else {
      setStage(STAGES.length - 1);
    }
    timers.push(window.setTimeout(dismissBanner, isReconciliation ? 6800 : 4200));
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [banner, isReconciliation, reduced, dismissBanner]);

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-40 px-3 pt-3">
      <AnimatePresence>
        {banner ?
        <motion.div
          key={`${banner.kind}-${banner.ref ?? banner.title}`}
          role="status"
          aria-live="polite"
          initial={{ y: -24, opacity: 0, scale: 0.98 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: -16, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 460, damping: 34 }}
          className={`pointer-events-auto rounded-vp border bg-vp-surface p-3 shadow-vp-raised ${
          isReconciliation ? 'border-vp-paid-line' : 'border-vp-line'}`
          }>
          
            <div className="flex items-start gap-3">
              <motion.span
              initial={{ scale: 0.6 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.05, type: 'spring', stiffness: 500, damping: 18 }}
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
              isReconciliation ?
              'bg-vp-paid-soft text-vp-paid' :
              'bg-vp-brand-soft text-vp-brand'}`
              }>
              
                {banner.kind === 'saved' ?
              <CheckCircle2 size={18} strokeWidth={2.6} aria-hidden="true" /> :
              banner.kind === 'matched' ?
              <Link2 size={18} strokeWidth={2.6} aria-hidden="true" /> :

              <IndianRupee size={18} strokeWidth={2.6} aria-hidden="true" />
              }
              </motion.span>

              <div className="min-w-0 flex-1">
                <p className="text-vp-caption font-bold uppercase text-vp-ink-3">{banner.title}</p>
                <p className="vp-num whitespace-nowrap text-vp-h2 font-extrabold text-vp-ink">
                  {banner.amount ? formatRupees(banner.amount) : ''}
                  {banner.party ?
                <span className="ml-2 font-sans text-vp-body font-semibold text-vp-ink-2">
                      {banner.party}
                    </span> :
                null}
                </p>
                {!isReconciliation ?
              <p className="mt-0.5 text-vp-small text-vp-ink-2">{banner.detail}</p> :
              null}
              </div>

              <button
              type="button"
              onClick={dismissBanner}
              aria-label="Dismiss"
              className="vp-focus vp-press -mr-1 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-vp-ink-3 hover:bg-vp-surface-2">
              
                <X size={16} strokeWidth={2.4} aria-hidden="true" />
              </button>
            </div>

            {isReconciliation ?
          <div className="mt-2.5 border-t border-vp-line pt-2.5">
                <div className="flex items-center gap-2">
                  <span className="flex shrink-0 items-center gap-1" aria-hidden="true">
                    {STAGES.map((label, i) =>
                <span
                  key={label}
                  className={`h-1.5 rounded-full transition-all duration-200 ${
                  i <= stage ? 'w-4 bg-vp-paid' : 'w-1.5 bg-vp-surface-2'}`
                  } />

                )}
                  </span>
                  <p
                className={`min-w-0 flex-1 truncate text-vp-small font-bold ${
                settled ? 'text-vp-paid' : 'text-vp-ink-2'}`
                }>
                
                    {settled ? banner.detail : `${STAGES[stage]}…`}
                  </p>
                </div>

                <AnimatePresence>
                  {settled && impact && impact.rows.length ?
              <motion.div
                initial={reduced ? { opacity: 0 } : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22 }}
                className="mt-2.5">
                
                      <ChangeChips impact={impact} />
                    </motion.div> :
              null}
                </AnimatePresence>
              </div> :
          null}
          </motion.div> :
        null}
      </AnimatePresence>
    </div>);

}