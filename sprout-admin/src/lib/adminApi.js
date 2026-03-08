// sprout-admin/src/lib/adminApi.js
import { supabase } from "@/lib/supabaseClient";

// ─── KPI Overview ────────────────────────────────────────────

export async function fetchKPIs() {
  const [usersRes, activityRes, aiRes] = await Promise.all([
    supabase.from("profiles").select("id, created_at, last_seen_at"),
    supabase
      .from("user_activity_events")
      .select("user_email, created_at")
      .gte("created_at", new Date(Date.now() - 30 * 864e5).toISOString()),
    supabase.from("ai_course_day_progress").select("user_email, completed"),
  ]);

  const users      = usersRes.data      ?? [];
  const activity   = activityRes.data   ?? [];
  const aiProgress = aiRes.data         ?? [];

  const now    = Date.now();
  const day1   = now - 1  * 864e5;
  const week1  = now - 7  * 864e5;
  const month1 = now - 30 * 864e5;

  const dauEmails = new Set(
    activity.filter((e) => new Date(e.created_at) >= new Date(day1)).map((e) => e.user_email)
  );
  const wauEmails = new Set(
    activity.filter((e) => new Date(e.created_at) >= new Date(week1)).map((e) => e.user_email)
  );
  const mauEmails = new Set(activity.map((e) => e.user_email));

  return {
    totalUsers:    users.length,
    newUsersToday: users.filter((u) => new Date(u.created_at) >= new Date(day1)).length,
    newUsersWeek:  users.filter((u) => new Date(u.created_at) >= new Date(week1)).length,
    newUsersMonth: users.filter((u) => new Date(u.created_at) >= new Date(month1)).length,
    dau:           dauEmails.size,
    wau:           wauEmails.size,
    mau:           mauEmails.size,
    aiCompletions: aiProgress.filter((p) => p.completed).length,
  };
}

// ─── Time Series ─────────────────────────────────────────────

export async function fetchDailySignups(days = 30) {
  const since = new Date(Date.now() - days * 864e5).toISOString();
  const { data, error } = await supabase
    .from("profiles")
    .select("created_at")
    .gte("created_at", since)
    .order("created_at");

  if (error) throw error;

  const counts = {};
  for (const row of data ?? []) {
    const d = row.created_at.slice(0, 10);
    counts[d] = (counts[d] ?? 0) + 1;
  }

  const result = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    result.push({ date: key, value: counts[key] ?? 0 });
  }
  return result;
}

export async function fetchDailyActiveUsers(days = 30) {
  const since = new Date(Date.now() - days * 864e5).toISOString();
  const { data, error } = await supabase
    .from("user_activity_events")
    .select("user_email, created_at")
    .gte("created_at", since);

  if (error) throw error;

  const byDay = {};
  for (const row of data ?? []) {
    const d = row.created_at.slice(0, 10);
    if (!byDay[d]) byDay[d] = new Set();
    byDay[d].add(row.user_email);
  }

  const result = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    result.push({ date: key, value: byDay[key]?.size ?? 0 });
  }
  return result;
}

// ─── Users ───────────────────────────────────────────────────

/**
 * Returns a flat array of profile rows.
 * Tries the admin_user_summary view first (has ai_days_completed),
 * falls back to direct profiles table.
 */
export async function fetchUsers() {
  const { data: viewData, error: viewErr } = await supabase
    .from("admin_user_summary")
    .select("*")
    .order("created_at", { ascending: false });

  if (!viewErr && viewData) return viewData;

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
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

export async function fetchCourses() {
  const { data, error } = await supabase
    .from("courses")
    .select("id, slug, name, total_days")
    .eq("is_active", true)
    .order("name");

  if (error) throw error;
  return data ?? [];
}

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

  // Fallback to legacy table for AI Literacy
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

export async function fetchEnrolledCount(courseId, courseSlug) {
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

  if (courseSlug === "ai-literacy") {
    const { data } = await supabase
      .from("ai_course_day_progress")
      .select("user_email");
    const uniqueUsers = new Set((data ?? []).map((r) => r.user_email)).size;
    return { enrolled: uniqueUsers, completed: 0 };
  }

  return { enrolled: 0, completed: 0 };
}

// ─── Legacy alias ─────────────────────────────────────────────

export async function fetchAICourseStats() {
  const { data: courseRow } = await supabase
    .from("courses")
    .select("id, slug, total_days")
    .eq("slug", "ai-literacy")
    .maybeSingle();

  if (!courseRow) {
    const { data, error } = await supabase
      .from("ai_course_day_progress")
      .select("day_number, completed, quiz_score, user_email");
    if (error) throw error;
    return _buildDayStats(data ?? [], 10, {
      completedField: (r) => r.completed,
      scoreField:     (r) => r.quiz_score,
    });
  }

  return fetchCourseStats(courseRow.id, "ai-literacy", courseRow.total_days ?? 10);
}