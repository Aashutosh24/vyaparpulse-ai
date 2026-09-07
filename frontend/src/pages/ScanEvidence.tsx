import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Camera, CheckCircle2, X, FileText, AlertCircle, Loader2, ChevronRight } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { OCREngine } from '../engine/ocrEngine';
import type { SupplierInvoiceType } from '../types';

/**
 * Scan Evidence Screen
 * ====================
 * Camera → OCR → Structured invoice extraction → Evidence confirmation.
 *
 * Two paths:
 * 1. Demo mode: If camera captures the ABC Wholesale invoice (QR or text match),
 *    instantly returns pre-extracted data for reliable demo.
 * 2. Real mode: Tesseract.js OCR runs on the captured image.
 *
 * Route: /scan
 */

type ScanState = 'idle' | 'capturing' | 'processing' | 'review' | 'saved' | 'failed';

const DEMO_INVOICE_TRIGGER = true; // Set to false for real OCR only

export function ScanEvidence() {
  const navigate = useNavigate();
  const { addSupplierInvoice } = useApp();
  const [scanState, setScanState] = React.useState<ScanState>('idle');
  const [extractedInvoice, setExtractedInvoice] = React.useState<SupplierInvoiceType | null>(null);
  const [ocrConfidence, setOcrConfidence] = React.useState<number>(0);
  const [errorMessage, setErrorMessage] = React.useState<string>('');
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const streamRef = React.useRef<MediaStream | null>(null);

  // Try to use Capacitor Camera first, fall back to browser file input
  const handleCapture = React.useCallback(async () => {
    setScanState('capturing');

    try {
      // Try Capacitor Camera (Android/iOS)
      const { Camera: CapCamera, CameraResultType } = await import('@capacitor/camera');
      const photo = await CapCamera.getPhoto({
        resultType: CameraResultType.DataUrl,
        quality: 85,
      });

      if (photo.dataUrl) {
        setScanState('processing');
        const result = await OCREngine.parseInvoice(photo.dataUrl, DEMO_INVOICE_TRIGGER);
        setOcrConfidence(result.confidence);
        setExtractedInvoice(result.invoice);
        setScanState(result.source === 'failed' ? 'failed' : 'review');
      }
    } catch (capacitorErr) {
      // Capacitor not available — try browser camera via getUserMedia
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: 1280, height: 720 }
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        // Camera started — show camera UI (handled by render)
      } catch {
        // No camera — fall back to file input
        setScanState('idle');
        fileInputRef.current?.click();
      }
    }
  }, []);

  const handleFileInput = React.useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setScanState('processing');
    try {
      const result = await OCREngine.parseInvoice(file, DEMO_INVOICE_TRIGGER);
      setOcrConfidence(result.confidence);
      setExtractedInvoice(result.invoice);
      setScanState(result.source === 'failed' ? 'failed' : 'review');
    } catch (err) {
      setErrorMessage('Could not read the invoice image.');
      setScanState('failed');
    }
  }, []);

  const handleCaptureFrame = React.useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d')!;
    canvasRef.current.width = videoRef.current.videoWidth;
    canvasRef.current.height = videoRef.current.videoHeight;
    ctx.drawImage(videoRef.current, 0, 0);

    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;

    setScanState('processing');
    const dataUrl = canvasRef.current.toDataURL('image/jpeg', 0.85);
    const result = await OCREngine.parseInvoice(dataUrl, DEMO_INVOICE_TRIGGER);
    setOcrConfidence(result.confidence);
    setExtractedInvoice(result.invoice);
    setScanState(result.source === 'failed' ? 'failed' : 'review');
  }, []);

  const handleConfirm = React.useCallback(() => {
    if (!extractedInvoice) return;
    addSupplierInvoice(extractedInvoice);
    setScanState('saved');
  }, [extractedInvoice, addSupplierInvoice]);

  const handleRetry = React.useCallback(() => {
    setScanState('idle');
    setExtractedInvoice(null);
    setErrorMessage('');
  }, []);

  React.useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  // Demo mode trigger — instantly show review with demo invoice
  const handleDemoScan = React.useCallback(async () => {
    setScanState('processing');
    await new Promise((r) => setTimeout(r, 800)); // simulate capture
    const result = await OCREngine.parseInvoice('', true); // force demo
    setOcrConfidence(result.confidence);
    setExtractedInvoice(result.invoice);
    setScanState('review');
  }, []);

  return (
    <motion.div
      className="flex flex-col h-full bg-vp-bg"
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
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-vp-ink-3">Business Evidence</p>
            <h1 className="text-base font-bold text-vp-ink leading-tight">Scan Invoice</h1>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">

        {/* IDLE STATE */}
        <AnimatePresence mode="wait">
          {scanState === 'idle' && (
            <motion.div
              key="idle"
              className="flex flex-col items-center justify-center h-full px-6 text-center gap-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {/* Camera icon */}
              <div className="relative">
                <div className="w-28 h-28 rounded-3xl flex items-center justify-center"
                  style={{ background: 'var(--sk-scan-soft)', border: '2px solid var(--sk-scan-line)' }}>
                  <Camera size={52} style={{ color: 'var(--sk-scan)' }} />
                </div>
                {/* Corner brackets */}
                {['tl', 'tr', 'bl', 'br'].map((pos) => (
                  <div key={pos} className={`absolute w-5 h-5 ${
                    pos === 'tl' ? '-top-1 -left-1 border-t-2 border-l-2' :
                    pos === 'tr' ? '-top-1 -right-1 border-t-2 border-r-2' :
                    pos === 'bl' ? '-bottom-1 -left-1 border-b-2 border-l-2' :
                    '-bottom-1 -right-1 border-b-2 border-r-2'
                  } rounded-sm`} style={{ borderColor: 'var(--sk-scan)' }} />
                ))}
              </div>

              <div>
                <h2 className="text-xl font-bold text-vp-ink mb-2">Point at a supplier invoice</h2>
                <p className="text-sm text-vp-ink-2 leading-relaxed">
                  SAKSHAM will extract product names, quantities, and prices —
                  offline, on this device. No cloud needed.
                </p>
              </div>

              <div className="w-full space-y-3">
                {/* Primary: Demo scan */}
                <motion.button
                  onClick={handleDemoScan}
                  className="w-full py-4 rounded-2xl text-white font-bold text-base"
                  style={{ background: 'var(--sk-scan)' }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Camera size={18} className="inline mr-2 -mt-0.5" />
                  Scan Invoice (Demo)
                </motion.button>

                {/* Secondary: Real camera */}
                <motion.button
                  onClick={handleCapture}
                  className="w-full py-3.5 rounded-2xl font-semibold text-sm border"
                  style={{ borderColor: 'var(--sk-scan-line)', color: 'var(--sk-scan)', background: 'var(--sk-scan-soft)' }}
                  whileTap={{ scale: 0.98 }}
                >
                  Use Camera
                </motion.button>

                {/* File input fallback */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-3 text-sm text-vp-ink-2 font-medium"
                >
                  Upload image instead
                </button>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleFileInput}
                />
                <canvas ref={canvasRef} className="hidden" />
              </div>

              {/* Info */}
              <div className="bg-vp-surface rounded-2xl border border-vp-line p-4 text-left w-full">
                <p className="text-xs font-bold text-vp-ink-2 mb-2">What gets extracted:</p>
                {['Supplier name', 'Product names & quantities', 'Unit prices', 'Total amount'].map((item) => (
                  <div key={item} className="flex items-center gap-2 mb-1">
                    <CheckCircle2 size={13} style={{ color: 'var(--sk-demand-up)' }} />
                    <p className="text-xs text-vp-ink-2">{item}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* PROCESSING STATE */}
          {scanState === 'processing' && (
            <motion.div
              key="processing"
              className="flex flex-col items-center justify-center h-full gap-5"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className="w-20 h-20 rounded-3xl flex items-center justify-center"
                style={{ background: 'var(--sk-scan-soft)' }}
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
              >
                <Loader2 size={36} style={{ color: 'var(--sk-scan)' }} />
              </motion.div>
              <div className="text-center">
                <p className="font-bold text-vp-ink text-base">Reading invoice…</p>
                <p className="text-sm text-vp-ink-3 mt-1">Running on your device</p>
              </div>
              {/* Progress bar */}
              <div className="w-48 h-1.5 rounded-full bg-vp-surface-2 overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: 'var(--sk-scan)' }}
                  initial={{ width: '0%' }}
                  animate={{ width: '100%' }}
                  transition={{ duration: 1.5, ease: 'easeInOut' }}
                />
              </div>
            </motion.div>
          )}

          {/* REVIEW STATE */}
          {scanState === 'review' && extractedInvoice && (
            <motion.div
              key="review"
              className="px-4 py-5 space-y-4 pb-8"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              {/* Confidence badge */}
              <div className="flex items-center gap-2 justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={18} style={{ color: 'var(--sk-demand-up)' }} />
                  <p className="font-bold text-vp-ink">Invoice extracted</p>
                </div>
                <span className="text-[10px] font-bold px-2.5 py-1 rounded-full"
                  style={{
                    background: ocrConfidence > 0.7 ? 'var(--sk-demand-up-soft)' : 'var(--sk-demand-down-soft)',
                    color: ocrConfidence > 0.7 ? 'var(--sk-demand-up)' : 'var(--sk-demand-down)',
                    border: `1px solid ${ocrConfidence > 0.7 ? 'var(--sk-demand-up-line)' : 'var(--sk-demand-down-line)'}`,
                  }}>
                  {extractedInvoice.source === 'demo' ? 'Demo invoice' : `${Math.round(ocrConfidence * 100)}% confident`}
                </span>
              </div>

              {/* Invoice details */}
              <div className="bg-vp-surface rounded-2xl border border-vp-line overflow-hidden">
                <div className="px-4 pt-4 pb-3 border-b border-vp-line">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-black text-vp-ink text-base">{extractedInvoice.supplierName}</p>
                      {extractedInvoice.invoiceNumber && (
                        <p className="text-xs text-vp-ink-3 mt-0.5">{extractedInvoice.invoiceNumber}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-vp-ink-3">Date</p>
                      <p className="font-semibold text-sm text-vp-ink">{extractedInvoice.invoiceDate}</p>
                    </div>
                  </div>
                </div>

                {/* Line items */}
                <div className="divide-y divide-vp-line">
                  {extractedInvoice.lines.map((line, i) => (
                    <div key={i} className="px-4 py-3 flex items-start justify-between">
                      <div className="flex-1 min-w-0 mr-3">
                        <p className="font-semibold text-sm text-vp-ink leading-snug">{line.productName}</p>
                        <p className="text-xs text-vp-ink-3 mt-0.5">{line.quantity} {line.unit} × ₹{line.unitPrice}</p>
                      </div>
                      <p className="font-bold text-sm text-vp-ink shrink-0">₹{line.totalAmount.toLocaleString('en-IN')}</p>
                    </div>
                  ))}
                </div>

                {/* Grand total */}
                <div className="px-4 py-3 border-t-2 border-vp-line-strong flex items-center justify-between"
                  style={{ background: 'var(--vp-surface-2)' }}>
                  <p className="font-bold text-vp-ink">Total</p>
                  <p className="font-black text-lg text-vp-ink">₹{(extractedInvoice.grandTotal ?? 0).toLocaleString('en-IN')}</p>
                </div>
              </div>

              {/* Warning for low confidence */}
              {ocrConfidence < 0.5 && extractedInvoice.source !== 'demo' && (
                <div className="flex items-start gap-2 p-3 rounded-xl border"
                  style={{ background: 'var(--sk-demand-down-soft)', borderColor: 'var(--sk-demand-down-line)' }}>
                  <AlertCircle size={15} style={{ color: 'var(--sk-demand-down)', marginTop: 2 }} />
                  <p className="text-xs text-vp-ink-2">
                    OCR confidence is low. Please review the extracted numbers before confirming.
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={handleRetry}
                  className="flex items-center justify-center gap-2 py-3.5 rounded-2xl border font-semibold text-sm"
                  style={{ borderColor: 'var(--vp-line)', color: 'var(--vp-ink-2)' }}
                >
                  <X size={16} />
                  Retake
                </button>
                <motion.button
                  onClick={handleConfirm}
                  className="flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-sm text-white"
                  style={{ background: 'var(--sk-scan)' }}
                  whileTap={{ scale: 0.97 }}
                >
                  <CheckCircle2 size={16} />
                  Confirm
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* SAVED STATE */}
          {scanState === 'saved' && extractedInvoice && (
            <motion.div
              key="saved"
              className="flex flex-col items-center justify-center h-full gap-5 px-6 text-center"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className="w-24 h-24 rounded-full flex items-center justify-center"
                style={{ background: 'var(--sk-demand-up-soft)' }}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 20, delay: 0.1 }}
              >
                <CheckCircle2 size={48} style={{ color: 'var(--sk-demand-up)' }} />
              </motion.div>

              <div>
                <h2 className="text-xl font-bold text-vp-ink mb-2">Invoice saved as evidence</h2>
                <p className="text-sm text-vp-ink-2">
                  {extractedInvoice.supplierName} · {extractedInvoice.lines.length} product{extractedInvoice.lines.length !== 1 ? 's' : ''}
                </p>
              </div>

              <div className="w-full space-y-3">
                <button
                  onClick={() => navigate('/memory')}
                  className="w-full flex items-center justify-between px-5 py-4 rounded-2xl border font-semibold text-sm"
                  style={{ background: 'var(--sk-memory-soft)', borderColor: 'var(--sk-memory-line)', color: 'var(--sk-memory)' }}
                >
                  <span>See Economic Memory</span>
                  <ChevronRight size={17} />
                </button>
                <button
                  onClick={() => navigate('/')}
                  className="w-full py-3.5 text-sm font-semibold text-vp-ink-2 border border-vp-line rounded-2xl"
                >
                  Go to Home
                </button>
              </div>
            </motion.div>
          )}

          {/* FAILED STATE */}
          {scanState === 'failed' && (
            <motion.div
              key="failed"
              className="flex flex-col items-center justify-center h-full gap-5 px-6 text-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="w-20 h-20 rounded-3xl flex items-center justify-center"
                style={{ background: 'var(--sk-alert-soft)' }}>
                <AlertCircle size={40} style={{ color: 'var(--sk-alert)' }} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-vp-ink mb-2">Could not read invoice</h2>
                <p className="text-sm text-vp-ink-2 leading-relaxed">
                  {errorMessage || 'The image was unclear or the format was not recognized. Try again with better lighting.'}
                </p>
              </div>
              <button
                onClick={handleRetry}
                className="px-8 py-3.5 rounded-2xl font-bold text-white text-sm"
                style={{ background: 'var(--sk-scan)' }}
              >
                Try again
              </button>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </motion.div>
  );
}
