import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, CheckCircle2, ShoppingCart, BarChart2, Package, FileText } from 'lucide-react';
import { sakshamProducts, sakshamInventory, supplierPriceHistory, teaDailyHistory, sakshamSupplierInvoices } from '../data/sakshamDemoData';
import { DemandEngine, InventoryEngine, StockoutPredictor, ReorderEngine, MarginEngine } from '../engine/economicEngine';

/**
 * WhyEvidence Screen
 * ==================
 * The evidence trail behind any SAKSHAM recommendation.
 * Shows EVERY number with its source, so the merchant understands
 * why the recommendation was made — not just what it is.
 *
 * Route: /why/:productId
 */
export function WhyEvidence() {
  const { productId = 'tea' } = useParams<{ productId: string }>();
  const navigate = useNavigate();

  const evidence = React.useMemo(() => {
    const product = sakshamProducts.find((p) => p.id === productId);
    if (!product) return null;

    const demandHistory = productId === 'tea'
      ? DemandEngine.fromTeaHistory(teaDailyHistory)
      : [];
    const demand = DemandEngine.calculate(demandHistory, product);
    const stockSnap = sakshamInventory.find((s) => s.productId === productId);
    if (!stockSnap) return null;

    const inventory = InventoryEngine.calculate(stockSnap.quantity, product, demand);
    const stockout = StockoutPredictor.predict(inventory, demand, product);
    const recommendation = ReorderEngine.calculate(stockout, demand, product, stockSnap.quantity);
    const margin = MarginEngine.calculate(product, supplierPriceHistory);

    // Relevant invoices
    const invoices = sakshamSupplierInvoices.filter((inv) =>
      inv.lines.some((l) => l.productId === productId)
    );

    return { product, demand, inventory, stockout, recommendation, margin, invoices };
  }, [productId]);

  if (!evidence) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
        <Package size={48} className="text-vp-ink-3" />
        <p className="text-vp-ink-2 font-medium">No evidence available for this product.</p>
        <button onClick={() => navigate(-1)} className="text-vp-brand text-sm font-semibold">Go back</button>
      </div>
    );
  }

  const { product, demand, inventory, stockout, recommendation, margin, invoices } = evidence;

  const EvidenceRow = ({
    icon: Icon,
    label,
    value,
    subValue,
    verified = true,
    accent,
  }: {
    icon: React.ElementType;
    label: string;
    value: string;
    subValue?: string;
    verified?: boolean;
    accent?: string;
  }) => (
    <div className="flex items-start gap-3 py-3 border-b border-vp-line last:border-0">
      <div className="p-2 rounded-xl mt-0.5" style={{ background: accent ? `${accent}15` : 'var(--vp-surface-2)' }}>
        <Icon size={15} style={{ color: accent ?? 'var(--vp-ink-3)' }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-vp-ink-3 font-medium">{label}</p>
        <p className="font-bold text-vp-ink text-sm mt-0.5">{value}</p>
        {subValue && <p className="text-xs text-vp-ink-3 mt-0.5">{subValue}</p>}
      </div>
      {verified && (
        <CheckCircle2 size={15} className="mt-1 shrink-0" style={{ color: 'var(--sk-demand-up)' }} />
      )}
    </div>
  );

  return (
    <motion.div
      className="flex flex-col h-full overflow-y-auto bg-vp-bg"
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.28 }}
    >
      {/* Header */}
      <div className="sticky top-0 z-10 bg-vp-surface border-b border-vp-line px-4 pt-safe-top">
        <div className="flex items-center gap-3 h-14">
          <button onClick={() => navigate(-1)} className="p-1.5 -ml-1.5 rounded-lg text-vp-ink-2 active:scale-95">
            <ArrowLeft size={22} />
          </button>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-vp-ink-3">Evidence</p>
            <h1 className="text-base font-bold text-vp-ink leading-tight">
              Why {product.name}?
            </h1>
          </div>
        </div>
      </div>

      {/* Summary banner */}
      <div className="px-4 pt-5 pb-1">
        <motion.div
          className="rounded-2xl p-4 border"
          style={{ background: 'var(--sk-memory-soft)', borderColor: 'var(--sk-memory-line)' }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
        >
          <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--sk-memory)' }}>
            Recommendation Summary
          </p>
          <p className="text-vp-ink text-sm leading-relaxed">
            Buy <strong>{recommendation.recommendedQuantity} {product.unit}</strong> of <strong>{product.name}</strong>{' '}
            for <strong>₹{recommendation.estimatedCost.toLocaleString('en-IN')}</strong> from {product.supplierName}.
            Stock runs out <strong>{stockout.stockoutTimeEstimate.toLowerCase()}</strong>.
          </p>
        </motion.div>
      </div>

      <div className="px-4 py-4 space-y-4 pb-10">

        {/* DEMAND EVIDENCE */}
        <motion.div
          className="bg-vp-surface rounded-2xl border border-vp-line overflow-hidden"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
        >
          <div className="flex items-center gap-2.5 px-4 pt-4 pb-2">
            <BarChart2 size={16} style={{ color: 'var(--sk-demand-up)' }} />
            <h2 className="font-bold text-sm text-vp-ink">Demand Evidence</h2>
            <span className="ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full"
              style={{ background: 'var(--sk-demand-up-soft)', color: 'var(--sk-demand-up)' }}>
              {demand.period} days data
            </span>
          </div>
          <div className="px-4 pb-2">
            <EvidenceRow icon={BarChart2} label="14-day average demand" value={`${demand.avgDailyDemand.toFixed(1)} ${product.unit}/day`} subValue={`Total: ${demand.totalSold.toFixed(1)} ${product.unit} in ${demand.period} days`} accent="var(--sk-demand-up)" />
            <EvidenceRow icon={BarChart2} label="Week 1 average (days 1–7)" value={`${demand.week1AvgDemand.toFixed(1)} ${product.unit}/day`} accent="var(--sk-demand-up)" />
            <EvidenceRow icon={BarChart2} label="Week 2 average (days 8–14)" value={`${demand.week2AvgDemand.toFixed(1)} ${product.unit}/day`} subValue={`Demand trend: +${demand.demandTrendPercent}%`} accent="var(--sk-demand-up)" />
            <EvidenceRow icon={BarChart2} label="Next-day demand forecast" value={`${demand.forecastNextDayDemand.toFixed(1)} ${product.unit}`} subValue="Based on trend-adjusted recent average" accent="var(--sk-demand-up)" />
          </div>
        </motion.div>

        {/* INVENTORY EVIDENCE */}
        <motion.div
          className="bg-vp-surface rounded-2xl border border-vp-line overflow-hidden"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.16 }}
        >
          <div className="flex items-center gap-2.5 px-4 pt-4 pb-2">
            <Package size={16} style={{ color: 'var(--sk-alert)' }} />
            <h2 className="font-bold text-sm text-vp-ink">Inventory Evidence</h2>
          </div>
          <div className="px-4 pb-2">
            <EvidenceRow icon={Package} label="Current stock" value={`${inventory.currentStock} ${product.unit}`} subValue="Recorded today at 8:00 AM" accent="var(--sk-alert)" />
            <EvidenceRow icon={Package} label="Safety stock threshold" value={`${product.safetyStockDays} days (${inventory.safetyStockQuantity.toFixed(1)} ${product.unit})`} subValue="Minimum buffer before reorder is triggered" accent="var(--sk-alert)" />
            <EvidenceRow icon={Package} label="Days remaining" value={`${inventory.daysRemaining.toFixed(1)} days`} subValue={`${inventory.currentStock} ${product.unit} ÷ ${inventory.dailyUsageRate.toFixed(1)} ${product.unit}/day`} accent="var(--sk-alert)" />
            <EvidenceRow icon={Package} label="Below safety stock?" value={inventory.isBelowSafetyStock ? `Yes — reorder needed` : 'No'} subValue={`${inventory.daysRemaining.toFixed(1)} days < ${product.safetyStockDays} days threshold`} accent="var(--sk-alert)" />
          </div>
        </motion.div>

        {/* STOCKOUT PREDICTION */}
        <motion.div
          className="bg-vp-surface rounded-2xl border overflow-hidden"
          style={{ borderColor: 'var(--sk-alert-line)' }}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="px-4 pt-4 pb-2" style={{ background: 'var(--sk-alert-soft)' }}>
            <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--sk-alert)' }}>
              Predicted Stockout
            </p>
            <p className="text-2xl font-black mt-1" style={{ color: 'var(--sk-alert)' }}>
              {stockout.stockoutTimeEstimate}
            </p>
          </div>
          <div className="px-4 pb-2 pt-1">
            <EvidenceRow icon={Package} label="Stockout calculation" value={`${stockout.currentStock} ÷ ${stockout.dailyDemand.toFixed(2)} = ${stockout.daysUntilStockout.toFixed(2)} days`} subValue="stock ÷ daily_demand = days_remaining" />
          </div>
        </motion.div>

        {/* REORDER CALCULATION */}
        <motion.div
          className="bg-vp-surface rounded-2xl border border-vp-line overflow-hidden"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.24 }}
        >
          <div className="flex items-center gap-2.5 px-4 pt-4 pb-2">
            <ShoppingCart size={16} style={{ color: 'var(--sk-memory)' }} />
            <h2 className="font-bold text-sm text-vp-ink">Reorder Calculation</h2>
          </div>
          <div className="px-4 pb-2">
            {recommendation.basis.split(' | ').map((step, i) => (
              <div key={i} className="flex items-start gap-3 py-2.5 border-b border-vp-line last:border-0">
                <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black mt-0.5 shrink-0"
                  style={{ background: 'var(--sk-memory-soft)', color: 'var(--sk-memory)' }}>
                  {i + 1}
                </div>
                <p className="text-xs text-vp-ink-2 leading-relaxed">{step}</p>
              </div>
            ))}
            <div className="mt-3 pt-3 border-t border-vp-line flex items-center justify-between">
              <p className="text-sm font-bold text-vp-ink">Total cost</p>
              <p className="text-lg font-black" style={{ color: 'var(--sk-memory)' }}>
                ₹{recommendation.estimatedCost.toLocaleString('en-IN')}
              </p>
            </div>
          </div>
        </motion.div>

        {/* SUPPLIER INVOICE EVIDENCE */}
        {invoices.length > 0 && (
          <motion.div
            className="bg-vp-surface rounded-2xl border border-vp-line overflow-hidden"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.28 }}
          >
            <div className="flex items-center gap-2.5 px-4 pt-4 pb-2">
              <FileText size={16} style={{ color: 'var(--sk-scan)' }} />
              <h2 className="font-bold text-sm text-vp-ink">Supplier Invoice Evidence</h2>
            </div>
            <div className="px-4 pb-3 space-y-3">
              {invoices.map((inv) => {
                const line = inv.lines.find((l) => l.productId === productId);
                return (
                  <div key={inv.id} className="rounded-xl border border-vp-line p-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-bold text-xs text-vp-ink">{inv.supplierName}</p>
                      <p className="text-[10px] text-vp-ink-3">{inv.invoiceDate}</p>
                    </div>
                    <p className="text-xs text-vp-ink-2">{inv.invoiceNumber}</p>
                    {line && (
                      <div className="mt-2 pt-2 border-t border-vp-line flex items-center justify-between">
                        <p className="text-xs text-vp-ink-2">{line.productName} ({line.unit})</p>
                        <p className="font-bold text-sm text-vp-ink">₹{line.unitPrice}/{line.unit}</p>
                      </div>
                    )}
                    <div className="mt-2 flex items-center gap-1.5">
                      <CheckCircle2 size={12} style={{ color: 'var(--sk-demand-up)' }} />
                      <p className="text-[10px] text-vp-ink-3 font-medium">
                        {inv.source === 'scanned' ? 'Scanned invoice' : inv.source === 'demo' ? 'Demo invoice' : 'Manually entered'}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* MARGIN EVIDENCE */}
        {margin.previousPurchasePrice !== null && (
          <motion.div
            className="rounded-2xl border p-4"
            style={{ background: 'var(--sk-demand-down-soft)', borderColor: 'var(--sk-demand-down-line)' }}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.32 }}
          >
            <p className="text-[10px] font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--sk-demand-down)' }}>
              Margin Impact from Price Change
            </p>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-white/60 rounded-xl p-2">
                <p className="text-[10px] text-vp-ink-3">Old buy price</p>
                <p className="font-bold text-sm text-vp-ink">₹{margin.previousPurchasePrice}/{product.unit}</p>
              </div>
              <div className="bg-white/60 rounded-xl p-2">
                <p className="text-[10px] text-vp-ink-3">New buy price</p>
                <p className="font-bold text-sm text-vp-ink">₹{margin.currentPurchasePrice}/{product.unit}</p>
              </div>
              <div className="bg-white/60 rounded-xl p-2">
                <p className="text-[10px] text-vp-ink-3">Margin change</p>
                <p className="font-bold text-sm" style={{ color: 'var(--sk-alert)' }}>
                  {margin.marginChange?.toFixed(1)}pp
                </p>
              </div>
            </div>
          </motion.div>
        )}

      </div>
    </motion.div>
  );
}
