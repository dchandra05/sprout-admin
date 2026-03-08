// sprout-admin/src/lib/adminApi.js
import { supabase } from "@/lib/supabaseClient";

// ─── KPI / Dashboard ─────────────────────────────────────────

export async function fetchKPIs() {
  const [totalRes, dauRes, wauRes, mauRes] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase
      .from("user_activity_events")
      .select("user_email", { count: "exact", head: true })
      .gte("created_at", new Date(Date.now() - 86_400_000).toISOString()),
    supabase
      .from("user_activity_events")
      .select("user_email", { count: "exact", head: true })
      .gte("created_at", new Date(Date.now() - 7 * 86_400_000).toISOString()),
    supabase
      .from("user_activity_events")
      .select("user_email", { count: "exact", head: true })
      .gte("created_at", new Date(Date.now() - 30 * 86_400_000).toISOString()),
  ]);

  return {
    totalUsers: totalRes.count ?? 0,
    dau:        dauRes.count  ?? 0,
    wau:        wauRes.count  ?? 0,
    mau:        mauRes.count  ?? 0,
  };
}

export async function fetchDailySignups(daysBack = 30) {
  const { data, error } = await supabase.rpc("get_daily_signups", { days_back: daysBack });
  if (error) throw error;
  return data ?? [];
}

export async function fetchDailyActiveUsers(daysBack = 30) {
  const { data, error } = await supabase.rpc("get_daily_active_users", { days_back: daysBack });
  if (error) throw error;
  return data ?? [];
}

// ─── Users ───────────────────────────────────────────────────

export async function fetchUsers() {
  const { data, error } = await supabase
    .from("admin_user_summary")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    // Fallback to direct profiles query if view not yet created
    const { data: fallback, error: fbErr } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });
    if (fbErr) throw fbErr;
    return fallback ?? [];
  }
  return data ?? [];
}

export async function fetchUserDetail(userId) {
  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (profileErr) throw profileErr;
  if (!profile) throw new Error("User not found");

  const [aiRes, activityRes, lessonRes] = await Promise.all([
    supabase
      .from("ai_course_day_progress")
      .select("*")
      .eq("user_email", profile.email)
      .order("day_number"),
    supabase
      .from("user_activity_events")
      .select("*")
      .eq("user_email", profile.email)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("user_lesson_progress")
      .select("*, courses(name, slug)")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false }),
  ]);

  return {
    profile,
    aiProgress:     aiRes.data      ?? [],
    activity:       activityRes.data ?? [],
    lessonProgress: lessonRes.data   ?? [],
  };
}

// ─── Courses ─────────────────────────────────────────────────

/**
 * Fetch all active courses from the courses table.
 * Returns an array of { id, slug, name, total_days }.
 */
export async function fetchCourses() {
  const { data, error } = await supabase
    .from("courses")
    .select("id, slug, name, total_days")
    .eq("is_active", true)
    .order("name");

  if (error) throw error;
  return data ?? [];
}

/**
 * Fetch per-day lesson stats for a specific course.
 * Uses user_lesson_progress (new schema).
 * Falls back to ai_course_day_progress for the AI Literacy course
 * if user_lesson_progress has no data yet.
 */
export async function fetchCourseStats(courseId, courseSlug, totalDays = 10) {
  // Try new schema first
  const { data: newData, error: newErr } = await supabase
    .from("user_lesson_progress")
    .select("day_number, status, quiz_score, user_id")
    .eq("course_id", courseId);

  if (!newErr && newData && newData.length > 0) {
    return _buildDayStats(newData, totalDays, {
      completedField: (r) => r.status === "completed",
      scoreField:     (r) => r.quiz_score,
    });
  }

  // Fallback: use legacy table for AI Literacy
  if (courseSlug === "ai-literacy") {
    const { data: legacyData, error: legacyErr } = await supabase
      .from("ai_course_day_progress")
      .select("day_number, completed, quiz_score, user_email");

    if (legacyErr) throw legacyErr;
    return _buildDayStats(legacyData ?? [], totalDays, {
      completedField: (r) => r.completed,
      scoreField:     (r) => r.quiz_score,
    });
  }

  // No data yet — return empty scaffolding
  return _buildDayStats([], totalDays, {
    completedField: () => false,
    scoreField:     () => null,
  });
}

function _buildDayStats(rows, totalDays, { completedField, scoreField }) {
  const byDay = {};
  for (const row of rows) {
    const d = row.day_number;
    if (!byDay[d]) byDay[d] = { day: d, attempts: 0, completions: 0, scores: [] };
    byDay[d].attempts++;
    if (completedField(row)) {
      byDay[d].completions++;
      const s = scoreField(row);
      if (s != null) byDay[d].scores.push(s);
    }
  }

  return Array.from({ length: totalDays }, (_, i) => {
    const d = byDay[i + 1] ?? { day: i + 1, attempts: 0, completions: 0, scores: [] };
    return {
      day:         d.day,
      label:       `Day ${d.day}`,
      attempts:    d.attempts,
      completions: d.completions,
      rate:        d.attempts > 0 ? Math.round((d.completions / d.attempts) * 100) : 0,
      avgScore:    d.scores.length > 0
        ? Math.round(d.scores.reduce((a, b) => a + b, 0) / d.scores.length)
        : null,
    };
  });
}

/**
 * Fetch enrollment numbers for a course.
 */
export async function fetchEnrolledCount(courseId, courseSlug) {
  // Try new schema
  const { count: newCount, error: newErr } = await supabase
    .from("user_course_progress")
    .select("id", { count: "exact", head: true })
    .eq("course_id", courseId);

  if (!newErr && newCount != null && newCount > 0) {
    const { count: completedCount } = await supabase
      .from("user_course_progress")
      .select("id", { count: "exact", head: true })
      .eq("course_id", courseId)
      .eq("percent_complete", 100);

    return { enrolled: newCount, completed: completedCount ?? 0 };
  }

  // Fallback for AI Literacy: count distinct users in legacy table
  if (courseSlug === "ai-literacy") {
    const { data } = await supabase
      .from("ai_course_day_progress")
      .select("user_email");

    const uniqueUsers = new Set((data ?? []).map((r) => r.user_email)).size;
    return { enrolled: uniqueUsers, completed: 0 };
  }

  return { enrolled: 0, completed: 0 };
}

// ─── Legacy: kept for backward compat with old Courses.jsx ──

export async function fetchAICourseStats() {
  // Re-use the new generic function pointed at ai-literacy
  const { data: courseRow } = await supabase
    .from("courses")
    .select("id, slug, total_days")
    .eq("slug", "ai-literacy")
    .maybeSingle();

  if (!courseRow) {
    // courses table empty — fall back to direct legacy query
    const { data, error } = await supabase
      .from("ai_course_day_progress")
      .select("day_number, completed, quiz_score, time_spent_minutes, user_email");
    if (error) throw error;
    return _buildDayStats(data ?? [], 10, {
      completedField: (r) => r.completed,
      scoreField:     (r) => r.quiz_score,
    });
  }

  return fetchCourseStats(courseRow.id, "ai-literacy", courseRow.total_days ?? 10);
}