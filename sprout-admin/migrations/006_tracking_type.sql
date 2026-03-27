-- ============================================================
-- SPROUT ADMIN — MIGRATION 006
-- Adds tracking_type to courses and lesson_type to user_lesson_progress.
-- Run in Supabase Dashboard → SQL Editor
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. tracking_type on courses
--    'day'    → structured N-day curriculum (e.g. AI Literacy)
--    'lesson' → flexible lesson/quiz/exam format (all other courses)
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS tracking_type TEXT NOT NULL DEFAULT 'lesson'
  CHECK (tracking_type IN ('day', 'lesson'));

-- Only AI Literacy is day-based
UPDATE public.courses SET tracking_type = 'day' WHERE slug = 'ai-literacy';

-- ─────────────────────────────────────────────────────────────
-- 2. lesson_type on user_lesson_progress
--    Allows distinguishing a reading lesson vs a quiz vs an exam.
--    The main app should pass the type when calling trackLessonComplete().
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.user_lesson_progress
  ADD COLUMN IF NOT EXISTS lesson_type TEXT NOT NULL DEFAULT 'lesson'
  CHECK (lesson_type IN ('lesson', 'quiz', 'exam', 'activity'));

-- ─────────────────────────────────────────────────────────────
-- 3. Helpful view: per-lesson summary used by the admin Courses page
--    (no RLS needed — only admins can query via service role)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.admin_lesson_summary AS
SELECT
  ulp.course_id,
  c.name        AS course_name,
  c.slug        AS course_slug,
  c.tracking_type,
  ulp.day_number AS lesson_number,
  ulp.lesson_type,
  COUNT(*)                                          AS attempts,
  COUNT(*) FILTER (WHERE ulp.status = 'completed') AS completions,
  ROUND(
    COUNT(*) FILTER (WHERE ulp.status = 'completed') * 100.0
    / NULLIF(COUNT(*), 0)
  , 0)                                             AS completion_rate,
  ROUND(AVG(ulp.quiz_score) FILTER (WHERE ulp.quiz_score IS NOT NULL), 1) AS avg_quiz_score
FROM public.user_lesson_progress ulp
JOIN public.courses c ON c.id = ulp.course_id
GROUP BY ulp.course_id, c.name, c.slug, c.tracking_type, ulp.day_number, ulp.lesson_type
ORDER BY ulp.course_id, ulp.day_number;
