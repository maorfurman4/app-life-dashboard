import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { X, Camera, Loader2, AlertCircle, Plus, Package } from "lucide-react";
import { fetchProductByBarcode, type FoodFactsProduct } from "@/lib/open-food-facts";

interface BarcodeScannerProps {
  open: boolean;
  onClose: () => void;
  onDetected: (barcode: string) => void;
  onProductFound?: (product: FoodFactsProduct) => void;
}

export function BarcodeScanner({ open, onClose, onDetected, onProductFound }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(true);
  const [fetchingProduct, setFetchingProduct] = useState(false);
  const [product, setProduct] = useState<FoodFactsProduct | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [scannedBarcode, setScannedBarcode] = useState<string | null>(null);
  const [cardVisible, setCardVisible] = useState(false);

  useEffect(() => {
    if (!open) {
      setProduct(null);
      setNotFound(false);
      setScannedBarcode(null);
      setFetchingProduct(false);
      setCardVisible(false);
      return;
    }
    let mounted = true;
    setError(null);
    setStarting(true);
    setProduct(null);
    setNotFound(false);
    setCardVisible(false);

    const reader = new BrowserMultiFormatReader();

    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("המצלמה אינה נתמכת בדפדפן זה");
        }
        const controls = await reader.decodeFromVideoDevice(
          undefined,
          videoRef.current!,
          async (result, _err) => {
            if (result && mounted) {
              const text = result.getText();
              controls.stop();
              setScannedBarcode(text);
              onDetected(text);
              setFetchingProduct(true);
              const found = await fetchProductByBarcode(text);
              if (!mounted) return;
              setFetchingProduct(false);
              if (found) {
                setProduct(found);
                requestAnimationFrame(() => setCardVisible(true));
              } else {
                setNotFound(true);
                requestAnimationFrame(() => setCardVisible(true));
              }
            }
          }
        );
        controlsRef.current = controls;
        if (mounted) setStarting(false);
      } catch (e: unknown) {
        const err = e as { name?: string; message?: string };
        console.error("Camera error:", e);
        if (!mounted) return;
        const msg = err?.name === "NotAllowedError"
          ? "אין הרשאה לגישה למצלמה — אשר במכשיר ובדפדפן"
          : err?.name === "NotFoundError"
          ? "לא נמצאה מצלמה במכשיר"
          : err?.message || "שגיאה בהפעלת המצלמה";
        setError(msg);
        setStarting(false);
      }
    })();

    return () => {
      mounted = false;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [open, onDetected]);

  if (!open) return null;

  const handleAdd = () => {
    if (product && onProductFound) {
      onProductFound(product);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col">
      <div
        className="flex items-center justify-between p-4 bg-black/80 text-white"
        style={{ paddingTop: "max(2.75rem, calc(env(safe-area-inset-top) + 0.75rem))" }}
      >
        <div className="flex items-center gap-2">
          <Camera className="h-5 w-5 text-nutrition" />
          <h3 className="text-sm font-bold">סריקת ברקוד</h3>
        </div>
        <button
          onClick={onClose}
          aria-label="סגור סריקה"
          className="h-11 w-11 rounded-full bg-white/15 active:bg-white/25 flex items-center justify-center shrink-0"
        >
          <X className="h-6 w-6" />
        </button>
      </div>

      <div className="flex-1 relative overflow-hidden">
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover"
          playsInline
          muted
        />

        {!error && !product && !notFound && !fetchingProduct && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-72 h-44 border-2 border-nutrition rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]" />
          </div>
        )}

        {starting && !error && !product && !notFound && !fetchingProduct && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-nutrition" />
            <p className="text-sm">מפעיל מצלמה…</p>
          </div>
        )}

        {fetchingProduct && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white gap-3 bg-black/70">
            <Loader2 className="h-10 w-10 animate-spin text-nutrition" />
            <p className="text-sm font-bold">מחפש מוצר במאגר…</p>
          </div>
        )}

        {product && (
          <div
            className="absolute inset-0 flex items-end justify-center bg-black/70 pb-6 px-4"
            style={{
              opacity: cardVisible ? 1 : 0,
              transform: cardVisible ? "scale(1)" : "scale(0.95)",
              transition: "opacity 0.2s ease, transform 0.2s ease",
            }}
          >
            <div className="w-full max-w-sm rounded-3xl border border-white/15 bg-white/10 backdrop-blur-2xl p-5 text-white space-y-4">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-2xl bg-nutrition/20 flex items-center justify-center shrink-0">
                  <Package className="h-5 w-5 text-nutrition" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-base leading-tight truncate">{product.name}</p>
                  {product.brand && (
                    <p className="text-xs text-white/50 mt-0.5">{product.brand}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: "קל׳", value: Math.round(product.calories), color: "text-emerald-400" },
                  { label: "חלבון", value: `${product.protein}g`, color: "text-blue-400" },
                  { label: "פחמימות", value: `${product.carbs}g`, color: "text-amber-400" },
                  { label: "שומן", value: `${product.fat}g`, color: "text-pink-400" },
                ].map((m) => (
                  <div key={m.label} className="flex flex-col items-center gap-0.5 rounded-xl bg-white/5 py-2">
                    <span className={`text-sm font-black ${m.color}`}>{m.value}</span>
                    <span className="text-[9px] text-white/40">{m.label}</span>
                  </div>
                ))}
              </div>

              <p className="text-[10px] text-white/30 text-center">לכל 100 גרם</p>

              <button
                onClick={handleAdd}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-nutrition text-white font-bold text-sm active:scale-95 transition-transform"
              >
                <Plus className="h-4 w-4" />
                הוסף
              </button>

              <button
                onClick={onClose}
                className="w-full py-2 text-xs text-white/40 hover:text-white/60 transition-colors"
              >
                ביטול
              </button>
            </div>
          </div>
        )}

        {notFound && !product && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center text-white gap-3 p-6 text-center bg-black/70"
            style={{
              opacity: cardVisible ? 1 : 0,
              transform: cardVisible ? "scale(1)" : "scale(0.95)",
              transition: "opacity 0.2s ease, transform 0.2s ease",
            }}
          >
            <AlertCircle className="h-10 w-10 text-amber-400" />
            <p className="text-sm font-bold">מוצר לא נמצא במאגר</p>
            {scannedBarcode && (
              <p className="text-xs text-white/40">ברקוד: {scannedBarcode}</p>
            )}
            <button
              onClick={onClose}
              className="mt-2 px-4 py-2 rounded-xl bg-white/10 text-sm"
            >
              סגור
            </button>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white gap-3 p-6 text-center">
            <AlertCircle className="h-10 w-10 text-destructive" />
            <p className="text-sm">{error}</p>
            <button
              onClick={onClose}
              className="mt-2 px-4 py-2 rounded-xl bg-white/10 text-sm"
            >
              סגור
            </button>
          </div>
        )}
      </div>

      {!product && !notFound && !error && (
        <div
          className="bg-black/80 text-white flex flex-col items-center gap-3 px-4 pt-3"
          style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
        >
          <p className="text-center text-xs">
            {!scannedBarcode ? "כוון את הברקוד אל תוך המסגרת" : "ברקוד נסרק בהצלחה"}
          </p>
          <button
            onClick={onClose}
            className="w-full py-3 rounded-2xl bg-white/10 active:bg-white/20 text-sm font-semibold min-h-[44px]"
          >
            ביטול
          </button>
        </div>
      )}
    </div>
  );
}
