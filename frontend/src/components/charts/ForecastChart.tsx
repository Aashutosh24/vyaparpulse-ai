import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { formatCompactRupees, formatRupees } from '../../utils/format';
import type { ForecastPoint, TrendPoint } from '../../types';

interface ForecastChartProps {
  actual: TrendPoint[];
  forecast: ForecastPoint[];
}

const W = 320;
const H = 150;
const PAD_L = 6;
const PAD_R = 6;
const PAD_T = 10;
const PAD_B = 22;

/** Actual is solid; the predicted range is a shaded band with a dashed centre line. */
export function ForecastChart({ actual, forecast }: ForecastChartProps) {
  const reduced = useReducedMotion();
  const points = [...actual.map((a) => a.value), ...forecast.map((f) => f.high)];
  const max = Math.max(...points) * 1.08;
  const min = Math.min(...actual.map((a) => a.value), ...forecast.map((f) => f.low)) * 0.85;
  const total = actual.length + forecast.length;

  const x = (i: number) => PAD_L + i * (W - PAD_L - PAD_R) / (total - 1);
  const y = (v: number) =>
  PAD_T + (1 - (v - min) / (max - min)) * (H - PAD_T - PAD_B);

  const actualPath = actual.map((a, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(a.value)}`).join(' ');
  const bridgeStart = actual.length - 1;
  const expectedPath = [
  `M${x(bridgeStart)},${y(actual[actual.length - 1].value)}`,
  ...forecast.map((f, i) => `L${x(bridgeStart + 1 + i)},${y(f.expected)}`)].
  join(' ');

  const bandTop = forecast.map((f, i) => `${i === 0 ? 'M' : 'L'}${x(bridgeStart + 1 + i)},${y(f.high)}`);
  const bandBottom = [...forecast].
  reverse().
  map((f, i) => `L${x(total - 1 - i)},${y(f.low)}`);
  const bandPath = [
  `M${x(bridgeStart)},${y(actual[actual.length - 1].value)}`,
  ...bandTop.map((p, i) => i === 0 ? p.replace('M', 'L') : p),
  ...bandBottom,
  'Z'].
  join(' ');

  const label = `Cash flow: last ${actual.length} days actual, next ${forecast.length} days predicted between ${formatRupees(
    forecast.reduce((s, f) => s + f.low, 0)
  )} and ${formatRupees(forecast.reduce((s, f) => s + f.high, 0))}.`;

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label={label}>
        
        <rect
          x={x(bridgeStart)}
          y={PAD_T - 6}
          width={W - x(bridgeStart)}
          height={H - PAD_B - PAD_T + 6}
          fill="var(--vp-surface-2)" />
        
        <line
          x1={x(bridgeStart)}
          x2={x(bridgeStart)}
          y1={PAD_T - 4}
          y2={H - PAD_B}
          stroke="var(--vp-line-strong)"
          strokeWidth="1"
          strokeDasharray="3 3" />
        
        <motion.path
          d={bandPath}
          fill="var(--vp-forecast-soft)"
          initial={reduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.35 }} />
        
        <motion.path
          d={expectedPath}
          fill="none"
          stroke="var(--vp-forecast)"
          strokeWidth="2.5"
          strokeDasharray="6 4"
          strokeLinecap="round"
          initial={reduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.35, delay: 0.45 }} />
        
        <motion.path
          d={actualPath}
          fill="none"
          stroke="var(--vp-brand)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={reduced ? false : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.6, ease: 'easeOut' }} />
        
        <circle
          cx={x(bridgeStart)}
          cy={y(actual[actual.length - 1].value)}
          r="4"
          fill="var(--vp-brand)" />
        
        <text
          x={x(bridgeStart) - 4}
          y={H - 6}
          textAnchor="end"
          fontSize="11"
          fontWeight="700"
          fill="var(--vp-ink-3)">
          
          Today
        </text>
        <text
          x={x(total - 1)}
          y={H - 6}
          textAnchor="end"
          fontSize="11"
          fontWeight="700"
          fill="var(--vp-forecast)">
          
          +7 days
        </text>
      </svg>
      <table className="sr-only">
        <caption>{label}</caption>
        <tbody>
          {forecast.map((f) =>
          <tr key={f.label}>
              <th scope="row">{f.label}</th>
              <td>
                {formatCompactRupees(f.low)} to {formatCompactRupees(f.high)}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>);

}