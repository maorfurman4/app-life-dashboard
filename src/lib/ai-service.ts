import { supabase } from "@/integrations/supabase/client";
import { EXERCISE_LIBRARY } from "@/lib/exercise-library";

// ─── Retry Helper ─────────────────────────────────────────────────────────────

async function withRetry<T>(fn: () => Promise<T>, attempts = 3, delayMs = 1000): Promise<T> {
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === attempts - 1) throw err;
      await new Promise(r => setTimeout(r, delayMs * (i + 1)));
    }
  }
  throw new Error('Max retries exceeded');
}

export interface MealRecognitionResult {
  name: string;
  items: string[];
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  confidence: "low" | "medium" | "high";
}

async function invokeAI(payload: {
  prompt: string;
  imageBase64?: string;
  mimeType?: string;
}): Promise<string> {
  return withRetry(async () => {
    const { data, error } = await supabase.functions.invoke("ai-proxy", { body: payload });
    if (error) throw new Error(error.message);
    if (data?.error) throw new Error(data.error);
    return data?.text ?? "";
  });
}

export async function recognizeMeal(imageBase64: string): Promise<MealRecognitionResult> {
  return withRetry(async () => {
    const { data, error } = await supabase.functions.invoke("meal-recognize", {
      body: { imageBase64 },
    });
    if (error) throw new Error(error.message);
    if (data?.error) throw new Error(data.error);
    if (!data?.meal) throw new Error("לא הצלחתי לזהות ארוחה בתמונה");
    return data.meal as MealRecognitionResult;
  });
}

// ─── Workout Plan ─────────────────────────────────────────────────────────────

// ── New Types ──────────────────────────────────────────────────────────────

export interface AiExercise {
  name: string;
  sets: number;
  reps: string;
  weight_kg?: number;
  notes?: string;
  explanation?: string;   // short Hebrew sentence why this exercise was chosen
}

export interface AiDayWorkout {
  day: string;
  name: string;
  category: string;
  duration_minutes: number;
  exercises: AiExercise[];
}

export interface AiWeek {
  week_number: number;
  overload_note: string;
  workouts: AiDayWorkout[];
}

export interface WorkoutPlan {
  summary: string;
  split_type?: string;              // "PPL" | "Upper/Lower" | "Full Body"
  weeks: AiWeek[];                  // 4 weeks
  deload_week?: AiWeek;             // week 5
  tips: string[];
  // Legacy compat (old plans only had workouts array):
  workouts?: AiDayWorkout[];
}

export interface GeneratePlanPayload {
  // Existing params:
  goal: string;
  daysPerWeek: number;
  equipment: string;
  constraints: string;
  recentPRs?: { exercise_name: string; value: number; unit: string }[];
  exerciseList?: { name: string; muscles: string; equipment: string }[];
  // New params:
  age?: number;
  gender?: "male" | "female" | "other";
  fitnessLevel?: "beginner" | "intermediate" | "advanced";
  sessionMinutes?: number;
  intensity?: 1 | 2 | 3 | 4 | 5;
  cardioType?: string;     // e.g. "ריצה, HIIT"
  cardioDays?: number;     // 0 = no cardio, 1-2 = N cardio days (included in daysPerWeek)
  preferredMuscles?: string[];
  avoidedMuscles?: string[];
  favoriteExercises?: string[];
  blacklistedExercises?: string[];
  recentWorkouts?: { name: string; date: string; exercises: string[] }[];
  // AI Planner v3 params:
  planWeeks?: number;           // 1-4 weeks
  equipmentList?: string[];     // toggled equipment chips
  // AI Planner v4 params:
  splitType?: string;           // "Full Body" | "Upper-Lower" | "A-B" | "A-B-C" | "Push-Pull-Legs"
  restBetweenSets?: number;     // seconds: 30, 60, 90, 120
  cardioFitnessLevel?: string;  // "מתחיל" | "בינוני" | "מתקדם" | "חוזר אחרי הפסקה"
  lastRunData?: { distanceKm?: number; paceMinPerKm?: number };
  availableExercises?: Array<{ name: string; equipment: string[]; muscleGroups: string[]; primaryMuscle: string }>;
  // AI Planner v5 params:
  goalType?: string;            // e.g. "עלייה במסת שריר 💪"
  strengthLevel?: string;       // "מתחיל — פחות משנה" | "בינוני — 1–3 שנים" | "מתקדם — 3+ שנים"
  preferredCardioType?: string; // "ריצה 🏃" | "אופניים 🚴" | "חתירה 🚣" | "HIIT 🔥" etc.
}

export async function generateWorkoutPlan(payload: GeneratePlanPayload): Promise<WorkoutPlan> {
  // Build filtered exercise list based on selected equipment
  const equipmentArr = payload.equipmentList ?? [];
  const availableExercises = EXERCISE_LIBRARY
    .filter((ex) => {
      if (equipmentArr.length === 0) return true;
      if (ex.equipment.length === 0) return true; // bodyweight always available
      return ex.equipment.some((eq) =>
        equipmentArr.some((ue) => {
          const uClean = ue.replace(/\s*[🏋️💪🤸🚣🌀⚽🔔🤲🔩🔗🦵🏃🦋🏗️🔄]/g, "").trim();
          return eq.includes(uClean) || uClean.includes(eq);
        })
      );
    })
    .slice(0, 70)
    .map((ex) => ({
      name: ex.name,
      equipment: ex.equipment,
      muscleGroups: ex.muscleGroups as string[],
      primaryMuscle: ex.primaryMuscle as string,
    }));

  const body = {
    ...payload,
    // Normalize equipment list for Edge Function
    ...(payload.equipmentList && payload.equipmentList.length > 0
      ? { equipmentItems: payload.equipmentList }
      : {}),
    availableExercises,
  };
  return withRetry(async () => {
    const { data, error } = await supabase.functions.invoke("workout-plan-ai", { body });
    if (error) throw new Error(error.message);
    if (data?.error) throw new Error(data.error);
    if (!data?.plan) throw new Error("לא התקבלה תוכנית");
    return data.plan as WorkoutPlan;
  });
}

// Helper: get all exercises from week 1 (for backward compat display)
export function getPlanWeek1Workouts(plan: WorkoutPlan): AiDayWorkout[] {
  if (plan.weeks && plan.weeks.length > 0) {
    return plan.weeks[0].workouts;
  }
  return plan.workouts ?? [];
}

// ─── Generic (for free-form text components) ─────────────────────────────────

export async function analyzeImage(
  base64Image: string,
  mimeType: string,
  prompt: string
): Promise<string> {
  return invokeAI({ prompt, imageBase64: base64Image, mimeType });
}

export async function generateText(prompt: string): Promise<string> {
  return invokeAI({ prompt });
}

// JSON parse helper — strips markdown fences from OpenAI responses, extracts first JSON object/array
export function parseAIJson<T>(raw: string): T {
  let clean = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/g, "")
    .trim();

  const objStart  = clean.indexOf("{");
  const arrStart  = clean.indexOf("[");
  const jsonStart =
    objStart === -1 ? arrStart
    : arrStart === -1 ? objStart
    : Math.min(objStart, arrStart);

  if (jsonStart > 0) clean = clean.slice(jsonStart);

  const lastBrace   = clean.lastIndexOf("}");
  const lastBracket = clean.lastIndexOf("]");
  const jsonEnd     = Math.max(lastBrace, lastBracket);
  if (jsonEnd !== -1 && jsonEnd < clean.length - 1) clean = clean.slice(0, jsonEnd + 1);

  try {
    return JSON.parse(clean) as T;
  } catch {
    throw new Error(`AI returned invalid JSON. Raw response: ${raw.slice(0, 200)}`);
  }
}
