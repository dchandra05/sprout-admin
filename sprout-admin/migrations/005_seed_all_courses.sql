-- ============================================================
-- SPROUT ADMIN — MIGRATION 005
-- Seeds all active courses and their simulations.
-- Run in Supabase Dashboard → SQL Editor
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- COURSES
-- Update total_days to match your actual lesson counts.
-- ─────────────────────────────────────────────────────────────
INSERT INTO public.courses (slug, name, total_days, is_active)
VALUES
  ('ai-literacy',            'AI Literacy',                     10, true),
  ('budgeting-fundamentals', 'Budgeting Fundamentals',          10, true),
  ('banking-real-world',     'Banking in the Real World',       10, true),
  ('credit-debt-borrowing',  'Credit, Debt & Smart Borrowing',  10, true),
  ('investing-fundamentals', 'Investing Fundamentals',          10, true),
  ('saving-building-wealth', 'Saving & Building Wealth',        10, true)
ON CONFLICT (slug) DO UPDATE
  SET name       = EXCLUDED.name,
      total_days = EXCLUDED.total_days,
      is_active  = EXCLUDED.is_active;

-- ─────────────────────────────────────────────────────────────
-- SIMULATIONS
-- Simulations don't have day-based lessons; they are tracked
-- via user_activity_events with event_type = 'simulation_start'
-- or 'simulation_complete' and event_data->>'simulation_slug'.
-- This table is a registry for display names only.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.simulations (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug       TEXT        NOT NULL UNIQUE,
  name       TEXT        NOT NULL,
  category   TEXT,                       -- e.g. 'budgeting', 'investing'
  is_active  BOOLEAN     NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.simulations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "simulations_public_read" ON public.simulations;
CREATE POLICY "simulations_public_read" ON public.simulations
  FOR SELECT USING (true);

INSERT INTO public.simulations (slug, name, category, is_active)
VALUES
  ('build-your-first-budget',      'Build Your First Budget',      'budgeting',  true),
  ('college-student-budget',       'College Student Budget',       'budgeting',  true),
  ('new-graduate-budget',          'New Graduate Budget',          'budgeting',  true),
  ('early-career-dual-income',     'Early Career – Dual Income',   'budgeting',  true),
  ('mid-career-family-budget',     'Mid-Career Family Budget',     'budgeting',  true),
  ('paper-trading',                'Paper Trading',                'investing',  true),
  ('investment-growth-calculator', 'Investment Growth Calculator', 'investing',  true)
ON CONFLICT (slug) DO UPDATE
  SET name      = EXCLUDED.name,
      category  = EXCLUDED.category,
      is_active = EXCLUDED.is_active;
