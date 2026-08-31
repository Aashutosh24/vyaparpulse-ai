import React from 'react';

type Tone = 'default' | 'muted' | 'brand' | 'flat';

interface SurfaceProps {
  children: React.ReactNode;
  tone?: Tone;
  className?: string;
  as?: 'div' | 'section' | 'article' | 'li';
  padded?: boolean;
}

const toneClass: Record<Tone, string> = {
  default: 'bg-vp-surface border-vp-line shadow-vp',
  muted: 'bg-vp-surface-2 border-vp-line',
  brand: 'bg-vp-brand-soft border-vp-brand-line',
  flat: 'bg-vp-surface border-vp-line'
};

/** The single card primitive. One radius, one border, one shadow — everywhere. */
export function Surface({
  children,
  tone = 'default',
  className = '',
  as = 'div',
  padded = true
}: SurfaceProps) {
  const Tag = as;
  return (
    <Tag
      className={`rounded-vp border ${toneClass[tone]} ${padded ? 'p-4' : ''} ${className}`}>
      
      {children}
    </Tag>);

}