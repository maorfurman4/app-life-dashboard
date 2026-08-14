-- ============================================================
-- SETUP_DATABASE.sql
-- My Life Dashboard — Complete Idempotent Database Setup
-- ============================================================
-- HOW TO RUN:
--   1. Go to https://supabase.com → your project → SQL Editor
--   2. Click "New Query"
--   3. Paste this entire file
--   4. Click "Run"
--
-- SAFE TO RE-RUN: uses IF NOT EXISTS / DROP IF EXISTS throughout
-- ============================================================

-- ============================================================
-- SHARED TRIGGER FUNCTION
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;


-- ============================================================
-- USER_SETTINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.user_settings (
  id                          UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id                     UUID        NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name                   TEXT,
  date_of_birth               DATE,
  height_cm                   NUMERIC,
  weight_kg                   NUMERIC,
  daily_calories_goal         INTEGER     DEFAULT 2000,
  daily_protein_goal          NUMERIC     DEFAULT 120,
  daily_carbs_goal            NUMERIC     DEFAULT 250,
  daily_fat_goal              NUMERIC     DEFAULT 65,
  daily_water_glasses_goal    INTEGER     DEFAULT 8,
  weekly_workouts_goal        INTEGER     DEFAULT 4,
  weekly_minutes_goal         INTEGER     DEFAULT 200,
  weekly_calories_burn_goal   INTEGER     DEFAULT 2000,
  work_role                   TEXT        DEFAULT 'guard',
  hourly_rate                 NUMERIC     DEFAULT 57.48,
  shift_manager_rate          NUMERIC     DEFAULT 61.08,
  travel_allowance            NUMERIC     DEFAULT 22.60,
  briefing_allowance          NUMERIC     DEFAULT 13.58,
  shabbat_holiday_multiplier  NUMERIC     DEFAULT 1.5,
  union_deduction_pct         NUMERIC     DEFAULT 0.95,
  pension_deduction_pct       NUMERIC     DEFAULT 7.0,
  education_fund_pct          NUMERIC     DEFAULT 2.5,
  preferred_language          TEXT        DEFAULT 'he',
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- Column additions from later migrations
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS training_day_calories    INTEGER     DEFAULT 2400;
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS training_day_protein     NUMERIC     DEFAULT 160;
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS daily_water_ml           INTEGER     DEFAULT 2500;
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS shoulder_sensitivity     BOOLEAN     DEFAULT false;
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS base_hourly_rate         NUMERIC     DEFAULT 52.80;
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS alt_hourly_rate          NUMERIC     DEFAULT 56.20;
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS recovery_per_hour        NUMERIC     DEFAULT 1.51;
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS excellence_per_hour      NUMERIC     DEFAULT 3.17;
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS shabbat_hourly_rate      NUMERIC     DEFAULT 79.20;
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS travel_per_shift         NUMERIC     DEFAULT 22.60;
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS briefing_per_shift       NUMERIC     DEFAULT 13.58;
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS national_insurance_pct   NUMERIC     DEFAULT 1.15;
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS health_insurance_pct     NUMERIC     DEFAULT 0.86;
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS lunch_deduction          NUMERIC     DEFAULT 0;
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS union_national_deduction NUMERIC     DEFAULT 0;
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS harel_savings_pct        NUMERIC     DEFAULT 7.00;
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS harel_study_pct          NUMERIC     DEFAULT 2.50;
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS harel_travel_pct         NUMERIC     DEFAULT 5.00;
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS extra_harel_pct          NUMERIC     DEFAULT 7.00;
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS overtime_enabled         BOOLEAN     DEFAULT true;
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS income_sync_mode         TEXT        DEFAULT 'net';
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS savings_goal_pct         NUMERIC     DEFAULT 35;
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS hidden_modules           JSONB       DEFAULT '[]'::jsonb;
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS google_calendar_token    TEXT;
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS sport_favorites          JSONB       DEFAULT '[]'::jsonb;

DROP POLICY IF EXISTS "Users can view own settings"   ON public.user_settings;
DROP POLICY IF EXISTS "Users can insert own settings" ON public.user_settings;
DROP POLICY IF EXISTS "Users can update own settings" ON public.user_settings;
DROP POLICY IF EXISTS "Users can delete own settings" ON public.user_settings;
CREATE POLICY "Users can view own settings"   ON public.user_settings FOR SELECT USING       (auth.uid() = user_id);
CREATE POLICY "Users can insert own settings" ON public.user_settings FOR INSERT WITH CHECK  (auth.uid() = user_id);
CREATE POLICY "Users can update own settings" ON public.user_settings FOR UPDATE USING       (auth.uid() = user_id);
CREATE POLICY "Users can delete own settings" ON public.user_settings FOR DELETE USING       (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_user_settings_updated_at ON public.user_settings;
CREATE TRIGGER update_user_settings_updated_at
  BEFORE UPDATE ON public.user_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_user_settings_user ON public.user_settings(user_id);


-- ============================================================
-- USER_PROFILE  (onboarding data, PK = auth.users.id)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.user_profile (
  id                    UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name             TEXT,
  age                   INTEGER,
  gender                TEXT,
  city                  TEXT,
  height_cm             NUMERIC,
  weight_kg             NUMERIC,
  target_weight_kg      NUMERIC,
  physical_limitations  TEXT[]      DEFAULT '{}',
  sport_types           TEXT[]      DEFAULT '{}',
  sport_frequency       TEXT,
  sport_location        TEXT,
  sport_level           TEXT,
  interest_topics       TEXT[]      DEFAULT '{}',
  onboarding_completed  BOOLEAN     DEFAULT FALSE,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.user_profile ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.user_profile ADD COLUMN IF NOT EXISTS sport_goals          TEXT[]  DEFAULT '{}';
ALTER TABLE public.user_profile ADD COLUMN IF NOT EXISTS muscle_focus          TEXT[]  DEFAULT '{}';
ALTER TABLE public.user_profile ADD COLUMN IF NOT EXISTS diet_type             TEXT;
ALTER TABLE public.user_profile ADD COLUMN IF NOT EXISTS food_allergies        TEXT[]  DEFAULT '{}';
ALTER TABLE public.user_profile ADD COLUMN IF NOT EXISTS macro_preference      TEXT;
ALTER TABLE public.user_profile ADD COLUMN IF NOT EXISTS monthly_income        NUMERIC;
ALTER TABLE public.user_profile ADD COLUMN IF NOT EXISTS monthly_budget        NUMERIC;
ALTER TABLE public.user_profile ADD COLUMN IF NOT EXISTS savings_goal_percent  INTEGER;
ALTER TABLE public.user_profile ADD COLUMN IF NOT EXISTS invests_in_market     BOOLEAN DEFAULT FALSE;
ALTER TABLE public.user_profile ADD COLUMN IF NOT EXISTS investment_types      TEXT[]  DEFAULT '{}';
ALTER TABLE public.user_profile ADD COLUMN IF NOT EXISTS investment_level      TEXT;

DROP POLICY IF EXISTS "Users can manage own profile" ON public.user_profile;
CREATE POLICY "Users can manage own profile"
  ON public.user_profile FOR ALL
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Auto-create profile row on new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.user_profile (id, full_name)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      ''
    )
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ============================================================
-- WORKOUTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.workouts (
  id               UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id          UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date             DATE        NOT NULL DEFAULT CURRENT_DATE,
  category         TEXT        NOT NULL,
  duration_minutes INTEGER,
  calories_burned  INTEGER,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.workouts ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.workouts DROP CONSTRAINT IF EXISTS workouts_category_check;
ALTER TABLE public.workouts ADD  CONSTRAINT workouts_category_check
  CHECK (category IN ('calisthenics','running','mixed','weights'));

DROP POLICY IF EXISTS "Users can view own workouts"   ON public.workouts;
DROP POLICY IF EXISTS "Users can insert own workouts" ON public.workouts;
DROP POLICY IF EXISTS "Users can update own workouts" ON public.workouts;
DROP POLICY IF EXISTS "Users can delete own workouts" ON public.workouts;
CREATE POLICY "Users can view own workouts"   ON public.workouts FOR SELECT USING      (auth.uid() = user_id);
CREATE POLICY "Users can insert own workouts" ON public.workouts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own workouts" ON public.workouts FOR UPDATE USING      (auth.uid() = user_id);
CREATE POLICY "Users can delete own workouts" ON public.workouts FOR DELETE USING      (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_workouts_updated_at ON public.workouts;
CREATE TRIGGER update_workouts_updated_at
  BEFORE UPDATE ON public.workouts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_workouts_user_date ON public.workouts(user_id, date);


-- ============================================================
-- WORKOUT_EXERCISES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.workout_exercises (
  id         UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workout_id UUID        NOT NULL REFERENCES public.workouts(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT        NOT NULL,
  sets       INTEGER,
  reps       INTEGER,
  weight_kg  NUMERIC,
  notes      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.workout_exercises ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own exercises"   ON public.workout_exercises;
DROP POLICY IF EXISTS "Users can insert own exercises" ON public.workout_exercises;
DROP POLICY IF EXISTS "Users can update own exercises" ON public.workout_exercises;
DROP POLICY IF EXISTS "Users can delete own exercises" ON public.workout_exercises;
CREATE POLICY "Users can view own exercises"   ON public.workout_exercises FOR SELECT USING      (auth.uid() = user_id);
CREATE POLICY "Users can insert own exercises" ON public.workout_exercises FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own exercises" ON public.workout_exercises FOR UPDATE USING      (auth.uid() = user_id);
CREATE POLICY "Users can delete own exercises" ON public.workout_exercises FOR DELETE USING      (auth.uid() = user_id);


-- ============================================================
-- WORKOUT_RUNS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.workout_runs (
  id               UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workout_id       UUID        NOT NULL REFERENCES public.workouts(id) ON DELETE CASCADE,
  user_id          UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  distance_km      NUMERIC,
  duration_minutes INTEGER,
  pace_per_km      NUMERIC,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.workout_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own runs"   ON public.workout_runs;
DROP POLICY IF EXISTS "Users can insert own runs" ON public.workout_runs;
DROP POLICY IF EXISTS "Users can update own runs" ON public.workout_runs;
DROP POLICY IF EXISTS "Users can delete own runs" ON public.workout_runs;
CREATE POLICY "Users can view own runs"   ON public.workout_runs FOR SELECT USING      (auth.uid() = user_id);
CREATE POLICY "Users can insert own runs" ON public.workout_runs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own runs" ON public.workout_runs FOR UPDATE USING      (auth.uid() = user_id);
CREATE POLICY "Users can delete own runs" ON public.workout_runs FOR DELETE USING      (auth.uid() = user_id);


-- ============================================================
-- WEIGHT_ENTRIES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.weight_entries (
  id         UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date       DATE        NOT NULL DEFAULT CURRENT_DATE,
  weight_kg  NUMERIC     NOT NULL,
  notes      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, date)
);
ALTER TABLE public.weight_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own weight"   ON public.weight_entries;
DROP POLICY IF EXISTS "Users can insert own weight" ON public.weight_entries;
DROP POLICY IF EXISTS "Users can update own weight" ON public.weight_entries;
DROP POLICY IF EXISTS "Users can delete own weight" ON public.weight_entries;
CREATE POLICY "Users can view own weight"   ON public.weight_entries FOR SELECT USING      (auth.uid() = user_id);
CREATE POLICY "Users can insert own weight" ON public.weight_entries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own weight" ON public.weight_entries FOR UPDATE USING      (auth.uid() = user_id);
CREATE POLICY "Users can delete own weight" ON public.weight_entries FOR DELETE USING      (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_weight_user_date ON public.weight_entries(user_id, date DESC);


-- ============================================================
-- BODY_PROGRESS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.body_progress (
  id         UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  photo_url  TEXT        NOT NULL,
  date       DATE        NOT NULL DEFAULT CURRENT_DATE,
  notes      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.body_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own body progress"   ON public.body_progress;
DROP POLICY IF EXISTS "Users can insert own body progress" ON public.body_progress;
DROP POLICY IF EXISTS "Users can update own body progress" ON public.body_progress;
DROP POLICY IF EXISTS "Users can delete own body progress" ON public.body_progress;
CREATE POLICY "Users can view own body progress"   ON public.body_progress FOR SELECT USING      (auth.uid() = user_id);
CREATE POLICY "Users can insert own body progress" ON public.body_progress FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own body progress" ON public.body_progress FOR UPDATE USING      (auth.uid() = user_id);
CREATE POLICY "Users can delete own body progress" ON public.body_progress FOR DELETE USING      (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_body_progress_user_date ON public.body_progress(user_id, date DESC);


-- ============================================================
-- PERSONAL_RECORDS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.personal_records (
  id            UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exercise_name TEXT        NOT NULL,
  category      TEXT        NOT NULL DEFAULT 'calisthenics',
  value         NUMERIC     NOT NULL,
  unit          TEXT        NOT NULL DEFAULT 'reps',
  date          DATE        NOT NULL DEFAULT CURRENT_DATE,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.personal_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own PRs"   ON public.personal_records;
DROP POLICY IF EXISTS "Users can insert own PRs" ON public.personal_records;
DROP POLICY IF EXISTS "Users can update own PRs" ON public.personal_records;
DROP POLICY IF EXISTS "Users can delete own PRs" ON public.personal_records;
CREATE POLICY "Users can view own PRs"   ON public.personal_records FOR SELECT USING      (auth.uid() = user_id);
CREATE POLICY "Users can insert own PRs" ON public.personal_records FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own PRs" ON public.personal_records FOR UPDATE USING      (auth.uid() = user_id);
CREATE POLICY "Users can delete own PRs" ON public.personal_records FOR DELETE USING      (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_personal_records_updated_at ON public.personal_records;
CREATE TRIGGER update_personal_records_updated_at
  BEFORE UPDATE ON public.personal_records
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_pr_user_exercise ON public.personal_records(user_id, exercise_name);


-- ============================================================
-- WORKOUT_TEMPLATES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.workout_templates (
  id                         UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id                    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name                       TEXT        NOT NULL,
  category                   TEXT        NOT NULL,
  exercises                  JSONB       NOT NULL DEFAULT '[]'::jsonb,
  estimated_duration_minutes INTEGER,
  estimated_calories         INTEGER,
  notes                      TEXT,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.workout_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own templates"   ON public.workout_templates;
DROP POLICY IF EXISTS "Users can insert own templates" ON public.workout_templates;
DROP POLICY IF EXISTS "Users can update own templates" ON public.workout_templates;
DROP POLICY IF EXISTS "Users can delete own templates" ON public.workout_templates;
CREATE POLICY "Users can view own templates"   ON public.workout_templates FOR SELECT USING      (auth.uid() = user_id);
CREATE POLICY "Users can insert own templates" ON public.workout_templates FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own templates" ON public.workout_templates FOR UPDATE USING      (auth.uid() = user_id);
CREATE POLICY "Users can delete own templates" ON public.workout_templates FOR DELETE USING      (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_workout_templates_updated_at ON public.workout_templates;
CREATE TRIGGER update_workout_templates_updated_at
  BEFORE UPDATE ON public.workout_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- ============================================================
-- NUTRITION_ENTRIES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.nutrition_entries (
  id         UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date       DATE        NOT NULL DEFAULT CURRENT_DATE,
  meal_type  TEXT        NOT NULL,
  name       TEXT        NOT NULL,
  calories   INTEGER,
  protein_g  NUMERIC,
  carbs_g    NUMERIC,
  fat_g      NUMERIC,
  notes      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.nutrition_entries ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.nutrition_entries DROP CONSTRAINT IF EXISTS nutrition_entries_meal_type_check;
ALTER TABLE public.nutrition_entries ADD  CONSTRAINT nutrition_entries_meal_type_check
  CHECK (meal_type IN ('breakfast','lunch','dinner','snack'));

DROP POLICY IF EXISTS "Users can view own nutrition"   ON public.nutrition_entries;
DROP POLICY IF EXISTS "Users can insert own nutrition" ON public.nutrition_entries;
DROP POLICY IF EXISTS "Users can update own nutrition" ON public.nutrition_entries;
DROP POLICY IF EXISTS "Users can delete own nutrition" ON public.nutrition_entries;
CREATE POLICY "Users can view own nutrition"   ON public.nutrition_entries FOR SELECT USING      (auth.uid() = user_id);
CREATE POLICY "Users can insert own nutrition" ON public.nutrition_entries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own nutrition" ON public.nutrition_entries FOR UPDATE USING      (auth.uid() = user_id);
CREATE POLICY "Users can delete own nutrition" ON public.nutrition_entries FOR DELETE USING      (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_nutrition_updated_at ON public.nutrition_entries;
CREATE TRIGGER update_nutrition_updated_at
  BEFORE UPDATE ON public.nutrition_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_nutrition_user_date ON public.nutrition_entries(user_id, date);


-- ============================================================
-- WATER_ENTRIES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.water_entries (
  id         UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date       DATE        NOT NULL DEFAULT CURRENT_DATE,
  glasses    INTEGER     NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.water_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own water"   ON public.water_entries;
DROP POLICY IF EXISTS "Users can insert own water" ON public.water_entries;
DROP POLICY IF EXISTS "Users can update own water" ON public.water_entries;
DROP POLICY IF EXISTS "Users can delete own water" ON public.water_entries;
CREATE POLICY "Users can view own water"   ON public.water_entries FOR SELECT USING      (auth.uid() = user_id);
CREATE POLICY "Users can insert own water" ON public.water_entries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own water" ON public.water_entries FOR UPDATE USING      (auth.uid() = user_id);
CREATE POLICY "Users can delete own water" ON public.water_entries FOR DELETE USING      (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_water_user_date ON public.water_entries(user_id, date);


-- ============================================================
-- FAVORITE_MEALS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.favorite_meals (
  id         UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT        NOT NULL,
  calories   INTEGER,
  protein_g  NUMERIC,
  carbs_g    NUMERIC,
  fat_g      NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.favorite_meals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own favorites"   ON public.favorite_meals;
DROP POLICY IF EXISTS "Users can insert own favorites" ON public.favorite_meals;
DROP POLICY IF EXISTS "Users can update own favorites" ON public.favorite_meals;
DROP POLICY IF EXISTS "Users can delete own favorites" ON public.favorite_meals;
CREATE POLICY "Users can view own favorites"   ON public.favorite_meals FOR SELECT USING      (auth.uid() = user_id);
CREATE POLICY "Users can insert own favorites" ON public.favorite_meals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own favorites" ON public.favorite_meals FOR UPDATE USING      (auth.uid() = user_id);
CREATE POLICY "Users can delete own favorites" ON public.favorite_meals FOR DELETE USING      (auth.uid() = user_id);


-- ============================================================
-- INCOME_ENTRIES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.income_entries (
  id          UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date        DATE        NOT NULL DEFAULT CURRENT_DATE,
  amount      NUMERIC     NOT NULL,
  category    TEXT        NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.income_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.income_entries ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual';

DROP POLICY IF EXISTS "Users can view own income"   ON public.income_entries;
DROP POLICY IF EXISTS "Users can insert own income" ON public.income_entries;
DROP POLICY IF EXISTS "Users can update own income" ON public.income_entries;
DROP POLICY IF EXISTS "Users can delete own income" ON public.income_entries;
CREATE POLICY "Users can view own income"   ON public.income_entries FOR SELECT USING      (auth.uid() = user_id);
CREATE POLICY "Users can insert own income" ON public.income_entries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own income" ON public.income_entries FOR UPDATE USING      (auth.uid() = user_id);
CREATE POLICY "Users can delete own income" ON public.income_entries FOR DELETE USING      (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_income_updated_at ON public.income_entries;
CREATE TRIGGER update_income_updated_at
  BEFORE UPDATE ON public.income_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_income_user_date ON public.income_entries(user_id, date);


-- ============================================================
-- EXPENSE_ENTRIES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.expense_entries (
  id           UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date         DATE        NOT NULL DEFAULT CURRENT_DATE,
  amount       NUMERIC     NOT NULL,
  category     TEXT        NOT NULL,
  description  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.expense_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_entries ADD COLUMN IF NOT EXISTS expense_type  TEXT    NOT NULL DEFAULT 'variable';
ALTER TABLE public.expense_entries ADD COLUMN IF NOT EXISTS is_recurring  BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.expense_entries ADD COLUMN IF NOT EXISTS needs_review  BOOLEAN NOT NULL DEFAULT false;

DROP POLICY IF EXISTS "Users can view own expenses"   ON public.expense_entries;
DROP POLICY IF EXISTS "Users can insert own expenses" ON public.expense_entries;
DROP POLICY IF EXISTS "Users can update own expenses" ON public.expense_entries;
DROP POLICY IF EXISTS "Users can delete own expenses" ON public.expense_entries;
CREATE POLICY "Users can view own expenses"   ON public.expense_entries FOR SELECT USING      (auth.uid() = user_id);
CREATE POLICY "Users can insert own expenses" ON public.expense_entries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own expenses" ON public.expense_entries FOR UPDATE USING      (auth.uid() = user_id);
CREATE POLICY "Users can delete own expenses" ON public.expense_entries FOR DELETE USING      (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_expenses_updated_at ON public.expense_entries;
CREATE TRIGGER update_expenses_updated_at
  BEFORE UPDATE ON public.expense_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_expenses_user_date ON public.expense_entries(user_id, date);


-- ============================================================
-- FIXED_EXPENSES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.fixed_expenses (
  id           UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name         TEXT        NOT NULL,
  amount       NUMERIC     NOT NULL,
  category     TEXT        NOT NULL DEFAULT 'אחר',
  charge_day   INTEGER     NOT NULL DEFAULT 1,
  is_active    BOOLEAN     NOT NULL DEFAULT true,
  is_recurring BOOLEAN     NOT NULL DEFAULT true,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.fixed_expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own fixed expenses"   ON public.fixed_expenses;
DROP POLICY IF EXISTS "Users can insert own fixed expenses" ON public.fixed_expenses;
DROP POLICY IF EXISTS "Users can update own fixed expenses" ON public.fixed_expenses;
DROP POLICY IF EXISTS "Users can delete own fixed expenses" ON public.fixed_expenses;
CREATE POLICY "Users can view own fixed expenses"   ON public.fixed_expenses FOR SELECT USING      (auth.uid() = user_id);
CREATE POLICY "Users can insert own fixed expenses" ON public.fixed_expenses FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own fixed expenses" ON public.fixed_expenses FOR UPDATE USING      (auth.uid() = user_id);
CREATE POLICY "Users can delete own fixed expenses" ON public.fixed_expenses FOR DELETE USING      (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_fixed_expenses_updated_at ON public.fixed_expenses;
CREATE TRIGGER update_fixed_expenses_updated_at
  BEFORE UPDATE ON public.fixed_expenses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- ============================================================
-- EXPENSE_CATEGORIES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.expense_categories (
  id           UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name         TEXT        NOT NULL,
  icon         TEXT,
  budget_limit NUMERIC,
  sort_order   INTEGER     NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own categories"   ON public.expense_categories;
DROP POLICY IF EXISTS "Users can insert own categories" ON public.expense_categories;
DROP POLICY IF EXISTS "Users can update own categories" ON public.expense_categories;
DROP POLICY IF EXISTS "Users can delete own categories" ON public.expense_categories;
CREATE POLICY "Users can view own categories"   ON public.expense_categories FOR SELECT USING      (auth.uid() = user_id);
CREATE POLICY "Users can insert own categories" ON public.expense_categories FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own categories" ON public.expense_categories FOR UPDATE USING      (auth.uid() = user_id);
CREATE POLICY "Users can delete own categories" ON public.expense_categories FOR DELETE USING      (auth.uid() = user_id);


-- ============================================================
-- WORK_SHIFTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.work_shifts (
  id                UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id           UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date              DATE        NOT NULL DEFAULT CURRENT_DATE,
  start_time        TIME,
  end_time          TIME,
  hours             NUMERIC,
  type              TEXT        NOT NULL DEFAULT 'morning',
  role              TEXT        NOT NULL DEFAULT 'guard',
  is_shabbat_holiday BOOLEAN    NOT NULL DEFAULT false,
  actual_salary     NUMERIC,
  has_briefing      BOOLEAN     NOT NULL DEFAULT false,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.work_shifts ENABLE ROW LEVEL SECURITY;

-- Ensure all extra columns exist (no-op if already created above)
ALTER TABLE public.work_shifts ADD COLUMN IF NOT EXISTS role               TEXT    NOT NULL DEFAULT 'guard';
ALTER TABLE public.work_shifts ADD COLUMN IF NOT EXISTS is_shabbat_holiday BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.work_shifts ADD COLUMN IF NOT EXISTS actual_salary      NUMERIC;
ALTER TABLE public.work_shifts ADD COLUMN IF NOT EXISTS has_briefing       BOOLEAN NOT NULL DEFAULT false;

-- Replace type constraint with the correct shift types
ALTER TABLE public.work_shifts DROP CONSTRAINT IF EXISTS work_shifts_type_check;
ALTER TABLE public.work_shifts ADD  CONSTRAINT work_shifts_type_check
  CHECK (type IN ('morning','afternoon','night','long_morning','long_night','briefing','vacation','sick'));

-- Replace role constraint
ALTER TABLE public.work_shifts DROP CONSTRAINT IF EXISTS work_shifts_role_check;
ALTER TABLE public.work_shifts ADD  CONSTRAINT work_shifts_role_check
  CHECK (role IN ('guard','shift_manager'));

DROP POLICY IF EXISTS "Users can view own shifts"   ON public.work_shifts;
DROP POLICY IF EXISTS "Users can insert own shifts" ON public.work_shifts;
DROP POLICY IF EXISTS "Users can update own shifts" ON public.work_shifts;
DROP POLICY IF EXISTS "Users can delete own shifts" ON public.work_shifts;
CREATE POLICY "Users can view own shifts"   ON public.work_shifts FOR SELECT USING      (auth.uid() = user_id);
CREATE POLICY "Users can insert own shifts" ON public.work_shifts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own shifts" ON public.work_shifts FOR UPDATE USING      (auth.uid() = user_id);
CREATE POLICY "Users can delete own shifts" ON public.work_shifts FOR DELETE USING      (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_shifts_updated_at ON public.work_shifts;
CREATE TRIGGER update_shifts_updated_at
  BEFORE UPDATE ON public.work_shifts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_shifts_user_date ON public.work_shifts(user_id, date);


-- ============================================================
-- STOCK_HOLDINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.stock_holdings (
  id         UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol     TEXT        NOT NULL,
  name       TEXT,
  shares     NUMERIC     NOT NULL,
  avg_price  NUMERIC     NOT NULL,
  currency   TEXT        NOT NULL DEFAULT 'USD',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.stock_holdings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own holdings"   ON public.stock_holdings;
DROP POLICY IF EXISTS "Users can insert own holdings" ON public.stock_holdings;
DROP POLICY IF EXISTS "Users can update own holdings" ON public.stock_holdings;
DROP POLICY IF EXISTS "Users can delete own holdings" ON public.stock_holdings;
CREATE POLICY "Users can view own holdings"   ON public.stock_holdings FOR SELECT USING      (auth.uid() = user_id);
CREATE POLICY "Users can insert own holdings" ON public.stock_holdings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own holdings" ON public.stock_holdings FOR UPDATE USING      (auth.uid() = user_id);
CREATE POLICY "Users can delete own holdings" ON public.stock_holdings FOR DELETE USING      (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_holdings_updated_at ON public.stock_holdings;
CREATE TRIGGER update_holdings_updated_at
  BEFORE UPDATE ON public.stock_holdings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_holdings_user ON public.stock_holdings(user_id);


-- ============================================================
-- MARKET_WATCHLIST
-- ============================================================
CREATE TABLE IF NOT EXISTS public.market_watchlist (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol     TEXT        NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, symbol)
);
ALTER TABLE public.market_watchlist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own watchlist" ON public.market_watchlist;
CREATE POLICY "Users manage own watchlist" ON public.market_watchlist
  FOR ALL
  USING      (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_watchlist_user ON public.market_watchlist(user_id);


-- ============================================================
-- MARKET_ALERTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.market_alerts (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol       TEXT        NOT NULL,
  target_price NUMERIC     NOT NULL,
  direction    TEXT        NOT NULL,
  is_triggered BOOLEAN     NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.market_alerts ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.market_alerts DROP CONSTRAINT IF EXISTS market_alerts_direction_check;
ALTER TABLE public.market_alerts ADD  CONSTRAINT market_alerts_direction_check
  CHECK (direction IN ('above','below'));

DROP POLICY IF EXISTS "Users manage own alerts" ON public.market_alerts;
CREATE POLICY "Users manage own alerts" ON public.market_alerts
  FOR ALL
  USING      (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_alerts_user ON public.market_alerts(user_id);


-- ============================================================
-- COUPONS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.coupons (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  title            TEXT        NOT NULL,
  code             TEXT,
  barcode          TEXT,
  store            TEXT,
  discount_amount  NUMERIC,
  discount_percent NUMERIC,
  expiry_date      DATE,
  category         TEXT        DEFAULT 'אחר',
  is_used          BOOLEAN     DEFAULT FALSE,
  image_url        TEXT,
  notes            TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS used_at TIMESTAMPTZ;

DROP POLICY IF EXISTS "Users manage own coupons" ON public.coupons;
CREATE POLICY "Users manage own coupons" ON public.coupons
  FOR ALL
  USING      (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_coupons_user_id ON public.coupons(user_id);
CREATE INDEX IF NOT EXISTS idx_coupons_expiry   ON public.coupons(expiry_date);
CREATE INDEX IF NOT EXISTS idx_coupons_used_at  ON public.coupons(user_id, used_at) WHERE used_at IS NOT NULL;


-- ============================================================
-- TASK_PROJECTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.task_projects (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name       TEXT        NOT NULL,
  color      TEXT        DEFAULT '#6366f1',
  icon       TEXT,
  sort_order INT         DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.task_projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own projects" ON public.task_projects;
CREATE POLICY "Users manage own projects" ON public.task_projects
  FOR ALL
  USING      (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_task_projects_user_id ON public.task_projects(user_id);


-- ============================================================
-- TASKS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.tasks (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  project_id   UUID        REFERENCES public.task_projects(id) ON DELETE SET NULL,
  title        TEXT        NOT NULL,
  description  TEXT,
  status       TEXT        DEFAULT 'pending',
  priority     TEXT        DEFAULT 'medium',
  due_date     DATE,
  completed_at TIMESTAMPTZ,
  sort_order   INT         DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own tasks" ON public.tasks;
CREATE POLICY "Users manage own tasks" ON public.tasks
  FOR ALL
  USING      (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON public.tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status  ON public.tasks(user_id, status);


-- ============================================================
-- GROCERY_LISTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.grocery_lists (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name       TEXT        NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.grocery_lists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own grocery lists" ON public.grocery_lists;
CREATE POLICY "Users manage own grocery lists" ON public.grocery_lists
  FOR ALL
  USING      (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_grocery_lists_user ON public.grocery_lists(user_id);


-- ============================================================
-- GROCERY_ITEMS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.grocery_items (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id    UUID        REFERENCES public.grocery_lists(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name       TEXT        NOT NULL,
  quantity   NUMERIC     DEFAULT 1,
  unit       TEXT,
  barcode    TEXT,
  is_checked BOOLEAN     DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.grocery_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own grocery items" ON public.grocery_items;
CREATE POLICY "Users manage own grocery items" ON public.grocery_items
  FOR ALL
  USING      (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_grocery_items_list ON public.grocery_items(list_id);


-- ============================================================
-- STORAGE: body-progress bucket
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('body-progress', 'body-progress', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Users can upload own body photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own body photos"   ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own body photos" ON storage.objects;
CREATE POLICY "Users can upload own body photos" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'body-progress' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can view own body photos" ON storage.objects
  FOR SELECT USING (bucket_id = 'body-progress' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete own body photos" ON storage.objects
  FOR DELETE USING (bucket_id = 'body-progress' AND auth.uid()::text = (storage.foldername(name))[1]);


-- ============================================================
-- DONE — all 20 tables created / updated
-- Tables: user_settings, user_profile, workouts, workout_exercises,
--         workout_runs, weight_entries, body_progress, personal_records,
--         workout_templates, nutrition_entries, water_entries,
--         favorite_meals, income_entries, expense_entries, fixed_expenses,
--         expense_categories, work_shifts, stock_holdings,
--         market_watchlist, market_alerts, coupons,
--         task_projects, tasks, grocery_lists, grocery_items
-- ============================================================
