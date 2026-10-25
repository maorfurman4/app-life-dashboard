import { localDateStr } from "@/utils/date";
import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, ScanLine } from "lucide-react";
import { AddItemDrawer } from "@/components/shared/AddItemDrawer";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { haptics } from "@/lib/haptics";
import { fileToBase64 } from "@/utils/file-utils";

interface AddPayslipDrawerProps {
  open: boolean;
  onClose: () => void;
}

interface ParsedPayslip {
  grossPay?: number | null;
  netPay?: number | null;
  deductions?: {
    tax?: number | null;
    socialSecurity?: number | null;
    pension?: number | null;
    health?: number | null;
    educationFund?: number | null;
    other?: number | null;
  };
}

const inputCls =
  "w-full px-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-[15px] text-white/90 placeholder:text-white/30 focus:outline-none focus:border-white/25 focus:bg-white/7 transition-all";
const inputSmCls =
  "w-full px-3 py-2.5 rounded-2xl bg-white/5 border border-white/10 text-[13px] text-white/90 placeholder:text-white/30 focus:outline-none focus:border-white/25 transition-all";


export function AddPayslipDrawer({ open, onClose }: AddPayslipDrawerProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [month, setMonth] = useState(localDateStr().slice(0, 7));
  const [grossActual, setGrossActual] = useState("");
  const [netActual, setNetActual] = useState("");
  const [unionActual, setUnionActual] = useState("");
  const [pensionActual, setPensionActual] = useState("");
  const [eduActual, setEduActual] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isScanning, setIsScanning] = useState(false);

  const reset = useCallback(() => {
    setGrossActual("");
    setNetActual("");
    setUnionActual("");
    setPensionActual("");
    setEduActual("");
  }, []);

  const applyParsed = useCallback((parsed: ParsedPayslip) => {
    if (parsed.grossPay != null) setGrossActual(String(parsed.grossPay));
    if (parsed.netPay != null) setNetActual(String(parsed.netPay));
    if (parsed.deductions?.pension != null) setPensionActual(String(parsed.deductions.pension));
    if (parsed.deductions?.educationFund != null) setEduActual(String(parsed.deductions.educationFund));
    if (parsed.deductions?.socialSecurity != null) setUnionActual(String(parsed.deductions.socialSecurity));
  }, []);

  const handleScanTap = useCallback(() => {
    haptics.tap();
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset value so same file can be re-selected
    e.target.value = "";

    setIsScanning(true);
    haptics.tap();

    try {
      const imageBase64 = await fileToBase64(file);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const res = await supabase.functions.invoke("payslip-parse-ai", {
        body: { imageBase64, mimeType: file.type || "image/jpeg" },
      });

      if (res.error) throw new Error(res.error.message ?? "שגיאת AI");

      const parsed = res.data as ParsedPayslip;
      applyParsed(parsed);
      haptics.success();
      toast.success("התלוש נסרק בהצלחה ✓ אנא אמת את הנתונים");
    } catch (err: any) {
      haptics.error();
      toast.error("שגיאה בסריקה: " + (err?.message ?? "נסה שוב"));
    } finally {
      setIsScanning(false);
    }
  }, [applyParsed]);

  const handleSave = useCallback(async () => {
    if (!grossActual && !netActual) {
      haptics.error();
      toast.error("הזן לפחות ברוטו או נטו");
      return;
    }
    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await (supabase as any).from("payslip_uploads").insert({
        user_id: user.id,
        upload_month: month,
        extracted_data: {
          gross_pay: grossActual ? Number(grossActual) : null,
          net_pay: netActual ? Number(netActual) : null,
          deductions: {
            union: unionActual ? Number(unionActual) : null,
            pension: pensionActual ? Number(pensionActual) : null,
            education_fund: eduActual ? Number(eduActual) : null,
          },
        },
        file_url: "",
        file_name: `תלוש-${month}`,
      });
      if (error) throw error;

      haptics.success();
      toast.success("תלוש נשמר");
      await queryClient.invalidateQueries({ queryKey: ["payslip-uploads"] });
      reset();
      onClose();
    } catch (e: any) {
      haptics.error();
      toast.error("שגיאה בשמירת התלוש: " + e.message);
    } finally {
      setIsSaving(false);
    }
  }, [grossActual, netActual, unionActual, pensionActual, eduActual, month, queryClient, reset, onClose]);

  const footer = (
    <motion.button
      whileTap={{ scale: 0.97 }}
      transition={{ type: "spring", stiffness: 500, damping: 25 }}
      onClick={handleSave}
      disabled={isSaving || isScanning}
      className="w-full py-3.5 rounded-2xl bg-purple-600 font-bold text-[15px] text-white hover:brightness-110 transition-all disabled:opacity-40 shadow-[0_2px_20px_rgba(124,58,237,0.25)]"
    >
      {isSaving ? "שומר..." : "שמור תלוש"}
    </motion.button>
  );

  return (
    <AddItemDrawer open={open} onClose={onClose} title="הזן תלוש שכר" footer={footer}>
      {/* Hidden file input — camera + gallery */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,application/pdf"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
        aria-hidden="true"
      />

      <div className="space-y-4 relative">
        {/* AI Scan Button */}
        <motion.button
          whileTap={{ scale: 0.95 }}
          transition={{ type: "spring", stiffness: 500, damping: 28 }}
          onClick={handleScanTap}
          disabled={isScanning}
          className="w-full py-3.5 rounded-2xl font-bold text-[14px] text-white flex items-center justify-center gap-2.5 transition-all disabled:opacity-60 active:brightness-110"
          style={{
            background: "linear-gradient(135deg, #7c3aed 0%, #4f46e5 50%, #0ea5e9 100%)",
            boxShadow: "0 4px 24px rgba(124,58,237,0.35)",
          }}
          aria-label="סרוק תלוש חכם באמצעות AI"
        >
          {isScanning ? (
            <ScanLine className="h-4 w-4 animate-pulse" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          {isScanning ? "AI סורק..." : "📷 סרוק תלוש חכם"}
        </motion.button>

        {/* AI Scanning skeleton overlay */}
        <AnimatePresence>
          {isScanning && (
            <motion.div
              key="scan-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 z-10 rounded-2xl backdrop-blur-[2px] flex flex-col items-center justify-center gap-4 pointer-events-all"
              style={{ background: "rgba(10,10,18,0.75)" }}
            >
              <ScanLine className="h-8 w-8 text-purple-400 animate-pulse" />
              <p className="text-sm font-semibold text-purple-300">AI מנתח את התלוש...</p>
              {/* Skeleton bars */}
              <div className="w-48 space-y-2">
                {[80, 60, 70, 50].map((w, i) => (
                  <div
                    key={i}
                    className="h-3 rounded-full animate-pulse"
                    style={{
                      width: `${w}%`,
                      background: "rgba(139,92,246,0.3)",
                      animationDelay: `${i * 120}ms`,
                    }}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div style={{ opacity: isScanning ? 0.35 : 1, pointerEvents: isScanning ? "none" : "auto", transition: "opacity 0.2s" }}>
          <div>
            <label className="text-xs font-medium text-white/40 mb-1.5 block">חודש</label>
            <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className={inputCls} />
          </div>

          <div className="grid grid-cols-2 gap-3 mt-4">
            <div>
              <label className="text-xs font-medium text-white/40 mb-1.5 block">ברוטו בפועל (₪)</label>
              <input
                type="number"
                inputMode="decimal"
                autoFocus
                value={grossActual}
                onChange={(e) => setGrossActual(e.target.value)}
                placeholder="0"
                className={inputCls}
                dir="ltr"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-white/40 mb-1.5 block">נטו בפועל (₪)</label>
              <input
                type="number"
                inputMode="decimal"
                value={netActual}
                onChange={(e) => setNetActual(e.target.value)}
                placeholder="0"
                className={inputCls}
                dir="ltr"
              />
            </div>
          </div>

          <div className="space-y-3 mt-4">
            <h4 className="text-xs font-semibold text-white/40">ניכויים בפועל</h4>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] text-white/30 mb-1 block">בט"ל / הסתדרות</label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={unionActual}
                  onChange={(e) => setUnionActual(e.target.value)}
                  placeholder="0"
                  className={inputSmCls}
                  dir="ltr"
                />
              </div>
              <div>
                <label className="text-[10px] text-white/30 mb-1 block">פנסיה</label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={pensionActual}
                  onChange={(e) => setPensionActual(e.target.value)}
                  placeholder="0"
                  className={inputSmCls}
                  dir="ltr"
                />
              </div>
              <div>
                <label className="text-[10px] text-white/30 mb-1 block">קה"ש</label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={eduActual}
                  onChange={(e) => setEduActual(e.target.value)}
                  placeholder="0"
                  className={inputSmCls}
                  dir="ltr"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </AddItemDrawer>
  );
}
