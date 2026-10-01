import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle2, Clock, CloudOff } from 'lucide-react';
import { AppBar } from '../components/shell/AppBar';
import { VoiceCapture } from '../components/sell/VoiceCapture';
import { SaleReviewCard } from '../components/sell/SaleReviewCard';
import { ManualSaleForm } from '../components/sell/ManualSaleForm';
import { Surface } from '../components/ui/Surface';
import { Button } from '../components/ui/Button';
import { StatusBadge } from '../components/ui/StatusBadge';
import { PrototypeNote } from '../components/ui/PrototypeNote';
import { ChangeChips } from '../components/ui/ChangeChips';
import { sampleParsedSale } from '../data/mockData';
import { formatRupees, itemSummary } from '../utils/format';
import { useApp } from '../contexts/AppContext';
import { VoiceAgentClient, type VoiceAgentEvent } from '../services/voiceAgentClient';
import { mapVoiceToCanonical } from '../services/canonicalTransaction';
import type { ChangeImpact, LineItem, PaymentMethod, Transaction } from '../types';

type Phase = 'idle' | 'listening' | 'parsing' | 'review' | 'manual' | 'saved';

const TRANSCRIPT = sampleParsedSale.transcript;
const DEFAULT_VOICE_URL = (import.meta as any).env?.VITE_VOICE_URL ?? 'http://127.0.0.1:8203';

export function RecordSale() {
  const navigate = useNavigate();
  const { addSale, offline, transactions, impact, mode } = useApp();
  const [phase, setPhase] = React.useState<Phase>('idle');
  const [transcript, setTranscript] = React.useState('');
  const [items, setItems] = React.useState<LineItem[]>(sampleParsedSale.items);
  const [customerName, setCustomerName] = React.useState<string | null>(null);
  const [ambiguous, setAmbiguous] = React.useState(true);
  const [method, setMethod] = React.useState<PaymentMethod>('upi');
  const [saved, setSaved] = React.useState<Transaction | null>(null);
  const [voiceConfidence, setVoiceConfidence] = React.useState<number | null>(null);
  const [voiceError, setVoiceError] = React.useState<string | null>(null);
  const timers = React.useRef<number[]>([]);
  const voiceClient = React.useMemo(
    () => (mode === 'live' ? new VoiceAgentClient(DEFAULT_VOICE_URL) : null),
    [mode]
  );

  React.useEffect(
    () => () => timers.current.forEach((t) => window.clearTimeout(t)),
    []
  );

  const total = items.reduce((s, i) => s + i.qty * i.unitPrice, 0);

  // --- DEMO MODE: unchanged from before this integration ---
  const startListeningDemo = () => {
    setPhase('listening');
    setTranscript('');
    const words = TRANSCRIPT.split(' ');
    words.forEach((_, i) => {
      const t = window.setTimeout(
        () => setTranscript(words.slice(0, i + 1).join(' ')),
        180 * (i + 1)
      );
      timers.current.push(t);
    });
    const stop = window.setTimeout(() => finishListeningDemo(), 180 * words.length + 500);
    timers.current.push(stop);
  };

  const finishListeningDemo = () => {
    setTranscript(TRANSCRIPT);
    setPhase('parsing');
    const t = window.setTimeout(() => {
      setItems(sampleParsedSale.items);
      setAmbiguous(true);
      setCustomerName(null);
      setPhase('review');
    }, 1100);
    timers.current.push(t);
  };

  // --- LIVE MODE: the real voice agent, same UI/phases as demo mode ---
  const startListeningLive = async () => {
    setPhase('listening');
    setTranscript('');
    setVoiceError(null);
    if (!voiceClient) return;
    try {
      await voiceClient.startListening((event: VoiceAgentEvent) => {
        if (event.type === 'partial' || event.type === 'wake') {
          setTranscript(event.text);
        } else if (event.type === 'heard') {
          setTranscript(event.text);
          setPhase('parsing');
        } else if (event.type === 'result') {
          setTranscript(event.transcript);
          if (event.cancelled) {
            setPhase('idle');
            return;
          }
          if (!event.accepted || !event.transaction) {
            // Never guess -- an unaccepted result goes back to idle with the
            // reason surfaced, not a fabricated review card.
            setVoiceError(event.reason || "Didn't catch a clear item and amount -- try again.");
            setPhase('idle');
            return;
          }
          const canonical = mapVoiceToCanonical(event.transaction);
          setItems(canonical.items.map((i) => ({ name: i.name, qty: i.qty, unitPrice: i.unitPrice })));
          setVoiceConfidence(canonical.voice?.confidence ?? null);
          setAmbiguous(false); // voice agent doesn't do customer-name disambiguation; that's the frontend's own existing feature
          setCustomerName(null);
          setPhase('review');
        } else if (event.type === 'error') {
          setVoiceError(event.message);
        }
      });
    } catch (err) {
      setPhase('idle');
      setVoiceError(err instanceof Error ? err.message : 'Could not reach the voice agent.');
    }
  };

  const finishListeningLive = () => {
    voiceClient?.stopListening();
    // Phase transition happens from the 'result' event above, not here --
    // the server decides when the utterance is actually done being parsed.
  };

  const startListening = mode === 'live' ? startListeningLive : startListeningDemo;
  const finishListening = mode === 'live' ? finishListeningLive : finishListeningDemo;

  const confirm = () => {
    const sale = addSale({
      customerName: customerName ?? 'Walk-in customer',
      items,
      method,
      source: transcript ? 'voice' : 'manual'
    });
    setSaved(sale);
    setPhase('saved');
  };

  const reset = () => {
    setPhase('idle');
    setTranscript('');
    setCustomerName(null);
    setAmbiguous(true);
    setMethod('upi');
    setItems(sampleParsedSale.items);
    setSaved(null);
    setVoiceConfidence(null);
    setVoiceError(null);
  };

  return (
    <div className="pb-8">
      <AppBar
        title="Record sale"
        subtitle={phase === 'saved' ? 'Saved' : 'Speak or tap — whatever is quicker'}
        back={false}
        action={
        offline ?
        <span className="inline-flex items-center gap-1 rounded-full bg-vp-gold-soft px-2.5 py-1.5 text-vp-small font-bold text-vp-gold-ink">
              <CloudOff size={14} aria-hidden="true" /> Offline
            </span> :
        null
        } />
      

      <div className="px-4 pt-4">
        {phase === 'idle' || phase === 'listening' || phase === 'parsing' ?
        <div className="space-y-4">
            <VoiceCapture
            phase={phase}
            transcript={transcript}
            onStart={startListening}
            onStop={finishListening}
            onManual={() => setPhase('manual')} />
          
            {phase === 'idle' ?
          <PrototypeNote>
                {mode === 'live'
                  ? 'Microphone is connected to the real voice agent. Hold the button and speak your sale.'
                  : 'Speech recognition is not wired up in this build. Tapping the mic replays a sample sentence so the capture and confirmation flow can be shown.'}
              </PrototypeNote> :
          null}
            {voiceError ?
          <div className="rounded-vp border border-red-200 bg-red-50 p-3 text-vp-body font-semibold text-red-700">
                {voiceError}
              </div> :
          null}
          </div> :
        null}

        {phase === 'manual' ?
        <ManualSaleForm
          onCancel={() => setPhase('idle')}
          onReview={(name, picked) => {
            setItems(picked);
            setCustomerName(name);
            setAmbiguous(false);
            setTranscript('');
            setPhase('review');
          }} /> :

        null}

        {phase === 'review' ?
        <SaleReviewCard
          items={items}
          total={total}
          customerOptions={sampleParsedSale.customerOptions}
          customerName={customerName}
          ambiguous={ambiguous}
          method={method}
          voiceConfidence={voiceConfidence}
          onPickCustomer={(name) => {
            setCustomerName(name);
            setAmbiguous(false);
          }}
          onMethodChange={setMethod}
          onConfirm={confirm}
          onEdit={() => setPhase('manual')}
          onRecordAgain={startListening} /> :

        null}

        {phase === 'saved' && saved ?
        <SavedSale
          sale={transactions.find((t) => t.id === saved.id) ?? saved}
          offline={offline}
          impact={impact}
          mode={mode}
          onAnother={reset}
          onLedger={() => navigate('/ledger')} /> :

        null}
      </div>
    </div>);

}

interface SavedSaleProps {
  sale: Transaction;
  offline: boolean;
  impact: ChangeImpact | null;
  onAnother: () => void;
  onLedger: () => void;
  mode: 'demo' | 'live';
}

function SavedSale({ sale, offline, impact, onAnother, onLedger, mode }: SavedSaleProps) {
  const awaiting = sale.status !== 'paid';
  return (
    <div className="space-y-3">
      <Surface className="text-center">
        <motion.span
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 420, damping: 20 }}
          className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-vp-paid-soft text-vp-paid">
          
          <CheckCircle2 size={30} strokeWidth={2.6} aria-hidden="true" />
        </motion.span>
        <h2 className="mt-3 text-vp-h1 font-bold text-vp-ink">Sale recorded</h2>
        <p className="vp-num mt-1 text-vp-hero font-extrabold text-vp-ink">
          {formatRupees(sale.amount)}
        </p>
        <p className="text-vp-body text-vp-ink-2">
          {sale.name} · {itemSummary(sale.items)}
        </p>
        <p className="vp-num mt-2 text-vp-small font-semibold text-vp-ink-3">
          Sale {sale.ref} · {sale.time}
        </p>
        <div className="mt-3 flex justify-center">
          <StatusBadge
            status={sale.status}
            size="md"
            note={sale.status === 'paid' ? 'closed' : formatRupees(sale.amount)} />
          
        </div>
      </Surface>

      {awaiting && !offline ?
      <>
          <Surface tone="muted">
            <p className="flex items-center gap-2 text-vp-body font-bold text-vp-ink">
              <Clock size={16} strokeWidth={2.5} className="text-vp-pending" aria-hidden="true" />
              Waiting for the payment
            </p>
            <p className="mt-1 text-vp-body text-vp-ink-2">
              When {formatRupees(sale.amount)} arrives, VyaparPulse matches it to {sale.ref} and
              closes the sale automatically.
            </p>
          </Surface>
          <PrototypeNote>
            {mode === 'live'
              ? 'Backend is running — when a real UPI credit SMS arrives it will be matched automatically. Use "Submit test payment" on the Payments screen to test the matching pipeline.'
              : 'No real UPI feed is connected. A simulated payment will be generated here a few seconds after the sale to demonstrate the matching journey.'}
          </PrototypeNote>
        </> :
      null}

      {/* Cause and effect, on the same screen: the sale the merchant just
           recorded visibly closes itself when the payment is matched. */}
      {!awaiting && sale.method !== 'cash' ?
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        className="rounded-vp border border-vp-paid-line bg-vp-paid-soft p-4">
        
          <p className="flex items-center gap-2 text-vp-body font-bold text-vp-paid">
            <CheckCircle2 size={16} strokeWidth={2.6} aria-hidden="true" />
            Payment received and matched
          </p>
          <p className="mt-1 text-vp-body text-vp-ink-2">
            {formatRupees(sale.amount)} from {sale.name} was reconciled against {sale.ref}.
          </p>
          {impact && impact.rows.length ?
        <div className="mt-3 border-t border-vp-paid-line pt-3">
              <ChangeChips impact={impact} />
            </div> :
        null}
        </motion.div> :
      null}

      {offline ?
      <Surface tone="muted">
          <p className="flex items-center gap-2 text-vp-body font-bold text-vp-gold-ink">
            <CloudOff size={16} strokeWidth={2.5} aria-hidden="true" />
            Saved on this device
          </p>
          <p className="mt-1 text-vp-body text-vp-ink-2">
            Payment matching runs once you are back online. Nothing is lost until then.
          </p>
        </Surface> :
      null}

      <Button size="lg" block onClick={onAnother}>
        Record another sale
      </Button>
      <Button variant="secondary" block onClick={onLedger}>
        View ledger
      </Button>
    </div>);

}