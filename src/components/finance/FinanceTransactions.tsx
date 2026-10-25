import { localDateStr } from "@/utils/date";
import { ArrowUpRight, ArrowDownRight, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { AddExpenseDrawer } from "@/components/finance/AddExpenseDrawer";
import { AddIncomeDrawer } from "@/components/finance/AddIncomeDrawer";
import { useMonthlyFinance, useDeleteExpense, useDeleteIncome } from "@/hooks/use-finance-data";
import { FT } from "@/lib/finance-theme";
import { toast } from "sonner";

const fmt = (n: number) => n.toLocaleString("he-IL", { maximumFractionDigits: 0 });

export function FinanceTransactions() {
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [incomeOpen, setIncomeOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const now = new Date();
  const fin = useMonthlyFinance(now.getFullYear(), now.getMonth() + 1);
  const deleteExpense = useDeleteExpense();
  const deleteIncome = useDeleteIncome();

  const transactions = [
    ...fin.expenses.map((e: any) => ({ ...e, _type: "expense" as const })),
    ...fin.incomes.map((i: any) => ({ ...i, _type: "income" as const })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Weekly totals: ISO week number helper
  const getWeekNum = (dateStr: string) => {
    const d = new Date(dateStr);
    const day = d.getDay() === 0 ? 7 : d.getDay();
    d.setDate(d.getDate() + 4 - day);
    const year = new Date(d.getFullYear(), 0, 1);
    return Math.ceil((((d.getTime() - year.getTime()) / 86400000) + 1) / 7);
  };
  const weeklyExpenses: Record<number, number> = {};
  fin.expenses.forEach((e: any) => {
    const w = getWeekNum(e.date);
    weeklyExpenses[w] = (weeklyExpenses[w] || 0) + Number(e.amount);
  });
  const currentWeek = getWeekNum(localDateStr());
  const thisWeekTotal = weeklyExpenses[currentWeek] || 0;

  const displayed = showAll ? transactions : transactions.slice(0, 2);

  const handleDelete = (item: any) => {
    if (!window.confirm(item._type === "expense" ? "למחוק את ההוצאה?" : "למחוק את ההכנסה?")) return;
    if (item._type === "expense") {
      deleteExpense.mutate(item.id, { onSuccess: () => toast.success("הוצאה נמחקה") });
    } else {
      deleteIncome.mutate(item.id, { onSuccess: () => toast.success("הכנסה נמחקה") });
    }
  };

  return (
    <div className="rounded-3xl p-5 space-y-3" dir="rtl"
      style={{ background: FT.card, border: `1px solid ${FT.goldBorder}` }}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-black" style={{ color: FT.textSub, letterSpacing: 0 }}>תנועות אחרונות</p>
        <div className="flex gap-2">
          <button onClick={() => setIncomeOpen(true)}
            className="text-[10px] px-2.5 py-1.5 rounded-full font-bold transition-all active:scale-95"
            style={{ background: FT.successDim, border: "1px solid rgba(124,191,142,0.3)", color: FT.success, letterSpacing: 0 }}>
            + הכנסה
          </button>
          <button onClick={() => setExpenseOpen(true)}
            className="text-[10px] px-2.5 py-1.5 rounded-full font-bold transition-all active:scale-95"
            style={{ background: FT.dangerDim, border: "1px solid rgba(217,107,107,0.3)", color: FT.danger, letterSpacing: 0 }}>
            + הוצאה
          </button>
        </div>
      </div>

      {thisWeekTotal > 0 && (
        <div className="flex items-center justify-between px-3 py-2 rounded-xl"
          style={{ background: FT.cardLight, border: `1px solid ${FT.brownBorder}` }}>
          <span className="text-[10px] font-bold" style={{ color: FT.textSub }}>סה"כ השבוע</span>
          <span className="text-xs font-black" dir="ltr" style={{ color: FT.danger }}>
            -₪{fmt(thisWeekTotal)}
          </span>
        </div>
      )}

      {transactions.length === 0 ? (
        <button onClick={() => setExpenseOpen(true)}
          className="w-full text-center py-4 rounded-2xl border-2 border-dashed text-xs transition-all"
          style={{ borderColor: FT.brownBorder, color: FT.textFaint, letterSpacing: 0 }}>
          אין תנועות עדיין · לחץ להוספה
        </button>
      ) : (
        <div className="space-y-2">
          {displayed.map((item: any) => (
            <div key={item.id}
              onClick={() => setEditingItem(item)}
              className="flex items-center justify-between px-3 py-2.5 rounded-2xl group transition-all duration-150 hover:bg-white/5 cursor-pointer"
              style={{ background: FT.cardLight, border: `1px solid ${FT.brownBorder}` }}>
              <div className="flex items-center gap-2 min-w-0">
                {item._type === "expense"
                  ? <ArrowDownRight className="h-3.5 w-3.5 shrink-0" style={{ color: FT.danger }} />
                  : <ArrowUpRight className="h-3.5 w-3.5 shrink-0" style={{ color: FT.success }} />}
                <div className="min-w-0">
                  <p className="text-xs font-bold text-white truncate" style={{ letterSpacing: 0 }}>
                    {item.description || item.category}
                  </p>
                  <p className="text-[10px]" style={{ color: FT.textFaint }}>{item.date}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <div className="text-end">
                  <span className="text-xs font-black" dir="ltr"
                    style={{ color: item._type === "expense" ? FT.danger : FT.success }}>
                    {item._type === "expense" ? "-" : "+"}₪{fmt(Number(item.amount))}
                  </span>
                  {item._type === "expense" && item.currency && item.currency !== "ILS" && item.original_amount && (
                    <p className="text-[9px] text-end" dir="ltr" style={{ color: FT.textFaint }}>
                      {item.currency === "USD" ? "$" : item.currency === "EUR" ? "€" : "£"}{Number(item.original_amount).toLocaleString("he-IL", { maximumFractionDigits: 2 })}
                    </p>
                  )}
                </div>
                <button onClick={(e) => { e.stopPropagation(); handleDelete(item); }}
                  aria-label="מחק"
                  className="h-8 w-8 flex items-center justify-center rounded-lg opacity-60 hover:opacity-100 transition-all active:scale-90"
                  style={{ color: FT.danger }}>
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {transactions.length > 2 && (
        <button onClick={() => setShowAll((v) => !v)}
          className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-bold transition-all"
          style={{ color: FT.textMuted, letterSpacing: 0 }}>
          {showAll
            ? <><ChevronUp className="h-3.5 w-3.5" /> הסתר</>
            : <><ChevronDown className="h-3.5 w-3.5" /> הצג הכל ({transactions.length})</>}
        </button>
      )}

      <AddExpenseDrawer open={expenseOpen} onClose={() => setExpenseOpen(false)} />
      <AddIncomeDrawer open={incomeOpen} onClose={() => setIncomeOpen(false)} />
      {editingItem?._type === "expense" && (
        <AddExpenseDrawer key={editingItem.id} open editing={editingItem} onClose={() => setEditingItem(null)} />
      )}
      {editingItem?._type === "income" && (
        <AddIncomeDrawer key={editingItem.id} open editing={editingItem} onClose={() => setEditingItem(null)} />
      )}
    </div>
  );
}
