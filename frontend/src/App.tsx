import React from 'react';
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { AppProvider } from './contexts/AppContext';
import { BottomNav } from './components/shell/BottomNav';
import { ActivityBanner } from './components/shell/ActivityBanner';
import { SyncStatus } from './components/shell/SyncStatus';
import { PageTransition } from './components/shell/PageTransition';
import { DemoSheet } from './components/demo/DemoSheet';
import { Home } from './pages/Home';
import { RecordSale } from './pages/RecordSale';
import { Ledger } from './pages/Ledger';
import { PaymentActivity } from './pages/PaymentActivity';
import { PaymentReview } from './pages/PaymentReview';
import { Customers } from './pages/Customers';
import { CustomerDetail } from './pages/CustomerDetail';
import { Insights } from './pages/Insights';
import { Forecast } from './pages/Forecast';
import { FinancialProfile } from './pages/FinancialProfile';

type DataState = 'ready' | 'loading' | 'empty' | 'error';

interface AppProps {
  /** Which data condition the whole app renders in. */
  dataState?: DataState;
  /** Offline-first: sales keep saving on the device. */
  offline?: boolean;
}

export function App({ dataState = 'ready', offline = false }: AppProps) {
  return (
    <BrowserRouter>
      <AppProvider dataState={dataState} offline={offline}>
        <Shell />
      </AppProvider>
    </BrowserRouter>);

}

function Shell() {
  const location = useLocation();
  const [demoOpen, setDemoOpen] = React.useState(false);
  const scrollRef = React.useRef<HTMLElement | null>(null);

  // Each screen should start at the top, like a native app.
  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen w-full justify-center bg-vp-surface-2">
      <div className="flex h-[100dvh] w-full max-w-[430px] flex-col overflow-hidden bg-vp-bg font-sans text-vp-ink">
        <SyncStatus onOpenDemo={() => setDemoOpen(true)} />
        <main ref={scrollRef} className="vp-scroll relative flex-1 overflow-y-auto">
          <ActivityBanner />
          <AnimatePresence mode="wait" initial={false}>
            <PageTransition key={location.pathname}>
              <Routes location={location}>
                <Route path="/" element={<Home />} />
                <Route path="/sell" element={<RecordSale />} />
                <Route path="/ledger" element={<Ledger />} />
                <Route path="/payments" element={<PaymentActivity />} />
                <Route path="/payments/:id" element={<PaymentReview />} />
                <Route path="/customers" element={<Customers />} />
                <Route path="/customers/:id" element={<CustomerDetail />} />
                <Route path="/insights" element={<Insights />} />
                <Route path="/forecast" element={<Forecast />} />
                <Route path="/profile" element={<FinancialProfile />} />
                <Route path="*" element={<Home />} />
              </Routes>
            </PageTransition>
          </AnimatePresence>
          <DemoSheet open={demoOpen} onClose={() => setDemoOpen(false)} />
        </main>
        <BottomNav />
      </div>
    </div>);

}