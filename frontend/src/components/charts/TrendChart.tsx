import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { formatCompactRupees, formatRupees } from '../../utils/format';
import type { TrendPoint } from '../../types';

interface TrendChartProps {
  data: TrendPoint[];
  highlightLast?: boolean;
  height?: number;
  ariaLabel: string;
}

/** Bars, not lines: a shopkeeper compares days, not slopes. */
export function TrendChart({
  data,
  highlightLast = true,
  height = 128,
  ariaLabel
}: TrendChartProps) {
  const reduced = useReducedMotion();
  const max = Math.max(...data.map((d) => d.value), 1);
  const peakIndex = data.reduce((best, d, i) => d.value > data[best].value ? i : best, 0);

  return (
    <div>
      <div role="img" aria-label={ariaLabel} className="flex items-end gap-1.5" style={{ height }}>
        {data.map((d, i) => {
          const isCurrent = highlightLast && i === data.length - 1;
          const isPeak = i === peakIndex;
          const pct = `${Math.max(d.value / max * 100, 6)}%`;
          return (
            <div key={d.label} className="flex h-full flex-1 flex-col justify-end gap-1">
              {isPeak ?
              <span className="vp-num text-center text-[11px] font-bold leading-none text-vp-ink-2">
                  {formatCompactRupees(d.value)}
                </span> :
              null}
              <motion.div
                className={`w-full rounded-t-[5px] ${
                isCurrent ? 'bg-vp-brand' : isPeak ? 'bg-vp-brand-mid' : 'bg-vp-brand-light'}`
                }
                initial={reduced ? false : { height: 0 }}
                animate={{ height: pct }}
                transition={{ duration: 0.45, delay: reduced ? 0 : i * 0.04, ease: 'easeOut' }}
                style={reduced ? { height: pct } : undefined} />
              
            </div>);

        })}
      </div>
      <div className="mt-2 flex gap-1.5 border-t border-vp-line pt-2">
        {data.map((d, i) =>
        <span
          key={d.label}
          className={`flex-1 text-center text-[11px] font-semibold ${
          highlightLast && i === data.length - 1 ? 'text-vp-ink' : 'text-vp-ink-3'}`
          }>
          
            {d.label}
          </span>
        )}
      </div>
      <table className="sr-only">
        <caption>{ariaLabel}</caption>
        <tbody>
          {data.map((d) =>
          <tr key={d.label}>
              <th scope="row">{d.label}</th>
              <td>{formatRupees(d.value)}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>);

}