import React from 'react';

export interface ChipOption<T extends string> {
  value: T;
  label: string;
  count?: number;
}

interface FilterChipsProps<T extends string> {
  options: ChipOption<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  size?: 'sm' | 'md';
}

export function FilterChips<T extends string>({
  options,
  value,
  onChange,
  label,
  size = 'md'
}: FilterChipsProps<T>) {
  return (
    <div role="group" aria-label={label} className="vp-scroll flex gap-2 overflow-x-auto">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(opt.value)}
            className={`vp-focus shrink-0 whitespace-nowrap rounded-full border font-semibold transition-colors ${
            size === 'md' ?
            'min-h-[40px] px-3.5 text-vp-body' :
            'min-h-[36px] px-3 text-vp-small'} ${

            active ?
            'border-vp-brand bg-vp-brand text-vp-ink-inv' :
            'border-vp-line bg-vp-surface text-vp-ink-2'}`
            }>
            
            {opt.label}
            {typeof opt.count === 'number' ?
            <span className={active ? 'opacity-80' : 'text-vp-ink-3'}> {opt.count}</span> :
            null}
          </button>);

      })}
    </div>);

}