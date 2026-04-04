-- ============================================================
-- SPROUT ADMIN — MIGRATION 008
-- Fixes course slug mismatches, simulation registry, and
-- event type discrepancy between main app and admin trigger.
-- Idempotent: safe to re-run.
-- Run in Supabase Dashboard → SQL Editor
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. Fix course slug mismatches
--    sprout-dev courses.json uses different slugs than what
--    migration 005 seeded into Supabase.
-- ─────────────────────────────────────────────────────────────

-- banking-real-world → banking-modern-world (matches courses.json)
UPDATE public.courses
  SET slug = 'banking-modern-world',
      name = 'Banking in the Modern World',
      total_days = 8
  WHERE slug = 'banking-real-world';

-- credit-debt-borrowing → credit-debt-smart-borrowing (matches courses.json)
UPDATE public.courses
  SET slug = 'credit-debt-smart-borrowing',
      name = 'Credit, Debt & Smart Borrowing',
      total_days = 8
  WHERE slug = 'credit-debt-borrowing';

-- Fix total_days to match actual lesson counts in lessons.json
UPDATE public.courses SET total_days = 9  WHERE slug = 'investing-fundamentals';
UPDATE public.courses SET total_days = 8  WHERE slug = 'saving-building-wealth';
UPDATE public.courses SET total_days = 10 WHERE slug = 'budgeting-fundamentals';
-- AI Literacy stays at 10, already correct

-- ─────────────────────────────────────────────────────────────
-- 2. Fix simulation registry
--    The 5 budget "scenario" slugs in migration 005 were never
--    implemented as separate simulations in the main app.
--    The main app fires:
--      "budget-simulation"    (BudgetSimulation.jsx)
--      "paycheck-simulation"  (PaycheckSimulation.jsx)
--      "paper-trading"        (PaperTrading.jsx)        ← already correct
--      "investment-calculator" (InvestmentCalculator.jsx)
-- ─────────────────────────────────────────────────────────────

-- Remove the 5 scenario slugs that are never fired by the main app
DELETE FROM public.simulations
  WHERE slug IN (
    'build-your-first-budget',
    'college-student-budget',
    'new-graduate-budget',
    'early-career-dual-income',
    'mid-career-family-budget'
  );

-- Fix investment calculator slug mismatch
UPDATE public.simulations
  SET slug = 'investment-calculator',
      name = 'Investment Growth Calculator'
  WHERE slug = 'investment-growth-calculator';

-- Add the 2 missing simulation slugs
INSERT INTO public.simulations (slug, name, category, is_active)
VALUES
  ('budget-simulation',   'Budget Simulation',   'budgeting', true),
  ('paycheck-simulation', 'Paycheck Simulation', 'budgeting', true)
ON CONFLICT (slug) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- 3. Fix trigger function: accept BOTH event type spellings
--    The main app fires "lesson_completed" (with 'd').
--    Migration 007 only handled "lesson_complete" (no 'd').
--    This version accepts both to cover existing + new events.
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
  -- Accept both "lesson_complete" and "lesson_completed" spellings
  IF NEW.event_type NOT IN ('lesson_complete', 'lesson_completed') THEN
    RETURN NEW;
  END IF;

  v_day_num     := (NEW.event_data->>'day_number')::INTEGER;
  v_quiz_score  := (NEW.event_data->>'quiz_score')::INTEGER;
  v_lesson_type := COALESCE(NEW.event_data->>'lesson_type', 'lesson');

  -- Skip events missing required fields
  IF v_day_num IS NULL OR v_day_num < 1 OR NEW.event_data->>'course_slug' IS NULL THEN
    RETURN NEW;
  END IF;

  -- Resolve course UUID from slug
  SELECT id INTO v_course_id
    FROM public.courses
   WHERE slug = NEW.event_data->>'course_slug'
   LIMIT 1;
  IF v_course_id IS NULL THEN RETURN NEW; END IF;

  -- Resolve user UUID from email
  SELECT id INTO v_user_id
    FROM public.profiles
   WHERE email = NEW.user_email
   LIMIT 1;
  IF v_user_id IS NULL THEN RETURN NEW; END IF;

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

-- Re-attach trigger (DROP IF EXISTS is idempotent)
DROP TRIGGER IF EXISTS trg_sync_lesson_complete
  ON public.user_activity_events;

CREATE TRIGGER trg_sync_lesson_complete
  AFTER INSERT ON public.user_activity_events
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_lesson_complete_to_progress();

-- ─────────────────────────────────────────────────────────────
-- 4. Backfill: re-process all existing lesson_complete/d events
--    Uses both spellings. Idempotent via ON CONFLICT.
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
JOIN public.profiles p ON p.email = e.user_email
JOIN public.courses  c ON c.slug  = e.event_data->>'course_slug'
WHERE e.event_type IN ('lesson_complete', 'lesson_completed')
  AND (e.event_data->>'day_number')  IS NOT NULL
  AND (e.event_data->>'course_slug') IS NOT NULL
ON CONFLICT (user_id, course_id, day_number)
DO UPDATE SET
  status       = 'completed',
  quiz_score   = COALESCE(EXCLUDED.quiz_score,   user_lesson_progress.quiz_score),
  completed_at = COALESCE(user_lesson_progress.completed_at, EXCLUDED.completed_at),
  updated_at   = NOW();
