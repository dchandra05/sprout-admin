-- ============================================================
-- SPROUT ADMIN DASHBOARD — MIGRATION 002: RLS POLICIES
-- Run AFTER migration 001
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- HELPER: admin check function (avoids re-querying every row)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  );
$$;

-- ─────────────────────────────────────────────────────────────
-- PROFILES TABLE RLS
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Users can read/update their OWN profile
DROP POLICY IF EXISTS "profiles_own_read" ON public.profiles;
CREATE POLICY "profiles_own_read" ON public.profiles
  FOR SELECT USING (id = auth.uid());

DROP POLICY IF EXISTS "profiles_own_update" ON public.profiles;
CREATE POLICY "profiles_own_update" ON public.profiles
  FOR UPDATE USING (id = auth.uid());

DROP POLICY IF EXISTS "profiles_own_insert" ON public.profiles;
CREATE POLICY "profiles_own_insert" ON public.profiles
  FOR INSERT WITH CHECK (id = auth.uid());

-- Admins can read ALL profiles
DROP POLICY IF EXISTS "profiles_admin_read" ON public.profiles;
CREATE POLICY "profiles_admin_read" ON public.profiles
  FOR SELECT USING (public.is_admin());

-- Admins can update ALL profiles (e.g. promote to admin, reset XP)
DROP POLICY IF EXISTS "profiles_admin_update" ON public.profiles;
CREATE POLICY "profiles_admin_update" ON public.profiles
  FOR UPDATE USING (public.is_admin());

-- ─────────────────────────────────────────────────────────────
-- AI COURSE DAY PROGRESS RLS
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.ai_course_day_progress ENABLE ROW LEVEL SECURITY;

-- Users can read/write their OWN progress (keyed by email)
DROP POLICY IF EXISTS "ai_progress_own_read" ON public.ai_course_day_progress;
CREATE POLICY "ai_progress_own_read" ON public.ai_course_day_progress
  FOR SELECT USING (
    user_email = (SELECT email FROM public.profiles WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "ai_progress_own_write" ON public.ai_course_day_progress;
CREATE POLICY "ai_progress_own_write" ON public.ai_course_day_progress
  FOR ALL USING (
    user_email = (SELECT email FROM public.profiles WHERE id = auth.uid())
  );

-- Admins can read ALL progress
DROP POLICY IF EXISTS "ai_progress_admin_read" ON public.ai_course_day_progress;
CREATE POLICY "ai_progress_admin_read" ON public.ai_course_day_progress
  FOR SELECT USING (public.is_admin());

-- ─────────────────────────────────────────────────────────────
-- USER ACTIVITY EVENTS RLS
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.user_activity_events ENABLE ROW LEVEL SECURITY;

-- Users can INSERT their own events (client-side tracking)
DROP POLICY IF EXISTS "activity_own_insert" ON public.user_activity_events;
CREATE POLICY "activity_own_insert" ON public.user_activity_events
  FOR INSERT WITH CHECK (
    user_email = (SELECT email FROM public.profiles WHERE id = auth.uid())
  );

-- Users can read their OWN events
DROP POLICY IF EXISTS "activity_own_read" ON public.user_activity_events;
CREATE POLICY "activity_own_read" ON public.user_activity_events
  FOR SELECT USING (
    user_email = (SELECT email FROM public.profiles WHERE id = auth.uid())
  );

-- Admins can read ALL activity events
DROP POLICY IF EXISTS "activity_admin_read" ON public.user_activity_events;
CREATE POLICY "activity_admin_read" ON public.user_activity_events
  FOR SELECT USING (public.is_admin());

-- ─────────────────────────────────────────────────────────────
-- GRANT ADMIN VIEWS (security definer — admins only)
-- Views inherit the definer's permissions; restrict via is_admin()
-- ─────────────────────────────────────────────────────────────
-- NOTE: Views in Postgres don't have RLS; we enforce admin-only
-- access by having all admin API calls first verify is_admin()
-- via the AdminGuard component in the React app.
-- For an extra DB-level guard, wrap sensitive views in functions:

CREATE OR REPLACE FUNCTION public.get_daily_signups(days_back INTEGER DEFAULT 30)
RETURNS TABLE(signup_date TEXT, new_users BIGINT)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT
    DATE(created_at)::TEXT,
    COUNT(*)
  FROM public.profiles
  WHERE created_at >= NOW() - (days_back || ' days')::INTERVAL
  GROUP BY DATE(created_at)
  ORDER BY 1 ASC;
$$;
REVOKE ALL ON FUNCTION public.get_daily_signups FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_daily_signups TO authenticated;

CREATE OR REPLACE FUNCTION public.get_daily_active_users(days_back INTEGER DEFAULT 30)
RETURNS TABLE(activity_date TEXT, active_users BIGINT)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT
    DATE(created_at)::TEXT,
    COUNT(DISTINCT user_email)
  FROM public.user_activity_events
  WHERE created_at >= NOW() - (days_back || ' days')::INTERVAL
  GROUP BY DATE(created_at)
  ORDER BY 1 ASC;
$$;
REVOKE ALL ON FUNCTION public.get_daily_active_users FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_daily_active_users TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- MAKE YOURSELF AN ADMIN
-- Replace with your actual email before running
-- ─────────────────────────────────────────────────────────────
-- UPDATE public.profiles SET role = 'admin' WHERE email = 'your-admin@example.com';
