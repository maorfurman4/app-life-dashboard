# My Life — Big Plan (תוכנית עבודה לכל האפליקציה)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** להפוך את My Life לאפליקציה שאפשר לסמוך על המספרים שלה ושכל פיצ'ר שמוצג בה באמת עובד.

**Architecture:** אין שינוי ארכיטקטורה. כל חישוב כספי עובר לפונקציות טהורות ב-`src/lib/` עם בדיקות vitest, והמסכים רק מציגים את התוצאה. שינויי UI נשארים בקבצים הקיימים ובסגנון שלהם.

**Tech Stack:** React 19, TanStack Router/Query, Supabase, Vite 7, vitest 3.2 (חדש, devDependency בלבד).

**Spec:** דוח בדיקת האיכות מ-2026-10-25 (בשיחה) + PR #122. כל משימה כאן מצטטת את הממצא שהיא סוגרת.

## Global Constraints

- כל טקסט למשתמש בעברית, RTL.
- כל query key כולל `userId` (חוק קיים בפרויקט).
- תאריך "היום" רק דרך `localDateStr()` / `todayLocalStr()` מ-`src/utils/date.ts`, אף פעם `toISOString().slice(0, 10)`.
- קופוני ארוחה הם **שובר נפרד** (החלטה של מאור, 2026-10-25): "נטו לבנק" = `payslip.netPay` בלבד; קופונים מוצגים בשורה נפרדת ולא נכנסים להכנסות בכלכלה.
- סכום קופון: ₪68 למשמרת שבהערה שלה מופיע `ארוחה +` או `נסיעות +`.
- לא משנים נוסחת שכר בלי בדיקה שמכסה אותה; לא משנים ערכי הגדרות של המשתמש בשקט.
- אין תלות runtime חדשה. vitest בלבד כ-devDependency.
- Edge functions לא נפרסות מכאן (אין גישת CLI לפרויקט `oglhuhnppdlekviodkjb`); משימה שמשנה edge function מסתיימת בפקודת deploy שמאור מריץ.

## Review Focus

1. **מעבר חודש וחצות** — רשומה ב-1 לחודש בשעה 00:30 צריכה להיספר בחודש החדש, וחודש קודם צריך להציג את כל ההוצאות הקבועות שלו. נבדק ב-Task 3 (`accruedThroughDay` לחודש עבר/נוכחי/עתידי).
2. **חודש בלי משמרות / בלי קופונים** — `couponTotal` = 0 ו"נטו לבנק" = 0 בלי NaN. נבדק ב-Task 2.
3. **הזנת סכום ידני שלא נמצא בגלגל (₪1, ₪137.5)** — הסכום שהוקלד נשמר כמו שהוא, הגלגל לא דורס אותו. נבדק ב-Task 6.
4. **משמרת ידנית/חופשה/מחלה** — לא מקבלות קופון ולא נספרות כשעות בתשלום. נבדק ב-Task 2.
5. **XP כפול על אותה פעולה** (לחיצה כפולה/רענון) — פעולה אחת = הענקה אחת. נבדק ב-Task 7.

---

## Phase 0 — לשחרר את #122 (דורש אישור של מאור)

### Task 0: מיזוג #122 והפעלת ה-workflows

- [ ] **Step 1:** מיזוג PR #122 ל-main (מאור מאשר).
- [ ] **Step 2:** `gh workflow enable supabase-keepalive.yml && gh workflow enable "CI / Deploy"`
- [ ] **Step 3:** `gh workflow run supabase-keepalive.yml` ואז `gh run list --workflow supabase-keepalive.yml --limit 1` → `completed success`, ובלוג `HTTP 200`.
- [ ] **Step 4:** באתר החי: עריכת הוצאה, מחיקת ארוחה מהמסך הראשי, מחיקת אימון — כל אחד מתעדכן בלי רענון.

---

## Phase 1 — מספרים כספיים נכונים

### Task 1: תשתית בדיקות + בדיקות בסיס למנוע השכר

**Files:**
- Create: `vitest.config.ts`, `src/lib/payroll-engine.test.ts`
- Modify: `package.json` (script `"test": "vitest run"`)

**Interfaces:**
- Produces: `npm test` מריץ כל `src/**/*.test.ts`; alias `@/` עובד בבדיקות.

- [ ] **Step 1:** `vitest.config.ts` עם `vite-tsconfig-paths` בלבד (לא את `vite.config.ts` — יש בו PWA ו-router plugins), `environment: "node"`, `include: ["src/**/*.test.ts"]`.
- [ ] **Step 2:** בדיקות שמקבעות את ההתנהגות הקיימת (עם `DEFAULT_PAYROLL_SETTINGS`, `overtime_enabled: false` אלא אם צוין):
  - `morning shift on a weekday pays base rate` — `date: "2026-10-20"` (שלישי), 8 שעות → `basePay = 8 × 52.80 = 422.40`, `shabbatPay = 0`.
  - `saturday morning is auto-detected as shabbat` — `isShiftShabbat({date:"2026-10-24", type:"morning", is_shabbat_holiday:false}) === true`.
  - `saturday 23:00 night shift is not shabbat` — `type:"night"`, `date:"2026-10-24"` → `false`.
  - `friday night is shabbat` — `date:"2026-10-23"`, `type:"night"` → `true`.
  - `vacation and sick days pay nothing` — `calcShiftBreakdown({type:"vacation_day",...}).totalGross === 0`.
  - `12h shift with overtime splits 8/2/2` — `overtime_enabled: true`, `long_morning` ביום חול → `overtime125 > 0 && overtime150 > 0`.
- [ ] **Step 3:** `npm test` → כל הבדיקות עוברות (הן מתעדות את הקיים, לא משנות אותו).
- [ ] **Step 4:** Commit `test: add vitest and baseline payroll engine tests`.

### Task 2: הגדרה אחת ל"נטו לבנק" ולקופונים

סוגר: "נטו לבנק" מציג ₪4,313 במקום אחד ו-₪4,517 בשניים אחרים; "ברוטו חודש" כולל קופונים; הקופון מתויג "קופון נסיעות".

**Files:**
- Modify: `src/lib/payroll-engine.ts` (קבוע + פונקציה + שדות ב-`MonthlyPayslip`)
- Modify: `src/routes/_app/work.tsx` (להסיר `hasCoupon` המקומי ואת `* 68`; כל ההצגות)
- Test: `src/lib/payroll-engine.test.ts`

**Interfaces:**
- Produces: `export const COUPON_AMOUNT = 68;` · `export function hasCoupon(shift: Pick<ShiftRow,"notes">): boolean` · `MonthlyPayslip.couponCount: number` · `MonthlyPayslip.couponTotal: number`. `netPay` ו-`bankAmount` לא כוללים קופונים.

- [ ] **Step 1: בדיקות**
  - `coupon total counts meal and travel notes` — 2 משמרות עם `notes: "ארוחה +68₪"` ו-1 עם `"נסיעות +68₪"` → `couponCount === 3`, `couponTotal === 204`.
  - `coupons are not part of gross or net` — אותו חודש בלי ההערות נותן אותם `totalGross` ו-`netPay`.
  - `month with no shifts has zero coupons` — `calcMonthlyPayslip([], s)` → `couponTotal === 0`, `netPay === 0`.
  - `vacation day with a coupon note gets no coupon` — `type:"vacation_day"` → `couponCount === 0`.
- [ ] **Step 2:** `npm test` → נכשל (`hasCoupon` לא מיוצא).
- [ ] **Step 3:** מימוש ב-`payroll-engine.ts`; קופון נספר רק למשמרות שאינן ב-`NON_PAID_TYPES`.
- [ ] **Step 4:** ב-`work.tsx`: `StatsStrip` — "ברוטו" = `totalGross`, "נטו" = `netPay`; `BankTab` — פריט הפאי "קופוני ארוחה"; כרטיס "כולל קופונים" נשאר כשורת מידע; `ReportsTab` — "ברוטו חודש" = `totalGross`, "נטו לבנק" = `netPay`; תלוש ה-HTML — שורת "קופוני ארוחה (שובר נפרד)" מחוץ ל"ברוטו כולל", ו"נטו לבנק" = `netPay`. כותרת "ברוטו חודש" בראש העמוד = `totalGross`.
- [ ] **Step 5:** `npm test && npx tsc --noEmit -p .` → עובר; `grep -n "\* 68\|קופון נסיעות" src/routes/_app/work.tsx` → ריק.
- [ ] **Step 6:** Commit `fix(work): one definition of net-to-bank; meal vouchers shown separately`.

### Task 3: חודש קודם בכלכלה מחושב עד סוף החודש

סוגר: הוצאות/הכנסות קבועות נספרות לפי היום של **החודש הנוכחי** גם בחודש אחר; חובות נספרים במלואם גם בחודש עתידי.

**Files:**
- Modify: `src/lib/finance-utils.ts` (פונקציה חדשה)
- Modify: `src/hooks/use-finance-data.ts:useMonthlyFinance`
- Test: `src/lib/finance-utils.test.ts`

**Interfaces:**
- Produces: `export function accruedThroughDay(year: number, month: number, today: Date): number` — חודש עבר → מספר הימים בחודש; חודש נוכחי → `today.getDate()`; חודש עתידי → `0`.

- [ ] **Step 1: בדיקות** (`today = new Date(2026, 9, 25)`):
  - `past month counts the whole month` — `accruedThroughDay(2026, 9, today) === 30`.
  - `current month counts through today` — `accruedThroughDay(2026, 10, today) === 25`.
  - `future month counts nothing` — `accruedThroughDay(2026, 11, today) === 0`.
  - `previous year december` — `accruedThroughDay(2025, 12, today) === 31`.
- [ ] **Step 2:** `npm test` → נכשל.
- [ ] **Step 3:** מימוש; ב-`useMonthlyFinance` להחליף את `currentDay` ב-`accruedThroughDay(year, month, today)` עבור `fixedIncomeAlreadyCredited` ו-`fixedAlreadyCharged`; `totalDebtMonthly` נספר רק כש-`accruedThroughDay(...) > 0`.
- [ ] **Step 4:** `npm test && npx tsc --noEmit -p .` → עובר.
- [ ] **Step 5:** Commit `fix(finance): past months accrue fixed items for the whole month`.

### Task 4: תעריף שבת מסונכרן עם תעריף הבסיס

סוגר: "שכר שבת/שעה (150%)" = 79.2 בעוד שבסיס = 54.12 (150% = 81.18). לא משנים בשקט — מציגים אזהרה וכפתור.

**Files:**
- Modify: `src/components/work/WorkContract.tsx` (ליד שדה שבת)
- Modify: `src/lib/payroll-engine.ts` (`export function expectedShabbatRate(base: number): number` → `round2(base * 1.5)`)
- Test: `src/lib/payroll-engine.test.ts`

- [ ] **Step 1:** בדיקה `expected shabbat rate is 150% of base` — `expectedShabbatRate(54.12) === 81.18`.
- [ ] **Step 2:** מימוש + ב-WorkContract: אם `|shabbat - expectedShabbatRate(base)| > 0.01` → שורה צהובה "התעריף לא 150% מהבסיס (צפוי ₪81.18)" וכפתור "עדכן ל-150%" שממלא את השדה (השמירה נשארת בכפתור "שמור הגדרות" הקיים).
- [ ] **Step 3:** `npm test && npx tsc --noEmit -p .` → עובר. Commit `feat(work): warn when shabbat rate drifts from 150% of base`.

### Task 5: כרטיסי חופשה/מחלה מציגים ₪0

סוגר: הכרטיסים מציגים "₪493.80 ברוטו משוער" בעוד שהמנוע משלם 0.

**Files:** Modify: `src/routes/_app/work.tsx` (חישוב ה-estimate של כרטיסי `vacation_day`/`sick_day`).

- [ ] **Step 1:** ה-estimate של כרטיס נלקח מ-`calcShiftBreakdown` עם shift דמה של הכרטיס (אותו מקור כמו המשמרות בפועל) במקום חישוב מקומי; לכרטיסים שה-breakdown שלהם 0 מוצג "מעקב בלבד".
- [ ] **Step 2:** `npx tsc --noEmit -p .`; בדפדפן: כרטיס "יום חופשה" מציג "מעקב בלבד". Commit `fix(work): shift card estimates come from the payroll engine`.

### Task 6: גלגל הסכום לא דורס סכום שהוקלד

סוגר: בהוספת הוצאה הקלדתי ₪1 ונשמר ₪145; בפתיחת הטופס הגלגל דוחף ₪50 לשדה.

שורש: `AmountScrollPicker` קורא `onChange(ITEMS[localIdx])` ב-effect על כל שינוי של `localIdx` (כולל mount), ולא מסתנכרן כשהערך משתנה מבחוץ.

**Files:** Modify: `src/components/finance/AmountScrollPicker.tsx`.

- [ ] **Step 1:** להסיר את ה-effect "Notify parent whenever localIdx changes"; לקרוא `onChange` רק מ-`handleScroll` (אחרי snap), `goUp`, `goDown`.
- [ ] **Step 2:** effect על `value`: אם `value` לא null ושונה מ-`ITEMS[localIdx]` → `setLocalIdx(closestIdx(value))` + `scrollToIdx` בלי `onChange`. בזמן הסנכרון `isSnapping.current = true` כדי ש-`handleScroll` לא יחזיר ערך מעוגל.
- [ ] **Step 3:** בדפדפן: פתיחת "הוסף הוצאה" — השדה ריק (לא 50); הקלדת 1 → נשמר ₪1; גלילת הגלגל ל-₪200 → השדה מתעדכן ל-200. Commit `fix(finance): amount wheel never overwrites a typed amount`.

---

## Phase 2 — פיצ'רים שמוצגים אבל לא עובדים

### Task 7: XP באמת מוענק

סוגר: אף פעולה לא קוראת ל-`addXp`; כולם Lv.1 לנצח. `XP_VALUES` כבר מוגדר ב-`src/lib/gamification.ts`.

**Files:**
- Create: `src/lib/xp.ts`, `src/lib/xp.test.ts`
- Modify: `src/hooks/use-sport-data.ts` (`useAddWorkout`, `useAddNutrition`, `useAddWaterMl`), `src/hooks/use-work-data.ts` (`useAddShift`)

**Interfaces:**
- Produces: `export async function awardXp(userId: string, amount: number): Promise<{ newXp: number; newLevel: number }>` — קורא את `user_xp`, מוסיף, `upsert` עם `onConflict: "user_id"`. `export function nextXp(current: number, amount: number): { total: number; level: number }` (טהורה, נבדקת).
- הקריאה נעשית ב-`onSuccess` של המוטציה (פעם אחת לכל הצלחה של שרת — לחיצה כפולה שנחסמת ב-`isPending` לא מעניקה פעמיים), ואחריה `invalidateQueries(["user-xp", userId])`.

- [ ] **Step 1:** בדיקות `nextXp`: `nextXp(480, 50)` → `{ total: 530, level: 2 }`; `nextXp(0, 15)` → `{ total: 15, level: 1 }`.
- [ ] **Step 2:** מימוש + חיבור: אימון `XP_VALUES.workout_logged`, ארוחה `meal_logged`, מים `water_logged`, משמרת `shift_logged`. כשל ב-XP לא מפיל את הפעולה (try/catch + `console.warn`).
- [ ] **Step 3:** `npm test && npx tsc --noEmit -p .`; בדפדפן: הוספת ארוחה מזיזה את פס ה-XP. Commit `feat(gamification): award XP for workouts, meals, water and shifts`.

### Task 8: עוזר ה-AI רואה את הנתונים של המשתמש

סוגר: "כמה משמרות עשיתי החודש?" → "אין לי גישה". ה-edge function מתעלם מ-`context`.

**Files:** Modify: `supabase/functions/ai-chat/index.ts`.

- [ ] **Step 1:** בתוך הפונקציה (כבר יש `supabaseClient` עם ה-JWT של המשתמש, RLS חל): לשלוף לחודש הנוכחי `work_shifts` (count + שעות), `expense_entries`/`income_entries` (סכומים), `workouts` של 7 הימים האחרונים, `nutrition_entries` של היום. להוסיף לסיסטם-פרומפט בלוק "נתוני המשתמש" (מספרים בלבד).
- [ ] **Step 2:** אבטחה: לסנן הודעות לקוח ל-`role ∈ {user, assistant}` בלבד; לחתוך ל-20 הודעות אחרונות ו-2,000 תווים להודעה.
- [ ] **Step 3:** מאור מריץ `supabase functions deploy ai-chat --project-ref oglhuhnppdlekviodkjb`; בדיקה: השאלה על משמרות מחזירה מספר. Commit `feat(ai-chat): answer from the user's own data; drop client system roles`.

### Task 9: משך אימון נמדד אוטומטית

סוגר: בסיום אימון נשאל "כמה זמן?" עם 45 קבוע, למרות ש-`startedAtRef` קיים.

**Files:** Modify: `src/routes/_app/sport.tsx:2666`.

- [ ] **Step 1:** במקום `setDurationMinutes("45")`: אם `startedAtRef.current` → `clamp(round((Date.now() - startedAt) / 60000), 5, 300)`, אחרת `"45"`.
- [ ] **Step 2:** בדפדפן: התחלה → המתנה דקה → סיום מציג 5 (המינימום). Commit `fix(sport): prefill workout duration from the real start time`.

---

## Phase 3 — UX

### Task 10: סיכום אימון מציג את הסט הכבד, לא את האחרון
**Files:** `src/routes/_app/sport.tsx:~5694` (`{ex.sets}×{ex.reps}`). מציגים `sets_data` כשקיים: `3 סטים · מקס׳ 20kg×20`. Commit נפרד.

### Task 11: כפתור הרובוט לא מכסה כפתורים
**Files:** רכיב ה-FAB של `ai-chat`. מוסתר כשיש `[role=dialog]` פתוח (vaul drawer) — `MutationObserver` אחד או מצב גלובלי קיים אם יש. בדיקה: בטופס "הוסף משמרת" כפתור "תאריך אחר" לחיץ במלואו.

### Task 12: יעדי תזונה ממקור אחד
סוגר: מחשבון TDEE 2,763 מול יעד שמור 2,502; מים 2.8L מול "8 כוסות". **Files:** `src/components/settings/*` (יעדים כמותיים), מחשבון ה-TDEE ב-`nutrition.tsx`. כפתור "החל על היעדים שלי" במחשבון; "כוסות מים" נגזר `round(ml / 250)` ולא נשמר בנפרד.

### Task 13: מחיקות עקביות
`window.confirm` (עבודה, כלכלה) → דיאלוג האישור הקיים של ספורט ("מחיקת אימון") כרכיב משותף ב-`src/components/shared/ConfirmDialog.tsx`.

---

## Phase 4 — בריאות קוד

### Task 14: מחוון "אין חיבור" אמין
`src/components/shared/OfflineIndicator.tsx`: כל תשובת HTTP = מחובר (גם 401); בדיקה חוזרת כל 30 שניות כשמוצג offline; בלי URL קשיח.

### Task 15: הסרת קוד מת
`src/components/nutrition/NutritionMealCards.tsx` (לא בשימוש), בלוק `{false && ...}` ב-`sport.tsx:~3128`, `_localDateStr` הכפול ב-`use-sport-data.ts` → `localDateStr`. בדיקה: `tsc` + build.

### Task 16 (אופציונלי, אחרי הכל): פיצול `sport.tsx` (7,000 שורות)
לפי הטאבים הקיימים לקבצים ב-`src/components/sport/tabs/`. רק אם מאור רוצה — אין באג שזה פותר.

---

## סדר עבודה וענפים
- Phase 1 על `feat/app-plan-phase1` (מבוסס על `fix/critical-qa-bugs`, PR מול ה-branch הזה עד ש-#122 ממוזג).
- כל Phase = PR אחד. Task 8 דורש deploy ידני של מאור.
