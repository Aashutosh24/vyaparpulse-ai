import React from 'react';
import { AlertTriangle, Check, Lock, ShieldCheck } from 'lucide-react';
import { AppBar } from '../components/shell/AppBar';
import { Surface } from '../components/ui/Surface';
import { Button } from '../components/ui/Button';
import { SectionHeader } from '../components/ui/SectionHeader';
import { BottomSheet } from '../components/ui/BottomSheet';
import { ExplainBlock } from '../components/ui/ExplainBlock';
import { LearningState, Skeleton } from '../components/ui/States';
import { PrototypeNote } from '../components/ui/PrototypeNote';
import { store } from '../data/mockData';
import { formatRupees } from '../utils/format';
import { useApp } from '../contexts/AppContext';

/**
 * The financial identity the merchant is building — deliberately not framed
 * as a credit score, and never implying a guaranteed loan.
 */
export function FinancialProfile() {
  const { health, week, profile, hasEnoughHistory, dataState } = useApp();
  const [consentOpen, setConsentOpen] = React.useState(false);
  const [connected, setConnected] = React.useState(false);

  if (dataState === 'loading') {
    return (
      <div className="pb-8" aria-busy="true">
        <AppBar title="Financial profile" />
        <div className="space-y-5 px-4 pt-4">
          <Skeleton className="h-[268px] rounded-vp" />
          <Skeleton className="h-[148px] rounded-vp" />
          <Skeleton className="h-[196px] rounded-vp" />
        </div>
      </div>);

  }

  if (!hasEnoughHistory) {
    return (
      <div className="pb-8">
        <AppBar title="Financial profile" />
        <div className="px-4 pt-4">
          <LearningState />
        </div>
      </div>);

  }

  return (
    <div className="pb-8">
      <AppBar
        title="Financial profile"
        subtitle={`${store.name} · ${store.activeSince} of activity`} />
      

      <div className="space-y-6 px-4 pt-4">
        <Surface>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-vp-caption font-bold uppercase text-vp-ink-3">Business strength</p>
              <p className="mt-1 text-vp-hero font-extrabold text-vp-ink">{health.band}</p>
              <p className="text-vp-body text-vp-ink-2">
                Business Health {health.score}/100 · {store.activeSince} of recorded activity
              </p>
            </div>
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-vp-brand-soft text-vp-brand">
              <ShieldCheck size={22} strokeWidth={2.4} aria-hidden="true" />
            </span>
          </div>

          <dl className="mt-4 divide-y divide-vp-line border-t border-vp-line">
            {profile.factors.map((f) =>
            <div key={f.label} className="flex items-baseline justify-between gap-3 py-2.5">
                <dt className="min-w-0 text-vp-body text-vp-ink-2">{f.label}</dt>
                <dd
                className={`vp-num shrink-0 whitespace-nowrap text-vp-body font-bold ${
                f.tone === 'watch' ? 'text-vp-pending' : 'text-vp-ink'}`
                }>
                
                  {f.value}
                </dd>
              </div>
            )}
          </dl>

          <p className="mt-3 text-vp-small text-vp-ink-3">
            Built only from the business activity recorded in this app. It is not a credit score,
            and in this prototype it is not sent anywhere.
          </p>
        </Surface>

        <section aria-label="Working capital readiness">
          <SectionHeader title="Working capital readiness" />
          <Surface tone="brand">
            <p className="text-vp-caption font-bold uppercase text-vp-brand">Estimated range</p>
            <p className="vp-num mt-1 whitespace-nowrap text-vp-num font-extrabold text-vp-ink">
              {formatRupees(profile.workingCapitalLow)} –{' '}
              {formatRupees(profile.workingCapitalHigh)}
            </p>
            <p className="mt-1 text-vp-body font-semibold text-vp-ink-2">
              Indicative estimate, based on {formatRupees(week.revenue)} of business this week
            </p>
            <p className="mt-2 rounded-vp-sm bg-vp-surface px-3 py-2 text-vp-body font-semibold text-vp-ink">
              Not a loan approval or guarantee. It only reflects what your recorded activity
              supports today.
            </p>
          </Surface>
        </section>

        <section aria-label="Why this profile">
          <SectionHeader title="Why this profile?" />
          <ul className="space-y-2">
            {profile.reasons.map((r) =>
            <li
              key={r.text}
              className={`flex items-start gap-2.5 rounded-vp border p-3 ${
              r.positive ?
              'border-vp-paid-line bg-vp-paid-soft' :
              'border-vp-pending-line bg-vp-pending-soft'}`
              }>
              
                <span className={r.positive ? 'text-vp-paid' : 'text-vp-pending'}>
                  {r.positive ?
                <Check size={18} strokeWidth={3} aria-hidden="true" /> :

                <AlertTriangle size={18} strokeWidth={2.5} aria-hidden="true" />
                }
                </span>
                <p
                className={`text-vp-body font-semibold ${
                r.positive ? 'text-vp-paid' : 'text-vp-pending'}`
                }>
                
                  {r.text}
                </p>
              </li>
            )}
          </ul>
          <div className="mt-3 rounded-vp border border-vp-line bg-vp-surface p-4 shadow-vp">
            <ExplainBlock why={profile.why} action={profile.action} />
          </div>
        </section>

        <section aria-label="Your data">
          <SectionHeader title="Your data" />
          <Surface>
            <ul className="space-y-2.5">
              <li className="flex items-start gap-2.5 text-vp-body text-vp-ink-2">
                <Lock
                  size={18}
                  strokeWidth={2.4}
                  className="mt-0.5 shrink-0 text-vp-brand"
                  aria-hidden="true" />
                
                Everything you record stays in this app. Nothing is sent to a server, because this
                prototype does not have one.
              </li>
              <li className="flex items-start gap-2.5 text-vp-body text-vp-ink-2">
                <ShieldCheck
                  size={18}
                  strokeWidth={2.4}
                  className="mt-0.5 shrink-0 text-vp-brand"
                  aria-hidden="true" />
                
                Your sales and payments are used to build your insights and this profile — nothing
                else.
              </li>
            </ul>

            <div className="mt-3">
              <PrototypeNote>
                data lives in this browser session only, so reloading returns to the seeded demo
                state. Storage and sharing controls are shown as intent, not as working features.
              </PrototypeNote>
            </div>

            <div className="mt-4 border-t border-vp-line pt-4">
              <p className="text-vp-label font-bold text-vp-ink">
                Additional financial information
              </p>
              <p className="mt-1 text-vp-body text-vp-ink-2">
                In the finished product you could add bank or UPI statements to strengthen this
                profile. It would always be explained in plain language first, and withdrawable at
                any time.
              </p>
              {connected ?
              <div className="mt-3 rounded-vp bg-vp-paid-soft px-3 py-2.5">
                  <p className="text-vp-body font-bold text-vp-paid">
                    ✓ Consent recorded — you can withdraw it any time
                  </p>
                  <button
                  type="button"
                  onClick={() => setConnected(false)}
                  className="vp-focus mt-1 min-h-[40px] text-vp-small font-bold text-vp-brand underline">
                  
                    Withdraw consent
                  </button>
                </div> :

              <Button
                className="mt-3"
                variant="secondary"
                block
                onClick={() => setConsentOpen(true)}>
                
                  Connect with consent
                </Button>
              }
            </div>
          </Surface>
        </section>
      </div>

      <BottomSheet
        open={consentOpen}
        onClose={() => setConsentOpen(false)}
        title="Before you share anything"
        subtitle="Plain language, no fine print">
        
        <ul className="space-y-2.5">
          {[
          'Your bank or UPI statements would be read only to confirm the sales and payments you already record here.',
          'Your data would never go to a lender unless you separately asked for it.',
          'You could withdraw this consent from this screen at any time, and it would stop immediately.'].
          map((t) =>
          <li
            key={t}
            className="flex items-start gap-2.5 rounded-vp border border-vp-line bg-vp-surface p-3">
            
              <Check
              size={18}
              strokeWidth={3}
              className="mt-0.5 shrink-0 text-vp-brand"
              aria-hidden="true" />
            
              <p className="text-vp-body text-vp-ink-2">{t}</p>
            </li>
          )}
        </ul>
        <div className="mt-3">
          <PrototypeNote>
            no bank or UPI connection exists in this build. Consenting here only records the choice
            in this session so the flow can be shown.
          </PrototypeNote>
        </div>
        <div className="mt-4 grid gap-2.5">
          <Button
            size="lg"
            block
            onClick={() => {
              setConnected(true);
              setConsentOpen(false);
            }}>
            
            I understand — give consent
          </Button>
          <Button variant="secondary" block onClick={() => setConsentOpen(false)}>
            Not now
          </Button>
        </div>
      </BottomSheet>
    </div>);

}