-- ============================================================
-- SPROUT ADMIN DASHBOARD — MIGRATION 004
-- Creates the courses table (shared with main app) and seeds
-- the AI Literacy course so the Courses page has data to show.
-- Run in Supabase Dashboard → SQL Editor
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. COURSES TABLE
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.courses (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug       TEXT        NOT NULL UNIQUE,
  name       TEXT        NOT NULL,
  total_days INTEGER     NOT NULL DEFAULT 10,
  is_active  BOOLEAN     NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_courses_slug      ON public.courses(slug);
CREATE INDEX IF NOT EXISTS idx_courses_is_active ON public.courses(is_active);

-- Seed AI Literacy course (idempotent)
INSERT INTO public.courses (slug, name, total_days, is_active)
VALUES ('ai-literacy', 'AI Literacy', 10, true)
ON CONFLICT (slug) DO UPDATE
  SET name       = EXCLUDED.name,
      total_days = EXCLUDED.total_days,
      is_active  = EXCLUDED.is_active;

-- ─────────────────────────────────────────────────────────────
-- 2. USER LESSON PROGRESS TABLE (new schema, replaces ai_course_day_progress)
--    Keyed by (user_id, course_id, day_number) so it works for any course.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_lesson_progress (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id  UUID        NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  day_number INTEGER     NOT NULL,
  status     TEXT        NOT NULL DEFAULT 'not_started', -- 'not_started' | 'in_progress' | 'completed'
  quiz_score INTEGER,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, course_id, day_number)
);

CREATE INDEX IF NOT EXISTS idx_lesson_progress_user   ON public.user_lesson_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_lesson_progress_course ON public.user_lesson_progress(course_id);

DROP TRIGGER IF EXISTS user_lesson_progress_updated_at ON public.user_lesson_progress;
CREATE TRIGGER user_lesson_progress_updated_at
  BEFORE UPDATE ON public.user_lesson_progress
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─────────────────────────────────────────────────────────────
-- 3. USER COURSE PROGRESS TABLE
--    Tracks overall percent complete per user per course.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_course_progress (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id        UUID        NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  percent_complete INTEGER     NOT NULL DEFAULT 0 CHECK (percent_complete BETWEEN 0 AND 100),
  started_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at     TIMESTAMPTZ,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, course_id)
);

CREATE INDEX IF NOT EXISTS idx_course_progress_user   ON public.user_course_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_course_progress_course ON public.user_course_progress(course_id);

DROP TRIGGER IF EXISTS user_course_progress_updated_at ON public.user_course_progress;
CREATE TRIGGER user_course_progress_updated_at
  BEFORE UPDATE ON public.user_course_progress
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─────────────────────────────────────────────────────────────
-- 4. RLS FOR NEW TABLES
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "courses_public_read" ON public.courses;
CREATE POLICY "courses_public_read" ON public.courses
  FOR SELECT USING (true);

ALTER TABLE public.user_lesson_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lesson_progress_own" ON public.user_lesson_progress;
CREATE POLICY "lesson_progress_own" ON public.user_lesson_progress
  FOR ALL USING (user_id = auth.uid());

DROP POLICY IF EXISTS "lesson_progress_admin_read" ON public.user_lesson_progress;
CREATE POLICY "lesson_progress_admin_read" ON public.user_lesson_progress
  FOR SELECT USING (public.is_admin());

ALTER TABLE public.user_course_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "course_progress_own" ON public.user_course_progress;
CREATE POLICY "course_progress_own" ON public.user_course_progress
  FOR ALL USING (user_id = auth.uid());

DROP POLICY IF EXISTS "course_progress_admin_read" ON public.user_course_progress;
CREATE POLICY "course_progress_admin_read" ON public.user_course_progress
  FOR SELECT USING (public.is_admin());
