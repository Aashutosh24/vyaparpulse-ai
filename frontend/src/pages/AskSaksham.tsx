import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Mic, MicOff, ChevronRight, Zap, Package, TrendingUp, DollarSign, HelpCircle } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import type { SakshamResponse } from '../types';

/**
 * Ask SAKSHAM Screen
 * ==================
 * Business intelligence interface — NOT a chatbot.
 * Voice or typed query → Intent → Economic Engine → Deterministic answer.
 *
 * The LLM never computes business numbers.
 * Every answer comes from the Economic Engine, narrated by the Local Reasoner.
 *
 * Route: /ask
 */

const QUICK_QUERIES = [
  { label: 'What should I buy?', icon: Package, category: 'inventory' },
  { label: 'Which product sells fastest?', icon: TrendingUp, category: 'demand' },
  { label: 'Why did my margin fall?', icon: DollarSign, category: 'margin' },
  { label: 'What changed this week?', icon: Zap, category: 'memory' },
  { label: 'How much money do I need?', icon: DollarSign, category: 'capital' },
  { label: 'When will tea run out?', icon: Package, category: 'stockout' },
];

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  inventory: { bg: 'var(--sk-alert-soft)', text: 'var(--sk-alert)', border: 'var(--sk-alert-line)' },
  demand:    { bg: 'var(--sk-demand-up-soft)', text: 'var(--sk-demand-up)', border: 'var(--sk-demand-up-line)' },
  margin:    { bg: 'var(--sk-demand-down-soft)', text: 'var(--sk-demand-down)', border: 'var(--sk-demand-down-line)' },
  memory:    { bg: 'var(--sk-memory-soft)', text: 'var(--sk-memory)', border: 'var(--sk-memory-line)' },
  capital:   { bg: 'var(--sk-memory-soft)', text: 'var(--sk-memory)', border: 'var(--sk-memory-line)' },
  stockout:  { bg: 'var(--sk-alert-soft)', text: 'var(--sk-alert)', border: 'var(--sk-alert-line)' },
};

export function AskSaksham() {
  const navigate = useNavigate();
  const { askSaksham } = useApp();
  const [query, setQuery] = React.useState('');
  const [response, setResponse] = React.useState<SakshamResponse | null>(null);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [listening, setListening] = React.useState(false);

  // Web Speech API for voice input (browser-native, no Vosk needed on this path)
  const recognitionRef = React.useRef<SpeechRecognition | null>(null);

  const handleAsk = React.useCallback((text: string) => {
    if (!text.trim()) return;
    setIsProcessing(true);
    setResponse(null);
    // Small delay for UX feel — computation is instant
    setTimeout(() => {
      const result = askSaksham(text);
      setResponse(result);
      setIsProcessing(false);
    }, 300);
  }, [askSaksham]);

  const handleVoice = React.useCallback(() => {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Voice input is not available in this browser. Please type your question.');
      return;
    }

    const rec = new SpeechRecognition();
    rec.lang = 'en-IN';
    rec.interimResults = false;
    rec.maxAlternatives = 1;

    rec.onstart = () => setListening(true);
    rec.onend = () => setListening(false);
    rec.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0][0].transcript;
      setQuery(transcript);
      handleAsk(transcript);
    };
    rec.onerror = () => setListening(false);

    recognitionRef.current = rec;
    rec.start();
  }, [listening, handleAsk]);

  return (
    <motion.div
      className="flex flex-col h-full bg-vp-bg"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28 }}
    >
      {/* Header */}
      <div className="sticky top-0 z-10 bg-vp-surface border-b border-vp-line px-4 pt-safe-top">
        <div className="flex items-center gap-3 h-14">
          <button onClick={() => navigate(-1)} className="p-1.5 -ml-1.5 rounded-lg text-vp-ink-2 active:scale-95">
            <ArrowLeft size={22} />
          </button>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-vp-ink-3">Business Intelligence</p>
            <h1 className="text-base font-bold text-vp-ink leading-tight">Ask SAKSHAM</h1>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-5 pb-4">

        {/* Input area */}
        <motion.div
          className="bg-vp-surface rounded-2xl border border-vp-line p-4"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <textarea
                className="w-full text-sm text-vp-ink placeholder-vp-ink-3 bg-transparent resize-none outline-none leading-relaxed"
                placeholder={'What should I buy tomorrow?\nnaalaiku stock vaanganum?\nkal kya kharidna chahiye?'}
                rows={3}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleAsk(query);
                  }
                }}
              />
            </div>

            {/* Voice button */}
            <motion.button
              onClick={handleVoice}
              className="p-3 rounded-2xl shrink-0 transition-all"
              style={{
                background: listening ? 'var(--sk-alert)' : 'var(--vp-brand-soft)',
                color: listening ? 'white' : 'var(--vp-brand)',
              }}
              animate={listening ? { scale: [1, 1.1, 1] } : {}}
              transition={{ repeat: Infinity, duration: 0.8 }}
              aria-label={listening ? 'Stop listening' : 'Start voice input'}
            >
              {listening ? <MicOff size={20} /> : <Mic size={20} />}
            </motion.button>
          </div>

          {listening && (
            <motion.div
              className="flex items-center gap-2 mt-3 pt-3 border-t border-vp-line"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <div className="flex gap-1">
                {[0, 1, 2, 3].map((i) => (
                  <motion.div
                    key={i}
                    className="w-1 rounded-full"
                    style={{ background: 'var(--sk-alert)', height: 16 }}
                    animate={{ scaleY: [0.4, 1, 0.4] }}
                    transition={{ repeat: Infinity, duration: 0.6, delay: i * 0.1 }}
                  />
                ))}
              </div>
              <p className="text-sm font-medium" style={{ color: 'var(--sk-alert)' }}>Listening…</p>
            </motion.div>
          )}

          <div className="flex items-center justify-between mt-3 pt-3 border-t border-vp-line">
            <p className="text-[10px] text-vp-ink-3">English, Hindi, Tamil supported</p>
            <button
              onClick={() => handleAsk(query)}
              disabled={!query.trim() || isProcessing}
              className="px-4 py-1.5 rounded-xl text-sm font-bold disabled:opacity-40 transition-opacity"
              style={{ background: 'var(--vp-brand)', color: 'white' }}
            >
              Ask →
            </button>
          </div>
        </motion.div>

        {/* Quick queries */}
        {!response && !isProcessing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            <p className="text-[11px] font-bold uppercase tracking-wider text-vp-ink-3 mb-3">Quick Questions</p>
            <div className="grid grid-cols-2 gap-2.5">
              {QUICK_QUERIES.map((q, i) => {
                const colors = CATEGORY_COLORS[q.category];
                const { icon: QIcon } = q;
                return (
                  <motion.button
                    key={q.label}
                    onClick={() => { setQuery(q.label); handleAsk(q.label); }}
                    className="flex items-start gap-2.5 p-3.5 rounded-2xl border text-left active:scale-97 transition-transform"
                    style={{ background: colors.bg, borderColor: colors.border }}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 + i * 0.04 }}
                    whileTap={{ scale: 0.97 }}
                  >
                    <QIcon size={14} style={{ color: colors.text, flexShrink: 0, marginTop: 2 }} />
                    <span className="text-xs font-semibold leading-snug" style={{ color: 'var(--vp-ink)' }}>
                      {q.label}
                    </span>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Processing */}
        <AnimatePresence>
          {isProcessing && (
            <motion.div
              className="flex items-center gap-3 p-4 rounded-2xl border border-vp-line bg-vp-surface"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <div className="flex gap-1.5">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="w-2 h-2 rounded-full"
                    style={{ background: 'var(--sk-memory)' }}
                    animate={{ scale: [0.6, 1, 0.6] }}
                    transition={{ repeat: Infinity, duration: 0.7, delay: i * 0.2 }}
                  />
                ))}
              </div>
              <p className="text-sm text-vp-ink-2 font-medium">SAKSHAM is thinking…</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Response */}
        <AnimatePresence>
          {response && !isProcessing && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-3"
            >
              {/* Response headline card */}
              <div className="bg-vp-surface rounded-2xl border border-vp-line overflow-hidden">
                <div className="px-4 pt-4 pb-3 border-b border-vp-line"
                  style={{ background: 'var(--sk-memory-soft)' }}>
                  <div className="flex items-center gap-2 mb-2">
                    <Zap size={14} style={{ color: 'var(--sk-memory)' }} />
                    <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--sk-memory)' }}>
                      SAKSHAM Answer
                    </p>
                    {response.computedOffline && (
                      <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded-full font-medium"
                        style={{ background: 'var(--sk-demand-up-soft)', color: 'var(--sk-demand-up)', border: '1px solid var(--sk-demand-up-line)' }}>
                        ✓ Offline
                      </span>
                    )}
                  </div>
                  <h2 className="text-base font-bold text-vp-ink leading-snug">{response.headline}</h2>
                  {response.keyMetric && (
                    <p className="text-2xl font-black mt-1" style={{ color: 'var(--sk-memory)' }}>
                      {response.keyMetric}
                    </p>
                  )}
                </div>

                <div className="px-4 py-3">
                  <p className="text-sm text-vp-ink-2 leading-relaxed">{response.explanation}</p>
                </div>

                {response.evidence.length > 0 && (
                  <div className="px-4 pb-3 border-t border-vp-line pt-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-vp-ink-3 mb-2">Evidence</p>
                    <div className="space-y-1.5">
                      {response.evidence.map((e, i) => (
                        <div key={i} className="flex items-center justify-between">
                          <p className="text-xs text-vp-ink-3">{e.label}</p>
                          <p className="text-xs font-bold text-vp-ink">{e.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {response.actionRoute && (
                  <button
                    onClick={() => navigate(response.actionRoute!)}
                    className="w-full flex items-center justify-between px-4 py-3 border-t border-vp-line"
                    style={{ color: 'var(--sk-memory)' }}
                  >
                    <span className="text-sm font-bold">{response.actionLabel}</span>
                    <ChevronRight size={18} />
                  </button>
                )}
              </div>

              {/* Ask again */}
              <button
                onClick={() => { setResponse(null); setQuery(''); }}
                className="w-full py-3 text-sm font-semibold text-vp-ink-2 text-center"
              >
                Ask another question →
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Disclaimer */}
        <div className="flex items-start gap-2 px-1">
          <HelpCircle size={13} className="text-vp-ink-3 mt-0.5 shrink-0" />
          <p className="text-[10px] text-vp-ink-3 leading-relaxed">
            SAKSHAM answers use your sales data and supplier invoices. Business math is calculated deterministically — not by AI. Results are based on {' '}14 days of recorded activity.
          </p>
        </div>

      </div>
    </motion.div>
  );
}
