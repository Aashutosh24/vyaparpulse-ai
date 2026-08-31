import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Check, RotateCcw, Zap } from 'lucide-react';
import { BottomSheet } from '../ui/BottomSheet';
import { Button } from '../ui/Button';
import { PrototypeNote } from '../ui/PrototypeNote';
import { formatRupees } from '../../utils/format';
import { useApp } from '../../contexts/AppContext';

interface DemoSheetProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Judge mode. Every step drives the same application state the merchant UI
 * uses — nothing here is a slide. Kept out of the merchant interface behind a
 * small utility control.
 */
export function DemoSheet({ open, onClose }: DemoSheetProps) {
  const navigate = useNavigate();
  const { demoSteps, openSaleAmount, simulateIncomingPayment, resetDemo } = useApp();
  const doneCount = demoSteps.filter((s) => s.done).length;

  const runStep = (step: (typeof demoSteps)[number]) => {
    if (step.action === 'simulate' && openSaleAmount !== null) simulateIncomingPayment();
    navigate(step.route);
    onClose();
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="See how VyaparPulse works"
      subtitle={`Five steps · ${doneCount} of ${demoSteps.length} seen`}>
      
      <p className="mb-3 text-vp-body text-vp-ink-2">
        Each step opens the real screen and runs the real state change, in the order a shopkeeper
        would experience it.
      </p>

      <ol className="space-y-2">
        {demoSteps.map((step, i) =>
        <li key={step.id}>
            <button
            type="button"
            onClick={() => runStep(step)}
            className={`vp-focus vp-press flex w-full items-center gap-3 rounded-vp border p-3.5 text-left ${
            step.done ? 'border-vp-paid-line bg-vp-paid-soft' : 'border-vp-line bg-vp-surface'}`
            }>
            
              <span
              className={`vp-num flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-vp-small font-bold ${
              step.done ? 'bg-vp-paid text-white' : 'bg-vp-surface-2 text-vp-ink-2'}`
              }>
              
                {step.done ? <Check size={16} strokeWidth={3} aria-hidden="true" /> : i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-vp-body font-bold text-vp-ink">{step.label}</span>
                <span className="block text-vp-small text-vp-ink-2">{step.hint}</span>
              </span>
              {step.action === 'simulate' ?
            <Zap
              size={16}
              strokeWidth={2.6}
              className="shrink-0 text-vp-brand"
              aria-hidden="true" /> :

            null}
              <ArrowRight
              size={18}
              strokeWidth={2.4}
              className="shrink-0 text-vp-ink-3"
              aria-hidden="true" />
            
            </button>
          </li>
        )}
      </ol>

      <div className="mt-5 grid gap-2.5">
        <Button
          block
          disabled={openSaleAmount === null}
          icon={<Zap size={16} aria-hidden="true" />}
          onClick={() => {
            simulateIncomingPayment();
            navigate('/payments');
            onClose();
          }}>
          
          {openSaleAmount === null ?
          'No unpaid sale to match' :
          `Simulate ${formatRupees(openSaleAmount)} arriving`}
        </Button>
        <Button
          variant="secondary"
          block
          icon={<RotateCcw size={16} aria-hidden="true" />}
          onClick={() => {
            resetDemo();
            navigate('/');
            onClose();
          }}>
          
          Reset to the seeded demo state
        </Button>
      </div>

      <div className="mt-4">
        <PrototypeNote>
          nothing here is connected to a bank, a UPI provider, a speech service or a server.
          Payments are generated in the app, voice capture replays a sample sentence, and everything
          lives in this browser session only — reloading returns to the seeded state.
        </PrototypeNote>
      </div>
    </BottomSheet>);

}