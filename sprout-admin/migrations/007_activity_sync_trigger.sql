-- ============================================================
-- SPROUT ADMIN — MIGRATION 007
-- Activity-events → lesson-progress auto-sync trigger.
-- Idempotent: safe to run even if migrations 005 or 006 were skipped.
-- Run in Supabase Dashboard → SQL Editor
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. Ensure columns from migration 006 exist
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS tracking_type TEXT NOT NULL DEFAULT 'lesson'
  CHECK (tracking_type IN ('day', 'lesson'));

UPDATE public.courses SET tracking_type = 'day'
  WHERE slug = 'ai-literacy' AND tracking_type = 'lesson';

ALTER TABLE public.user_lesson_progress
  ADD COLUMN IF NOT EXISTS lesson_type TEXT NOT NULL DEFAULT 'lesson'
  CHECK (lesson_type IN ('lesson', 'quiz', 'exam', 'activity'));

-- Additional columns that activityTracker.js writes
ALTER TABLE public.user_lesson_progress
  ADD COLUMN IF NOT EXISTS xp_earned    INTEGER,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- ─────────────────────────────────────────────────────────────
-- 2. Indexes for fast lookups
-- ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_lesson_progress_course_status
  ON public.user_lesson_progress(course_id, status);

-- GIN index for JSONB lookups on event_data (used by admin fallback queries)
CREATE INDEX IF NOT EXISTS idx_activity_events_course_slug
  ON public.user_activity_events USING gin (event_data jsonb_path_ops);

-- ─────────────────────────────────────────────────────────────
-- 3. Trigger function: auto-sync lesson_complete events
--    into user_lesson_progress
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.sync_lesson_complete_to_progress()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_course_id   UUID;
  v_user_id     UUID;
  v_day_num     INTEGER;
  v_quiz_score  INTEGER;
  v_lesson_type TEXT;
BEGIN
  -- Only handle lesson_complete events; ignore everything else
  IF NEW.event_type <> 'lesson_complete' THEN
    RETURN NEW;
  END IF;

  -- Extract values from the JSONB payload
  v_day_num     := (NEW.event_data->>'day_number')::INTEGER;
  v_quiz_score  := (NEW.event_data->>'quiz_score')::INTEGER;   -- NULL if absent
  v_lesson_type := COALESCE(NEW.event_data->>'lesson_type', 'lesson');

  -- Skip events with missing required fields
  IF v_day_num IS NULL OR v_day_num < 1 OR NEW.event_data->>'course_slug' IS NULL THEN
    RETURN NEW;
  END IF;

  -- Resolve course UUID from slug
  SELECT id INTO v_course_id
    FROM public.courses
   WHERE slug = NEW.event_data->>'course_slug'
   LIMIT 1;

  IF v_course_id IS NULL THEN
    RETURN NEW; -- unknown slug, skip silently
  END IF;

  -- Resolve user UUID from email
  SELECT id INTO v_user_id
    FROM public.profiles
   WHERE email = NEW.user_email
   LIMIT 1;

  IF v_user_id IS NULL THEN
    RETURN NEW; -- user not in profiles yet, skip silently
  END IF;

  -- Upsert — never regress a completed status
  INSERT INTO public.user_lesson_progress
    (user_id, course_id, day_number, lesson_type, status,
     quiz_score, completed_at, updated_at)
  VALUES
    (v_user_id, v_course_id, v_day_num, v_lesson_type, 'completed',
     v_quiz_score, NEW.created_at, NOW())
  ON CONFLICT (user_id, course_id, day_number)
  DO UPDATE SET
    status       = 'completed',
    lesson_type  = EXCLUDED.lesson_type,
    quiz_score   = COALESCE(EXCLUDED.quiz_score, user_lesson_progress.quiz_score),
    completed_at = COALESCE(user_lesson_progress.completed_at, EXCLUDED.completed_at),
    updated_at   = NOW();

  RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 4. Attach trigger to user_activity_events (idempotent)
-- ─────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_sync_lesson_complete
  ON public.user_activity_events;

CREATE TRIGGER trg_sync_lesson_complete
  AFTER INSERT ON public.user_activity_events
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_lesson_complete_to_progress();

-- ─────────────────────────────────────────────────────────────
-- 5. Backfill: sync any existing lesson_complete events that
--    were inserted before this trigger existed.
--    Uses the same ON CONFLICT logic so it is fully idempotent.
-- ─────────────────────────────────────────────────────────────
INSERT INTO public.user_lesson_progress
  (user_id, course_id, day_number, lesson_type, status,
   quiz_score, completed_at, updated_at)
SELECT
  p.id                                                    AS user_id,
  c.id                                                    AS course_id,
  (e.event_data->>'day_number')::INTEGER                  AS day_number,
  COALESCE(e.event_data->>'lesson_type', 'lesson')        AS lesson_type,
  'completed'                                             AS status,
  (e.event_data->>'quiz_score')::INTEGER                  AS quiz_score,
  e.created_at                                            AS completed_at,
  NOW()                                                   AS updated_at
FROM public.user_activity_events e
JOIN public.profiles p ON p.email  = e.user_email
JOIN public.courses  c ON c.slug   = e.event_data->>'course_slug'
WHERE e.event_type = 'lesson_complete'
  AND (e.event_data->>'day_number')  IS NOT NULL
  AND (e.event_data->>'course_slug') IS NOT NULL
ON CONFLICT (user_id, course_id, day_number)
DO UPDATE SET
  status       = 'completed',
  quiz_score   = COALESCE(EXCLUDED.quiz_score,   user_lesson_progress.quiz_score),
  completed_at = COALESCE(user_lesson_progress.completed_at, EXCLUDED.completed_at),
  updated_at   = NOW();

-- ─────────────────────────────────────────────────────────────
-- 6. Refresh admin_lesson_summary view (picks up new columns)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.admin_lesson_summary AS
SELECT
  ulp.course_id,
  c.name          AS course_name,
  c.slug          AS course_slug,
  c.tracking_type,
  ulp.day_number  AS lesson_number,
  ulp.lesson_type,
  COUNT(*)                                                    AS attempts,
  COUNT(*) FILTER (WHERE ulp.status = 'completed')           AS completions,
  ROUND(
    COUNT(*) FILTER (WHERE ulp.status = 'completed') * 100.0
    / NULLIF(COUNT(*), 0)
  , 0)                                                       AS completion_rate,
  ROUND(
    AVG(ulp.quiz_score) FILTER (WHERE ulp.quiz_score IS NOT NULL),
  1)                                                         AS avg_quiz_score
FROM public.user_lesson_progress ulp
JOIN public.courses c ON c.id = ulp.course_id
GROUP BY
  ulp.course_id, c.name, c.slug, c.tracking_type,
  ulp.day_number, ulp.lesson_type
ORDER BY ulp.course_id, ulp.day_number;
