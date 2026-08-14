import { Banknote, Printer } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import type { MonthlyPayslip } from "@/lib/payroll-engine";
import { useProfile } from "@/hooks/use-profile";

interface WorkSalaryBreakdownProps {
  payslip: MonthlyPayslip | null;
  isLoading: boolean;
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex items-center justify-between py-1 ${bold ? "font-bold" : ""}`}>
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-xs ${bold ? "text-foreground font-bold" : "text-foreground"}`} dir="ltr">{value}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-semibold text-work/80 uppercase tracking-wide">{title}</p>
      {children}
    </div>
  );
}

const fmt = (n: number) => `₪${n.toLocaleString("he-IL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;


export function WorkSalaryBreakdown({ payslip, isLoading }: WorkSalaryBreakdownProps) {
  const hasData = payslip && payslip.totalShifts > 0;
  const now = new Date();
  const currentMonth = now.toLocaleDateString('he-IL', { month: 'long' });
  const currentYear = now.getFullYear();
  const currentMonthNum = now.getMonth() + 1;
  const { data: profile } = useProfile();
  const employeeName = profile?.full_name ?? "—";

  return (
    <div className="rounded-2xl bg-card border border-border p-4 md:p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Banknote className="h-4 w-4 text-work" />
        <h3 className="text-sm font-semibold text-muted-foreground">פירוט תלוש צפוי</h3>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-5 rounded bg-secondary/20 animate-pulse" />
          ))}
        </div>
      ) : !hasData ? (
        <EmptyState
          icon={Banknote}
          message="אין משמרות — הוסף משמרות כדי לראות חישוב שכר"
          colorClass="text-work"
        />
      ) : payslip && (
        <div className="space-y-4">
          <Section title="רכיבי שכר">
            <Row label="שכר יסוד כולל שנ״ג" value={fmt(payslip.basePay)} />
            <Row label="הבראה" value={fmt(payslip.recovery)} />
            <Row label="תוספת מצוינות" value={fmt(payslip.excellence)} />
            {payslip.shabbatPay > 0 && <Row label="שעות שבת כולל שנ״ג" value={fmt(payslip.shabbatPay)} />}
            {payslip.overtimePay > 0 && <Row label={`שעות נוספות (${payslip.overtimeHours} ש')`} value={fmt(payslip.overtimePay)} />}
            <Row label="נסיעות" value={fmt(payslip.travel)} />
            {payslip.briefingPay > 0 && <Row label="פ. תדרוך" value={fmt(payslip.briefingPay)} />}
            <div className="border-t border-border pt-1">
              <Row label="ברוטו" value={fmt(payslip.totalGross)} bold />
            </div>
          </Section>

          <Section title="ניכויי חובה">
            <Row label="ביטוח לאומי" value={fmt(payslip.nationalInsurance)} />
            <Row label="ביטוח בריאות" value={fmt(payslip.healthInsurance)} />
            <div className="border-t border-border pt-1">
              <Row label="סה״כ ניכויי חובה" value={fmt(payslip.totalMandatory)} bold />
            </div>
          </Section>

          <Section title="ניכויי משרד">
            <Row label="השתתפות ארוחות צהר" value={fmt(payslip.lunchDeduction)} />
            <Row label="הסתדרות לאומית" value={fmt(payslip.unionNational)} />
            <div className="border-t border-border pt-1">
              <Row label="סה״כ ניכויי משרד" value={fmt(payslip.totalOffice)} bold />
            </div>
          </Section>

          <Section title="ניכויי חו״ז">
            <Row label="ניכוי הראל ש'" value={fmt(payslip.harelSavings)} />
            <Row label="ניכוי הראל קר" value={fmt(payslip.harelStudy)} />
            <Row label="ניכוי האל נסיע" value={fmt(payslip.harelTravel)} />
            <Row label="ניכוי הראל ש' (נוסף)" value={fmt(payslip.extraHarel)} />
            <div className="border-t border-border pt-1">
              <Row label="סה״כ ניכויי חו״ז" value={fmt(payslip.totalPension)} bold />
            </div>
          </Section>

          <div className="rounded-xl bg-work/10 border border-work/20 p-3 space-y-1">
            <Row label="סה״כ ניכויים" value={fmt(payslip.totalDeductions)} bold />
            <Row label="שכר נטו" value={fmt(payslip.netPay)} bold />
            <Row label="סכום לבנק" value={fmt(payslip.bankAmount)} bold />
          </div>

          <button
            onClick={() => window.print()}
            className="w-full flex items-center justify-center gap-2 mt-4 px-4 py-2.5 rounded-xl border border-border bg-secondary/30 hover:bg-secondary/50 transition-colors text-sm font-medium"
          >
            <Printer className="h-4 w-4" />
            הדפס תלוש שכר
          </button>
        </div>
      )}

      {/* Hidden print area — Israeli payslip layout */}
      <div id="payslip-print-area" className="hidden">
        <style>{`
          @media print {
            body > * { display: none !important; }
            #payslip-print-area { display: block !important; }
          }
          #payslip-print-area {
            font-family: Arial, sans-serif;
            direction: rtl;
            color: #000;
            background: #fff;
            padding: 24px;
            max-width: 800px;
            margin: 0 auto;
          }
          #payslip-print-area table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 16px;
          }
          #payslip-print-area th, #payslip-print-area td {
            border: 1px solid #000;
            padding: 6px 10px;
            font-size: 12px;
          }
          #payslip-print-area th {
            background: #e0e0e0;
            font-weight: bold;
            text-align: right;
          }
          #payslip-print-area td.num {
            text-align: left;
            direction: ltr;
          }
          #payslip-print-area .section-title {
            background: #333;
            color: #fff;
            font-weight: bold;
            font-size: 13px;
            padding: 5px 10px;
            margin-bottom: 0;
          }
          #payslip-print-area .total-row td {
            font-weight: bold;
            background: #f0f0f0;
          }
          #payslip-print-area .net-row td {
            font-weight: bold;
            font-size: 14px;
            background: #d0e8d0;
          }
          #payslip-print-area .header-table td {
            border: 1px solid #000;
            padding: 6px 10px;
            font-size: 12px;
          }
        `}</style>

        {/* Payslip title */}
        <div style={{ textAlign: 'center', borderBottom: '3px double #000', paddingBottom: '10px', marginBottom: '16px' }}>
          <div style={{ fontSize: '20px', fontWeight: 'bold' }}>תלוש שכר</div>
          <div style={{ fontSize: '13px' }}>{currentMonth} {currentYear}</div>
        </div>

        {/* Employee / employer header */}
        <table className="header-table" style={{ marginBottom: '20px' }}>
          <tbody>
            <tr>
              <td style={{ width: '20%', fontWeight: 'bold' }}>שם עובד</td>
              <td style={{ width: '30%' }}>{employeeName}</td>
              <td style={{ width: '20%', fontWeight: 'bold' }}>שם מעסיק</td>
              <td style={{ width: '30%' }}>—</td>
            </tr>
            <tr>
              <td style={{ fontWeight: 'bold' }}>ת.ז.</td>
              <td>—</td>
              <td style={{ fontWeight: 'bold' }}>חודש / שנה</td>
              <td>{String(currentMonthNum).padStart(2, '0')} / {currentYear}</td>
            </tr>
          </tbody>
        </table>

        {/* Earnings table — הכנסות */}
        <div className="section-title">הכנסות</div>
        <table>
          <thead>
            <tr>
              <th>רכיב שכר</th>
              <th style={{ textAlign: 'left', direction: 'ltr' }}>סכום (₪)</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>שכר בסיס (כולל שנ״ג)</td><td className="num">{(payslip?.basePay ?? 0).toFixed(2)}</td></tr>
            <tr><td>תוספת ותק / הבראה</td><td className="num">{(payslip?.recovery ?? 0).toFixed(2)}</td></tr>
            <tr><td>תוספת מצוינות</td><td className="num">{(payslip?.excellence ?? 0).toFixed(2)}</td></tr>
            {(payslip?.shabbatPay ?? 0) > 0 && (
              <tr><td>שכר שבת / חג (150%)</td><td className="num">{(payslip?.shabbatPay ?? 0).toFixed(2)}</td></tr>
            )}
            {(payslip?.overtimePay ?? 0) > 0 && (
              <tr><td>שעות נוספות ({payslip?.overtimeHours ?? 0} ש')</td><td className="num">{(payslip?.overtimePay ?? 0).toFixed(2)}</td></tr>
            )}
            <tr><td>נסיעות</td><td className="num">{(payslip?.travel ?? 0).toFixed(2)}</td></tr>
            {(payslip?.briefingPay ?? 0) > 0 && (
              <tr><td>ברפינג / תדרוך</td><td className="num">{(payslip?.briefingPay ?? 0).toFixed(2)}</td></tr>
            )}
            <tr className="total-row">
              <td>סה״כ ברוטו</td>
              <td className="num">{(payslip?.totalGross ?? 0).toFixed(2)}</td>
            </tr>
          </tbody>
        </table>

        {/* Deductions table — ניכויים */}
        <div className="section-title">ניכויים</div>
        <table>
          <thead>
            <tr>
              <th>סוג ניכוי</th>
              <th style={{ textAlign: 'left', direction: 'ltr' }}>סכום (₪)</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>ביטוח לאומי</td><td className="num">-{(payslip?.nationalInsurance ?? 0).toFixed(2)}</td></tr>
            <tr><td>ביטוח בריאות</td><td className="num">-{(payslip?.healthInsurance ?? 0).toFixed(2)}</td></tr>
            {(payslip?.lunchDeduction ?? 0) > 0 && (
              <tr><td>ניכוי אוכל / צהריים</td><td className="num">-{(payslip?.lunchDeduction ?? 0).toFixed(2)}</td></tr>
            )}
            {(payslip?.unionNational ?? 0) > 0 && (
              <tr><td>ועד / הסתדרות</td><td className="num">-{(payslip?.unionNational ?? 0).toFixed(2)}</td></tr>
            )}
            <tr><td>קרן פנסיה / הראל חיסכון</td><td className="num">-{(payslip?.harelSavings ?? 0).toFixed(2)}</td></tr>
            <tr><td>קרן השתלמות / הראל לימודים</td><td className="num">-{(payslip?.harelStudy ?? 0).toFixed(2)}</td></tr>
            {(payslip?.harelTravel ?? 0) > 0 && (
              <tr><td>הראל נסיעות</td><td className="num">-{(payslip?.harelTravel ?? 0).toFixed(2)}</td></tr>
            )}
            {(payslip?.extraHarel ?? 0) > 0 && (
              <tr><td>הראל נוסף</td><td className="num">-{(payslip?.extraHarel ?? 0).toFixed(2)}</td></tr>
            )}
            <tr className="total-row">
              <td>סה״כ ניכויים</td>
              <td className="num">-{(payslip?.totalDeductions ?? 0).toFixed(2)}</td>
            </tr>
          </tbody>
        </table>

        {/* Net pay summary */}
        <table>
          <tbody>
            <tr className="net-row">
              <td style={{ width: '70%' }}>שכר נטו</td>
              <td className="num">{(payslip?.netPay ?? 0).toFixed(2)}</td>
            </tr>
            <tr className="net-row">
              <td>לתשלום לבנק</td>
              <td className="num">{(payslip?.bankAmount ?? payslip?.netPay ?? 0).toFixed(2)}</td>
            </tr>
          </tbody>
        </table>

        <div style={{ marginTop: '20px', fontSize: '10px', color: '#555', borderTop: '1px solid #ccc', paddingTop: '8px' }}>
          נוצר בתאריך {new Date().toLocaleDateString('he-IL')} | {payslip?.totalShifts ?? 0} משמרות | {payslip?.totalHours ?? 0} שעות
        </div>
      </div>
    </div>
  );
}
