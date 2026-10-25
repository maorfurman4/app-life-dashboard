import { useState, useMemo, useRef } from "react";
import { Search, Download, Printer, X, AlertTriangle, ArrowDownRight, ArrowUpRight, Trash2, RefreshCw } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import {
  useMonthlyFinance,
  useExpenseHistory,
  useDeleteExpense,
  useDeleteIncome,
} from "@/hooks/use-finance-data";
import { AddExpenseDrawer } from "@/components/finance/AddExpenseDrawer";
import { AddIncomeDrawer } from "@/components/finance/AddIncomeDrawer";
import { FT } from "@/lib/finance-theme";
import { toast } from "sonner";

const fmt = (n: number) => n.toLocaleString("he-IL", { maximumFractionDigits: 0 });

const MONTHS_HE = [
  "ינואר","פברואר","מרץ","אפריל","מאי","יוני",
  "יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר",
];

// Earthy luxury donut palette
const DONUT_COLORS = [
  "#f4e28c", // gold
  "#d96b6b", // muted red
  "#8c7555", // brown
  "#e8a87c", // warm terracotta
  "#c4a882", // sandy
  "#7cbf8e", // soft green
  "#b8755a", // rust
  "#c9a227", // dark gold
  "#d4b896", // light sand
  "#a67c52", // medium brown
];

// ─── Smart Search ─────────────────────────────────────────────────────────────

type SearchFilter =
  | { type: "none" }
  | { type: "gt"; amount: number }
  | { type: "lt"; amount: number }
  | { type: "text"; query: string };

function parseSearch(q: string): SearchFilter {
  const t = q.trim();
  if (!t) return { type: "none" };
  const gt = t.match(/^>(\d+(?:\.\d+)?)$/);
  if (gt) return { type: "gt", amount: parseFloat(gt[1]) };
  const lt = t.match(/^<(\d+(?:\.\d+)?)$/);
  if (lt) return { type: "lt", amount: parseFloat(lt[1]) };
  return { type: "text", query: t.toLowerCase() };
}

function applyFilter(items: any[], filter: SearchFilter, activeCategory: string | null) {
  let result = activeCategory ? items.filter((t) => t.category === activeCategory) : items;
  switch (filter.type) {
    case "gt":   return result.filter((t) => Number(t.amount) > filter.amount);
    case "lt":   return result.filter((t) => Number(t.amount) < filter.amount);
    case "text": return result.filter((t) =>
      t.category?.toLowerCase().includes(filter.query) ||
      (t.description ?? "").toLowerCase().includes(filter.query) ||
      String(t.amount).includes(filter.query)
    );
    default:     return result;
  }
}

// ─── Anomaly Detection ────────────────────────────────────────────────────────

function useAnomalyIds(expenses: any[], year: number, month: number) {
  const { data: history } = useExpenseHistory(7);
  return useMemo(() => {
    const selectedKey = `${year}-${String(month).padStart(2, "0")}`;
    const catAmounts: Record<string, number[]> = {};
    (history || []).forEach((e: any) => {
      if (e.date.slice(0, 7) === selectedKey) return;
      const cat = e.category;
      if (!catAmounts[cat]) catAmounts[cat] = [];
      catAmounts[cat].push(Number(e.amount));
    });
    const catAvg: Record<string, number> = {};
    for (const [cat, amounts] of Object.entries(catAmounts)) {
      // Skip categories with fewer than 3 transactions (not enough data)
      if (amounts.length < 3) continue;
      catAvg[cat] = amounts.reduce((s, a) => s + a, 0) / amounts.length;
    }
    const ids = new Set<string>();
    expenses.forEach((e: any) => {
      const avg = catAvg[e.category];
      if (avg && Number(e.amount) > avg * 2.5 && Number(e.amount) > avg + 150) ids.add(e.id);
    });
    return ids;
  }, [history, expenses, year, month]);
}

// ─── Export Functions ─────────────────────────────────────────────────────────

function exportCSV(transactions: any[], year: number, month: number) {
  const BOM = "﻿";
  const header = ["תאריך", "סוג", "קטגוריה", "תיאור", "סכום"].join(",");
  const rows = transactions.map((t) => [
    t.date,
    t._type === "expense" ? "הוצאה" : t._type === "fixed" ? "קבועה" : "הכנסה",
    t.category,
    (t.description ?? "").replace(/,/g, " "),
    Number(t.amount).toFixed(2),
  ].join(","));
  const csv = BOM + [header, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `finances-${year}-${String(month).padStart(2, "0")}.csv`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast.success("CSV הורד בהצלחה");
}

function exportPDF(
  transactions: any[], year: number, month: number,
  totalIncome: number, totalExpenses: number, balance: number, anomalyIds: Set<string>
) {
  const monthName = MONTHS_HE[month - 1];
  const rows = transactions.map((t) => `
    <tr class="${anomalyIds.has(t.id) ? "anomaly" : ""}">
      <td>${t.date}</td>
      <td class="${t._type === "expense" || t._type === "fixed" ? "expense" : "income"}">${t._type === "expense" ? "הוצאה" : t._type === "fixed" ? "קבועה" : "הכנסה"}</td>
      <td>${t.category}</td>
      <td>${t.description ?? "-"}</td>
      <td dir="ltr" style="text-align:left">${t._type !== "income" ? "-" : "+"}₪${fmt(Number(t.amount))}${anomalyIds.has(t.id) ? " ⚠️" : ""}</td>
    </tr>`).join("");

  const html = `<!DOCTYPE html>
<html dir="rtl" lang="he"><head><meta charset="UTF-8">
<title>דוח פיננסי — ${monthName} ${year}</title>
<style>body{font-family:Arial,sans-serif;direction:rtl;padding:24px;color:#111}
h1{font-size:20px;margin:0 0 4px}.sub{font-size:12px;color:#666;margin:0 0 16px}
.summary{display:flex;gap:24px;margin-bottom:20px;font-size:13px;font-weight:bold}
.income{color:#059669}.expense{color:#dc2626}
table{width:100%;border-collapse:collapse;font-size:12px}
th{background:#f5f5f5;padding:8px;text-align:right;border-bottom:2px solid #ddd;font-size:11px}
td{padding:7px 8px;border-bottom:1px solid #eee}.anomaly{background:#fff8e1}
@media print{body{padding:12px}}</style></head>
<body><h1>דוח פיננסי — ${monthName} ${year}</h1>
<p class="sub">הופק ב-${new Date().toLocaleDateString("he-IL")}</p>
<div class="summary">
  <span class="income">הכנסות: ₪${fmt(totalIncome)}</span>
  <span class="expense">הוצאות: ₪${fmt(totalExpenses)}</span>
  <span style="color:${balance >= 0 ? "#059669" : "#dc2626"}">מאזן: ₪${fmt(balance)}</span>
</div>
<table><thead><tr><th>תאריך</th><th>סוג</th><th>קטגוריה</th><th>תיאור</th><th>סכום</th></tr></thead>
<tbody>${rows}</tbody></table></body></html>`;

  const win = window.open("", "_blank");
  if (!win) { toast.error("חסמת חלונות קופצים — אנא אפשר"); return; }
  win.document.write(html); win.document.close(); win.focus();
  setTimeout(() => win.print(), 400);
  toast.success("דוח PDF נפתח להדפסה");
}

// ─── Donut Chart — earthy palette ─────────────────────────────────────────────

function DonutChart({
  data, activeCategory, onSliceClick,
}: {
  data: { name: string; value: number }[];
  activeCategory: string | null;
  onSliceClick: (name: string) => void;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);

  if (data.length === 0) return (
    <div className="flex items-center justify-center h-48 text-sm" style={{ color: FT.textFaint }}>
      אין הוצאות לחודש זה
    </div>
  );

  return (
    <div className="flex gap-4 items-center">
      {/* Chart */}
      <div className="relative shrink-0" style={{ width: 160, height: 160 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data} cx="50%" cy="50%"
              innerRadius={48} outerRadius={72}
              paddingAngle={2} dataKey="value"
              onClick={(entry) => onSliceClick(entry.name)}
              style={{ cursor: "pointer" }}
            >
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={DONUT_COLORS[index % DONUT_COLORS.length]}
                  opacity={activeCategory && activeCategory !== entry.name ? 0.2 : 1}
                  stroke="none"
                />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: FT.card,
                border: `1px solid ${FT.goldBorder}`,
                borderRadius: 14,
                fontSize: 11,
                color: "#fff",
              }}
              formatter={(v: number) => [`₪${fmt(v)}`, ""]}
            />
          </PieChart>
        </ResponsiveContainer>
        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <p className="text-xs font-black" style={{ color: FT.gold, letterSpacing: 0 }}>
            ₪{fmt(activeCategory ? (data.find((d) => d.name === activeCategory)?.value ?? 0) : total)}
          </p>
          <p className="text-[9px] mt-0.5" style={{ color: FT.textMuted, letterSpacing: 0 }}>
            {activeCategory ?? "סה״כ"}
          </p>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-col gap-1.5 flex-1 min-w-0 overflow-y-auto max-h-36">
        {data.map((entry, index) => {
          const color = DONUT_COLORS[index % DONUT_COLORS.length];
          const pct = total > 0 ? ((entry.value / total) * 100).toFixed(0) : "0";
          const isActive = activeCategory === entry.name;
          return (
            <button
              key={entry.name}
              onClick={() => onSliceClick(entry.name)}
              className="flex items-center gap-2 text-end w-full rounded-xl px-2 py-1 transition-all"
              style={{ background: isActive ? FT.goldDim : "transparent" }}
            >
              <span
                className="h-2.5 w-2.5 rounded-full shrink-0"
                style={{
                  backgroundColor: color,
                  opacity: activeCategory && !isActive ? 0.25 : 1,
                  boxShadow: isActive ? `0 0 6px ${color}` : "none",
                }}
              />
              <span
                className="text-[11px] font-semibold truncate flex-1"
                style={{ color: activeCategory && !isActive ? FT.textFaint : "#fff", letterSpacing: 0 }}
              >
                {entry.name}
              </span>
              <span className="text-[10px] shrink-0" style={{ color: FT.textMuted }}>{pct}%</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Transaction Row ──────────────────────────────────────────────────────────

function TransactionRow({ item, isAnomaly, onDelete, onEdit }: {
  item: any; isAnomaly: boolean; onDelete?: () => void; onEdit?: () => void;
}) {
  const isFixed = item._type === "fixed";
  const isExpense = item._type === "expense";
  const isIncome = item._type === "income";

  return (
    <div
      onClick={onEdit}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-2xl group transition-all ${onEdit ? "cursor-pointer" : ""}`}
      style={{
        background: isAnomaly ? "rgba(212,178,100,0.08)" : FT.cardLight,
        border: `1px solid ${isAnomaly ? "rgba(212,178,100,0.22)" : isFixed ? "rgba(139,170,255,0.15)" : FT.brownBorder}`,
      }}
    >
      {/* Icon */}
      <div
        className="h-7 w-7 rounded-xl flex items-center justify-center shrink-0"
        style={{
          background: isAnomaly ? "rgba(212,178,100,0.15)" :
            isFixed ? "rgba(139,170,255,0.12)" :
            isExpense ? FT.dangerDim : FT.successDim,
        }}
      >
        {isAnomaly
          ? <AlertTriangle className="h-3.5 w-3.5" style={{ color: "#d4b264" }} aria-label="חריגה" />
          : isFixed
            ? <RefreshCw className="h-3.5 w-3.5" style={{ color: "#8baaf0" }} />
            : isExpense
              ? <ArrowDownRight className="h-3.5 w-3.5" style={{ color: FT.danger }} />
              : <ArrowUpRight className="h-3.5 w-3.5" style={{ color: FT.success }} />}
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-white truncate" style={{ letterSpacing: 0 }}>
          {item.description || item.name || item.category}
        </p>
        <p className="text-[10px] mt-0.5" style={{ color: FT.textMuted }}>
          {item.category}
          {isFixed && <span style={{ color: "#8baaf0" }} className="me-1"> · קבועה</span>}
          {" · "}{item.date}
          {isAnomaly && <span style={{ color: "#d4b264" }} className="me-1"> · חריג מהממוצע</span>}
        </p>
      </div>

      {/* Amount */}
      <span
        className="text-sm font-black shrink-0 tabular-nums"
        style={{ color: isIncome ? FT.success : isFixed ? "#8baaf0" : FT.danger }}
        dir="ltr"
      >
        {isIncome ? "+" : "-"}₪{fmt(Number(item.amount))}
      </span>

      {/* Delete — only for variable expenses and income */}
      {onDelete && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="h-7 w-7 rounded-lg flex items-center justify-center transition-all shrink-0 active:scale-90"
          style={{ background: FT.dangerDim, color: FT.danger }}
          aria-label="מחק"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export function FinanceHistoryTab({ year, month }: { year: number; month: number }) {
  const fin = useMonthlyFinance(year, month);
  const deleteExpense = useDeleteExpense();
  const deleteIncome = useDeleteIncome();

  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const transactionsRef = useRef<HTMLDivElement>(null);
  const [editingItem, setEditingItem] = useState<any>(null);

  const searchFilter = parseSearch(search);

  const allTransactions = useMemo(() => [
    ...(fin.expenses || []).map((e: any) => ({ ...e, _type: "expense" as const })),
    ...(fin.incomes  || []).map((i: any) => ({ ...i, _type: "income"  as const })),
    ...(fin.fixedExpenses || []).map((f: any) => {
      // Clamp charge_day to actual month length (e.g. day 31 in February → day 28/29)
      const maxDay = new Date(year, month, 0).getDate();
      const clampedDay = Math.min(Number(f.charge_day) || 1, maxDay);
      return {
        ...f,
        _type: "fixed" as const,
        date: `${year}-${String(month).padStart(2, "0")}-${String(clampedDay).padStart(2, "0")}`,
        description: f.notes || f.name,
      };
    }),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
  [fin.expenses, fin.incomes, fin.fixedExpenses, year, month]);

  const anomalyIds = useAnomalyIds(fin.expenses || [], year, month);

  const donutData = useMemo(() => {
    const breakdown: Record<string, number> = {};
    (fin.expenses || []).forEach((e: any) => {
      breakdown[e.category] = (breakdown[e.category] || 0) + Number(e.amount);
    });
    (fin.fixedExpenses || []).forEach((f: any) => {
      breakdown[f.category] = (breakdown[f.category] || 0) + Number(f.amount);
    });
    return Object.entries(breakdown).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [fin.expenses, fin.fixedExpenses]);

  const filtered = applyFilter(allTransactions, searchFilter, activeCategory);

  function handleSliceClick(name: string) {
    setActiveCategory((prev) => (prev === name ? null : name));
    setSearch("");
    setTimeout(() => {
      transactionsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  }

  function handleDelete(item: any) {
    if (!window.confirm(item._type === "expense" ? "למחוק את ההוצאה?" : "למחוק את ההכנסה?")) return;
    if (item._type === "expense") {
      deleteExpense.mutate(item.id, { onSuccess: () => toast.success("הוצאה נמחקה") });
    } else if (item._type === "income") {
      deleteIncome.mutate(item.id, { onSuccess: () => toast.success("הכנסה נמחקה") });
    }
  }

  const anomalyCount = filtered.filter((t) => anomalyIds.has(t.id)).length;

  return (
    <div className="space-y-4">

      {/* Donut Chart Card */}
      <div className="rounded-3xl p-5 space-y-3" style={{ background: FT.card, border: `1px solid ${FT.goldBorder}` }}>
        <div className="flex items-center justify-between">
          <p className="text-xs font-black" style={{ color: FT.textMuted, letterSpacing: 0 }}>
            📊 פילוח הוצאות
          </p>
          {activeCategory && (
            <button
              onClick={() => setActiveCategory(null)}
              className="flex items-center gap-1 text-[11px] font-bold transition-colors"
              style={{ color: FT.gold, letterSpacing: 0 }}
            >
              <X className="h-3 w-3" />
              נקה סינון
            </button>
          )}
        </div>
        <DonutChart data={donutData} activeCategory={activeCategory} onSliceClick={handleSliceClick} />
        <p className="text-[10px] text-center" style={{ color: FT.textFaint }}>
          לחץ על קטגוריה כדי לסנן את ההוצאות
        </p>
      </div>

      {/* Smart Search */}
      <div className="rounded-3xl p-4 space-y-2" style={{ background: FT.card, border: `1px solid ${FT.goldBorder}` }}>
        <div className="relative">
          <Search className="absolute end-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none" style={{ color: FT.textMuted }} />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setActiveCategory(null); }}
            placeholder="חיפוש: טקסט, קטגוריה, >500 (גדול מ), <200 (קטן מ)"
            className="w-full pe-10 ps-4 py-2.5 rounded-2xl text-sm text-white placeholder:text-white/20 focus:outline-none transition-all"
            style={{ background: FT.cardLight, border: `1px solid ${FT.goldBorder}` }}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute start-3 top-1/2 -translate-y-1/2 transition-colors"
              style={{ color: FT.textMuted }}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Active filter pills */}
        <div className="flex flex-wrap gap-2 min-h-[1px]">
          {activeCategory && (
            <span
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold"
              style={{ background: FT.goldMid, border: `1px solid ${FT.goldBorder}`, color: FT.gold }}
            >
              {activeCategory}
              <button onClick={() => setActiveCategory(null)}><X className="h-3 w-3" /></button>
            </span>
          )}
          {searchFilter.type !== "none" && (
            <span
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold"
              style={{ background: FT.brownDim, border: `1px solid ${FT.brownBorder}`, color: FT.textMuted }}
            >
              {searchFilter.type === "gt" && `> ₪${fmt(searchFilter.amount)}`}
              {searchFilter.type === "lt" && `< ₪${fmt(searchFilter.amount)}`}
              {searchFilter.type === "text" && `"${searchFilter.query}"`}
              <button onClick={() => setSearch("")}><X className="h-3 w-3" /></button>
            </span>
          )}
        </div>
      </div>

      {/* Transaction List */}
      <div ref={transactionsRef} className="rounded-3xl p-4 space-y-3" style={{ background: FT.card, border: `1px solid ${FT.goldBorder}` }}>
        <div className="flex items-center justify-between">
          <p className="text-xs font-black" style={{ color: FT.textMuted, letterSpacing: 0 }}>
            📋 תנועות{activeCategory ? ` — ${activeCategory}` : ""}
          </p>
          <div className="flex items-center gap-2">
            {anomalyCount > 0 && (
              <span className="flex items-center gap-1 text-[11px] font-bold" style={{ color: "#d4b264" }}>
                <AlertTriangle className="h-3 w-3" />
                {anomalyCount} חריגות
              </span>
            )}
            <span className="text-[10px]" style={{ color: FT.textFaint }}>
              {filtered.length} מתוך {allTransactions.length}
            </span>
          </div>
        </div>

        {filtered.length === 0 ? (
          <p className="text-center text-sm py-8" style={{ color: FT.textFaint, letterSpacing: 0 }}>
            {allTransactions.length === 0 ? "אין תנועות לחודש זה" : "אין תוצאות לחיפוש זה"}
          </p>
        ) : (
          <div className="space-y-1.5 max-h-80 overflow-y-auto">
            {filtered.map((item: any) => (
              <TransactionRow
                key={item._type === "fixed" ? `fixed-${item.id}` : item.id}
                item={item}
                isAnomaly={anomalyIds.has(item.id)}
                onDelete={item._type !== "fixed" ? () => handleDelete(item) : undefined}
                onEdit={item._type !== "fixed" ? () => setEditingItem(item) : undefined}
              />
            ))}
          </div>
        )}
      </div>

      {/* Export Buttons */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => exportCSV(allTransactions, year, month)}
          disabled={allTransactions.length === 0}
          className="flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-black transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]"
          style={{
            letterSpacing: 0,
            background: FT.goldDim,
            border: `1px solid ${FT.goldBorder}`,
            color: FT.gold,
          }}
        >
          <Download className="h-4 w-4" />
          ייצוא CSV
        </button>
        <button
          onClick={() => exportPDF(allTransactions, year, month, fin.totalIncome, fin.totalExpenses, fin.balance, anomalyIds)}
          disabled={allTransactions.length === 0}
          className="flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-black transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]"
          style={{
            letterSpacing: 0,
            background: FT.brownDim,
            border: `1px solid ${FT.brownBorder}`,
            color: FT.brown,
          }}
        >
          <Printer className="h-4 w-4" />
          ייצוא PDF
        </button>
      </div>

      {editingItem?._type === "expense" && (
        <AddExpenseDrawer key={editingItem.id} open editing={editingItem} onClose={() => setEditingItem(null)} />
      )}
      {editingItem?._type === "income" && (
        <AddIncomeDrawer key={editingItem.id} open editing={editingItem} onClose={() => setEditingItem(null)} />
      )}
    </div>
  );
}
