import { Clock, Trash2, Edit3 } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import { SHIFT_LABELS, isShiftShabbat } from "@/lib/payroll-engine";
import { useDeleteShift } from "@/hooks/use-work-data";
import type { ShiftRow } from "@/lib/payroll-engine";
import { toast } from "sonner";

interface WorkShiftsListProps {
  shifts: ShiftRow[];
  isLoading: boolean;
}

export function WorkShiftsList({ shifts, isLoading }: WorkShiftsListProps) {
  const deleteShift = useDeleteShift();

  const handleDelete = (id: string) => {
    deleteShift.mutate(id, {
      onSuccess: () => toast.success("משמרת נמחקה"),
      onError: () => toast.error("שגיאה במחיקה"),
    });
  };

  return (
    <div className="rounded-2xl bg-card border border-border p-4 md:p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-work" />
          <h3 className="text-sm font-semibold text-muted-foreground">משמרות החודש</h3>
        </div>
        {shifts.length > 0 && (
          <span className="text-xs text-muted-foreground">{shifts.length} משמרות</span>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 rounded-xl bg-secondary/20 animate-pulse" />
          ))}
        </div>
      ) : shifts.length === 0 ? (
        <EmptyState
          icon={Clock}
          message="אין משמרות עדיין — הוסף משמרת כדי להתחיל"
          colorClass="text-work"
        />
      ) : (
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {shifts.map((shift) => {
            const dayName = new Date(shift.date).toLocaleDateString("he-IL", { weekday: "short" });
            const dateStr = new Date(shift.date).toLocaleDateString("he-IL", { day: "numeric", month: "short" });

            return (
              <div key={shift.id} className="flex items-center justify-between gap-2 rounded-xl bg-secondary/20 px-3 py-2.5">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="text-center shrink-0 w-10">
                    <p className="text-[10px] text-muted-foreground">{dayName}</p>
                    <p className="text-xs font-bold">{dateStr}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold truncate">
                      {SHIFT_LABELS[shift.type] || shift.type}
                      {isShiftShabbat(shift) && <span className="text-finance me-1">🕯️</span>}
                      {shift.has_briefing && <span className="text-work me-1">📋</span>}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {shift.role === 'shift_manager' ? 'אחראי משמרת' : 'מאבטח'} · {shift.hours || 8} שעות
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(shift.id)}
                  disabled={deleteShift.isPending}
                  className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors shrink-0"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
