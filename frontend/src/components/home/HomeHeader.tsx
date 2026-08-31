import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Store } from 'lucide-react';
import { store } from '../../data/mockData';

export function HomeHeader() {
  const navigate = useNavigate();
  return (
    <header className="flex items-center gap-3 px-4 pb-3 pt-4">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-vp bg-vp-brand-soft text-vp-brand">
        <Store size={20} strokeWidth={2.3} aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-vp-small font-semibold text-vp-ink-2">
          {store.greeting}, {store.ownerFirstName}
        </p>
        <h1 className="truncate text-vp-h1 font-bold text-vp-ink">{store.name}</h1>
      </div>
      <button
        type="button"
        onClick={() => navigate('/profile')}
        className="vp-focus flex min-h-[44px] items-center gap-1.5 rounded-full border border-vp-line bg-vp-surface px-3 text-vp-small font-bold text-vp-brand">
        
        <ShieldCheck size={16} strokeWidth={2.4} aria-hidden="true" />
        Profile
      </button>
    </header>);

}