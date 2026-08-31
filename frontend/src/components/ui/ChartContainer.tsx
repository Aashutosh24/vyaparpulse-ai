import React from 'react';
import { Surface } from './Surface';

interface ChartContainerProps {
  title: string;
  unit: string;
  period?: React.ReactNode;
  legend?: {label: string;swatch: React.ReactNode;}[];
  /** The business reading of the chart — what it actually tells the merchant. */
  reading?: string;
  footnote?: string;
  children: React.ReactNode;
}

/** Every chart states what it measures, over what period, in what unit. */
export function ChartContainer({
  title,
  unit,
  period,
  legend,
  reading,
  footnote,
  children
}: ChartContainerProps) {
  return (
    <Surface>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-vp-h2 font-bold text-vp-ink">{title}</h3>
          <p className="mt-0.5 text-vp-small text-vp-ink-3">{unit}</p>
        </div>
        {period}
      </div>
      <div className="mt-4">{children}</div>
      {legend?.length ?
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
          {legend.map((l) =>
        <li key={l.label} className="flex items-center gap-1.5 text-vp-small text-vp-ink-2">
              {l.swatch}
              {l.label}
            </li>
        )}
        </ul> :
      null}
      {reading ?
      <p className="mt-3 rounded-vp-sm border-l-[3px] border-vp-brand bg-vp-brand-soft px-3 py-2 text-vp-body font-semibold text-vp-ink">
          {reading}
        </p> :
      null}
      {footnote ? <p className="mt-3 text-vp-small text-vp-ink-3">{footnote}</p> : null}
    </Surface>);

}