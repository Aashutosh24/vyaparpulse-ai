import React from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

/**
 * Sheets are pinned to the phone frame rather than the scrolling page, so
 * they always open over the current view — including deep down a long screen.
 */
export function BottomSheet({ open, onClose, title, subtitle, children }: BottomSheetProps) {
  const reduced = useReducedMotion();

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open ?
      <div className="fixed inset-0 z-50 flex justify-center">
          <div className="relative flex h-full w-full max-w-[430px] flex-col justify-end">
            <motion.button
            type="button"
            aria-label="Close"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="absolute inset-0 bg-black/40" />
          
            <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={reduced ? { opacity: 0 } : { y: '100%' }}
            animate={reduced ? { opacity: 1 } : { y: 0 }}
            exit={reduced ? { opacity: 0 } : { y: '100%' }}
            transition={{ type: 'spring', stiffness: 420, damping: 36 }}
            className="vp-scroll relative max-h-[88%] overflow-y-auto rounded-t-[1.5rem] border-t border-vp-line bg-vp-bg shadow-vp-sheet">
            
              <div className="sticky top-0 z-10 bg-vp-bg px-4 pb-3 pt-3">
                <span
                aria-hidden="true"
                className="mx-auto mb-3 block h-1 w-10 rounded-full bg-vp-line-strong" />
              
                <div className="flex items-start gap-3 border-b border-vp-line pb-3">
                  <div className="min-w-0 flex-1">
                    <h2 className="text-vp-h1 font-bold text-vp-ink">{title}</h2>
                    {subtitle ?
                  <p className="mt-0.5 text-vp-small text-vp-ink-2">{subtitle}</p> :
                  null}
                  </div>
                  <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close"
                  className="vp-focus vp-press -mr-1 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-vp-ink-2 hover:bg-vp-surface-2">
                  
                    <X size={20} strokeWidth={2.4} aria-hidden="true" />
                  </button>
                </div>
              </div>
              <div className="px-4 pb-8 pt-4">{children}</div>
            </motion.div>
          </div>
        </div> :
      null}
    </AnimatePresence>);

}