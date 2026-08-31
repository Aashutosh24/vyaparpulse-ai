import React from 'react';
import { FlaskConical } from 'lucide-react';

interface PrototypeNoteProps {
  children: React.ReactNode;
}

/**
 * Honest labelling for behaviour this prototype simulates. There is no UPI
 * integration and no server, so anywhere the app would normally depend on
 * one, it says so plainly instead of implying a live connection.
 */
export function PrototypeNote({ children }: PrototypeNoteProps) {
  return (
    <p className="flex items-start gap-2 rounded-vp border border-dashed border-vp-line-strong bg-vp-surface-2 px-3 py-2.5 text-vp-small text-vp-ink-2">
      <FlaskConical size={15} strokeWidth={2.4} className="mt-0.5 shrink-0" aria-hidden="true" />
      <span>
        <span className="font-bold text-vp-ink">Prototype: </span>
        {children}
      </span>
    </p>);

}