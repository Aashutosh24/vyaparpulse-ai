import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

interface AppBarProps {
  title: string;
  subtitle?: string;
  back?: boolean;
  action?: React.ReactNode;
}

export function AppBar({ title, subtitle, back = true, action }: AppBarProps) {
  const navigate = useNavigate();
  return (
    <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-vp-line bg-vp-bg px-2 py-2.5">
      {back ?
      <button
        type="button"
        onClick={() => navigate(-1)}
        aria-label="Go back"
        className="vp-focus flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-vp-ink hover:bg-vp-surface-2">
        
          <ChevronLeft size={22} strokeWidth={2.4} aria-hidden="true" />
        </button> :

      <span className="w-2" />
      }
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-vp-h1 font-bold text-vp-ink">{title}</h1>
        {subtitle ? <p className="truncate text-vp-small text-vp-ink-2">{subtitle}</p> : null}
      </div>
      {action ? <div className="shrink-0 pr-1">{action}</div> : null}
    </header>);

}