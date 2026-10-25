import { useState, useEffect, useCallback, memo } from "react";
import { AddItemDrawer } from "@/components/shared/AddItemDrawer";
import { useAddExpense, useUpdateExpense, DEFAULT_EXPENSE_CATEGORIES, useActiveExpenseCategories } from "@/hooks/use-finance-data";
import { AmountScrollPicker } from "./AmountScrollPicker";
import { todayLocalStr } from "@/utils/date";
import { toast } from "sonner";
import { haptics } from "@/lib/haptics";

interface AddExpenseDrawerProps {
  open: boolean;
  onClose: () => void;
  /** When set, the drawer edits this expense_entries row instead of adding a new one */
  editing?: any;
}

const CategoryChip = memo(function CategoryChip({
  cat,
  isActive,
  onSelect,
}: {
  cat: { name: string; icon: string };
  isActive: boolean;
  onSelect: (name: string) => void;
}) {
  return (
    <button
      onClick={() => onSelect(cat.name)}
      className={`flex flex-col items-center gap-1 px-2 py-2.5 rounded-xl border transition-colors text-xs font-medium ${
        isActive ? "border-finance bg-finance/10 text-finance" : "border-border bg-card hover:bg-secondary/40 text-foreground"
      }`}
    >
      <span className="text-base">{cat.icon}</span>
      {cat.name}
    </button>
  );
});

type Currency = "ILS" | "USD" | "EUR" | "GBP";

const CURRENCIES: { value: Currency; symbol: string; label: string }[] = [
  { value: "ILS", symbol: "₪", label: "שקל (₪)" },
  { value: "USD", symbol: "$", label: "דולר ($)" },
  { value: "EUR", symbol: "€", label: "יורו (€)" },
  { value: "GBP", symbol: "£", label: "פאונד (£)" },
];

async function fetchExchangeRate(currency: Currency): Promise<number> {
  if (currency === "ILS") return 1;
  const res = await fetch(`https://api.exchangerate-api.com/v4/latest/ILS`);
  if (!res.ok) throw new Error("לא ניתן לטעון שערי מטבע");
  const data = await res.json();
  return data.rates?.[currency] ?? 1;
}

export function AddExpenseDrawer({ open, onClose, editing }: AddExpenseDrawerProps) {
  const [category, setCategory] = useState("מזון");
  const [customCategory, setCustomCategory] = useState("");
  const [amount, setAmount] = useState<number | null>(null);
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(todayLocalStr);
  const [isRecurring, setIsRecurring] = useState(false);
  const [currency, setCurrency] = useState<Currency>("ILS");
  const [exchangeRate, setExchangeRate] = useState<number>(1);
  const [rateLoading, setRateLoading] = useState(false);
  const activeCategories = useActiveExpenseCategories();
  const addExpense = useAddExpense();
  const updateExpense = useUpdateExpense();
  const isSaving = addExpense.isPending || updateExpense.isPending;

  // Load the row being edited each time the drawer opens on it
  useEffect(() => {
    if (!open || !editing) return;
    const known = activeCategories.some((c) => c.name === editing.category);
    setCategory(known ? editing.category : "אחר");
    setCustomCategory(known ? "" : editing.category ?? "");
    setCurrency((editing.currency as Currency) || "ILS");
    setExchangeRate(Number(editing.exchange_rate) || 1);
    setAmount(Number(editing.original_amount ?? editing.amount));
    setDescription(editing.description ?? "");
    setDate(editing.date);
    setIsRecurring(!!editing.is_recurring);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing?.id]);

  const handleCategorySelect = useCallback((name: string) => {
    haptics.tap();
    setCategory(name);
  }, []);

  const handleDescriptionChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setDescription(e.target.value);
  }, []);

  useEffect(() => {
    if (currency === "ILS") {
      setExchangeRate(1);
      return;
    }
    // Keep the rate the edited expense was saved with rather than re-quoting it
    if (editing && currency === editing.currency) return;
    let cancelled = false;
    setRateLoading(true);
    fetchExchangeRate(currency)
      .then((rate) => { if (!cancelled) setExchangeRate(rate); })
      .catch(() => {
        if (cancelled) return;
        toast.error("שגיאה בטעינת שער חליפין — השתמש בשער ידני");
        setExchangeRate(1);
      })
      .finally(() => setRateLoading(false));
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currency]);

  const ilsAmount = amount != null && exchangeRate > 0 ? amount / exchangeRate : null;
  const currencySymbol = CURRENCIES.find((c) => c.value === currency)?.symbol ?? "₪";

  const handleSave = () => {
    if (!amount || amount <= 0) {
      toast.error("הזן סכום תקין");
      return;
    }
    const effectiveCategory = category === "אחר" && customCategory.trim() ? customCategory.trim() : category;
    if (currency !== "ILS" && exchangeRate <= 0) {
      toast.error("שגיאה: שער חליפין לא תקין, לא ניתן לשמור");
      return;
    }
    const amountILS = currency === "ILS" ? amount : amount / exchangeRate;

    if (editing) {
      updateExpense.mutate(
        {
          id: editing.id,
          amount: amountILS,
          category: effectiveCategory,
          description: description || null,
          date,
          is_recurring: isRecurring,
          currency,
          exchange_rate: exchangeRate,
          original_amount: currency !== "ILS" ? amount : null,
        },
        {
          onSuccess: () => { haptics.success(); toast.success("הוצאה עודכנה"); onClose(); },
          onError: (err) => toast.error("שגיאה בעדכון הוצאה: " + ((err as Error).message || "נסה שוב")),
        }
      );
      return;
    }

    addExpense.mutate(
      {
        amount: amountILS,
        category: effectiveCategory,
        description: description || undefined,
        date,
        expense_type: "variable",
        is_recurring: isRecurring,
        needs_review: false,
        currency,
        exchange_rate: exchangeRate,
        original_amount: currency !== "ILS" ? amount : undefined,
      },
      {
        onSuccess: () => {
          haptics.success();
          toast.success("הוצאה נשמרה");
          onClose();
          setAmount(null);
          setDescription("");
          setCategory("מזון");
          setCustomCategory("");
          setIsRecurring(false);
          setCurrency("ILS");
          setExchangeRate(1);
        },
        onError: (err) => {
          console.error("AddExpense error:", err);
          toast.error("שגיאה בשמירת הוצאה: " + ((err as Error).message || "נסה שוב"));
        },
      }
    );
  };

  return (
    <AddItemDrawer open={open} onClose={onClose} title={editing ? "ערוך הוצאה" : "הוסף הוצאה"}>
      <div className="space-y-4">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-2 block">קטגוריה</label>
          <div className="grid grid-cols-3 gap-2">
            {activeCategories.map((cat) => (
              <CategoryChip
                key={cat.name}
                cat={cat}
                isActive={category === cat.name}
                onSelect={handleCategorySelect}
              />
            ))}
          </div>
          {category === "אחר" && (
            <input type="text" value={customCategory} onChange={(e) => setCustomCategory(e.target.value)} placeholder="שם קטגוריה מותאם..."
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-card text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-finance mt-2" />
          )}
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground mb-2 block">מטבע</label>
          <div className="grid grid-cols-4 gap-2">
            {CURRENCIES.map((c) => (
              <button
                key={c.value}
                onClick={() => setCurrency(c.value)}
                className={`py-2 rounded-xl border text-xs font-bold transition-colors ${
                  currency === c.value ? "border-finance bg-finance/10 text-finance" : "border-border bg-card text-muted-foreground"
                }`}
              >
                {c.symbol} {c.value}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground mb-2 block">
            סכום ({currencySymbol})
          </label>
          <input
            type="number"
            inputMode="decimal"
            value={amount ?? ""}
            onChange={(e) => setAmount(e.target.value ? Number(e.target.value) : null)}
            placeholder="הקלד סכום..."
            className="w-full px-3 py-2.5 rounded-xl border border-border bg-card text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-finance mb-2"
            dir="ltr"
          />
          {currency === "ILS" && (
            <AmountScrollPicker value={amount} onChange={setAmount} color="expense" />
          )}

          {currency !== "ILS" && (
            <div className="space-y-2 mt-2">
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground shrink-0">שער חליפין:</label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={exchangeRate}
                  onChange={(e) => setExchangeRate(Number(e.target.value) || 1)}
                  className="flex-1 px-3 py-2 rounded-xl border border-border bg-card text-sm focus:outline-none focus:border-finance"
                  dir="ltr"
                  placeholder="1"
                />
                {rateLoading && <span className="text-xs text-muted-foreground">טוען...</span>}
              </div>
              {ilsAmount != null && (
                <p className="text-xs text-muted-foreground">
                  ≈ ₪{ilsAmount.toLocaleString("he-IL", { maximumFractionDigits: 2 })} בשקלים
                </p>
              )}
            </div>
          )}
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">תיאור</label>
          <input type="text" value={description} onChange={handleDescriptionChange} placeholder="תיאור ההוצאה..."
            className="w-full px-3 py-2.5 rounded-xl border border-border bg-card text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-finance" />
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">תאריך</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-border bg-card text-sm focus:outline-none focus:border-finance" />
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => setIsRecurring(!isRecurring)}
            className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
              isRecurring ? "border-finance bg-finance/10 text-finance" : "border-border text-muted-foreground"
            }`}>
            {isRecurring ? "✓ הוצאה חוזרת" : "הוצאה חד-פעמית"}
          </button>
        </div>

        <button onClick={handleSave} disabled={isSaving}
          className="w-full py-3 rounded-xl bg-finance text-finance-foreground font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-50">
          {isSaving ? "שומר..." : editing ? "עדכן הוצאה" : "שמור הוצאה"}
        </button>
      </div>
    </AddItemDrawer>
  );
}
