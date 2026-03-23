-- ============================================================
-- SPROUT ADMIN DASHBOARD — MIGRATION 001
-- Run this in the Supabase SQL editor (Dashboard > SQL Editor)
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. PROFILES TABLE
--    Ensure role, last_seen_at, and created_at columns exist
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role            TEXT    NOT NULL DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS last_seen_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS xp_points       INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS level           INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS current_streak  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS longest_streak  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_lessons_completed INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS school_id       TEXT,
  ADD COLUMN IF NOT EXISTS grade           TEXT,
  ADD COLUMN IF NOT EXISTS created_at      TIMESTAMPTZ DEFAULT NOW();

-- Index for role-based lookups
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_last_seen ON public.profiles(last_seen_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_profiles_created ON public.profiles(created_at DESC);

-- ─────────────────────────────────────────────────────────────
-- 2. USER ACTIVITY EVENTS TABLE
--    Tracks logins and lesson completions for DAU/WAU/MAU
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_activity_events (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email   TEXT        NOT NULL,
  event_type   TEXT        NOT NULL,  -- 'login' | 'lesson_complete' | 'page_view'
  event_data   JSONB       DEFAULT '{}'::jsonb,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_user_email ON public.user_activity_events(user_email);
CREATE INDEX IF NOT EXISTS idx_activity_created_at ON public.user_activity_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_event_type ON public.user_activity_events(event_type);

-- ─────────────────────────────────────────────────────────────
-- 3. AI COURSE DAY PROGRESS TABLE
--    Ensure it exists with all needed columns
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_course_day_progress (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email          TEXT        NOT NULL,
  day_number          INTEGER     NOT NULL CHECK (day_number BETWEEN 1 AND 10),
  completed           BOOLEAN     NOT NULL DEFAULT false,
  completed_date      TIMESTAMPTZ,
  activity_completed  BOOLEAN     DEFAULT false,
  quiz_score          INTEGER,
  time_spent_minutes  INTEGER,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_email, day_number)
);

CREATE INDEX IF NOT EXISTS idx_ai_progress_user ON public.ai_course_day_progress(user_email);
CREATE INDEX IF NOT EXISTS idx_ai_progress_completed ON public.ai_course_day_progress(completed, completed_date DESC);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ai_course_day_progress_updated_at ON public.ai_course_day_progress;
CREATE TRIGGER ai_course_day_progress_updated_at
  BEFORE UPDATE ON public.ai_course_day_progress
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─────────────────────────────────────────────────────────────
-- 4. ADMIN-ONLY ANALYTICS VIEWS
-- ─────────────────────────────────────────────────────────────

-- Daily new user signups (last 90 days)
CREATE OR REPLACE VIEW public.admin_daily_signups AS
SELECT
  DATE(created_at)::TEXT AS signup_date,
  COUNT(*)               AS new_users
FROM public.profiles
WHERE created_at >= NOW() - INTERVAL '90 days'
GROUP BY DATE(created_at)
ORDER BY signup_date ASC;

-- Daily active users (last 30 days) — unique users who had any event
CREATE OR REPLACE VIEW public.admin_daily_active_users AS
SELECT
  DATE(created_at)::TEXT AS activity_date,
  COUNT(DISTINCT user_email) AS active_users
FROM public.user_activity_events
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY activity_date ASC;

-- Per-user summary for the users list
CREATE OR REPLACE VIEW public.admin_user_summary AS
SELECT
  p.id,
  p.email,
  p.full_name,
  p.role,
  p.school_id,
  p.grade,
  p.xp_points,
  p.level,
  p.current_streak,
  p.total_lessons_completed,
  p.last_seen_at,
  p.created_at,
  COUNT(DISTINCT acdp.day_number) FILTER (WHERE acdp.completed) AS ai_days_completed
FROM public.profiles p
LEFT JOIN public.ai_course_day_progress acdp ON acdp.user_email = p.email
GROUP BY p.id, p.email, p.full_name, p.role, p.school_id, p.grade,
         p.xp_points, p.level, p.current_streak, p.total_lessons_completed,
         p.last_seen_at, p.created_at;

-- AI course completion stats per day number (for charts)
CREATE OR REPLACE VIEW public.admin_ai_course_stats AS
SELECT
  day_number,
  COUNT(*)                                      AS total_attempts,
  COUNT(*) FILTER (WHERE completed)             AS completions,
  ROUND(AVG(quiz_score) FILTER (WHERE completed), 1) AS avg_quiz_score,
  ROUND(AVG(time_spent_minutes) FILTER (WHERE completed), 0) AS avg_time_minutes
FROM public.ai_course_day_progress
GROUP BY day_number
ORDER BY day_number;
