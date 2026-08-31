import React from 'react';
import { motion } from 'framer-motion';
import { Keyboard, Mic, Square } from 'lucide-react';
import { AnalyzingNote } from '../ui/States';
import { Surface } from '../ui/Surface';
import { recordSaleHint } from '../../data/mockData';

interface VoiceCaptureProps {
  phase: 'idle' | 'listening' | 'parsing';
  transcript: string;
  onStart: () => void;
  onStop: () => void;
  onManual: () => void;
}

export function VoiceCapture({
  phase,
  transcript,
  onStart,
  onStop,
  onManual
}: VoiceCaptureProps) {
  const listening = phase === 'listening';

  return (
    <div className="space-y-4">
      <Surface className="text-center">
        <div className="relative mx-auto flex h-[132px] w-[132px] items-center justify-center">
          {listening ?
          <>
              <motion.span
              className="absolute inset-0 rounded-full bg-vp-brand-soft"
              animate={{ scale: [1, 1.18, 1], opacity: [0.7, 0.2, 0.7] }}
              transition={{ duration: 1.8, repeat: Infinity }} />
            
              <motion.span
              className="absolute inset-3 rounded-full bg-vp-brand-light"
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 1.4, repeat: Infinity }} />
            
            </> :
          null}
          <button
            type="button"
            onClick={listening ? onStop : onStart}
            disabled={phase === 'parsing'}
            aria-label={listening ? 'Stop listening' : 'Start speaking your sale'}
            className={`vp-focus relative flex h-[100px] w-[100px] items-center justify-center rounded-full text-vp-ink-inv shadow-vp-raised transition-colors disabled:opacity-60 ${
            listening ? 'bg-vp-review' : 'bg-vp-brand'}`
            }>
            
            {listening ?
            <Square size={30} strokeWidth={2.6} aria-hidden="true" /> :

            <Mic size={36} strokeWidth={2.3} aria-hidden="true" />
            }
          </button>
        </div>

        <p className="mt-4 text-vp-h2 font-bold text-vp-ink">
          {listening ? 'Listening…' : phase === 'parsing' ? 'One moment' : 'Speak your sale'}
        </p>
        <p className="mx-auto mt-1 max-w-[34ch] text-vp-body text-vp-ink-2">
          {listening ? 'Speak normally. Tap the square when you’re done.' : recordSaleHint}
        </p>

        {listening ?
        <div className="mt-4 flex h-8 items-end justify-center gap-1" aria-hidden="true">
            {Array.from({ length: 13 }).map((_, i) =>
          <motion.span
            key={i}
            className="w-1.5 rounded-full bg-vp-brand-mid"
            animate={{ height: [6, 10 + i * 7 % 22, 6] }}
            transition={{ duration: 0.8 + i % 4 * 0.15, repeat: Infinity }} />

          )}
          </div> :
        null}
      </Surface>

      {transcript ?
      <Surface tone="muted">
          <p className="text-vp-caption font-bold uppercase text-vp-ink-3">You said</p>
          <p className="mt-1 text-vp-h2 font-semibold leading-snug text-vp-ink">“{transcript}”</p>
        </Surface> :
      null}

      {phase === 'parsing' ? <AnalyzingNote label="Reading your sale…" /> : null}

      {phase === 'idle' ?
      <button
        type="button"
        onClick={onManual}
        className="vp-focus flex min-h-[52px] w-full items-center justify-center gap-2 rounded-vp border border-vp-line-strong bg-vp-surface text-vp-label font-bold text-vp-ink">
        
          <Keyboard size={18} strokeWidth={2.4} aria-hidden="true" />
          Enter manually
        </button> :
      null}
    </div>);

}