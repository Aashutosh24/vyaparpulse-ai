import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, AlertTriangle, TrendingUp, Package, ShoppingCart, ChevronRight, Info } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { sakshamProducts, sakshamInventory, supplierPriceHistory, teaDailyHistory } from '../data/sakshamDemoData';
import { DemandEngine, analyseProduct } from '../engine/economicEngine';
import { formatRupees } from '../utils/format';

/**
 * Recommendation Screen
 * =====================
 * The SAKSHAM "wow moment". Shows a single clear purchase recommendation
 * with all the numbers visible and a WHY trail.
 *
 * Route: /recommendation/:productId
 */
export function Recommendation() {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const { topRecommendation } = useApp();

  // Compute for the specific product if not the top alert
  const analysis = React.useMemo(() => {
    const product = sakshamProducts.find((p) => p.id === productId);
    if (!product) return null;
    const demandHistory = productId === 'tea'
      ? DemandEngine.fromTeaHistory(teaDailyHistory)
      : [];
    const stockSnap = sakshamInventory.find((s) => s.productId === productId);
    if (!stockSnap || demandHistory.length === 0) return null;
    return analyseProduct(product, demandHistory, stockSnap.quantity, supplierPriceHistory);
  }, [productId]);

  const rec = analysis?.recommendation ?? topRecommendation;
  const demand = analysis?.demand;
  const stockout = analysis?.stockout;
  const margin = analysis?.margin;

  if (!rec || !demand || !stockout) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
        <Package size={48} className="text-vp-ink-3" />
        <p className="text-vp-ink-2 font-medium">No recommendation available for this product.</p>
        <button onClick={() => navigate(-1)} className="text-vp-brand text-sm font-semibold">Go back</button>
      </div>
    );
  }

  const riskColor =
    stockout.riskLevel === 'critical' ? 'var(--sk-alert)' :
    stockout.riskLevel === 'high' ? '#d97706' : 'var(--vp-brand)';

  return (
    <motion.div
      className="flex flex-col h-full overflow-y-auto bg-vp-bg"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Header */}
      <div className="sticky top-0 z-10 bg-vp-surface border-b border-vp-line px-4 pt-safe-top">
        <div className="flex items-center gap-3 h-14">
          <button
            onClick={() => navigate(-1)}
            className="p-1.5 -ml-1.5 rounded-lg text-vp-ink-2 hover:text-vp-ink active:scale-95 transition-transform"
            aria-label="Back"
          >
            <ArrowLeft size={22} />
          </button>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-vp-ink-3">SAKSHAM</p>
            <h1 className="text-base font-bold text-vp-ink leading-tight">Recommended Action</h1>
          </div>
        </div>
      </div>

      <div className="flex-1 px-4 py-5 space-y-4 pb-8">

        {/* URGENCY BANNER */}
        {stockout.isUrgent && (
          <motion.div
            className="flex items-center gap-3 px-4 py-3 rounded-2xl border"
            style={{
              background: 'var(--sk-alert-soft)',
              borderColor: 'var(--sk-alert-line)',
            }}
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            <AlertTriangle size={18} style={{ color: 'var(--sk-alert)', flexShrink: 0 }} />
            <p className="text-sm font-semibold" style={{ color: 'var(--sk-alert)' }}>
              {rec.productName} may run out {stockout.stockoutTimeEstimate.toLowerCase()}
            </p>
          </motion.div>
        )}

        {/* PRIMARY RECOMMENDATION CARD */}
        <motion.div
          className="rounded-3xl overflow-hidden shadow-lg"
          style={{ background: riskColor }}
          initial={{ scale: 0.97, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.15, type: 'spring', stiffness: 300, damping: 25 }}
        >
          <div className="px-6 pt-7 pb-6">
            <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-white/70 mb-1">
              Buy Now
            </p>
            <div className="flex items-end gap-3 mb-1">
              <span className="text-5xl font-black text-white leading-none">
                {rec.recommendedQuantity}
              </span>
              <span className="text-2xl font-bold text-white/80 mb-1">
                {rec.unit}
              </span>
            </div>
            <h2 className="text-2xl font-bold text-white mb-4">
              {rec.productName.toUpperCase()}
            </h2>

            {/* Cost */}
            <div className="bg-black/20 rounded-2xl px-4 py-3 flex items-center justify-between mb-4">
              <div>
                <p className="text-white/70 text-xs font-medium mb-0.5">Estimated cost</p>
                <p className="text-white text-2xl font-black">{formatRupees(rec.estimatedCost)}</p>
              </div>
              <div className="text-right">
                <p className="text-white/70 text-xs font-medium mb-0.5">Covers</p>
                <p className="text-white text-lg font-bold">{rec.daysOfStockProvided} days</p>
              </div>
            </div>

            <p className="text-white/80 text-sm leading-snug">
              {rec.supplierName} · ₹{rec.currentSupplierPrice}/{rec.unit}
            </p>
          </div>

          {/* Key stats strip */}
          <div className="bg-black/15 grid grid-cols-3 divide-x divide-white/10">
            <div className="px-3 py-3 text-center">
              <p className="text-white/60 text-[10px] font-medium uppercase tracking-wide mb-0.5">Stock left</p>
              <p className="text-white font-bold text-sm">{stockout.currentStock} {rec.unit}</p>
            </div>
            <div className="px-3 py-3 text-center">
              <p className="text-white/60 text-[10px] font-medium uppercase tracking-wide mb-0.5">Daily demand</p>
              <p className="text-white font-bold text-sm">{demand.avgDailyDemand.toFixed(1)} {rec.unit}/day</p>
            </div>
            <div className="px-3 py-3 text-center">
              <p className="text-white/60 text-[10px] font-medium uppercase tracking-wide mb-0.5">Demand trend</p>
              <p className="text-white font-bold text-sm">
                {demand.demandTrendPercent > 0 ? '↑' : demand.demandTrendPercent < 0 ? '↓' : '→'}
                {Math.abs(demand.demandTrendPercent)}%
              </p>
            </div>
          </div>
        </motion.div>

        {/* WHY BUTTON */}
        <motion.button
          onClick={() => navigate(`/why/${productId ?? 'tea'}`)}
          className="w-full flex items-center justify-between px-5 py-4 rounded-2xl border font-semibold text-base active:scale-98 transition-transform"
          style={{
            background: 'var(--sk-memory-soft)',
            borderColor: 'var(--sk-memory-line)',
            color: 'var(--sk-memory)',
          }}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          whileTap={{ scale: 0.98 }}
        >
          <div className="flex items-center gap-3">
            <Info size={20} style={{ color: 'var(--sk-memory)' }} />
            <span>Why this recommendation?</span>
          </div>
          <ChevronRight size={18} style={{ color: 'var(--sk-memory)' }} />
        </motion.button>

        {/* DEMAND TREND */}
        <motion.div
          className="bg-vp-surface rounded-2xl border border-vp-line p-5"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={17} style={{ color: 'var(--sk-demand-up)' }} />
            <h3 className="font-bold text-sm text-vp-ink">14-Day Demand Trend</h3>
          </div>
          <div className="flex items-end gap-1 h-16">
            {demand.dailyHistory.slice(-14).map((d, i) => {
              const maxVal = Math.max(...demand.dailyHistory.slice(-14).map((x) => x.quantity), 0.1);
              const heightPct = (d.quantity / maxVal) * 100;
              const isRecent = i >= 7;
              return (
                <div key={d.date} className="flex-1 flex flex-col justify-end">
                  <div
                    className="rounded-t-sm transition-all"
                    style={{
                      height: `${heightPct}%`,
                      background: isRecent ? 'var(--sk-demand-up)' : 'var(--vp-brand-light)',
                      minHeight: 4,
                    }}
                  />
                </div>
              );
            })}
          </div>
          <div className="flex justify-between mt-2">
            <p className="text-[10px] text-vp-ink-3">14 days ago</p>
            <p className="text-[10px] text-vp-ink-3">Today</p>
          </div>
          <p className="mt-3 text-sm text-vp-ink-2">
            Demand is <span className="font-bold" style={{ color: 'var(--sk-demand-up)' }}>
              {demand.demandVelocity === 'rising' ? `up ${demand.demandTrendPercent}%` :
               demand.demandVelocity === 'falling' ? `down ${Math.abs(demand.demandTrendPercent)}%` : 'stable'}
            </span> compared to 2 weeks ago.
          </p>
        </motion.div>

        {/* MARGIN INFO (if changed) */}
        {margin && margin.marginChange !== null && (
          <motion.div
            className="rounded-2xl border p-4"
            style={{
              background: margin.marginChange < 0 ? 'var(--sk-demand-down-soft)' : 'var(--sk-demand-up-soft)',
              borderColor: margin.marginChange < 0 ? 'var(--sk-demand-down-line)' : 'var(--sk-demand-up-line)',
            }}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
          >
            <p className="text-xs font-bold uppercase tracking-wide mb-2"
              style={{ color: margin.marginChange < 0 ? 'var(--sk-demand-down)' : 'var(--sk-demand-up)' }}>
              Margin impact
            </p>
            <div className="flex items-center gap-3">
              <div>
                <p className="text-xs text-vp-ink-3">Was</p>
                <p className="font-bold text-vp-ink">{margin.previousMarginPercent?.toFixed(1)}%</p>
              </div>
              <div className="text-vp-ink-3 text-lg">→</div>
              <div>
                <p className="text-xs text-vp-ink-3">Now</p>
                <p className="font-bold text-vp-ink">{margin.currentMarginPercent.toFixed(1)}%</p>
              </div>
              <div className="ml-auto">
                <p className="text-xs text-vp-ink-3">Change</p>
                <p className="font-bold" style={{ color: margin.marginChange < 0 ? 'var(--sk-alert)' : 'var(--sk-demand-up)' }}>
                  {margin.marginChange > 0 ? '+' : ''}{margin.marginChange.toFixed(1)}pp
                </p>
              </div>
            </div>
            <p className="text-xs text-vp-ink-2 mt-2">
              {margin.supplierName} changed purchase price from ₹{margin.previousPurchasePrice} → ₹{margin.currentPurchasePrice}/{rec.unit}
            </p>
          </motion.div>
        )}

        {/* CALCULATION BASIS */}
        <motion.div
          className="bg-vp-surface rounded-2xl border border-vp-line p-4"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <p className="text-xs font-bold uppercase tracking-wide text-vp-ink-3 mb-3">How this was calculated</p>
          {rec.basis.split(' | ').map((step, i) => (
            <div key={i} className="flex items-start gap-2 mb-2 last:mb-0">
              <span className="text-xs text-vp-ink-3 font-mono mt-0.5 w-4 shrink-0">{i + 1}.</span>
              <p className="text-xs text-vp-ink-2">{step}</p>
            </div>
          ))}
        </motion.div>

      </div>
    </motion.div>
  );
}
