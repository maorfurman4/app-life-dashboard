import { localDateStr } from "@/utils/date";
import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect, useMemo } from "react";
import {
  Dumbbell, Play, CheckCircle2, Trophy, Flame, Clock,
  Target, Zap, ChevronRight, ChevronLeft, Plus, RotateCcw, Minus,
  ChevronDown, ChevronUp, Loader2, Star, X, BookOpen,
  TrendingUp, Scale, Medal, BarChart3, Camera,
  Pencil, Check, Trash2, Heart, EyeOff, Eye,
  Share2, MapPin, Timer, Download, Settings2, Youtube, Search, Layers, Info, BrainCircuit,
} from "lucide-react";
import {
  usePersonalRecords, useAddPersonalRecord,
  useWorkoutTemplates, useAddWorkoutTemplate, useDeleteWorkoutTemplate, useUpdateWorkoutTemplate,
  useWeekWorkouts, useAddWorkout, useWorkoutStreak, useWorkoutHistory,
  useDeleteWorkout, useUpdateWorkout,
  useWeightEntries, useAddWeight, useDeleteWeight, useUpdateWeight,
  useUserSettings, useUpdateUserSettings,
  useRunHistory, useBodyProgress, useAddBodyProgress, useDeleteBodyProgress,
  useUpdatePersonalRecord, useDeletePersonalRecord, useWeeklyVolume,
} from "@/hooks/use-sport-data";
import { generateWorkoutPlan, type WorkoutPlan } from "@/lib/ai-service";
import { useUserFitnessProfile, useUpdateFitnessProfile, useSaveWorkoutPlan, useWorkoutPlans, useDeleteWorkoutPlan } from "@/hooks/useAiPlanner";
import {
  CARDIO_SPORTS, INTENSITY_LABELS,
  calcCardioCalories,
  type Intensity,
} from "@/utils/calorieCalculator";
import { toast } from "sonner";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  BarChart, Bar, Cell,
} from "recharts";
import { useQueryClient } from "@tanstack/react-query";
import exerciseImageUrlsJson from "@/data/exercise-image-urls.json";
import GymMachineIdentifier from "@/components/sport/GymMachineIdentifier";
import SportWelcomeVideo from "@/components/sport/SportWelcomeVideo";
import { SportAIConsultant } from "@/components/sport/SportAIConsultant";
import { HealthImport } from "@/components/sport/HealthImport";
import { SportAIPlanner } from "@/components/sport/SportAIPlanner";

export const Route = createFileRoute("/_app/sport")({
  component: SportPage,
});

// ─── types ───────────────────────────────────────────────────────────────────
type Tab = "dashboard" | "builder" | "library" | "running" | "progress" | "import";

const TABS: { key: Tab; label: string }[] = [
  { key: "dashboard", label: "בית"        },
  { key: "builder",   label: "אימונים"    },
  { key: "library",   label: "ספרייה"     },
  { key: "running",   label: "🏅 אירובי"  },
  { key: "progress",  label: "התקדמות"    },
  { key: "import",    label: "ייבוא בריאות" },
];

// ─── Quick-Add workout definitions ───────────────────────────────────────────
const QUICK_WORKOUTS = [
  { key: "strength",  label: "כוח",            dbCategory: "weights"      as const, emoji: "🏋️", color: "#10b981", image: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=400&q=80", durations: [45, 60, 75] },
  { key: "hiit",      label: "HIIT",           dbCategory: "mixed"        as const, emoji: "⚡", color: "#eab308", image: "https://images.unsplash.com/photo-1601422407692-ec4eeec1d9b3?w=400&q=80", durations: [15, 20, 30] },
  { key: "chest",     label: "חזה / כתפיים",  dbCategory: "weights"      as const, emoji: "💪", color: "#3b82f6", image: "https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?w=400&q=80", durations: [45, 60, 75] },
  { key: "back",      label: "גב / מתח",      dbCategory: "weights"      as const, emoji: "🦾", color: "#8b5cf6", image: "https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?w=400&q=80", durations: [45, 60, 75] },
  { key: "legs",      label: "רגליים",         dbCategory: "weights"      as const, emoji: "🦵", color: "#ec4899", image: "https://images.unsplash.com/photo-1574680096145-d05b474e2155?w=400&q=80", durations: [50, 60, 80] },
  { key: "core",      label: "ליבה / בטן",    dbCategory: "mixed"        as const, emoji: "🎯", color: "#06b6d4", image: "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=400&q=80", durations: [15, 25, 40] },
  { key: "yoga",      label: "יוגה / גמישות", dbCategory: "calisthenics" as const, emoji: "🧘", color: "#a78bfa", image: "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=400&q=80", durations: [20, 45, 60] },
];

// ─── Exercise Library data ────────────────────────────────────────────────────
interface LibraryExercise {
  name: string;
  muscles: string;
  tips: string[];
  defaultSets: number;
  defaultReps: string;
  equipment: string;
  youtubeQuery: string;
}
interface SubMuscleGroup {
  key: string;
  label: string;
  emoji: string;
  exerciseNames: string[];
}
interface MuscleGroup {
  key: string;
  label: string;
  emoji: string;
  color: string;
  exercises: LibraryExercise[];
  subGroups?: SubMuscleGroup[];
}

const MUSCLE_GROUPS: MuscleGroup[] = [
  {
    key: "chest", label: "חזה", emoji: "💪", color: "#3b82f6",
    subGroups: [
      { key: "chest_upper", label: "חזה עליון",  emoji: "⬆️", exerciseNames: ["לחיצת דמבלים משופעת","לחיצת מוט משופעת","פרפר משופע","Cable Fly מלמטה","Dumbbell Pullover","Incline Cable Fly","Landmine Press חזה","Low to High Cable Fly","לחיצת מוט משופעת (Incline Barbell)","פרפר דמבלים משופע","כבל נמוך-לגבוה (Low-to-High)","Incline Smith Machine Press","Squeeze Press משופע","Hammer Strength Incline Press","כבל חד-צדדי משופע","DB Pullover (Lat-Chest)","High-Incline 75° DB Press","Reverse Grip Bench Press","Cable Upper Chest Fly","Cable Chest Pullover","Machine Incline Press"] },
      { key: "chest_mid",   label: "חזה אמצעי",  emoji: "🎯", exerciseNames: ["לחיצת חזה שכיבה","שכיבות סמיכה","פרפר (Fly)","לחיצת חזה במכונה","קרוסאובר (כבלים)","Pec Deck מכונה","Squeeze Press","Cable Crossover רחב","High to Low Cable Fly","Cable Fly אמצעי","Single Arm Cable Fly","Cable Chest Press עמידה","Cable Squeeze חזה","Cable Fly Neutral Grip","Cable Crossover Neutral","Pause Bench Press","Flat Dumbbell Fly","Cable Crossover אמצע","Neutral Grip DB Press","Squeeze Press שטוח","Wide Grip Bench Press","Close Grip Bench Press","Cable Fly מקביל לחזה"] },
      { key: "chest_lower", label: "חזה תחתון",  emoji: "⬇️", exerciseNames: ["לחיצת דמבלים ירידה","מקבילים לחזה","שכיבות ירידה","Cable Fly מגבוה","High to Low Cable Fly","High-to-Low Cable Fly","לחיצת מוט שיפוע שלילי","לחיצת דמבלים שיפוע שלילי","Decline Dumbbell Fly","Chest Dips מקבילים","Decline Smith Machine Press","Hammer Strength Decline","Cable Crossover תחתון","Weighted Decline Push-up"] },
    ],
    exercises: [
      { name: "לחיצת חזה שכיבה", muscles: "חזה, כתפיים קדמיות, טריצפס", tips: ["שמור על גב שטוח", "הורד לאיטיות — 3 שניות", "נשוף בלחיצה"], defaultSets: 4, defaultReps: "8-10", equipment: "מוט", youtubeQuery: "bench+press+form+tutorial" },
      { name: "פרפר (Fly)", muscles: "חזה פנימי וחיצוני", tips: ["קשת עדינה במרפקים", "מרגיש מתיחה בפתיחה", "אל תכניס עמוד שדרה"], defaultSets: 3, defaultReps: "12", equipment: "דמבלים", youtubeQuery: "dumbbell+fly+chest+form" },
      { name: "שכיבות סמיכה", muscles: "חזה, טריצפס, ליבה", tips: ["גוף ישר כמו קרש", "מרפקים 45° לגוף", "ירידה עד הרצפה"], defaultSets: 3, defaultReps: "12-15", equipment: "ללא", youtubeQuery: "push+up+perfect+form" },
      { name: "לחיצת חזה במכונה", muscles: "חזה, כתפיים קדמיות", tips: ["כוונן את הגובה לחזה", "אל תחסום המרפק בסוף", "בקרה בחזרה"], defaultSets: 3, defaultReps: "10-12", equipment: "מכונה", youtubeQuery: "chest+press+machine+form" },
      { name: "קרוסאובר (כבלים)", muscles: "חזה פנימי, חלק תחתון", tips: ["צלב את הידיים בסיום", "גב ישר, לא כפוף", "קנה מידה שלם"], defaultSets: 3, defaultReps: "12-15", equipment: "כבלים", youtubeQuery: "cable+crossover+chest+form" },
    ],
  },
  {
    key: "back", label: "גב", emoji: "🦾", color: "#8b5cf6",
    subGroups: [
      { key: "back_lats",  label: "רחב גבי",  emoji: "⬆️", exerciseNames: ["מתח (Pull-up)","לט פולדאון","Lat Pulldown רחב","Lat Pulldown צר","Straight Arm Pulldown","Neutral Grip Lat Pulldown","Single Arm Lat Pulldown","Lat Pulldown אחיזה הפוכה","Machine Pullover","Cable Pullover גב","Cable Pullover (גב)","Assisted Pull-up Machine","Hammer Strength Lat Pull","Reverse Grip Lat Pulldown","Rope Pulldown","Unilateral Lat Pulldown","Hammer Strength Pulldown","Kneeling Lat Pulldown","One Arm Machine Pulldown","Incline DB Row (Lat Focus)","Prone Incline Cable Row","Cable Straight Arm Row"] },
      { key: "back_traps", label: "טרפזים",   emoji: "🔄", exerciseNames: ["חתירה (Barbell Row)","חתירה כבלים ישיבה","T-Bar Row","Single Arm Dumbbell Row","Chest Supported Row","Meadows Row","Seal Row","Renegade Row","Pendlay Row","Kroc Row","Hammer Strength Row","Unilateral Cable Row","High Cable Row","Wide Grip Cable Row","Reverse Grip Cable Row","Underhand Cable Row","Machine Seated Row","Machine High Row","Barbell Row אחיזה רחבה","Yates Row","T-Bar Row רחב","DB Row כבד (Kroc Row)","Seated Cable Row רחב","Chest Supported DB Row","Single Arm Cable Row","Cross Body Cable Row","Chest Supported Machine Row","Low Seated Cable Row"] },
      { key: "back_lower", label: "גב תחתון", emoji: "⬇️", exerciseNames: ["דדליפט","Rack Pull","Back Extension","Good Morning","Hyperextension מכונה","Cable Lower Back Ext","Back Extension עם משקל","Cable Pull-Through (גב)","Deficit Deadlift"] },
    ],
    exercises: [
      { name: "מתח (Pull-up)", muscles: "גב רחב, ביצפס, ליבה", tips: ["תלייה מלאה בתחתית", "הוצא חזה אל הבר", "אל תתנועע"], defaultSets: 4, defaultReps: "6-10", equipment: "מוט מתח", youtubeQuery: "pull+up+perfect+form" },
      { name: "חתירה (Barbell Row)", muscles: "גב אמצע, ביצפס, כתף אחורית", tips: ["גב ישר 45°", "משוך לבטן", "אל ת'שדרה עגול"], defaultSets: 4, defaultReps: "8-10", equipment: "מוט", youtubeQuery: "barbell+row+form+tutorial" },
      { name: "חתירה כבלים ישיבה", muscles: "גב אמצע, ליפ, ביצפס", tips: ["שב זקוף", "משוך לבטן תחתונה", "אל תתנועע"], defaultSets: 3, defaultReps: "12", equipment: "כבלים", youtubeQuery: "seated+cable+row+form" },
      { name: "לט פולדאון", muscles: "גב רחב, ביצפס", tips: ["אל תמשוך מאחורי הראש", "הישען קצת אחורה", "הוצא חזה"], defaultSets: 3, defaultReps: "10-12", equipment: "מכונה", youtubeQuery: "lat+pulldown+form+tutorial" },
      { name: "דדליפט", muscles: "גב תחתון, רגליים, ישבן, כל הגוף", tips: ["ברים קרוב לגוף", "גב ישר — חיוני!", "לחץ עקבים ברצפה"], defaultSets: 4, defaultReps: "5-6", equipment: "מוט", youtubeQuery: "deadlift+perfect+form+beginners" },
    ],
  },
  {
    key: "shoulders", label: "כתפיים", emoji: "🏋️", color: "#f97316",
    subGroups: [
      { key: "sh_front", label: "כתף קדמית",  emoji: "🔵", exerciseNames: ["לחיצת כתפיים (OHP)","הרמות קדמיות (Front Raise)","Arnold Press","לחיצת כתפיים בישיבה","Cuban Press","Cable Front Raise","Cross Body Cable Raise","Machine Shoulder Press","Smith Machine OHP","Machine Front Raise","Plate Front Raise","Cable Single Arm Front Raise","Half-Kneeling Cable Press","Barbell OHP (Overhead Press)","Seated DB OHP","הרמות קדמיות דמבלים","הרמות קדמיות כבל","הרמות קדמיות מוט","Z-Press","Landmine Press כתפיים","Standing DB OHP"] },
      { key: "sh_mid",   label: "כתף אמצעית", emoji: "⚡", exerciseNames: ["הרמות צד (Lateral Raise)","Lateral Raise כבלים","Machine Lateral Raise","Upright Row","Shrug — כיווץ כתפיים","Cable Upright Row","Single Arm Cable Lateral","Lying Cable Lateral Raise","Leaning Cable Lateral","Cable Y-Raise","Cable Behind-Back Lateral","Cable Rope Upright Row","הרמות צד דמבלים","הרמות צד ישיבה","הרמות צד כבל","Leaning Lateral Raise","Upright Row מוט","Upright Row כבל","Upright Row דמבלים","45° Incline Lateral Raise","One Arm Cable Lateral","Barbell Shrug","DB Shrug"] },
      { key: "sh_rear",  label: "כתף אחורית", emoji: "🔙", exerciseNames: ["Face Pull","Rear Delt Fly דמבלים","Cable Rear Delt Fly","Band Pull-Apart","Rope Face Pull מתקדם","High Cable Rear Delt Fly","Low Cable Rear Delt","Cable External Rotation","Cable Internal Rotation","Machine Rear Delt Fly","Rear Delt Fly DB","Pec Deck Reverse","Face Pull כבל","Prone Incline Rear Delt Fly","Machine Rear Delt","Bent Over Lateral Raise","Dumbbell Rear Delt Row","Cable W-Raise","Cable Rope Face Pull"] },
    ],
    exercises: [
      { name: "לחיצת כתפיים (OHP)", muscles: "דלטואיד קדמי ואמצע, טריצפס", tips: ["עמוד יציב", "נסגר בראש", "אל תרכין גב"], defaultSets: 4, defaultReps: "8-10", equipment: "מוט / דמבלים", youtubeQuery: "overhead+press+form+tutorial" },
      { name: "הרמות צד (Lateral Raise)", muscles: "דלטואיד אמצעי", tips: ["קצת קדימה — לא בצד מוחלט", "מרפק קצת כפוף", "הורד לאיטיות"], defaultSets: 3, defaultReps: "12-15", equipment: "דמבלים", youtubeQuery: "lateral+raise+form+tutorial" },
      { name: "הרמות קדמיות (Front Raise)", muscles: "דלטואיד קדמי", tips: ["לא מעל גובה הכתף", "בקרה בחזרה", "גו ישר"], defaultSets: 3, defaultReps: "12", equipment: "דמבלים", youtubeQuery: "front+raise+form" },
      { name: "Face Pull", muscles: "דלטואיד אחורי, שרוול מסובב", tips: ["כיוון כבל לגובה עיניים", "פרוס כ-W בסיום", "תנועה מבוקרת"], defaultSets: 3, defaultReps: "15-20", equipment: "כבלים", youtubeQuery: "face+pull+form+tutorial" },
    ],
  },
  {
    key: "arms", label: "ידיים", emoji: "💪", color: "#ec4899",
    subGroups: [
      { key: "arms_bi",   label: "יד קדמית",  emoji: "💪", exerciseNames: ["כפיפות מרפק (Bicep Curl)","Hammer Curl","Preacher Curl","Incline Dumbbell Curl","Concentration Curl","Spider Curl","Cable Curl","Hammer Curl כבלים","Cable Concentration Curl","Rope Hammer Curl","High Cable Curl","Low Cable Curl","Cable 21s ביצפס","Unilateral Cable Curl","Machine Preacher Curl","EZ Bar Curl","Barbell Preacher Curl","Cable Spider Curl","Zottman Curl","Cable Drag Curl","Barbell Curl","Incline DB Curl","Preacher Curl EZ","Preacher Curl Machine","Cross Body Hammer Curl","Cable Curl בר","Cable Curl חבל","Machine Curl","21s Curl"] },
      { key: "arms_tri",  label: "יד אחורית", emoji: "💎", exerciseNames: ["פשיטת מרפק (Tricep Extension)","מקבילים (Dips)","Skull Crusher","Close Grip Bench","Overhead Tricep Extension","Tricep Pushdown V-Bar","Tricep Kickback","Rope Pushdown","Reverse Grip Pushdown","Single Arm Pushdown","Overhead Cable Ext Rope","Single Arm Cable Overhead","Cable Kickback","Rope Overhead Ext","Cable Bar Pushdown","Machine Tricep Ext","Tricep Dip Machine","JM Press","Tate Press","Board Press","Cable Long Head Ext","Skull Crusher מוט","Skull Crusher EZ","Tricep Pushdown חבל","Tricep Pushdown בר","Overhead Tricep Ext DB","Overhead Tricep Ext כבל","Lying DB Tricep Extension","Weighted Dips"] },
      { key: "arms_fore", label: "אמות",       emoji: "🦾", exerciseNames: ["Reverse Curl","Wrist Curl","Reverse Cable Curl","Reverse Curl מוט","Reverse Curl EZ","Wrist Curl מוט","Wrist Curl DB","Reverse Wrist Curl","Farmer's Walk","Plate Pinch"] },
    ],
    exercises: [
      { name: "כפיפות מרפק (Bicep Curl)", muscles: "ביצפס, ברכיאליס", tips: ["אל תנופף", "סיום מלא בפסגה", "בקרה בירידה"], defaultSets: 3, defaultReps: "10-12", equipment: "דמבלים / מוט", youtubeQuery: "bicep+curl+form+tutorial" },
      { name: "פשיטת מרפק (Tricep Extension)", muscles: "טריצפס", tips: ["מרפקים קרוב לראש", "נעל מרפקים", "הרחב עד סוף"], defaultSets: 3, defaultReps: "12", equipment: "דמבלים", youtubeQuery: "tricep+extension+form" },
      { name: "מקבילים (Dips)", muscles: "טריצפס, חזה תחתון", tips: ["קצת קדימה לחזה", "ישר לטריצפס", "אל תנמיך מדי"], defaultSets: 3, defaultReps: "10-12", equipment: "מקבילים", youtubeQuery: "tricep+dips+form+tutorial" },
      { name: "Hammer Curl", muscles: "ברכיאליס, ביצפס", tips: ["אחיזה ניטרלית — כפות ידיים פנים מול פנים", "ללא נופף", "זוהי תנועה מלאה"], defaultSets: 3, defaultReps: "10-12", equipment: "דמבלים", youtubeQuery: "hammer+curl+form" },
    ],
  },
  {
    key: "legs", label: "רגליים", emoji: "🦵", color: "#eab308",
    subGroups: [
      { key: "legs_quads",  label: "ארבע ראשי", emoji: "🦵", exerciseNames: ["סקוואט (Squat)","לאנג' (Lunges)","לג פרס (Leg Press)","Hack Squat מכונה","Leg Extension","Goblet Squat","Step Up לספסל","Sumo Squat","Hip Adduction מכונה","Hip Abduction מכונה","Bulgarian Split Squat","Smith Machine Squat","Cable Hip Flexion","Smith Machine Lunge","Back Squat","Front Squat","Leg Extension מכונה","Leg Press רגלים גבוהות","Leg Press רגלים נמוכות","Bulgarian Split Squat DB","Heel Elevated Squat","Box Squat","Pause Squat","Step Up משקל","Sissy Squat מכונה"] },
      { key: "legs_hams",   label: "האמסטרינג", emoji: "🏃", exerciseNames: ["כפיפות ברכיים (Hamstring Curl)","Romanian Deadlift","Nordic Hamstring Curl","Good Morning רגליים","Lying Leg Curl","Cable Romanian DL","Standing Leg Curl","Seated Leg Curl","Romanian Deadlift DB","Single Leg RDL","Glute Ham Raise","Stiff Leg Deadlift","Kneeling Leg Curl","Cable Leg Curl עמידה","Good Morning מוט"] },
      { key: "legs_glutes", label: "ישבן",       emoji: "🍑", exerciseNames: ["Hip Thrust","Glute Bridge","Donkey Kicks","Cable Pull-Through","Machine Glute Kickback","Hip Thrust מוט","Hip Thrust מכונה","Single Leg Glute Bridge","Cable Glute Kickback","Donkey Kick Machine","Sumo Squat DB","Clamshell + לולאה"] },
      { key: "legs_calves", label: "תאומים",     emoji: "👟", exerciseNames: ["הרמות עקב (Calf Raise)","Seated Calf Raise","Standing Calf Raise מכונה","Seated Calf Raise מכונה","Leg Press Calf Raise","Single Leg Calf Raise DB","Donkey Calf Raise","Tibialis Raise"] },
    ],
    exercises: [
      { name: "סקוואט (Squat)", muscles: "קוואדריצפס, ישבן, גב תחתון", tips: ["ברכיים מעל אצבעות", "ירד עד מקביל לפחות", "גב ישר — חובה"], defaultSets: 4, defaultReps: "8-10", equipment: "מוט", youtubeQuery: "squat+form+tutorial+beginners" },
      { name: "לאנג' (Lunges)", muscles: "קוואדריצפס, ישבן, המסטרינג", tips: ["ברך קדמית לא תחצה את האצבע", "פסיעה ארוכה", "גב ישר"], defaultSets: 3, defaultReps: "10 כל צד", equipment: "דמבלים / ללא", youtubeQuery: "lunges+form+tutorial" },
      { name: "לג פרס (Leg Press)", muscles: "קוואדריצפס, ישבן, המסטרינג", tips: ["רגליים בגובה אמצע הלוח", "אל תחסום ברך", "גב מלא ללוח"], defaultSets: 4, defaultReps: "10-12", equipment: "מכונה", youtubeQuery: "leg+press+form+tutorial" },
      { name: "כפיפות ברכיים (Hamstring Curl)", muscles: "המסטרינג", tips: ["כפות רגליים מורמות", "תנועה מלאה", "הורד לאיטיות"], defaultSets: 3, defaultReps: "12", equipment: "מכונה", youtubeQuery: "hamstring+curl+form" },
      { name: "הרמות עקב (Calf Raise)", muscles: "שוקיים (Gastrocnemius, Soleus)", tips: ["מלוא הטווח — עלה עד הקצה", "החזק שנייה בפסגה", "הורד לאיטיות"], defaultSets: 4, defaultReps: "15-20", equipment: "ללא / מכונה", youtubeQuery: "calf+raise+form" },
    ],
  },
  {
    key: "core", label: "ליבה", emoji: "🎯", color: "#06b6d4",
    subGroups: [
      { key: "core_straight", label: "בטן ישרה", emoji: "🎯", exerciseNames: ["סיט אפ (Sit-up)","ברכיים לחזה (Knee Tucks)","פלנק (Plank)","Dead Bug","Cable Crunch","Dragon Flag","Ab Wheel Rollout","Hanging Leg Raise","V-Up","Hollow Crunch","Cable Crunch ברכיים","Machine Crunch","Dragon Flag ספסל","Decline Crunch","Hanging Leg Raise ישר","Medicine Ball Slam","Stability Ball Crunch","TRX Jackknife","Decline Sit-up","High Cable Crunch עמידה","Hollow Body Rock","Reverse Crunch משוקל","Ab Wheel Standing","Barbell Rollout"] },
      { key: "core_obliques", label: "אלכסונים", emoji: "🔄", exerciseNames: ["רוסיאן טוויסט","Woodchop (גרזן)","Pallof Press","Side Plank","Landmine Rotation","Cable Oblique Crunch","Standing Cable Lift","Cable Anti-Rotation Hold","Kneeling Cable Oblique","Woodchop גבוה-נמוך","Woodchop נמוך-גבוה","Pallof Press עמידה","Pallof Press ברכיים","Side Bend DB","Russian Twist משקל","Cable Side Crunch","Rotational Med Ball Throw","Side Plank + DB"] },
    ],
    exercises: [
      { name: "פלנק (Plank)", muscles: "ליבה, כתפיים, ישבן", tips: ["גוף קרש ישר", "אל תרים ישבן", "נשום בשלווה"], defaultSets: 3, defaultReps: "45-60 שניות", equipment: "ללא", youtubeQuery: "plank+form+tutorial" },
      { name: "סיט אפ (Sit-up)", muscles: "בטן עליונה, Hip Flexors", tips: ["אל תמשוך צוואר", "הורד לאיטיות", "מרפקים בצד"], defaultSets: 3, defaultReps: "20", equipment: "ללא", youtubeQuery: "proper+situp+form" },
      { name: "רוסיאן טוויסט", muscles: "אלכסוני, בטן", tips: ["רגליים מורמות = קשה יותר", "סובב עד המקצה", "בקרה בתנועה"], defaultSets: 3, defaultReps: "20 כל צד", equipment: "ללא / משקולת", youtubeQuery: "russian+twist+form" },
      { name: "ברכיים לחזה (Knee Tucks)", muscles: "בטן תחתונה", tips: ["גוף ישר בנקודת פתיחה", "קרב ברכיים לחזה", "הורד שלוט"], defaultSets: 3, defaultReps: "15", equipment: "ללא", youtubeQuery: "knee+tucks+abs+form" },
      { name: "Dead Bug", muscles: "ליבה עמוק, גב תחתון", tips: ["גב תחתון צמוד לרצפה", "תנועה מנוגדת — יד ורגל", "נשום החוצה"], defaultSets: 3, defaultReps: "10 כל צד", equipment: "ללא", youtubeQuery: "dead+bug+exercise+form" },
    ],
  },
];

const CALISTHENICS_MUSCLE_GROUPS: MuscleGroup[] = [
  {
    key: "chest", label: "חזה", emoji: "💪", color: "#3b82f6",
    subGroups: [
      { key: "chest_bw_mid",      label: "שכיבות בסיסיות", emoji: "🤸", exerciseNames: ["שכיבות סמיכה","שכיבות יהלום","שכיבות רחבות","Spiderman Push-up","Hindu Push-up","Dive Bomber Push-up","שכיבות עם עצירה (Pause Push-up)","Walking Push-up","Staggered Push-up"] },
      { key: "chest_bw_upper",    label: "חזה עליון",       emoji: "⬆️", exerciseNames: ["שכיבות פייק","Pseudo Planche Push-up","שכיבות ירידה (Decline Push-up)","Pike Fly Push-up"] },
      { key: "chest_bw_lower",    label: "חזה תחתון",       emoji: "⬇️", exerciseNames: ["Korean Dip","שכיבות עלייה (Incline Push-up)"] },
      { key: "chest_bw_advanced", label: "מתקדמות",         emoji: "🔥", exerciseNames: ["שכיבות ארצ'ר","Typewriter Push-up","Archer Push-up מתקדם","Tuck Planche","Straddle Planche","Planche Push-up (Tuck)","Superman Push-up","Wide Clap Push-up","Straddle Planche Push-up","שכיבת יד אחת (One-Arm Push-up)","שכיבות מחיאת כף (Clap Push-up)","Tiger Bend Push-up","Assisted One-Arm Push-up"] },
      { key: "chest_rings",       label: "טבעות",           emoji: "⭕", exerciseNames: ["Ring Push-up","Ring Fly","Ring Dip","Ring Push-up Lean","Ring Support Hold","Ring Push-up Narrow","Ring Chest Fly Hold","Ring Push-up Lean Wide"] },
    ],
    exercises: [
      { name: "שכיבות סמיכה", muscles: "חזה, טריצפס, ליבה", tips: ["גוף קרש ישר", "מרפקים 45° מהגוף", "ירידה עד הרצפה"], defaultSets: 4, defaultReps: "12-15", equipment: "ללא", youtubeQuery: "push+up+perfect+form" },
      { name: "שכיבות יהלום", muscles: "טריצפס, חזה פנימי", tips: ["ידיים בצורת יהלום מתחת לחזה", "מרפקים צמודים לגוף", "גוף ישר"], defaultSets: 3, defaultReps: "8-12", equipment: "ללא", youtubeQuery: "diamond+push+up+form" },
      { name: "שכיבות רחבות", muscles: "חזה חיצוני, כתפיים", tips: ["ידיים רחבות מהכתפיים", "ירידה עמוקה", "בקרה בעלייה"], defaultSets: 3, defaultReps: "12-15", equipment: "ללא", youtubeQuery: "wide+push+up+form" },
      { name: "שכיבות ארצ'ר", muscles: "חזה, טריצפס, כתפיים", tips: ["הרחב יד אחת לצד", "שמור על יד ישרה", "מתקדמות לשכיבת יד אחת"], defaultSets: 3, defaultReps: "6-8 כל צד", equipment: "ללא", youtubeQuery: "archer+push+up+form" },
      { name: "שכיבות פייק", muscles: "כתפיים, טריצפס, חזה עליון", tips: ["ישבן גבוה בצורת V", "ירידה לכיוון הראש", "הכנה להנדסטנד"], defaultSets: 3, defaultReps: "10-12", equipment: "ללא", youtubeQuery: "pike+push+up+form" },
    ],
  },
  {
    key: "back", label: "גב", emoji: "🦾", color: "#8b5cf6",
    subGroups: [
      { key: "back_bw_pullup",   label: "מתח",      emoji: "⬆️", exerciseNames: ["מתח (Pull-up)","מתח אחיזה הפוכה (Chin-up)","L-Sit Pull-up","Wide Grip Pull-up","Commando Pull-up","Scapula Pull-up","Passive Hang","Active Hang","Negative Pull-up איטי","Jumping Pull-up","Hollow Body Pull-up","Narrow Grip Pull-up","Hanging Scapular Retraction"] },
      { key: "back_bw_row",      label: "חתירות",   emoji: "🔄", exerciseNames: ["מתח אוסטרלי (Row)","Pike Row","Bat Wing Row Hold"] },
      { key: "back_bw_advanced", label: "מתקדמות",  emoji: "🔥", exerciseNames: ["Muscle-Up (עליות כוח)","Tuck Front Lever","Straddle Front Lever","Full Front Lever","Front Lever Row","Front Lever Pull-up","Typewriter Pull-up","Archer Pull-up","Explosive Pull-up","One Arm Pull-up Neg","Negative Muscle-Up","Stacked Grip Pull-up","Tuck Front Lever Raises","Front Lever Raises (Full)","Tuck Back Lever Raises","Half Muscle-Up Hold"] },
      { key: "back_rings",       label: "טבעות",    emoji: "⭕", exerciseNames: ["Ring Muscle-Up","Tuck Back Lever","Full Back Lever","Skin the Cat","Ring Row","Ring Pull-up","Ring Inverted Row","One-Arm Ring Row","Ring Tuck Row","Ring Face Pull","Muscle-Up Transition Hold"] },
    ],
    exercises: [
      { name: "מתח (Pull-up)", muscles: "גב רחב, ביצפס, ליבה", tips: ["תלייה מלאה בתחתית", "הוצא חזה אל הבר", "אל תתנועע"], defaultSets: 4, defaultReps: "5-10", equipment: "מוט מתח", youtubeQuery: "pull+up+perfect+form" },
      { name: "מתח אחיזה הפוכה (Chin-up)", muscles: "ביצפס, גב רחב", tips: ["כפות ידיים כלפיך", "משוך מרפקים לצלעות", "תלייה מלאה"], defaultSets: 3, defaultReps: "5-8", equipment: "מוט מתח", youtubeQuery: "chin+up+form+tutorial" },
      { name: "מתח אוסטרלי (Row)", muscles: "גב אמצע, ביצפס, כתף אחורית", tips: ["גוף קרש ישר", "משוך חזה לבר", "שמור על תנוחת גוף"], defaultSets: 3, defaultReps: "10-15", equipment: "מוט נמוך / שולחן", youtubeQuery: "australian+pull+up+form" },
      { name: "L-Sit Pull-up", muscles: "גב, ליבה, ביצפס", tips: ["שמור רגליים ישרות קדמה", "מתקדם — בנה קודם L-sit", "כוח ליבה קריטי"], defaultSets: 3, defaultReps: "3-6", equipment: "מוט מתח", youtubeQuery: "l+sit+pull+up+form" },
    ],
  },
  {
    key: "shoulders", label: "כתפיים", emoji: "🏋️", color: "#f97316",
    subGroups: [
      { key: "sh_bw_press",     label: "לחיצות",   emoji: "🔵", exerciseNames: ["שכיבות פייק","שכיבות ארצ'ר","Pike Push-up Elevated","Box Pike Push-up","Pike Push-up + Push-up Combo"] },
      { key: "sh_bw_hspu",      label: "הנדסטנד",  emoji: "🤸", exerciseNames: ["הנדסטנד Push-up (בקיר)","HSPU בקיר","Strict HSPU","Wall Walk","Handstand Hold בקיר","Freestanding Handstand","Handstand Walk","Korean HSPU","HSPU אחיזה צרה (Tricep Focus)","L-Sit to Press Prep","Tuck Planche Push-up","Tiger Bend HSPU","Wall Walk + HSPU"] },
      { key: "sh_bw_stability", label: "יציבות",   emoji: "⚡", exerciseNames: ["כפפות כתפיים (Shoulder Taps)","Planche Lean","Superman Hold","Reverse Plank","Hollow Body to Arch","Pseudo Planche Push-up Lean","Maltese Lean Hold","Superman Push-up","Straddle Planche Lean Floor"] },
      { key: "sh_rings",        label: "טבעות",    emoji: "⭕", exerciseNames: ["Ring HSPU","Ring Shoulder Press","Ring L-Sit Press","Ring HSPU Elevated","Ring Lateral Raise","Elevated Ring Pike Push-up","Ring L-Sit to Shoulder Press","Ring Dip to Support Hold"] },
    ],
    exercises: [
      { name: "שכיבות פייק", muscles: "דלטואיד קדמי ואמצע, טריצפס", tips: ["ישבן גבוה — V הפוך", "ירידה לכיוון הראש", "בסיס להנדסטנד"], defaultSets: 3, defaultReps: "10-12", equipment: "ללא", youtubeQuery: "pike+push+up+form" },
      { name: "הנדסטנד Push-up (בקיר)", muscles: "כתפיים, טריצפס, ליבה", tips: ["גב לקיר", "ירידה מבוקרת", "פתח מרפקים כלפי חוץ"], defaultSets: 3, defaultReps: "5-8", equipment: "קיר", youtubeQuery: "handstand+push+up+wall+form" },
      { name: "כפפות כתפיים (Shoulder Taps)", muscles: "כתפיים, ליבה, יציבות", tips: ["גוף ישר בפלנק", "הרם יד לכתף שנייה", "הימנע מנדנוד"], defaultSets: 3, defaultReps: "10 כל צד", equipment: "ללא", youtubeQuery: "shoulder+tap+push+up+form" },
      { name: "שכיבות ארצ'ר", muscles: "כתפיים, חזה, יציבות", tips: ["רחב יד אחת לצד", "שמור יד ישרה", "בקרה בתנועה"], defaultSets: 3, defaultReps: "6-8 כל צד", equipment: "ללא", youtubeQuery: "archer+push+up+form" },
    ],
  },
  {
    key: "arms", label: "ידיים", emoji: "💪", color: "#ec4899",
    subGroups: [
      { key: "arms_bw_bi",  label: "ביצפס",    emoji: "💪", exerciseNames: ["מתח אחיזה הפוכה","Towel Pull-up Curl","Around the World Pull-up","Assisted One-Arm Chin-up","Hammer Grip Pull-up","Negative One-Arm Chin-up","Towel Chin-up","False Grip Chin-up"] },
      { key: "arms_bw_tri", label: "טריצפס",   emoji: "💎", exerciseNames: ["מקבילים (Dips)","שכיבות יהלום","Tricep Push-up","L-Sit Dips","Korean Dips (Tricep)","Slow Negative Dips","Forearm to Push-up","Pike Push-up Dip Combo","Korean Dip Eccentric","Forearm Stand Push-up","Narrow Parallette Dip"] },
      { key: "arms_bw_fore", label: "אמות",    emoji: "🦾", exerciseNames: ["Hanging Straight Hold","Wrist Push-up"] },
      { key: "arms_rings",  label: "טבעות",    emoji: "⭕", exerciseNames: ["Ring Dips מתקדם","Ring Tricep Ext","Ring Bicep Curl","Ring Face Pull","Ring Rows מתקדם","Ring Turn Out Dip","Ring Chin-up with Pause","Ring Bicep Curl Supination","Ring Tricep Dip Slow","Ring Row Underhand","Ring Around The World","Ring Overhead Tricep Extension","Ring Push-up Narrow to Wide","Ring Lockout Hold"] },
    ],
    exercises: [
      { name: "מקבילים (Dips)", muscles: "טריצפס, חזה תחתון", tips: ["כסא / מקבילים", "הורד עד מרפק 90°", "עלה בלחיצת טריצפס"], defaultSets: 3, defaultReps: "10-15", equipment: "כסא / מקבילים", youtubeQuery: "tricep+dips+bench+form" },
      { name: "שכיבות יהלום", muscles: "טריצפס, חזה פנימי", tips: ["ידיים בצורת יהלום", "מרפקים צמודים", "גוף ישר"], defaultSets: 3, defaultReps: "8-12", equipment: "ללא", youtubeQuery: "diamond+push+up+form" },
      { name: "מתח אחיזה הפוכה", muscles: "ביצפס, גב", tips: ["כפות ידיים כלפיך", "תנועה מבוקרת", "תלייה מלאה"], defaultSets: 3, defaultReps: "6-10", equipment: "מוט מתח", youtubeQuery: "chin+up+form+tutorial" },
      { name: "Tricep Push-up", muscles: "טריצפס בעיקר", tips: ["מרפקים צמודים לגוף", "לא פתוחים לצד", "ירידה עמוקה"], defaultSets: 3, defaultReps: "10-12", equipment: "ללא", youtubeQuery: "tricep+pushup+close+grip+form" },
    ],
  },
  {
    key: "legs", label: "רגליים", emoji: "🦵", color: "#eab308",
    subGroups: [
      { key: "legs_bw_quads",   label: "ארבע ראשי", emoji: "🦵", exerciseNames: ["סקוואט משקל גוף","לאנג' (Lunges)","ישיבת קיר (Wall Sit)","Bulgarian Split Squat","Cossack Squat","Sissy Squat","Reverse Nordic Curl","Single Leg Wall Sit","Lateral Lunge","Frog Squat"] },
      { key: "legs_bw_hams",    label: "האמסטרינג", emoji: "🏃", exerciseNames: ["Single Leg RDL BW","Nordic Curl Eccentric","Nordic Curl על טבעות"] },
      { key: "legs_bw_glutes",  label: "ישבן",       emoji: "🍑", exerciseNames: ["Single Leg Glute Bridge BW","Curtsy Lunge","Glute Bridge Marching"] },
      { key: "legs_bw_plyo",    label: "פליומטרי",  emoji: "⚡", exerciseNames: ["סקוואט קפיצה (Jump Squat)","Tuck Jump","Broad Jump","180 Jump Squat","Box Jump","Depth Jump","Plyometric Lunge","Explosive Step-up","Sprint Bounds","Lateral Box Jump","Single Leg Hop Continuous","Single Leg Box Jump"] },
      { key: "legs_bw_advanced", label: "מתקדמות",  emoji: "🔥", exerciseNames: ["Pistol Squat","Shrimp Squat","Skater Squat","Dragon Squat","Pistol Squat Progression","Burpee + Pistol","Single Leg Squat to Box","Assisted Pistol Squat","Eccentric Pistol Squat","Step-Down Eccentric","Cossack Squat Deep","Dragon Squat Advanced"] },
      { key: "legs_bw_calves",  label: "תאומים",    emoji: "👟", exerciseNames: ["Single Leg Calf Raise BW"] },
    ],
    exercises: [
      { name: "סקוואט משקל גוף", muscles: "קוואדריצפס, ישבן, המסטרינג", tips: ["ברכיים מעל אצבעות", "ירד עד מקביל", "גב ישר — חובה"], defaultSets: 4, defaultReps: "15-20", equipment: "ללא", youtubeQuery: "bodyweight+squat+form" },
      { name: "לאנג' (Lunges)", muscles: "קוואדריצפס, ישבן, המסטרינג", tips: ["פסיעה ארוכה", "ברך קדמית לא תחצה", "גב ישר"], defaultSets: 3, defaultReps: "12 כל צד", equipment: "ללא", youtubeQuery: "lunges+form+tutorial" },
      { name: "סקוואט קפיצה (Jump Squat)", muscles: "כל הרגל, סיבולת", tips: ["נחת בעדינות", "ירד ל-90° לפני הקפיצה", "ברכיים לא פנימה"], defaultSets: 3, defaultReps: "10-12", equipment: "ללא", youtubeQuery: "jump+squat+form" },
      { name: "ישיבת קיר (Wall Sit)", muscles: "קוואדריצפס, יציבות", tips: ["גב שטוח לקיר", "ברכיים 90°", "החזק כמה שיותר"], defaultSets: 3, defaultReps: "30-60 שניות", equipment: "קיר", youtubeQuery: "wall+sit+exercise+form" },
      { name: "Bulgarian Split Squat", muscles: "קוואדריצפס, ישבן, יציבות", tips: ["רגל אחורית על כסא", "ירד ישר למטה", "גוף זקוף"], defaultSets: 3, defaultReps: "10 כל צד", equipment: "כסא", youtubeQuery: "bulgarian+split+squat+form" },
    ],
  },
  {
    key: "core", label: "ליבה", emoji: "🎯", color: "#06b6d4",
    subGroups: [
      { key: "core_bw_straight",  label: "בטן ישרה",  emoji: "🎯", exerciseNames: ["פלנק (Plank)","Hollow Body Hold","Dead Bug","Hollow Body Rock","Ab Wheel from Knees","Copenhagen Plank","Stir the Pot","Reverse Crunch","Ab Wheel Standing Rollout"] },
      { key: "core_bw_lsit",      label: "L-Sit",     emoji: "🤸", exerciseNames: ["L-Sit (בין כסאות)","L-Sit (מקבילים)","V-Sit","Tuck L-Sit","Straddle L-Sit","Straddle L-Sit Floor","V-Sit Hold"] },
      { key: "core_bw_hanging",   label: "תלייה",     emoji: "🏋️", exerciseNames: ["הרמות ברכיים תלויות","Toes to Bar","Windshield Wipers","Hanging Leg Raise ישר","Knee Raises on Parallettes","Windshield Wipers Tuck Hanging"] },
      { key: "core_bw_advanced",  label: "מתקדמות",  emoji: "🔥", exerciseNames: ["Human Flag (Tuck)","Full Human Flag","Dragon Flag (Full)","Dragon Flag Negative","Dragon Flag Incline","Planche Shrug","Tuck Planche Shrug"] },
      { key: "core_rings",        label: "טבעות",    emoji: "⭕", exerciseNames: ["Ring L-Sit","Ring Tuck L-Sit","Ring Ab Rollout"] },
      { key: "core_bw_obliques",  label: "אלכסונים", emoji: "🔄", exerciseNames: ["Side Plank Hip Raises","Bicycle Crunch Premium","Plank Knee to Elbow"] },
    ],
    exercises: [
      { name: "פלנק (Plank)", muscles: "ליבה, כתפיים, ישבן", tips: ["גוף קרש ישר", "אל תרים ישבן", "נשום בשלווה"], defaultSets: 3, defaultReps: "45-60 שניות", equipment: "ללא", youtubeQuery: "plank+form+tutorial" },
      { name: "Hollow Body Hold", muscles: "ליבה עמוק, בטן", tips: ["גב תחתון מרוסק לרצפה", "ידיים ורגליים מורמות", "בסיס לכל תרגיל גימנסטיקה"], defaultSets: 3, defaultReps: "20-30 שניות", equipment: "ללא", youtubeQuery: "hollow+body+hold+form" },
      { name: "L-Sit (בין כסאות)", muscles: "ליבה, טריצפס, כתפיים", tips: ["רגליים ישרות קדימה", "הרם גוף בלחיצת ידיים", "בנה הדרגתית"], defaultSets: 3, defaultReps: "5-15 שניות", equipment: "2 כסאות / מקבילים", youtubeQuery: "l+sit+between+chairs+form" },
      { name: "הרמות ברכיים תלויות", muscles: "בטן תחתונה, Hip Flexors", tips: ["תלה ממוט", "הרם ברכיים לחזה", "אל תנועע"], defaultSets: 3, defaultReps: "10-15", equipment: "מוט מתח", youtubeQuery: "hanging+knee+raise+form" },
      { name: "Dead Bug", muscles: "ליבה עמוק, גב תחתון", tips: ["גב תחתון צמוד לרצפה", "תנועה מנוגדת — יד ורגל", "נשום החוצה"], defaultSets: 3, defaultReps: "10 כל צד", equipment: "ללא", youtubeQuery: "dead+bug+exercise+form" },
    ],
  },
];

const WARMUP_GROUPS: MuscleGroup[] = [
  {
    key: "dynamic", label: "חימום דינמי", emoji: "🔥", color: "#f97316",
    exercises: [
      { name: "ג'אמפינג ג'קס", muscles: "כל הגוף, קרדיו", tips: ["קצב עקבי", "נחת בעדינות", "ידיים עד מעל הראש"], defaultSets: 3, defaultReps: "30 שניות", equipment: "ללא", youtubeQuery: "jumping+jacks+warm+up" },
      { name: "High Knees", muscles: "ירכיים, קרדיו, ליבה", tips: ["ברכיים עד גובה הירך", "קצב מהיר", "ידיים נוגעות בברכיים"], defaultSets: 3, defaultReps: "30 שניות", equipment: "ללא", youtubeQuery: "high+knees+warm+up" },
      { name: "מעגלי כתפיים", muscles: "כתפיים, גב עליון", tips: ["מעגלים קטנים לגדולים", "קדימה ואחורה", "קצב איטי"], defaultSets: 2, defaultReps: "10 כל כיוון", equipment: "ללא", youtubeQuery: "shoulder+circles+warm+up" },
      { name: "Inchworm", muscles: "גב, ליבה, כתפיים", tips: ["הרחב ידיים קדימה", "גב ישר", "תנועה מבוקרת"], defaultSets: 2, defaultReps: "8", equipment: "ללא", youtubeQuery: "inchworm+exercise+warm+up" },
      { name: "לאנג' + סיבוב (Lunge Twist)", muscles: "ירכיים, ליבה, קואורדינציה", tips: ["פסיעה קדימה", "סיבוב לכיוון הרגל הקדמית", "גב ישר"], defaultSets: 2, defaultReps: "8 כל צד", equipment: "ללא", youtubeQuery: "lunge+twist+warm+up" },
    ],
  },
  {
    key: "static", label: "מתיחות סטטיות", emoji: "🧘", color: "#8b5cf6",
    exercises: [
      { name: "מתיחת חזה (קיר)", muscles: "חזה, כתפיים קדמיות", tips: ["יד על קיר בגובה כתף", "סובב גוף הצידה", "החזק 30 שניות"], defaultSets: 2, defaultReps: "30 שניות כל צד", equipment: "קיר", youtubeQuery: "chest+stretch+wall" },
      { name: "מתיחת Hip Flexor", muscles: "ירכיים, גב תחתון", tips: ["ברך אחת על הרצפה", "הרחק הירך קדימה", "גב ישר"], defaultSets: 2, defaultReps: "30 שניות כל צד", equipment: "ללא", youtubeQuery: "hip+flexor+stretch" },
      { name: "מתיחת המסטרינג", muscles: "המסטרינג, גב תחתון", tips: ["שב ורגל ישרה", "כופף לכיוון האצבעות", "אל תעגל גב"], defaultSets: 2, defaultReps: "30 שניות כל צד", equipment: "ללא", youtubeQuery: "hamstring+stretch+seated" },
      { name: "מתיחת שוקיים (קיר)", muscles: "שוקיים", tips: ["יד על קיר", "רגל אחורית ישרה", "עקב בקרקע"], defaultSets: 2, defaultReps: "30 שניות כל צד", equipment: "קיר", youtubeQuery: "calf+stretch+wall" },
    ],
  },
  {
    key: "cooldown", label: "סיום ושחרור", emoji: "❄️", color: "#06b6d4",
    exercises: [
      { name: "Child's Pose", muscles: "גב תחתון, ירכיים, כתפיים", tips: ["ברכיים פתוחות", "ידיים מוארכות", "נשום עמוק"], defaultSets: 1, defaultReps: "60 שניות", equipment: "ללא", youtubeQuery: "child's+pose+yoga" },
      { name: "Savasana", muscles: "שחרור כולל, מנוחה", tips: ["שכב שטוח", "עצום עיניים", "נשום עמוק 10 פעמים"], defaultSets: 1, defaultReps: "2-3 דקות", equipment: "ללא", youtubeQuery: "savasana+yoga+relaxation" },
      { name: "Spinal Twist שכוב", muscles: "גב, ירכיים, ליבה", tips: ["שכב, ברך אחת לצד", "כתפיים נשארות על הרצפה", "הרגע"], defaultSets: 2, defaultReps: "30 שניות כל צד", equipment: "ללא", youtubeQuery: "supine+spinal+twist" },
      { name: "Figure 4 Stretch", muscles: "ישבן, ירכיים, אגן", tips: ["שכב, רגל אחת על השנייה", "משוך ברך לחזה", "מתיחה עמוקה"], defaultSets: 2, defaultReps: "30 שניות כל צד", equipment: "ללא", youtubeQuery: "figure+4+stretch+glutes" },
    ],
  },
];

// ─── Stretching groups ───────────────────────────────────────────────────────
const STRETCHING_MUSCLE_GROUPS: MuscleGroup[] = [
  { key: "stretch_upper",   label: "פלג גוף עליון", emoji: "🙆", color: "#38bdf8",
    exercises: [
      { name: "מתיחת חזה (דלת)", muscles: "חזה, כתפיים קדמיות", tips: ["יד על מסגרת דלת", "סובב גוף הצידה", "החזק 30 שניות"], defaultSets: 2, defaultReps: "30 שניות כל צד", equipment: "קיר", youtubeQuery: "doorway+chest+stretch+form" },
      { name: "מתיחת כתפיים (Cross-Body)", muscles: "כתף אחורית, גב עליון", tips: ["משוך יד לחזה", "כתפיים נמוכות", "החזק 30 שניות"], defaultSets: 2, defaultReps: "30 שניות כל צד", equipment: "ללא", youtubeQuery: "cross+body+shoulder+stretch" },
      { name: "מתיחת טריצפס מעל ראש", muscles: "טריצפס, כתף", tips: ["מרפק אחד מעל", "יד שנייה מושכת", "גב ישר"], defaultSets: 2, defaultReps: "30 שניות כל צד", equipment: "ללא", youtubeQuery: "overhead+tricep+stretch+form" },
      { name: "Child's Pose מורחב", muscles: "כתפיים, גב עליון, גב תחתון", tips: ["ברכיים פתוחות", "ידיים מוארכות", "נשום עמוק"], defaultSets: 1, defaultReps: "60 שניות", equipment: "מזרן", youtubeQuery: "extended+childs+pose+stretch" },
      { name: "Thread the Needle", muscles: "גב עליון, כתפיים", tips: ["ארבע רגליים", "החלק יד מתחת לגוף", "סיבוב מקסימלי"], defaultSets: 2, defaultReps: "30 שניות כל צד", equipment: "מזרן", youtubeQuery: "thread+the+needle+stretch+spine" },
    ],
  },
  { key: "stretch_lower",   label: "פלג גוף תחתון", emoji: "🦵", color: "#a3e635",
    exercises: [
      { name: "מתיחת Hip Flexor (לאנג׳)", muscles: "Hip Flexors, קוואדס", tips: ["ברך על רצפה", "הרחק ירך קדימה", "גב ישר"], defaultSets: 2, defaultReps: "30 שניות כל צד", equipment: "מזרן", youtubeQuery: "hip+flexor+stretch+kneeling+lunge" },
      { name: "מתיחת המסטרינג שכיבה", muscles: "המסטרינג, גב תחתון", tips: ["שכב על הגב", "הרם רגל ישרה", "מתיחה עדינה"], defaultSets: 2, defaultReps: "30 שניות כל צד", equipment: "מזרן", youtubeQuery: "supine+hamstring+stretch+strap" },
      { name: "מתיחת Pigeon Pose", muscles: "ישבן עמוק, ירך חיצונית", tips: ["רגל קדמית אופקית", "הטה קדימה", "נשום עמוק"], defaultSets: 2, defaultReps: "45 שניות כל צד", equipment: "מזרן", youtubeQuery: "pigeon+pose+hip+stretch" },
      { name: "מתיחת שוקיים (Calf Stretch)", muscles: "שוקיים, אכילס", tips: ["יד על קיר", "רגל אחורית ישרה", "עקב בקרקע"], defaultSets: 2, defaultReps: "30 שניות כל צד", equipment: "קיר", youtubeQuery: "calf+stretch+wall+form" },
      { name: "Butterfly Stretch", muscles: "מפשעה, ירך פנימית", tips: ["כפות רגליים מאוחדות", "ברכיים לרצפה", "הטה קדימה"], defaultSets: 2, defaultReps: "45 שניות", equipment: "מזרן", youtubeQuery: "butterfly+stretch+inner+thigh" },
    ],
  },
  { key: "stretch_spine",   label: "גב ועמוד שדרה", emoji: "🦴", color: "#fb923c",
    exercises: [
      { name: "Cat-Cow", muscles: "עמוד שדרה, גב, ליבה", tips: ["ארבע רגליים", "נשום פנימה = גב מקמר", "נשום החוצה = גב שקוע"], defaultSets: 2, defaultReps: "10 חזרות", equipment: "מזרן", youtubeQuery: "cat+cow+stretch+spine+mobility" },
      { name: "Spinal Twist שכיבה", muscles: "עמוד שדרה, ישבן, IT Band", tips: ["שכב על הגב", "ברך אחת לצד", "כתפיים לרצפה"], defaultSets: 2, defaultReps: "30 שניות כל צד", equipment: "מזרן", youtubeQuery: "supine+spinal+twist+stretch" },
      { name: "Cobra Stretch", muscles: "גב תחתון, בטן", tips: ["ידיים מתחת לכתפיים", "הרם חזה", "מרפקים קצת כפופים"], defaultSets: 2, defaultReps: "30 שניות", equipment: "מזרן", youtubeQuery: "cobra+pose+yoga+lower+back" },
      { name: "מתיחת גב תחתון (Knee Hug)", muscles: "גב תחתון, ישבן", tips: ["שכב על הגב", "שתי ברכיים לחזה", "התנדנד בעדינות"], defaultSets: 1, defaultReps: "60 שניות", equipment: "מזרן", youtubeQuery: "knee+to+chest+lower+back+stretch" },
      { name: "Figure-4 Stretch", muscles: "ישבן, פיריפורמיס", tips: ["שכב, רגל כ-4", "משוך ברך לחזה", "מתיחה עמוקה בישבן"], defaultSets: 2, defaultReps: "45 שניות כל צד", equipment: "מזרן", youtubeQuery: "figure+4+piriformis+stretch" },
    ],
  },
  { key: "stretch_dynamic", label: "מתיחות דינמיות", emoji: "🌊", color: "#c084fc",
    exercises: [
      { name: "Leg Swing קדמי-אחורי", muscles: "ירכיים, Hip Flexors", tips: ["אחוז בקיר", "נדנד רגל ישרה", "טווח הולך וגדל"], defaultSets: 2, defaultReps: "15 כל רגל", equipment: "קיר", youtubeQuery: "dynamic+leg+swing+front+back" },
      { name: "Leg Swing צדי", muscles: "מפשעה, ירך חיצונית", tips: ["אחוז בקיר בצד", "נדנד לצדדים", "עלה בהדרגה"], defaultSets: 2, defaultReps: "15 כל רגל", equipment: "קיר", youtubeQuery: "lateral+leg+swing+dynamic+stretch" },
      { name: "World's Greatest Stretch", muscles: "כל הגוף, ירכיים, עמוד שדרה", tips: ["לאנג׳ + סיבוב + יד למעלה", "תנועה נוזלית", "3 תנוחות ברצף"], defaultSets: 2, defaultReps: "5 כל צד", equipment: "מזרן", youtubeQuery: "worlds+greatest+stretch+form" },
      { name: "Arm Circle גדול", muscles: "כתפיים, גב עליון", tips: ["מעגלים קטנים לגדולים", "קדימה ואחורה", "קצב איטי"], defaultSets: 2, defaultReps: "10 כל כיוון", equipment: "ללא", youtubeQuery: "arm+circles+shoulder+warm+up" },
      { name: "Inchworm + Push-up", muscles: "גב, ליבה, כתפיים, חזה", tips: ["הרחב ידיים קדימה", "שכיבה + חזור", "גב ישר לאורך"], defaultSets: 2, defaultReps: "8", equipment: "מזרן", youtubeQuery: "inchworm+pushup+combo+dynamic" },
    ],
  },
];

// ─── Compressed exercise seed: 72 new → 100 total (+ 28 existing) ────────────
// format: [name, groupKey, equipment, ytQuery, sets, reps, muscles, tip]
type _ES = [string,string,string,string,number,string,string,string];
const _EX: _ES[] = [
  // ── CHEST (12) ──
  ["לחיצת דמבלים משופעת","chest","ספסל","incline+dumbbell+press+form",4,"8-10","חזה עליון, כתפיים קדמיות","הגדל זווית ל-30°, הרגש חזה עליון"],
  ["לחיצת מוט משופעת","chest","ספסל","incline+barbell+bench+press",4,"6-8","חזה עליון, טריצפס","גב שטוח ללוח, ירידה מבוקרת"],
  ["לחיצת דמבלים ירידה","chest","ספסל","decline+dumbbell+press",3,"10","חזה תחתון","ספסל שלילי לפחות -15°"],
  ["פרפר משופע","chest","ספסל","incline+fly+chest+form",3,"12","חזה עליון","קשת עדינה, מרגיש מתיחה בפתיחה"],
  ["Pec Deck מכונה","chest","מכונה","pec+deck+machine+form",3,"12-15","חזה פנימי","כוונן מושב — מרפקים בגובה כתפיים"],
  ["Cable Fly מגבוה","chest","כבלים","high+cable+fly+lower+chest",3,"15","חזה תחתון","משוך מלמעלה למטה וצלב"],
  ["Cable Fly מלמטה","chest","כבלים","low+cable+fly+upper+chest",3,"15","חזה עליון","משוך מלמטה למעלה וצלב"],
  ["Dumbbell Pullover","chest","ספסל","dumbbell+pullover+chest+form",3,"12","חזה, גב רחב","מרפקים קצת כפופים לאורך כל התנועה"],
  ["שכיבות ירידה","chest","ספסל","decline+push+up+form",3,"12-15","חזה תחתון","רגליים על ספסל, גוף ישר"],
  ["Squeeze Press","chest","ספסל","dumbbell+squeeze+press+form",3,"12","חזה פנימי","לחץ דמבלים זה על זה לאורך כל התנועה"],
  ["מקבילים לחזה","chest","מקבילים","weighted+dips+chest+form",4,"8-10","חזה תחתון, טריצפס","הישן קדימה ירד עמוק"],
  ["Cable Crossover רחב","chest","כבלים","cable+crossover+wide+chest",3,"12","חזה כולו","ידיים ישרות, תנועת חיבוק"],
  // ── BACK (12) ──
  ["Single Arm Dumbbell Row","back","ספסל","single+arm+dumbbell+row+form",4,"10","גב אמצע, ביצפס","ברך ויד על ספסל, משוך לירך"],
  ["T-Bar Row","back","מוט","t+bar+row+back+form",4,"8","גב אמצע, טרפזים","גב 45°, משוך לחזה תחתון"],
  ["Chest Supported Row","back","מכונה","chest+supported+row+form",4,"10-12","גב אמצע, ביצפס","חזה על הריפוד, ללא עזרת גוף"],
  ["Lat Pulldown רחב","back","מכונה","wide+grip+lat+pulldown+form",3,"10-12","גב רחב","הוצא חזה אל הבר בסיום"],
  ["Lat Pulldown צר","back","מכונה","close+grip+lat+pulldown+form",3,"10-12","גב רחב, ביצפס","אחיזה מקבילה — טווח תנועה גדול"],
  ["Straight Arm Pulldown","back","כבלים","straight+arm+pulldown+lats",3,"15","גב רחב","ידיים ישרות, לחץ מלמעלה למטה"],
  ["Renegade Row","back","דמבלים","renegade+row+form",3,"8 כל צד","גב, ליבה","פלנק — משוך לסירוגין, אל תסובב"],
  ["Meadows Row","back","מוט","meadows+row+back+form",4,"10","גב עליון, טרפזים","מוט בזווית, תנועה חד-צדדית"],
  ["Seal Row","back","ספסל","seal+row+form+back",4,"10-12","גב אמצע","שכוב על ספסל — ביטול עזרת גוף לחלוטין"],
  ["Rack Pull","back","מוט","rack+pull+form+upper+back",3,"5-6","גב תחתון, טרפזים","כמו דדליפט מגובה — פחות טווח"],
  ["Back Extension","back","מכונה","back+extension+lower+back+form",3,"15","גב תחתון","אל תגיע מעבר לניטרלי בפסגה"],
  ["Good Morning","back","מוט","good+morning+back+form",3,"12","גב תחתון, המסטרינג","מוט על כתפיים, כופף מהירכיים"],
  // ── SHOULDERS (10) ──
  ["Arnold Press","shoulders","דמבלים","arnold+press+form+shoulders",4,"10","כתפיים כולן, טריצפס","סובב כפות ידיים בתנועה"],
  ["לחיצת כתפיים בישיבה","shoulders","ספסל","seated+dumbbell+shoulder+press",4,"10-12","כתפיים קדמיות ואמצע","גב ישר, אל תרים ישבן"],
  ["Lateral Raise כבלים","shoulders","כבלים","cable+lateral+raise+form",3,"15","דלטואיד אמצעי","מתח קבוע לאורך כל הטווח"],
  ["Rear Delt Fly דמבלים","shoulders","דמבלים","rear+delt+fly+dumbbell+form",3,"15","כתף אחורית, טרפזים","כפוף 45° קדימה, ידיים ישרות"],
  ["Cable Rear Delt Fly","shoulders","כבלים","cable+rear+delt+fly+form",3,"15","כתף אחורית","כבלים מוצלבים — משוך בצד ה'הפוך'"],
  ["Upright Row","shoulders","מוט","upright+row+form+shoulders",3,"12","דלטואיד אמצע, טרפזים","אחיזה רחבה — בטיחותי לכתפיים"],
  ["Shrug — כיווץ כתפיים","shoulders","דמבלים","dumbbell+shrug+trap+form",4,"15-20","טרפזים","עלה ישר מעלה — לא מעגל כתפיים"],
  ["Cuban Press","shoulders","דמבלים","cuban+press+form+shoulders",3,"12","שרוול מסובב, כתפיים","מתחיל כ-Upright Row, מסיים כ-OHP"],
  ["Band Pull-Apart","shoulders","ללא","band+pull+apart+rear+delt",3,"20","כתף אחורית, טרפזים","ידיים ישרות, משוך עד לחזה"],
  ["Machine Lateral Raise","shoulders","מכונה","machine+lateral+raise+form",3,"15","דלטואיד אמצעי","עגינה יציבה, תנועה מלאה"],
  // ── ARMS (13) ──
  ["Preacher Curl","arms","מכונה","preacher+curl+form+bicep",3,"10-12","ביצפס","מרפקים על הריפוד — בידוד מלא"],
  ["Incline Dumbbell Curl","arms","ספסל","incline+dumbbell+curl+form",3,"10-12","ביצפס ראש ארוך","ספסל 45° — מתיחה מלאה בתחתית"],
  ["Concentration Curl","arms","דמבלים","concentration+curl+bicep+form",3,"12","ביצפס, עיצוב פסגה","מרפק בין הירכיים, כוף לאיטיות"],
  ["Spider Curl","arms","ספסל","spider+curl+bicep+incline",3,"12","ביצפס ראש קצר","ידיים תלויות מספסל משופע קדמה"],
  ["Cable Curl","arms","כבלים","cable+bicep+curl+form",3,"12","ביצפס","מתח קבוע — עבוד על הפסגה"],
  ["Hammer Curl כבלים","arms","כבלים","cable+hammer+curl+form",3,"12","ביצפס, ברכיאליס","אחיזה ניטרלית, כבל נמוך"],
  ["Reverse Curl","arms","מוט","reverse+curl+forearm+bicep",3,"12","אמות, ביצפס","אחיזה עליונה — מקשה פי 2"],
  ["Skull Crusher","arms","ספסל","skull+crusher+tricep+form",4,"10","טריצפס ראש ארוך","הורד לאחורה מעט מעל הראש"],
  ["Close Grip Bench","arms","ספסל","close+grip+bench+press+tricep",4,"8-10","טריצפס, חזה","אחיזה כתף-רוחב, מרפקים צמודים"],
  ["Overhead Tricep Extension","arms","דמבלים","overhead+tricep+extension+form",3,"12","טריצפס ראש ארוך","מרפקים קרובים לראש, מתיחה מלאה"],
  ["Tricep Pushdown V-Bar","arms","כבלים","tricep+pushdown+v+bar+form",3,"12-15","טריצפס","נעל מרפקים, פשוט עד סיום מלא"],
  ["Tricep Kickback","arms","ספסל","tricep+kickback+dumbbell+form",3,"12","טריצפס","כפוף 45°, פשוט עד ישר"],
  ["Wrist Curl","arms","ספסל","wrist+curl+forearm+form",3,"15-20","אמות קדמיות","ידיים מעבר לקצה הספסל"],
  // ── LEGS (15) ──
  ["Romanian Deadlift","legs","מוט","romanian+deadlift+form+hamstrings",4,"8","המסטרינג, ישבן","ברים לאורך הרגל, כופף מהירכיים"],
  ["Sumo Squat","legs","מוט","sumo+squat+form",4,"10","קוואדריצפס, ישבן, ירכיים","עמידה רחבה, אצבעות 45° החוצה"],
  ["Hack Squat מכונה","legs","מכונה","hack+squat+machine+form",4,"10","קוואדריצפס","רגליים גבוה יותר = יותר ישבן"],
  ["Leg Extension","legs","מכונה","leg+extension+form+quads",3,"12-15","קוואדריצפס בידוד","אל תנעל ברך בסיום, בקרה בחזרה"],
  ["Seated Calf Raise","legs","מכונה","seated+calf+raise+form",4,"20-25","שוק (Soleus)","בישיבה מדגיש Soleus (שוק תחתון)"],
  ["Glute Bridge","legs","מוט","glute+bridge+barbell+form",4,"15","ישבן, המסטרינג","ברכיים 90°, סחוט ישבן בפסגה"],
  ["Hip Thrust","legs","ספסל","barbell+hip+thrust+form",4,"10-12","ישבן, המסטרינג","גב על ספסל, מוט על ירכיים"],
  ["Goblet Squat","legs","דמבלים","goblet+squat+form",3,"12","קוואדריצפס, ישבן","דמבל בגובה חזה, ירד עמוק"],
  ["Step Up לספסל","legs","ספסל","step+up+exercise+legs+form",3,"12 כל צד","קוואדריצפס, ישבן","ספסל בגובה ברך, צעד מלא"],
  ["Nordic Hamstring Curl","legs","ללא","nordic+hamstring+curl+form",3,"5-8","המסטרינג","ירד לאיטיות, עלה בכוח ידיים"],
  ["Hip Abduction מכונה","legs","מכונה","hip+abduction+machine+form",3,"15","ירכיים חיצוניות, ישבן","בישיבה, דחוף ברכיים החוצה"],
  ["Hip Adduction מכונה","legs","מכונה","hip+adduction+machine+form",3,"15","ירכיים פנימיות","בישיבה, קרב ברכיים"],
  ["Donkey Kicks","legs","כבלים","donkey+kicks+glutes+cable",3,"15 כל צד","ישבן","ארבע רגליים — כף רגל לתקרה"],
  ["Bulgarian Split Squat","legs","ספסל","bulgarian+split+squat+form",3,"10 כל צד","קוואדריצפס, ישבן","רגל אחורית על ספסל, ירד ישר"],
  ["Good Morning רגליים","legs","מוט","good+morning+hamstrings+glutes",3,"12","המסטרינג, ישבן","ברכיים קצת כפופות, כופף מהירכיים"],
  // ── CORE (10) ──
  ["Cable Crunch","core","כבלים","cable+crunch+abs+form",3,"15-20","בטן ישרה","כרע על ברכיים, משוך בכוח בטן"],
  ["Dragon Flag","core","ספסל","dragon+flag+exercise+form",3,"4-6","בטן ישרה, ליבה עמוק","גוף ישר כקרש — ירד לאיטיות"],
  ["Ab Wheel Rollout","core","ללא","ab+wheel+rollout+form",3,"8-10","בטן ישרה, ליבה","גב ישר, אל תרכין כלפי הרצפה"],
  ["Hanging Leg Raise","core","מוט מתח","hanging+leg+raise+abs+form",3,"10-12","בטן תחתונה","תלה ממוט, הרם רגליים ישרות"],
  ["V-Up","core","ללא","v+up+abs+core+form",3,"12-15","בטן ישרה","גוף V הפוך — ידיים ורגליים נפגשות"],
  ["Woodchop (גרזן)","core","כבלים","cable+wood+chop+core+form",3,"12 כל צד","אלכסוני, ליבה","תנועת אלכסון מלמעלה למטה"],
  ["Pallof Press","core","כבלים","pallof+press+core+anti+rotation",3,"12 כל צד","אלכסוני, ליבה עמוק","אנטי-רוטציה — אל תסובב!"],
  ["Side Plank","core","ללא","side+plank+obliques+form",3,"30-45 שניות","אלכסוני, ירך אמצע","גוף ישר כקרש, ירכיים לא יורדות"],
  ["Landmine Rotation","core","מוט","landmine+rotation+core+form",3,"10 כל צד","אלכסוני, כתפיים","החזק מוט בשתי ידיים, סובב גוף"],
  ["Hollow Crunch","core","ללא","hollow+body+crunch+form",3,"15-20","בטן ישרה, ליבה עמוק","גב תחתון צמוד לרצפה כל הזמן"],
];
// Inject into MUSCLE_GROUPS at module load (inner arrays are mutable)
_EX.forEach(([name,groupKey,equipment,ytQ,sets,reps,muscles,tip]) => {
  const g = MUSCLE_GROUPS.find(x => x.key === groupKey);
  if (g) g.exercises.push({ name, muscles, tips: [tip], defaultSets: sets, defaultReps: reps, equipment, youtubeQuery: ytQ });
});

// ─── Batch 2: ~100 cable & machine focused exercises ─────────────────────────
const _EX2: _ES[] = [
  // ── CHEST (17) ──
  ["Cable Fly אמצעי","chest","כבלים","cable+fly+mid+chest+form",3,"15","חזה אמצעי","ידיים בגובה כתפיים, תנועת חיבוק"],
  ["Single Arm Cable Fly","chest","כבלים","single+arm+cable+fly+chest",3,"12 כל צד","חזה, יציבות","עבוד על כל צד בנפרד — טווח מלא"],
  ["Cable Chest Press עמידה","chest","כבלים","cable+chest+press+standing",3,"12","חזה, טריצפס","עמוד, לחץ ישר קדימה — שמור ליבה"],
  ["Incline Cable Fly","chest","כבלים","incline+cable+fly+form",3,"12","חזה עליון","כבלים נמוכים, ידיים בקשת כלפי מעלה"],
  ["Low to High Cable Fly","chest","כבלים","low+to+high+cable+fly+chest",3,"12","חזה עליון","תנועה בקשת מלמטה למעלה"],
  ["High to Low Cable Fly","chest","כבלים","high+to+low+cable+fly+chest",3,"12","חזה תחתון","תנועה בקשת מלמעלה למטה"],
  ["Cable Squeeze חזה","chest","כבלים","cable+squeeze+press+chest+form",3,"15","חזה פנימי","לחץ שתי ידיים מול הגוף — איזומטרי"],
  ["Machine Chest Press","chest","מכונה","hammer+strength+chest+press",4,"10","חזה, טריצפס","כוון מושב — זרועות במקביל לרצפה"],
  ["Smith Machine Bench","chest","מכונה","smith+machine+bench+press+form",4,"8-10","חזה, טריצפס","Smith מייצב — מתאים למתחילים"],
  ["Iso-Lateral Chest Press","chest","מכונה","iso+lateral+chest+press+form",3,"10-12","חזה (כל צד בנפרד)","בידוד — מאזן אסימטריה"],
  ["Machine Incline Press","chest","מכונה","machine+incline+chest+press",3,"10-12","חזה עליון, כתפיים","כוון מושב לזווית 30°"],
  ["Cable Upper Chest Fly","chest","כבלים","upper+chest+cable+fly+form",3,"12","חזה עליון","כבלים נמוכים — תנועה לגובה הפנים"],
  ["Cable Chest Pullover","chest","כבלים","cable+chest+pullover+form",3,"12","חזה, גב רחב","שכוב על ספסל, כבל מעל הראש"],
  ["Pec Deck Single Arm","chest","מכונה","pec+deck+single+arm+form",3,"12 כל צד","חזה פנימי (בידוד)","כל יד בנפרד — תחושת מתיחה חזקה"],
  ["Cable Fly Neutral Grip","chest","כבלים","neutral+grip+cable+fly+chest",3,"12","חזה כולו","אחיזת כפות ידיים ניטרלית"],
  ["Reverse Pec Deck","chest","מכונה","reverse+pec+deck+rear+delt",3,"15","כתף אחורית, חזה","מושב הפוך — מדגיש כתף אחורית"],
  ["Cable Crossover Neutral","chest","כבלים","cable+crossover+neutral+grip",3,"12","חזה פנימי","אחיזה ניטרלית, ידיים ב-90° לגוף"],
  // ── BACK (22) ──
  ["Cable Pullover גב","back","כבלים","cable+pullover+back+form",3,"12","גב רחב","שמור מרפקים קצת כפופים, ירד ישר"],
  ["Unilateral Cable Row","back","כבלים","unilateral+cable+row+form",4,"10 כל צד","גב אמצע, ביצפס","מרפק לאחור, קרב שכמות"],
  ["High Cable Row","back","כבלים","high+cable+row+back+form",3,"12","גב עליון, טרפזים","שב זקוף, משוך לצוואר"],
  ["Rope Pulldown","back","כבלים","rope+pulldown+lats+form",3,"12","גב רחב","חבל — פרוס ידיים בסיום"],
  ["Unilateral Lat Pulldown","back","כבלים","single+arm+lat+pulldown+form",3,"10 כל צד","גב רחב (בידוד)","כל יד בנפרד — מאזן חוזק"],
  ["Wide Grip Cable Row","back","כבלים","wide+grip+cable+row+form",3,"12","גב עליון, כתף אחורית","אחיזה רחבה, משוך לחזה עליון"],
  ["Reverse Grip Cable Row","back","כבלים","reverse+grip+cable+row+form",3,"12","גב אמצע, ביצפס","אחיזה תחתית — יותר ביצפס"],
  ["Underhand Cable Row","back","כבלים","underhand+cable+row+form",3,"12","גב אמצע, ביצפס","אחיזה הפוכה — דגש על גב תחתון"],
  ["Cable W-Raise","shoulders","כבלים","cable+w+raise+back+form",3,"15","כתף אחורית, טרפזים","ידיים בצורת W — מחזק שכמות"],
  ["Cable Straight Arm Row","back","כבלים","cable+straight+arm+row+form",3,"15","גב רחב","ידיים ישרות, משוך מהמרפקים"],
  ["Cable Lower Back Ext","back","כבלים","cable+lower+back+extension+form",3,"15","גב תחתון","שמור גב ניטרלי, תנועה מהירכיים"],
  ["Machine Pullover","back","מכונה","machine+pullover+back+form",4,"12","גב רחב","כוון מניפה — תחושת מתיחה בגב רחב"],
  ["Hammer Strength Lat Pull","back","מכונה","hammer+strength+lat+pulldown",3,"10","גב רחב (כל יד בנפרד)","בידוד — מאזן אסימטריה"],
  ["Machine Seated Row","back","מכונה","machine+seated+row+form",4,"12","גב אמצע, ביצפס","גב ישר, לחץ חזה על הריפוד"],
  ["Assisted Pull-up Machine","back","מכונה","assisted+pullup+machine+form",3,"8-10","גב רחב, ביצפס","הפחת משקל עזרה עם הזמן"],
  ["Reverse Grip Lat Pulldown","back","מכונה","reverse+grip+lat+pulldown+form",3,"12","גב רחב, ביצפס","אחיזה הפוכה — ביצפס משתתף יותר"],
  ["Machine High Row","back","מכונה","machine+high+row+back+form",3,"12","גב עליון, טרפזים","משוך לצוואר, שמור גב ישר"],
  ["Pendlay Row","back","מוט","pendlay+row+form+back",4,"5-6","גב אמצע, טרפזים","מהרצפה בכל חזרה — כוח טהור"],
  ["Kroc Row","back","דמבלים","kroc+row+form+back",3,"15-20","גב עליון, ביצפס","חזרות גבוהות עם משקל כבד"],
  ["Yates Row","back","מוט","yates+row+form+back",4,"8-10","גב עליון, טרפזים","עמידה זקופה יותר מ-Barbell Row"],
  ["Cable Rope Face Pull","shoulders","כבלים","rope+face+pull+back+form",3,"15","כתף אחורית, טרפזים","פרוס כ-W בסיום — שרוול מסובב"],
  ["Chest Supported Cable Row","back","כבלים","chest+supported+cable+row",3,"12","גב אמצע","חזה על הריפוד + כבל — אפס עזרת גוף"],
  // ── SHOULDERS (22) ──
  ["Cable Front Raise","shoulders","כבלים","cable+front+raise+shoulders+form",3,"12","כתף קדמית","כבל נמוך — מתח קבוע, אל תנפף"],
  ["Cable Upright Row","shoulders","כבלים","cable+upright+row+shoulders",3,"12","כתף אמצעית, טרפזים","אחיזה רחבה — פחות עומס על כתף"],
  ["Single Arm Cable Lateral","shoulders","כבלים","single+arm+cable+lateral+raise",3,"12 כל צד","כתף אמצעית","עמוד בצד הכבל, הרם לגובה כתף"],
  ["Lying Cable Lateral Raise","shoulders","כבלים","lying+cable+lateral+raise+form",3,"12 כל צד","כתף אמצעית (בידוד)","שכוב על הצד — ביסוד מלא"],
  ["Rope Face Pull מתקדם","shoulders","כבלים","rope+face+pull+advanced+form",3,"15","כתף אחורית, שרוול מסובב","פרוס מרפקים כלפי מעלה בסיום"],
  ["High Cable Rear Delt Fly","shoulders","כבלים","high+cable+rear+delt+fly+form",3,"15","כתף אחורית","כבל גבוה — ידיים ישרות"],
  ["Low Cable Rear Delt","shoulders","כבלים","low+cable+rear+delt+form",3,"15","כתף אחורית","כבל נמוך — הרם מלמטה לצד"],
  ["Cable External Rotation","shoulders","כבלים","cable+external+rotation+shoulder",3,"15 כל צד","שרוול מסובב חיצוני","מרפק 90°, סובב החוצה — מניעת פציעה"],
  ["Cable Internal Rotation","shoulders","כבלים","cable+internal+rotation+shoulder",3,"15 כל צד","שרוול מסובב פנימי","מרפק 90°, סובב פנימה — מניעת פציעה"],
  ["Leaning Cable Lateral","shoulders","כבלים","leaning+cable+lateral+raise",3,"12 כל צד","כתף אמצעית","הישן הרחק מהמגדל — טווח גדול"],
  ["Cable Y-Raise","shoulders","כבלים","cable+y+raise+form+lower+traps",3,"15","טרפזים תחתון, כתף","ידיים ל-Y מעל הראש — מטפח יציבה"],
  ["Cross Body Cable Raise","shoulders","כבלים","cross+body+cable+raise+form",3,"12 כל צד","כתף קדמית","כבל מהצד הנגדי — זווית חדשה"],
  ["Machine Shoulder Press","shoulders","מכונה","machine+shoulder+press+form",4,"10-12","כתפיים, טריצפס","כוון מושב — מרפקים ב-90° בתחתית"],
  ["Smith Machine OHP","shoulders","מכונה","smith+machine+overhead+press",4,"8-10","כתפיים, טריצפס","Smith מייצב — מתאים לשחזור"],
  ["Machine Rear Delt Fly","shoulders","מכונה","machine+rear+delt+fly+form",3,"15","כתף אחורית, טרפזים","שב הפוך — חזה על הריפוד"],
  ["Machine Front Raise","shoulders","מכונה","machine+front+raise+shoulders",3,"12","כתף קדמית","מכונה מעקרת תנופה — בידוד מלא"],
  ["Cable Behind-Back Lateral","shoulders","כבלים","behind+back+cable+lateral+raise",3,"12 כל צד","כתף אמצעית","כבל מאחורי הגוף — זווית ייחודית"],
  ["Cable Rope Upright Row","shoulders","כבלים","rope+upright+row+cable+form",3,"12","כתף, טרפזים","חבל — יד ניטרלית יותר ממוט"],
  ["Plate Front Raise","shoulders","ללא","plate+front+raise+shoulders",3,"12","כתף קדמית","צלחת — שינוי גריפ ועומס"],
  ["Cable Single Arm Front Raise","shoulders","כבלים","single+arm+cable+front+raise",3,"12 כל צד","כתף קדמית (בידוד)","כבל נמוך, הרם עד גובה עין"],
  ["Half-Kneeling Cable Press","shoulders","כבלים","half+kneeling+cable+press+form",3,"10 כל צד","כתף, ליבה","ברך אחת על הרצפה — מאתגר יציבה"],
  ["Dumbbell Rear Delt Row","shoulders","דמבלים","dumbbell+rear+delt+row+form",3,"15","כתף אחורית, טרפזים","כפוף 90°, מרפקים לצד"],
  // ── ARMS BICEP (13) ──
  ["Cable Concentration Curl","arms","כבלים","cable+concentration+curl+form",3,"12 כל צד","ביצפס (בידוד)","כבל נמוך, מרפק בין הירכיים"],
  ["Rope Hammer Curl","arms","כבלים","rope+hammer+curl+cable+form",3,"12","ביצפס, ברכיאליס","חבל — אחיזה ניטרלית עם מתח קבוע"],
  ["High Cable Curl","arms","כבלים","high+cable+curl+form+bicep",3,"12","ביצפס","כבל גבוה כנגד כובד — גדילת פסגה"],
  ["Low Cable Curl","arms","כבלים","low+cable+curl+form+bicep",3,"12","ביצפס","כבל נמוך — עיצוב בסיס הביצפס"],
  ["Cable 21s ביצפס","arms","כבלים","cable+21s+bicep+workout",3,"21","ביצפס (כל הטווח)","7 תחתית + 7 עליה + 7 מלא"],
  ["Unilateral Cable Curl","arms","כבלים","unilateral+cable+curl+form",3,"10 כל צד","ביצפס","כל יד בנפרד — מאזן חוזק"],
  ["Machine Preacher Curl","arms","מכונה","machine+preacher+curl+form",3,"12","ביצפס (בידוד מלא)","מכונה — מבטל תנופה לחלוטין"],
  ["EZ Bar Curl","arms","מוט","ez+bar+curl+bicep+form",3,"10-12","ביצפס, ברכיאליס","EZ מפחית עומס על שורש יד"],
  ["Barbell Preacher Curl","arms","ספסל","barbell+preacher+curl+form",3,"10","ביצפס","EZ או מוט ישר על מנשא"],
  ["Reverse Cable Curl","arms","כבלים","reverse+cable+curl+forearms",3,"12","אמות, ביצפס","כבל + אחיזה עליונה — קשה לאמות"],
  ["Cable Spider Curl","arms","כבלים","cable+spider+curl+form+bicep",3,"12","ביצפס ראש קצר","שכוב, ידיים תלויות — כבל"],
  ["Zottman Curl","arms","דמבלים","zottman+curl+form+bicep+forearm",3,"12","ביצפס + אמות","עלה סופינציה, רד פרונציה"],
  ["Cable Drag Curl","arms","כבלים","cable+drag+curl+form+bicep",3,"12","ביצפס (גיוס שונה)","משוך את הבר לאורך הגוף כלפי מעלה"],
  // ── ARMS TRICEP (14) ──
  ["Rope Pushdown","arms","כבלים","rope+pushdown+tricep+form",3,"12-15","טריצפס","פרוס את החבל בסיום — כיווץ מלא"],
  ["Reverse Grip Pushdown","arms","כבלים","reverse+grip+cable+pushdown",3,"12","טריצפס","אחיזה הפוכה — גדילת ראש אמצעי"],
  ["Single Arm Pushdown","arms","כבלים","single+arm+cable+pushdown+form",3,"12 כל צד","טריצפס","כל יד בנפרד — תיקון אסימטריה"],
  ["Overhead Cable Ext Rope","arms","כבלים","overhead+cable+extension+rope",3,"12","טריצפס ראש ארוך","עמוד גב לכבל, מרפקים מעל ראש"],
  ["Single Arm Cable Overhead","arms","כבלים","single+arm+cable+overhead+tricep",3,"12 כל צד","טריצפס ראש ארוך","כל יד בנפרד — טווח מלא"],
  ["Cable Kickback","arms","כבלים","cable+kickback+tricep+form",3,"12 כל צד","טריצפס","כבל נמוך, כפוף 45°, פשוט עד ישר"],
  ["Rope Overhead Ext","arms","כבלים","rope+overhead+tricep+extension",3,"12","טריצפס ראש ארוך","חבל מאחורי הראש — כיווץ בפסגה"],
  ["Cable Bar Pushdown","arms","כבלים","straight+bar+cable+pushdown+form",3,"12-15","טריצפס","מוט ישר — יותר עומס מחבל"],
  ["Machine Tricep Ext","arms","מכונה","machine+tricep+extension+form",3,"12","טריצפס (בידוד מלא)","מכונה — מבטל פיצוי גוף"],
  ["Tricep Dip Machine","arms","מכונה","tricep+dip+machine+form",3,"10-12","טריצפס, חזה תחתון","מכונה — כוון תנועה נגד כובד"],
  ["JM Press","arms","ספסל","jm+press+tricep+form",4,"8","טריצפס, חזה","ירד כ-Skull Crusher, לחץ כ-Close Grip"],
  ["Tate Press","arms","ספסל","tate+press+tricep+dumbbell",3,"10-12","טריצפס","פתח מרפקים לצד, לחץ מעלה"],
  ["Board Press","arms","ספסל","board+press+tricep+lockout",4,"5-6","טריצפס (לוק-אאוט)","מוט + לוח עץ — דגש על 1/3 העליון"],
  ["Cable Long Head Ext","arms","כבלים","cable+long+head+tricep+form",3,"12","טריצפס ראש ארוך","כבל נמוך מאחורי הגוף, פשוט מעלה"],
  // ── LEGS (8) ──
  ["Cable Pull-Through","legs","כבלים","cable+pull+through+glutes+form",3,"15","ישבן, המסטרינג","עמוד גב לכבל, כפוף מהירכיים"],
  ["Smith Machine Squat","legs","מכונה","smith+machine+squat+form",4,"10","קוואדריצפס, ישבן","רגליים קצת קדמה — Smith מייצב"],
  ["Lying Leg Curl","legs","מכונה","lying+leg+curl+hamstring+form",3,"12","המסטרינג","שכוב — כוון ריפוד לעקב, לא לקרסול"],
  ["Cable Romanian DL","legs","כבלים","cable+romanian+deadlift+form",3,"12","המסטרינג, ישבן","כבל נמוך — מתח קבוע לאורך כל התנועה"],
  ["Machine Glute Kickback","legs","מכונה","machine+glute+kickback+form",3,"15 כל צד","ישבן","כוון ריפוד לעקב, דחוף לאחור ולמעלה"],
  ["Cable Hip Flexion","legs","כבלים","cable+hip+flexion+form",3,"12 כל צד","ירכיים קדמיות","כבל על קרסול — הרם ברך לחזה"],
  ["Smith Machine Lunge","legs","מכונה","smith+machine+lunge+form",3,"10 כל צד","קוואדריצפס, ישבן","Smith מייצב — מתאים לשיקום"],
  ["Standing Leg Curl","legs","מכונה","standing+leg+curl+machine",3,"12 כל צד","המסטרינג","עמידה — גיוס שונה מ-Lying"],
  // ── CORE (4) ──
  ["Cable Oblique Crunch","core","כבלים","cable+oblique+crunch+form",3,"12 כל צד","אלכסוני","כבל גבוה, כרע וסובב לצד"],
  ["Standing Cable Lift","core","כבלים","cable+lift+core+oblique+form",3,"12 כל צד","אלכסוני, ליבה","תנועה אלכסונית מלמטה-צד לשמעלה"],
  ["Cable Anti-Rotation Hold","core","כבלים","cable+anti+rotation+pallof",3,"30 שניות כל צד","ליבה עמוק","החזק נגד כוח סיבוב — אנטי-רוטציה"],
  ["Kneeling Cable Oblique","core","כבלים","kneeling+cable+oblique+crunch",3,"15 כל צד","אלכסוני, בטן","כרע, כבל מהצד, כפוף לצד"],
];
_EX2.forEach(([name,groupKey,equipment,ytQ,sets,reps,muscles,tip]) => {
  const g = MUSCLE_GROUPS.find(x => x.key === groupKey);
  if (g) g.exercises.push({ name, muscles, tips: [tip], defaultSets: sets, defaultReps: reps, equipment, youtubeQuery: ytQ });
});

// ─── Batch 3: 100 Calisthenics & Bodyweight exercises ────────────────────────
const _EX3: _ES[] = [
  // ── CHEST (15) ──
  ["Pseudo Planche Push-up","chest","ללא","pseudo+planche+push+up+form",4,"8-10","חזה, כתפיים קדמיות","ידיים מופנות אחורה, הישן קדימה"],
  ["Ring Push-up","chest","טבעות","ring+push+up+form",3,"10-12","חזה, טריצפס, יציבות","הרחב הטבעות בסיום — כיווץ חזה מלא"],
  ["Ring Fly","chest","טבעות","ring+fly+chest+form",3,"8-10","חזה פנימי","תנועה איטית — שמור מרפקים קצת כפופים"],
  ["Ring Dip","chest","טבעות","ring+dips+form+chest",4,"8-10","חזה תחתון, טריצפס","הסתובב הטבעות החוצה בפסגה — RTO"],
  ["Typewriter Push-up","chest","ללא","typewriter+push+up+form",3,"6-8 כל צד","חזה (בידוד צד)","הסט לצד בתחתית — כוח חד-צדדי"],
  ["Archer Push-up מתקדם","chest","ללא","archer+push+up+advanced+form",3,"6-8 כל צד","חזה, כתפיים","יד ישרה לצד — מעבר לשכיבה יד אחת"],
  ["Tuck Planche","chest","ללא","tuck+planche+hold+form",3,"5-10 שניות","חזה, כתפיים קדמיות","ישבן קרוב לידיים, לחץ קרקע מטה"],
  ["Straddle Planche","chest","ללא","straddle+planche+hold+form",3,"3-8 שניות","חזה, כתפיים","רגליים פתוחות — פחות מנוף מ-Full"],
  ["Planche Push-up (Tuck)","chest","ללא","tuck+planche+push+up+form",3,"5-8","חזה, כתפיים","ירד לאיטיות — שמור כתפיים מעל ידיים"],
  ["Ring Push-up Lean","chest","טבעות","ring+push+up+lean+form",3,"10-12","חזה, יציבות","הישן קדימה עם הטבעות — Planche-like"],
  ["Spiderman Push-up","chest","ללא","spiderman+push+up+form",3,"10 כל צד","חזה, ליבה, ירכיים","קרב ברך לידי בכל חזרה"],
  ["Korean Dip","chest","מקבילים","korean+dip+form+chest",3,"8-10","חזה תחתון, כתף אחורית","ידיים מופנות אחורה — ייחודי!"],
  ["Superman Push-up","chest","ללא","superman+push+up+form",3,"5-8","חזה, גב, שרוול","מרחב ידיים קדימה לגמרי בתחתית"],
  ["Wide Clap Push-up","chest","ללא","wide+clap+push+up+form",3,"6-8","חזה, כוח פלייומטרי","התרומם מהר — מחיאת כפיים בפסגה"],
  ["Straddle Planche Push-up","chest","ללא","straddle+planche+push+up+form",3,"4-6","חזה, כתפיים","רגליים פתוחות, ירד לאיטיות"],
  // ── BACK (20) ──
  ["Muscle-Up (עליות כוח)","back","מתח","muscle+up+form+tutorial",3,"3-6","גב רחב, חזה, טריצפס","משוך מהר, עבור לדחיפה — שמור מרפקים"],
  ["Ring Muscle-Up","back","טבעות","ring+muscle+up+form",3,"3-5","גב רחב, חזה, טריצפס","Lean קדימה יותר מבר — תנועה חלקה"],
  ["Tuck Front Lever","back","מתח","tuck+front+lever+hold+form",3,"5-10 שניות","גב רחב, ליבה","ברכיים לחזה, ירכיים מקבילות לרצפה"],
  ["Straddle Front Lever","back","מתח","straddle+front+lever+form",3,"3-8 שניות","גב רחב, ליבה","רגליים פתוחות — שלב בין Tuck ל-Full"],
  ["Full Front Lever","back","מתח","full+front+lever+hold+form",3,"2-5 שניות","גב רחב, ליבה מלא","גוף ישר כחץ — העוצמה הגבוהה ביותר"],
  ["Front Lever Row","back","מתח","front+lever+row+form",3,"4-6","גב רחב, ביצפס","מ-Front Lever — כוף מרפקים"],
  ["Front Lever Pull-up","back","מתח","front+lever+pull+up+form",3,"3-5","גב רחב","הגיע ל-Front Lever בפסגה"],
  ["Tuck Back Lever","back","טבעות","tuck+back+lever+form",3,"5-10 שניות","כתף אחורית, גב","Skin the Cat → החזק"],
  ["Full Back Lever","back","טבעות","back+lever+full+form",3,"3-6 שניות","כתף אחורית, גב","גוף ישר מטה — בסיס ל-Planche"],
  ["Skin the Cat","back","טבעות","skin+the+cat+form+tutorial",3,"5-8","כתף, גב, גמישות","תנועה מלאה סביב הטבעות — הרחב כתפיים"],
  ["Typewriter Pull-up","back","מתח","typewriter+pull+up+form",3,"4-6 כל צד","גב רחב (חד-צדדי)","בפסגה — הסט לצד ישר"],
  ["Archer Pull-up","back","מתח","archer+pull+up+form",3,"4-6 כל צד","גב רחב, ביצפס","יד אחת ישרה, אחת כפופה"],
  ["Commando Pull-up","back","מתח","commando+pull+up+form",3,"6-8","גב אמצע, ביצפס","אחיזה מנוגדת — פנים ימינה ושמאלה"],
  ["Explosive Pull-up","back","מתח","explosive+pull+up+form",3,"5-7","גב רחב, כוח פלייומטרי","משוך בכוח — ידיים מעל הבר"],
  ["One Arm Pull-up Neg","back","מתח","one+arm+pull+up+negative",3,"3-5 כל יד","גב רחב (בידוד)","ירד לאיטיות עם יד אחת — 5 שניות"],
  ["Ring Row","back","טבעות","ring+row+form+tutorial",3,"10-12","גב אמצע, ביצפס","קרב ידיים לחזה — רגליים ישרות = קשה"],
  ["Ring Pull-up","back","טבעות","ring+pull+up+form",3,"6-10","גב רחב","הסתובב הטבעות בפסגה — חיזוק עצמות"],
  ["Wide Grip Pull-up","back","מתח","wide+grip+pull+up+form",3,"6-10","גב רחב (חיצוני)","אחיזה רחבה — V-Taper"],
  ["L-Sit Pull-up","back","מתח","l+sit+pull+up+form",3,"4-6","גב, ליבה","רגליים ישרות קדמה — כפל האתגר"],
  ["Negative Muscle-Up","back","מתח","negative+muscle+up+form",3,"3-5","גב, חזה","ירד לאיטיות מהנקודה הגבוהה"],
  // ── SHOULDERS (15) ──
  ["HSPU בקיר","shoulders","ללא","handstand+push+up+wall+form",4,"5-8","כתפיים, טריצפס","גב לקיר, ירד לאטי — שמור ליבה"],
  ["Strict HSPU","shoulders","ללא","strict+handstand+push+up+form",3,"4-6","כתפיים, טריצפס","ללא קיר — כוח כתפיים מלא"],
  ["Pike Push-up Elevated","shoulders","ספסל","elevated+pike+push+up+form",3,"8-10","כתפיים, טריצפס","רגליים גבוהות — קרוב יותר ל-HSPU"],
  ["Wall Walk","shoulders","ללא","wall+walk+handstand+form",3,"5-8","כתפיים, ליבה","עלה לאט לאורך הקיר עד עמידת ידיים"],
  ["Handstand Hold בקיר","shoulders","ללא","handstand+hold+wall+form",3,"20-60 שניות","כתפיים, יציבות","לחץ ידיים לרצפה — שמור גוף ישר"],
  ["Freestanding Handstand","shoulders","ללא","freestanding+handstand+form",3,"5-20 שניות","כתפיים, יציבות","אצבעות לוחצות — בלנס ייחודי"],
  ["Handstand Walk","shoulders","ללא","handstand+walking+form",3,"5-15 צעדים","כתפיים, ליבה","טלטול קטן קדימה — צעדים קצרים"],
  ["Ring HSPU","shoulders","טבעות","ring+handstand+push+up+form",3,"3-5","כתפיים, טריצפס","הקשה מבר — יציבות נוספת נדרשת"],
  ["Korean HSPU","shoulders","מקבילים","korean+hspu+parallel+bars",3,"3-5","כתפיים, חזה","ידיים מופנות אחורה על מקבילים"],
  ["Ring Shoulder Press","shoulders","טבעות","ring+shoulder+press+form",3,"6-8","כתפיים, טריצפס","כוון הטבעות החוצה — RTO בפסגה"],
  ["Planche Lean","shoulders","ללא","planche+lean+tutorial+form",3,"10-30 שניות","כתפיים קדמיות, ליבה","ידיים מופנות אחורה, הישן קדימה לאיטיות"],
  ["Superman Hold","shoulders","ללא","superman+hold+exercise+form",3,"5-10 שניות","גב תחתון, ישבן, כתפיים","שכוב על הבטן, הרם ידיים ורגליים"],
  ["Reverse Plank","shoulders","ללא","reverse+plank+tricep+form",3,"20-45 שניות","כתפיים אחוריות, טריצפס, ירכיים","ידיים מאחורה, גוף ישר — ישבן לא נופל"],
  ["Ring L-Sit Press","shoulders","טבעות","ring+l+sit+press+form",3,"4-6","כתפיים, ליבה","מ-L-Sit — דחוף גוף מעלה"],
  ["Hollow Body to Arch","shoulders","ללא","hollow+body+to+arch+swing+form",3,"8-10","כתפיים, ליבה, גב","Kipping תנועה — בסיס לעליות כוח"],
  // ── ARMS (15) ──
  ["Ring Dips מתקדם","arms","טבעות","ring+dips+advanced+form",3,"8-10","טריצפס, חזה, יציבות","RTO — הסתובב ידיים החוצה בפסגה"],
  ["L-Sit Dips","arms","מקבילים","l+sit+dips+form",3,"6-8","טריצפס, ליבה","שמור רגליים ישרות קדמה לאורך כל הסט"],
  ["Ring Tricep Ext","arms","טבעות","ring+tricep+extension+form",3,"8-10","טריצפס","נטה קדימה, פשוט מרפקים לסיום"],
  ["Korean Dips (Tricep)","arms","מקבילים","korean+dips+tricep+form",3,"8-10","טריצפס, כתף אחורית","ידיים אחורה — כיווץ טריצפס ייחודי"],
  ["Slow Negative Dips","arms","מקבילים","slow+negative+dips+form",3,"5-6 (5 שניות)","טריצפס","ירד ב-5 שניות — רק שלב אקצנטרי"],
  ["Ring Bicep Curl","arms","טבעות","ring+bicep+curl+form",3,"8-10","ביצפס","שקע מתחת לטבעות, כוף מרפקים"],
  ["Towel Pull-up Curl","arms","מתח","towel+pull+up+bicep+curl",3,"6-8","ביצפס, גב","מגבת על הבר — שלב גלילה + כפיפה"],
  ["Ring Face Pull","arms","טבעות","ring+face+pull+form",3,"12-15","כתף אחורית, שרוול","משוך הטבעות לפנים — פרוס מרפקים"],
  ["Ring Rows מתקדם","arms","טבעות","ring+rows+advanced+form",3,"10-12","גב, ביצפס","רגליים גבוהות — גוף אופקי = מקסימום"],
  ["Around the World Pull-up","arms","מתח","around+the+world+pull+up",3,"4-5","גב, ביצפס, כתפיים","תנועה מעגלית על הבר — מאתגר"],
  ["Ring Turn Out Dip","arms","טבעות","ring+turn+out+dip+form",3,"8-10","טריצפס, כתפיים","הסתובב ידיים ב-45° בפסגה"],
  ["Forearm to Push-up","arms","ללא","forearm+plank+to+push+up+form",3,"8-10","טריצפס, ליבה","מפלנק אמות — עלה לפלנק ידיים לסירוגין"],
  ["Pike Push-up Dip Combo","arms","ללא","pike+push+up+dip+combo",3,"8","כתפיים, טריצפס","Pike PU + Dip — שני תרגילים ברצף"],
  ["Hanging Straight Hold","arms","מתח","dead+hang+form+grip",3,"30-60 שניות","אמות, אחיזה, כתפיים","תלייה מלאה — מחזק אחיזה ושכמות"],
  ["Wrist Push-up","arms","ללא","wrist+push+up+form+forearm",3,"8-10","אמות, שורש יד","על גב הידיים — חיזוק שורש יד"],
  // ── LEGS (20) ──
  ["Pistol Squat","legs","ללא","pistol+squat+form+tutorial",3,"5-8 כל רגל","קוואדריצפס, ישבן, יציבות","שמור עקב בקרקע — ירד לאיטיות"],
  ["Shrimp Squat","legs","ללא","shrimp+squat+form+tutorial",3,"5-8 כל רגל","קוואדריצפס, ישבן","אחז קרסול מאחורה — ברך לרצפה"],
  ["Skater Squat","legs","ללא","skater+squat+form+tutorial",3,"6-8 כל רגל","קוואדריצפס, יציבות","רגל אחורית תלויה — ברך לכיוון הרצפה"],
  ["Single Leg RDL BW","legs","ללא","single+leg+rdl+bodyweight+form",3,"8-10 כל רגל","המסטרינג, ישבן, יציבות","גוף אופקי, ירד לאיטיות — T תנוחה"],
  ["Cossack Squat","legs","ללא","cossack+squat+form+tutorial",3,"8-10 כל צד","קוואדריצפס, ירכיים, גמישות","ירד לצד — רגל נגדית ישרה"],
  ["Dragon Squat","legs","ללא","dragon+squat+form+tutorial",3,"5-6 כל רגל","קוואדריצפס, ישבן, ליבה","רגל אחורית עוברת מתחת — פיתול"],
  ["Sissy Squat","legs","ללא","sissy+squat+form+tutorial",3,"10-12","קוואדריצפס (בידוד)","ברכיים קדימה, פסג'ה מאחורה"],
  ["Nordic Curl Eccentric","legs","ללא","nordic+curl+eccentric+form",3,"4-6","המסטרינג (כוח אקצנטרי)","ירד לאיטיות — עלה בכוח ידיים"],
  ["Reverse Nordic Curl","legs","ללא","reverse+nordic+curl+form",3,"8-10","קוואדריצפס","ישב על עקבים, שכוב אחורה לאיטיות"],
  ["Tuck Jump","legs","ללא","tuck+jump+form+plyometric",3,"8-10","כל הרגל, קרדיו","קפוץ — קרב ברכיים לחזה"],
  ["Broad Jump","legs","ללא","broad+jump+form+power",3,"5-6","כל הרגל, כוח מתפרץ","קפוץ כמה שיותר קדימה — נחת בעדינות"],
  ["180 Jump Squat","legs","ללא","180+jump+squat+form",3,"8 כל כיוון","כל הרגל, תיאום","סובב 180° באוויר — נחת ישר"],
  ["Box Jump","legs","ספסל","box+jump+form+tutorial",3,"6-8","כל הרגל, כוח מתפרץ","נחת רך על ספסל — ירד לאיטיות"],
  ["Depth Jump","legs","ספסל","depth+jump+form+tutorial",3,"5-6","כל הרגל, ריאקציה","ירד מספסל — קפץ מיד עם נגיעה"],
  ["Single Leg Glute Bridge BW","legs","ללא","single+leg+glute+bridge+form",3,"12-15 כל רגל","ישבן, המסטרינג","כף רגל אחת — סחוט ישבן בפסגה"],
  ["Plyometric Lunge","legs","ללא","plyometric+lunge+jump+form",3,"8 כל רגל","כל הרגל, קרדיו","קפץ בין לאנגים — החלפת רגליים"],
  ["Explosive Step-up","legs","ספסל","explosive+step+up+form",3,"8 כל רגל","קוואדריצפס, ישבן","קפץ מהספסל — כוח פלייומטרי"],
  ["Single Leg Calf Raise BW","legs","ללא","single+leg+calf+raise+form",3,"15-20 כל רגל","שוקיים","על קצות אצבעות — החזק שנייה"],
  ["Pistol Squat Progression","legs","ללא","pistol+squat+progression+steps",3,"8 כל רגל","קוואדריצפס, יציבות","אחז ידיים קדימה לתמיכה — בנה לאיטיות"],
  ["Burpee + Pistol","legs","ללא","burpee+pistol+squat+combo",3,"5 כל רגל","כל הגוף, קרדיו","Burpee מלא → Pistol — מתקדם מאוד"],
  // ── CORE (15) ──
  ["L-Sit (מקבילים)","core","מקבילים","l+sit+parallel+bars+form",3,"5-15 שניות","ליבה, טריצפס, ירכיים","לחץ ידיים מטה — רגליים מקבילות לרצפה"],
  ["V-Sit","core","מקבילים","v+sit+form+tutorial",3,"3-8 שניות","ליבה, ירכיים, יציבות","V חד — ידיים על המקבילים, גוף V"],
  ["Tuck L-Sit","core","מקבילים","tuck+l+sit+form+beginners",3,"5-15 שניות","ליבה, טריצפס","ברכיים כפופות — הקדמה ל-L-Sit"],
  ["Human Flag (Tuck)","core","מקבילים","human+flag+tuck+progression",3,"3-8 שניות","ליבה צדדי, כתפיים","ברכיים קרובות — ראשון ב-Human Flag"],
  ["Full Human Flag","core","מקבילים","full+human+flag+form",3,"2-5 שניות","ליבה, כתפיים, גוף שלם","גוף אופקי ישר — עוצמה גבוהה"],
  ["Dragon Flag (Full)","core","ספסל","dragon+flag+full+form",3,"4-6","ליבה, בטן ישרה","ירד גוף ישר מאחורה — Bruce Lee"],
  ["Dragon Flag Negative","core","ספסל","dragon+flag+negative+eccentric",3,"3-5","ליבה","רק שלב ירידה — 5 שניות"],
  ["Ring L-Sit","core","טבעות","ring+l+sit+form",3,"5-15 שניות","ליבה, טריצפס","קשה יותר ממקבילים — יציבות נוספת"],
  ["Ring Tuck L-Sit","core","טבעות","ring+tuck+l+sit+form",3,"5-15 שניות","ליבה, טריצפס","ברכיים כפופות על הטבעות"],
  ["Toes to Bar","core","מתח","toes+to+bar+form+tutorial",3,"8-10","בטן תחתונה, ירכיים","תלה — הגע עם אצבעות הרגל לבר"],
  ["Windshield Wipers","core","מתח","windshield+wipers+abs+form",3,"6-8 כל צד","אלכסוני, בטן","תלה — סובב רגליים ישרות לצד"],
  ["Hollow Body Rock","core","ללא","hollow+body+rock+form",3,"10-15","ליבה עמוק, בטן","גב מרוסק לרצפה — נדנד אחורה-קדמה"],
  ["Straddle L-Sit","core","מקבילים","straddle+l+sit+form",3,"5-10 שניות","ליבה, ירכיים גמישות","רגליים פתוחות — פחות קשה מ-V-Sit"],
  ["Planche Shrug","core","ללא","planche+shrug+form+tutorial",3,"8-10","כתפיים, ליבה","ידיים על הרצפה, הרם גוף בלחיצת כתפיים"],
  ["Ab Wheel from Knees","core","ללא","ab+wheel+rollout+knees+form",3,"8-12","ליבה עמוק, גב תחתון","גב ישר לחלוטין בנקודת הקצה"],
];
_EX3.forEach(([name,groupKey,equipment,ytQ,sets,reps,muscles,tip]) => {
  const g = CALISTHENICS_MUSCLE_GROUPS.find(x => x.key === groupKey);
  if (g) g.exercises.push({ name, muscles, tips: [tip], defaultSets: sets, defaultReps: reps, equipment, youtubeQuery: ytQ });
});

const _EX4: _ES[] = [
  // ── CHEST (16) ────────────────────────────────────────────────────────────
  ["שכיבת יד אחת (One-Arm Push-up)","chest","ללא","one+arm+push+up+progression",3,"3-5 כל צד","חזה, טריצפס, ליבה","רגליים רחבות בהתחלה — הצר בהדרגה"],
  ["שכיבות ירידה (Decline Push-up)","chest","ספסל / כסא","decline+push+up+upper+chest",3,"12-15","חזה עליון, כתפיים","רגליים מורמות — ירד עמוק ומבוקר"],
  ["שכיבות עלייה (Incline Push-up)","chest","ספסל / כסא","incline+push+up+lower+chest",3,"12-15","חזה תחתון, כתפיים","ידיים על ספסל — זווית נמוכה = קשה יותר"],
  ["Hindu Push-up","chest","ללא","hindu+push+up+tutorial",3,"10-12","חזה, כתפיים, גב תחתון","גלגול גוף נוזלי — C לאחור בסיום"],
  ["Dive Bomber Push-up","chest","ללא","dive+bomber+push+up+form",3,"8-10","חזה, כתפיים, טריצפס","תנועה קשתית — מנע מגע רצפה"],
  ["שכיבות מחיאת כף (Clap Push-up)","chest","ללא","clap+push+up+explosive+chest",3,"6-8","חזה, שרירי מהירות","דחוף חזק — מחא לפני הנחיתה"],
  ["שכיבות עם עצירה (Pause Push-up)","chest","ללא","pause+push+up+chest+tension",3,"8-10","חזה, מתח איזומטרי","עצור 2 שניות בתחתית — אין קפיץ"],
  ["Tiger Bend Push-up","chest","ללא","tiger+bend+push+up+form",3,"5-8","חזה, טריצפס, כתפיים","ירד למרפקים ואז דחוף — מעבר מתקדם"],
  ["Ring Support Hold","chest","טבעות","ring+support+hold+gymnastics",4,"15-30 שניות","חזה, כתפיים, ליבה","טבעות מסובבות כלפי חוץ — גוף ישר"],
  ["Ring Push-up Narrow","chest","טבעות","ring+push+up+narrow+grip+chest",3,"10-12","חזה פנימי, טריצפס","אחיזה צרה — מרפקים צמודים לגוף"],
  ["Ring Chest Fly Hold","chest","טבעות","ring+flye+static+hold+chest",3,"10-15 שניות","חזה, כתפיים","החזק פתיחה 90° — בנה כוח לפלנץ׳"],
  ["Walking Push-up","chest","ללא","walking+push+up+lateral+chest",3,"8 כל כיוון","חזה, ליבה, קואורדינציה","צעד צד + שכיבה — גוף ישר לאורך"],
  ["Assisted One-Arm Push-up","chest","ללא","assisted+one+arm+push+up+chest",3,"6-8 כל צד","חזה, טריצפס, ליבה","יד שנייה על אגרוף — גבש כוח הדרגתי"],
  ["Staggered Push-up","chest","ללא","staggered+hand+push+up+unilateral",3,"10 כל צד","חזה, ליבה, עבודה לא-סימטרית","יד קדימה יד אחורה — מחליף צדדים"],
  ["Pike Fly Push-up","chest","ללא","pike+push+up+wide+chest+variation",3,"8-10","חזה עליון, כתפיים","ידיים רחבות בפייק — פתיחת טווח"],
  ["Ring Push-up Lean Wide","chest","טבעות","ring+push+up+lean+planche+prep",3,"8-10","חזה תחתון, כתפיים קדמיות","גוף בזווית קדימה — בסיס לפלנץ׳"],
  // ── BACK (20) ─────────────────────────────────────────────────────────────
  ["Scapula Pull-up","back","מוט מתח","scapula+pull+up+shoulder+health",4,"10-12","שרירי שכמות, גב עליון","ידיים ישרות — הרם שכמות בלבד"],
  ["Passive Hang","back","מוט מתח","passive+hang+shoulder+decompression",3,"30-60 שניות","כתף, אחיזה, דקומפרסיה","תלה ושחרר — בריאות כתפיים"],
  ["Active Hang","back","מוט מתח","active+hang+scapular+depression",3,"20-40 שניות","שכמות, גב","משוך שכמות למטה — לא תלייה סבילה"],
  ["Negative Pull-up איטי","back","מוט מתח","slow+negative+pull+up+6+seconds",4,"5-6","גב רחב, ביצפס","עלה בקפיצה — ירד ב-6 שניות מבוקרות"],
  ["Jumping Pull-up","back","מוט מתח","jumping+pull+up+beginner+lat",3,"8-10","גב, ביצפס, כתפיים","קפוץ לעזור בעלייה — ירד לאט"],
  ["Hollow Body Pull-up","back","מוט מתח","hollow+body+pull+up+gymnastics",3,"5-8","גב, ליבה, כתפיים","ליבה מכווצת לאורך כל התנועה"],
  ["Ring Inverted Row","back","טבעות","ring+inverted+row+back+form",3,"10-15","גב אמצע, ביצפס","גוף ישר כקרש — משוך טבעות לחזה"],
  ["Tuck Front Lever Raises","back","מוט מתח","tuck+front+lever+raises+back",4,"5-8","גב רחב, ליבה, כתפיים","שמור פוזיציה — ירד מבוקר"],
  ["Front Lever Raises (Full)","back","מוט מתח","front+lever+raises+advanced+straight",3,"3-5","גב, ליבה, כתפיים","שלוט בירידה — הגבה חזרה בכוח"],
  ["One-Arm Ring Row","back","טבעות","one+arm+ring+row+progression+back",3,"8-10 כל צד","גב, ביצפס","יד אחת — שנייה רק לאיזון קל"],
  ["Ring Tuck Row","back","טבעות","ring+tuck+row+gymnastics+back",3,"8-10","גב, ביצפס, כתפיים","ידיים ישרות בפתיחה — משוך חזה לטבעות"],
  ["Narrow Grip Pull-up","back","מוט מתח","narrow+grip+pull+up+bicep+lat",3,"6-10","גב, ביצפס","ידיים צמודות — לחץ ביצפס בשיא"],
  ["Stacked Grip Pull-up","back","מוט מתח","stacked+grip+pull+up+one+arm+prep",3,"5-8","גב, ביצפס","יד אחת על השנייה — קירוב לעלייה ביד אחת"],
  ["Ring Face Pull","back","טבעות","ring+face+pull+rear+delt+form",3,"12-15","כתף אחורית, טרפזים","משוך לפנים ולמעלה — מרפקים גבוהים"],
  ["Pike Row","back","מוט נמוך / שולחן","pike+row+bodyweight+back",3,"10-12","גב אמצע, ביצפס","ירכיים בזווית — הרחב טווח תנועה"],
  ["Muscle-Up Transition Hold","back","טבעות","muscle+up+transition+hold+rings",3,"5-8 שניות","גב, כתפיים, טריצפס","עצור בנקודת המעבר — חיזוק חולשה"],
  ["Bat Wing Row Hold","back","מוט נמוך / שולחן","bat+wing+row+isometric+back",3,"10-12","גב אמצע, שרמוד","משוך שכמות לאחור — החזק 2 שניות"],
  ["Hanging Scapular Retraction","back","מוט מתח","hanging+scapular+retraction+upper+back",3,"10-12","שכמות, גב עליון","תלה ידיים ישרות — הרם גוף בשכמות"],
  ["Tuck Back Lever Raises","back","מוט מתח","tuck+back+lever+raises+back",3,"6-8","גב, ליבה","מאחסון — ירד לBack Lever ועלה"],
  ["Half Muscle-Up Hold","back","מוט מתח","half+muscle+up+hold+bar+progression",3,"5-10 שניות","גב, כתפיים, טריצפס","עצור בנקודת מעבר — בנה כוח ספציפי"],
  // ── SHOULDERS (16) ────────────────────────────────────────────────────────
  ["Box Pike Push-up","shoulders","ספסל / כסא","box+pike+push+up+shoulders+elevated",3,"10-12","כתפיים, טריצפס","רגליים על ספסל — זווית חדה יותר מפייק"],
  ["HSPU אחיזה צרה (Tricep Focus)","shoulders","קיר","handstand+push+up+narrow+grip+tricep",3,"5-8","טריצפס, כתפיים","מרפקים צמודים — עומס על טריצפס"],
  ["Pike Push-up + Push-up Combo","shoulders","ללא","pike+push+up+to+push+up+flow",3,"8-10","כתפיים, חזה, טריצפס","תנועה רציפה בין שני דפוסים"],
  ["L-Sit to Press Prep","shoulders","מקבילים","l+sit+to+press+handstand+prep",3,"5-8","כתפיים, ליבה, טריצפס","דחוף גוף מ-L-Sit כלפי מעלה"],
  ["Pseudo Planche Push-up Lean","shoulders","ללא","pseudo+planche+push+up+lean+shoulder",4,"8-10","כתפיים קדמיות, חזה","ידיים לצד הירכיים — גוף נוטה קדימה"],
  ["Tuck Planche Push-up","shoulders","מקבילים","tuck+planche+push+up+form+shoulder",3,"5-6","כתפיים, חזה, ליבה","החזק Tuck Planche — בצע לחיצה מלאה"],
  ["Maltese Lean Hold","shoulders","מקבילים","maltese+lean+shoulder+strength+parallel",3,"10-15 שניות","כתפיים, חזה","ידיים רחבות לצדדים — הטייה קדימה"],
  ["Tiger Bend HSPU","shoulders","קיר","tiger+bend+handstand+push+up+advanced",3,"3-5","כתפיים, טריצפס","ירד על מרפקים ואז דחוף — מתקדם"],
  ["Ring HSPU Elevated","shoulders","טבעות","ring+handstand+push+up+advanced+form",3,"3-5","כתפיים, טריצפס, יציבות","טבעות חופשיות — יציבות גבוהה נדרשת"],
  ["Ring Lateral Raise","shoulders","טבעות","ring+lateral+raise+bodyweight+shoulder",3,"10-12","כתפיים צד, טרפזים","ידיים פתוחות — תנועה נוזלית ומבוקרת"],
  ["Superman Push-up","shoulders","ללא","superman+push+up+shoulder+back",3,"5-8","כתפיים, גב, ליבה","הארך ידיים מעל הראש בנחיתה"],
  ["Elevated Ring Pike Push-up","shoulders","טבעות","ring+pike+push+up+elevated+feet",3,"8-10","כתפיים, טריצפס","רגליים על ספסל + ידיים בטבעות — כפולה"],
  ["Wall Walk + HSPU","shoulders","קיר","wall+walk+handstand+push+up+combo",3,"5-6","כתפיים, כל הגוף","Walk up — HSPU — Walk down — רצף"],
  ["Ring L-Sit to Shoulder Press","shoulders","טבעות","ring+l+sit+shoulder+press+core",3,"5-8","כתפיים, ליבה","שמור L-Sit תוך כדי לחיצה כלפי מעלה"],
  ["Straddle Planche Lean Floor","shoulders","ללא","straddle+planche+lean+floor+shoulder",3,"10-20 שניות","כתפיים קדמיות, חזה","רגליים פתוחות — מפחית עומס ליבה"],
  ["Ring Dip to Support Hold","shoulders","טבעות","ring+dip+support+hold+shoulder",4,"8-10","כתפיים, טריצפס","עצור 2 שניות בשיא — כוח safety כתפיים"],
  // ── ARMS (16) ─────────────────────────────────────────────────────────────
  ["Assisted One-Arm Chin-up","arms","מוט מתח","assisted+one+arm+chin+up+progression",3,"5-6 כל צד","ביצפס, גב","אצבעות יד שנייה על מוט — סיוע חלקי"],
  ["Ring Chin-up with Pause","arms","טבעות","ring+chin+up+pause+top+bicep",3,"6-8","ביצפס, גב","עצור 2 שניות בשיא — סיבוב טבעות פנימה"],
  ["Hammer Grip Pull-up","arms","מוט מתח","hammer+grip+neutral+pull+up",3,"8-10","ביצפס, גב, אמות","אחיזה ניטרלית — עומס מאוזן"],
  ["Negative One-Arm Chin-up","arms","מוט מתח","negative+one+arm+chin+up+eccentric",3,"3-4 כל צד","ביצפס, גב","קפוץ בשתיים — ירד ביד אחת ב-6 שניות"],
  ["Ring Bicep Curl Supination","arms","טבעות","ring+bicep+curl+supination+form",3,"10-12","ביצפס, אמות","סובב ידיים בשיא — הפעלה מלאה"],
  ["Ring Tricep Dip Slow","arms","טבעות","ring+tricep+dip+slow+negative+arms",3,"8-10","טריצפס, כתפיים","ירד ב-3 שניות — שלוט בנקודה תחתונה"],
  ["Korean Dip Eccentric","arms","מקבילים","korean+dip+eccentric+tricep+form",3,"5-6","טריצפס, כתפיים אחורי","ירד לאחור לאט — עומס אקסנטרי גבוה"],
  ["Ring Row Underhand","arms","טבעות","ring+row+underhand+bicep+focus",3,"10-12","ביצפס, גב, אמות","אחיזה הפוכה — מקסם עבודת ביצפס"],
  ["Towel Chin-up","arms","מוט מתח","towel+chin+up+grip+strength+bicep",3,"6-8","ביצפס, אחיזה","מגבות על המוט — כוח אחיזה וביצפס"],
  ["Ring Around The World","arms","טבעות","ring+around+the+world+gymnastics+arms",3,"5-6 כל כיוון","כתפיים, ביצפס, טריצפס","מעגל רחב בטבעות — שליטה מלאה"],
  ["Forearm Stand Push-up","arms","ללא","forearm+stand+push+up+tricep",3,"10-15 שניות","טריצפס, כתפיים, ליבה","הישען על מרפקים — בנה יציבות"],
  ["Ring Overhead Tricep Extension","arms","טבעות","ring+tricep+extension+overhead+arms",3,"10-12","טריצפס","ידיים ישרות מעל — כופף רק מרפקים"],
  ["False Grip Chin-up","arms","מוט מתח","false+grip+chin+up+wrist+muscle+up",3,"5-8","ביצפס, אמות, אחיזה","פרק יד מעל הבר — מרכיב ל-Muscle-Up"],
  ["Ring Push-up Narrow to Wide","arms","טבעות","ring+push+up+narrow+to+wide+tricep",3,"8-10","טריצפס, חזה","התחל צר — הרחב בסיום — range מלא"],
  ["Narrow Parallette Dip","arms","מקבילים","narrow+parallette+dip+tricep+focus",3,"10-12","טריצפס, חזה תחתון","מקבילים קרובים — דגש על טריצפס"],
  ["Ring Lockout Hold","arms","טבעות","ring+lockout+straight+arm+hold",4,"10-20 שניות","טריצפס, כתפיים","נעל מרפקים בשיא — straight-arm strength"],
  // ── LEGS (17) ─────────────────────────────────────────────────────────────
  ["Single Leg Squat to Box","legs","ספסל / כסא","single+leg+squat+to+box+pistol+prog",4,"8-10 כל צד","קוואדריצפס, ישבן","נגע לספסל בלבד — אל תשב עליו"],
  ["Assisted Pistol Squat","legs","קיר","assisted+pistol+squat+wall+bodyweight",3,"8-10 כל צד","קוואדריצפס, ישבן, שיווי משקל","יד על קיר לאיזון — הורד עד הרצפה"],
  ["Eccentric Pistol Squat","legs","ללא","eccentric+pistol+squat+negative",3,"5-6 כל צד","קוואדריצפס, ישבן","ירד ב-5 שניות — עלה בשתי רגליים"],
  ["Nordic Curl על טבעות","legs","טבעות","nordic+hamstring+curl+rings+feet",3,"5-8","המסטרינג, גב תחתון","רגליים קבועות בטבעות — ירד בשליטה"],
  ["Single Leg Wall Sit","legs","קיר","single+leg+wall+sit+quad+strength",3,"20-30 שניות כל","קוואדריצפס, יציבות","ברך אחת 90° לקיר — לא לנדנד"],
  ["Curtsy Lunge","legs","ללא","curtsy+lunge+glute+form",3,"12 כל צד","ישבן, קוואדריצפס, יציבות","רגל אחורית חוצה — כרכתי עמוק"],
  ["Lateral Lunge","legs","ללא","lateral+lunge+bodyweight+inner+thigh",3,"10 כל צד","ישבן, מפשעה, קוואדריצפס","פסיעה לצד — ישב עמוק על הרגל"],
  ["Frog Squat","legs","ללא","frog+squat+deep+mobility+strength",3,"15-20","ישבן, מפשעה, שרירי ירך","עקבים על הרצפה — ברכיים פתוחות"],
  ["Sprint Bounds","legs","ללא","sprint+bounds+plyometric+power+legs",3,"10 כל רגל","כל הרגל, כוח אקספלוסיבי","קפץ מרגל לרגל — מקסם שלב תעופה"],
  ["Step-Down Eccentric","legs","ספסל / כסא","step+down+eccentric+pistol+neg+quad",3,"8 כל צד","קוואדריצפס, ישבן","ירד מספסל ברגל אחת ב-3 שניות"],
  ["Reverse Nordic Curl","legs","ללא","reverse+nordic+curl+quad+eccentric",3,"5-8","קוואדריצפס, שרירי קדמיים","ברכיים על מושטח — הטה גוף לאחור"],
  ["Lateral Box Jump","legs","ספסל / כסא","lateral+box+jump+power+legs",3,"6-8 כל צד","כל הרגל, קואורדינציה","קפץ לצד על הספסל — נחת שתי רגליים"],
  ["Single Leg Hop Continuous","legs","ללא","single+leg+hop+continuous+balance",3,"20 שניות כל","כל הרגל, שיווי משקל","קפיצות קטנות ורציפות — רגל אחת"],
  ["Cossack Squat Deep","legs","ללא","cossack+squat+advanced+deep+flexibility",3,"8-10 כל צד","מפשעה, קוואדריצפס, גמישות ירך","ישב עמוק — אצבעות רגל ישרה למעלה"],
  ["Dragon Squat Advanced","legs","ללא","dragon+squat+advanced+hip+mobility",3,"6-8 כל צד","ירך, ישבן, קואורדינציה","רגל אחורית מאחורי קדמית — מתקדם"],
  ["Glute Bridge Marching","legs","ללא","glute+bridge+march+stability+core",3,"10 כל רגל","ישבן, ליבה","הרם ירכיים → הרם ברכיים לסירוגין"],
  ["Single Leg Box Jump","legs","ספסל / כסא","single+leg+box+jump+power+advanced",3,"5 כל רגל","כל הרגל, כוח אקספלוסיבי","קפץ ונחת על אותה רגל על הספסל"],
  // ── CORE (15) ─────────────────────────────────────────────────────────────
  ["Hanging Leg Raise ישר","core","מוט מתח","hanging+straight+leg+raise+abs",4,"8-12","בטן, Hip Flexors","רגליים ישרות לחלוטין — בלי תנופה"],
  ["Dragon Flag Incline","core","ספסל / כסא","dragon+flag+incline+bench+progression",3,"5-8","בטן, גב תחתון","על ספסל בזווית — קל יותר לבנות כוח"],
  ["Straddle L-Sit Floor","core","מקבילים","straddle+l+sit+floor+core+form",3,"10-15 שניות","ליבה, טריצפס, כתפיים","רגליים פתוחות לצד — פחות עומס גמישות"],
  ["Copenhagen Plank","core","ספסל / כסא","copenhagen+plank+adductor+core",3,"20-30 שניות כל","מפשעה, ליבה, יציבות","רגל עליונה על ספסל — גוף ישר"],
  ["Side Plank Hip Raises","core","ללא","side+plank+hip+raise+obliques+form",3,"12-15 כל צד","אלכסונים, ליבה","הורד ירך ואז הרם מעל קו הגוף"],
  ["Ring Ab Rollout","core","טבעות","ring+ab+rollout+core+advanced",3,"8-10","ליבה, כתפיים, גב","ידיים בטבעות — גלגל קדימה וחזור"],
  ["Stir the Pot","core","ספסל / כסא","stir+the+pot+plank+core+stability",3,"8 כל כיוון","ליבה עמוק, כתפיים","מרפקים על כדור/ספסל — מעגלים"],
  ["Bicycle Crunch Premium","core","ללא","bicycle+crunch+proper+form+obliques",3,"15-20 כל צד","אלכסונים, בטן","מרפק לברך שנייה — אל תמשוך צוואר"],
  ["Reverse Crunch","core","ללא","reverse+crunch+lower+abs+form",3,"12-15","בטן תחתונה, Hip Flexors","הרם אגן מהרצפה — לא רגליים בלבד"],
  ["Knee Raises on Parallettes","core","מקבילים","parallel+bar+knee+raise+abs+form",4,"12-15","בטן, Hip Flexors","תמוך על מקבילים — הרם ברכיים לחזה"],
  ["Plank Knee to Elbow","core","ללא","plank+knee+to+elbow+oblique+core",3,"10-12 כל צד","אלכסונים, ליבה","ממצב פלנק — ברך לכיוון מרפק שנייה"],
  ["Ab Wheel Standing Rollout","core","ללא","ab+wheel+standing+rollout+advanced",3,"5-8","ליבה, גב תחתון","מעמד זקוף — לא לרצפה ישר מדי"],
  ["Tuck Planche Shrug","core","מקבילים","planche+shrug+scapular+depression+core",3,"10-12","ליבה, כתפיים, שכמות","הרם גוף בשיכוב שכמות — Planche prep"],
  ["Windshield Wipers Tuck Hanging","core","מוט מתח","windshield+wipers+tuck+hanging+obliques",3,"8-10 כל צד","אלכסונים, ליבה","תלה — הנע ברכיים מצד לצד"],
  ["V-Sit Hold","core","מקבילים","v+sit+gymnastics+hold+core+hip+flexor",4,"10-20 שניות","ליבה, Hip Flexors, טריצפס","רגליים וגוף ב-V — שמור ללא רעד"],
];
_EX4.forEach(([name,groupKey,equipment,ytQ,sets,reps,muscles,tip]) => {
  const g = CALISTHENICS_MUSCLE_GROUPS.find(x => x.key === groupKey);
  if (g) g.exercises.push({ name, muscles, tips: [tip], defaultSets: sets, defaultReps: reps, equipment, youtubeQuery: ytQ });
});

const _EX5: _ES[] = [
  // ── CHEST 35 ─────────────────────────────────────────────────────────────
  // upper 12
  ["לחיצת מוט משופעת (Incline Barbell)","chest","ספסל + מוט","incline+barbell+bench+press+form",4,"8-10","חזה עליון, כתפיים","30° מיטבי"],
  ["פרפר דמבלים משופע","chest","ספסל + דמבלים","incline+dumbbell+fly+upper+chest",3,"12-15","חזה עליון","מרפק קל כפוף"],
  ["כבל נמוך-לגבוה (Low-to-High)","chest","כבלים","low+to+high+cable+fly+upper+chest",3,"12-15","חזה עליון","זווית עולה"],
  ["Incline Smith Machine Press","chest","מכונה","smith+machine+incline+press+chest",4,"10-12","חזה עליון, כתפיים","מסלול קבוע"],
  ["Squeeze Press משופע","chest","ספסל + דמבלים","incline+squeeze+press+chest+upper",3,"12-15","חזה עליון","לחץ כל העלייה"],
  ["Hammer Strength Incline Press","chest","מכונה","hammer+strength+incline+press+form",4,"10-12","חזה עליון","Iso-lateral"],
  ["כבל חד-צדדי משופע","chest","כבלים","single+arm+cable+fly+incline+chest",3,"12-15","חזה עליון","חד-צדדי"],
  ["Landmine Press חזה","chest","מוט","landmine+press+chest+form",3,"12-15","חזה עליון, כתף קדמית","ידיים מאוחדות"],
  ["DB Pullover (Lat-Chest)","chest","ספסל + דמבלים","dumbbell+pullover+chest+lat+form",3,"12-15","חזה עליון, גב","קשת רחבה"],
  ["High-Incline 75° DB Press","chest","ספסל + דמבלים","high+incline+dumbbell+press+front+delt",3,"10-12","חזה עליון, כתף קדמית","שיפוע תלול"],
  ["Incline Cable Fly","chest","כבלים","incline+cable+chest+fly+upper",3,"12-15","חזה עליון","כבל מלמטה"],
  ["Reverse Grip Bench Press","chest","ספסל + מוט","reverse+grip+bench+press+upper+chest",3,"8-10","חזה עליון, טריצפס","אחיזה הפוכה"],
  // mid 14
  ["Pause Bench Press","chest","ספסל + מוט","pause+bench+press+powerlifting+form",4,"5-6","חזה, טריצפס","2 שניות תחתון"],
  ["Flat Dumbbell Fly","chest","ספסל + דמבלים","flat+dumbbell+fly+chest+form",3,"12-15","חזה","מרפקים קלות כפופים"],
  ["Pec Deck מכונה","chest","מכונה","pec+deck+machine+chest+form",3,"12-15","חזה","סגירה מלאה"],
  ["Cable Crossover אמצע","chest","כבלים","cable+crossover+chest+mid+form",3,"12-15","חזה","כבלים ברמת כתף"],
  ["Smith Machine Flat Press","chest","מכונה","smith+machine+flat+bench+press+form",4,"8-12","חזה, טריצפס","Pause תחתון"],
  ["Neutral Grip DB Press","chest","ספסל + דמבלים","neutral+grip+dumbbell+bench+press",4,"10-12","חזה, טריצפס","מקבילות ידיים"],
  ["Iso-Lateral Chest Press","chest","מכונה","iso+lateral+chest+press+machine+form",3,"12-15","חזה","יד אחת בכל פעם"],
  ["Squeeze Press שטוח","chest","ספסל + דמבלים","dumbbell+squeeze+press+flat+chest",3,"12-15","חזה פנימי","לחץ תמידי"],
  ["Wide Grip Bench Press","chest","ספסל + מוט","wide+grip+bench+press+chest+form",4,"8-10","חזה חיצוני","אחיזה רחבה"],
  ["Close Grip Bench Press","chest","ספסל + מוט","close+grip+bench+press+tricep+chest",4,"8-10","חזה פנימי, טריצפס","אחיזה צרה"],
  ["Cable Fly מקביל לחזה","chest","כבלים","cable+chest+fly+parallel+mid",3,"12-15","חזה אמצעי","רמת חזה"],
  ["Hammer Strength Flat Press","chest","מכונה","hammer+strength+flat+press+chest+form",4,"10-12","חזה","Iso-lateral"],
  // lower 9
  ["לחיצת מוט שיפוע שלילי","chest","ספסל + מוט","decline+barbell+bench+press+form",4,"8-10","חזה תחתון, טריצפס","שיפוע שלילי"],
  ["לחיצת דמבלים שיפוע שלילי","chest","ספסל + דמבלים","decline+dumbbell+press+lower+chest+form",4,"10-12","חזה תחתון","שיפוע שלילי"],
  ["Decline Dumbbell Fly","chest","ספסל + דמבלים","decline+dumbbell+fly+lower+chest+form",3,"12-15","חזה תחתון","שיפוע שלילי"],
  ["High-to-Low Cable Fly","chest","כבלים","high+to+low+cable+fly+lower+chest",3,"12-15","חזה תחתון","זווית יורדת"],
  ["Chest Dips מקבילים","chest","מכונה","parallel+bar+chest+dips+form",3,"10-15","חזה תחתון, טריצפס","הטה גוף קדימה"],
  ["Decline Smith Machine Press","chest","מכונה","decline+smith+machine+press+chest+form",4,"8-12","חזה תחתון","שיפוע שלילי"],
  ["Hammer Strength Decline","chest","מכונה","hammer+strength+decline+press+form",3,"10-12","חזה תחתון","Iso-lateral"],
  ["Cable Crossover תחתון","chest","כבלים","lower+cable+crossover+lower+chest+form",3,"12-15","חזה תחתון","משיכה למטה"],
  ["Weighted Decline Push-up","chest","ספסל + מוט","weighted+decline+push+up+lower+chest",3,"12-15","חזה תחתון","משקולת על גב"],
  // ── BACK 35 ──────────────────────────────────────────────────────────────
  // lats 12
  ["Lat Pulldown רחב","back","מכונה","wide+grip+lat+pulldown+form",4,"10-12","גב רחב","אחיזה רחבה"],
  ["Lat Pulldown צר","back","מכונה","close+grip+lat+pulldown+form",4,"10-12","גב רחב, ביצפס","אחיזה צרה"],
  ["Lat Pulldown אחיזה הפוכה","back","מכונה","reverse+grip+lat+pulldown+form",3,"10-12","גב רחב, ביצפס","כפות כלפי פנים"],
  ["Single Arm Lat Pulldown","back","מכונה","single+arm+lat+pulldown+cable+form",3,"10-12","גב רחב","חד-צדדי"],
  ["Neutral Grip Lat Pulldown","back","מכונה","neutral+grip+lat+pulldown+form",4,"10-12","גב רחב, ביצפס","מקבילות ידיים"],
  ["Straight Arm Pulldown","back","כבלים","straight+arm+pulldown+lat+cable+form",3,"12-15","גב רחב, ליבה","זרועות ישרות"],
  ["Cable Pullover (גב)","back","כבלים","cable+pullover+lats+form",3,"12-15","גב רחב, חזה","קשת רחבה"],
  ["Kneeling Lat Pulldown","back","מכונה","kneeling+lat+pulldown+cable+form",3,"10-12","גב רחב","ברכיים על רצפה"],
  ["One Arm Machine Pulldown","back","מכונה","one+arm+lat+pulldown+machine+form",3,"10-12","גב רחב","חד-צדדי"],
  ["Incline DB Row (Lat Focus)","back","ספסל + דמבלים","incline+dumbbell+row+lat+focus",3,"10-12","גב רחב","מרפק לצד גוף"],
  ["Hammer Strength Pulldown","back","מכונה","hammer+strength+pulldown+back+form",4,"10-12","גב רחב","Iso-lateral"],
  ["Prone Incline Cable Row","back","ספסל + מכונה","prone+incline+cable+row+lat+focus",3,"12-15","גב רחב","שכיבה על ספסל"],
  // traps 15
  ["Barbell Row אחיזה רחבה","back","מוט","wide+grip+barbell+row+form",4,"8-10","גב, טרפזים","מרפק גבוה"],
  ["Pendlay Row","back","מוט","pendlay+row+form+powerlifting",4,"6-8","גב, טרפזים","מהרצפה כל חזרה"],
  ["Yates Row","back","מוט","yates+row+dorian+vince+form",4,"8-10","גב, טרפזים","שיפוע 45°"],
  ["T-Bar Row רחב","back","מכונה","t+bar+row+wide+grip+form",4,"10-12","גב, טרפזים","חזה על ספסל"],
  ["DB Row כבד (Kroc Row)","back","ספסל + דמבלים","kroc+row+dumbbell+back+heavy",3,"12-15","גב, ביצפס","תנועה חצי-מנוהלת"],
  ["Seated Cable Row רחב","back","כבלים","seated+cable+row+wide+grip+form",4,"10-12","גב אמצע, טרפזים","אחיזה רחבה"],
  ["Chest Supported DB Row","back","ספסל + דמבלים","chest+supported+dumbbell+row+form",4,"10-12","גב אמצע","שכיבה על ספסל"],
  ["Hammer Strength Row","back","מכונה","hammer+strength+row+machine+form",4,"10-12","גב, טרפזים","Iso-lateral"],
  ["Seal Row","back","ספסל + מוט","seal+row+form+upper+back",3,"10-12","גב אמצע, טרפזים","בטן על ספסל"],
  ["Single Arm Cable Row","back","כבלים","single+arm+cable+row+form+back",3,"10-12","גב, ביצפס","חד-צדדי"],
  ["Meadows Row","back","מוט","meadows+row+form+john+meadows",3,"10-12","גב, טרפזים","פינת ספסל"],
  ["Cross Body Cable Row","back","כבלים","cross+body+cable+row+back+form",3,"12-15","גב, כתף אחורית","לאחר קו אמצע"],
  ["Renegade Row","back","ספסל + דמבלים","renegade+row+form+back+core",3,"8-10 כל צד","גב, ליבה","גוף קרש ישר"],
  ["Chest Supported Machine Row","back","מכונה","chest+supported+machine+row+form",4,"10-12","גב אמצע","חזה נשען"],
  ["Low Seated Cable Row","back","כבלים","low+seated+cable+row+lower+lats",4,"10-12","גב, גב רחב","ידית V"],
  // lower 8
  ["Rack Pull","back","מוט","rack+pull+form+lower+back+trap",4,"5-6","גב תחתון, טרפזים","מתחת לברך"],
  ["Back Extension עם משקל","back","מכונה","weighted+back+extension+form",3,"12-15","גב תחתון, ישבן","משקולת על חזה"],
  ["Good Morning","back","מוט","good+morning+exercise+lower+back+form",3,"10-12","גב תחתון, המסטרינג","ירכיים ראשון"],
  ["Hyperextension מכונה","back","מכונה","hyperextension+machine+lower+back+form",3,"12-15","גב תחתון","מכונת ירך"],
  ["Cable Pull-Through (גב)","back","כבלים","cable+pull+through+lower+back+glute",3,"12-15","גב תחתון, ישבן","ירכיים קדימה"],
  ["Deficit Deadlift","back","מוט","deficit+deadlift+form+range+of+motion",4,"5-6","גב תחתון, רגליים","עמד על לוח"],
  // ── SHOULDERS 30 ─────────────────────────────────────────────────────────
  // front 10
  ["Barbell OHP (Overhead Press)","shoulders","מוט","barbell+overhead+press+form",4,"6-8","כתפיים, טריצפס","לדחוף ישר"],
  ["Seated DB OHP","shoulders","ספסל + דמבלים","seated+dumbbell+overhead+press+form",4,"10-12","כתפיים, טריצפס","גב נשען"],
  ["Arnold Press","shoulders","ספסל + דמבלים","arnold+press+form+dumbbell+shoulders",4,"10-12","כתפיים קדמי+אמצע","סיבוב מלא"],
  ["הרמות קדמיות דמבלים","shoulders","ספסל + דמבלים","dumbbell+front+raise+shoulder+form",3,"12-15","כתף קדמית","כוח בלבד"],
  ["הרמות קדמיות כבל","shoulders","כבלים","cable+front+raise+shoulder+form",3,"12-15","כתף קדמית","כבל מלמטה"],
  ["הרמות קדמיות מוט","shoulders","מוט","barbell+front+raise+shoulder+form",3,"10-12","כתף קדמית","אחיזה פרונציה"],
  ["Z-Press","shoulders","מוט","z+press+seated+floor+form+shoulder",3,"8-10","כתפיים, ליבה","ישיבת רצפה"],
  ["Landmine Press כתפיים","shoulders","מוט","landmine+shoulder+press+form",3,"10-12","כתף קדמית","זווית אלכסון"],
  ["Cuban Press","shoulders","ספסל + דמבלים","cuban+press+form+shoulder+rotator",3,"12-15","כתף, כתף אחורית","סיבוב + לחיצה"],
  ["Standing DB OHP","shoulders","ספסל + דמבלים","standing+dumbbell+overhead+press+form",4,"10-12","כתפיים, ליבה","עמידה חופשית"],
  // mid 12
  ["הרמות צד דמבלים","shoulders","ספסל + דמבלים","dumbbell+lateral+raise+form",4,"12-15","כתף אמצעית","מרפקים קלות כפופים"],
  ["הרמות צד ישיבה","shoulders","ספסל + דמבלים","seated+lateral+raise+shoulder+form",3,"12-15","כתף אמצעית","ניוד מינימלי"],
  ["הרמות צד כבל","shoulders","כבלים","cable+lateral+raise+shoulder+form",3,"12-15","כתף אמצעית","כבל מלמטה"],
  ["Machine Lateral Raise","shoulders","מכונה","machine+lateral+raise+form",4,"12-15","כתף אמצעית","Isolate"],
  ["Leaning Lateral Raise","shoulders","ספסל + דמבלים","leaning+lateral+raise+cable+form",3,"12-15","כתף אמצעית","הטייה לצד"],
  ["Upright Row מוט","shoulders","מוט","barbell+upright+row+shoulder+form",3,"10-12","כתף אמצעית, טרפז","אחיזה כתף-רוחב"],
  ["Upright Row כבל","shoulders","כבלים","cable+upright+row+shoulder+form",3,"12-15","כתף אמצעית, טרפז","מרפקים גבוהים"],
  ["Upright Row דמבלים","shoulders","ספסל + דמבלים","dumbbell+upright+row+shoulder+form",3,"12-15","כתף אמצעית, טרפז","ידיים קרובות"],
  ["Cable Y-Raise","shoulders","כבלים","cable+y+raise+shoulder+form",3,"12-15","כתף אמצעית+אחורית","Y עם ידיים"],
  ["45° Incline Lateral Raise","shoulders","ספסל + דמבלים","incline+45+lateral+raise+shoulder",3,"12-15","כתף אמצעית","שכיבה על ספסל"],
  ["One Arm Cable Lateral","shoulders","כבלים","one+arm+cable+lateral+raise+shoulder",3,"12-15","כתף אמצעית","חד-צדדי"],
  ["Barbell Shrug","shoulders","מוט","barbell+shrug+trapezius+form",4,"12-15","טרפזים עליון","כיווץ מלא"],
  // rear 8
  ["Rear Delt Fly DB","shoulders","ספסל + דמבלים","dumbbell+rear+delt+fly+bent+over",3,"15-20","כתף אחורית","קמצוץ שכמות"],
  ["Cable Rear Delt Fly","shoulders","כבלים","cable+rear+delt+fly+form",3,"15-20","כתף אחורית","כבל גבוה"],
  ["Pec Deck Reverse","shoulders","מכונה","pec+deck+reverse+fly+rear+delt+form",3,"15-20","כתף אחורית","מכונה הפוכה"],
  ["Face Pull כבל","shoulders","כבלים","cable+face+pull+rear+delt+form",4,"15-20","כתף אחורית, טרפז","מרפקים גבוהים"],
  ["Prone Incline Rear Delt Fly","shoulders","ספסל + דמבלים","prone+incline+rear+delt+fly+form",3,"15-20","כתף אחורית","שכיבה על ספסל"],
  ["Machine Rear Delt","shoulders","מכונה","rear+delt+machine+form",3,"12-15","כתף אחורית","Isolate"],
  ["Bent Over Lateral Raise","shoulders","ספסל + דמבלים","bent+over+lateral+raise+rear+delt+form",3,"15-20","כתף אחורית, טרפז","ישיבה כפופה"],
  ["DB Shrug","shoulders","ספסל + דמבלים","dumbbell+shrug+trapezius+form",4,"12-15","טרפזים","כיווץ מלא"],
  // ── ARMS 35 ──────────────────────────────────────────────────────────────
  // bi 14
  ["Barbell Curl","arms","מוט","barbell+bicep+curl+form",4,"8-10","ביצפס","מרפק קבוע"],
  ["EZ Bar Curl","arms","מוט","ez+bar+curl+bicep+form",4,"10-12","ביצפס","פחות עומס פרק"],
  ["Incline DB Curl","arms","ספסל + דמבלים","incline+dumbbell+curl+bicep+form",3,"10-12","ביצפס","מתיחה מלאה"],
  ["Preacher Curl EZ","arms","מכונה","ez+bar+preacher+curl+form",4,"10-12","ביצפס ראש קצר","מנוחת מרפק"],
  ["Preacher Curl Machine","arms","מכונה","machine+preacher+curl+bicep+form",3,"12-15","ביצפס","Isolate"],
  ["Spider Curl","arms","ספסל + דמבלים","spider+curl+incline+bench+bicep",3,"12-15","ביצפס","ספסל הפוך"],
  ["Concentration Curl","arms","ספסל + דמבלים","concentration+curl+bicep+peak+form",3,"12-15","ביצפס ראש","יד על ירך"],
  ["Cross Body Hammer Curl","arms","ספסל + דמבלים","cross+body+hammer+curl+form",3,"12-15","ביצפס, ברכיוראדיאליס","ידיים חוצות גוף"],
  ["Cable Curl בר","arms","כבלים","cable+bar+curl+bicep+form",4,"10-12","ביצפס","כבל מלמטה"],
  ["Cable Curl חבל","arms","כבלים","rope+cable+curl+bicep+form",3,"12-15","ביצפס","פרונציה בשיא"],
  ["Machine Curl","arms","מכונה","machine+bicep+curl+form",3,"12-15","ביצפס","Isolate מלא"],
  ["21s Curl","arms","מוט","21s+barbell+curl+bicep+form",3,"21","ביצפס כל הטווח","7+7+7 שלבים"],
  ["Zottman Curl","arms","ספסל + דמבלים","zottman+curl+bicep+brachialis+form",3,"10-12","ביצפס, ברכיאליס, אמות","סיבוב בשיא"],
  ["High Cable Curl","arms","כבלים","high+cable+curl+bicep+peak+form",3,"12-15","ביצפס ראש","כבל בגובה כתף"],
  // tri 14
  ["Skull Crusher מוט","arms","ספסל + מוט","skull+crusher+barbell+tricep+form",4,"8-10","טריצפס ראש ארוך","מרפקים צמודים"],
  ["Skull Crusher EZ","arms","ספסל + מוט","ez+bar+skull+crusher+tricep+form",4,"10-12","טריצפס","פחות עומס פרק"],
  ["Tricep Pushdown V-Bar","arms","כבלים","tricep+pushdown+v+bar+form",4,"12-15","טריצפס חיצוני","מרפקים צמודים"],
  ["Tricep Pushdown חבל","arms","כבלים","rope+tricep+pushdown+form",4,"12-15","טריצפס","פתח בסוף"],
  ["Tricep Pushdown בר","arms","כבלים","cable+tricep+pushdown+bar+form",4,"10-12","טריצפס","זרועות צמודות"],
  ["Overhead Tricep Ext DB","arms","ספסל + דמבלים","overhead+dumbbell+tricep+extension+form",3,"12-15","טריצפס ראש ארוך","מרפקים צמודים"],
  ["Overhead Tricep Ext כבל","arms","כבלים","overhead+cable+tricep+extension+form",3,"12-15","טריצפס ראש ארוך","כבל מגבוה"],
  ["Tricep Kickback","arms","ספסל + דמבלים","tricep+kickback+dumbbell+form",3,"12-15","טריצפס חיצוני","יד ישרה בסוף"],
  ["Single Arm Pushdown","arms","כבלים","single+arm+tricep+pushdown+form",3,"12-15","טריצפס","חד-צדדי"],
  ["JM Press","arms","ספסל + מוט","jm+press+tricep+form",3,"8-10","טריצפס","כלאיים Skull+OHP"],
  ["Tate Press","arms","ספסל + דמבלים","tate+press+tricep+dumbbell+form",3,"12-15","טריצפס חיצוני","מרפקים כלפי חוץ"],
  ["Lying DB Tricep Extension","arms","ספסל + דמבלים","lying+dumbbell+tricep+extension+form",3,"12-15","טריצפס","מעבר ראש"],
  ["Weighted Dips","arms","מכונה","weighted+dips+tricep+form+belt",3,"8-10","טריצפס, חזה","חגורת משקל"],
  ["Reverse Grip Pushdown","arms","כבלים","reverse+grip+tricep+pushdown+form",3,"12-15","טריצפס ראש ארוך","אחיזה הפוכה"],
  // forearms 7
  ["Reverse Curl מוט","arms","מוט","reverse+curl+barbell+forearm+form",3,"12-15","אמות, ברכיוראדיאליס","כפות ידיים מטה"],
  ["Reverse Curl EZ","arms","מוט","reverse+curl+ez+bar+forearm+form",3,"12-15","אמות, ברכיוראדיאליס","EZ פחות לחץ"],
  ["Wrist Curl מוט","arms","מוט","barbell+wrist+curl+forearm+form",3,"15-20","אמות קדמיות","מרפקים על ברכיים"],
  ["Wrist Curl DB","arms","ספסל + דמבלים","dumbbell+wrist+curl+forearm+form",3,"15-20","אמות קדמיות","טווח מלא"],
  ["Reverse Wrist Curl","arms","מוט","reverse+wrist+curl+forearm+extensors",3,"15-20","אמות אחוריות","כפות מטה"],
  ["Farmer's Walk","arms","ספסל + דמבלים","farmers+walk+grip+strength+form",3,"30-40 מ׳","אמות, טרפז, ליבה","גב ישר, כתפיים"],
  ["Plate Pinch","arms","מוט","plate+pinch+grip+strength+training",3,"20-30 שניות","אמות, אחיזה","אצבעות מוכנות"],
  // ── LEGS 40 ───────────────────────────────────────────────────────────────
  // quads 14
  ["Back Squat","legs","מוט","barbell+back+squat+form",4,"6-8","קוואדס, ישבן, ליבה","גב ישר, ברכיים"],
  ["Front Squat","legs","מוט","front+squat+barbell+form",4,"6-8","קוואדס, ליבה","מרפקים גבוהים"],
  ["Hack Squat מכונה","legs","מכונה","hack+squat+machine+form",4,"10-12","קוואדריצפס","עמד גבוה = ישבן"],
  ["Leg Extension מכונה","legs","מכונה","leg+extension+machine+quad+form",4,"12-15","קוואדריצפס","כיווץ מלא"],
  ["Leg Press רגלים גבוהות","legs","מכונה","leg+press+high+foot+placement+form",4,"10-12","קוואדס, ישבן","עקב גבוה"],
  ["Leg Press רגלים נמוכות","legs","מכונה","leg+press+low+foot+placement+quad",4,"10-12","קוואדריצפס","עמד נמוך"],
  ["Goblet Squat","legs","ספסל + דמבלים","goblet+squat+dumbbell+form",3,"12-15","קוואדס, ליבה","דמבל בחזה"],
  ["Bulgarian Split Squat DB","legs","ספסל + דמבלים","bulgarian+split+squat+dumbbell+form",4,"10 כל צד","קוואדס, ישבן","רגל אחורית על ספסל"],
  ["Heel Elevated Squat","legs","מוט","heel+elevated+squat+quad+form",3,"12-15","קוואדס","עקבים מורמים"],
  ["Box Squat","legs","מוט","box+squat+powerlifting+form",4,"6-8","קוואדס, ישבן","ישיבה על תיבה"],
  ["Smith Machine Squat","legs","מכונה","smith+machine+squat+form",4,"10-12","קוואדס, ישבן","מסלול קבוע"],
  ["Pause Squat","legs","מוט","pause+squat+form",4,"5-6","קוואדס, ישבן","2 שניות תחתון"],
  ["Step Up משקל","legs","ספסל + דמבלים","weighted+step+up+dumbbell+form",3,"12 כל צד","קוואדס, ישבן","ספסל בגובה ברך"],
  ["Sissy Squat מכונה","legs","מכונה","sissy+squat+machine+form+quad",3,"12-15","קוואדריצפס","מכונת Sissy"],
  // hams 10
  ["Lying Leg Curl","legs","מכונה","lying+leg+curl+hamstring+machine+form",4,"12-15","המסטרינג","כיווץ מלא"],
  ["Seated Leg Curl","legs","מכונה","seated+leg+curl+hamstring+form",4,"12-15","המסטרינג","מרכז לחץ שונה"],
  ["Romanian Deadlift DB","legs","ספסל + דמבלים","romanian+deadlift+dumbbell+hamstring+form",4,"10-12","המסטרינג, גב","דמבלים לאורך רגל"],
  ["Single Leg RDL","legs","ספסל + דמבלים","single+leg+rdl+dumbbell+form",3,"10 כל צד","המסטרינג, ישבן","רגל אחת + איזון"],
  ["Nordic Hamstring Curl","legs","מכונה","nordic+hamstring+curl+machine+form",3,"5-8","המסטרינג","עקרון אקסנטרי"],
  ["Glute Ham Raise","legs","מכונה","glute+ham+raise+form+ghr",3,"8-10","המסטרינג, ישבן","מכונת GHR"],
  ["Stiff Leg Deadlift","legs","מוט","stiff+leg+deadlift+hamstring+form",3,"10-12","המסטרינג, גב","ברכיים כמעט ישרות"],
  ["Kneeling Leg Curl","legs","מכונה","kneeling+leg+curl+machine+form",3,"12-15","המסטרינג","זווית שונה"],
  ["Cable Leg Curl עמידה","legs","כבלים","cable+leg+curl+standing+hamstring",3,"12-15","המסטרינג","עומד עם כבל"],
  ["Good Morning מוט","legs","מוט","good+morning+barbell+hamstring+form",3,"10-12","המסטרינג, גב","מוט על שכמות"],
  // glutes 10
  ["Hip Thrust מוט","legs","מוט","barbell+hip+thrust+glute+form",4,"10-12","ישבן, המסטרינג","לסד בסוף"],
  ["Hip Thrust מכונה","legs","מכונה","machine+hip+thrust+glute+form",4,"10-12","ישבן","Isolate מכונה"],
  ["Single Leg Glute Bridge","legs","ספסל + דמבלים","single+leg+glute+bridge+weighted+form",3,"12 כל צד","ישבן","רגל אחת"],
  ["Cable Glute Kickback","legs","כבלים","cable+kickback+glute+form",3,"15 כל צד","ישבן","כף רגל מכוונת"],
  ["Donkey Kick Machine","legs","מכונה","donkey+kick+machine+glute+form",3,"15 כל צד","ישבן","מכונת Kickback"],
  ["Hip Abduction מכונה","legs","מכונה","hip+abduction+machine+glute+form",3,"12-15","ישבן חיצוני, ירך","סגרי רחב"],
  ["Hip Adduction מכונה","legs","מכונה","hip+adduction+machine+inner+thigh+form",3,"12-15","מפשעה פנימי","סגרי צר"],
  ["Cable Pull-Through","legs","כבלים","cable+pull+through+glute+form",3,"12-15","ישבן, המסטרינג","ירכיים קדימה"],
  ["Sumo Squat DB","legs","ספסל + דמבלים","sumo+squat+dumbbell+glute+form",3,"12-15","ישבן, מפשעה","רגליים רחבות"],
  ["Clamshell + לולאה","legs","מכונה","clamshell+resistance+band+glute+form",3,"15-20 כל צד","ישבן חיצוני","לולאה אלסטית"],
  // calves 6
  ["Standing Calf Raise מכונה","legs","מכונה","standing+calf+raise+machine+form",4,"15-20","תאומים","מלמטה עד שיא"],
  ["Seated Calf Raise מכונה","legs","מכונה","seated+calf+raise+machine+form",4,"15-20","סולאוס","בוהן גדול"],
  ["Leg Press Calf Raise","legs","מכונה","leg+press+calf+raise+form",3,"15-20","תאומים","בוהן תחתון"],
  ["Single Leg Calf Raise DB","legs","ספסל + דמבלים","single+leg+calf+raise+dumbbell+form",3,"15-20 כל","תאומים","חד-צדדי"],
  ["Donkey Calf Raise","legs","מכונה","donkey+calf+raise+machine+form",4,"15-20","תאומים","כפוף 90° בירך"],
  ["Tibialis Raise","legs","מוט","tibialis+raise+anterior+shin+exercise",3,"15-20","שוק קדמי","שין קדמי"],
  // ── CORE 25 ──────────────────────────────────────────────────────────────
  // straight 15
  ["Cable Crunch ברכיים","core","כבלים","kneeling+cable+crunch+abs+form",4,"15-20","בטן ישרה","אגן נייח"],
  ["Machine Crunch","core","מכונה","machine+crunch+abs+form",3,"15-20","בטן ישרה","Isolate"],
  ["Ab Wheel Rollout","core","מוט","ab+wheel+rollout+core+form",3,"8-12","בטן, גב","גב ישר"],
  ["Dragon Flag ספסל","core","ספסל + מוט","dragon+flag+bench+core+form",3,"5-8","בטן, גב תחתון","ירד לאט"],
  ["Decline Crunch","core","מכונה","decline+crunch+abs+form",3,"15-20","בטן ישרה","שיפוע שלילי"],
  ["Hanging Leg Raise ישר","core","מכונה","hanging+straight+leg+raise+abs+form",4,"10-15","בטן, Hip Flexors","ישר לחלוטין"],
  ["V-Up","core","מוט","v+up+exercise+core+form",3,"12-15","בטן כולה","ידיים ורגליים"],
  ["Dead Bug","core","ספסל + דמבלים","dead+bug+core+stability+form",3,"10 כל צד","בטן עמוקה","גב לרצפה"],
  ["Medicine Ball Slam","core","מכונה","medicine+ball+slam+core+power",3,"10-12","בטן, כל הגוף","כוח מלמעלה"],
  ["Stability Ball Crunch","core","מכונה","stability+ball+crunch+abs+form",3,"15-20","בטן","מרחיב טווח"],
  ["TRX Jackknife","core","מכונה","trx+jackknife+core+form",3,"10-12","בטן, ליבה","רגליים ב-TRX"],
  ["Decline Sit-up","core","מכונה","decline+sit+up+abs+form",3,"15-20","בטן ישרה","שיפוע שלילי"],
  ["High Cable Crunch עמידה","core","כבלים","high+cable+crunch+standing+abs",4,"15-20","בטן ישרה","ברכיים על רצפה"],
  ["Hollow Body Rock","core","מוט","hollow+body+rock+gymnastics+core+form",3,"10-15","בטן עמוקה","גב רוסק לרצפה"],
  ["Reverse Crunch משוקל","core","מכונה","weighted+reverse+crunch+lower+abs",3,"12-15","בטן תחתונה","אגן עולה"],
  // obliques 10
  ["Woodchop גבוה-נמוך","core","כבלים","cable+woodchop+high+to+low+core+form",3,"12 כל צד","אלכסונים","סיבוב ממותניים"],
  ["Woodchop נמוך-גבוה","core","כבלים","cable+woodchop+low+to+high+core+form",3,"12 כל צד","אלכסונים","סיבוב ממותניים"],
  ["Pallof Press עמידה","core","כבלים","pallof+press+standing+anti+rotation+form",3,"10-12 כל","ליבה, אלכסונים","אל תסתובב"],
  ["Pallof Press ברכיים","core","כבלים","pallof+press+kneeling+core+form",3,"10-12 כל","ליבה, אלכסונים","ישיבת ברכיים"],
  ["Landmine Rotation","core","מוט","landmine+rotation+obliques+core+form",3,"10-12 כל","אלכסונים","ארכיטקטורה מלאה"],
  ["Side Bend DB","core","ספסל + דמבלים","dumbbell+side+bend+obliques+form",3,"15-20 כל","אלכסונים","יד לאורך גוף"],
  ["Russian Twist משקל","core","ספסל + דמבלים","weighted+russian+twist+obliques+form",3,"15-20","אלכסונים","ספסל / רצפה"],
  ["Cable Side Crunch","core","כבלים","cable+side+crunch+obliques+form",3,"12-15 כל","אלכסונים","כבל גבוה"],
  ["Rotational Med Ball Throw","core","מכונה","rotational+medicine+ball+throw+core+form",3,"10 כל צד","אלכסונים, כוח","קיר מסביב"],
  ["Side Plank + DB","core","ספסל + דמבלים","side+plank+dumbbell+hip+dips+obliques",3,"10-12 כל","אלכסונים, ליבה","אחיזת משקל"],
  ["Ab Wheel Standing","core","מוט","ab+wheel+standing+rollout+advanced+form",3,"5-8","בטן, גב תחתון","מעמד זקוף"],
  ["Barbell Rollout","core","מוט","barbell+rollout+core+ab+form",3,"6-8","בטן, גב","מוט במקום גלגל"],
];
_EX5.forEach(([name,groupKey,equipment,ytQ,sets,reps,muscles,tip]) => {
  const g = MUSCLE_GROUPS.find(x => x.key === groupKey);
  if (g) g.exercises.push({ name, muscles, tips: [tip], defaultSets: sets, defaultReps: reps, equipment, youtubeQuery: ytQ });
});

const _EX6: _ES[] = [
  // ── stretch_upper פלג גוף עליון (13) ────────────────────────────────────
  ["מתיחת ביצפס (קיר)","stretch_upper","קיר","bicep+wall+stretch+form",2,"30 שניות כל צד","ביצפס, כתף קדמית","יד על קיר, סובב"],
  ["מתיחת כתף קדמית (פינה)","stretch_upper","קיר","anterior+shoulder+stretch+wall",2,"30 שניות כל צד","כתף קדמית","יד אחורה על קיר"],
  ["מתיחת טרפז עליון","stretch_upper","ללא","upper+trapezius+stretch+neck",2,"30 שניות כל צד","טרפזים, צוואר","אוזן לכתף, יד לאחור"],
  ["מתיחת צוואר צדית","stretch_upper","ללא","lateral+neck+stretch+form",2,"20 שניות כל צד","צוואר, טרפז","ראש לצד, ידיים נמוכות"],
  ["Doorway Chest Stretch","stretch_upper","קיר","doorway+chest+stretch+pec+form",2,"30 שניות כל צד","חזה, כתפיים קדמיות","מרפקים 90° על מסגרת"],
  ["Eagle Arms (כנפי נשר)","stretch_upper","ללא","eagle+arms+shoulder+stretch",2,"30 שניות כל צד","כתפיים אחוריות, גב עליון","הצלב ידיים, הרם"],
  ["מתיחת מרפק מאחור","stretch_upper","ללא","behind+back+arm+stretch",2,"30 שניות כל צד","כתפיים, טריצפס","ידיים מאחור, לחץ"],
  ["Cow Face Arms","stretch_upper","ללא","cow+face+arms+shoulder+stretch",2,"30 שניות כל צד","כתפיים, טריצפס, ביצפס","חיבור ידיים מאחורי גב"],
  ["מתיחת גב עליון (עגול)","stretch_upper","ללא","thoracic+spine+stretch+seated",2,"30 שניות","גב עליון, שכמות","עגל גב, ידיים קדימה"],
  ["Thoracic Extension (כיסא)","stretch_upper","ספסל","thoracic+extension+chair+back",2,"30 שניות","גב עליון","הנח שדרה על שפת כיסא"],
  ["מתיחת אמות (Wrist Flexors)","stretch_upper","ללא","wrist+flexor+stretch+forearm",2,"20 שניות כל צד","אמות קדמיות","יד ישרה, כופף לאחור"],
  ["מתיחת Forearm Extensors","stretch_upper","ללא","wrist+extensor+stretch+forearm",2,"20 שניות כל צד","אמות אחוריות","יד ישרה, כופף קדימה"],
  ["Neck Rotation (רוטציה)","stretch_upper","ללא","neck+rotation+stretch+mobility",2,"30 שניות כל כיוון","צוואר, שרירי סובב","סיבוב איטי לצדדים"],
  // ── stretch_lower פלג גוף תחתון (13) ────────────────────────────────────
  ["Seated Forward Fold","stretch_lower","מזרן","seated+forward+fold+hamstring",2,"45 שניות","המסטרינג, גב תחתון","כופף לקדמת אצבעות"],
  ["Standing Quad Stretch","stretch_lower","ללא","standing+quad+stretch+form",2,"30 שניות כל צד","קוואדריצפס, Hip Flexors","עקב לישבן, גב ישר"],
  ["Supine Figure-4","stretch_lower","מזרן","supine+figure+4+glute+stretch",2,"45 שניות כל צד","ישבן, פיריפורמיס","שכיבה, 4 ידיים"],
  ["Runner's Lunge Deep","stretch_lower","מזרן","runners+lunge+deep+hip+stretch",2,"45 שניות כל צד","Hip Flexors, מפשעה","ברך על מזרן, קדם ירך"],
  ["Frog Stretch","stretch_lower","מזרן","frog+stretch+hip+groin+mobility",2,"45 שניות","מפשעה, ירך פנימית","ארבע רגליים, פתח ברכיים"],
  ["Standing Pigeon (על מדרגה)","stretch_lower","קיר","standing+pigeon+pose+hip+stretch",2,"45 שניות כל צד","ישבן, ירך חיצונית","רגל על מדרגה/כיסא"],
  ["Ankle Circles","stretch_lower","ללא","ankle+circles+mobility+form",2,"15 כל כיוון כל","קרסול, שוקיים","סיבובים איטיים"],
  ["Seated Butterfly Advanced","stretch_lower","מזרן","butterfly+stretch+advanced+fold",2,"45 שניות","מפשעה, גב תחתון","הטה קדימה עם גב ישר"],
  ["Standing IT Band Stretch","stretch_lower","קיר","it+band+standing+stretch+form",2,"30 שניות כל צד","IT Band, ירך חיצונית","הצלב רגליים, הטה לצד"],
  ["Calf Stretch מדרגה","stretch_lower","ספסל","calf+stretch+stairs+edge",2,"30 שניות כל צד","שוקיים, אכילס","עקב על שפת מדרגה"],
  ["Soleus Stretch (ברך כפופה)","stretch_lower","קיר","soleus+stretch+bent+knee+form",2,"30 שניות כל צד","סולאוס","כופף ברך לקיר"],
  ["Prone Quad Stretch","stretch_lower","מזרן","prone+quad+stretch+lying+form",2,"30 שניות כל צד","קוואדריצפס, גב תחתון","שכיבה, עקב לישבן"],
  ["Happy Baby Pose","stretch_lower","מזרן","happy+baby+pose+hip+inner+thigh",2,"45 שניות","ירך, גב תחתון, מפשעה","שכיבה, אחוז כפות"],
  // ── stretch_spine גב ועמוד שדרה (12) ──────────────────────────────────
  ["Thoracic Rotation ישיבה","stretch_spine","ספסל","thoracic+rotation+seated+stretch",2,"10 כל כיוון","גב עליון, עמוד שדרה","ישב, ידיים על כתפיים"],
  ["Seated Forward Fold (כיסא)","stretch_spine","ספסל","seated+forward+fold+chair+back",2,"30 שניות","גב תחתון, המסטרינג","הטה קדימה, ידיים לרצפה"],
  ["Pelvic Tilt","stretch_spine","מזרן","pelvic+tilt+exercise+lower+back",2,"15 חזרות","גב תחתון, ליבה","שכיבה, לחץ גב לרצפה"],
  ["Bridge Stretch","stretch_spine","מזרן","bridge+pose+yoga+spine+stretch",2,"30 שניות","גב תחתון, ישבן, חזה","שכיבה, הרם ירכיים"],
  ["Doorway Thoracic Rotation","stretch_spine","קיר","doorway+thoracic+rotation+stretch",2,"30 שניות כל צד","גב עליון, חזה","יד על מסגרת, סובב"],
  ["Spinal Flexion/Extension","stretch_spine","מזרן","spinal+flexion+extension+stretch",2,"10 חזרות","עמוד שדרה כולו","ארבע רגליים, Cat-Cow"],
  ["Lateral Flexion Standing","stretch_spine","ללא","lateral+flexion+standing+side+bend",2,"30 שניות כל צד","עמוד שדרה צידי, גב","הטה לצד עם יד מעל"],
  ["Downward Dog","stretch_spine","מזרן","downward+dog+yoga+form+stretch",2,"45 שניות","גב, המסטרינג, שוקיים","V הפוך — עקבים לרצפה"],
  ["Upward Dog","stretch_spine","מזרן","upward+facing+dog+yoga+spine",2,"20 שניות","גב תחתון, בטן","ידיים מתחת כתפיים, הרם"],
  ["Child's Pose (Child's Pose)","stretch_spine","מזרן","childs+pose+lower+back+release",1,"60 שניות","גב תחתון, ירכיים","ברכיים פתוחות, ידיים קדימה"],
  ["Foam Roller Thoracic","stretch_spine","ספסל","foam+roller+thoracic+extension+form",2,"30 שניות","גב עליון, עמוד שדרה","גלגל על גב עליון"],
  ["Passive Hang (גב)","stretch_spine","קיר","passive+hang+spinal+decompression",2,"30 שניות","עמוד שדרה, כתפיים","תלה מוט, שחרר גוף"],
  // ── stretch_dynamic מתיחות דינמיות (12) ──────────────────────────────
  ["Hip Circle עמידה","stretch_dynamic","ללא","hip+circles+standing+mobility",2,"10 כל כיוון","אגן, גב תחתון","מעגלים גדולים באגן"],
  ["Lunge + Twist","stretch_dynamic","מזרן","lunge+with+rotation+dynamic+stretch",2,"8 כל צד","ירכיים, עמוד שדרה","לאנג׳ + סיבוב לכיוון רגל"],
  ["Knee Hug Walking","stretch_dynamic","ללא","walking+knee+hug+dynamic+stretch",2,"10 כל רגל","ישבן, Hip Flexors","הליכה + ברך לחזה"],
  ["High Kick (מיתר)","stretch_dynamic","ללא","high+kick+leg+swing+hamstring",2,"10 כל רגל","המסטרינג","בעיטה גבוהה ישרה"],
  ["Arm Swing Cross-Body","stretch_dynamic","ללא","arm+swing+cross+body+dynamic+warm+up",2,"20","כתפיים, גב עליון","הצלב ידיים בפתיחה"],
  ["Thoracic Spine Windmill","stretch_dynamic","מזרן","thoracic+windmill+rotation+dynamic",2,"10 כל צד","גב עליון, כתפיים","שכיבה, סיבוב ידיים"],
  ["Dynamic Hip Opener","stretch_dynamic","ללא","dynamic+hip+opener+mobility+drill",2,"10 כל צד","ירכיים, מפשעה","ברך כלפי חוץ בעיגול"],
  ["Fire Hydrant (דינמי)","stretch_dynamic","מזרן","fire+hydrant+dynamic+hip+mobility",2,"15 כל צד","ישבן, ירך חיצונית","ארבע רגליים, הרם בעיגול"],
  ["Ankle Flexion/Extension","stretch_dynamic","מזרן","ankle+flexion+extension+mobility",2,"15 כל רגל","קרסול, שוקיים","שכיבה, כופף + פשוט"],
  ["Spiderman Stretch","stretch_dynamic","מזרן","spiderman+stretch+hip+flexor+mobility",2,"8 כל צד","Hip Flexors, מפשעה","לאנג׳ + הנחת מרפק לרצפה"],
  ["Thoracic Cat-Cow (ישיבה)","stretch_dynamic","ספסל","seated+cat+cow+thoracic+mobility",2,"12 חזרות","גב, עמוד שדרה","ישב, ידיים על ברכיים"],
  ["Neck Half-Circle","stretch_dynamic","ללא","neck+half+circle+mobility+stretch",2,"10 כל כיוון","צוואר","חצי מעגל איטי מצד לצד"],
];
_EX6.forEach(([name,groupKey,equipment,ytQ,sets,reps,muscles,tip]) => {
  const g = STRETCHING_MUSCLE_GROUPS.find(x => x.key === groupKey);
  if (g) g.exercises.push({ name, muscles, tips: [tip], defaultSets: sets, defaultReps: reps, equipment, youtubeQuery: ytQ });
});

// ─── Global exercise name → LibraryExercise lookup (lazy, built after all injections) ──
let _exerciseAllMap: Map<string, LibraryExercise> | null = null;
function getExerciseAllMap(): Map<string, LibraryExercise> {
  if (!_exerciseAllMap) {
    _exerciseAllMap = new Map();
    [...MUSCLE_GROUPS, ...CALISTHENICS_MUSCLE_GROUPS, ...STRETCHING_MUSCLE_GROUPS]
      .forEach((g) => g.exercises.forEach((ex) => _exerciseAllMap!.set(ex.name, ex)));
  }
  return _exerciseAllMap;
}

// ─── Equipment helpers ────────────────────────────────────────────────────────
type EquipmentCategory = "free_weights" | "machine" | "cables" | "mat" | "bar" | "equipment" | "bench" | "rings";

function getEquipCat(equipment: string): EquipmentCategory {
  if (equipment.includes("מכונה")) return "machine";
  if (equipment.includes("כבלים")) return "cables";
  if (equipment.includes("מוט מתח")) return "bar";
  if (equipment.includes("מקבילים") || (equipment.includes("כסא") && !equipment.includes("כסא / מקבילים"))) return "equipment";
  if (equipment.includes("ללא")) return "mat";
  if (equipment.includes("ספסל")) return "bench";
  if (equipment.includes("טבעות")) return "rings";
  if (equipment.includes("מתח")) return "bar";   // calisthenics pull-up bar (bare "מתח")
  if (equipment.includes("מזרן")) return "mat";  // stretching mat
  if (equipment.includes("קיר")) return "mat";   // wall exercises
  return "free_weights";
}

// ─── Hebrew display names for exercises ──────────────────────────────────────
const EXERCISE_HEBREW_NAMES: Record<string, string> = {
  // ── Already-Hebrew named exercises (add English in parentheses) ──────────
  "לחיצת חזה שכיבה":              "לחיצת חזה (Bench Press)",
  "פרפר (Fly)":                   "פרפר דמבלים (Dumbbell Fly)",
  "שכיבות סמיכה":                 "שכיבות סמיכה (Push-up)",
  "לחיצת חזה במכונה":             "לחיצת חזה מכונה (Machine Chest Press)",
  "קרוסאובר (כבלים)":             "קרוסאובר כבלים (Cable Crossover)",
  "לחיצת דמבלים משופעת":          "לחיצת דמבלים משופעת (Incline DB Press)",
  "לחיצת מוט משופעת":             "לחיצת מוט משופעת (Incline Barbell Press)",
  "לחיצת דמבלים ירידה":           "לחיצת דמבלים יורדת (Decline DB Press)",
  "פרפר משופע":                   "פרפר משופע (Incline Fly)",
  "שכיבות ירידה":                 "שכיבות יורדות (Decline Push-up)",
  "מקבילים לחזה":                 "מקבילים לחזה (Chest Dips)",
  "מתח (Pull-up)":                "מתח (Pull-up)",
  "חתירה (Barbell Row)":          "חתירת מוט (Barbell Row)",
  "חתירה כבלים ישיבה":            "חתירת כבלים ישיבה (Seated Cable Row)",
  "לט פולדאון":                   "פולדאון (Lat Pulldown)",
  "דדליפט":                       "דדליפט (Deadlift)",
  "לחיצת כתפיים (OHP)":          "לחיצת כתפיים (Overhead Press)",
  "הרמות צד (Lateral Raise)":    "הרמות צד (Lateral Raise)",
  "הרמות קדמיות (Front Raise)":  "הרמות קדמיות (Front Raise)",
  "כפיפות מרפק (Bicep Curl)":    "כפיפות מרפק (Bicep Curl)",
  "פשיטת מרפק (Tricep Extension)":"פשיטת מרפק (Tricep Extension)",
  "מקבילים (Dips)":               "מקבילים (Dips)",
  "סקוואט (Squat)":               "סקוואט (Squat)",
  "לאנג' (Lunges)":               "לאנג' (Lunges)",
  "לג פרס (Leg Press)":           "לג פרס (Leg Press)",
  "כפיפות ברכיים (Hamstring Curl)":"כפיפות ברכיים (Hamstring Curl)",
  "הרמות עקב (Calf Raise)":       "הרמות עקב (Calf Raise)",
  "פלנק (Plank)":                 "פלנק (Plank)",
  "סיט אפ (Sit-up)":              "כפיפת בטן (Sit-up)",
  "רוסיאן טוויסט":                "סיבוב רוסי (Russian Twist)",
  "ברכיים לחזה (Knee Tucks)":     "ברכיים לחזה (Knee Tucks)",
  "הרמות ברכיים תלויות":          "הרמות ברכיים תלויות (Hanging Knee Raise)",
  "לחיצת כתפיים בישיבה":          "לחיצת כתפיים ישיבה (Seated Shoulder Press)",
  "Shrug — כיווץ כתפיים":        "שראג — כיווץ כתפיים (Shrug)",
  // ── Chest — English → Hebrew (English) ──────────────────────────────────
  "Pec Deck מכונה":               "מכונת פרפר (Pec Deck)",
  "Cable Fly מגבוה":              "כבל פרפר מגבוה (High Cable Fly)",
  "Cable Fly מלמטה":              "כבל פרפר מלמטה (Low Cable Fly)",
  "Dumbbell Pullover":             "פולאובר דמבל (Dumbbell Pullover)",
  "Squeeze Press":                 "לחיצת סחיטה (Squeeze Press)",
  "Cable Crossover רחב":          "קרוסאובר רחב (Wide Cable Crossover)",
  "Cable Fly אמצעי":              "כבל פרפר אמצעי (Mid Cable Fly)",
  "Single Arm Cable Fly":         "כבל פרפר יד אחת (Single Arm Cable Fly)",
  "Cable Chest Press עמידה":      "לחיצת חזה כבל עמידה (Standing Cable Chest Press)",
  "Incline Cable Fly":            "כבל פרפר משופע (Incline Cable Fly)",
  "Low to High Cable Fly":        "כבל פרפר נמוך לגבוה (Low to High Cable Fly)",
  "High to Low Cable Fly":        "כבל פרפר גבוה לנמוך (High to Low Cable Fly)",
  "Cable Squeeze חזה":            "סחיטת כבל חזה (Cable Chest Squeeze)",
  "Machine Chest Press":          "לחיצת חזה מכונה (Machine Chest Press)",
  "Smith Machine Bench":          "לחיצת חזה סמית' (Smith Machine Bench Press)",
  "Iso-Lateral Chest Press":      "לחיצת חזה איזולטרלי (Iso-Lateral Chest Press)",
  "Machine Incline Press":        "לחיצת חזה משופעת מכונה (Machine Incline Press)",
  "Cable Upper Chest Fly":        "כבל פרפר חזה עליון (Upper Chest Cable Fly)",
  "Cable Chest Pullover":         "פולאובר כבל חזה (Cable Chest Pullover)",
  "Pec Deck Single Arm":          "מכונת פרפר יד אחת (Pec Deck Single Arm)",
  "Cable Fly Neutral Grip":       "כבל פרפר ניטרלי (Neutral Grip Cable Fly)",
  "Reverse Pec Deck":             "מכונת פרפר הפוך (Reverse Pec Deck)",
  "Cable Crossover Neutral":      "קרוסאובר ניטרלי (Neutral Cable Crossover)",
  "Hammer Strength Flat Press":   "לחיצת חזה Hammer Strength (Hammer Strength Flat Press)",
  "Hammer Strength Incline Press":"לחיצת חזה משופעת Hammer Strength (Hammer Strength Incline)",
  "Decline Smith Machine Press":  "לחיצת חזה יורדת סמית' (Decline Smith Machine Press)",
  "Hammer Strength Decline":      "לחיצת חזה יורדת Hammer Strength (Hammer Strength Decline)",
  "Incline Smith Machine Press":  "לחיצת חזה משופעת סמית' (Incline Smith Machine Press)",
  "Smith Machine Flat Press":     "לחיצת חזה שטוח סמית' (Smith Machine Flat Press)",
  "Pause Bench Press":            "לחיצת חזה עם עצירה (Pause Bench Press)",
  "Flat Dumbbell Fly":            "פרפר דמבל שטוח (Flat Dumbbell Fly)",
  "Neutral Grip DB Press":        "לחיצת דמבל ניטרלי (Neutral Grip DB Press)",
  "Wide Grip Bench Press":        "לחיצת חזה אחיזה רחבה (Wide Grip Bench Press)",
  "Close Grip Bench Press":       "לחיצת חזה אחיזה צרה (Close Grip Bench Press)",
  "Weighted Decline Push-up":     "שכיבות יורדות עם משקל (Weighted Decline Push-up)",
  "Decline Dumbbell Fly":         "פרפר דמבל יורד (Decline Dumbbell Fly)",
  "Reverse Grip Bench Press":     "לחיצת חזה אחיזה הפוכה (Reverse Grip Bench Press)",
  "Cable Fly מקביל לחזה":        "כבל פרפר מקביל (Parallel Cable Fly)",
  "High-Incline 75° DB Press":    "לחיצת דמבל 75° (High Incline DB Press)",
  "DB Pullover (Lat-Chest)":      "פולאובר דמבל גב-חזה (DB Pullover Lat-Chest)",
  "Squeeze Press משופע":         "לחיצת סחיטה משופעת (Incline Squeeze Press)",
  "Landmine Press חזה":          "לחיצת מוט שיגור חזה (Landmine Chest Press)",
  "כבל נמוך-לגבוה (Low-to-High)":"כבל פרפר נמוך לגבוה (Low to High Cable Fly)",
  "Chest Dips מקבילים":          "מקבילים לחזה (Chest Dips)",
  // ── Back ─────────────────────────────────────────────────────────────────
  "Single Arm Dumbbell Row":      "חתירת דמבל יד אחת (Single Arm Dumbbell Row)",
  "T-Bar Row":                    "חתירת T-Bar (T-Bar Row)",
  "Chest Supported Row":          "חתירה נשענת חזה (Chest Supported Row)",
  "Lat Pulldown רחב":             "פולדאון אחיזה רחבה (Wide Grip Lat Pulldown)",
  "Lat Pulldown צר":              "פולדאון אחיזה צרה (Close Grip Lat Pulldown)",
  "Straight Arm Pulldown":        "פולדאון ידיים ישרות (Straight Arm Pulldown)",
  "Renegade Row":                 "חתירת רנגייד (Renegade Row)",
  "Meadows Row":                  "חתירת מדוז (Meadows Row)",
  "Seal Row":                     "חתירת ספסל (Seal Row)",
  "Rack Pull":                    "הרמת מוט מגמבה (Rack Pull)",
  "Back Extension":               "הרחבת גב (Back Extension)",
  "Good Morning":                 "גוד מורנינג (Good Morning)",
  "Cable Pullover גב":            "פולאובר כבל גב (Cable Back Pullover)",
  "Cable Pullover (גב)":          "פולאובר כבל גב (Cable Back Pullover)",
  "Unilateral Cable Row":         "חתירת כבל חד-צדדית (Unilateral Cable Row)",
  "High Cable Row":               "חתירת כבל גבוהה (High Cable Row)",
  "Rope Pulldown":                "פולדאון חבל (Rope Pulldown)",
  "Unilateral Lat Pulldown":      "פולדאון חד-צדדי (Unilateral Lat Pulldown)",
  "Wide Grip Cable Row":          "חתירת כבל אחיזה רחבה (Wide Grip Cable Row)",
  "Reverse Grip Cable Row":       "חתירת כבל אחיזה הפוכה (Reverse Grip Cable Row)",
  "Underhand Cable Row":          "חתירת כבל אחיזה תחתונה (Underhand Cable Row)",
  "Cable Straight Arm Row":       "חתירת כבל ידיים ישרות (Straight Arm Cable Row)",
  "Cable Lower Back Ext":         "הרחבת גב תחתון כבל (Cable Lower Back Extension)",
  "Machine Pullover":             "פולאובר מכונה (Machine Pullover)",
  "Hammer Strength Lat Pull":     "פולדאון Hammer Strength (Hammer Strength Lat Pulldown)",
  "Machine Seated Row":           "חתירה ישיבה מכונה (Machine Seated Row)",
  "Assisted Pull-up Machine":     "מכונת מתח מסייעת (Assisted Pull-up Machine)",
  "Reverse Grip Lat Pulldown":    "פולדאון אחיזה הפוכה (Reverse Grip Lat Pulldown)",
  "Machine High Row":             "חתירה גבוהה מכונה (Machine High Row)",
  "Pendlay Row":                  "חתירת פנדליי (Pendlay Row)",
  "Kroc Row":                     "חתירת קרוק (Kroc Row)",
  "Yates Row":                    "חתירת ייטס (Yates Row)",
  "Chest Supported Cable Row":    "חתירת כבל נשענת חזה (Chest Supported Cable Row)",
  "Neutral Grip Lat Pulldown":    "פולדאון אחיזה ניטרלית (Neutral Grip Lat Pulldown)",
  "Single Arm Lat Pulldown":      "פולדאון יד אחת (Single Arm Lat Pulldown)",
  "Lat Pulldown אחיזה הפוכה":    "פולדאון אחיזה הפוכה (Reverse Grip Lat Pulldown)",
  "Hammer Strength Pulldown":     "פולדאון Hammer Strength (Hammer Strength Pulldown)",
  "Kneeling Lat Pulldown":        "פולדאון ברכיים (Kneeling Lat Pulldown)",
  "One Arm Machine Pulldown":     "פולדאון מכונה יד אחת (One Arm Machine Pulldown)",
  "Incline DB Row (Lat Focus)":   "חתירת דמבל משופעת רחב גבי (Incline DB Row Lat Focus)",
  "Prone Incline Cable Row":      "חתירת כבל שכיבה (Prone Incline Cable Row)",
  "Hammer Strength Row":          "חתירת Hammer Strength (Hammer Strength Row)",
  "Barbell Row אחיזה רחבה":      "חתירת מוט אחיזה רחבה (Wide Grip Barbell Row)",
  "T-Bar Row רחב":               "חתירת T-Bar רחבה (Wide T-Bar Row)",
  "DB Row כבד (Kroc Row)":       "חתירת דמבל כבד (Kroc Row)",
  "Seated Cable Row רחב":        "חתירת כבל ישיבה רחבה (Wide Seated Cable Row)",
  "Chest Supported DB Row":       "חתירת דמבל נשענת חזה (Chest Supported DB Row)",
  "Single Arm Cable Row":         "חתירת כבל יד אחת (Single Arm Cable Row)",
  "Cross Body Cable Row":         "חתירת כבל חוצה גוף (Cross Body Cable Row)",
  "Chest Supported Machine Row":  "חתירת מכונה נשענת חזה (Chest Supported Machine Row)",
  "Low Seated Cable Row":         "חתירת כבל ישיבה נמוכה (Low Seated Cable Row)",
  "Deficit Deadlift":             "דדליפט מגמבה נמוכה (Deficit Deadlift)",
  "Cable Pull-Through (גב)":      "משיכת כבל עבר הרגליים (Cable Pull-Through Back)",
  "Hyperextension מכונה":         "היפר-אקסטנשן מכונה (Hyperextension Machine)",
  "Back Extension עם משקל":       "הרחבת גב עם משקל (Weighted Back Extension)",
  // ── Shoulders ────────────────────────────────────────────────────────────
  "Arnold Press":                 "לחיצת ארנולד (Arnold Press)",
  "Lateral Raise כבלים":         "הרמות צד כבל (Cable Lateral Raise)",
  "Rear Delt Fly דמבלים":        "פרפר כתף אחורית (Rear Delt Dumbbell Fly)",
  "Cable Rear Delt Fly":          "פרפר כתף אחורית כבל (Cable Rear Delt Fly)",
  "Upright Row":                  "חתירה זקופה (Upright Row)",
  "Cuban Press":                  "לחיצת קובן (Cuban Press)",
  "Band Pull-Apart":              "פריסת גומייה (Band Pull-Apart)",
  "Machine Lateral Raise":        "הרמות צד מכונה (Machine Lateral Raise)",
  "Cable W-Raise":                "הרמת W כבל (Cable W-Raise)",
  "Cable Rope Face Pull":         "משיכת פנים חבל (Cable Rope Face Pull)",
  "Cable Front Raise":            "הרמות קדמיות כבל (Cable Front Raise)",
  "Cable Upright Row":            "חתירה זקופה כבל (Cable Upright Row)",
  "Single Arm Cable Lateral":     "הרמות צד כבל יד אחת (Single Arm Cable Lateral Raise)",
  "Lying Cable Lateral Raise":    "הרמות צד כבל שכיבה (Lying Cable Lateral Raise)",
  "Rope Face Pull מתקדם":        "משיכת פנים חבל מתקדם (Advanced Rope Face Pull)",
  "High Cable Rear Delt Fly":     "פרפר כתף אחורית כבל גבוה (High Cable Rear Delt Fly)",
  "Low Cable Rear Delt":          "כבל כתף אחורית נמוך (Low Cable Rear Delt)",
  "Cable External Rotation":      "סיבוב חיצוני כבל (Cable External Rotation)",
  "Cable Internal Rotation":      "סיבוב פנימי כבל (Cable Internal Rotation)",
  "Leaning Cable Lateral":        "הרמות צד כבל מוטה (Leaning Cable Lateral Raise)",
  "Cable Y-Raise":                "הרמת Y כבל (Cable Y-Raise)",
  "Cross Body Cable Raise":       "הרמת כבל חוצה גוף (Cross Body Cable Raise)",
  "Machine Shoulder Press":       "לחיצת כתפיים מכונה (Machine Shoulder Press)",
  "Smith Machine OHP":            "לחיצת כתפיים סמית' (Smith Machine Overhead Press)",
  "Machine Rear Delt Fly":        "פרפר כתף אחורית מכונה (Machine Rear Delt Fly)",
  "Machine Front Raise":          "הרמות קדמיות מכונה (Machine Front Raise)",
  "Cable Behind-Back Lateral":    "הרמות צד כבל מאחורי הגב (Behind Back Cable Lateral Raise)",
  "Cable Rope Upright Row":       "חתירה זקופה חבל (Cable Rope Upright Row)",
  "Plate Front Raise":            "הרמות קדמיות צלחת (Plate Front Raise)",
  "Cable Single Arm Front Raise": "הרמות קדמיות כבל יד אחת (Single Arm Cable Front Raise)",
  "Half-Kneeling Cable Press":    "לחיצת כבל חצי ברכיים (Half-Kneeling Cable Press)",
  "Dumbbell Rear Delt Row":       "חתירת דמבל כתף אחורית (Rear Delt Dumbbell Row)",
  "Face Pull":                    "משיכת פנים (Face Pull)",
  "Rear Delt Fly DB":             "פרפר כתף אחורית דמבל (Rear Delt Dumbbell Fly)",
  "Pec Deck Reverse":             "מכונת פרפר הפוך (Reverse Pec Deck)",
  "Face Pull כבל":               "משיכת פנים כבל (Cable Face Pull)",
  "Prone Incline Rear Delt Fly":  "פרפר כתף אחורית שכיבה (Prone Rear Delt Fly)",
  "Machine Rear Delt":            "כתף אחורית מכונה (Machine Rear Delt)",
  "Bent Over Lateral Raise":      "הרמות צד כפוף קדימה (Bent Over Lateral Raise)",
  "Barbell OHP (Overhead Press)": "לחיצת כתפיים מוט (Barbell Overhead Press)",
  "Seated DB OHP":                "לחיצת דמבל כתפיים ישיבה (Seated DB Overhead Press)",
  "Standing DB OHP":              "לחיצת דמבל כתפיים עמידה (Standing DB Overhead Press)",
  "Z-Press":                      "לחיצת Z על הרצפה (Z-Press)",
  "Landmine Press כתפיים":       "לחיצת מוט שיגור כתפיים (Landmine Press)",
  "Upright Row מוט":             "חתירה זקופה מוט (Barbell Upright Row)",
  "Upright Row כבל":             "חתירה זקופה כבל (Cable Upright Row)",
  "Upright Row דמבלים":          "חתירה זקופה דמבלים (Dumbbell Upright Row)",
  "45° Incline Lateral Raise":    "הרמות צד 45° (45° Incline Lateral Raise)",
  "One Arm Cable Lateral":        "הרמות צד כבל יד אחת (One Arm Cable Lateral Raise)",
  "Barbell Shrug":                "שראג מוט (Barbell Shrug)",
  "DB Shrug":                     "שראג דמבל (Dumbbell Shrug)",
  "Leaning Lateral Raise":        "הרמות צד מוטה (Leaning Lateral Raise)",
  // ── Arms — Bicep ──────────────────────────────────────────────────────────
  "Hammer Curl":                  "כפיפות הממר (Hammer Curl)",
  "Preacher Curl":                "כפיפות מרפק מטיף (Preacher Curl)",
  "Incline Dumbbell Curl":        "כפיפות מרפק דמבל משופע (Incline Dumbbell Curl)",
  "Concentration Curl":           "כפיפות מרפק ריכוז (Concentration Curl)",
  "Spider Curl":                  "כפיפות מרפק עכביש (Spider Curl)",
  "Cable Curl":                   "כפיפות מרפק כבל (Cable Curl)",
  "Hammer Curl כבלים":           "כפיפות הממר כבל (Cable Hammer Curl)",
  "Reverse Curl":                 "כפיפה הפוכה (Reverse Curl)",
  "Cable Concentration Curl":     "כפיפות מרפק ריכוז כבל (Cable Concentration Curl)",
  "Rope Hammer Curl":             "כפיפות הממר חבל (Rope Hammer Curl)",
  "High Cable Curl":              "כפיפות מרפק כבל גבוה (High Cable Curl)",
  "Low Cable Curl":               "כפיפות מרפק כבל נמוך (Low Cable Curl)",
  "Cable 21s ביצפס":             "21s כבל (Cable 21s Bicep)",
  "Unilateral Cable Curl":        "כפיפות מרפק כבל חד-צדדית (Unilateral Cable Curl)",
  "Machine Preacher Curl":        "כפיפות מרפק מטיף מכונה (Machine Preacher Curl)",
  "EZ Bar Curl":                  "כפיפות מרפק מוט EZ (EZ Bar Curl)",
  "Barbell Preacher Curl":        "כפיפות מרפק מטיף מוט (Barbell Preacher Curl)",
  "Reverse Cable Curl":           "כפיפה הפוכה כבל (Reverse Cable Curl)",
  "Cable Spider Curl":            "כפיפות מרפק עכביש כבל (Cable Spider Curl)",
  "Zottman Curl":                 "כפיפת זוטמן (Zottman Curl)",
  "Cable Drag Curl":              "כפיפות מרפק גרירה (Cable Drag Curl)",
  "Barbell Curl":                 "כפיפות מרפק מוט (Barbell Curl)",
  "Incline DB Curl":              "כפיפות מרפק דמבל משופע (Incline DB Curl)",
  "Preacher Curl EZ":             "כפיפות מרפק מטיף EZ (EZ Preacher Curl)",
  "Preacher Curl Machine":        "כפיפות מרפק מטיף מכונה (Machine Preacher Curl)",
  "Cross Body Hammer Curl":       "כפיפות הממר חוצה גוף (Cross Body Hammer Curl)",
  "Cable Curl בר":               "כפיפות מרפק כבל מוט (Cable Bar Curl)",
  "Cable Curl חבל":              "כפיפות מרפק כבל חבל (Cable Rope Curl)",
  "Machine Curl":                 "כפיפות מרפק מכונה (Machine Curl)",
  "21s Curl":                     "21s (21s Curl)",
  // ── Arms — Tricep ─────────────────────────────────────────────────────────
  "Skull Crusher":                "מוחץ גולגולת (Skull Crusher)",
  "Close Grip Bench":             "לחיצת אחיזה צרה (Close Grip Bench Press)",
  "Overhead Tricep Extension":    "פשיטת מרפק מעל הראש (Overhead Tricep Extension)",
  "Tricep Pushdown V-Bar":       "לחיצת טריצפס V-Bar (Tricep Pushdown V-Bar)",
  "Tricep Kickback":              "בעיטות טריצפס (Tricep Kickback)",
  "Wrist Curl":                   "כפיפת שורש יד (Wrist Curl)",
  "Rope Pushdown":                "לחיצת טריצפס חבל (Rope Pushdown)",
  "Reverse Grip Pushdown":        "לחיצת טריצפס אחיזה הפוכה (Reverse Grip Pushdown)",
  "Single Arm Pushdown":          "לחיצת טריצפס יד אחת (Single Arm Pushdown)",
  "Overhead Cable Ext Rope":      "פשיטת מרפק חבל מעל הראש (Overhead Cable Rope Extension)",
  "Single Arm Cable Overhead":    "פשיטת מרפק כבל יד אחת מעל הראש (Single Arm Overhead Cable)",
  "Cable Kickback":               "בעיטות טריצפס כבל (Cable Tricep Kickback)",
  "Rope Overhead Ext":           "פשיטת מרפק חבל מעל הראש (Rope Overhead Extension)",
  "Cable Bar Pushdown":           "לחיצת טריצפס מוט כבל (Cable Bar Pushdown)",
  "Machine Tricep Ext":           "פשיטת מרפק מכונה (Machine Tricep Extension)",
  "Tricep Dip Machine":           "מקבילים טריצפס מכונה (Machine Tricep Dip)",
  "JM Press":                     "לחיצת JM Press (JM Press)",
  "Tate Press":                   "לחיצת טייט (Tate Press)",
  "Board Press":                  "לחיצת לוח (Board Press)",
  "Cable Long Head Ext":          "פשיטת ראש ארוך כבל (Cable Long Head Extension)",
  "Skull Crusher מוט":           "מוחץ גולגולת מוט (Barbell Skull Crusher)",
  "Skull Crusher EZ":             "מוחץ גולגולת EZ (EZ Skull Crusher)",
  "Tricep Pushdown חבל":         "לחיצת טריצפס חבל (Rope Tricep Pushdown)",
  "Tricep Pushdown בר":          "לחיצת טריצפס מוט (Bar Tricep Pushdown)",
  "Overhead Tricep Ext DB":       "פשיטת מרפק דמבל מעל הראש (Overhead DB Tricep Extension)",
  "Overhead Tricep Ext כבל":     "פשיטת מרפק כבל מעל הראש (Overhead Cable Tricep Extension)",
  "Lying DB Tricep Extension":    "פשיטת מרפק דמבל שכיבה (Lying DB Tricep Extension)",
  "Weighted Dips":                "מקבילים עם משקל (Weighted Dips)",
  // ── Arms — Forearm ────────────────────────────────────────────────────────
  "Reverse Wrist Curl":           "כפיפת שורש יד הפוכה (Reverse Wrist Curl)",
  "Wrist Curl מוט":              "כפיפת שורש יד מוט (Barbell Wrist Curl)",
  "Wrist Curl DB":                "כפיפת שורש יד דמבל (Dumbbell Wrist Curl)",
  "Reverse Curl מוט":            "כפיפה הפוכה מוט (Barbell Reverse Curl)",
  "Reverse Curl EZ":              "כפיפה הפוכה EZ (EZ Reverse Curl)",
  "Farmer's Walk":                "הליכת חקלאי (Farmer's Walk)",
  "Plate Pinch":                  "אחיזת צלחת (Plate Pinch)",
  // ── Legs ──────────────────────────────────────────────────────────────────
  "Romanian Deadlift":            "דדליפט רומני (Romanian Deadlift)",
  "Sumo Squat":                   "סקוואט סומו (Sumo Squat)",
  "Hack Squat מכונה":            "האק סקוואט מכונה (Hack Squat Machine)",
  "Leg Extension":                "פשיטת ברכיים (Leg Extension)",
  "Seated Calf Raise":            "הרמות עקב ישיבה (Seated Calf Raise)",
  "Glute Bridge":                 "גשר ישבן (Glute Bridge)",
  "Hip Thrust":                   "דחיפות ירכיים (Hip Thrust)",
  "Goblet Squat":                 "סקוואט גביע (Goblet Squat)",
  "Step Up לספסל":               "עלייה לספסל (Step Up)",
  "Nordic Hamstring Curl":        "כפיפת נורדיק (Nordic Hamstring Curl)",
  "Hip Abduction מכונה":         "פיזור ירכיים מכונה (Hip Abduction Machine)",
  "Hip Adduction מכונה":         "קירוב ירכיים מכונה (Hip Adduction Machine)",
  "Donkey Kicks":                 "בעיטות חמור (Donkey Kicks)",
  "Bulgarian Split Squat":        "סקוואט בולגרי (Bulgarian Split Squat)",
  "Good Morning רגליים":         "גוד מורנינג (Good Morning)",
  "Cable Pull-Through":           "משיכת כבל דרך הרגליים (Cable Pull-Through)",
  "Smith Machine Squat":          "סקוואט סמית' (Smith Machine Squat)",
  "Lying Leg Curl":               "כפיפות ברכיים שכיבה (Lying Leg Curl)",
  "Cable Romanian DL":            "דדליפט רומני כבל (Cable Romanian Deadlift)",
  "Machine Glute Kickback":       "בעיטות ישבן מכונה (Machine Glute Kickback)",
  "Cable Hip Flexion":            "כפיפת ירך כבל (Cable Hip Flexion)",
  "Smith Machine Lunge":          "לאנג' סמית' (Smith Machine Lunge)",
  "Standing Leg Curl":            "כפיפות ברכיים עמידה (Standing Leg Curl)",
  "Cable Glute Kickback":         "בעיטות ישבן כבל (Cable Glute Kickback)",
  "Donkey Kick Machine":          "מכונת בעיטות חמור (Donkey Kick Machine)",
  "Hip Thrust מוט":              "דחיפות ירכיים מוט (Barbell Hip Thrust)",
  "Hip Thrust מכונה":            "דחיפות ירכיים מכונה (Machine Hip Thrust)",
  "Single Leg Glute Bridge":      "גשר ישבן רגל אחת (Single Leg Glute Bridge)",
  "Single Leg RDL":               "דדליפט רומני רגל אחת (Single Leg RDL)",
  "Glute Ham Raise":              "הרמת ישבן-המסטרינג (Glute Ham Raise)",
  "Stiff Leg Deadlift":           "דדליפט רגליים ישרות (Stiff Leg Deadlift)",
  "Kneeling Leg Curl":            "כפיפות ברכיים ברכיים (Kneeling Leg Curl)",
  "Good Morning מוט":            "גוד מורנינג מוט (Barbell Good Morning)",
  "Leg Press רגלים גבוהות":      "לג פרס רגליים גבוהות (High Foot Leg Press)",
  "Leg Press רגלים נמוכות":      "לג פרס רגליים נמוכות (Low Foot Leg Press)",
  "Bulgarian Split Squat DB":     "סקוואט בולגרי דמבל (Dumbbell Bulgarian Split Squat)",
  "Heel Elevated Squat":          "סקוואט עקב מורם (Heel Elevated Squat)",
  "Box Squat":                    "סקוואט קופסה (Box Squat)",
  "Pause Squat":                  "סקוואט עם עצירה (Pause Squat)",
  "Sissy Squat מכונה":           "סיסי סקוואט מכונה (Sissy Squat Machine)",
  "Romanian Deadlift DB":         "דדליפט רומני דמבל (Dumbbell Romanian Deadlift)",
  "Seated Leg Curl":              "כפיפות ברכיים ישיבה (Seated Leg Curl)",
  "Leg Extension מכונה":         "פשיטת ברכיים מכונה (Machine Leg Extension)",
  "Cable Leg Curl עמידה":        "כפיפות ברכיים כבל עמידה (Standing Cable Leg Curl)",
  "Standing Calf Raise מכונה":   "הרמות עקב עמידה מכונה (Standing Calf Raise Machine)",
  "Seated Calf Raise מכונה":     "הרמות עקב ישיבה מכונה (Seated Calf Raise Machine)",
  "Leg Press Calf Raise":         "הרמות עקב לג פרס (Leg Press Calf Raise)",
  "Single Leg Calf Raise DB":     "הרמות עקב דמבל רגל אחת (Single Leg Dumbbell Calf Raise)",
  "Donkey Calf Raise":            "הרמות עקב חמור (Donkey Calf Raise)",
  "Tibialis Raise":               "הרמת שוק קדמי (Tibialis Raise)",
  "Clamshell + לולאה":           "תרגיל צדפה עם גומייה (Clamshell with Band)",
  // ── Core ──────────────────────────────────────────────────────────────────
  "Dead Bug":                     "חרק מת (Dead Bug)",
  "Cable Crunch":                 "כיפוף בטן כבל (Cable Crunch)",
  "Dragon Flag":                  "דגל דרקון (Dragon Flag)",
  "Ab Wheel Rollout":             "גלגל בטן (Ab Wheel Rollout)",
  "Hanging Leg Raise":            "הרמת רגליים תלויות (Hanging Leg Raise)",
  "V-Up":                         "V-Up (V-Up)",
  "Woodchop (גרזן)":             "קציצת גרזן כבל (Cable Wood Chop)",
  "Pallof Press":                 "לחיצת פאלוף — נגד סיבוב (Pallof Press)",
  "Side Plank":                   "פלנק צד (Side Plank)",
  "Landmine Rotation":            "סיבוב מוט שיגור (Landmine Rotation)",
  "Hollow Crunch":                "כיפוף גוף חלול (Hollow Body Crunch)",
  "Standing Cable Lift":          "הרמת כבל אלכסונית (Standing Cable Lift)",
  "Cable Anti-Rotation Hold":     "החזקת כבל נגד סיבוב (Cable Anti-Rotation Hold)",
  "Kneeling Cable Oblique":       "כיפוף אלכסוני כבל ברכיים (Kneeling Cable Oblique Crunch)",
  "Hollow Body Hold":             "החזקת גוף חלול (Hollow Body Hold)",
  "L-Sit (בין כסאות)":           "L-Sit בין כסאות (L-Sit Between Chairs)",
  "L-Sit (מקבילים)":             "L-Sit על מקבילים (L-Sit on Parallettes)",
  "Toes to Bar":                  "רגליים למוט (Toes to Bar)",
  "Windshield Wipers":            "מגבי שמשה (Windshield Wipers)",
  "Human Flag (Tuck)":            "דגל אנושי קרוץ (Tuck Human Flag)",
  "Dragon Flag (Full)":           "דגל דרקון מלא (Full Dragon Flag)",
  "Dragon Flag Negative":         "דגל דרקון שלילי (Dragon Flag Negative)",
  "Dragon Flag Incline":          "דגל דרקון משופע (Incline Dragon Flag)",
  "Reverse Crunch משוקל":        "כיפוף הפוך עם משקל (Weighted Reverse Crunch)",
  "Ab Wheel Standing":            "גלגל בטן עמידה (Standing Ab Wheel)",
  "Barbell Rollout":              "גלגל מוט (Barbell Rollout)",
  "Machine Crunch":               "כיפוף בטן מכונה (Machine Crunch)",
  "Decline Crunch":               "כיפוף בטן יורד (Decline Crunch)",
  "High Cable Crunch עמידה":     "כיפוף בטן כבל עמידה (Standing Cable Crunch)",
  "Hollow Body Rock":             "נדנוד גוף חלול (Hollow Body Rock)",
  "Stability Ball Crunch":        "כיפוף בטן כדור (Stability Ball Crunch)",
  "TRX Jackknife":                "TRX ג'קנייף (TRX Jackknife)",
  "Decline Sit-up":               "כפיפת בטן יורדת (Decline Sit-up)",
  "Bicycle Crunch Premium":       "כפיפת אופניים (Bicycle Crunch)",
  "Cable Oblique Crunch":         "כיפוף אלכסוני כבל (Cable Oblique Crunch)",
};

// ─── Default muscle group images for exercise cards ──────────────────────────
const GROUP_EXERCISE_IMAGES: Record<string, string> = {
  chest:     "https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?w=120&q=75",
  back:      "https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?w=120&q=75",
  shoulders: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=120&q=75",
  arms:      "https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?w=120&q=75",
  legs:      "https://images.unsplash.com/photo-1574680096145-d05b474e2155?w=120&q=75",
  core:      "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=120&q=75",
  dynamic:   "https://images.unsplash.com/photo-1601422407692-ec4eeec1d9b3?w=120&q=75",
  static:    "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=120&q=75",
  mobility:  "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=120&q=75",
  running:   "https://images.unsplash.com/photo-1571008887538-b36bb32f4571?w=120&q=75",
};

const EXERCISE_IMAGE_URLS: Record<string, string> = exerciseImageUrlsJson as Record<string, string>;

const EQUIP_META: Record<EquipmentCategory, { label: string; emoji: string; color: string }> = {
  free_weights: { label: "משקולות חופשיות", emoji: "🏋️", color: "#10b981" },
  machine:      { label: "מכונות",           emoji: "⚙️",  color: "#3b82f6" },
  cables:       { label: "כבלים",            emoji: "🔗",  color: "#8b5cf6" },
  mat:          { label: "מזרן / ללא ציוד",  emoji: "🧘",  color: "#06b6d4" },
  bar:          { label: "מוט מתח",          emoji: "⬆️",  color: "#f59e0b" },
  equipment:    { label: "ציוד עזר",         emoji: "🪑",  color: "#ec4899" },
  bench:        { label: "ספסל",             emoji: "🛋️",  color: "#f97316" },
  rings:        { label: "טבעות",            emoji: "⭕",  color: "#a855f7" },
};

const EQUIPMENT_IMAGES: Record<EquipmentCategory, string> = {
  free_weights: "/assets/equipment/dumbbells.jpg",
  machine:      "/assets/equipment/machine.jpg",
  cables:       "/assets/equipment/cables.jpg",
  mat:          "/assets/equipment/mat.jpg",
  bar:          "/assets/equipment/pullups.jpg",
  equipment:    "/assets/equipment/dips.jpg",
  bench:        "/assets/equipment/bench.jpg",
  rings:        "/assets/equipment/rings.jpg",
};

// ─── Body icon ────────────────────────────────────────────────────────────────
const BODY_DOTS: Record<string, { cx: number; cy: number }> = {
  chest:     { cx: 14, cy: 15 },
  back:      { cx: 14, cy: 18 },
  shoulders: { cx: 9,  cy: 12 },
  arms:      { cx: 6,  cy: 18 },
  legs:      { cx: 14, cy: 36 },
  core:      { cx: 14, cy: 23 },
};

function MuscleBodyIcon({ muscleKey, size = 26 }: { muscleKey: string; size?: number }) {
  const dot = BODY_DOTS[muscleKey];
  const h = Math.round(size * 52 / 28);
  return (
    <svg width={size} height={h} viewBox="0 0 28 52" fill="none">
      <ellipse cx="14" cy="4" rx="3.5" ry="4" fill="rgba(255,255,255,0.18)" />
      <rect x="9" y="9" width="10" height="16" rx="2" fill="rgba(255,255,255,0.14)" />
      <rect x="4" y="9" width="4" height="13" rx="2" fill="rgba(255,255,255,0.14)" />
      <rect x="20" y="9" width="4" height="13" rx="2" fill="rgba(255,255,255,0.14)" />
      <rect x="9" y="26" width="4.5" height="18" rx="2" fill="rgba(255,255,255,0.14)" />
      <rect x="14.5" y="26" width="4.5" height="18" rx="2" fill="rgba(255,255,255,0.14)" />
      {dot && <circle cx={dot.cx} cy={dot.cy} r="3" fill="#ef4444" fillOpacity="0.88" />}
    </svg>
  );
}

// ─── Builder helpers ──────────────────────────────────────────────────────────
const TIME_KEYWORDS_LC = [
  "פלנק", "plank", "wall sit", "ישיבת קיר", "hollow body", "l-sit",
  "מתיחת", "מתיחה", "stretch", "savasana", "child", "spinal",
  "figure 4", "hold", "שחרור", "inchworm",
];
function detectTimeBased(name: string): boolean {
  const lc = name.toLowerCase();
  return TIME_KEYWORDS_LC.some((k) => lc.includes(k));
}
// Accent colors cycled per exercise group block (zebra striping)
const GROUP_ACCENT_COLORS = ["#10b981", "#3b82f6", "#8b5cf6", "#f97316", "#ec4899", "#06b6d4"];

// ─── Weekly day strip ─────────────────────────────────────────────────────────
const DAYS = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];
const TODAY_IDX = new Date().getDay();
const TODAY_NAME = new Date().toLocaleDateString("he-IL", { weekday: "long" });

// TODAY_PLAN removed — Task 1: TodayPlanCard replaced by TemplatesSection

// ═══════════════════════════════════════════════════════════════════════
//  TAB 1 — DASHBOARD sub-components
// ═══════════════════════════════════════════════════════════════════════

function DayStatusBanner({ isTraining, onToggle }: { isTraining: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={`w-full flex items-center gap-3 px-4 py-4 rounded-2xl border backdrop-blur-xl transition-all duration-300 text-end ${
        isTraining
          ? "border-emerald-500/40 bg-emerald-500/10 shadow-[0_6px_32px_rgba(16,185,129,0.14)]"
          : "border-white/10 bg-white/5 shadow-[0_4px_20px_rgba(0,0,0,0.2)]"
      }`}
    >
      <div className={`h-11 w-11 rounded-xl flex items-center justify-center shrink-0 transition-colors ${isTraining ? "bg-emerald-500/25" : "bg-white/10"}`}>
        {isTraining ? <Flame className="h-5 w-5 text-emerald-400" /> : <RotateCcw className="h-5 w-5 text-white/40" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-black text-white leading-tight">{isTraining ? "🔥 יום אימון" : "😴 יום מנוחה"}</p>
        <p className="text-[11px] text-white/40 mt-0.5">{isTraining ? "כל הכבוד — לכו על זה!" : "מנוחה = התאוששות = גדילה"}</p>
      </div>
      <div className={`relative w-12 h-6 rounded-full overflow-hidden shrink-0 transition-colors duration-300 ${isTraining ? "bg-emerald-500" : "bg-white/15"}`}>
        <div className={`absolute top-[2px] left-[2px] w-5 h-5 bg-white rounded-full shadow-lg transition-transform duration-300 ${isTraining ? "translate-x-[22px]" : "translate-x-0"}`} />
      </div>
    </button>
  );
}

function QuickWorkoutCard({ workout, onQuickLog }: { workout: (typeof QUICK_WORKOUTS)[number]; onQuickLog: (dbCategory: string, label: string, duration: number) => void }) {
  const [selDuration, setSelDuration] = useState<number>(workout.durations[1]);
  return (
    <div
      className="relative flex-shrink-0 w-36 h-48 rounded-2xl overflow-hidden cursor-pointer select-none active:scale-95 transition-all duration-200"
      style={{ backgroundImage: `url('${workout.image}')`, backgroundSize: "cover", backgroundPosition: "center" }}
      onClick={() => onQuickLog(workout.dbCategory, workout.label, selDuration)}
    >
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/10" />
      <span className="absolute top-2.5 right-2.5 text-2xl leading-none drop-shadow-lg">{workout.emoji}</span>
      <p className="absolute bottom-16 right-0 left-0 px-3 text-sm font-black text-white leading-tight text-end">{workout.label}</p>
      <div className="absolute bottom-8 left-0 right-0 flex gap-1 px-2.5 justify-end">
        {workout.durations.map((d) => (
          <button key={d} onClick={(e) => { e.stopPropagation(); setSelDuration(d); }}
            className={`px-1.5 py-0.5 rounded-md text-[9px] font-bold transition-all ${selDuration === d ? "text-white border" : "text-white/50"}`}
            style={selDuration === d ? { borderColor: workout.color, color: workout.color, background: workout.color + "28" } : {}}>
            {d}′
          </button>
        ))}
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onQuickLog(workout.dbCategory, workout.label, selDuration); }}
        className="absolute bottom-2 left-2 right-2 flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-[11px] font-black text-white transition-all active:scale-95"
        style={{ background: workout.color + "cc", backdropFilter: "blur(8px)" }}>
        <Plus className="h-3 w-3" />הוסף
      </button>
    </div>
  );
}

function QuickAddRow({ onLoadTemplate }: { onLoadTemplate: (t: any) => void }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { data: templates, isLoading } = useWorkoutTemplates();
  const deleteTemplate = useDeleteWorkoutTemplate();

  // Opt-out model: hiddenIds lists templates the user has explicitly removed.
  // All templates (system + user) appear by default; hiding is per-ID.
  const [hiddenIds, setHiddenIds] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("qw-hidden") ?? "[]"); } catch { return []; }
  });
  const [showEdit, setShowEdit] = useState(false);
  // Optimistic-hide while undo window is open
  const [pendingDeleteIds, setPendingDeleteIds] = useState<Set<string>>(new Set());
  const deleteTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  // Undo banner state
  const [undoBanner, setUndoBanner] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    localStorage.setItem("qw-hidden", JSON.stringify(hiddenIds));
  }, [hiddenIds]);

  const allTemplates  = templates ?? [];
  const carouselItems = allTemplates.filter((t: any) => !hiddenIds.includes(t.id) && !pendingDeleteIds.has(t.id));

  const toggleHidden = (id: string) =>
    setHiddenIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const handleDeleteWithUndo = (id: string, name: string) => {
    // Cancel any existing timer for this id
    if (deleteTimers.current.has(id)) {
      clearTimeout(deleteTimers.current.get(id));
    }
    // Optimistically hide immediately
    setPendingDeleteIds((prev) => new Set([...prev, id]));
    // Show in-sheet undo banner
    setUndoBanner({ id, name });
    // After 3 seconds → commit the delete
    const timer = setTimeout(() => {
      deleteTemplate.mutate(id);
      setPendingDeleteIds((prev) => { const s = new Set(prev); s.delete(id); return s; });
      deleteTimers.current.delete(id);
      setUndoBanner((prev) => prev?.id === id ? null : prev);
    }, 3000);
    deleteTimers.current.set(id, timer);
  };

  const handleUndoDelete = () => {
    if (!undoBanner) return;
    clearTimeout(deleteTimers.current.get(undoBanner.id));
    deleteTimers.current.delete(undoBanner.id);
    setPendingDeleteIds((prev) => { const s = new Set(prev); s.delete(undoBanner.id); return s; });
    setUndoBanner(null);
  };

  const RichCard = ({ t }: { t: any }) => {
    const meta  = CATEGORY_META[t.category]  ?? { emoji: "💪", color: "#10b981" };
    const image = CATEGORY_IMAGE[t.category] ?? CATEGORY_IMAGE.weights;
    return (
      <div
        className="relative flex-shrink-0 w-36 h-48 rounded-2xl overflow-hidden cursor-pointer select-none active:scale-95 transition-all duration-200"
        style={{
          scrollSnapAlign: "start",
          backgroundImage: `url('${image}')`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
        onClick={() => onLoadTemplate(t)}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/10" />
        <span className="absolute top-2.5 right-2.5 text-2xl leading-none drop-shadow-lg">{meta.emoji}</span>
        <p className="absolute bottom-10 right-0 left-0 px-3 text-sm font-black text-white leading-tight text-end line-clamp-2">
          {t.name}
        </p>
        <button
          onClick={(e) => { e.stopPropagation(); onLoadTemplate(t); }}
          className="absolute bottom-2 left-2 right-2 flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-[11px] font-black text-white transition-all active:scale-95"
          style={{ background: meta.color + "cc", backdropFilter: "blur(8px)" }}
        >
          <ChevronRight className="h-3 w-3" />הוסף
        </button>
      </div>
    );
  };

  return (
    <>
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between px-0.5">
          <p className="text-sm font-black text-white">אימון מהיר</p>
          <button
            onClick={() => setShowEdit(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/5 border border-white/10 text-[11px] text-white/45 hover:text-white/70 hover:bg-white/8 transition-all active:scale-95"
          >
            <Settings2 className="h-3 w-3" />
            <span>ערוך</span>
          </button>
        </div>

        {/* Carousel */}
        <div
          ref={scrollRef}
          className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-0.5 px-0.5"
          style={{ scrollSnapType: "x mandatory" }}
        >
          {isLoading
            ? Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="flex-shrink-0 w-36 h-48 rounded-2xl bg-white/5 animate-pulse"
                  style={{ scrollSnapAlign: "start" }}
                />
              ))
            : carouselItems.map((t: any) => <RichCard key={t.id} t={t} />)}
        </div>
      </div>

      {/* ── Edit / Customize modal ──────────────────────────────────── */}
      {showEdit && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center pb-10 px-4"
          style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(14px)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowEdit(false); }}
        >
          <div
            className="w-full max-w-sm rounded-3xl border border-white/12 bg-[#0d0d0f] shadow-2xl flex flex-col"
            style={{ maxHeight: "75vh" }}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-white/8">
              <div>
                <p className="text-base font-black text-white">התאם אישית</p>
                <p className="text-[11px] text-white/35 mt-0.5">לחץ על תבנית להסרה מהקרוסלה</p>
              </div>
              <button
                onClick={() => setShowEdit(false)}
                className="h-8 w-8 rounded-xl bg-white/8 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/12 transition-all active:scale-95"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Template list — only active (non-hidden) templates */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
              {(() => {
                const visibleTemplates = allTemplates.filter(
                  (t: any) => !pendingDeleteIds.has(t.id) && !hiddenIds.includes(t.id)
                );
                if (visibleTemplates.length === 0) {
                  return (
                    <div className="flex flex-col items-center justify-center py-10 space-y-2.5">
                      <span className="text-4xl">📋</span>
                      <p className="text-sm font-bold text-white/50 text-center">אין תבניות פעילות</p>
                    </div>
                  );
                }
                return visibleTemplates.map((t: any) => {
                  const meta    = CATEGORY_META[t.category] ?? { emoji: "💪", color: "#10b981" };
                  const exCount = Array.isArray(t.exercises) ? t.exercises.length : 0;
                  return (
                    <button key={t.id} onClick={() => toggleHidden(t.id)}
                      className="w-full flex items-center gap-3 px-3 py-3 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 transition-all active:scale-[0.98]"
                    >
                      <div className="h-10 w-10 rounded-xl flex items-center justify-center text-xl shrink-0" style={{ background: meta.color + "22" }}>
                        {meta.emoji}
                      </div>
                      <div className="flex-1 min-w-0 text-end">
                        <div className="flex items-center justify-end gap-1.5">
                          <p className="text-sm font-black text-white truncate">{t.name}</p>
                          {t.is_system && <Star className="h-3 w-3 text-amber-400/60 shrink-0" />}
                        </div>
                        <p className="text-[10px] text-white/35 mt-0.5">{exCount} תרגילים</p>
                      </div>
                      <div className="h-5 w-5 rounded-full border-2 border-emerald-500 bg-emerald-500 shrink-0 flex items-center justify-center">
                        <Check className="h-3 w-3 text-white" />
                      </div>
                    </button>
                  );
                });
              })()}
            </div>

            {/* Done */}
            <div className="px-4 pb-5 pt-3 border-t border-white/8">
              <button
                onClick={() => setShowEdit(false)}
                className="w-full py-3.5 rounded-2xl bg-emerald-500 text-white text-sm font-black active:scale-[0.97] transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)]"
              >
                סיום
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── StreakBanner ─────────────────────────────────────────────────────────────
function StreakBanner() {
  const { data: streak = 0 } = useWorkoutStreak();
  if (!streak) return null;

  const milestones = [3, 7, 14, 30, 60, 90];
  const next = milestones.find((m) => m > streak) ?? 100;
  const pct  = Math.min(100, (streak / next) * 100);

  return (
    <div className="rounded-2xl border border-amber-500/25 bg-amber-500/8 backdrop-blur-xl px-4 py-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="text-2xl leading-none">🔥</span>
          <div>
            <p className="text-sm font-black text-white">
              {streak} {streak === 1 ? "יום" : "ימים"} ברצף!
            </p>
            <p className="text-[11px] text-white/40">
              {next - streak} ימים לאבן הדרך הבאה ({next})
            </p>
          </div>
        </div>
        <span className="text-2xl font-black text-amber-400 tabular-nums">{streak}</span>
      </div>
      <div className="h-1 rounded-full bg-white/10 overflow-hidden">
        <div
          className="h-full rounded-full bg-amber-400 transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ─── QuickTemplatesRow ────────────────────────────────────────────────────────
const CATEGORY_META: Record<string, { emoji: string; color: string }> = {
  weights:      { emoji: "🏋️", color: "#10b981" },
  calisthenics: { emoji: "🤸", color: "#8b5cf6" },
  running:      { emoji: "🏃", color: "#f97316" },
  mixed:        { emoji: "⚡", color: "#eab308" },
};

const CATEGORY_IMAGE: Record<string, string> = {
  weights:      "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=400&q=80",
  calisthenics: "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=400&q=80",
  running:      "https://images.unsplash.com/photo-1571008887538-b36bb32f4571?w=400&q=80",
  mixed:        "https://images.unsplash.com/photo-1601422407692-ec4eeec1d9b3?w=400&q=80",
};

// MET values per category for calorie estimation
// Calories = MET * weight_kg * (minutes / 60)
const MET_MAP: Record<string, number> = {
  weights:      6.0,
  calisthenics: 8.0,
  running:      9.5,
  mixed:        8.0,
  stretching:   2.5,
};

function QuickTemplatesRow({ onLoadTemplate }: { onLoadTemplate: (t: any) => void }) {
  const { data: allTemplates, isLoading } = useWorkoutTemplates();
  const templates = (allTemplates ?? []).filter((t: any) => !t.is_system);

  if (isLoading) return null;
  if (!templates.length) {
    return (
      <div className="rounded-2xl border border-dashed border-white/12 bg-white/3 p-6 text-center space-y-2">
        <span className="text-4xl">💪</span>
        <p className="text-sm font-black text-white">בוא נתחיל!</p>
        <p className="text-[11px] text-white/35 leading-relaxed">
          הוסף אימון ראשון או בנה תבנית משלך — הכל מתחיל כאן
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between px-0.5">
        <p className="text-sm font-black text-white">תבניות</p>
        <span className="text-[10px] text-white/30">{templates.length} תבניות</span>
      </div>
      <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-hide">
        {templates.map((t: any) => {
          const meta = CATEGORY_META[t.category] ?? { emoji: "💪", color: "#10b981" };
          const exCount = Array.isArray(t.exercises) ? t.exercises.length : 0;
          return (
            <button
              key={t.id}
              onClick={() => onLoadTemplate(t)}
              className="flex-shrink-0 flex flex-col gap-2 w-36 p-3 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl text-end active:scale-95 transition-all hover:border-white/20"
            >
              <div className="flex items-center justify-between">
                <div
                  className="h-8 w-8 rounded-xl flex items-center justify-center text-base"
                  style={{ background: meta.color + "22" }}
                >
                  <span>{meta.emoji}</span>
                </div>
                {t.is_system && (
                  <Star className="h-3 w-3 text-amber-400/70" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-black text-white leading-tight line-clamp-2">{t.name}</p>
                <p className="text-[9px] text-white/35 mt-0.5">{exCount} תרגילים · {t.estimated_duration_minutes ?? "—"} דק׳</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StatsStrip() {
  const { data: prs } = usePersonalRecords();
  const { data: weekWorkouts } = useWeekWorkouts();
  const prCount = (prs ?? []).length;
  const workoutCount = (weekWorkouts ?? []).length;
  const totalMins = (weekWorkouts ?? []).reduce((s: number, w: any) => s + (w.duration_minutes || 0), 0);

  const stats = [
    { label: "אימונים", value: String(workoutCount), sub: "השבוע", icon: Target,   color: "#10b981" },
    { label: "דקות",    value: String(totalMins),     sub: "השבוע", icon: Clock,    color: "#3b82f6" },
    { label: "שיאים",   value: String(prCount),       sub: "סה״כ",  icon: Trophy,   color: "#f59e0b" },
    { label: "קלוריות", value: "0",                   sub: "אתמול", icon: Flame,    color: "#ef4444" },
  ];
  return (
    <div className="grid grid-cols-4 gap-2.5">
      {stats.map(({ label, value, sub, icon: Icon, color }) => (
        <div
          key={label}
          className="rounded-2xl border border-white/8 bg-white/5 backdrop-blur-xl p-3.5 text-center space-y-1.5"
          style={{ boxShadow: `0 6px 24px ${color}12` }}
        >
          <div className="h-8 w-8 rounded-xl mx-auto flex items-center justify-center" style={{ background: color + "22" }}>
            <Icon className="h-4 w-4" style={{ color }} />
          </div>
          <p className="text-xl font-black text-white leading-none tabular-nums">{value}</p>
          <p className="text-[9px] text-white/40 font-semibold">{label}</p>
          <p className="text-[8px] text-white/20">{sub}</p>
        </div>
      ))}
    </div>
  );
}

function WeekStrip() {
  const { data: weekWorkouts } = useWeekWorkouts();
  const completedDays: number[] = [];
  (weekWorkouts ?? []).forEach((w: any) => {
    const d = new Date(w.date).getDay();
    if (!completedDays.includes(d)) completedDays.push(d);
  });
  const done = completedDays.length;
  const goal = 3;
  const pct  = Math.min(100, (done / goal) * 100);
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl px-4 py-4 space-y-4 shadow-[0_8px_32px_rgba(0,0,0,0.22)]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-emerald-400" />
          <p className="text-sm font-black text-white">שבוע אימונים</p>
        </div>
        <span className="text-[11px] font-semibold text-white/40">{done}/{goal} אימונים</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div
          className="h-full rounded-full bg-emerald-500 transition-all duration-700 shadow-[0_0_10px_rgba(16,185,129,0.55)]"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between">
        {DAYS.map((day, i) => {
          const isToday   = i === TODAY_IDX;
          const completed = completedDays.includes(i);
          return (
            <div key={i} className="flex flex-col items-center gap-1.5">
              <div className={`h-8 w-8 rounded-full flex items-center justify-center text-[9px] font-black transition-all ${
                completed ? "bg-emerald-500 text-white shadow-[0_0_12px_rgba(16,185,129,0.5)]"
                : isToday  ? "border-2 border-emerald-500/60 text-emerald-400 bg-emerald-500/10"
                : "border border-white/10 text-white/15"
              }`}>
                {completed ? "✓" : day}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  TAB 2 — BUILDER
// ═══════════════════════════════════════════════════════════════════════

function Stepper({ value, onChange, min = 0, max = 999, step = 1, suffix = "" }: {
  value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; suffix?: string;
}) {
  const fmt = (n: number) => n % 1 === 0 ? String(n) : n.toFixed(1);
  const dec = (n: number) => parseFloat((Math.max(min, n - step)).toFixed(2));
  const inc = (n: number) => parseFloat((Math.min(max, n + step)).toFixed(2));
  return (
    <div className="flex items-center gap-1.5">
      <button onClick={() => onChange(dec(value))}
        className="h-8 w-8 rounded-xl bg-white/8 border border-white/10 flex items-center justify-center text-white/70 hover:bg-white/15 active:scale-95 transition-all">
        <Minus className="h-3.5 w-3.5" />
      </button>
      <div className="w-14 text-center">
        <span className="text-sm font-black text-white">{fmt(value)}</span>
        {suffix && <span className="text-[10px] text-white/40 ms-0.5">{suffix}</span>}
      </div>
      <button onClick={() => onChange(inc(value))}
        className="h-8 w-8 rounded-xl bg-white/8 border border-white/10 flex items-center justify-center text-white/70 hover:bg-white/15 active:scale-95 transition-all">
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

interface SetEntry { reps: number; weight_kg: number; }

function toSetsData(sets: number, reps: number, weight_kg: number): SetEntry[] {
  return Array.from({ length: Math.max(1, sets) }, () => ({ reps, weight_kg }));
}

interface BuilderEx {
  name: string;
  sets: number;          // = setsData.length (kept for backward compat / display)
  reps: number;          // = last set's reps (kept for backward compat)
  weight_kg: number;     // = last set's weight (kept for backward compat)
  setsData: SetEntry[];  // per-set breakdown
  isTimeBased?: boolean; // undefined = auto-detect from name
  isWarmup?: boolean;
  group?: number;        // group ID for zebra striping
  supersetId?: string;    // superset group id
  supersetOrder?: number; // 0 or 1
}

function SetRow({
  setIdx, entry, isTimeMode, isOnly,
  onChange, onRemove,
}: {
  setIdx: number;
  entry: SetEntry;
  isTimeMode: boolean;
  isOnly: boolean;
  onChange: (v: SetEntry) => void;
  onRemove: () => void;
}) {
  const [rawW, setRawW] = useState(entry.weight_kg > 0 ? String(entry.weight_kg) : "");
  const [rawR, setRawR] = useState(String(entry.reps));
  useEffect(() => { setRawW(entry.weight_kg > 0 ? String(entry.weight_kg) : ""); }, [entry.weight_kg]);
  useEffect(() => { setRawR(String(entry.reps)); }, [entry.reps]);
  const autoSel = (e: React.FocusEvent<HTMLInputElement>) => e.target.select();
  const inp = "h-9 rounded-xl bg-white/10 border border-white/12 text-center text-sm font-black text-white outline-none focus:border-emerald-500/60 focus:bg-emerald-500/8 transition-all";
  return (
    <div className="flex items-center gap-2">
      <span className="shrink-0 text-[10px] font-black text-white/35 w-8 text-center">
        {setIdx + 1}
      </span>
      {/* Weight */}
      <div className="relative flex-1">
        <input
          type="text" inputMode="decimal" pattern="[0-9.]*"
          value={rawW} placeholder="0"
          className={`${inp} w-full placeholder:text-white/20`}
          onFocus={autoSel}
          onChange={(e) => {
            setRawW(e.target.value);
            const v = parseFloat(e.target.value);
            if (!isNaN(v) && v >= 0) onChange({ ...entry, weight_kg: parseFloat(v.toFixed(2)) });
          }}
          onBlur={() => { const v = parseFloat(rawW); if (isNaN(v) || v < 0) setRawW(entry.weight_kg > 0 ? String(entry.weight_kg) : ""); }}
        />
        <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[8px] text-white/25 pointer-events-none">kg</span>
      </div>
      {/* Reps / seconds */}
      <div className="flex-1">
        <input
          type="text" inputMode="numeric" pattern="[0-9]*"
          value={rawR}
          className={`${inp} w-full ${isTimeMode ? "border-cyan-500/30 focus:border-cyan-500/60" : ""}`}
          onFocus={autoSel}
          onChange={(e) => {
            setRawR(e.target.value);
            const v = parseInt(e.target.value);
            if (!isNaN(v) && v >= 1) onChange({ ...entry, reps: v });
          }}
          onBlur={() => { const v = parseInt(rawR); if (isNaN(v) || v < 1) setRawR(String(entry.reps)); }}
        />
      </div>
      {/* Remove button — hidden if only 1 set */}
      <button
        onClick={onRemove}
        disabled={isOnly}
        className={`shrink-0 h-7 w-7 rounded-lg flex items-center justify-center transition-all ${
          isOnly ? "opacity-0 pointer-events-none" : "bg-red-500/15 text-red-400 hover:bg-red-500/25 active:scale-95"
        }`}
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function BuilderExerciseRow({
  ex, onChange, onRemove, onDuplicate, idx, accentColor,
}: {
  ex: BuilderEx;
  onChange: (v: BuilderEx) => void;
  onRemove: () => void;
  onDuplicate: () => void;
  idx: number;
  accentColor?: string;
}) {
  // ── Accordion & menu state ───────────────────────────────────────
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [actOpen,     setActOpen]     = useState(false);

  // ── Swipe-to-reveal ──────────────────────────────────────────────
  const [swipeX,  setSwipeX]  = useState(0);
  const touchStartX = useRef(0);
  const swiping     = useRef(false);
  const ACTION_W    = 64;

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    swiping.current = false;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    const delta = touchStartX.current - e.touches[0].clientX;
    if (Math.abs(delta) > 6) swiping.current = true;
    if (delta > 0) setSwipeX(Math.min(delta, ACTION_W));
    else if (delta < -10) setSwipeX(0);
  };
  const onTouchEnd = () => setSwipeX((p) => (p > ACTION_W / 3 ? ACTION_W : 0));

  // ── Time-mode detection ──────────────────────────────────────────
  // isTimeBased=undefined → auto; true/false → explicit override
  const isTimeMode = ex.isTimeBased !== undefined ? ex.isTimeBased : detectTimeBased(ex.name);
  const toggleTimeMode = () => onChange({ ...ex, isTimeBased: !isTimeMode });
  const toggleWarmup   = () => onChange({ ...ex, isWarmup: !ex.isWarmup });

  // ── Dynamic sets helpers ─────────────────────────────────────────
  const updateSet = (si: number, v: SetEntry) => {
    const next = ex.setsData.map((s, i) => i === si ? v : s);
    const last = next.at(-1)!;
    onChange({ ...ex, setsData: next, sets: next.length, reps: last.reps, weight_kg: last.weight_kg });
  };
  const removeSet = (si: number) => {
    if (ex.setsData.length <= 1) return;
    const next = ex.setsData.filter((_, i) => i !== si);
    const last = next.at(-1)!;
    onChange({ ...ex, setsData: next, sets: next.length, reps: last.reps, weight_kg: last.weight_kg });
  };
  const addSet = () => {
    const last = ex.setsData.at(-1) ?? { reps: ex.reps, weight_kg: ex.weight_kg };
    const next = [...ex.setsData, { ...last }];
    onChange({ ...ex, setsData: next, sets: next.length, reps: last.reps, weight_kg: last.weight_kg });
  };
  const incWeight = (d: number) => {
    const si = ex.setsData.length - 1;
    updateSet(si, { ...ex.setsData[si], weight_kg: parseFloat(Math.max(0, (ex.setsData[si]?.weight_kg ?? 0) + d).toFixed(2)) });
  };

  const microBtn = "h-6 rounded-lg text-[9px] font-bold active:scale-95 transition-all flex items-center justify-center";

  return (
    <div
      className="relative overflow-hidden rounded-2xl select-none"
      style={accentColor ? { borderLeft: `3px solid ${accentColor}60` } : undefined}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Swipe backdrop — hidden at rest, revealed during swipe ── */}
      <div
        className="absolute inset-y-0 right-0 flex items-stretch p-1.5"
        style={{
          width: ACTION_W,
          opacity: Math.min(swipeX / ACTION_W, 1),
          pointerEvents: swipeX >= ACTION_W ? "auto" : "none",
        }}
      >
        <button
          onClick={() => { onRemove(); setSwipeX(0); }}
          className="w-full rounded-xl bg-red-500/80 text-white flex flex-col items-center justify-center gap-0.5 text-[9px] font-bold active:scale-95 transition-all"
        >
          <Trash2 className="h-4 w-4" />מחק
        </button>
      </div>

      {/* Main card — positioned so it paints above the absolute backdrop ── */}
      <div
        className="relative z-[1] rounded-2xl border border-white/10 bg-[#111315] p-3 space-y-2.5 shadow-[0_2px_16px_rgba(0,0,0,0.35)]"
        style={{ transform: `translateX(-${swipeX}px)`, transition: swiping.current ? "none" : "transform 0.18s ease" }}
      >
        {/* ── Name row (always visible) ──── */}
        <div className="flex items-center gap-2">
          {/* Collapse toggle — click index badge */}
          <button
            onClick={() => setIsCollapsed((v) => !v)}
            className="h-6 w-6 rounded-lg bg-emerald-500/20 flex items-center justify-center shrink-0 hover:bg-emerald-500/30 transition-all"
          >
            {isCollapsed
              ? <ChevronDown className="h-3.5 w-3.5 text-emerald-400" />
              : <span className="text-[10px] font-black text-emerald-400">{idx + 1}</span>}
          </button>

          <input
            value={ex.name}
            onChange={(e) => onChange({ ...ex, name: e.target.value })}
            placeholder="שם תרגיל..."
            className="flex-1 bg-transparent text-sm font-semibold text-white placeholder:text-white/25 outline-none border-b border-white/10 pb-0.5"
            dir="rtl"
          />

          {/* Status badges */}
          {ex.isWarmup && (
            <span className="shrink-0 text-[8px] font-black text-amber-400 px-1.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/20">
              חימום
            </span>
          )}
          {isTimeMode && (
            <span className="shrink-0 text-[8px] font-black text-cyan-400 px-1 py-0.5 rounded-full bg-cyan-500/12 border border-cyan-500/20">
              ⏱
            </span>
          )}

          {/* ⋮ overflow menu */}
          <button
            onClick={() => setActOpen((v) => !v)}
            className={`h-6 w-6 rounded-lg flex items-center justify-center text-xs font-black shrink-0 transition-all ${
              actOpen ? "bg-white/15 text-white" : "bg-white/5 text-white/30 hover:bg-white/15 hover:text-white/70"
            }`}
          >
            ⋮
          </button>
        </div>

        {/* ── ⋮ Action row (warmup | time | duplicate | delete) ─── */}
        {actOpen && (
          <div className="flex gap-1.5">
            <button
              onClick={toggleWarmup}
              className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-xl text-[10px] font-bold transition-all border ${
                ex.isWarmup
                  ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                  : "bg-white/5 text-white/40 border-white/10 hover:bg-white/10"
              }`}
            >
              🔥 חימום
            </button>
            <button
              onClick={toggleTimeMode}
              className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-xl text-[10px] font-bold transition-all border ${
                isTimeMode
                  ? "bg-cyan-500/20 text-cyan-400 border-cyan-500/30"
                  : "bg-white/5 text-white/40 border-white/10 hover:bg-white/10"
              }`}
            >
              ⏱ זמן
            </button>
            <button
              onClick={() => { onDuplicate(); setActOpen(false); toast.success("📋 תרגיל שוכפל"); }}
              className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-xl bg-blue-500/15 text-blue-400 text-[10px] font-bold border border-blue-500/20 hover:bg-blue-500/25"
            >
              <CheckCircle2 className="h-3 w-3" />שכפל
            </button>
            <button
              onClick={onRemove}
              className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-xl bg-red-500/12 text-red-400 text-[10px] font-bold border border-red-500/20 hover:bg-red-500/20"
            >
              <Trash2 className="h-3 w-3" />מחק
            </button>
          </div>
        )}

        {/* ── Dynamic sets (hidden when collapsed) ─────────────── */}
        {!isCollapsed && (
          <div className="space-y-2">
            {/* Column headers */}
            <div className="flex items-center gap-2 px-0.5">
              <span className="w-8 shrink-0" />
              <p className="flex-1 text-[9px] text-white/35 font-medium text-center">משקל (kg)</p>
              <p className={`flex-1 text-[9px] font-medium text-center ${isTimeMode ? "text-cyan-400/60" : "text-white/35"}`}>
                {isTimeMode ? "שניות" : "חזרות"}
              </p>
              <span className="w-7 shrink-0" />
            </div>

            {/* Per-set rows */}
            {ex.setsData.map((s, si) => (
              <SetRow
                key={si}
                setIdx={si}
                entry={s}
                isTimeMode={isTimeMode}
                isOnly={ex.setsData.length === 1}
                onChange={(v) => updateSet(si, v)}
                onRemove={() => removeSet(si)}
              />
            ))}

            {/* Add set + weight quick-adjust */}
            <div className="flex items-center gap-2 pt-0.5">
              <button
                onClick={addSet}
                className="flex-1 py-1.5 rounded-xl bg-emerald-500/12 text-emerald-400 border border-emerald-500/20 text-[11px] font-bold flex items-center justify-center gap-1 hover:bg-emerald-500/20 active:scale-95 transition-all"
              >
                <Plus className="h-3 w-3" />הוסף סט
              </button>
              <div className="flex gap-0.5">
                <button onClick={() => incWeight(-2.5)} className={`${microBtn} px-1.5 bg-white/8 text-white/50 hover:bg-white/15`}>-2.5</button>
                <button onClick={() => incWeight(+2.5)} className={`${microBtn} px-1.5 bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25`}>+2.5</button>
                <button onClick={() => incWeight(+5)}   className={`${microBtn} px-1.5 bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25`}>+5</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Confetti Celebration ─────────────────────────────────────────────────────
// Uses deterministic positions/delays (no Math.random) to avoid re-render churn.
function ConfettiCelebration({
  prs,
  onDone,
}: {
  prs: { name: string; value: number }[];
  onDone: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onDone, 3800);
    return () => clearTimeout(t);
  }, [onDone]);

  const COLORS = ["#10b981","#f97316","#3b82f6","#eab308","#ec4899","#8b5cf6","#06b6d4","#ef4444"];

  return (
    <div className="fixed inset-0 z-[60] pointer-events-none overflow-hidden" aria-hidden="true">
      {/* Confetti particles */}
      {Array.from({ length: 28 }, (_, i) => (
        <span
          key={i}
          className="absolute"
          style={{
            left:            `${((i * 3.7 + 3) % 93) + 3}%`,
            top:             "-14px",
            width:           `${7 + (i % 5) * 1.5}px`,
            height:          `${7 + (i % 5) * 1.5}px`,
            borderRadius:    i % 3 === 0 ? "50%" : "3px",
            backgroundColor: COLORS[i % COLORS.length],
            animation:       `confettiFall ${2.0 + (i % 6) * 0.28}s ${(i % 9) * 0.11}s cubic-bezier(.15,0,.8,1) both`,
          }}
        />
      ))}

      {/* Celebration card */}
      <div
        className="absolute inset-0 flex items-center justify-center px-6 pointer-events-auto"
        onClick={onDone}
      >
        <div
          className="text-center bg-black/93 border border-amber-400/35 backdrop-blur-2xl rounded-3xl p-6 shadow-2xl shadow-amber-400/15 max-w-xs w-full"
          style={{ animation: "prBounce 0.42s cubic-bezier(.17,.67,.35,1.4) both" }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-5xl mb-1" style={{ display: "inline-block", animation: "prSpin 0.4s 0.08s ease-out both" }}>🏆</div>
          <p className="text-[10px] font-bold tracking-widest text-amber-400/55 uppercase mt-1">Personal Record</p>
          <p className="text-xl font-black text-amber-400 mt-0.5 mb-3">שיא אישי חדש!</p>
          <div className="space-y-1.5">
            {prs.map((pr, idx) => (
              <div key={idx}
                className="flex items-center justify-between px-3 py-2 rounded-2xl bg-amber-400/8 border border-amber-400/15"
              >
                <span className="text-xs font-bold text-white/75 text-end truncate ms-2">{pr.name}</span>
                <span className="text-sm font-black text-amber-400 shrink-0">{pr.value} ק״ג</span>
              </div>
            ))}
          </div>
          <button onClick={onDone} className="mt-4 text-[10px] text-white/25 hover:text-white/45 transition-colors">
            הקש לסגירה
          </button>
        </div>
      </div>
    </div>
  );
}

const BUILDER_GOALS = ["בניית שריר", "ירידה במשקל", "כוח מקסימלי", "סיבולת"];
const EQUIPMENT_OPTS = ["חדר כושר", "ביתי", "ללא ציוד", "משולב"];
const DAYS_OPTS = [3, 4, 5, 6];
const MUSCLE_OPTIONS = ["חזה","גב","כתפיים","ביצפס","טריצפס","רגליים","ישבן","ליבה","שוקיים"];
const REST_DAY_LABELS = ["א'","ב'","ג'","ד'","ה'","ו'","ש'"];
const CARDIO_OPTIONS = [
  { label: "ריצה",       icon: "🏃", value: "ריצה" },
  { label: "אופניים",    icon: "🚴", value: "אופניים" },
  { label: "HIIT",       icon: "⚡", value: "HIIT" },
  { label: "שחייה",      icon: "🏊", value: "שחייה" },
  { label: "חבל קפיצה", icon: "🤸", value: "חבל קפיצה" },
  { label: "חתירה",      icon: "🚣", value: "חתירה" },
  { label: "אליפטי",     icon: "🎯", value: "אליפטי" },
  { label: "הליכה",      icon: "🚶", value: "הליכה" },
];
const DAY_EQUIPMENT_OPTIONS = [
  { label: "חדר כושר",   icon: "💪", value: "gym" },
  { label: "קליסטניקס",  icon: "🤸", value: "calisthenics" },
  { label: "בית",         icon: "🏠", value: "home" },
];

const CARDIO_METRICS: Record<string, { primary: string; primaryUnit: string; alternatives: Array<{label: string; unit: string; toMinutes: (val: number) => number}> }> = {
  "ריצה":        { primary: "ק\"מ", primaryUnit: "km",     alternatives: [{ label: "דקות", unit: "min", toMinutes: (v) => v }] },
  "אופניים":     { primary: "ק\"מ", primaryUnit: "km",     alternatives: [{ label: "דקות", unit: "min", toMinutes: (v) => v }] },
  "שחייה":       { primary: "אורכי בריכה (25מ׳)", primaryUnit: "lengths", alternatives: [{ label: "בריכות (50מ׳)", unit: "pools", toMinutes: (v) => v * 3 }, { label: "ק\"מ", unit: "km", toMinutes: (v) => v * 30 }, { label: "דקות", unit: "min", toMinutes: (v) => v }] },
  "חבל קפיצה":  { primary: "דקות", primaryUnit: "min",    alternatives: [{ label: "סיבובים", unit: "rounds", toMinutes: (v) => v * 3 }] },
  "חתירה":       { primary: "מטרים", primaryUnit: "m",     alternatives: [{ label: "דקות", unit: "min", toMinutes: (v) => v }] },
  "HIIT":        { primary: "סיבובים", primaryUnit: "rounds", alternatives: [{ label: "דקות", unit: "min", toMinutes: (v) => v }] },
  "הליכה":       { primary: "ק\"מ", primaryUnit: "km",     alternatives: [{ label: "דקות", unit: "min", toMinutes: (v) => v }] },
  "טיול הרים":   { primary: "ק\"מ", primaryUnit: "km",     alternatives: [{ label: "דקות", unit: "min", toMinutes: (v) => v }] },
  "אליפטי":      { primary: "דקות", primaryUnit: "min",    alternatives: [] },
};

type WorkoutDbCategory = "weights" | "calisthenics" | "running" | "mixed";
const WORKOUT_CATEGORIES: { value: WorkoutDbCategory; label: string }[] = [
  { value: "weights",      label: "🏋️ כוח"      },
  { value: "calisthenics", label: "🤸 קלסטניקס"  },
  { value: "mixed",        label: "⚡ HIIT"       },
];
/** Coerce any legacy/unknown category string to a valid DB value */
const toDbCategory = (cat: string | undefined): WorkoutDbCategory => {
  const valid: WorkoutDbCategory[] = ["weights","calisthenics","running","mixed"];
  return valid.includes(cat as WorkoutDbCategory) ? (cat as WorkoutDbCategory) : "weights";
};

function AIProcessingOverlay() {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(18px)" }}
    >
      <div
        className="w-72 rounded-3xl border border-white/15 bg-white/8 p-8 text-center space-y-5 shadow-2xl"
        style={{ animation: "prBounce 0.42s cubic-bezier(.17,.67,.35,1.4) both" }}
      >
        <div className="flex justify-center">
          <Loader2 className="h-10 w-10 text-emerald-400 animate-spin" />
        </div>
        <p className="text-sm font-bold text-white leading-relaxed" dir="rtl">
          האימון נשמר! ה-AI מנתח כעת את הנתונים ומכין עבורך דוח מפורט...
        </p>
      </div>
    </div>
  );
}

function WorkoutBuilderTab({
  externalTemplate,
  onExternalTemplateConsumed,
  pendingExercises,
  onPendingExercisesConsumed,
  pendingSSExercise,
  onPendingSSExerciseConsumed,
  pendingSSPair,
  onPendingSSPairConsumed,
  onWorkoutComplete,
  onGoToLibrary,
}: {
  externalTemplate?: any;
  onExternalTemplateConsumed?: () => void;
  pendingExercises?: LibraryExercise[];
  onPendingExercisesConsumed?: () => void;
  pendingSSExercise?: LibraryExercise | null;
  onPendingSSExerciseConsumed?: () => void;
  pendingSSPair?: [LibraryExercise, LibraryExercise] | null;
  onPendingSSPairConsumed?: () => void;
  onWorkoutComplete?: () => void;
  onGoToLibrary?: () => void;
}) {
  const STORAGE_KEY = "sport-active-workout-v1";
  const EXPIRY_MS = 4 * 60 * 60 * 1000; // 4 hours

  interface ActiveWorkoutStorage {
    workoutName: string;
    workoutCategory: WorkoutDbCategory;
    exercises: BuilderEx[];
    loadedTemplateId: string | null;
    startedAt: number;
  }

  const [subTab, setSubTab] = useState<"ai" | "custom">("custom");
  const [workoutName, setWorkoutName]         = useState("");
  const [workoutCategory, setWorkoutCategory] = useState<WorkoutDbCategory>("weights");
  const [exercises, setExercises]             = useState<BuilderEx[]>([{ name: "", sets: 3, reps: 10, weight_kg: 0, setsData: toSetsData(3, 10, 0), group: 0 }]);
  const [groupCounter, setGroupCounter]       = useState(0);
  const [showLibraryPicker, setShowLibraryPicker] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const startedAtRef = useRef<number | null>(null);
  const addTemplate    = useAddWorkoutTemplate();
  const addWorkout     = useAddWorkout();
  const { data: templates } = useWorkoutTemplates();
  const deleteTemplate = useDeleteWorkoutTemplate();
  const autoPR         = useAddPersonalRecord();
  const qc             = useQueryClient();
  const savePlan       = useSaveWorkoutPlan();
  const { data: savedPlans } = useWorkoutPlans();
  const deleteSavedPlan = useDeleteWorkoutPlan();
  const [showPlanHistory, setShowPlanHistory] = useState(false);
  const [celebPRs, setCelebPRs] = useState<{ name: string; value: number }[]>([]);
  const [hiddenTemplateIds] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("qw-hidden") ?? "[]"); } catch { return []; }
  });

  // ── Duration modal (Task 3) ──────────────────────────────────────
  const [showDurationModal, setShowDurationModal] = useState(false);
  const [durationMinutes,   setDurationMinutes]   = useState("45");
  const [loadedTemplateId, setLoadedTemplateId] = useState<string | null>(null);
  const updateTemplate = useUpdateWorkoutTemplate();
  const pendingWorkout = useRef<{ filled: BuilderEx[]; category: string; name: string } | null>(null);

  // ── Workout summary (Task 4) ─────────────────────────────────────
  const [isSaving, setIsSaving] = useState(false);
  const [workoutSummary, setWorkoutSummary] = useState<{ mins: number; name: string; muscles?: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);
  const [templateUndoBanner, setTemplateUndoBanner] = useState<{ id: string; name: string } | null>(null);
  const [exitTemplateConfirm, setExitTemplateConfirm] = useState(false);
  const templateDeleteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [templatePendingDeleteIds, setTemplatePendingDeleteIds] = useState<Set<string>>(new Set());

  // Load template pushed from the dashboard
  useEffect(() => {
    if (!externalTemplate) return;
    setWorkoutName(externalTemplate.name ?? "");
    setWorkoutCategory(toDbCategory(externalTemplate.category));
    setLoadedTemplateId(externalTemplate.id ?? null);
    setExercises(
      (externalTemplate.exercises ?? []).map((e: any) => {
        const s = e.sets ?? 3; const r = Number(e.reps) || 10; const w = e.weight_kg ?? 0;
        return { name: e.name, sets: s, reps: r, weight_kg: w, setsData: e.sets_data ?? toSetsData(s, r, w) };
      })
    );
    setSubTab("custom");
    onExternalTemplateConsumed?.();
  }, [externalTemplate]);

  // Append exercises picked from the library (new group per batch for zebra striping)
  useEffect(() => {
    if (!pendingExercises?.length) return;
    const parseReps = (reps: string): number => {
      const m = reps.match(/\d+/);
      return m ? parseInt(m[0]) : 10;
    };
    setGroupCounter((prevG) => {
      const newGroup = prevG + 1;
      setExercises((prev) => [
        ...prev.filter((e) => e.name.trim()),
        ...pendingExercises.map((ex) => {
          const s = ex.defaultSets; const r = parseReps(ex.defaultReps);
          return { name: ex.name, sets: s, reps: r, weight_kg: 0, setsData: toSetsData(s, r, 0), group: newGroup };
        }),
      ]);
      toast.success(`✅ ${pendingExercises.length} תרגילים נוספו לאימון`);
      return newGroup;
    });
    setSubTab("custom");
    onPendingExercisesConsumed?.();
  }, [pendingExercises]);

  // ── Append exercise as Super Set (from library selectionMode) ──
  useEffect(() => {
    if (!pendingSSExercise) return;
    const parseReps = (reps: string): number => { const m = reps.match(/\d+/); return m ? parseInt(m[0]) : 10; };
    const ssId = crypto.randomUUID();
    setGroupCounter((prevG) => {
      const newGroup = prevG + 1;
      const s = pendingSSExercise.defaultSets;
      const r = parseReps(pendingSSExercise.defaultReps);
      setExercises((prev) => [
        ...prev.filter((e) => e.name.trim()),
        { name: pendingSSExercise.name, sets: s, reps: r, weight_kg: 0, setsData: toSetsData(s, r, 0), group: newGroup, supersetId: ssId, supersetOrder: 0 },
        { name: "", sets: 3, reps: 10, weight_kg: 0, setsData: toSetsData(3, 10, 0), group: newGroup, supersetId: ssId, supersetOrder: 1 },
      ]);
      return newGroup;
    });
    setSubTab("custom");
    onPendingSSExerciseConsumed?.();
  }, [pendingSSExercise]);

  // ── Append SS pair picked from library ─────────────────────────
  useEffect(() => {
    if (!pendingSSPair) return;
    const parseReps = (reps: string): number => { const m = reps.match(/\d+/); return m ? parseInt(m[0]) : 10; };
    const [first, second] = pendingSSPair;
    const ssId = crypto.randomUUID();
    setGroupCounter((prevG) => {
      const newGroup = prevG + 1;
      setExercises((prev) => [
        ...prev.filter((e) => e.name.trim()),
        { name: first.name,  sets: first.defaultSets,  reps: parseReps(first.defaultReps),  weight_kg: 0, setsData: toSetsData(first.defaultSets,  parseReps(first.defaultReps),  0), group: newGroup, supersetId: ssId, supersetOrder: 0 },
        { name: second.name, sets: second.defaultSets, reps: parseReps(second.defaultReps), weight_kg: 0, setsData: toSetsData(second.defaultSets, parseReps(second.defaultReps), 0), group: newGroup, supersetId: ssId, supersetOrder: 1 },
      ]);
      return newGroup;
    });
    setSubTab("custom");
    onPendingSSPairConsumed?.();
  }, [pendingSSPair]);

  // ── Restore active workout from localStorage on mount ──────────
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved: ActiveWorkoutStorage = JSON.parse(raw);
      if (Date.now() - saved.startedAt > EXPIRY_MS) {
        localStorage.removeItem(STORAGE_KEY);
        return;
      }
      setWorkoutName(saved.workoutName);
      setWorkoutCategory(saved.workoutCategory);
      setExercises(saved.exercises.length ? saved.exercises : [{ name: "", sets: 3, reps: 10, weight_kg: 0, setsData: toSetsData(3, 10, 0), group: 0 }]);
      setLoadedTemplateId(saved.loadedTemplateId);
      setIsActive(true);
      startedAtRef.current = saved.startedAt;
    } catch { /* ignore */ }
  }, []);

  // ── Auto-save to localStorage when active ──────────────────────
  useEffect(() => {
    if (!isActive) return;
    if (!startedAtRef.current) return;
    const data: ActiveWorkoutStorage = {
      workoutName,
      workoutCategory,
      exercises,
      loadedTemplateId,
      startedAt: startedAtRef.current,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [isActive, workoutName, workoutCategory, exercises, loadedTemplateId]);

  const updateEx = (i: number, v: BuilderEx) => setExercises((prev) => prev.map((e, idx) => idx === i ? v : e));
  const removeEx = (i: number) => setExercises((prev) => prev.filter((_, idx) => idx !== i));
  const dupEx    = (i: number) => setExercises((prev) => { const c = [...prev]; c.splice(i + 1, 0, { ...prev[i] }); return c; });
  const addEx    = () => setExercises((prev) => {
    const lastGroup = prev.length ? (prev[prev.length - 1].group ?? 0) : 0;
    return [...prev, { name: "", sets: 3, reps: 10, weight_kg: 0, setsData: toSetsData(3, 10, 0), group: lastGroup }];
  });

  const handleSaveTemplate = async () => {
    if (!workoutName.trim()) return toast.error("תן שם לאימון");
    const filled = exercises.filter((e) => e.name.trim());
    if (!filled.length) return toast.error("הוסף לפחות תרגיל אחד");
    try {
      await addTemplate.mutateAsync({ name: workoutName, category: workoutCategory, exercises: filled });
      toast.success("תבנית נשמרה ✅");
      setWorkoutName(""); setExercises([{ name: "", sets: 3, reps: 10, weight_kg: 0, setsData: toSetsData(3, 10, 0) }]);
    } catch { toast.error("שגיאה בשמירה"); }
  };

  // ── Step 1: validate → open duration modal (no DB save yet) ────
  const handleLogNow = () => {
    if (!workoutName.trim()) return toast.error("תן שם לאימון");
    const filled = exercises.filter((e) => e.name.trim());
    if (!filled.length) return toast.error("הוסף לפחות תרגיל אחד");
    pendingWorkout.current = { filled, category: workoutCategory, name: workoutName };
    setDurationMinutes("45");
    setShowDurationModal(true);
  };

  // ── Step 2: duration confirmed → DB save → summary ──
  const handleConfirmDuration = async (mins: number) => {
    const pw = pendingWorkout.current;
    if (!pw) return;
    setShowDurationModal(false);
    setIsSaving(true);

    try {
      // ── 1. Save workout row ──────────────────────────────────
      const exercisesPayload = pw.filled.map((e) => ({
        name:       e.name,
        sets:       e.setsData.length,
        reps:       e.setsData.at(-1)?.reps ?? e.reps,
        weight_kg:  e.setsData.at(-1)?.weight_kg ?? e.weight_kg,
        sets_data:  e.setsData,
      }));
      await addWorkout.mutateAsync({
        category:         toDbCategory(pw.category),
        exercises:        exercisesPayload,
        notes:            pw.name,
        duration_minutes: mins,
        template_id:      loadedTemplateId ?? undefined,
      });

      // ── 3. Smart Template Auto-Update ───────────────────────
      if (loadedTemplateId) {
        const allTemplates: any[] = qc.getQueryData(["workout-templates"]) ?? [];
        const base = allTemplates.find((t: any) => t.id === loadedTemplateId);
        if (base) {
          const doneMap = new Map(pw.filled.map((e) => [e.name, e]));
          const merged = (base.exercises ?? []).map((te: any) => {
            const done = doneMap.get(te.name);
            if (!done) return te;
            return {
              ...te,
              sets:       done.setsData.length,
              reps:       done.setsData.at(-1)?.reps ?? te.reps,
              weight_kg:  done.setsData.at(-1)?.weight_kg ?? te.weight_kg,
              sets_data:  done.setsData,
            };
          });
          try { updateTemplate.mutate({ id: loadedTemplateId, exercises: merged }); } catch {/* non-critical */}
        }
      }

      // ── 4. Auto-PR detection ─────────────────────────────────
      const withWeight = pw.filled.filter((e) => (e.setsData.at(-1)?.weight_kg ?? e.weight_kg) > 0);
      if (withWeight.length > 0) {
        const cachedPRs: any[] = qc.getQueryData(["personal-records"]) ?? [];
        const newlyHit: { name: string; value: number }[] = [];
        for (const ex of withWeight) {
          const topWeight = Math.max(...ex.setsData.map((s) => s.weight_kg));
          const bestKg = cachedPRs
            .filter((pr: any) => pr.exercise_name === ex.name && pr.unit === "kg")
            .reduce((best: number, pr: any) => Math.max(best, Number(pr.value)), 0);
          if (topWeight > bestKg) {
            try {
              await autoPR.mutateAsync({
                exercise_name: ex.name,
                value:         topWeight,
                unit:          "kg",
                category:      pw.category === "running" ? "mixed" : pw.category,
              });
              newlyHit.push({ name: ex.name, value: topWeight });
            } catch {/* non-critical */}
          }
        }
        if (newlyHit.length > 0) setCelebPRs(newlyHit);
      }

      // ── 5. Reset builder state ───────────────────────────────
      const muscles = [...new Set(pw.filled.map((e) => e.name).slice(0, 3))].join(", ");
      setWorkoutName("");
      setExercises([{ name: "", sets: 3, reps: 10, weight_kg: 0, setsData: toSetsData(3, 10, 0) }]);
      setLoadedTemplateId(null);
      pendingWorkout.current = null;
      localStorage.removeItem(STORAGE_KEY);
      setIsActive(false);
      startedAtRef.current = null;

      // ── 6. Show summary ──────────────────────────────────────
      setIsSaving(false);
      toast.success("האימון נשמר בהצלחה ✓");
      setWorkoutSummary({ mins, name: pw.name, muscles });

    } catch (err: any) {
      setIsSaving(false);
      const msg = err?.message ?? err?.error_description ?? JSON.stringify(err) ?? "unknown";
      console.error("[handleConfirmDuration] save failed:", msg, err);
      toast.error(`שגיאה בשמירה: ${msg.slice(0, 80)}`);
    }
  };

  const handleResetToNewTemplate = () => {
    setWorkoutName("");
    setWorkoutCategory("weights");
    setLoadedTemplateId(null);
    setExercises([{ name: "", sets: 3, reps: 10, weight_kg: 0, setsData: toSetsData(3, 10, 0), group: 0 }]);
    setExitTemplateConfirm(false);
    localStorage.removeItem("sport-active-workout-v1");
  };

  const handleLoadTemplate = (t: any) => {
    setWorkoutName(t.name);
    setWorkoutCategory(toDbCategory(t.category));
    setLoadedTemplateId(t.id ?? null);
    setExercises((t.exercises ?? []).map((e: any) => {
      const s = e.sets ?? 3; const r = Number(e.reps) || 10; const w = e.weight_kg || 0;
      return { name: e.name, sets: s, reps: r, weight_kg: w, setsData: e.sets_data ?? toSetsData(s, r, w) };
    }));
    toast.info(`טעינת תבנית: ${t.name}`);
  };

  const [aiGoal, setAiGoal]       = useState(BUILDER_GOALS[0]);
  const [aiDays, setAiDays]       = useState(4);
  const [aiEquip, setAiEquip]     = useState(EQUIPMENT_OPTS[0]);
  const [aiConstraints, setAiConstraints] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiPlan, setAiPlan]       = useState<WorkoutPlan | null>(null);
  const [expandedDay, setExpandedDay] = useState<number | null>(0);
  const [selectedWeek, setSelectedWeek] = useState<number>(1);
  const [aiChatMsg, setAiChatMsg] = useState("");
  const [aiChatLoading, setAiChatLoading] = useState(false);
  const [savedPlanBanner, setSavedPlanBanner] = useState(false);
  const [aiAge, setAiAge] = useState<number | "">("");
  const [aiGender, setAiGender] = useState<"male" | "female" | "other">("male");
  const [aiLevel, setAiLevel] = useState<"beginner" | "intermediate" | "advanced">("intermediate");
  const [aiSessionMins, setAiSessionMins] = useState<30 | 45 | 60 | 90>(60);
  const [aiIntensity, setAiIntensity] = useState(3);
  const [aiPreferMuscles, setAiPreferMuscles] = useState<string[]>([]);
  const [aiAvoidMuscles, setAiAvoidMuscles] = useState<string[]>([]);
  const [aiFavorites, setAiFavorites] = useState<string[]>([]);
  const [aiBlacklist, setAiBlacklist] = useState<string[]>([]);
  // Questionnaire step state
  const [aiStep,         setAiStep]         = useState(0);
  const [aiCardio,       setAiCardio]       = useState<boolean | null>(null);
  const [aiCardioTypes,  setAiCardioTypes]  = useState<string[]>([]);
  const [aiCardioDays,   setAiCardioDays]   = useState<number>(1);
  const [aiDayEquipment, setAiDayEquipment] = useState<Record<number, string>>({});
  const { data: prs } = usePersonalRecords();
  const { data: fitnessProfile } = useUserFitnessProfile();
  const updateProfile = useUpdateFitnessProfile();

  useEffect(() => {
    if (!fitnessProfile) return;
    if (fitnessProfile.age) setAiAge(fitnessProfile.age);
    if (fitnessProfile.gender) setAiGender(fitnessProfile.gender);
    if (fitnessProfile.fitness_level) setAiLevel(fitnessProfile.fitness_level);
    if (fitnessProfile.preferred_muscles?.length) setAiPreferMuscles(fitnessProfile.preferred_muscles);
    if (fitnessProfile.avoided_muscles?.length) setAiAvoidMuscles(fitnessProfile.avoided_muscles);
    if (fitnessProfile.favorite_exercises?.length) setAiFavorites(fitnessProfile.favorite_exercises);
    if (fitnessProfile.blacklisted_exercises?.length) setAiBlacklist(fitnessProfile.blacklisted_exercises);
  }, [fitnessProfile]);

  const handleGeneratePlan = async () => {
    setAiLoading(true); setAiPlan(null);
    try {
      // Build equipment string — for "משולב", include per-day breakdown
      let equipmentStr = aiEquip;
      if (aiEquip === "משולב" && Object.keys(aiDayEquipment).length > 0) {
        const dayLines = Array.from({ length: aiDays }, (_, i) => {
          const opt = DAY_EQUIPMENT_OPTIONS.find(o => o.value === aiDayEquipment[i]);
          return `יום ${i + 1}: ${opt?.label ?? "חדר כושר"}`;
        }).join(", ");
        equipmentStr = `משולב (${dayLines})`;
      }

      // Build a filtered exercise list for the AI — only send exercises relevant
      // to the selected equipment to keep token usage low.
      const noEquip = aiEquip.includes("ללא ציוד") || aiEquip === "משולב";
      const basicEquip = aiEquip.includes("ציוד בסיסי");
      const sourceGroups = noEquip
        ? CALISTHENICS_MUSCLE_GROUPS
        : basicEquip
          ? [...CALISTHENICS_MUSCLE_GROUPS, ...MUSCLE_GROUPS]
          : MUSCLE_GROUPS;
      const exerciseList = sourceGroups
        .flatMap((g) => g.exercises)
        .map((ex) => ({ name: ex.name, muscles: ex.muscles, equipment: ex.equipment }));

      const plan = await generateWorkoutPlan({
        goal: aiGoal,
        daysPerWeek: aiDays,
        equipment: equipmentStr,
        constraints: aiConstraints || "אין",
        age: aiAge !== "" ? aiAge : undefined,
        gender: aiGender,
        fitnessLevel: aiLevel,
        sessionMinutes: aiSessionMins,
        intensity: aiIntensity as 1|2|3|4|5,
        cardioType: aiCardio && aiCardioTypes.length > 0 ? aiCardioTypes.join(", ") : undefined,
        cardioDays: aiCardio ? aiCardioDays : 0,
        preferredMuscles: aiPreferMuscles,
        avoidedMuscles: aiAvoidMuscles,
        favoriteExercises: aiFavorites,
        blacklistedExercises: aiBlacklist,
        recentPRs: (prs ?? []).slice(0, 5).map((p: any) => ({ exercise_name: p.exercise_name, value: p.value, unit: p.unit })),
        exerciseList,
      });
      updateProfile.mutate({
        age: aiAge !== "" ? aiAge : undefined,
        gender: aiGender,
        fitness_level: aiLevel,
        preferred_muscles: aiPreferMuscles,
        avoided_muscles: aiAvoidMuscles,
        favorite_exercises: aiFavorites,
        blacklisted_exercises: aiBlacklist,
      });
      setAiPlan(plan); setExpandedDay(0);
    } catch { toast.error("שגיאה ביצירת תוכנית, נסה שנית"); }
    finally { setAiLoading(false); }
  };

  return (
  <>
    <div className="px-4 pt-8 space-y-4">
      <div className="flex gap-1 p-1 rounded-2xl border border-white/10 bg-white/5">
        {([["custom", "🏗️ בנה אימון"], ["ai", "🤖 AI Planner"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setSubTab(k)}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${subTab === k ? "bg-emerald-500 text-white shadow-lg" : "text-white/40"}`}>
            {l}
          </button>
        ))}
      </div>

      {subTab === "custom" && (
        <div className="space-y-4">
          {((templates ?? []).filter((t: any) => !hiddenTemplateIds.includes(t.id) && !templatePendingDeleteIds.has(t.id))).length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] font-bold text-white/40">תבניות שמורות</p>
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                {(templates ?? []).filter((t: any) => !hiddenTemplateIds.includes(t.id) && !templatePendingDeleteIds.has(t.id)).map((t: any) => (
                  <div key={t.id} className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/10 bg-white/5">
                    <button onClick={() => handleLoadTemplate(t)} className="text-xs font-semibold text-white/80 hover:text-white whitespace-nowrap">{t.name}</button>
                    <button onClick={() => {
                      // Cancel any previous pending delete
                      if (templateDeleteTimer.current) clearTimeout(templateDeleteTimer.current);
                      // Optimistically hide
                      setTemplatePendingDeleteIds((prev) => new Set([...prev, t.id]));
                      // Show undo banner
                      setTemplateUndoBanner({ id: t.id, name: t.name });
                      // Fire delete after 3 seconds
                      templateDeleteTimer.current = setTimeout(() => {
                        deleteTemplate.mutate(t.id);
                        setTemplatePendingDeleteIds((prev) => { const s = new Set(prev); s.delete(t.id); return s; });
                        setTemplateUndoBanner(null);
                        templateDeleteTimer.current = null;
                      }, 3000);
                    }} className="text-red-400/60 hover:text-red-400"><X className="h-3 w-3" /></button>
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* ── Exit template banner ─────────────────────────────────── */}
          {loadedTemplateId && (
            <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/25">
              <button
                onClick={() => setExitTemplateConfirm(true)}
                className="flex items-center gap-1.5 text-red-400/70 hover:text-red-400 transition-colors text-[11px] font-bold"
              >
                <X className="h-3.5 w-3.5" />
                יציאה מהתבנית
              </button>
              <span className="text-[11px] font-bold text-emerald-400">
                ✏️ עורך: {workoutName || "תבנית"}
              </span>
            </div>
          )}

          <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl px-4 py-3">
            <input value={workoutName} onChange={(e) => setWorkoutName(e.target.value)}
              placeholder="שם האימון (למשל: כוח עליון)"
              className="w-full bg-transparent text-sm font-black text-white placeholder:text-white/25 outline-none text-end" dir="rtl" />
          </div>

          {/* ── Exit template confirmation dialog ────────────────────── */}
          {exitTemplateConfirm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center px-6 bg-black/60 backdrop-blur-sm">
              <div className="w-full max-w-sm rounded-2xl border border-white/15 bg-[#1a1a2e] p-6 space-y-4 shadow-2xl">
                <div className="text-center space-y-1">
                  <p className="text-base font-black text-white">יציאה מהתבנית</p>
                  <p className="text-xs text-white/50">האם אתה בטוח שברצונך לצאת מהתבנית <span className="text-white/80 font-bold">"{workoutName}"</span>?</p>
                </div>
                <div className="space-y-2">
                  <button
                    onClick={async () => {
                      // Save first then reset
                      if (workoutName.trim()) {
                        try {
                          const filled = exercises.filter(e => e.name.trim());
                          if (filled.length > 0 && loadedTemplateId) {
                            await updateTemplate.mutateAsync({ id: loadedTemplateId, exercises: filled });
                            toast.success("התבנית נשמרה ✓");
                          }
                        } catch { toast.error("שגיאה בשמירה"); }
                      }
                      handleResetToNewTemplate();
                    }}
                    className="w-full py-3 rounded-xl bg-emerald-500 text-white text-sm font-black hover:bg-emerald-400 transition-colors"
                  >
                    💾 שמור וצא
                  </button>
                  <button
                    onClick={handleResetToNewTemplate}
                    className="w-full py-3 rounded-xl bg-white/8 border border-white/10 text-white/70 text-sm font-bold hover:text-white transition-colors"
                  >
                    🚪 צא ללא שמירה
                  </button>
                  <button
                    onClick={() => setExitTemplateConfirm(false)}
                    className="w-full py-2 text-white/30 text-xs font-bold hover:text-white/50 transition-colors"
                  >
                    ביטול
                  </button>
                </div>
              </div>
            </div>
          )}
          <div className="flex gap-1.5">
            {WORKOUT_CATEGORIES.map(({ value, label }) => (
              <button key={value} onClick={() => setWorkoutCategory(value)}
                className={`flex-1 py-1.5 rounded-xl text-[10px] font-bold transition-all border ${
                  workoutCategory === value
                    ? "bg-emerald-500/25 text-emerald-300 border-emerald-500/50"
                    : "text-white/30 border-white/10 hover:text-white/50"
                }`}>
                {label}
              </button>
            ))}
          </div>
          <div className="space-y-2.5">
            {(() => {
              // Compute zebra accent colors per group block
              let block = 0;
              let prevGroup: number | undefined = undefined;
              return exercises.map((ex, i) => {
                const g = ex.group ?? 0;
                if (prevGroup !== undefined && g !== prevGroup) block++;
                prevGroup = g;
                const accentColor = GROUP_ACCENT_COLORS[block % GROUP_ACCENT_COLORS.length];
                const isFirstSS = ex.supersetId && ex.supersetOrder === 0;
                const isSecondSS = ex.supersetId && ex.supersetOrder === 1;
                return (
                  <div key={i} className="relative">
                    {isFirstSS && (
                      <div className="absolute -left-1 top-0 bottom-0 w-0.5 bg-purple-500/40 rounded-full" style={{ top: '50%', height: '50%' }} />
                    )}
                    {isSecondSS && (
                      <div className="absolute -left-1 top-0 bottom-1/2 w-0.5 bg-purple-500/40 rounded-full" />
                    )}
                    {isFirstSS && (
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-black text-purple-400 bg-purple-500/15 border border-purple-500/30 px-2 py-0.5 rounded-full">SS · סופר סט</span>
                      </div>
                    )}
                    <BuilderExerciseRow
                      ex={ex}
                      idx={i}
                      accentColor={accentColor}
                      onChange={(v) => updateEx(i, v)}
                      onRemove={() => removeEx(i)}
                      onDuplicate={() => dupEx(i)}
                    />
                    {isFirstSS && (
                      <div className="flex items-center gap-2 my-1 px-2">
                        <div className="flex-1 h-px bg-purple-500/20" />
                        <span className="text-[9px] text-purple-400/60 font-bold">ואז</span>
                        <div className="flex-1 h-px bg-purple-500/20" />
                      </div>
                    )}
                  </div>
                );
              });
            })()}
          </div>
          <div className="flex gap-2">
            <button onClick={addEx}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl border border-dashed border-white/20 text-white/50 hover:border-emerald-500/40 hover:text-emerald-400 transition-all text-sm font-semibold">
              <Plus className="h-4 w-4" />הוסף תרגיל
            </button>
            <button onClick={() => onGoToLibrary?.()}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl border border-dashed border-emerald-500/30 text-emerald-400/70 hover:border-emerald-500/60 hover:text-emerald-400 hover:bg-emerald-500/8 transition-all text-sm font-semibold">
              <BookOpen className="h-4 w-4" />בחר מספריית התרגילים
            </button>
            <button
              onClick={() => {
                const ssId = crypto.randomUUID();
                const lastGroup = exercises.length ? (exercises[exercises.length - 1].group ?? 0) : 0;
                const newGroup = lastGroup + 1;
                setGroupCounter((g) => g + 1);
                setExercises((prev) => [
                  ...prev.filter((e) => e.name.trim()),
                  { name: "", sets: 3, reps: 10, weight_kg: 0, setsData: toSetsData(3, 10, 0), group: newGroup, supersetId: ssId, supersetOrder: 0 },
                  { name: "", sets: 3, reps: 10, weight_kg: 0, setsData: toSetsData(3, 10, 0), group: newGroup, supersetId: ssId, supersetOrder: 1 },
                ]);
              }}
              className="flex items-center justify-center gap-1.5 px-3 py-3 rounded-2xl border border-dashed border-purple-500/30 text-purple-400/70 hover:border-purple-500/60 hover:text-purple-400 transition-all text-xs font-bold whitespace-nowrap"
              title="הוסף סופר-סט (2 תרגילים)"
            >
              SS
            </button>
          </div>
          {!isActive && (
            <div className="grid grid-cols-2 gap-3">
              <button onClick={handleSaveTemplate} disabled={addTemplate.isPending}
                className="flex items-center justify-center gap-2 py-3.5 rounded-2xl border border-white/20 bg-white/8 text-white text-sm font-bold hover:bg-white/12 active:scale-[0.98] transition-all">
                <Star className="h-4 w-4 text-amber-400" />שמור תבנית
              </button>
              <button
                onClick={() => {
                  if (!workoutName.trim()) return toast.error("תן שם לאימון");
                  const filled = exercises.filter((e) => e.name.trim());
                  if (!filled.length) return toast.error("הוסף לפחות תרגיל אחד");
                  startedAtRef.current = Date.now();
                  setIsActive(true);
                  toast.success("האימון התחיל! 💪");
                }}
                className="flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-emerald-500 text-white text-sm font-black hover:bg-emerald-400 active:scale-[0.98] transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)]">
                <Play className="h-4 w-4" />התחל אימון
              </button>
            </div>
          )}
          {isActive && (
            <div className="space-y-2">
              <div className="flex gap-2">
                <button onClick={handleLogNow} disabled={addWorkout.isPending}
                  className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-emerald-500 text-white text-sm font-black hover:bg-emerald-400 active:scale-[0.98] transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)]">
                  <Play className="h-4 w-4" />סיים אימון
                </button>
                <button
                  onClick={() => {
                    localStorage.removeItem(STORAGE_KEY);
                    setIsActive(false);
                    startedAtRef.current = null;
                    setWorkoutName("");
                    setExercises([{ name: "", sets: 3, reps: 10, weight_kg: 0, setsData: toSetsData(3, 10, 0), group: 0 }]);
                    setLoadedTemplateId(null);
                    toast.info("האימון נמחק");
                  }}
                  className="px-4 py-3.5 rounded-2xl border border-red-500/30 text-red-400 text-sm font-bold hover:bg-red-500/10 active:scale-[0.98] transition-all">
                  מחק
                </button>
              </div>
              <button
                onClick={() => onGoToLibrary?.()}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-dashed border-blue-500/30 text-blue-400/70 hover:border-blue-500/60 hover:text-blue-400 transition-all text-sm font-semibold">
                <BookOpen className="h-4 w-4" />גש לספרייה
              </button>
            </div>
          )}
        </div>
      )}

      {subTab === "ai" && (
        <div className="space-y-4">
          <SportAIPlanner />
          {/* ── Legacy inline AI questionnaire (hidden — kept for plan history) ── */}
          {false && !aiPlan && (
          <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-4">
            {/* Progress bar */}
            <div className="flex gap-1 mb-4">
              {[0,1,2,3,4].map(i => (
                <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                  i < aiStep ? "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]" : i === aiStep ? "bg-emerald-500/40" : "bg-white/10"
                }`} />
              ))}
            </div>

            {/* ── Step 0: Frequency ────────────────────────────────────── */}
            {aiStep === 0 && (
              <div className="space-y-3">
                <p className="text-sm font-bold text-white">כמה פעמים בשבוע תרצה/י להתאמן?</p>
                <div className="flex gap-2">
                  {[2,3,4,5,6].map(d => (
                    <button key={d} onClick={() => { setAiDays(d); setAiStep(1); }}
                      className={`flex-1 py-3.5 rounded-2xl text-base font-black border transition-all min-h-[50px] ${
                        aiDays===d ? "bg-emerald-500/25 text-emerald-300 border-emerald-500/50" : "text-white/60 border-white/10 hover:border-emerald-500/30 hover:text-white"
                      }`}>
                      {d}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── Step 1: Equipment ────────────────────────────────────── */}
            {aiStep === 1 && (
              <div className="space-y-3">
                <p className="text-sm font-bold text-white">איפה מתאמנים?</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "💪 חדר כושר", value: "חדר כושר" },
                    { label: "🏠 בבית",      value: "ביתי" },
                    { label: "🌿 בחוץ",      value: "ללא ציוד" },
                    { label: "🔀 משולב",     value: "משולב" },
                  ].map(opt => (
                    <button key={opt.value}
                      onClick={() => {
                        setAiEquip(opt.value);
                        setAiDayEquipment({});
                        if (opt.value !== "משולב") setAiStep(2);
                      }}
                      className={`py-3 rounded-2xl text-xs font-bold border transition-all min-h-[44px] ${
                        aiEquip===opt.value ? "bg-emerald-500/25 text-emerald-300 border-emerald-500/50" : "text-white/60 border-white/10 hover:border-emerald-500/30 hover:text-white"
                      }`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
                {/* Per-day chips for "משולב" */}
                {aiEquip === "משולב" && (
                  <div className="space-y-2 mt-1">
                    <p className="text-[11px] text-white/50">בחר ציוד לכל יום:</p>
                    {Array.from({ length: aiDays }, (_, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-[10px] text-white/40 w-10 shrink-0 text-end">יום {i+1}</span>
                        <div className="flex gap-1.5 flex-1">
                          {DAY_EQUIPMENT_OPTIONS.map(opt => (
                            <button key={opt.value}
                              onClick={() => setAiDayEquipment(prev => ({ ...prev, [i]: opt.value }))}
                              className={`flex-1 py-1.5 rounded-xl text-[10px] font-bold border transition-all ${
                                aiDayEquipment[i]===opt.value ? "bg-emerald-500/25 text-emerald-300 border-emerald-500/50" : "text-white/50 border-white/10 hover:text-white/70"
                              }`}>
                              {opt.icon} {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                    <button
                      disabled={Object.keys(aiDayEquipment).length < aiDays}
                      onClick={() => setAiStep(2)}
                      className="w-full py-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/20 text-emerald-400 text-xs font-bold disabled:opacity-30 hover:bg-emerald-500/25 transition-colors mt-1 min-h-[44px]">
                      המשך ←
                    </button>
                  </div>
                )}
                <button onClick={() => setAiStep(0)} className="flex items-center gap-1 text-[11px] text-white/30 hover:text-white/60 transition-colors pt-1">
                  ← חזור
                </button>
              </div>
            )}

            {/* ── Step 2: Cardio ───────────────────────────────────────── */}
            {aiStep === 2 && (
              <div className="space-y-3">
                <p className="text-sm font-bold text-white">האם תרצה/י לכלול אימון אירובי?</p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setAiCardio(true)}
                    className={`flex-1 py-3 rounded-2xl text-xs font-bold border transition-all min-h-[44px] ${
                      aiCardio===true ? "bg-emerald-500/25 text-emerald-300 border-emerald-500/50" : "text-white/60 border-white/10 hover:border-emerald-500/30"
                    }`}>
                    ✅ כן
                  </button>
                  <button
                    onClick={() => { setAiCardio(false); setAiCardioTypes([]); setAiStep(3); }}
                    className={`flex-1 py-3 rounded-2xl text-xs font-bold border transition-all min-h-[44px] ${
                      aiCardio===false ? "bg-white/15 text-white border-white/30" : "text-white/60 border-white/10 hover:border-white/25"
                    }`}>
                    ❌ לא
                  </button>
                </div>
                {aiCardio === true && (
                  <div className="space-y-3">
                    <p className="text-[11px] text-white/50">איזה סוג אירובי? (אפשר לבחור כמה)</p>
                    <div className="grid grid-cols-4 gap-1.5">
                      {CARDIO_OPTIONS.map(opt => (
                        <button key={opt.value}
                          onClick={() => setAiCardioTypes(prev =>
                            prev.includes(opt.value) ? prev.filter(x=>x!==opt.value) : [...prev, opt.value]
                          )}
                          className={`py-2 rounded-xl text-[10px] font-bold border transition-all flex flex-col items-center gap-0.5 ${
                            aiCardioTypes.includes(opt.value) ? "bg-emerald-500/25 text-emerald-300 border-emerald-500/50" : "text-white/50 border-white/10 hover:text-white/70"
                          }`}>
                          <span className="text-base leading-none">{opt.icon}</span>
                          <span>{opt.label}</span>
                        </button>
                      ))}
                    </div>
                    {aiDays > 1 && (
                      <div>
                        <p className="text-[11px] text-white/50 mb-1.5">כמה ימי אירובי? (מתוך {aiDays} ימים)</p>
                        <div className="flex gap-2">
                          {[1, 2].filter(n => n < aiDays).map(n => (
                            <button key={n} onClick={() => setAiCardioDays(n)}
                              className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all min-h-[40px] ${
                                aiCardioDays===n ? "bg-emerald-500/25 text-emerald-300 border-emerald-500/50" : "text-white/50 border-white/10"
                              }`}>
                              {n === 1 ? "יום אחד" : "2 ימים"}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    <button
                      disabled={aiCardioTypes.length === 0}
                      onClick={() => setAiStep(3)}
                      className="w-full py-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/20 text-emerald-400 text-xs font-bold disabled:opacity-30 hover:bg-emerald-500/25 transition-colors min-h-[44px]">
                      המשך ←
                    </button>
                  </div>
                )}
                <button onClick={() => setAiStep(1)} className="flex items-center gap-1 text-[11px] text-white/30 hover:text-white/60 transition-colors pt-1">
                  ← חזור
                </button>
              </div>
            )}

            {/* ── Step 3: Intensity ────────────────────────────────────── */}
            {aiStep === 3 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <p className="text-sm font-bold text-white">כמה דקות לאימון?</p>
                  <div className="flex gap-2">
                    {([30,45,60,90] as const).map(m => (
                      <button key={m} onClick={() => setAiSessionMins(m)}
                        className={`flex-1 py-3 rounded-2xl text-xs font-bold border transition-all min-h-[44px] ${
                          aiSessionMins===m ? "bg-emerald-500/25 text-emerald-300 border-emerald-500/50" : "text-white/60 border-white/10 hover:border-emerald-500/30"
                        }`}>
                        {m}′
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-white">עוצמת מאמץ</p>
                    <span className="text-xs text-white/50">{["","קלה","בינונית","בינונית+","גבוהה","מקסימלית"][aiIntensity]}</span>
                  </div>
                  <div className="flex gap-1.5">
                    {[1,2,3,4,5].map(n => (
                      <button key={n} onClick={() => setAiIntensity(n)}
                        className={`flex-1 h-11 rounded-2xl border transition-all ${
                          n<=aiIntensity ? "bg-emerald-500/30 border-emerald-500/50" : "bg-white/5 border-white/10"
                        }`}>
                        <span className={`text-lg ${n<=aiIntensity ? "opacity-100" : "opacity-20"}`}>🔥</span>
                      </button>
                    ))}
                  </div>
                </div>
                <button onClick={() => setAiStep(4)}
                  className="w-full py-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/20 text-emerald-400 text-xs font-bold hover:bg-emerald-500/25 transition-colors min-h-[44px]">
                  המשך ←
                </button>
                <button onClick={() => setAiStep(2)} className="flex items-center gap-1 text-[11px] text-white/30 hover:text-white/60 transition-colors">
                  ← חזור
                </button>
              </div>
            )}

            {/* ── Step 4: Limitations ──────────────────────────────────── */}
            {aiStep === 4 && (
              <div className="space-y-3">
                <p className="text-sm font-bold text-white">האם יש מגבלות גופניות או פציעות?</p>
                <textarea
                  value={aiConstraints}
                  onChange={e => setAiConstraints(e.target.value)}
                  placeholder="למשל: כתף רגישה, ברכיים, גב תחתון... (אפשר לכתוב אין)"
                  rows={3}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-white/25 outline-none focus:border-emerald-500/50 resize-none" />
                <button onClick={() => setAiStep(5)}
                  className="w-full py-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/20 text-emerald-400 text-xs font-bold hover:bg-emerald-500/25 transition-colors min-h-[44px]">
                  המשך לסיכום ←
                </button>
                <button onClick={() => setAiStep(3)} className="flex items-center gap-1 text-[11px] text-white/30 hover:text-white/60 transition-colors">
                  ← חזור
                </button>
              </div>
            )}

            {/* ── Step 5: Summary ──────────────────────────────────────── */}
            {aiStep === 5 && (
              <div className="space-y-3">
                <p className="text-sm font-bold text-white">סיכום הבחירות שלך</p>
                <div className="rounded-2xl bg-white/5 border border-white/8 p-3.5 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-white/40">📅 ימי אימון</span>
                    <span className="text-white font-semibold">{aiDays} פעמים בשבוע</span>
                  </div>
                  <div className="flex items-start justify-between text-xs gap-2">
                    <span className="text-white/40 shrink-0">⚙️ ציוד</span>
                    <div className="text-start space-y-0.5">
                      <span className="text-white font-semibold block text-end">{aiEquip}</span>
                      {aiEquip === "משולב" && Object.keys(aiDayEquipment).length > 0 && (
                        <div className="space-y-0.5">
                          {Array.from({ length: aiDays }, (_, i) => (
                            <div key={i} className="flex justify-between gap-4 text-[10px]">
                              <span className="text-white/30">יום {i+1}</span>
                              <span className="text-white/60">{DAY_EQUIPMENT_OPTIONS.find(o => o.value === aiDayEquipment[i])?.label ?? "לא הוגדר"}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-white/40">🏃 אירובי</span>
                    <span className="text-white font-semibold">
                      {aiCardio && aiCardioTypes.length > 0
                        ? `${aiCardioTypes.join(", ")} — ${aiCardioDays === 1 ? "יום אחד" : `${aiCardioDays} ימים`}`
                        : "ללא"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-white/40">⏱ משך אימון</span>
                    <span className="text-white font-semibold">{aiSessionMins} דקות</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-white/40">🔥 עוצמה</span>
                    <span className="text-white font-semibold">{"🔥".repeat(aiIntensity)} {["","קלה","בינונית","בינונית+","גבוהה","מקסימלית"][aiIntensity]}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-white/40">📝 מגבלות</span>
                    <span className="text-white font-semibold truncate max-w-[60%] text-end">{aiConstraints || "אין"}</span>
                  </div>
                </div>
                <button onClick={handleGeneratePlan} disabled={aiLoading}
                  className="w-full py-4 rounded-2xl bg-emerald-500 text-white text-sm font-black flex items-center justify-center gap-2 disabled:opacity-50 shadow-[0_0_20px_rgba(16,185,129,0.3)] active:scale-[0.98] transition-all min-h-[52px]">
                  {aiLoading ? (
                    <><div className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />מבנה התוכנית שלך...</>
                  ) : (
                    <>⚡ צור תוכנית 4 שבועות</>
                  )}
                </button>
                <button
                  onClick={() => { setAiStep(0); setAiCardio(null); setAiCardioTypes([]); setAiCardioDays(1); setAiDayEquipment({}); setAiConstraints(""); }}
                  className="w-full text-[11px] text-white/30 hover:text-white/60 transition-colors">
                  התחל מחדש
                </button>
              </div>
            )}
          </div>
          )}
          {aiPlan && (
            <div className="space-y-4">
              {/* Plan header */}
              <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/8 px-4 py-3 space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex gap-2">
                    <button onClick={async () => {
                      try {
                        await savePlan.mutateAsync({
                          name: aiPlan.summary?.slice(0,40) || "תוכנית AI",
                          goal: aiGoal,
                          level: aiLevel,
                          split_type: aiPlan.split_type,
                          weeks: aiPlan.weeks ?? [],
                          deload_week: aiPlan.deload_week,
                          tips: aiPlan.tips,
                        });
                        setSavedPlanBanner(true);
                        setTimeout(() => setSavedPlanBanner(false), 3000);
                      } catch { toast.error("שגיאה בשמירה"); }
                    }} className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-[11px] font-bold hover:bg-emerald-500/30 transition-all active:scale-95">
                      💾 שמור
                    </button>
                    <button onClick={() => {
                      const text = `תוכנית אימון:\n${aiPlan.summary}\n\nימי אימון: ${aiDays}/שבוע\nציוד: ${aiEquip}`;
                      if (navigator.share) navigator.share({ title: "תוכנית אימון", text });
                      else { navigator.clipboard.writeText(text); toast.success("הועתק ✓"); }
                    }} className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-white/50 text-[11px] font-bold hover:text-white/70 transition-all active:scale-95">
                      🔗 שתף
                    </button>
                  </div>
                  <div className="text-end">
                    <p className="text-xs font-black text-white">{aiPlan.split_type || "תוכנית מותאמת אישית"}</p>
                    <p className="text-[10px] text-white/40">{aiDays} ימי אימון · {aiSessionMins || 60} דק'</p>
                  </div>
                </div>
                <p className="text-[11px] text-white/60 text-end">{aiPlan.summary}</p>
                {savedPlanBanner && <p className="text-[11px] text-emerald-400 font-bold text-end">✅ התוכנית נשמרה!</p>}
              </div>

              {/* Week selector */}
              <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
                {(aiPlan.weeks ?? []).map((w: any) => (
                  <button key={w.week_number} onClick={() => setSelectedWeek(w.week_number)}
                    className={`flex-shrink-0 px-3 py-2 rounded-xl text-xs font-bold border transition-all ${selectedWeek===w.week_number ? "bg-emerald-500/25 text-emerald-300 border-emerald-500/50" : "text-white/40 border-white/10 hover:text-white/60"}`}>
                    שבוע {w.week_number}
                  </button>
                ))}
                {aiPlan.deload_week && (
                  <button onClick={() => setSelectedWeek(5)}
                    className={`flex-shrink-0 px-3 py-2 rounded-xl text-xs font-bold border transition-all ${selectedWeek===5 ? "bg-blue-500/25 text-blue-300 border-blue-500/50" : "text-white/40 border-white/10 hover:text-white/60"}`}>
                    🔄 Deload
                  </button>
                )}
              </div>

              {/* Current week's overload note + workouts */}
              {(() => {
                const currentWeek = selectedWeek === 5 ? aiPlan.deload_week : (aiPlan.weeks ?? []).find((w: any) => w.week_number === selectedWeek);
                if (!currentWeek) return null;
                return (
                  <div className="space-y-3">
                    {currentWeek.overload_note && (
                      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
                        <span className="text-sm">📈</span>
                        <p className="text-[11px] text-amber-300 font-semibold">{currentWeek.overload_note}</p>
                      </div>
                    )}

                    {/* Volume summary */}
                    {(() => {
                      const workoutSets = (currentWeek.workouts ?? []).map((w: any) => ({
                        name: w.name,
                        sets: (w.exercises ?? []).reduce((s: number, e: any) => s + (e.sets ?? 3), 0),
                      }));
                      return (
                        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                          {workoutSets.map((ws: any, i: number) => (
                            <div key={i} className="flex-shrink-0 px-2.5 py-1.5 rounded-xl bg-white/5 border border-white/10 text-center">
                              <p className="text-[9px] text-white/40 truncate max-w-[70px]">{ws.name}</p>
                              <p className="text-xs font-black text-white">{ws.sets} סטים</p>
                            </div>
                          ))}
                        </div>
                      );
                    })()}

                    {/* Workout days */}
                    {(currentWeek.workouts ?? []).map((workout: any, wIdx: number) => {
                      const isExpanded = expandedDay === wIdx;
                      const meta = CATEGORY_META[workout.category] ?? { emoji: "💪", color: "#10b981" };
                      return (
                        <div key={wIdx} className="rounded-2xl border border-white/10 bg-white/4 overflow-hidden">
                          {/* Day header */}
                          <button
                            onClick={() => setExpandedDay(isExpanded ? null : wIdx)}
                            className="w-full flex items-center justify-between px-4 py-3"
                          >
                            <div className="flex items-center gap-2">
                              <ChevronRight className={`h-4 w-4 text-white/40 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                              <span className="text-[11px] text-white/40">{workout.exercises?.length ?? 0} תרגילים</span>
                            </div>
                            <div className="flex items-center gap-2 text-end">
                              <div>
                                <p className="text-sm font-black text-white">{workout.name}</p>
                                <p className="text-[10px] text-white/40">{workout.day} · {workout.duration_minutes} דק'</p>
                              </div>
                              <span className="text-lg">{meta.emoji}</span>
                            </div>
                          </button>

                          {/* Exercises */}
                          {isExpanded && (
                            <div className="border-t border-white/8 divide-y divide-white/6">
                              {(workout.exercises ?? []).map((ex: any, eIdx: number) => {
                                const imgUrl = (EXERCISE_IMAGE_URLS as Record<string,string>)[ex.name];
                                const libEx = getExerciseAllMap().get(ex.name);
                                return (
                                  <div key={eIdx} className="flex items-center gap-3 px-4 py-3">
                                    {/* Image */}
                                    <div className="w-12 h-12 rounded-xl overflow-hidden bg-white/5 shrink-0 flex items-center justify-center border border-white/8">
                                      {imgUrl ? (
                                        <img src={imgUrl} alt={ex.name} className="w-full h-full object-cover" />
                                      ) : (
                                        <span className="text-xl">💪</span>
                                      )}
                                    </div>
                                    {/* Info */}
                                    <div className="flex-1 min-w-0 text-end">
                                      <p className="text-sm font-black text-white truncate">{ex.name}</p>
                                      <p className="text-[10px] text-white/50">{ex.sets} סטים × {ex.reps}</p>
                                      {ex.explanation && <p className="text-[10px] text-emerald-400/80 mt-0.5">{ex.explanation}</p>}
                                      {ex.notes && <p className="text-[10px] text-white/35 mt-0.5">{ex.notes}</p>}
                                    </div>
                                    {/* YouTube */}
                                    {libEx?.youtubeQuery && (
                                      <a href={`https://www.youtube.com/results?search_query=${encodeURIComponent(libEx.youtubeQuery)}`}
                                         target="_blank" rel="noopener noreferrer"
                                         onClick={e => e.stopPropagation()}
                                         className="shrink-0 h-8 w-8 rounded-xl bg-red-500/15 border border-red-500/25 flex items-center justify-center hover:bg-red-500/25 transition-all active:scale-90">
                                        <svg className="h-3.5 w-3.5 text-red-400" viewBox="0 0 24 24" fill="currentColor">
                                          <path d="M19.59 6.69a4.83 4.83 0 01-3.77-2.75 12.41 12.41 0 00-7.65 0 4.83 4.83 0 01-3.77 2.75 49.17 49.17 0 000 10.62 4.83 4.83 0 013.77 2.75 12.41 12.41 0 007.65 0 4.83 4.83 0 013.77-2.75 49.17 49.17 0 000-10.62zM10 15V9l5 3-5 3z"/>
                                        </svg>
                                      </a>
                                    )}
                                  </div>
                                );
                              })}
                              {/* Action buttons */}
                              <div className="px-4 py-3 flex gap-2">
                                <button
                                  onClick={() => {
                                    const filled = (workout.exercises ?? []).map((e: any) => ({
                                      name: e.name, sets: e.sets ?? 3, reps: Number(e.reps?.split("-")[0]) || 10,
                                      weight_kg: e.weight_kg ?? 0, setsData: toSetsData(e.sets ?? 3, Number(e.reps?.split("-")[0]) || 10, e.weight_kg ?? 0), group: 0,
                                    }));
                                    setExercises(filled);
                                    setWorkoutName(workout.name);
                                    setWorkoutCategory(toDbCategory(workout.category));
                                    setSubTab("custom");
                                    toast.success(`נטען: ${workout.name}`);
                                  }}
                                  className="flex-1 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/25 text-emerald-300 text-xs font-bold hover:bg-emerald-500/25 transition-all active:scale-95"
                                >
                                  🏗️ פתח בבונה
                                </button>
                                <button
                                  onClick={async () => {
                                    try {
                                      await addTemplate.mutateAsync({ name: workout.name, category: toDbCategory(workout.category), exercises: workout.exercises ?? [] });
                                      toast.success(`נשמר: ${workout.name}`);
                                    } catch { toast.error("שגיאה בשמירה"); }
                                  }}
                                  className="flex-1 py-2 rounded-xl bg-white/8 border border-white/10 text-white/60 text-xs font-bold hover:text-white/80 transition-all active:scale-95"
                                >
                                  📋 שמור כתבנית
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              {/* Tips */}
              {aiPlan.tips?.length > 0 && (
                <div className="rounded-2xl border border-white/10 bg-white/4 px-4 py-3 space-y-2">
                  <p className="text-[11px] font-black text-white/50 text-end">💡 טיפים</p>
                  {aiPlan.tips.map((tip: string, i: number) => (
                    <p key={i} className="text-[11px] text-white/60 text-end">• {tip}</p>
                  ))}
                </div>
              )}

              {/* Small AI Chat */}
              <div className="rounded-2xl border border-white/10 bg-white/4 px-4 py-3 space-y-2">
                <p className="text-[11px] font-bold text-white/40 text-end">💬 בקש שינוי</p>
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      if (!aiChatMsg.trim() || aiChatLoading) return;
                      setAiChatLoading(true);
                      try {
                        const updated = await generateWorkoutPlan({
                          goal: aiGoal, daysPerWeek: aiDays, equipment: aiEquip,
                          constraints: `${aiConstraints || ""}\n\nבקשת שינוי: ${aiChatMsg}`,
                          fitnessLevel: aiLevel, sessionMinutes: aiSessionMins,
                          intensity: aiIntensity as 1|2|3|4|5,
                        });
                        setAiPlan(updated);
                        setSelectedWeek(1);
                        setAiChatMsg("");
                        toast.success("התוכנית עודכנה ✓");
                      } catch { toast.error("שגיאה בעדכון"); }
                      finally { setAiChatLoading(false); }
                    }}
                    disabled={!aiChatMsg.trim() || aiChatLoading}
                    className="px-3 py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-bold disabled:opacity-40 hover:bg-emerald-500/30 transition-all whitespace-nowrap"
                  >
                    {aiChatLoading ? "..." : "עדכן"}
                  </button>
                  <input
                    value={aiChatMsg} onChange={e => setAiChatMsg(e.target.value)}
                    placeholder="למשל: החלף את הסקוואט בלגפרס..."
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-white/25 outline-none focus:border-emerald-500/40 text-end"
                    dir="rtl"
                    onKeyDown={e => { if (e.key === "Enter" && aiChatMsg.trim() && !aiChatLoading) { e.currentTarget.blur(); } }}
                  />
                </div>
              </div>

              {/* Plan history */}
              {(savedPlans ?? []).length > 0 && (
                <div className="space-y-2">
                  <button onClick={() => setShowPlanHistory(p => !p)}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-2xl border border-white/10 bg-white/4">
                    <ChevronRight className={`h-4 w-4 text-white/40 transition-transform ${showPlanHistory ? "rotate-90" : ""}`} />
                    <p className="text-[11px] font-bold text-white/50">📚 תוכניות שמורות ({savedPlans?.length})</p>
                  </button>
                  {showPlanHistory && (
                    <div className="space-y-2">
                      {(savedPlans ?? []).map((p: any) => (
                        <div key={p.id} className="flex items-center gap-3 px-4 py-3 rounded-2xl border border-white/10 bg-white/4">
                          <button onClick={() => deleteSavedPlan.mutate(p.id)}
                            className="h-7 w-7 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0 hover:bg-red-500/20 transition-all">
                            <X className="h-3 w-3 text-red-400" />
                          </button>
                          <div className="flex-1 min-w-0 text-end">
                            <p className="text-xs font-black text-white truncate">{p.name}</p>
                            <p className="text-[10px] text-white/35">{new Date(p.created_at).toLocaleDateString("he-IL")} · {p.split_type || p.goal}</p>
                          </div>
                          <button onClick={() => {
                            setAiPlan({ ...p, weeks: p.weeks ?? [], tips: p.tips ?? [] });
                            setSelectedWeek(1);
                            toast.info("תוכנית נטענה");
                          }} className="px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/25 text-emerald-300 text-[11px] font-bold hover:bg-emerald-500/25 transition-all shrink-0">
                            טען
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* New plan button */}
              <button
                onClick={() => { setAiPlan(null); setAiStep(0); setAiCardio(null); setAiCardioTypes([]); setAiCardioDays(1); setAiDayEquipment({}); setAiConstraints(""); }}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-white/10 bg-white/4 text-white/50 text-xs font-semibold hover:bg-white/8 hover:text-white/70 transition-all">
                ✨ צור תוכנית חדשה
              </button>
            </div>
          )}
        </div>
      )}

      {/* Auto-PR Celebration overlay */}
      {celebPRs.length > 0 && (
        <ConfettiCelebration prs={celebPRs} onDone={() => setCelebPRs([])} />
      )}
    </div>

    {/* ── Saving Overlay ──────────────────────────────────────────── */}
    {isSaving && (
      <div
        className="fixed inset-0 z-[200] flex flex-col items-center justify-center"
        style={{ background: "rgba(0,0,0,0.87)", backdropFilter: "blur(18px)" }}
      >
        <div className="flex flex-col items-center gap-6">
          <div className="relative">
            <div className="h-20 w-20 rounded-full border-4 border-emerald-500/20 border-t-emerald-500 animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Dumbbell className="h-8 w-8 text-emerald-400" />
            </div>
          </div>
          <div className="text-center space-y-1.5">
            <p className="text-xl font-black text-white">שומר אימון...</p>
            <p className="text-sm text-white/45">מעבד נתונים ומעדכן שיאים</p>
          </div>
        </div>
      </div>
    )}

    {/* ── Workout Summary Modal (Task 4) ──────────────────────────── */}
    {workoutSummary && (
      <div
        className="fixed inset-0 z-50 flex items-end justify-center pb-10 px-4"
        style={{ background: "rgba(0,0,0,0.88)", backdropFilter: "blur(18px)" }}
      >
        {/* Confetti particles */}
        {Array.from({ length: 26 }, (_, i) => {
          const C = ["#10b981","#f97316","#3b82f6","#eab308","#ec4899","#8b5cf6","#06b6d4"];
          return (
            <span
              key={i}
              className="absolute pointer-events-none"
              style={{
                left:            `${((i * 3.9 + 2) % 92) + 3}%`,
                top:             "-14px",
                width:           `${7 + (i % 5) * 1.5}px`,
                height:          `${7 + (i % 5) * 1.5}px`,
                borderRadius:    i % 3 === 0 ? "50%" : "3px",
                backgroundColor: C[i % C.length],
                animation:       `confettiFall ${2.0 + (i % 6) * 0.28}s ${(i % 9) * 0.12}s cubic-bezier(.15,0,.8,1) both`,
              }}
            />
          );
        })}

        <div
          className="w-full max-w-sm rounded-3xl border border-emerald-500/25 bg-[#0d0d0f] p-6 space-y-5 shadow-2xl relative"
          style={{ animation: "prBounce 0.42s cubic-bezier(.17,.67,.35,1.4) both" }}
        >
          {/* Header */}
          <div className="text-center space-y-1">
            <div
              className="text-5xl leading-none select-none"
              style={{ display: "inline-block", animation: "prSpin 0.4s 0.08s ease-out both" }}
            >
              🎉
            </div>
            <p className="text-2xl font-black text-white mt-1">אימון הושלם!</p>
            <p className="text-[11px] text-white/35 line-clamp-1">{workoutSummary.name}</p>
          </div>

          {/* Stats */}
          <div className="flex justify-center">
            <div className="rounded-2xl border border-blue-500/20 bg-blue-500/8 p-4 text-center space-y-1.5 w-40">
              <Clock className="h-5 w-5 text-blue-400 mx-auto" />
              <p className="text-3xl font-black text-white tabular-nums">{workoutSummary.mins}</p>
              <p className="text-[10px] text-white/40 font-semibold">זמן (דקות)</p>
            </div>
          </div>

          {/* PR badge (shown when PRs were broken in the same session) */}
          {celebPRs.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-2xl border border-amber-400/20 bg-amber-400/8">
              <span className="text-xl">🏆</span>
              <p className="text-xs font-black text-amber-300">
                {celebPRs.length === 1
                  ? `שיא אישי חדש: ${celebPRs[0].name}!`
                  : `${celebPRs.length} שיאים אישיים חדשים!`}
              </p>
            </div>
          )}

          {/* CTA */}
          <button
            onClick={() => {
              setWorkoutSummary(null);
              setCelebPRs([]);
              onWorkoutComplete?.();
            }}
            className="w-full py-4 rounded-2xl bg-emerald-500 text-white text-base font-black active:scale-[0.97] transition-all shadow-[0_0_24px_rgba(16,185,129,0.4)]"
          >
            חזור לבית 🏠
          </button>
        </div>
      </div>
    )}

    {/* ── Template Undo Delete Banner ──────────────────────────────── */}
    {templateUndoBanner && (
      <div
        className="fixed bottom-28 left-4 right-4 z-[60] flex items-center gap-3 px-4 py-3.5 rounded-2xl border border-amber-500/40 bg-[#1a1500] shadow-2xl"
        style={{ animation: "prBounce 0.3s cubic-bezier(.17,.67,.35,1.4) both" }}
      >
        <span className="text-xl shrink-0">🗑️</span>
        <p className="flex-1 text-[13px] text-amber-200 font-semibold truncate">
          "{templateUndoBanner.name}" נמחקה
        </p>
        <button
          onClick={() => {
            if (templateDeleteTimer.current) clearTimeout(templateDeleteTimer.current);
            templateDeleteTimer.current = null;
            setTemplatePendingDeleteIds((prev) => { const s = new Set(prev); s.delete(templateUndoBanner.id); return s; });
            setTemplateUndoBanner(null);
          }}
          className="shrink-0 px-4 py-2 rounded-xl bg-amber-500 text-black text-[12px] font-black active:scale-95 transition-all"
        >
          בטל
        </button>
      </div>
    )}
    {showDurationModal && (
      <div
        className="fixed inset-0 z-50 flex items-end justify-center pb-10 px-4"
        style={{ background: "rgba(0,0,0,0.72)", backdropFilter: "blur(14px)" }}
        onClick={(e) => { if (e.target === e.currentTarget) { setShowDurationModal(false); pendingWorkout.current = null; } }}
      >
        <div className="w-full max-w-sm rounded-3xl border border-white/12 bg-[#0d0d0f] p-6 space-y-5 shadow-2xl">
          {/* Header */}
          <div className="text-center space-y-1.5">
            <div className="text-4xl leading-none">⏱️</div>
            <p className="text-lg font-black text-white mt-2">כמה זמן נמשך האימון?</p>
            <p className="text-[11px] text-white/35">הכנס את משך האימון בדקות</p>
          </div>

          {/* Stepper + input */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setDurationMinutes((v) => String(Math.max(5, (parseInt(v) || 45) - 5)))}
              className="h-12 w-12 shrink-0 rounded-2xl bg-white/8 text-white text-2xl font-black flex items-center justify-center active:scale-90 transition-all"
            >
              −
            </button>
            <div className="relative flex-1">
              <input
                type="number"
                inputMode="numeric"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
                onFocus={(e) => e.target.select()}
                min={1}
                max={300}
                className="w-full text-center text-4xl font-black text-white bg-white/8 rounded-2xl py-3 outline-none border border-white/10 focus:border-emerald-500/50 transition-colors [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[11px] text-white/30 font-semibold pointer-events-none">דק׳</span>
            </div>
            <button
              onClick={() => setDurationMinutes((v) => String(Math.min(300, (parseInt(v) || 45) + 5)))}
              className="h-12 w-12 shrink-0 rounded-2xl bg-white/8 text-white text-2xl font-black flex items-center justify-center active:scale-90 transition-all"
            >
              +
            </button>
          </div>

          {/* Quick-pick chips */}
          <div className="grid grid-cols-3 gap-2">
            {[20, 45, 60, 75, 90, 120].map((d) => (
              <button
                key={d}
                onClick={() => setDurationMinutes(String(d))}
                className={`py-2 rounded-xl text-xs font-bold transition-all border ${
                  parseInt(durationMinutes) === d
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/50"
                    : "bg-white/5 text-white/35 border-white/10"
                }`}
              >
                {d}′
              </button>
            ))}
          </div>

          {/* Actions */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <button
              onClick={() => { setShowDurationModal(false); pendingWorkout.current = null; }}
              className="py-3.5 rounded-2xl border border-white/15 text-white/45 text-sm font-bold active:scale-[0.97] transition-all"
            >
              ביטול
            </button>
            <button
              onClick={() => {
                const mins = parseInt(durationMinutes);
                if (!mins || mins < 1) return toast.error("הכנס מספר דקות תקין");
                handleConfirmDuration(mins);
              }}
              className="py-3.5 rounded-2xl bg-emerald-500 text-white text-sm font-black active:scale-[0.97] transition-all shadow-[0_0_20px_rgba(16,185,129,0.35)]"
            >
              המשך →
            </button>
          </div>
        </div>
      </div>
    )}
  </>
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  TAB 3 — EXERCISE LIBRARY
// ═══════════════════════════════════════════════════════════════════════

function ExerciseModal({
  ex,
  groupKey,
  onClose,
  isFavorite,
  onToggleFavorite,
  onToggleHidden,
}: {
  ex: LibraryExercise;
  groupKey?: string;
  onClose: () => void;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onToggleHidden: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={onClose}>
      <div
        className="w-full max-w-lg mx-auto rounded-t-3xl border-t border-x border-white/10 bg-[#0d1117]/95 backdrop-blur-2xl p-5 space-y-4 pb-10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 rounded-full bg-white/20 mx-auto" />

        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            {groupKey && BODY_DOTS[groupKey] && (
              <div className="shrink-0 mt-0.5">
                <MuscleBodyIcon muscleKey={groupKey} size={28} />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-black text-white leading-tight">{ex.name}</h3>
              <p className="text-xs text-white/40 mt-0.5">{ex.muscles}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}
              className={`h-8 w-8 rounded-xl flex items-center justify-center transition-all ${
                isFavorite ? "bg-red-500/20 text-red-400" : "bg-white/8 text-white/40 hover:bg-white/15"
              }`}
            >
              <Heart className={`h-3.5 w-3.5 ${isFavorite ? "fill-red-400" : ""}`} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onToggleHidden(); onClose(); }}
              className="h-8 w-8 rounded-xl bg-white/8 flex items-center justify-center text-white/40 hover:bg-white/15 transition-all"
              title="הסתר תרגיל"
            >
              <EyeOff className="h-3.5 w-3.5" />
            </button>
            <button onClick={onClose} className="h-8 w-8 rounded-xl bg-white/8 flex items-center justify-center text-white/50 hover:bg-white/15">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2 text-center">
          {[["סטים", ex.defaultSets], ["חזרות", ex.defaultReps], ["ציוד", ex.equipment]].map(([label, val]) => (
            <div key={String(label)} className="rounded-xl border border-white/8 bg-white/5 p-2.5">
              <p className="text-[9px] text-white/35">{label}</p>
              <p className="text-sm font-black text-white mt-0.5 leading-tight">{val}</p>
            </div>
          ))}
        </div>

        {/* Tips */}
        <div className="space-y-2">
          <p className="text-[11px] font-bold text-white/50">💡 טיפים לביצוע נכון</p>
          {ex.tips.map((tip, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="h-5 w-5 rounded-full bg-emerald-500/15 text-emerald-400 text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
              <p className="text-xs text-white/70">{tip}</p>
            </div>
          ))}
        </div>

        {/* YouTube */}
        <a
          href={`https://www.youtube.com/results?search_query=${encodeURIComponent(ex.youtubeQuery ?? ex.name)}`}
          target="_blank" rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl border border-red-500/30 bg-red-500/10 text-red-400 font-bold text-sm hover:bg-red-500/15 transition-all"
        >
          <Youtube className="h-4 w-4" />
          <span>סרטון הדרכה ב-YouTube</span>
        </a>
      </div>
    </div>
  );
}

type LibraryWorkoutType = "weights" | "calisthenics" | "stretching";

function ExerciseLibraryTab({ onAddToWorkout, onAddToWorkoutAsSS, onAddToWorkoutSSPair, selectionMode }: { onAddToWorkout?: (exs: LibraryExercise[]) => void; onAddToWorkoutAsSS?: (ex: LibraryExercise) => void; onAddToWorkoutSSPair?: (first: LibraryExercise, second: LibraryExercise) => void; selectionMode?: boolean }) {
  const [workoutType,    setWorkoutType]    = useState<LibraryWorkoutType>("weights");
  const [selectedGroup,  setSelectedGroup]  = useState<MuscleGroup | null>(null);
  const [selectedEx,     setSelectedEx]     = useState<{ ex: LibraryExercise; groupKey: string; openTemplate?: boolean } | null>(null);
  const [checked,          setChecked]          = useState<Set<string>>(new Set());
  const [showHidden,       setShowHidden]       = useState(false);
  const [searchQuery,        setSearchQuery]        = useState("");
  // flat filter state — single-select
  const [activeSubFilter,   setActiveSubFilter]   = useState<string | null>(null);
  const [activeEquipFilter, setActiveEquipFilter]  = useState<EquipmentCategory | null>(null);
  const [templateSheetEx,   setTemplateSheetEx]   = useState<LibraryExercise | null>(null);
  const [workoutSheetEx,    setWorkoutSheetEx]    = useState<LibraryExercise | null>(null);
  const [ssFirstExercise,   setSsFirstExercise]   = useState<LibraryExercise | null>(null);
  const [showSettings,      setShowSettings]      = useState(false);
  const [showMachineIdentifier, setShowMachineIdentifier] = useState(false);

  const { data: settings } = useUserSettings();
  const updateSettings = useUpdateUserSettings();
  const favorites: string[] = (settings as any)?.favorite_exercises ?? [];
  const hidden: string[]    = (settings as any)?.hidden_exercises   ?? [];

  const toggleFavorite = (name: string) => {
    const next = favorites.includes(name)
      ? favorites.filter((n) => n !== name)
      : [...favorites, name];
    updateSettings.mutate({ favorite_exercises: next });
  };

  const toggleHidden = (name: string) => {
    const next = hidden.includes(name)
      ? hidden.filter((n) => n !== name)
      : [...hidden, name];
    updateSettings.mutate({ hidden_exercises: next });
  };

  const toggleCheck = (name: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });

  // Build a flat map of all exercises for lookup
  const allExMap = new Map<string, LibraryExercise>();
  [...MUSCLE_GROUPS, ...CALISTHENICS_MUSCLE_GROUPS, ...STRETCHING_MUSCLE_GROUPS]
    .forEach((g) => g.exercises.forEach((ex) => allExMap.set(ex.name, ex)));

  const handleAddToWorkout = () => {
    const exs = [...checked].map((n) => allExMap.get(n)!).filter(Boolean);
    onAddToWorkout?.(exs);
    setChecked(new Set());
  };

  const handleTypeChange = (t: LibraryWorkoutType) => {
    setWorkoutType(t);
    setSelectedGroup(null);
    setActiveSubFilter(null);
    setActiveEquipFilter(null);
    setChecked(new Set());
  };

  const handleGroupSelect = (g: MuscleGroup) => {
    setSelectedGroup(g);
    setActiveSubFilter(null);
    setActiveEquipFilter(null);
  };

  const handleBack = () => {
    setActiveSubFilter(null);
    setActiveEquipFilter(null);
    setSelectedGroup(null);
  };

  // Equipment categories present in the whole selected group
  const equipCategories: EquipmentCategory[] = useMemo(() =>
    selectedGroup
      ? [...new Set(selectedGroup.exercises.map((ex) => getEquipCat(ex.equipment)))]
      : []
  , [selectedGroup]);

  // Flat-filtered exercise list (sub-group chips + equipment chips)
  const filteredExercises = useMemo(() => {
    if (!selectedGroup) return [];
    let exs = selectedGroup.exercises.filter((ex) => showHidden || !hidden.includes(ex.name));

    if (activeSubFilter && selectedGroup.subGroups) {
      const sg = selectedGroup.subGroups.find((s) => s.key === activeSubFilter);
      if (sg) {
        const allowed = new Set(sg.exerciseNames);
        exs = exs.filter((ex) => allowed.has(ex.name));
      }
    }

    if (activeEquipFilter) {
      exs = exs.filter((ex) => getEquipCat(ex.equipment) === activeEquipFilter);
    }

    // Favorites always first
    return [...exs].sort((a, b) => {
      const aF = favorites.includes(a.name) ? 0 : 1;
      const bF = favorites.includes(b.name) ? 0 : 1;
      return aF - bF;
    });
  }, [selectedGroup, activeSubFilter, activeEquipFilter, hidden, showHidden, favorites]);

  const allExercises = useMemo(() =>
    [...MUSCLE_GROUPS, ...CALISTHENICS_MUSCLE_GROUPS, ...STRETCHING_MUSCLE_GROUPS]
      .flatMap((g) => g.exercises)
  , []);

  // Favorite exercises for the current type
  const favForType = favorites.filter((name) => {
    const ex = allExMap.get(name);
    if (!ex) return false;
    const inWeights    = MUSCLE_GROUPS.some((g) => g.exercises.some((e) => e.name === name));
    const inCali       = CALISTHENICS_MUSCLE_GROUPS.some((g) => g.exercises.some((e) => e.name === name));
    const inStretching = STRETCHING_MUSCLE_GROUPS.some((g) => g.exercises.some((e) => e.name === name));
    if (workoutType === "weights")      return inWeights;
    if (workoutType === "calisthenics") return inCali;
    if (workoutType === "stretching")   return inStretching;
    return false;
  });

  const groups =
    workoutType === "weights"      ? MUSCLE_GROUPS :
    workoutType === "calisthenics" ? CALISTHENICS_MUSCLE_GROUPS :
    STRETCHING_MUSCLE_GROUPS;

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return null;
    const seen = new Set<string>();
    const out: { ex: LibraryExercise; groupKey: string }[] = [];
    [...MUSCLE_GROUPS, ...CALISTHENICS_MUSCLE_GROUPS, ...STRETCHING_MUSCLE_GROUPS].forEach((g) => {
      g.exercises.forEach((ex) => {
        if (seen.has(ex.name)) return;
        if (!showHidden && hidden.includes(ex.name)) return;
        const displayName = (EXERCISE_HEBREW_NAMES[ex.name] ?? ex.name).toLowerCase();
        if (ex.name.toLowerCase().includes(q) || displayName.includes(q) || ex.muscles.toLowerCase().includes(q) || ex.equipment.toLowerCase().includes(q)) {
          seen.add(ex.name);
          out.push({ ex, groupKey: g.key });
        }
      });
    });
    return out;
  }, [searchQuery, hidden, showHidden]);

  const handleSelectionClick = (ex: LibraryExercise) => {
    if (ssFirstExercise) {
      // Picking the second exercise for a Super Set pair
      onAddToWorkoutSSPair?.(ssFirstExercise, ex);
      setSsFirstExercise(null);
      toast.success(`Super Set: ${ssFirstExercise.name} + ${ex.name} ✓`);
    } else {
      setWorkoutSheetEx(ex);
    }
  };

  return (
    <div className="px-4 pt-8 space-y-4 pb-28">
      {/* ── Gym machine identifier ────────────────────────────────── */}
      <button
        onClick={() => setShowMachineIdentifier(true)}
        className="flex items-center gap-2 px-4 py-2.5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-sm font-bold transition-all hover:bg-emerald-500/15 active:scale-95"
      >
        <Camera className="h-4 w-4" />
        זהה מכונה בצילום
      </button>
      <GymMachineIdentifier open={showMachineIdentifier} onClose={() => setShowMachineIdentifier(false)} />
      {/* ── selectionMode banner ──────────────────────────────────── */}
      {selectionMode && !ssFirstExercise && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30">
          <span className="text-base shrink-0">💪</span>
          <p className="text-xs font-bold text-emerald-300">מצב בחירה לאימון — לחץ על ✓ ירוק להוסיף תרגיל</p>
        </div>
      )}
      {selectionMode && ssFirstExercise && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-purple-500/15 border border-purple-500/40">
          <span className="text-base shrink-0">🔗</span>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-black text-purple-300">בחר תרגיל שני ל-Super Set</p>
            <p className="text-[10px] text-purple-300/60 truncate">התרגיל הראשון: {ssFirstExercise.name}</p>
          </div>
          <button onClick={() => setSsFirstExercise(null)} className="shrink-0 text-purple-400/50 hover:text-purple-300 text-[10px] font-bold">ביטול</button>
        </div>
      )}
      {/* ── Glassmorphism search bar ──────────────────────────────── */}
      <div className="relative">
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="חפש תרגיל, שריר או ציוד..."
          dir="rtl"
          className="w-full rounded-2xl border border-white/15 bg-white/8 backdrop-blur-xl px-4 py-3 text-sm text-white placeholder:text-white/30 outline-none focus:border-emerald-500/50 focus:bg-white/10 transition-all pe-10 appearance-none [&::-webkit-search-cancel-button]:hidden"
        />
        <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30 pointer-events-none" />
        {searchQuery && (
          <button onClick={() => setSearchQuery("")} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* ── Flat search results (bypasses all hierarchy) ─────────── */}
      {searchResults !== null && (
        <>
          {searchResults.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 animate-in fade-in duration-300">
              <div className="h-14 w-14 rounded-2xl bg-white/5 flex items-center justify-center text-2xl">🔍</div>
              <p className="text-sm font-bold text-white/50">לא מצאנו תרגילים</p>
              <p className="text-xs text-white/25">נסה לחפש שריר, ציוד או שם תרגיל</p>
            </div>
          ) : (
            <div className="space-y-2 animate-in fade-in duration-300">
              <p className="text-[11px] font-bold text-white/40">{searchResults.length} תוצאות</p>
              {searchResults.map(({ ex, groupKey }) => (
                <ExerciseCard
                  key={ex.name}
                  ex={ex}
                  groupKey={groupKey}
                  isChecked={false}
                  isFavorite={favorites.includes(ex.name)}
                  onCheck={() => selectionMode ? handleSelectionClick(ex) : setTemplateSheetEx(ex)}
                  onOpen={() => setSelectedEx({ ex, groupKey })}
                  onQuickAdd={() => selectionMode ? handleSelectionClick(ex) : setTemplateSheetEx(ex)}
                  onToggleFavorite={() => toggleFavorite(ex.name)}
                />
              ))}
            </div>
          )}
          {/* Modal still works in search mode */}
          {selectedEx && (
            <ExerciseModal
              ex={selectedEx.ex}
              groupKey={selectedEx.groupKey}
              onClose={() => setSelectedEx(null)}
              isFavorite={favorites.includes(selectedEx.ex.name)}
              onToggleFavorite={() => toggleFavorite(selectedEx.ex.name)}
              onToggleHidden={() => toggleHidden(selectedEx.ex.name)}
            />
          )}
        </>
      )}

      {searchResults !== null ? null : <>
      {/* ── Type tabs ─────────────────────────────────────────────── */}
      <div className="flex gap-1 p-1 rounded-2xl bg-white/5 border border-white/8">
        {([
          { key: "weights"      as const, label: "🏋️ חדר כושר"  },
          { key: "calisthenics" as const, label: "🤸 קלסטניקס"  },
          { key: "stretching"   as const, label: "🧘 מתיחות"     },
        ] as const).map(({ key, label }) => (
          <button key={key} onClick={() => handleTypeChange(key)}
            className={`flex-1 py-1.5 rounded-xl text-[10px] font-black transition-all ${
              workoutType === key ? "bg-white/15 text-white shadow-sm" : "text-white/35 hover:text-white/55"
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* ── Favorites row (when on root view) ─────────────────────── */}
      {!selectedGroup && favForType.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-bold text-white/45 flex items-center gap-1.5">
            <Heart className="h-3 w-3 text-red-400 fill-red-400" />מועדפים
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {favForType.map((name) => {
              const ex = allExMap.get(name)!;
              const isChecked = checked.has(name);
              return (
                <div key={name}
                  className={`flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl border transition-all cursor-pointer ${
                    isChecked
                      ? "border-emerald-500/60 bg-emerald-500/15"
                      : "border-white/10 bg-white/5"
                  }`}
                  onClick={() => setTemplateSheetEx(ex)}
                >
                  <div className={`h-4 w-4 rounded-md border flex items-center justify-center shrink-0 transition-all ${
                    isChecked ? "border-emerald-500 bg-emerald-500" : "border-white/25"
                  }`}>
                    {isChecked && <Check className="h-2.5 w-2.5 text-white" />}
                  </div>
                  <span className="text-xs font-semibold text-white whitespace-nowrap">{name}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); setSelectedEx({ ex, groupKey: "" }); }}
                    className="text-white/25 hover:text-white/60 transition-colors"
                  >
                    <BookOpen className="h-3 w-3" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Root: muscle group grid ─────────────────────────────────── */}
      {!selectedGroup && (
        <>
          <p className="text-sm font-black text-white">בחר קבוצת שרירים</p>
          <div className="grid grid-cols-2 gap-3 animate-in fade-in duration-300">
            {groups.map((g) => {
              const visibleCount = g.exercises.filter((ex) => !hidden.includes(ex.name)).length;
              return (
                <button key={g.key} onClick={() => handleGroupSelect(g)}
                  className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-4 text-end flex items-center gap-3 hover:border-white/20 hover:bg-white/8 active:scale-[0.97] transition-all">
                  <div className="h-11 w-11 rounded-2xl flex items-center justify-center shrink-0 relative" style={{ background: g.color + "22" }}>
                    <MuscleBodyIcon muscleKey={g.key} size={30} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-black text-white">{g.label}</p>
                    <p className="text-[10px] text-white/35">{visibleCount} תרגילים</p>
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* ── Inside group: flat filter + exercise list ───────────────── */}
      {selectedGroup && (
        <div className="space-y-3 animate-in fade-in duration-300">

          {/* Breadcrumb + back */}
          <div className="flex items-center gap-3">
            <button onClick={handleBack}
              className="h-8 w-8 rounded-xl bg-white/8 flex items-center justify-center text-white/60 hover:bg-white/15">
              <ChevronRight className="h-4 w-4" />
            </button>
            <span className="text-xl">{selectedGroup.emoji}</span>
            <p className="text-sm font-black text-white flex-1">{selectedGroup.label}</p>
            {hidden.length > 0 && (
              <button
                onClick={() => setShowHidden((v) => !v)}
                className={`h-7 px-2.5 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all ${
                  showHidden ? "bg-white/15 text-white" : "bg-white/5 text-white/30"
                }`}
              >
                <Eye className="h-3 w-3" />
              </button>
            )}
            <button
              onClick={() => setShowSettings(true)}
              className="h-7 w-7 rounded-lg bg-white/5 flex items-center justify-center text-white/30 hover:bg-white/12 hover:text-white/60 transition-all"
            >
              <Settings2 className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Sub-group chip row */}
          {selectedGroup.subGroups && selectedGroup.subGroups.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              <button
                onClick={() => setActiveSubFilter(null)}
                className={`shrink-0 px-3 py-1.5 rounded-xl text-[11px] font-black transition-all whitespace-nowrap border ${
                  activeSubFilter === null
                    ? "bg-white/20 text-white border-white/30"
                    : "bg-white/5 text-white/20 border-white/8"
                }`}
              >
                הכל
              </button>
              {selectedGroup.subGroups.map((sg) => (
                <button key={sg.key}
                  onClick={() => setActiveSubFilter((prev) => prev === sg.key ? null : sg.key)}
                  className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-black transition-all whitespace-nowrap border ${
                    activeSubFilter === sg.key
                      ? "bg-white/22 text-white border-white/35 scale-105"
                      : activeSubFilter !== null
                        ? "bg-white/4 text-white/15 border-white/6 opacity-40"
                        : "bg-white/6 text-white/45 border-white/10 hover:bg-white/10"
                  }`}
                >
                  <span>{sg.emoji}</span>{sg.label}
                </button>
              ))}
            </div>
          )}

          {/* Equipment chip row */}
          {equipCategories.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              <button
                onClick={() => setActiveEquipFilter(null)}
                className={`shrink-0 px-3 py-1.5 rounded-xl text-[11px] font-black transition-all whitespace-nowrap border ${
                  activeEquipFilter === null
                    ? "bg-emerald-500/30 text-emerald-200 border-emerald-500/50"
                    : "bg-white/5 text-white/20 border-white/8"
                }`}
              >
                הכל
              </button>
              {equipCategories.map((cat) => (
                <button key={cat}
                  onClick={() => setActiveEquipFilter((prev) => prev === cat ? null : cat)}
                  className={`shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-xl text-[11px] font-black transition-all whitespace-nowrap border ${
                    activeEquipFilter === cat
                      ? "bg-emerald-500/30 text-emerald-200 border-emerald-500/50 scale-105"
                      : activeEquipFilter !== null
                        ? "bg-white/4 text-white/15 border-white/6 opacity-40"
                        : "bg-white/6 text-white/40 border-white/10 hover:bg-white/10"
                  }`}
                >
                  {EQUIP_META[cat].emoji} {EQUIP_META[cat].label}
                </button>
              ))}
            </div>
          )}

          {/* Active filter count */}
          {(activeSubFilter || activeEquipFilter) && (
            <p className="text-[10px] text-white/35 text-end px-0.5">{filteredExercises.length} תרגילים</p>
          )}

          {/* Exercise list */}
          {filteredExercises.length === 0 ? (
            <div className="text-center py-8 text-white/30 text-xs">
              {(activeSubFilter || activeEquipFilter)
                ? "אין תרגילים עם הסינון הנוכחי"
                : <>כל התרגילים מוסתרים —{" "}<button onClick={() => setShowHidden(true)} className="underline">הצג מוסתרים</button></>
              }
            </div>
          ) : (
            <div
              key={`${activeSubFilter ?? "all"}-${activeEquipFilter ?? "all"}`}
              className="space-y-2 animate-in fade-in duration-200"
            >
              {filteredExercises.map((ex) => (
                <ExerciseCard
                  key={ex.name}
                  ex={ex}
                  groupKey={selectedGroup.key}
                  isChecked={false}
                  isFavorite={favorites.includes(ex.name)}
                  onCheck={() => selectionMode ? handleSelectionClick(ex) : setTemplateSheetEx(ex)}
                  onOpen={() => setSelectedEx({ ex, groupKey: selectedGroup.key })}
                  onQuickAdd={() => selectionMode ? handleSelectionClick(ex) : setTemplateSheetEx(ex)}
                  onToggleFavorite={() => toggleFavorite(ex.name)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Modal ─────────────────────────────────────────────────── */}
      {selectedEx && (
        <ExerciseModal
          ex={selectedEx.ex}
          groupKey={selectedEx.groupKey}
          onClose={() => setSelectedEx(null)}
          isFavorite={favorites.includes(selectedEx.ex.name)}
          onToggleFavorite={() => toggleFavorite(selectedEx.ex.name)}
          onToggleHidden={() => toggleHidden(selectedEx.ex.name)}
        />
      )}
      {/* ── Workout add bottom sheet (selectionMode) ────────────── */}
      {workoutSheetEx && (
        <WorkoutAddBottomSheet
          ex={workoutSheetEx}
          onConfirm={(ex) => { onAddToWorkout?.([ex]); toast.success(`${ex.name} נוסף לאימון ✓`); }}
          onConfirmSS={(ex) => { onAddToWorkoutAsSS?.(ex); toast.success(`${ex.name} נוסף כ-Super Set ✓`); }}
          onConfirmSSFromLibrary={(ex) => { setSsFirstExercise(ex); }}
          onClose={() => setWorkoutSheetEx(null)}
        />
      )}
      {/* ── Template bottom sheet ────────────────────────────────── */}
      {templateSheetEx && (
        <TemplateBottomSheet ex={templateSheetEx} onClose={() => setTemplateSheetEx(null)} />
      )}

      {/* ── Settings sheet ───────────────────────────────────────── */}
      {showSettings && (
        <LibrarySettingsSheet
          onClose={() => setShowSettings(false)}
          hidden={hidden}
          favorites={favorites}
          onUnhide={(name) => toggleHidden(name)}
          onUnfavorite={(name) => toggleFavorite(name)}
          exercises={allExercises}
        />
      )}
      </> /* end hierarchy wrapper */}

      {/* ── Floating add bar removed — template sheet handles per-exercise adds ── */}
    </div>
  );
}

// ── TemplateBottomSheet ───────────────────────────────────────────────────────
// ── WorkoutAddBottomSheet ─────────────────────────────────────────────────────
function WorkoutAddBottomSheet({
  ex,
  onConfirm,
  onConfirmSS,
  onConfirmSSFromLibrary,
  onClose,
}: {
  ex: LibraryExercise;
  onConfirm: (ex: LibraryExercise) => void;
  onConfirmSS: (ex: LibraryExercise) => void;
  onConfirmSSFromLibrary: (ex: LibraryExercise) => void;
  onClose: () => void;
}) {
  const [step, setStep] = useState<"main" | "ss_choice">("main");

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl bg-[#0f0f0f] border border-white/10 border-b-0 p-5 pb-10 animate-in slide-in-from-bottom duration-300">
        <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-5" />

        {step === "main" ? (
          <>
            {/* Exercise info */}
            <div className="flex items-center gap-4 mb-5">
              <div className="h-14 w-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-2xl shrink-0">
                💪
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-base font-black text-white truncate">{ex.name}</p>
                <p className="text-[11px] text-white/45 mt-0.5">{ex.muscles}</p>
                <p className="text-[10px] text-white/30 mt-0.5">{ex.equipment}</p>
              </div>
            </div>
            {/* Default sets/reps */}
            <div className="flex gap-2 mb-5">
              <div className="flex-1 rounded-2xl border border-white/8 bg-white/4 px-3 py-2.5 text-center">
                <p className="text-lg font-black text-white">{ex.defaultSets}</p>
                <p className="text-[10px] text-white/35">סטים</p>
              </div>
              <div className="flex-1 rounded-2xl border border-white/8 bg-white/4 px-3 py-2.5 text-center">
                <p className="text-lg font-black text-white">{ex.defaultReps}</p>
                <p className="text-[10px] text-white/35">חזרות</p>
              </div>
            </div>
            {/* Action buttons */}
            <div className="space-y-2.5">
              <button
                onClick={() => { onConfirm(ex); onClose(); }}
                className="w-full py-4 rounded-2xl bg-emerald-500 text-white text-base font-black active:scale-[0.97] transition-all shadow-[0_0_24px_rgba(16,185,129,0.35)]"
              >
                הוסף לאימון ✓
              </button>
              <button
                onClick={() => setStep("ss_choice")}
                className="w-full py-3.5 rounded-2xl border border-purple-500/40 bg-purple-500/10 text-purple-300 text-sm font-black active:scale-[0.97] transition-all hover:bg-purple-500/15"
              >
                <span className="font-black">SS</span> · הוסף כ-Super Set
              </button>
            </div>
          </>
        ) : (
          <>
            {/* SS choice step */}
            <div className="text-center mb-6">
              <p className="text-base font-black text-white">Super Set עם "{ex.name}"</p>
              <p className="text-[11px] text-white/40 mt-1">איך תרצה להוסיף את התרגיל השני?</p>
            </div>
            <div className="space-y-2.5">
              <button
                onClick={() => { onConfirmSSFromLibrary(ex); onClose(); }}
                className="w-full py-4 rounded-2xl bg-purple-500 text-white text-sm font-black active:scale-[0.97] transition-all shadow-[0_0_20px_rgba(139,92,246,0.35)] flex items-center justify-center gap-2"
              >
                <BookOpen className="h-4 w-4" />
                בחר תרגיל שני מספריית התרגילים
              </button>
              <button
                onClick={() => { onConfirmSS(ex); onClose(); }}
                className="w-full py-3.5 rounded-2xl border border-white/15 text-white/60 text-sm font-bold active:scale-[0.97] transition-all hover:bg-white/5"
              >
                הוסף ידנית בבנאי
              </button>
            </div>
            <button
              onClick={() => setStep("main")}
              className="w-full mt-3 py-2 text-[11px] text-white/30 hover:text-white/50 transition-colors"
            >
              ← חזור
            </button>
          </>
        )}
      </div>
    </>
  );
}

function TemplateBottomSheet({ ex, onClose }: { ex: LibraryExercise; onClose: () => void }) {
  const { data: templates } = useWorkoutTemplates();
  const updateTemplate = useUpdateWorkoutTemplate();
  const addTemplate = useAddWorkoutTemplate();
  const userTemplates = ((templates ?? []) as any[]).filter((t: any) => !t.is_system);

  const parseSets = (s: string | number) => { const n = parseInt(String(s)); return isNaN(n) ? 3 : n; };
  const parseReps = (r: string | number) => { const n = parseInt(String(r)); return isNaN(n) ? 10 : n; };

  const handleAdd = (t: any) => {
    const already = (t.exercises ?? []).some((e: any) => e.name === ex.name);
    if (already) { toast.info(`${ex.name} כבר קיים בתבנית`); onClose(); return; }
    updateTemplate.mutate({ id: t.id, exercises: [...(t.exercises ?? []), { name: ex.name, sets: parseSets(ex.defaultSets), reps: parseReps(ex.defaultReps), weight_kg: 0 }] });
    toast.success(`נוסף ל-${t.name} ✓`);
    onClose();
  };

  const handleCreate = () => {
    addTemplate.mutate({ name: ex.name, category: "weights", exercises: [{ name: ex.name, sets: parseSets(ex.defaultSets), reps: parseReps(ex.defaultReps), weight_kg: 0 }] });
    toast.success("תבנית חדשה נוצרה ✓");
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl bg-[#0f0f0f] border border-white/10 border-b-0 p-5 pb-10 animate-in slide-in-from-bottom duration-300 max-h-[70vh] flex flex-col">
        <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-5 shrink-0" />
        <p className="text-sm font-black text-white text-center mb-1 shrink-0">הוסף לתבנית</p>
        <p className="text-[11px] text-white/40 text-center mb-4 shrink-0 truncate px-4">{ex.name}</p>
        <div className="space-y-2 overflow-y-auto flex-1 mb-3">
          {userTemplates.length === 0 && (
            <p className="text-xs text-white/25 text-center py-6">אין תבניות עדיין</p>
          )}
          {userTemplates.map((t: any) => (
            <button key={t.id} onClick={() => handleAdd(t)}
              className="w-full text-end p-3.5 rounded-2xl bg-white/6 border border-white/8 hover:bg-white/10 active:scale-[0.98] transition-all flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-bold text-white truncate">{t.name}</p>
                <p className="text-[10px] text-white/35 mt-0.5">{(t.exercises ?? []).length} תרגילים</p>
              </div>
              <Plus className="h-4 w-4 text-white/40 shrink-0" />
            </button>
          ))}
        </div>
        <button onClick={handleCreate}
          className="w-full p-3.5 rounded-2xl border border-dashed border-white/15 text-xs text-white/40 hover:border-white/30 hover:text-white/60 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shrink-0">
          <Plus className="h-3.5 w-3.5" /> צור תבנית חדשה
        </button>
      </div>
    </>
  );
}

// ── LibrarySettingsSheet ──────────────────────────────────────────────────────
function LibrarySettingsSheet({
  onClose,
  hidden,
  favorites,
  onUnhide,
  onUnfavorite,
  exercises,
}: {
  onClose: () => void;
  hidden: string[];
  favorites: string[];
  onUnhide: (name: string) => void;
  onUnfavorite: (name: string) => void;
  exercises: LibraryExercise[];
}) {
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl bg-[#0f0f0f] border border-white/10 border-b-0 p-5 pb-10 max-h-[80vh] overflow-y-auto animate-in slide-in-from-bottom duration-300">
        <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-5" />
        <p className="text-sm font-black text-white text-center mb-5">הגדרות ספרייה</p>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2 mb-5">
          {[
            { label: "תרגילים", value: exercises.length, color: "text-white" },
            { label: "מועדפים", value: favorites.length, color: "text-red-400" },
            { label: "מוסתרים", value: hidden.length, color: "text-white/40" },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-2xl bg-white/5 border border-white/8 p-3 text-center">
              <p className={`text-xl font-black ${color}`}>{value}</p>
              <p className="text-[10px] text-white/35 mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Hidden exercises */}
        {hidden.length > 0 && (
          <section className="mb-5">
            <p className="text-xs font-black text-white/50 mb-2 px-0.5">מוסתרים ({hidden.length})</p>
            <div className="space-y-1.5">
              {hidden.map((name) => (
                <div key={name} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/8">
                  <span className="text-xs text-white/70 truncate flex-1 me-3">{name}</span>
                  <button onClick={() => onUnhide(name)} className="text-[11px] font-bold text-emerald-400 hover:text-emerald-300 shrink-0">חשוף ✓</button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Favorites */}
        {favorites.length > 0 && (
          <section className="mb-5">
            <p className="text-xs font-black text-white/50 mb-2 px-0.5">מועדפים ({favorites.length})</p>
            <div className="space-y-1.5">
              {favorites.map((name) => (
                <div key={name} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/8">
                  <span className="text-xs text-white/70 truncate flex-1 me-3">{name}</span>
                  <button onClick={() => onUnfavorite(name)} className="text-[11px] font-bold text-red-400 hover:text-red-300 shrink-0">הסר ✕</button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Custom exercise placeholder */}
        <button className="w-full p-3.5 rounded-2xl border border-dashed border-white/12 text-xs text-white/30 flex items-center justify-center gap-2 cursor-not-allowed">
          <Plus className="h-3.5 w-3.5" /> הוסף תרגיל מותאם אישית (בקרוב)
        </button>
      </div>
    </>
  );
}

// ── ExerciseCard sub-component (rich card with quick-add) ────────────────────
function ExerciseCard({
  ex,
  groupKey,
  isChecked,
  isFavorite,
  onCheck,
  onOpen,
  onQuickAdd,
  onToggleFavorite,
}: {
  ex: LibraryExercise;
  groupKey: string;
  isChecked: boolean;
  isFavorite: boolean;
  onCheck: () => void;
  onOpen: () => void;
  onQuickAdd: () => void;
  onToggleFavorite: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const imgUrl = EXERCISE_IMAGE_URLS[ex.name];

  return (
    <div
      className={`rounded-2xl border overflow-hidden transition-all cursor-pointer ${
        isChecked ? "border-emerald-500/50 bg-emerald-500/10" : "border-white/8 bg-white/4 hover:border-white/18 hover:bg-white/6"
      }`}
      onClick={onCheck}
    >
      <div className="flex items-stretch">
        {/* Image panel — square, right side (RTL), shows full drawing */}
        <div
          className="shrink-0 aspect-square w-24 border-l border-white/8 overflow-hidden relative"
          onMouseEnter={() => imgUrl && setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          {imgUrl ? (
            <img
              src={imgUrl}
              alt={ex.name}
              className="w-full h-full object-contain bg-white"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full bg-white/5 flex flex-col items-center justify-center gap-0.5">
              <span className="text-2xl leading-none">{MUSCLE_GROUPS.find(g => g.key === groupKey)?.emoji ?? "💪"}</span>
              <span className="text-[7px] text-white/30 text-center px-1 leading-tight line-clamp-2">
                {MUSCLE_GROUPS.find(g => g.key === groupKey)?.label ?? groupKey}
              </span>
            </div>
          )}
          {/* Enlarged popup on hover */}
          {hovered && imgUrl && (
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 pointer-events-none">
              <img
                src={imgUrl}
                alt={ex.name}
                className="w-48 h-48 object-contain rounded-xl border border-white/20 bg-white shadow-2xl p-2"
              />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="p-3 pb-2">
            {/* Name + checkbox row */}
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-black text-white leading-tight truncate">{EXERCISE_HEBREW_NAMES[ex.name] ?? ex.name}</p>
                <p className="text-[10px] text-white/45 mt-0.5 leading-tight truncate">{ex.muscles}</p>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); onCheck(); }}
                className={`shrink-0 h-5 w-5 rounded-md border-2 flex items-center justify-center transition-all ${
                  isChecked ? "bg-emerald-500 border-emerald-500" : "border-white/25"
                }`}
              >
                {isChecked && <Check className="h-3 w-3 text-white" />}
              </button>
            </div>

            {/* Badges + action buttons */}
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              <span className="text-[9px] px-2 py-0.5 rounded-lg bg-white/8 text-white/40 border border-white/8">{ex.equipment}</span>
              <span className="text-[9px] px-2 py-0.5 rounded-lg bg-emerald-500/12 text-emerald-400 border border-emerald-500/20">{ex.defaultSets}×{ex.defaultReps}</span>
              <div className="flex-1" />
              {/* Heart — always visible */}
              <button
                onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}
                className="h-6 w-6 rounded-lg flex items-center justify-center transition-all active:scale-90"
              >
                <Heart className={`h-3.5 w-3.5 transition-all ${isFavorite ? "text-red-400 fill-red-400" : "text-white/25"}`} />
              </button>
            </div>
          </div>

          {/* YouTube red bar */}
          <a
            href={`https://www.youtube.com/results?search_query=${encodeURIComponent(ex.youtubeQuery ?? ex.name)}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center justify-center gap-1.5 py-1.5 bg-red-600/15 border-t border-red-500/15 hover:bg-red-600/28 transition-all group"
          >
            <Youtube className="h-3 w-3 text-red-400/70 group-hover:text-red-400 transition-all" />
            <span className="text-[10px] font-bold text-red-400/70 group-hover:text-red-400 transition-all">צפה בהדגמה ביוטיוב</span>
          </a>
        </div>
      </div>
    </div>
  );
}

// ── ExerciseRow sub-component ────────────────────────────────────────────────
function ExerciseRow({
  ex,
  groupKey,
  isChecked,
  isFavorite,
  onCheck,
  onOpen,
}: {
  ex: LibraryExercise;
  groupKey: string;
  isChecked: boolean;
  isFavorite: boolean;
  onCheck: () => void;
  onOpen: () => void;
}) {
  return (
    <div
      className={`w-full rounded-2xl border backdrop-blur-xl p-3.5 flex items-center gap-3 transition-all cursor-pointer ${
        isChecked
          ? "border-emerald-500/50 bg-emerald-500/10"
          : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/8"
      }`}
      onClick={onCheck}
    >
      {/* Checkbox */}
      <div className={`h-5 w-5 rounded-md border flex items-center justify-center shrink-0 transition-all ${
        isChecked ? "border-emerald-500 bg-emerald-500" : "border-white/25"
      }`}>
        {isChecked && <Check className="h-3 w-3 text-white" />}
      </div>

      {/* Body icon */}
      {BODY_DOTS[groupKey] && (
        <div className="shrink-0">
          <MuscleBodyIcon muscleKey={groupKey} size={22} />
        </div>
      )}

      {/* Text */}
      <div className="flex-1 min-w-0 text-end">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-black text-white leading-tight flex-1 truncate">{ex.name}</p>
          {isFavorite && <Heart className="h-3 w-3 text-red-400 fill-red-400 shrink-0" />}
        </div>
        <p className="text-[10px] text-white/35 mt-0.5 truncate">{ex.muscles}</p>
        <div className="flex gap-1.5 mt-1.5 flex-wrap">
          <span className="text-[9px] px-1.5 py-0.5 rounded-full border border-white/10 bg-white/5 text-white/40">{ex.equipment}</span>
          <span className="text-[9px] px-1.5 py-0.5 rounded-full border border-emerald-500/20 bg-emerald-500/8 text-emerald-400">{ex.defaultSets}×{ex.defaultReps}</span>
        </div>
      </div>

      {/* Open modal */}
      <button
        onClick={(e) => { e.stopPropagation(); onOpen(); }}
        className="h-8 w-8 rounded-xl bg-white/5 flex items-center justify-center text-white/30 hover:bg-white/15 hover:text-white/70 shrink-0 transition-all"
      >
        <BookOpen className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  TAB 4 — PROGRESS & BODY
// ═══════════════════════════════════════════════════════════════════════

function useWeightReminder(latestEntryDate?: string) {
  const [reminderDays, setReminderDays] = useState(() => {
    const saved = localStorage.getItem("weight_reminder_days");
    return saved ? parseInt(saved) : 7;
  });
  const [dismissed, setDismissed] = useState(() => {
    const at = localStorage.getItem("weight_reminder_dismissed_at");
    if (!at) return false;
    const days = parseInt(localStorage.getItem("weight_reminder_days") ?? "7");
    return Date.now() - parseInt(at) < days * 86400000;
  });

  const updateDays = (d: number) => {
    const clamped = Math.min(30, Math.max(1, d));
    setReminderDays(clamped);
    localStorage.setItem("weight_reminder_days", String(clamped));
  };

  const dismiss = () => {
    localStorage.setItem("weight_reminder_dismissed_at", String(Date.now()));
    setDismissed(true);
  };

  const shouldShow = (() => {
    if (dismissed) return false;
    if (!latestEntryDate) return false;
    const daysSince = (Date.now() - new Date(latestEntryDate).getTime()) / 86400000;
    return daysSince >= reminderDays;
  })();

  return { shouldShow, reminderDays, updateDays, dismiss };
}

function WeightChart() {
  const { data: entries } = useWeightEntries(30);
  const addWeight    = useAddWeight();
  const deleteWeight = useDeleteWeight();
  const updateWeight = useUpdateWeight();
  const [newWeight, setNewWeight]   = useState(75);
  const [showAdd, setShowAdd]       = useState(false);
  const [showList, setShowList]     = useState(false);
  const [editingId, setEditingId]   = useState<string | null>(null);
  const [editValue, setEditValue]   = useState("");

  const latest = (entries ?? [])[0] as any;
  const { shouldShow, reminderDays, updateDays, dismiss } = useWeightReminder(latest?.date);

  const chartData = [...(entries ?? [])].reverse().slice(-14).map((e: any) => ({
    date: new Date(e.date).toLocaleDateString("he-IL", { day: "numeric", month: "numeric" }),
    kg: e.weight_kg,
  }));

  const prev  = (entries ?? [])[1] as any;
  const delta = latest && prev ? (latest.weight_kg - prev.weight_kg).toFixed(1) : null;

  const handleAdd = async () => {
    try {
      await addWeight.mutateAsync({ weight_kg: newWeight });
      toast.success(`⚖️ ${newWeight}kg נרשם!`);
      setShowAdd(false);
    } catch { toast.error("שגיאה בשמירה"); }
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    const val = parseFloat(editValue);
    if (!val || val <= 0) { toast.error("הזן משקל תקין"); return; }
    try {
      await updateWeight.mutateAsync({ id: editingId, weight_kg: val });
      toast.success("משקל עודכן");
      setEditingId(null);
    } catch { toast.error("שגיאה בעדכון"); }
  };

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Scale className="h-4 w-4 text-blue-400" />
          <p className="text-sm font-black text-white">מעקב משקל</p>
        </div>
        <div className="flex items-center gap-2">
          {(entries ?? []).length > 0 && (
            <button onClick={() => setShowList((v) => !v)}
              className="text-[10px] text-white/40 hover:text-white/70 font-bold transition-colors">
              {showList ? "הסתר רשימה" : "ערוך / מחק"}
            </button>
          )}
          <button onClick={() => setShowAdd((v) => !v)}
            className="h-7 w-7 rounded-xl bg-blue-500/15 border border-blue-500/20 flex items-center justify-center text-blue-400 hover:bg-blue-500/25">
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Weight reminder banner */}
      {shouldShow && (
        <div className="flex items-center justify-between gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5">
          <p className="text-xs font-bold text-amber-300">📸 הגיע הזמן! צלם תמונת התקדמות ועדכן את המשקל שלך</p>
          <button onClick={dismiss} className="shrink-0 text-amber-400/60 hover:text-amber-300 text-[11px] font-bold transition-colors">× סגור</button>
        </div>
      )}

      {/* Reminder settings */}
      <div className="flex items-center justify-between text-[11px] text-white/35">
        <span>📅 תזכורת כל</span>
        <div className="flex items-center gap-1.5">
          <button onClick={() => updateDays(reminderDays - 1)} className="h-5 w-5 rounded-md bg-white/8 flex items-center justify-center hover:bg-white/15 text-white/50 font-bold">−</button>
          <span className="text-white/60 font-bold w-4 text-center">{reminderDays}</span>
          <button onClick={() => updateDays(reminderDays + 1)} className="h-5 w-5 rounded-md bg-white/8 flex items-center justify-center hover:bg-white/15 text-white/50 font-bold">+</button>
          <span>ימים</span>
        </div>
      </div>

      {latest && (
        <div className="flex items-end gap-3">
          <p className="text-4xl font-black text-white">{latest.weight_kg}<span className="text-lg text-white/40 ms-1">kg</span></p>
          {delta !== null && (
            <span className={`text-sm font-bold mb-1 ${Number(delta) < 0 ? "text-emerald-400" : Number(delta) > 0 ? "text-red-400" : "text-white/40"}`}>
              {Number(delta) > 0 ? "+" : ""}{delta}kg
            </span>
          )}
        </div>
      )}

      {showAdd && (
        <div className="rounded-2xl border border-blue-500/20 bg-blue-500/8 p-3 flex items-center gap-3">
          <Stepper value={newWeight} onChange={setNewWeight} min={30} max={250} step={0.5} suffix="kg" />
          <button onClick={handleAdd} disabled={addWeight.isPending}
            className="flex-1 py-2 rounded-xl bg-blue-500 text-white font-bold text-sm hover:bg-blue-400 active:scale-95 transition-all">
            {addWeight.isPending ? "שומר..." : "שמור"}
          </button>
        </div>
      )}

      {showList && (
        <div className="space-y-1.5 max-h-48 overflow-y-auto">
          {(entries ?? []).map((e: any) => (
            <div key={e.id} className="flex items-center justify-between px-3 py-2 rounded-xl border border-white/8 bg-white/5">
              {editingId === e.id ? (
                <>
                  <input
                    type="number" step="0.1" value={editValue}
                    onChange={(ev) => setEditValue(ev.target.value)}
                    className="w-24 rounded-lg bg-white/10 border border-blue-500/40 px-2 py-1 text-sm text-white focus:outline-none"
                    dir="ltr" autoFocus
                  />
                  <div className="flex items-center gap-1">
                    <button onClick={handleSaveEdit} disabled={updateWeight.isPending}
                      className="h-7 w-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center hover:bg-emerald-500/30 disabled:opacity-50">
                      <Check className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => setEditingId(null)}
                      className="h-7 w-7 rounded-lg bg-white/8 text-white/40 flex items-center justify-center hover:bg-white/15">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-black text-white" dir="ltr">{e.weight_kg} kg</span>
                    <span className="text-[10px] text-white/35">{new Date(e.date).toLocaleDateString("he-IL")}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => { setEditingId(e.id); setEditValue(String(e.weight_kg)); }}
                      className="h-7 w-7 rounded-lg bg-white/5 text-white/30 flex items-center justify-center hover:bg-white/15 hover:text-white/70">
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button onClick={() => deleteWeight.mutate(e.id, { onSuccess: () => toast.success("נמחק") })}
                      className="h-7 w-7 rounded-lg bg-white/5 text-red-400/50 flex items-center justify-center hover:bg-red-500/15 hover:text-red-400">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {chartData.length > 1 ? (
        <ResponsiveContainer width="100%" height={140}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="date" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 9 }} axisLine={false} tickLine={false} />
            <YAxis domain={["auto", "auto"]} tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 9 }} axisLine={false} tickLine={false} width={30} />
            <Tooltip contentStyle={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, color: "#fff", fontSize: 11 }} />
            <Line type="monotone" dataKey="kg" stroke="#3b82f6" strokeWidth={2} dot={{ fill: "#3b82f6", r: 3 }} activeDot={{ r: 5 }} />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-[140px] flex items-center justify-center">
          <p className="text-xs text-white/25">הוסף לפחות 2 מדידות לגרף</p>
        </div>
      )}
    </div>
  );
}

// ─── PR mini history chart ────────────────────────────────────────────────────
function PRHistoryMiniChart({ records, unit }: { records: any[]; unit: string }) {
  if (records.length < 2) {
    return (
      <p className="text-[10px] text-white/25 text-center py-3">
        הוסף עוד שיאים כדי לראות את ההתקדמות
      </p>
    );
  }
  const data = [...records]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((r) => ({
      label: new Date(r.date).toLocaleDateString("he-IL", { day: "numeric", month: "numeric" }),
      value: Number(r.value),
    }));
  return (
    <div className="h-20 mt-1">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <Line
            type="monotone"
            dataKey="value"
            stroke="#f59e0b"
            strokeWidth={2}
            dot={{ fill: "#f59e0b", r: 2.5 }}
            activeDot={{ r: 4 }}
          />
          <XAxis
            dataKey="label"
            tick={{ fill: "rgba(255,255,255,0.28)", fontSize: 9 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis hide domain={["auto", "auto"]} />
          <Tooltip
            contentStyle={{
              background: "rgba(10,10,18,0.92)",
              border: "1px solid rgba(255,255,255,0.10)",
              borderRadius: 10,
              fontSize: 11,
              color: "#fff",
            }}
            formatter={(v: number) => [`${v} ${unit}`, ""]}
            labelStyle={{ color: "rgba(255,255,255,0.4)", fontSize: 10 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── PR Section (enhanced) ────────────────────────────────────────────────────
function PRSection() {
  const { data: prs }       = usePersonalRecords();
  const { data: templates } = useWorkoutTemplates();
  const addPR    = useAddPersonalRecord();
  const updatePR = useUpdatePersonalRecord();
  const deletePR = useDeletePersonalRecord();

  const [showForm,       setShowForm]       = useState(false);
  const [prName,         setPrName]         = useState("");
  const [prValueRaw,     setPrValueRaw]     = useState("100");
  const [prUnit,         setPrUnit]         = useState("kg");
  const [editingId,      setEditingId]      = useState<string | null>(null);
  const [editValue,      setEditValue]      = useState("");
  const [expandedEx,     setExpandedEx]     = useState<string | null>(null);
  // toggle: grouped-by-template (true) vs flat list (false)
  const [groupByTemplate, setGroupByTemplate] = useState(true);
  // progressive disclosure — show first 3 items by default
  const [showAllPRs,     setShowAllPRs]     = useState(false);
  // per-template-group expand/collapse
  const [expandedTg,     setExpandedTg]     = useState<Set<string>>(new Set());
  const VISIBLE_PR_COUNT = 3;

  // ── Global PR source of truth: keyed by exercise_name ────────────────────
  // PRs are NEVER isolated per-template — a PR set on any workout reflects here.
  const prGroups = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const pr of (prs ?? [])) {
      if (!map[pr.exercise_name]) map[pr.exercise_name] = [];
      map[pr.exercise_name].push(pr);
    }
    return Object.entries(map)
      .map(([name, recs]) => {
        const sorted = [...recs].sort((a, b) => a.date.localeCompare(b.date));
        const best   = recs.reduce((m, r) => Number(r.value) > Number(m.value) ? r : m, recs[0]);
        return { name, records: sorted, best };
      })
      .sort((a, b) => new Date(b.best.date).getTime() - new Date(a.best.date).getTime());
  }, [prs]);

  // ── Template-grouped view: each template lists its exercises' global PRs ──
  const templateGroups = useMemo(() => {
    const prMap = new Map(prGroups.map((g) => [g.name, g]));
    // All exercise names that appear in at least one template
    const allTemplateExNames = new Set<string>(
      (templates ?? []).flatMap((t: any) =>
        ((t.exercises ?? []) as any[]).map((e: any) => e.name as string)
      )
    );
    const groups = (templates ?? [])
      .map((t: any) => {
        const exNames: string[] = ((t.exercises ?? []) as any[]).map((e: any) => e.name);
        const matchedPRs = exNames.map((n) => prMap.get(n)).filter(Boolean) as typeof prGroups;
        return matchedPRs.length > 0
          ? { id: t.id as string, label: t.name as string, prs: matchedPRs }
          : null;
      })
      .filter(Boolean) as { id: string; label: string; prs: typeof prGroups }[];
    // PRs for exercises not in any template
    const orphans = prGroups.filter((g) => !allTemplateExNames.has(g.name));
    if (orphans.length > 0) {
      groups.push({ id: "__none__", label: "ללא תבנית", prs: orphans });
    }
    return groups;
  }, [prGroups, templates]);

  const handleAdd = async () => {
    if (!prName.trim()) return toast.error("שם התרגיל חסר");
    const val = parseFloat(prValueRaw) || 0;
    if (val <= 0) return toast.error("ערך לא תקין");
    try {
      await addPR.mutateAsync({ exercise_name: prName.trim(), value: val, unit: prUnit });
      toast.success(`🏆 שיא: ${prName} ${val} ${prUnit}`);
      setPrName(""); setPrValueRaw("100"); setShowForm(false);
    } catch { toast.error("שגיאה בשמירה"); }
  };

  const handleSaveEdit = async (id: string) => {
    const val = parseFloat(editValue);
    if (isNaN(val) || val <= 0) return toast.error("ערך לא תקין");
    try {
      await updatePR.mutateAsync({ id, value: val });
      toast.success("שיא עודכן ✅");
      setEditingId(null);
    } catch { toast.error("שגיאה בעדכון"); }
  };

  const handleDelete = (id: string, name: string) => {
    toast.error(`מחק שיא — ${name}?`, {
      action: { label: "מחק", onClick: () => deletePR.mutate(id) },
      duration: 5000,
    });
  };

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Medal className="h-4 w-4 text-amber-400" />
          <p className="text-sm font-black text-white">שיאים אישיים</p>
          {prGroups.length > 0 && (
            <span className="text-[10px] text-white/30 bg-white/8 rounded-lg px-1.5 py-0.5">
              {prGroups.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {/* Toggle: grouped-by-template / flat */}
          {prGroups.length > 0 && (
            <button
              onClick={() => setGroupByTemplate((v) => !v)}
              title={groupByTemplate ? "הצג הכל" : "קבץ לפי תבנית"}
              className={`h-7 px-2 rounded-xl text-[10px] font-bold flex items-center gap-1 transition-all ${
                groupByTemplate
                  ? "bg-amber-500/20 border border-amber-500/25 text-amber-400"
                  : "bg-white/8 border border-white/10 text-white/40"
              }`}
            >
              <Layers className="h-3 w-3" />
              <span>{groupByTemplate ? "תבניות" : "הכל"}</span>
            </button>
          )}
          <button
            onClick={() => setShowForm((v) => !v)}
            className="h-7 w-7 rounded-xl bg-amber-500/15 border border-amber-500/20 flex items-center justify-center text-amber-400 hover:bg-amber-500/25 active:scale-90 transition-all"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/8 p-3 space-y-3">
          <input
            value={prName}
            onChange={(e) => setPrName(e.target.value)}
            placeholder="שם התרגיל (למשל: לחיצת חזה)..."
            className="w-full bg-transparent text-sm text-white placeholder:text-white/25 outline-none border-b border-white/10 pb-1.5"
            dir="rtl"
          />
          <div className="flex items-center gap-2">
            <input
              type="text"
              inputMode="decimal"
              value={prValueRaw}
              onChange={(e) => setPrValueRaw(e.target.value)}
              onFocus={(e) => e.target.select()}
              className="w-20 rounded-xl border border-white/10 bg-white/8 text-center text-sm font-bold text-white outline-none py-1.5"
            />
            <select
              value={prUnit}
              onChange={(e) => setPrUnit(e.target.value)}
              className="bg-white/10 border border-white/10 rounded-xl text-xs text-white px-2 py-1.5 outline-none"
            >
              {["kg", "reps", "km", "min", "sec"].map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
            <button
              onClick={handleAdd}
              disabled={addPR.isPending}
              className="flex-1 py-2 rounded-xl bg-amber-500 text-white font-black text-xs hover:bg-amber-400 active:scale-95 transition-all disabled:opacity-50"
            >
              שמור
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="h-7 w-7 rounded-xl bg-white/8 flex items-center justify-center"
            >
              <X className="h-3.5 w-3.5 text-white/40" />
            </button>
          </div>
        </div>
      )}

      {/* Shared exercise-row renderer (used by both flat and grouped views) */}
      {(() => {
        const ExerciseRow = (group: typeof prGroups[number]) => (
          <div key={group.name} className="rounded-2xl border border-white/8 overflow-hidden">
            <div
              className="flex items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-white/[0.03] transition-colors"
              onClick={() => setExpandedEx(expandedEx === group.name ? null : group.name)}
            >
              <Trophy className="h-3.5 w-3.5 text-amber-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-white/80 truncate">{group.name}</p>
                {group.records.length > 1 && (
                  <p className="text-[9px] text-white/30">{group.records.length} רשומות</p>
                )}
              </div>
              {editingId === group.best.id ? (
                <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="text" inputMode="decimal" value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onFocus={(e) => e.target.select()}
                    className="w-14 rounded-lg border border-amber-500/40 bg-amber-500/10 text-center text-xs font-black text-amber-400 outline-none py-1"
                    autoFocus
                  />
                  <button onClick={() => handleSaveEdit(group.best.id)}
                    className="h-6 w-6 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                    <Check className="h-3 w-3 text-emerald-400" />
                  </button>
                  <button onClick={() => setEditingId(null)}
                    className="h-6 w-6 rounded-lg bg-white/8 flex items-center justify-center">
                    <X className="h-3 w-3 text-white/40" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <span className="text-sm font-black text-amber-400">
                    {Number(group.best.value).toLocaleString()}
                  </span>
                  <span className="text-[10px] text-white/35">{group.best.unit}</span>
                  <button
                    onClick={() => { setEditingId(group.best.id); setEditValue(String(group.best.value)); }}
                    className="h-6 w-6 rounded-lg bg-white/6 flex items-center justify-center hover:bg-white/12 transition-all"
                  ><Pencil className="h-3 w-3 text-white/35" /></button>
                  <button
                    onClick={() => handleDelete(group.best.id, group.name)}
                    className="h-6 w-6 rounded-lg bg-white/6 flex items-center justify-center hover:bg-red-500/15 transition-all"
                  ><Trash2 className="h-3 w-3 text-white/30" /></button>
                </div>
              )}
              <div className="ms-1 text-white/20">
                {expandedEx === group.name ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </div>
            </div>
            {expandedEx === group.name && (
              <div className="border-t border-white/5 px-3 pb-3">
                <PRHistoryMiniChart records={group.records} unit={group.best.unit} />
                {group.records.length > 1 && (
                  <div className="mt-2 space-y-1">
                    {[...group.records].sort((a, b) => b.date.localeCompare(a.date)).map((r) => (
                      <div key={r.id} className="flex items-center justify-between text-[10px] text-white/40">
                        <span>{new Date(r.date).toLocaleDateString("he-IL", { day: "numeric", month: "numeric", year: "2-digit" })}</span>
                        <span className={`font-bold ${r.id === group.best.id ? "text-amber-400" : "text-white/55"}`}>
                          {Number(r.value)} {r.unit}{r.id === group.best.id && " 🏆"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );

        if (prGroups.length === 0) return (
          <div className="text-center py-6">
            <span className="text-4xl">🏆</span>
            <p className="text-xs text-white/30 mt-2">אין שיאים עדיין — שמור אימון עם משקל!</p>
          </div>
        );

        /* ── Show-more toggle button ─────────────────────────────────── */
        const ShowMoreBtn = ({ total }: { total: number }) =>
          total > VISIBLE_PR_COUNT ? (
            <button
              onClick={() => setShowAllPRs((v) => !v)}
              className="w-full mt-1 py-2 rounded-2xl border border-white/10 bg-white/5 text-[11px] font-bold text-white/45 hover:bg-white/8 hover:text-white/65 transition-all active:scale-[0.98]"
            >
              {showAllPRs ? `הצג פחות ▲` : `הצג הכל (${total}) ▼`}
            </button>
          ) : null;

        /* ── FLAT view ───────────────────────────────────────────────── */
        if (!groupByTemplate) {
          const visible = showAllPRs ? prGroups : prGroups.slice(0, VISIBLE_PR_COUNT);
          return (
            <div className="space-y-1">
              {visible.map((g) => ExerciseRow(g))}
              <ShowMoreBtn total={prGroups.length} />
            </div>
          );
        }

        /* ── GROUPED-BY-TEMPLATE view ────────────────────────────────── */
        if (templateGroups.length === 0) {
          const visible = showAllPRs ? prGroups : prGroups.slice(0, VISIBLE_PR_COUNT);
          return (
            <div className="space-y-1">
              {visible.map((g) => ExerciseRow(g))}
              <ShowMoreBtn total={prGroups.length} />
            </div>
          );
        }

        const visibleGroups = showAllPRs ? templateGroups : templateGroups.slice(0, VISIBLE_PR_COUNT);
        const VISIBLE_PER_GROUP = 2;
        return (
          <div className="space-y-3">
            {visibleGroups.map((tg) => {
              const isExpanded = expandedTg.has(tg.id);
              const visiblePrs = isExpanded ? tg.prs : tg.prs.slice(0, VISIBLE_PER_GROUP);
              return (
                <div key={tg.id} className="space-y-1">
                  {/* Template section header */}
                  <div className="flex items-center gap-2 px-1">
                    <div className={`h-px flex-1 ${tg.id === "__none__" ? "bg-white/8" : "bg-amber-500/20"}`} />
                    <span className={`text-[10px] font-black shrink-0 ${tg.id === "__none__" ? "text-white/30" : "text-amber-400/70"}`}>
                      {tg.id === "__none__" ? "✨ ללא תבנית" : `📋 ${tg.label}`}
                    </span>
                    <span className="text-[9px] text-white/20 bg-white/5 rounded-md px-1 py-0.5 shrink-0">
                      {tg.prs.length}
                    </span>
                    <div className={`h-px flex-1 ${tg.id === "__none__" ? "bg-white/8" : "bg-amber-500/20"}`} />
                  </div>
                  {/* Exercise rows under this template — draw from global prGroups */}
                  {visiblePrs.map((g) => ExerciseRow(g))}
                  {/* Per-group expand/collapse */}
                  {tg.prs.length > VISIBLE_PER_GROUP && (
                    <button
                      onClick={() => setExpandedTg((prev) => {
                        const next = new Set(prev);
                        if (next.has(tg.id)) next.delete(tg.id); else next.add(tg.id);
                        return next;
                      })}
                      className="w-full py-1.5 rounded-xl border border-white/8 bg-white/4 text-[10px] font-bold text-white/35 hover:bg-white/8 hover:text-white/55 transition-all active:scale-[0.98]"
                    >
                      {isExpanded ? `הצג פחות ▲` : `הצג הכל (${tg.prs.length}) ▼`}
                    </button>
                  )}
                </div>
              );
            })}
            <ShowMoreBtn total={templateGroups.length} />
          </div>
        );
      })()}
    </div>
  );
}

// ─── Weekly Volume Chart ──────────────────────────────────────────────────────
// Bug fix: was ISO Monday start — now Israeli Sunday start to match useWeekWorkouts / useWeeklyVolume
function getISOWeekStart(date: Date): string {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay()); // back to Sunday
  d.setHours(0, 0, 0, 0);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function VolumeChart() {
  const { data: weekData, isLoading } = useWeeklyVolume(8);

  if (isLoading) return null;
  const hasData = (weekData ?? []).some((w: any) => w.volume > 0);

  const currentWeek = getISOWeekStart(new Date());

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-blue-400" />
        <p className="text-sm font-black text-white">נפח אימון שבועי</p>
        <span className="text-[10px] text-white/30 bg-white/5 rounded-lg px-1.5 py-0.5">ק״ג × חזרות × סטים</span>
      </div>

      {!hasData ? (
        <div className="h-36 flex items-center justify-center">
          <p className="text-xs text-white/25">שמור אימונים עם משקל כדי לראות נפח</p>
        </div>
      ) : (
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weekData ?? []} barCategoryGap="22%">
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.05)"
                vertical={false}
              />
              <XAxis
                dataKey="label"
                tick={{ fill: "rgba(255,255,255,0.30)", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "rgba(255,255,255,0.22)", fontSize: 9 }}
                axisLine={false}
                tickLine={false}
                width={36}
                tickFormatter={(v: number) =>
                  v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v)
                }
              />
              <Tooltip
                cursor={{ fill: "rgba(255,255,255,0.04)" }}
                contentStyle={{
                  background: "rgba(8,12,22,0.92)",
                  border: "1px solid rgba(255,255,255,0.10)",
                  borderRadius: 12,
                  fontSize: 12,
                  color: "#fff",
                }}
                formatter={(v: number) => [`${v.toLocaleString()} ק״ג`, "נפח"]}
                labelStyle={{ color: "rgba(255,255,255,0.4)", fontSize: 10 }}
              />
              <Bar dataKey="volume" radius={[7, 7, 0, 0]}>
                {(weekData ?? []).map((entry: any) => (
                  <Cell
                    key={entry.week}
                    fill={
                      entry.week === currentWeek
                        ? "#3b82f6"
                        : "rgba(59,130,246,0.30)"
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function WorkoutHistoryStrip() {
  const { data: workouts } = useWeekWorkouts();
  const list = (workouts ?? []).slice(0, 5) as any[];
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-emerald-400" />
        <p className="text-sm font-black text-white">היסטוריית אימונים</p>
      </div>
      {list.length === 0 ? (
        <p className="text-xs text-white/25 text-center py-4">אין אימונים השבוע עדיין</p>
      ) : (
        <div className="space-y-2">
          {list.map((w) => (
            <div key={w.id} className="flex items-center justify-between py-2.5 border-b border-white/5 last:border-0">
              <div>
                <p className="text-xs font-bold text-white/80">{w.category}</p>
                <p className="text-[10px] text-white/35">{new Date(w.date).toLocaleDateString("he-IL", { weekday: "short", day: "numeric", month: "numeric" })}</p>
              </div>
              <div className="flex items-center gap-1 text-[10px] text-white/40">
                <Clock className="h-3 w-3" />{w.duration_minutes || "—"} דק׳
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function WorkoutHistoryGrouped() {
  const { data: workouts, isLoading } = useWorkoutHistory();
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [showAllWorkouts, setShowAllWorkouts] = useState(false);
  const VISIBLE_WORKOUT_COUNT = 3;
  const deleteWorkout = useDeleteWorkout();
  const updateWorkout = useUpdateWorkout();
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [editWorkout, setEditWorkout] = useState<{ id: string; notes: string; duration_minutes: number } | null>(null);

  const grouped = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const w of workouts ?? []) {
      const key = (w as any).notes || "אימון ללא שם";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(w);
    }
    return [...map.entries()];
  }, [workouts]);

  const CATEGORY_EMOJI: Record<string, string> = {
    weights: "🏋️", calisthenics: "🤸", running: "🏃", mixed: "⚡",
  };

  return (
    <>
    <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <BookOpen className="h-4 w-4 text-blue-400" />
        <p className="text-sm font-black text-white">היסטוריה לפי תבנית</p>
        <span className="text-[10px] text-white/30 me-auto">{workouts?.length ?? 0} אחרונים</span>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="h-5 w-5 text-white/30 animate-spin" />
        </div>
      ) : grouped.length === 0 ? (
        <p className="text-xs text-white/25 text-center py-4">אין אימונים לתצוגה עדיין</p>
      ) : (
        <div className="space-y-2">
          {(showAllWorkouts ? grouped : grouped.slice(0, VISIBLE_WORKOUT_COUNT)).map(([templateName, wList]) => {
            const isOpen = openKey === templateName;
            const totalMins = wList.reduce((s: number, w: any) => s + (w.duration_minutes || 0), 0);
            const totalCal  = wList.reduce((s: number, w: any) => s + (w.calories_burned  || 0), 0);
            const emoji = CATEGORY_EMOJI[(wList[0] as any).category] ?? "💪";
            return (
              <div key={templateName} className="rounded-2xl border border-white/8 bg-white/3 overflow-hidden">
                {/* Accordion header */}
                <button
                  className="w-full flex items-center gap-3 px-3 py-3 text-end active:bg-white/5 transition-all"
                  onClick={() => setOpenKey(isOpen ? null : templateName)}
                >
                  <span className="text-lg">{emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-black text-white truncate">{templateName}</p>
                    <p className="text-[10px] text-white/35">{wList.length} אימונים · {totalMins} דק׳ · {totalCal} קל׳</p>
                  </div>
                  <span className={`text-white/30 text-xs transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}>▾</span>
                </button>

                {/* Accordion body */}
                {isOpen && (
                  <div className="border-t border-white/8 divide-y divide-white/5">
                    {wList.map((w: any) => (
                      <div key={w.id} className="px-3 py-2.5 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] text-white/50">
                            {new Date(w.date).toLocaleDateString("he-IL", { weekday: "short", day: "numeric", month: "numeric", year: "2-digit" })}
                          </p>
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1.5 text-[10px] text-white/35">
                              <span><Clock className="h-2.5 w-2.5 inline me-0.5" />{w.duration_minutes || "—"} דק׳</span>
                            </div>
                            <button
                              onClick={() => setEditWorkout({ id: w.id, notes: w.notes ?? "", duration_minutes: w.duration_minutes ?? 45 })}
                              className="h-6 w-6 rounded-lg bg-white/6 border border-white/10 flex items-center justify-center hover:bg-blue-500/15 hover:border-blue-500/30 active:scale-90 transition-all"
                            >
                              <Pencil className="h-3 w-3 text-white/40" />
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(w.id)}
                              className="h-6 w-6 rounded-lg bg-white/6 border border-white/10 flex items-center justify-center hover:bg-red-500/15 hover:border-red-500/30 active:scale-90 transition-all"
                            >
                              <Trash2 className="h-3 w-3 text-white/40" />
                            </button>
                          </div>
                        </div>
                        {(w.workout_exercises ?? []).length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {(w.workout_exercises as any[]).map((ex: any) => (
                              <span key={ex.id} className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/6 text-white/40 border border-white/8">
                                {ex.name} {ex.sets}×{ex.reps}{ex.weight_kg ? ` @${ex.weight_kg}kg` : ""}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {grouped.length > VISIBLE_WORKOUT_COUNT && (
            <button
              onClick={() => setShowAllWorkouts((v) => !v)}
              className="w-full py-2 rounded-2xl border border-white/10 bg-white/5 text-[11px] font-bold text-white/45 hover:bg-white/8 hover:text-white/65 transition-all active:scale-[0.98]"
            >
              {showAllWorkouts ? `הצג פחות ▲` : `הצג הכל (${grouped.length}) ▼`}
            </button>
          )}
        </div>
      )}
    </div>

    {/* ── Confirm Delete Modal ── */}
    {confirmDeleteId && (
      <div className="fixed inset-0 z-50 flex items-center justify-center px-6"
        style={{ background: "rgba(0,0,0,0.72)", backdropFilter: "blur(14px)" }}
        onClick={(e) => { if (e.target === e.currentTarget) setConfirmDeleteId(null); }}
      >
        <div className="w-full max-w-sm rounded-3xl border border-white/12 bg-[#0d0d0f] p-6 space-y-5 shadow-2xl"
          style={{ animation: "prBounce 0.35s cubic-bezier(.17,.67,.35,1.4) both" }}>
          <div className="text-center space-y-2">
            <div className="text-3xl">🗑️</div>
            <p className="text-base font-black text-white">מחיקת אימון</p>
            <p className="text-[12px] text-white/50">האימון יימחק לצמיתות. פעולה זו אינה הפיכה.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => setConfirmDeleteId(null)}
              className="py-3.5 rounded-2xl border border-white/15 text-white/50 text-sm font-bold active:scale-[0.97] transition-all">
              ביטול
            </button>
            <button
              onClick={async () => {
                try {
                  await deleteWorkout.mutateAsync(confirmDeleteId);
                  toast.success("האימון נמחק");
                  setConfirmDeleteId(null);
                } catch { toast.error("שגיאה במחיקה"); }
              }}
              disabled={deleteWorkout.isPending}
              className="py-3.5 rounded-2xl bg-red-500 text-white text-sm font-black active:scale-[0.97] transition-all disabled:opacity-50">
              מחק
            </button>
          </div>
        </div>
      </div>
    )}

    {/* ── Edit Workout Modal ── */}
    {editWorkout && (
      <div className="fixed inset-0 z-50 flex items-center justify-center px-6"
        style={{ background: "rgba(0,0,0,0.72)", backdropFilter: "blur(14px)" }}
        onClick={(e) => { if (e.target === e.currentTarget) setEditWorkout(null); }}
      >
        <div className="w-full max-w-sm rounded-3xl border border-white/12 bg-[#0d0d0f] p-6 space-y-5 shadow-2xl"
          style={{ animation: "prBounce 0.35s cubic-bezier(.17,.67,.35,1.4) both" }}>
          <p className="text-base font-black text-white text-center">עריכת אימון</p>
          <div className="space-y-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <p className="text-[10px] text-white/40 mb-1">שם האימון</p>
              <input
                value={editWorkout.notes}
                onChange={(e) => setEditWorkout((prev) => prev ? { ...prev, notes: e.target.value } : null)}
                className="w-full bg-transparent text-sm font-bold text-white placeholder:text-white/25 outline-none text-end"
                dir="rtl"
                placeholder="שם האימון"
              />
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <p className="text-[10px] text-white/40 mb-1">משך (דקות)</p>
              <input
                type="number"
                value={editWorkout.duration_minutes}
                onChange={(e) => setEditWorkout((prev) => prev ? { ...prev, duration_minutes: parseInt(e.target.value) || 0 } : null)}
                className="w-full bg-transparent text-sm font-bold text-white outline-none text-end"
                dir="rtl"
                min={1}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => setEditWorkout(null)}
              className="py-3.5 rounded-2xl border border-white/15 text-white/50 text-sm font-bold active:scale-[0.97] transition-all">
              ביטול
            </button>
            <button
              onClick={async () => {
                try {
                  await updateWorkout.mutateAsync({ id: editWorkout.id, notes: editWorkout.notes, duration_minutes: editWorkout.duration_minutes });
                  toast.success("האימון עודכן ✓");
                  setEditWorkout(null);
                } catch { toast.error("שגיאה בעדכון"); }
              }}
              disabled={updateWorkout.isPending}
              className="py-3.5 rounded-2xl bg-emerald-500 text-white text-sm font-black active:scale-[0.97] transition-all disabled:opacity-50 shadow-[0_0_16px_rgba(16,185,129,0.3)]">
              שמור
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  TASK 5 — Running Module & Visual Progress
// ═══════════════════════════════════════════════════════════════════════

// ─── Pace helpers ────────────────────────────────────────────────────────────
function computePaceDecimal(distanceKm: number, durationMinutes: number): number | null {
  if (distanceKm <= 0 || durationMinutes <= 0) return null;
  const p = durationMinutes / distanceKm;
  if (p < 2 || p > 40) return null;
  return p;
}
function formatPace(decimalMinutes: number): string {
  const mins = Math.floor(decimalMinutes);
  const secs = Math.round((decimalMinutes - mins) * 60);
  return `${mins}:${String(secs).padStart(2, "0")}`;
}
function formatDurationHMS(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.floor(minutes % 60);
  const s = Math.round((minutes - Math.floor(minutes)) * 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// Canvas: rounded rectangle path helper
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

// ─── Share Run Modal ──────────────────────────────────────────────────────────
interface RunForShare {
  date: string;
  distanceKm:      number | null;
  durationMinutes: number | null;
  paceDecimal:     number | null;
  notes?:          string | null;
}

function ShareRunModal({ run, onClose }: { run: RunForShare; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = 1080, H = 1080;
    canvas.width = W; canvas.height = H;

    // ── Background gradient ──
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0,   "#070e19");
    bg.addColorStop(0.45,"#0b2018");
    bg.addColorStop(1,   "#060c15");
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

    // ── Emerald glow — top right ──
    const g1 = ctx.createRadialGradient(W * 0.85, H * 0.1, 0, W * 0.85, H * 0.1, 460);
    g1.addColorStop(0, "rgba(16,185,129,0.20)");
    g1.addColorStop(1, "rgba(16,185,129,0)");
    ctx.fillStyle = g1; ctx.fillRect(0, 0, W, H);

    // ── Orange glow — bottom left ──
    const g2 = ctx.createRadialGradient(W * 0.18, H * 0.9, 0, W * 0.18, H * 0.9, 340);
    g2.addColorStop(0, "rgba(249,115,22,0.14)");
    g2.addColorStop(1, "rgba(249,115,22,0)");
    ctx.fillStyle = g2; ctx.fillRect(0, 0, W, H);

    // ── Subtle dot grid ──
    ctx.fillStyle = "rgba(255,255,255,0.025)";
    for (let x = 30; x < W; x += 54) {
      for (let y = 30; y < H; y += 54) {
        ctx.beginPath(); ctx.arc(x, y, 1.5, 0, Math.PI * 2); ctx.fill();
      }
    }

    // ── Text setup (RTL) ──
    ctx.direction  = "rtl";
    ctx.textBaseline = "alphabetic";

    // ── App name ──
    ctx.font      = "bold 48px -apple-system, Arial, sans-serif";
    ctx.fillStyle = "#10b981";
    ctx.textAlign = "right";
    ctx.fillText("LifePulse", W - 80, 104);

    // ── Date ──
    const dateStr = new Date(run.date).toLocaleDateString("he-IL", {
      weekday: "long", day: "numeric", month: "long",
    });
    ctx.font      = "32px -apple-system, Arial, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.36)";
    ctx.fillText(dateStr, W - 80, 152);

    // ── Top divider ──
    ctx.strokeStyle = "rgba(16,185,129,0.22)";
    ctx.lineWidth   = 1.5;
    ctx.setLineDash([10, 7]);
    ctx.beginPath(); ctx.moveTo(80, 186); ctx.lineTo(W - 80, 186); ctx.stroke();
    ctx.setLineDash([]);

    // ── Hero: "PACE" label ──
    ctx.font      = "bold 30px -apple-system, Arial, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.30)";
    ctx.textAlign = "center";
    ctx.fillText("פייס ממוצע", W / 2, 280);

    // ── Hero pace number ──
    const paceStr = run.paceDecimal ? formatPace(run.paceDecimal) : "--:--";
    ctx.font      = "bold 230px -apple-system, Arial, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.96)";
    ctx.fillText(paceStr, W / 2, 530);

    // ── /ק"מ unit ──
    ctx.font      = "bold 58px -apple-system, Arial, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.38)";
    ctx.fillText("/ק״מ", W / 2, 600);

    // ── Stats boxes ──
    const stats: { label: string; value: string }[] = [];
    if (run.distanceKm)      stats.push({ label: "קילומטר",  value: run.distanceKm.toFixed(1) });
    if (run.durationMinutes) stats.push({ label: "זמן ריצה", value: formatDurationHMS(run.durationMinutes) });

    if (stats.length > 0) {
      const bW = stats.length === 1 ? 360 : 310;
      const bH = 148;
      const bY = 666;
      const gap = 30;
      const totalW = stats.length * bW + (stats.length - 1) * gap;
      const startX = (W - totalW) / 2;

      stats.forEach((s, i) => {
        const bx = startX + i * (bW + gap);
        ctx.fillStyle = "rgba(255,255,255,0.055)";
        roundRect(ctx, bx, bY, bW, bH, 24);
        ctx.fill();

        ctx.font      = `bold ${stats.length === 1 ? 88 : 76}px -apple-system, Arial, sans-serif`;
        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "center";
        ctx.fillText(s.value, bx + bW / 2, bY + 94);

        ctx.font      = "28px -apple-system, Arial, sans-serif";
        ctx.fillStyle = "rgba(255,255,255,0.38)";
        ctx.fillText(s.label, bx + bW / 2, bY + 130);
      });
    }

    // ── Bottom divider ──
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth   = 1;
    ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(80, H - 128); ctx.lineTo(W - 80, H - 128); ctx.stroke();

    // ── Footer ──
    ctx.font      = "26px -apple-system, Arial, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.16)";
    ctx.textAlign = "center";
    ctx.fillText("LifePulse • מעקב כושר ובריאות", W / 2, H - 68);

  }, [run]);

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url; a.download = `run_${run.date}.png`; a.click();
  };

  const handleShare = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const file = new File([blob], "my-run.png", { type: "image/png" });
      if (typeof navigator.share === "function") {
        try {
          await navigator.share({ files: [file], title: "הריצה שלי 🏃" });
          return;
        } catch {/* user cancelled — fall through to download */}
      }
      handleDownload();
    }, "image/png");
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm space-y-3 rounded-3xl border border-white/10 bg-black/90 backdrop-blur-xl p-4 pb-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <button
            onClick={onClose}
            className="h-7 w-7 rounded-xl bg-white/10 flex items-center justify-center hover:bg-white/15 transition-all"
          >
            <X className="h-3.5 w-3.5 text-white/60" />
          </button>
          <p className="text-sm font-black text-white">שתף ריצה</p>
          <div className="w-7" />
        </div>

        {/* Canvas preview */}
        <div className="rounded-2xl overflow-hidden w-full aspect-square bg-black shadow-2xl">
          <canvas ref={canvasRef} className="w-full h-full" style={{ imageRendering: "auto" }} />
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 pt-1">
          <button
            onClick={handleDownload}
            className="flex-1 py-3 rounded-2xl bg-white/8 border border-white/10 text-sm font-bold text-white/60 flex items-center justify-center gap-2 hover:bg-white/12 active:scale-95 transition-all"
          >
            <Download className="h-4 w-4" /> הורד
          </button>
          <button
            onClick={handleShare}
            className="flex-1 py-3 rounded-2xl bg-emerald-500 text-sm font-black text-white flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/30 hover:bg-emerald-400 active:scale-95 transition-all"
          >
            <Share2 className="h-4 w-4" /> שתף
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Running Log Section ──────────────────────────────────────────────────────
function RunningLogSection() {
  const addWorkout = useAddWorkout();
  const { data: runs } = useRunHistory();
  const { data: settings } = useUserSettings();
  const bodyWeight = (settings as any)?.weight_kg ?? 75;

  const [distRaw,  setDistRaw]  = useState("");
  const [minsRaw,  setMinsRaw]  = useState("");
  const [secsRaw,  setSecsRaw]  = useState("0");
  const [runNotes, setRunNotes] = useState("");
  const [shareRun, setShareRun] = useState<RunForShare | null>(null);

  // Real-time derived pace
  const distKm    = parseFloat(distRaw)  || 0;
  const totalMins = (parseInt(minsRaw)   || 0) + (parseInt(secsRaw) || 0) / 60;
  const paceDec   = computePaceDecimal(distKm, totalMins);

  // Estimated duration: use entered time if available, else 6 min/km default
  const estimatedMins = totalMins > 0 ? totalMins : distKm * 6;
  // Bug fix #1: pass distKm to use the Harvard/Margaria distance-based formula instead of MET-only
  const estimatedCalories = distKm > 0 || totalMins > 0
    ? calcCardioCalories("running", "medium", Math.max(1, Math.round(estimatedMins)), bodyWeight, undefined, distKm || undefined)
    : 0;

  const handleSave = async () => {
    if (!distKm && !totalMins) return toast.error("הכנס לפחות מרחק או זמן");
    try {
      await addWorkout.mutateAsync({
        category: "running",
        duration_minutes: totalMins || undefined,
        calories_burned:  estimatedCalories || undefined, // Bug fix #2: was missing — now saved to DB
        notes: runNotes || undefined,
        run: {
          distance_km:      distKm     || undefined,
          duration_minutes: totalMins  || undefined,
          pace_per_km:      paceDec    || undefined,
        },
      });
      toast.success(
        `🏃 ריצה נרשמה! ${distKm ? distKm + " ק״מ" : ""}${paceDec ? "  ·  " + formatPace(paceDec) + " /ק״מ" : ""}`
      );
      setDistRaw(""); setMinsRaw(""); setSecsRaw("0"); setRunNotes("");
    } catch {
      toast.error("שגיאה בשמירה");
    }
  };

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-4 space-y-4">
      {shareRun && (
        <ShareRunModal run={shareRun} onClose={() => setShareRun(null)} />
      )}

      {/* Title */}
      <div className="flex items-center gap-2">
        <Flame className="h-4 w-4 text-orange-400" />
        <p className="text-sm font-black text-white">יומן ריצה</p>
      </div>

      {/* Inputs */}
      <div className="space-y-2.5">

        {/* Distance */}
        <div className="flex items-center gap-2.5">
          <MapPin className="h-4 w-4 text-orange-400 shrink-0" />
          <div className="flex-1 flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5">
            <input
              type="text"
              inputMode="decimal"
              pattern="[0-9.]*"
              value={distRaw}
              onChange={(e) => setDistRaw(e.target.value)}
              onFocus={(e) => e.target.select()}
              placeholder="0.0"
              className="flex-1 bg-transparent text-sm font-bold text-white placeholder:text-white/20 outline-none text-left"
              dir="ltr"
            />
            <span className="text-xs font-bold text-orange-400/70 shrink-0">ק״מ</span>
          </div>
        </div>

        {/* Duration: minutes + seconds */}
        <div className="flex items-center gap-2.5">
          <Timer className="h-4 w-4 text-orange-400 shrink-0" />
          <div className="flex flex-1 gap-2">
            <div className="flex-1 flex items-center gap-1.5 rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={minsRaw}
                onChange={(e) => setMinsRaw(e.target.value.replace(/\D/g, ""))}
                onFocus={(e) => e.target.select()}
                placeholder="0"
                className="w-full bg-transparent text-sm font-bold text-white placeholder:text-white/20 outline-none text-left"
                dir="ltr"
              />
              <span className="text-xs font-bold text-orange-400/70 shrink-0">דק׳</span>
            </div>
            <div className="w-24 flex items-center gap-1.5 rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={secsRaw}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, "");
                  const n = parseInt(v) || 0;
                  setSecsRaw(String(Math.min(59, n)));
                }}
                onFocus={(e) => e.target.select()}
                placeholder="0"
                className="w-full bg-transparent text-sm font-bold text-white placeholder:text-white/20 outline-none text-left"
                dir="ltr"
              />
              <span className="text-xs font-bold text-orange-400/70 shrink-0">שנ׳</span>
            </div>
          </div>
        </div>

        {/* Real-time pace pill */}
        {paceDec && (
          <div className="flex items-center justify-center gap-2 rounded-2xl border border-orange-500/25 bg-orange-500/10 px-4 py-3 transition-all">
            <span className="text-2xl font-black text-white tracking-tight">{formatPace(paceDec)}</span>
            <span className="text-sm font-bold text-orange-400">/ק״מ</span>
          </div>
        )}

        {/* Estimated minutes + calorie hint (when km entered without time) */}
        {distKm > 0 && totalMins === 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-bold text-white/40">≈ {Math.round(estimatedMins)} דקות</span>
            {estimatedCalories > 0 && (
              <span className="text-orange-400 text-[11px] font-bold">~{estimatedCalories} קל׳ 🔥</span>
            )}
          </div>
        )}

        {/* Calorie preview when time is entered */}
        {totalMins > 0 && estimatedCalories > 0 && (
          <div className="flex items-center justify-center gap-2 rounded-2xl border border-orange-500/20 bg-orange-500/8 py-2.5 transition-all">
            <Flame className="h-4 w-4 text-orange-400" />
            <span className="text-lg font-black text-white">{estimatedCalories.toLocaleString()}</span>
            <span className="text-xs font-bold text-orange-400">קלוריות</span>
          </div>
        )}

        {/* Notes */}
        <input
          value={runNotes}
          onChange={(e) => setRunNotes(e.target.value)}
          placeholder="הערות (מסלול, תחושה...)..."
          className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-white/20 outline-none"
          dir="rtl"
        />

        {/* Save */}
        <button
          onClick={handleSave}
          disabled={addWorkout.isPending || (!distKm && !totalMins)}
          className="w-full py-3.5 rounded-2xl bg-orange-500 text-white font-black text-sm disabled:opacity-40 hover:bg-orange-400 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-lg shadow-orange-500/25 min-h-[44px]"
        >
          {addWorkout.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          שמור ריצה
        </button>
      </div>

      {/* Recent runs list */}
      {(runs ?? []).length > 0 && (
        <div className="space-y-2 pt-1 border-t border-white/5">
          <p className="text-[11px] font-bold text-white/35 uppercase tracking-wider pt-1">ריצות אחרונות</p>
          <div className="space-y-1.5">
            {(runs ?? []).slice(0, 6).map((r: any) => {
              const rd   = r.run;
              const pace = rd?.pace_per_km ? formatPace(Number(rd.pace_per_km)) : null;
              const dist = rd?.distance_km ? Number(rd.distance_km).toFixed(1) : null;
              return (
                <div key={r.id}
                  className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-2.5"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {dist && (
                        <span className="text-sm font-black text-white">{dist} ק״מ</span>
                      )}
                      {pace && (
                        <span className="text-xs font-bold text-orange-400 bg-orange-400/10 rounded-lg px-1.5 py-0.5">
                          {pace} /ק״מ
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-white/30 mt-0.5">
                      {new Date(r.date).toLocaleDateString("he-IL", {
                        weekday: "short", day: "numeric", month: "numeric",
                      })}
                      {rd?.duration_minutes
                        ? `  ·  ${formatDurationHMS(Number(rd.duration_minutes))}`
                        : ""}
                    </p>
                  </div>
                  {/* Share button */}
                  <button
                    onClick={() =>
                      setShareRun({
                        date:             r.date,
                        distanceKm:      rd?.distance_km      ? Number(rd.distance_km)      : null,
                        durationMinutes: rd?.duration_minutes ? Number(rd.duration_minutes) : null,
                        paceDecimal:     rd?.pace_per_km      ? Number(rd.pace_per_km)      : null,
                        notes:           r.notes,
                      })
                    }
                    className="h-8 w-8 rounded-xl bg-white/8 flex items-center justify-center shrink-0 hover:bg-white/12 active:scale-90 transition-all"
                  >
                    <Share2 className="h-3.5 w-3.5 text-white/40" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Body Progress Gallery ────────────────────────────────────────────────────
type BodyAngle = "front" | "back" | "side";

const BODY_ANGLES: { key: BodyAngle; label: string; emoji: string }[] = [
  { key: "front", label: "קדמי",  emoji: "🧍" },
  { key: "back",  label: "אחורי", emoji: "🔄" },
  { key: "side",  label: "צד",    emoji: "↔️" },
];

const BODY_PROGRESS_ANGLE_KEY = "body_progress_last_angle";

function BodyProgressGallery() {
  // Improvement #14: remember last selected angle across sessions
  const [angle, setAngle] = useState<BodyAngle>(() => {
    const saved = localStorage.getItem(BODY_PROGRESS_ANGLE_KEY) as BodyAngle | null;
    const validAngles: BodyAngle[] = BODY_ANGLES.map((a) => a.key);
    return saved && validAngles.includes(saved) ? saved : "front";
  });
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const [newFile,    setNewFile]    = useState<File | null>(null);
  const [newPreview, setNewPreview] = useState<string | null>(null);
  const [notes,      setNotes]      = useState("");
  const [photoDate,  setPhotoDate]  = useState(() => localDateStr());

  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: allPhotos, isLoading } = useBodyProgress();
  const addPhoto    = useAddBodyProgress();
  const deletePhoto = useDeleteBodyProgress();

  // Per-angle slice
  const anglePhotos = useMemo(
    () => (allPhotos ?? []).filter((p: any) => (p.angle ?? "front") === angle),
    [allPhotos, angle],
  );
  const ghostPhoto = anglePhotos[0] ?? null;

  // Clean up object URL on unmount or swap
  useEffect(() => {
    return () => { if (newPreview) URL.revokeObjectURL(newPreview); };
  }, [newPreview]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (newPreview) URL.revokeObjectURL(newPreview);
    setNewFile(file);
    setNewPreview(URL.createObjectURL(file));
    e.target.value = "";
  };

  const handleSave = async () => {
    if (!newFile) return toast.error("בחר תמונה");
    try {
      await addPhoto.mutateAsync({ file: newFile, angle, notes, date: photoDate });
      const lbl = BODY_ANGLES.find((a) => a.key === angle)?.label ?? angle;
      const dateFormatted = new Date(photoDate + "T12:00:00").toLocaleDateString("he-IL", { day: "numeric", month: "numeric", year: "2-digit" });
      toast.success(`📸 תמונה נשמרה — ${lbl} · ${dateFormatted}`);
      setNewFile(null); setNewPreview(null); setNotes("");
      setPhotoDate(localDateStr());
    } catch {/* handled in hook */}
  };

  const handleDiscard = () => {
    if (newPreview) URL.revokeObjectURL(newPreview);
    setNewFile(null); setNewPreview(null);
  };

  const handleDeleteWithConfirm = (p: any) => {
    toast.error("מחיקת תמונה?", {
      action: {
        label: "מחק",
        onClick: () => deletePhoto.mutate({ id: p.id, photoPath: p.photo_url }),
      },
      duration: 5000,
    });
  };

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Camera className="h-4 w-4 text-violet-400" />
        <p className="text-sm font-black text-white">גלריית טרנספורמציה</p>
      </div>

      {/* Angle tabs */}
      <div className="flex gap-1 p-1 rounded-2xl bg-white/[0.04] border border-white/10">
        {BODY_ANGLES.map(({ key, label, emoji }) => (
          <button
            key={key}
            onClick={() => {
              setAngle(key);
              localStorage.setItem(BODY_PROGRESS_ANGLE_KEY, key); // Improvement #14
              if (newPreview) URL.revokeObjectURL(newPreview);
              setNewFile(null); setNewPreview(null);
            }}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
              angle === key
                ? "bg-violet-500 text-white shadow-lg shadow-violet-500/25"
                : "text-white/40 hover:text-white/65"
            }`}
          >
            {emoji} {label}
          </button>
        ))}
      </div>

      {/* Main: upload zone OR comparison */}
      {newPreview ? (
        /* ── Comparison: ghost (before) | new (after) ── */
        <div className="space-y-3">
          <div className="flex gap-2 h-52">
            {/* Before */}
            <div className="flex-1 rounded-2xl overflow-hidden relative">
              {ghostPhoto?.signedUrl ? (
                <img
                  src={ghostPhoto.signedUrl}
                  alt="לפני"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-white/5 flex items-center justify-center">
                  <p className="text-[10px] text-white/25">אין תמונה קודמת</p>
                </div>
              )}
              <div className="absolute bottom-0 inset-x-0 bg-black/55 py-1 flex items-center justify-center">
                <span className="text-[10px] font-bold text-white/55">
                  {ghostPhoto
                    ? new Date(ghostPhoto.date).toLocaleDateString("he-IL", {
                        day: "numeric", month: "numeric", year: "2-digit",
                      })
                    : "לפני"}
                </span>
              </div>
            </div>

            {/* After */}
            <div className="flex-1 rounded-2xl overflow-hidden relative">
              <img src={newPreview} alt="חדש" className="w-full h-full object-cover" />
              <div className="absolute bottom-0 inset-x-0 bg-emerald-500/55 py-1 flex items-center justify-center">
                <span className="text-[10px] font-bold text-white">
                  {new Date(photoDate + "T12:00:00").toLocaleDateString("he-IL", { day: "numeric", month: "numeric", year: "2-digit" })}
                </span>
              </div>
            </div>
          </div>

          {/* Date + Notes row */}
          <div className="flex gap-2">
            {/* Date picker */}
            <div className="relative flex-shrink-0">
              <input
                type="date"
                value={photoDate}
                max={localDateStr()}
                onChange={(e) => setPhotoDate(e.target.value)}
                className="rounded-2xl border border-violet-500/30 bg-violet-500/10 px-3 py-2.5 text-sm text-violet-200 outline-none focus:border-violet-500/60 transition-all w-36 [color-scheme:dark]"
              />
            </div>
            {/* Notes */}
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="הערות (משקל, תחושה...)..."
              className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-white/20 outline-none"
              dir="rtl"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={handleDiscard}
              className="flex-1 py-3 rounded-2xl border border-white/10 bg-white/5 text-sm font-bold text-white/50 hover:bg-white/8 active:scale-95 transition-all"
            >
              ביטול
            </button>
            <button
              onClick={handleSave}
              disabled={addPhoto.isPending}
              className="flex-1 py-3 rounded-2xl bg-violet-500 text-white font-black text-sm disabled:opacity-40 shadow-lg shadow-violet-500/25 flex items-center justify-center gap-2 hover:bg-violet-400 active:scale-95 transition-all min-h-[44px]"
            >
              {addPhoto.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              שמור
            </button>
          </div>
        </div>
      ) : (
        /* ── Ghost overlay upload zone ── */
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFileChange}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full h-52 rounded-2xl border border-dashed border-white/20 relative overflow-hidden flex items-center justify-center group hover:border-violet-500/40 transition-all"
          >
            {/* Ghost image — low opacity background */}
            {ghostPhoto?.signedUrl && (
              <img
                src={ghostPhoto.signedUrl}
                alt=""
                className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                style={{ opacity: 0.20, filter: "blur(1.5px) saturate(0.7)" }}
              />
            )}
            {/* Overlay content */}
            <div className="relative z-10 flex flex-col items-center gap-2 pointer-events-none">
              <div className="h-12 w-12 rounded-2xl bg-white/12 flex items-center justify-center group-hover:bg-violet-500/20 transition-all">
                <Camera className="h-6 w-6 text-white/50 group-hover:text-violet-400 transition-all" />
              </div>
              <p className="text-xs font-medium text-white/45 group-hover:text-white/65 transition-all">
                {ghostPhoto ? "הוסף תמונה חדשה" : "צלם / בחר תמונה"}
              </p>
              {ghostPhoto && (
                <p className="text-[10px] text-violet-400/55">
                  תמונה קודמת:{" "}
                  {new Date(ghostPhoto.date).toLocaleDateString("he-IL", {
                    day: "numeric", month: "long",
                  })}
                </p>
              )}
            </div>
          </button>
        </>
      )}

      {/* History strip */}
      {!isLoading && anglePhotos.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-bold text-white/30 uppercase tracking-wider">
            היסטוריה — {BODY_ANGLES.find((a) => a.key === angle)?.label}
          </p>
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
            {anglePhotos.map((p: any, idx: number) => (
              <div
                key={p.id}
                className="shrink-0 w-20 h-20 rounded-xl overflow-hidden relative group cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => setLightboxIdx(idx)}
              >
                {p.signedUrl ? (
                  <img src={p.signedUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-white/10" />
                )}
                {/* Delete on hover/long-tap */}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteWithConfirm(p); }}
                    className="h-7 w-7 rounded-lg bg-red-500/80 flex items-center justify-center hover:bg-red-500 active:scale-90 transition-all"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-white" />
                  </button>
                </div>
                {/* Date badge */}
                <div className="absolute bottom-0 inset-x-0 bg-black/50 py-0.5">
                  <p className="text-[8px] text-white/55 text-center">
                    {new Date(p.date).toLocaleDateString("he-IL", { day: "numeric", month: "numeric" })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightboxIdx !== null && anglePhotos.length > 0 && (
        <div
          className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center"
          onClick={() => setLightboxIdx(null)}
        >
          {/* Bug fix #3: icons were swapped — left button should show ← (ChevronLeft), right should show → (ChevronRight) */}
          <button
            className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors z-10"
            onClick={(e) => { e.stopPropagation(); setLightboxIdx((prev) => prev !== null ? (prev - 1 + anglePhotos.length) % anglePhotos.length : null); }}
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div className="flex flex-col items-center gap-3 max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
            <img
              src={anglePhotos[lightboxIdx].signedUrl}
              alt="progress"
              className="max-h-[80vh] max-w-[85vw] object-contain rounded-lg"
            />
            <div className="text-white/80 text-sm text-center flex gap-3">
              {anglePhotos[lightboxIdx].angle && (
                <span>{BODY_ANGLES.find((a) => a.key === anglePhotos[lightboxIdx].angle)?.label ?? anglePhotos[lightboxIdx].angle}</span>
              )}
              {anglePhotos[lightboxIdx].date && (
                <span>{new Date(anglePhotos[lightboxIdx].date).toLocaleDateString("he-IL")}</span>
              )}
            </div>
          </div>
          <button
            className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors z-10"
            onClick={(e) => { e.stopPropagation(); setLightboxIdx((prev) => prev !== null ? (prev + 1) % anglePhotos.length : null); }}
          >
            <ChevronRight className="w-6 h-6" />
          </button>
          <button
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            onClick={() => setLightboxIdx(null)}
          >
            <X className="w-5 h-5" />
          </button>
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/60 text-sm">
            {lightboxIdx + 1} / {anglePhotos.length}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Running Tab ──────────────────────────────────────────────────────────────
// ─── Other-sport cardio log (non-running) ────────────────────────────────────
function OtherCardioLogSection({ sport }: { sport: typeof CARDIO_SPORTS[number] }) {
  const addWorkout = useAddWorkout();
  const { data: settings } = useUserSettings();
  const bodyWeight = (settings as any)?.weight_kg ?? 75;

  const metricConfig = CARDIO_METRICS[sport.labelHe];

  const [primaryRaw,  setPrimaryRaw]  = useState("30");
  const [activeUnit,  setActiveUnit]  = useState<string>(metricConfig?.primaryUnit ?? "min");
  const [intensity,   setIntensity]   = useState<Intensity>("medium");
  const [notes,       setNotes]       = useState("");

  // Convert primary value to minutes for calorie calc
  const primaryVal = parseFloat(primaryRaw) || 0;
  const minutes: number = (() => {
    if (!metricConfig) return primaryVal;
    if (activeUnit === metricConfig.primaryUnit) {
      // Convert primary unit to minutes using standard paces
      if (metricConfig.primaryUnit === "km") {
        // Running: 1 km ≈ 6 min; Cycling: 1 km ≈ 3 min; Walking/Hiking: 1 km ≈ 12 min
        if (sport.key === "cycling") return primaryVal * 3;
        if (sport.key === "hiking" || sport.labelHe === "הליכה" || sport.labelHe === "טיול הרים") return primaryVal * 12;
        return primaryVal * 6; // running default
      }
      if (metricConfig.primaryUnit === "lengths") return primaryVal * 1.5; // 25m length ≈ 1.5 min
      if (metricConfig.primaryUnit === "m") return primaryVal / 500 * 2; // rowing: 500m ≈ 2 min
      if (metricConfig.primaryUnit === "rounds") return primaryVal * 4;   // HIIT/jump-rope rounds ~4 min each
      return primaryVal; // already minutes
    }
    // Alternative unit
    const alt = metricConfig.alternatives.find((a) => a.unit === activeUnit);
    return alt ? alt.toMinutes(primaryVal) : primaryVal;
  })();

  const calories = calcCardioCalories(sport.key, intensity, Math.round(minutes), bodyWeight);

  // Estimated calorie display using MET
  const estimatedCalories = calories;

  const handleSave = async () => {
    if (primaryVal <= 0) return toast.error("הזן ערך תקין");
    const durationMins = Math.max(1, Math.round(minutes));
    try {
      await addWorkout.mutateAsync({
        category:         sport.dbCategory,
        duration_minutes: durationMins,
        calories_burned:  estimatedCalories || undefined,
        notes:            notes || sport.labelHe,
      });
      toast.success(`${sport.emoji} ${sport.labelHe} נרשם! ${estimatedCalories ? estimatedCalories + " קלוריות" : ""}`);
      setPrimaryRaw("30"); setNotes("");
    } catch {
      toast.error("שגיאה בשמירה");
    }
  };

  const primaryLabel = metricConfig?.primary ?? "דקות";

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="text-xl">{sport.emoji}</span>
        <p className="text-sm font-black text-white">{sport.labelHe}</p>
      </div>

      {/* Primary metric input */}
      <div className="space-y-2">
        <div className="flex items-center gap-2.5">
          <Timer className="h-4 w-4 shrink-0" style={{ color: sport.color }} />
          <div className="flex-1 flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5">
            <input
              type="text" inputMode="decimal" pattern="[0-9.]*"
              value={primaryRaw}
              onChange={(e) => setPrimaryRaw(e.target.value.replace(/[^\d.]/g, ""))}
              onFocus={(e) => e.target.select()}
              placeholder="0"
              className="flex-1 bg-transparent text-sm font-bold text-white placeholder:text-white/20 outline-none text-left"
              dir="ltr"
            />
            <span className="text-xs font-bold shrink-0" style={{ color: sport.color + "bb" }}>
              {activeUnit === metricConfig?.primaryUnit ? primaryLabel : (metricConfig?.alternatives.find((a) => a.unit === activeUnit)?.label ?? primaryLabel)}
            </span>
          </div>
        </div>

        {/* Alternative unit toggles */}
        {metricConfig && metricConfig.alternatives.length > 0 && (
          <div className="flex gap-1.5 flex-wrap">
            <button
              onClick={() => setActiveUnit(metricConfig.primaryUnit)}
              className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition-all ${
                activeUnit === metricConfig.primaryUnit
                  ? "text-white"
                  : "bg-white/5 text-white/35 hover:text-white/55"
              }`}
              style={activeUnit === metricConfig.primaryUnit ? { background: sport.color + "33", border: `1px solid ${sport.color}55` } : {}}
            >
              {primaryLabel}
            </button>
            {metricConfig.alternatives.map((alt) => (
              <button
                key={alt.unit}
                onClick={() => setActiveUnit(alt.unit)}
                className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition-all ${
                  activeUnit === alt.unit
                    ? "text-white"
                    : "bg-white/5 text-white/35 hover:text-white/55"
                }`}
                style={activeUnit === alt.unit ? { background: sport.color + "33", border: `1px solid ${sport.color}55` } : {}}
              >
                {alt.label}
              </button>
            ))}
          </div>
        )}

        {/* Converted minutes + calorie inline hint */}
        {primaryVal > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            {activeUnit !== "min" && minutes > 0 && (
              <span className="text-[11px] font-bold text-white/40">
                ≈ {Math.round(minutes)} דקות
              </span>
            )}
            {estimatedCalories > 0 && (
              <span className="text-orange-400 text-[11px] font-bold">~{estimatedCalories} קל׳ 🔥</span>
            )}
          </div>
        )}
      </div>

      {/* Intensity picker */}
      <div className="space-y-1.5">
        <p className="text-[11px] font-bold text-white/40">עצימות</p>
        <div className="flex gap-2">
          {(["low", "medium", "high"] as Intensity[]).map((lvl) => (
            <button key={lvl} onClick={() => setIntensity(lvl)}
              className={`flex-1 py-2 rounded-2xl text-xs font-black transition-all ${
                intensity === lvl
                  ? "text-white shadow-sm"
                  : "bg-white/5 text-white/35 hover:text-white/55"
              }`}
              style={intensity === lvl ? { background: sport.color + "33", border: `1px solid ${sport.color}55` } : {}}
            >
              {INTENSITY_LABELS[lvl]}
            </button>
          ))}
        </div>
      </div>

      {/* Live calorie preview */}
      {estimatedCalories > 0 && (
        <div className="flex items-center justify-center gap-2 rounded-2xl border py-3 transition-all"
          style={{ borderColor: sport.color + "33", background: sport.color + "11" }}>
          <Flame className="h-4 w-4" style={{ color: sport.color }} />
          <span className="text-2xl font-black text-white">{estimatedCalories.toLocaleString()}</span>
          <span className="text-sm font-bold" style={{ color: sport.color }}>קלוריות</span>
        </div>
      )}

      {/* Notes */}
      <input
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="הערות (מסלול, תחושה...)..."
        className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-white/20 outline-none"
        dir="rtl"
      />

      {/* Save */}
      <button
        onClick={handleSave}
        disabled={addWorkout.isPending || primaryVal <= 0}
        className="w-full py-3.5 rounded-2xl text-white font-black text-sm disabled:opacity-40 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-lg min-h-[44px]"
        style={{ background: sport.color, boxShadow: `0 8px 24px ${sport.color}33` }}
      >
        {addWorkout.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
        שמור {sport.labelHe}
      </button>
    </div>
  );
}

// ─── Cardio Tab (renamed from RunningTab, now with sport picker) ──────────────
function CardioTab() {
  const [selectedSport, setSelectedSport] = useState<string>("running");
  const sport = CARDIO_SPORTS.find((s) => s.key === selectedSport) ?? CARDIO_SPORTS[0];

  return (
    <div className="px-4 pt-6 pb-8 space-y-4">
      {/* Sport picker */}
      <div>
        <p className="text-sm font-black text-white mb-3">בחר ספורט</p>
        <div className="grid grid-cols-4 gap-2">
          {CARDIO_SPORTS.map((s) => (
            <button
              key={s.key}
              onClick={() => setSelectedSport(s.key)}
              className={`flex flex-col items-center gap-1 rounded-2xl border py-3 px-1 transition-all active:scale-[0.95] ${
                selectedSport === s.key
                  ? "border-opacity-60 shadow-sm"
                  : "border-white/8 bg-white/5 hover:bg-white/8"
              }`}
              style={selectedSport === s.key
                ? { borderColor: s.color + "55", background: s.color + "18" }
                : {}}
            >
              <span className="text-xl">{s.emoji}</span>
              <span className="text-[9px] font-bold text-center leading-tight"
                style={{ color: selectedSport === s.key ? s.color : "rgba(255,255,255,0.45)" }}>
                {s.labelHe}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Sport-specific form */}
      {sport.key === "running"
        ? <RunningLogSection />
        : <OtherCardioLogSection sport={sport} />
      }
    </div>
  );
}

// ─── Progress Tab ─────────────────────────────────────────────────────────────
function ProgressTab() {
  const [subTab, setSubTab] = useState<"analytics" | "tracking">("analytics");

  return (
    <div className="px-4 pt-6 pb-8 space-y-5">
      {/* Segmented control */}
      <div className="flex gap-1 p-1 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl">
        {([
          { key: "analytics", label: "נתוני אימון"  },
          { key: "tracking",  label: "מעקב גוף"     },
        ] as const).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setSubTab(key)}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all duration-200 ${
              subTab === key
                ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30"
                : "text-white/40 hover:text-white/70"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {subTab === "analytics" && (
        <div className="space-y-4">
          <PRSection />
          <VolumeChart />
          <WorkoutHistoryGrouped />
        </div>
      )}

      {subTab === "tracking" && (
        <div className="space-y-4">
          <WeightChart />
          <BodyProgressGallery />
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════
function SportPage() {
  const [activeTab,        setActiveTab]        = useState<Tab>("dashboard");
  const [showAIConsultant, setShowAIConsultant] = useState(false);
  const [loadedTemplate,      setLoadedTemplate]      = useState<any>(null);
  const [pendingExercises,    setPendingExercises]    = useState<LibraryExercise[]>([]);
  const [libraryBuilderMode,  setLibraryBuilderMode]  = useState(false);
  const [pendingSSExercise,   setPendingSSExercise]   = useState<LibraryExercise | null>(null);
  const [pendingSSPair,       setPendingSSPair]       = useState<[LibraryExercise, LibraryExercise] | null>(null);

  const handleLoadTemplate = (t: any) => {
    setLoadedTemplate(t);
    setActiveTab("builder");
  };

  const handleAddExercisesToWorkout = (exs: LibraryExercise[]) => {
    setPendingExercises(exs);
    setLibraryBuilderMode(false);
    setActiveTab("builder");
  };

  const handleAddToWorkoutAsSS = (ex: LibraryExercise) => {
    setPendingSSExercise(ex);
    setLibraryBuilderMode(false);
    setActiveTab("builder");
  };

  const handleAddToWorkoutSSPair = (first: LibraryExercise, second: LibraryExercise) => {
    setPendingSSPair([first, second]);
    setLibraryBuilderMode(false);
    setActiveTab("builder");
  };

  return (
    <>
      <div
        className="-mx-3 md:-mx-6 -mt-3 md:-mt-6 relative bg-cover bg-center"
        style={{
          backgroundImage: `url('https://images.unsplash.com/photo-1517836357463-d25dfeac3438?q=80&w=2000&auto=format&fit=crop')`,
          minHeight: "100vh",
        }}
      >
        <div className="absolute inset-0 bg-black/40 pointer-events-none" />
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-24 -right-24 h-80 w-80 rounded-full bg-emerald-500/15 blur-[120px]" />
          <div className="absolute bottom-40 -left-16 h-60 w-60 rounded-full bg-blue-500/10 blur-[100px]" />
        </div>

        <div className="relative z-10 pb-32 pt-2">
          <SportWelcomeVideo />
          {/* Sticky Tab Bar */}
          <div className="sticky top-0 z-10 px-4 py-2 bg-black/25 backdrop-blur-xl">
            <div className="flex gap-1 p-1 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl">
              {TABS.map((t) => (
                <button key={t.key} onClick={() => { setActiveTab(t.key); if (t.key !== "library") setLibraryBuilderMode(false); }}
                  className={`flex-1 py-2 px-1 rounded-xl text-[11px] font-bold transition-all duration-200 ${
                    activeTab === t.key ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30" : "text-white/40 hover:text-white/70"}`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {activeTab === "dashboard" && (
            <div className="px-4 pt-8 pb-6 space-y-6">
              <div className="space-y-4">
                <QuickAddRow onLoadTemplate={handleLoadTemplate} />
              </div>
              <StatsStrip />
              <WeekStrip />
              {/* AI Consultant expandable panel */}
              {showAIConsultant && (
                <div className="relative">
                  <button
                    onClick={() => setShowAIConsultant(false)}
                    className="absolute top-3 left-3 z-10 h-7 w-7 rounded-full bg-black/50 flex items-center justify-center hover:bg-black/70 transition-colors"
                  >
                    <X className="h-3.5 w-3.5 text-white" />
                  </button>
                  <SportAIConsultant />
                </div>
              )}
              {/* Floating AI chat button */}
              {!showAIConsultant && (
                <button
                  onClick={() => setShowAIConsultant(true)}
                  className="fixed bottom-24 left-4 z-50 flex items-center gap-2 px-4 py-3 rounded-2xl bg-sport text-sport-foreground font-bold text-sm shadow-[0_0_24px_rgba(0,255,135,0.4)] hover:opacity-90 transition-opacity"
                >
                  <BrainCircuit className="h-4 w-4" />
                  שאל מאמן AI
                </button>
              )}
            </div>
          )}

          <div className={activeTab === "builder" ? "" : "hidden"}>
            <WorkoutBuilderTab
              externalTemplate={loadedTemplate}
              onExternalTemplateConsumed={() => setLoadedTemplate(null)}
              pendingExercises={pendingExercises}
              onPendingExercisesConsumed={() => setPendingExercises([])}
              pendingSSExercise={pendingSSExercise}
              onPendingSSExerciseConsumed={() => setPendingSSExercise(null)}
              pendingSSPair={pendingSSPair}
              onPendingSSPairConsumed={() => setPendingSSPair(null)}
              onWorkoutComplete={() => setActiveTab("dashboard")}
              onGoToLibrary={() => { setLibraryBuilderMode(true); setActiveTab("library"); }}
            />
          </div>
          {activeTab === "library" && (
            <ExerciseLibraryTab
              onAddToWorkout={handleAddExercisesToWorkout}
              onAddToWorkoutAsSS={handleAddToWorkoutAsSS}
              onAddToWorkoutSSPair={handleAddToWorkoutSSPair}
              selectionMode={libraryBuilderMode}
            />
          )}
          {activeTab === "running"  && <CardioTab />}
          {activeTab === "progress" && <ProgressTab />}
          {activeTab === "import"   && <HealthImport />}
        </div>
      </div>

      <style>{`
        @keyframes sportPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
        @keyframes confettiFall {
          0%   { transform: translateY(0) rotate(0deg)   scale(1);   opacity: 1; }
          80%  { opacity: 0.85; }
          100% { transform: translateY(105vh) rotate(560deg) scale(0.55); opacity: 0; }
        }
        @keyframes prBounce {
          0%   { transform: scale(0.35) translateY(24px); opacity: 0; }
          62%  { transform: scale(1.07) translateY(-5px); opacity: 1; }
          100% { transform: scale(1)    translateY(0);    opacity: 1; }
        }
        @keyframes prSpin {
          0%   { transform: rotate(-28deg) scale(0.5); }
          58%  { transform: rotate(12deg)  scale(1.22); }
          100% { transform: rotate(0deg)   scale(1); }
        }
      `}</style>
    </>
  );
}
