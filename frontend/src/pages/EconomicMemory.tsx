import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, TrendingUp, TrendingDown, Package, DollarSign, Activity, ChevronRight } from 'lucide-react';
import { useApp } from '../contexts/AppContext';

/**
 * Economic Memory Screen
 * =====================
 * Shows what changed in this business — the SAKSHAM "change log".
 *
 * Answers: "Raju, here's what happened in the last 14 days."
 * Every entry is backed by evidence from the Economic Engine.
 *
 * Route: /memory
 */
export function EconomicMemory() {
  const navigate = useNavigate();
  const { economicMemory, topRecommendation } = useApp();

  const typeConfig: Record<string, {
    label: string;
    Icon: React.ElementType;
    bg: string;
    border: string;
    text: string;
    iconColor: string;
  }> = {
    demand_change: {
      label: 'Demand',
      Icon: Activity,
      bg: 'var(--sk-demand-up-soft)',
      border: 'var(--sk-demand-up-line)',
      text: 'var(--sk-demand-up)',
      iconColor: 'var(--sk-demand-up)',
    },
    supplier_price_change: {
      label: 'Supplier price',
      Icon: TrendingUp,
      bg: 'var(--sk-demand-down-soft)',
      border: 'var(--sk-demand-down-line)',
      text: 'var(--sk-demand-down)',
      iconColor: 'var(--sk-demand-down)',
    },
    margin_change: {
      label: 'Margin',
      Icon: DollarSign,
      bg: 'var(--sk-demand-down-soft)',
      border: 'var(--sk-demand-down-line)',
      text: 'var(--sk-demand-down)',
      iconColor: 'var(--sk-alert)',
    },
    revenue_change: {
      label: 'Revenue',
      Icon: TrendingUp,
      bg: 'var(--sk-demand-up-soft)',
      border: 'var(--sk-demand-up-line)',
      text: 'var(--sk-demand-up)',
      iconColor: 'var(--sk-demand-up)',
    },
    payment_change: {
      label: 'Payments',
      Icon: Activity,
      bg: 'var(--sk-memory-soft)',
      border: 'var(--sk-memory-line)',
      text: 'var(--sk-memory)',
      iconColor: 'var(--sk-memory)',
    },
    stockout_risk: {
      label: 'Stockout risk',
      Icon: Package,
      bg: 'var(--sk-alert-soft)',
      border: 'var(--sk-alert-line)',
      text: 'var(--sk-alert)',
      iconColor: 'var(--sk-alert)',
    },
  };

  return (
    <motion.div
      className="flex flex-col h-full overflow-y-auto bg-vp-bg"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28 }}
    >
      {/* Header */}
      <div className="sticky top-0 z-10 bg-vp-surface border-b border-vp-line px-4 pt-safe-top">
        <div className="flex items-center gap-3 h-14">
          <button onClick={() => navigate(-1)} className="p-1.5 -ml-1.5 rounded-lg text-vp-ink-2 active:scale-95">
            <ArrowLeft size={22} />
          </button>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-vp-ink-3">SAKSHAM</p>
            <h1 className="text-base font-bold text-vp-ink leading-tight">What Changed</h1>
          </div>
        </div>
      </div>

      <div className="px-4 py-5 pb-10 space-y-3">

        {/* INTRO */}
        <motion.div
          className="rounded-2xl border p-4"
          style={{ background: 'var(--sk-memory-soft)', borderColor: 'var(--sk-memory-line)' }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--sk-memory)' }}>
            Economic Memory · Last 14 days
          </p>
          <p className="text-sm text-vp-ink-2">
            SAKSHAM tracked {economicMemory.length} change{economicMemory.length !== 1 ? 's' : ''} in your business.
            Every entry is backed by data from your sales and supplier invoices.
          </p>
        </motion.div>

        {/* MEMORY ENTRIES */}
        {economicMemory.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
            <Activity size={40} className="text-vp-ink-3" />
            <p className="text-vp-ink-2 font-medium">No significant changes detected</p>
            <p className="text-vp-ink-3 text-sm">Your business metrics are stable.</p>
          </div>
        ) : (
          economicMemory.map((entry, i) => {
            const cfg = typeConfig[entry.type] ?? typeConfig.revenue_change;
            const { Icon } = cfg;
            const isPositive = (entry.changePercent ?? 0) > 0;
            const showArrow = entry.type === 'demand_change' || entry.type === 'revenue_change';

            return (
              <motion.div
                key={entry.id}
                className="bg-vp-surface rounded-2xl border border-vp-line overflow-hidden"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08 + i * 0.05 }}
              >
                {/* Entry header */}
                <div className="flex items-start gap-3 px-4 pt-4 pb-3">
                  <div
                    className="p-2.5 rounded-xl shrink-0"
                    style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}
                  >
                    <Icon size={16} style={{ color: cfg.iconColor }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                        style={{ background: cfg.bg, color: cfg.text }}>
                        {cfg.label}
                      </span>
                      {entry.significance === 'high' && (
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                          style={{ background: 'var(--sk-alert-soft)', color: 'var(--sk-alert)' }}>
                          High impact
                        </span>
                      )}
                    </div>
                    <p className="font-bold text-vp-ink text-sm leading-snug">{entry.headline}</p>
                  </div>
                </div>

                {/* Before/After */}
                <div className="mx-4 mb-3 rounded-xl overflow-hidden border border-vp-line">
                  <div className="grid grid-cols-2 divide-x divide-vp-line">
                    <div className="px-3 py-2.5 bg-vp-surface-2">
                      <p className="text-[10px] text-vp-ink-3 font-medium uppercase tracking-wide mb-0.5">Was</p>
                      <p className="font-bold text-sm text-vp-ink">{entry.beforeValue}</p>
                    </div>
                    <div className="px-3 py-2.5" style={{ background: cfg.bg }}>
                      <p className="text-[10px] font-medium uppercase tracking-wide mb-0.5" style={{ color: cfg.text }}>
                        Now
                      </p>
                      <p className="font-bold text-sm text-vp-ink">
                        {showArrow && (
                          <span className="mr-1" style={{ color: cfg.iconColor }}>
                            {isPositive ? '↑' : '↓'}
                          </span>
                        )}
                        {entry.afterValue}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Evidence sources */}
                {entry.evidence.length > 0 && (
                  <div className="px-4 pb-3">
                    <p className="text-[10px] text-vp-ink-3 font-medium uppercase tracking-wide mb-1.5">
                      Evidence
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {entry.evidence.map((e, idx) => (
                        <span key={idx} className="text-[10px] px-2 py-0.5 rounded-full bg-vp-surface-2 text-vp-ink-2 font-medium border border-vp-line">
                          ✓ {e}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            );
          })
        )}

        {/* CTA — if there's a recommendation */}
        {topRecommendation && (
          <motion.button
            onClick={() => navigate(`/recommendation/${topRecommendation.productId}`)}
            className="w-full flex items-center justify-between px-5 py-4 rounded-2xl border font-semibold text-base"
            style={{
              background: 'var(--sk-alert-soft)',
              borderColor: 'var(--sk-alert-line)',
              color: 'var(--sk-alert)',
            }}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            whileTap={{ scale: 0.98 }}
          >
            <span>See buy recommendation →</span>
            <ChevronRight size={18} />
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}
