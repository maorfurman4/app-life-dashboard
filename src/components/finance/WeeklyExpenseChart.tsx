import { localDateStr } from "@/utils/date";
import { useState, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from "recharts";
import { motion } from "framer-motion";
import { useExpenseHistory } from "@/hooks/use-finance-data";
import { FT } from "@/lib/finance-theme";
import { Skeleton } from "@/components/ui/skeleton";

type Period = "week" | "month" | "3months";

const DAYS_HE = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
const MONTHS_HE = [
  "ינו׳", "פבר׳", "מרץ", "אפר׳", "מאי", "יונ׳",
  "יול׳", "אוג׳", "ספט׳", "אוק׳", "נוב׳", "דצמ׳",
];

const fmt = (n: number) =>
  n.toLocaleString("he-IL", { maximumFractionDigits: 0 });

interface BarEntry {
  label: string;
  total: number;
  topCategories: { cat: string; amount: number }[];
}

interface TooltipPayload {
  payload?: BarEntry;
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
  if (!active || !payload?.length || !payload[0].payload) return null;
  const d = payload[0].payload;
  return (
    <div
      className="rounded-2xl px-3 py-2.5 space-y-1.5 min-w-[130px]"
      style={{
        background: "rgba(22,19,17,0.96)",
        border: `1px solid ${FT.goldBorder}`,
        boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
      }}
      dir="rtl"
    >
      <p className="text-[11px] font-black" style={{ color: FT.gold }}>
        {d.label}
      </p>
      <p className="text-base font-black text-white" dir="ltr">
        ₪{fmt(d.total)}
      </p>
      {d.topCategories.slice(0, 3).map(({ cat, amount }) => (
        <div key={cat} className="flex items-center justify-between gap-3">
          <p className="text-[10px]" style={{ color: FT.textMuted }}>{cat}</p>
          <p className="text-[10px] font-bold text-white" dir="ltr">
            ₪{fmt(amount)}
          </p>
        </div>
      ))}
    </div>
  );
}

function buildWeekData(
  entries: { amount: number; category: string; date: string }[]
): BarEntry[] {
  const now = new Date();
  const sunday = new Date(now);
  sunday.setDate(now.getDate() - now.getDay());
  sunday.setHours(0, 0, 0, 0);

  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(sunday);
    day.setDate(sunday.getDate() + i);
    const key = localDateStr(day);
    const dayEntries = entries.filter((e) => e.date === key);
    const total = dayEntries.reduce((s, e) => s + Number(e.amount), 0);
    const cats: Record<string, number> = {};
    dayEntries.forEach((e) => { cats[e.category] = (cats[e.category] ?? 0) + Number(e.amount); });
    const topCategories = Object.entries(cats)
      .map(([cat, amount]) => ({ cat, amount }))
      .sort((a, b) => b.amount - a.amount);
    return { label: DAYS_HE[i], total, topCategories };
  });
}

function buildMonthData(
  entries: { amount: number; category: string; date: string }[]
): BarEntry[] {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const weekBuckets: BarEntry[] = Array.from({ length: 5 }, (_, i) => ({
    label: `שבוע ${i + 1}`,
    total: 0,
    topCategories: [],
  }));

  const monthEntries = entries.filter((e) => {
    const d = new Date(e.date);
    return d.getFullYear() === year && d.getMonth() === month;
  });

  const catMaps: Record<string, number>[] = Array.from({ length: 5 }, () => ({}));

  monthEntries.forEach((e) => {
    const day = new Date(e.date).getDate();
    const wi = Math.min(4, Math.floor((day - 1) / 7));
    weekBuckets[wi].total += Number(e.amount);
    catMaps[wi][e.category] = (catMaps[wi][e.category] ?? 0) + Number(e.amount);
  });

  const lastWeek = Math.ceil(daysInMonth / 7);
  return weekBuckets.slice(0, lastWeek).map((b, i) => ({
    ...b,
    topCategories: Object.entries(catMaps[i])
      .map(([cat, amount]) => ({ cat, amount }))
      .sort((a, b) => b.amount - a.amount),
  }));
}

function build3MonthData(
  entries: { amount: number; category: string; date: string }[]
): BarEntry[] {
  const now = new Date();
  return Array.from({ length: 3 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (2 - i), 1);
    const yr = d.getFullYear();
    const mo = d.getMonth();
    const monthEntries = entries.filter((e) => {
      const ed = new Date(e.date);
      return ed.getFullYear() === yr && ed.getMonth() === mo;
    });
    const total = monthEntries.reduce((s, e) => s + Number(e.amount), 0);
    const cats: Record<string, number> = {};
    monthEntries.forEach((e) => { cats[e.category] = (cats[e.category] ?? 0) + Number(e.amount); });
    const topCategories = Object.entries(cats)
      .map(([cat, amount]) => ({ cat, amount }))
      .sort((a, b) => b.amount - a.amount);
    return { label: MONTHS_HE[mo], total, topCategories };
  });
}

const PERIOD_LABELS: Record<Period, string> = {
  week: "שבוע",
  month: "חודש",
  "3months": "3 חודשים",
};

export function WeeklyExpenseChart() {
  const [period, setPeriod] = useState<Period>("week");
  const { data: rawEntries, isLoading } = useExpenseHistory(3);

  const entries = rawEntries ?? [];

  const data = useMemo<BarEntry[]>(() => {
    if (period === "week") return buildWeekData(entries);
    if (period === "month") return buildMonthData(entries);
    return build3MonthData(entries);
  }, [entries, period]);

  const average = useMemo(() => {
    const nonZero = data.filter((d) => d.total > 0);
    if (!nonZero.length) return 0;
    return nonZero.reduce((s, d) => s + d.total, 0) / nonZero.length;
  }, [data]);

  if (isLoading) {
    return (
      <div
        className="rounded-3xl p-4 space-y-4"
        style={{ background: FT.card, border: `1px solid ${FT.goldBorder}` }}
      >
        <div className="flex items-center justify-between">
          <Skeleton className="h-3 w-24 rounded" />
          <div className="flex gap-1">
            <Skeleton className="h-6 w-14 rounded-full" />
            <Skeleton className="h-6 w-14 rounded-full" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
        </div>
        <div className="flex items-end gap-1.5 h-40 pt-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="flex-1 rounded-t-md" style={{ height: `${30 + Math.random() * 70}%` }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <motion.div
      className="rounded-3xl p-4 space-y-4"
      style={{ background: FT.card, border: `1px solid ${FT.goldBorder}` }}
      dir="rtl"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-black" style={{ color: FT.textMuted }}>
          הוצאות לפי תקופה
        </p>
        <div className="flex gap-1">
          {(Object.entries(PERIOD_LABELS) as [Period, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setPeriod(key)}
              className="px-2.5 py-1 rounded-full text-[10px] font-bold transition-all"
              style={{
                background: period === key ? FT.goldMid : FT.brownDim,
                border: `1px solid ${period === key ? FT.goldBorder : FT.brownBorder}`,
                color: period === key ? FT.gold : FT.textMuted,
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <XAxis
            dataKey="label"
            tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 9, fontFamily: "system-ui" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 8, fontFamily: "system-ui" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => `₪${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
          />
          <Tooltip
            content={<CustomTooltip />}
            cursor={{ fill: "rgba(244,226,140,0.06)" }}
          />
          {average > 0 && (
            <ReferenceLine
              y={average}
              stroke={FT.brown}
              strokeDasharray="4 3"
              strokeWidth={1.5}
              label={{
                value: `ממוצע ₪${fmt(average)}`,
                position: "insideTopRight",
                fill: FT.textMuted,
                fontSize: 8,
                fontFamily: "system-ui",
              }}
            />
          )}
          <Bar dataKey="total" radius={[6, 6, 0, 0]} maxBarSize={36}>
            {data.map((entry, i) => {
              const today = new Date();
              const isToday = period === "week" && i === today.getDay();
              return (
                <Cell
                  key={i}
                  fill={isToday ? FT.gold : entry.total > 0 ? "#8c7555" : "rgba(140,117,85,0.25)"}
                />
              );
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </motion.div>
  );
}
