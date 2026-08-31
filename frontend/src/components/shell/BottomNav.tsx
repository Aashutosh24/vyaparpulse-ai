import React from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { BarChart3, Home, Mic, Receipt, Users } from 'lucide-react';

const items = [
{ to: '/', label: 'Home', Icon: Home },
{ to: '/ledger', label: 'Ledger', Icon: Receipt },
{ to: '/insights', label: 'Insights', Icon: BarChart3 },
{ to: '/customers', label: 'Customers', Icon: Users }];


/**
 * Four destinations plus one raised primary action. Record Sale is always
 * one thumb-reach away — it is the only prominent CTA in the shell.
 */
export function BottomNav() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const selling = pathname === '/sell';

  return (
    <nav
      aria-label="Main"
      className="relative shrink-0 border-t border-vp-line bg-vp-surface pb-1.5 pt-1.5">
      
      <ul className="grid grid-cols-5 items-end">
        {items.slice(0, 2).map((item) =>
        <NavItem key={item.to} {...item} />
        )}
        <li className="flex justify-center">
          <button
            type="button"
            onClick={() => navigate('/sell')}
            aria-current={selling ? 'page' : undefined}
            className={`vp-focus vp-press -mt-7 flex h-16 w-16 flex-col items-center justify-center gap-0.5 rounded-full border-4 border-vp-surface shadow-vp-raised ${
            selling ? 'bg-vp-brand-strong' : 'bg-vp-brand'} text-vp-ink-inv`
            }>
            
            <Mic size={22} strokeWidth={2.4} aria-hidden="true" />
            <span className="text-[10px] font-bold uppercase tracking-wide">Sell</span>
          </button>
        </li>
        {items.slice(2).map((item) =>
        <NavItem key={item.to} {...item} />
        )}
      </ul>
    </nav>);

}

function NavItem({
  to,
  label,
  Icon




}: {to: string;label: string;Icon: typeof Home;}) {
  return (
    <li>
      <NavLink
        to={to}
        end={to === '/'}
        className={({ isActive }) =>
        `vp-focus relative flex min-h-[52px] flex-col items-center justify-center gap-1 px-1 pt-1 ${
        isActive ? 'text-vp-brand' : 'text-vp-ink-3'}`

        }>
        
        {({ isActive }) =>
        <>
            <span
            aria-hidden="true"
            className={`absolute top-0 h-[3px] w-8 rounded-full ${
            isActive ? 'bg-vp-brand' : 'bg-transparent'}`
            } />
          
            <Icon size={22} strokeWidth={isActive ? 2.5 : 2} aria-hidden="true" />
            <span className={`text-[11px] ${isActive ? 'font-bold' : 'font-semibold'}`}>
              {label}
            </span>
          </>
        }
      </NavLink>
    </li>);

}