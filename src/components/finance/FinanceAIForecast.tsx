import { useMemo } from "react";
import { TrendingUp } from "lucide-react";
import { useMonthlyFinance } from "@/hooks/use-finance-data";
import { forecastMonthEnd } from "@/lib/finance-utils";
import { FT } from "@/lib/finance-theme";

const fmt = (n: number) => n.toLocaleString("he-IL", { maximumFractionDigits: 0 });

function TrafficLight({ status }: { status: "green" | "yellow" | "red" | null }) {
  const colors = {
    green: { active: "#22c55e", label: "בשליטה" },
    yellow: { active: "#eab308", label: "תשומת לב" },
    red: { active: "#ef4444", label: "חריגה" },
  };
  const lights = ["red", "yellow", "green"] as const;
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="flex flex-col gap-1.5 p-2 rounded-2xl" style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.08)" }}>
        {lights.map((c) => (
          <div
            key={c}
            className="h-5 w-5 rounded-full transition-all duration-500"
            style={{
              background: status === c ? colors[c].active : "rgba(255,255,255,0.06)",
              boxShadow: status === c ? `0 0 10px ${colors[c].active}` : "none",
            }}
          />
        ))}
      </div>
      {status && (
        <p className="text-[10px] font-bold" style={{ color: colors[status].active, letterSpacing: 0 }}>
          {colors[status].label}
        </p>
      )}
    </div>
  );
}

const STATUS_TEXT = {
  green: "בקצב הזה תעמוד ביעד החיסכון",
  yellow: "בקצב הזה ההוצאות בתוך ההכנסה, אבל מתחת ליעד החיסכון",
  red: "בקצב הזה ההוצאות יעברו את ההכנסה הצפויה",
} as const;

// Plain arithmetic on the month's own numbers — it used to be an AI call that never saw the income
export function FinanceAIForecast() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const fin = useMonthlyFinance(year, month);

  const forecast = useMemo(() => {
    const debtMonthly = (fin.debts || []).reduce((s: number, d: any) => s + Number(d.monthly_payment), 0);
    const { predicted, status } = forecastMonthEnd({
      variableExpenses: fin.variableExpenses,
      fixedMonthly: fin.totalFixedMonthly,
      debtMonthly,
      expectedIncome: fin.forecastBalance + fin.forecastExpenses,
      savingsGoalPct: fin.savingsGoal,
      daysElapsed: now.getDate(),
      daysInMonth: fin.daysInMonth,
    });
    const byCategory: Record<string, number> = { ...fin.categoryBreakdown };
    for (const f of fin.fixedExpenses || []) byCategory[f.category] = (byCategory[f.category] ?? 0) + Number(f.amount);
    const [topCategory, topCategoryAmount] = Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0] ?? ["—", 0];
    return { predicted, status, topCategory, topCategoryAmount };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fin]);

  const hasData = fin.variableExpenses > 0 || fin.totalFixedMonthly > 0;
  const color = forecast.status === "red" ? FT.danger : forecast.status === "yellow" ? "#eab308" : FT.success;

  return (
    <div
      className="rounded-3xl p-4 animate-in fade-in slide-in-from-bottom-2 duration-300"
      style={{ background: FT.card, border: `1px solid ${FT.goldBorder}` }}
      dir="rtl"
    >
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp className="h-4 w-4" style={{ color: FT.gold }} />
        <p className="text-sm font-black" style={{ color: FT.gold, letterSpacing: 0 }}>תחזית הוצאות</p>
      </div>

      {!hasData ? (
        <p className="text-xs text-center py-4" style={{ color: FT.textFaint, letterSpacing: 0 }}>
          אין עדיין הוצאות החודש
        </p>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-4">
            <TrafficLight status={forecast.status} />
            <div className="flex-1">
              <p className="text-xs font-bold mb-1" style={{ color: FT.textMuted, letterSpacing: 0 }}>
                לפי הקצב הנוכחי...
              </p>
              <p className="text-2xl font-black" style={{ color, letterSpacing: 0 }} dir="ltr">
                ₪{fmt(forecast.predicted)}
              </p>
              <p className="text-[10px] mt-0.5" style={{ color: FT.textFaint, letterSpacing: 0 }}>
                תחזית הוצאות לסוף החודש (כולל קבועות)
              </p>
            </div>
          </div>

          {forecast.status && (
            <div className="rounded-2xl p-3" style={{ background: "rgba(0,0,0,0.25)", border: `1px solid ${FT.brownBorder}` }}>
              <p className="text-xs leading-relaxed" style={{ color: FT.textSub, letterSpacing: 0 }}>
                {STATUS_TEXT[forecast.status]} (יעד חיסכון {fin.savingsGoal}%).
              </p>
            </div>
          )}

          <div className="flex items-center justify-between">
            <p className="text-xs" style={{ color: FT.textMuted, letterSpacing: 0 }}>
              קטגוריה מובילה: <span className="font-bold" style={{ color: FT.gold }}>{forecast.topCategory}</span>
            </p>
            <p className="text-xs font-bold" style={{ color: FT.gold, letterSpacing: 0 }} dir="ltr">
              ₪{fmt(forecast.topCategoryAmount)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
