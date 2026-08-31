import React from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: React.ReactNode;
  block?: boolean;
  children: React.ReactNode;
}

const variantClass: Record<Variant, string> = {
  primary:
  'bg-vp-brand text-vp-ink-inv border-vp-brand hover:bg-vp-brand-strong active:bg-vp-brand-strong',
  secondary:
  'bg-vp-surface text-vp-ink border-vp-line-strong hover:bg-vp-surface-2 active:bg-vp-surface-2',
  ghost: 'bg-transparent text-vp-brand border-transparent hover:bg-vp-brand-soft',
  danger: 'bg-vp-surface text-vp-danger border-vp-danger-line hover:bg-vp-danger-soft'
};

const sizeClass: Record<Size, string> = {
  md: 'min-h-[44px] px-4 text-vp-body',
  lg: 'min-h-[52px] px-5 text-vp-label'
};

export function Button({
  variant = 'primary',
  size = 'md',
  icon,
  block,
  children,
  className = '',
  ...rest
}: ButtonProps) {
  return (
    <button
      type="button"
      className={`vp-focus vp-press inline-flex items-center justify-center gap-2 rounded-vp border font-semibold disabled:opacity-50 disabled:active:scale-100 ${
      variantClass[variant]} ${
      sizeClass[size]} ${block ? 'w-full' : ''} ${className}`}
      {...rest}>
      
      {icon}
      <span className="truncate">{children}</span>
    </button>);

}