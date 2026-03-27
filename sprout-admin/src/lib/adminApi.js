// sprout-admin/src/lib/adminApi.js
import { supabase } from "@/lib/supabaseClient";

// ─── KPI Overview ────────────────────────────────────────────

export async function fetchKPIs() {
  const [usersRes, activityRes, lessonRes] = await Promise.all([
    supabase.from("profiles").select("id, created_at, last_seen_at"),
    supabase
      .from("user_activity_events")
      .select("user_email, created_at")
      .gte("created_at", new Date(Date.now() - 30 * 864e5).toISOString()),
    supabase
      .from("user_lesson_progress")
      .select("id", { count: "exact", head: true })
      .eq("status", "completed"),
  ]);

  const users    = usersRes.data    ?? [];
  const activity = activityRes.data ?? [];

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

  // Also count legacy AI completions as fallback if new table is empty
  let totalLessonCompletions = lessonRes.count ?? 0;
  if (totalLessonCompletions === 0) {
    const { data: legacyData } = await supabase
      .from("ai_course_day_progress")
      .select("completed")
      .eq("completed", true);
    totalLessonCompletions = legacyData?.length ?? 0;
  }

  return {
    totalUsers:            users.length,
    newUsersToday:         users.filter((u) => new Date(u.created_at) >= new Date(day1)).length,
    newUsersWeek:          users.filter((u) => new Date(u.created_at) >= new Date(week1)).length,
    newUsersMonth:         users.filter((u) => new Date(u.created_at) >= new Date(month1)).length,
    dau:                   dauEmails.size,
    wau:                   wauEmails.size,
    mau:                   mauEmails.size,
    totalLessonCompletions,
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
      .select("*, courses(name, slug, total_days, tracking_type)")
      .eq("user_id", userId)
      .order("day_number"),
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
    .select("id, slug, name, total_days, tracking_type")
    .order("name");

  if (error) throw error;
  return data ?? [];
}

export async function fetchCourseStats(courseId, courseSlug, totalDays = 10, trackingType = "lesson") {
  // Try new schema first
  const { data: newData, error: newErr } = await supabase
    .from("user_lesson_progress")
    .select("day_number, status, quiz_score, lesson_type, user_id")
    .eq("course_id", courseId);

  if (!newErr && newData && newData.length > 0) {
    return _buildUnitStats(newData, totalDays, trackingType, {
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
    return _buildUnitStats(legacyData ?? [], totalDays, "day", {
      completedField: (r) => r.completed,
      scoreField:     (r) => r.quiz_score,
    });
  }

  return [];
}

/**
 * Builds per-unit (day or lesson) stats from raw progress rows.
 *
 * For 'day' courses: generates a fixed array of totalDays slots.
 * For 'lesson' courses: generates slots only up to the highest lesson seen.
 */
function _buildUnitStats(rows, totalDays, trackingType, { completedField, scoreField }) {
  const isDay = trackingType === "day";
  const byUnit = {};

  for (const row of rows) {
    const n = row.day_number;
    if (!byUnit[n]) byUnit[n] = { unit: n, attempts: 0, completions: 0, scores: [] };
    byUnit[n].attempts++;
    if (completedField(row)) {
      byUnit[n].completions++;
      const s = scoreField(row);
      if (s != null) byUnit[n].scores.push(s);
    }
  }

  // Determine how many slots to generate
  let count;
  if (isDay) {
    count = totalDays > 0 ? totalDays : 10;
  } else {
    const keys = Object.keys(byUnit).map(Number);
    count = keys.length === 0 ? 0 : Math.max(...keys);
  }

  if (count === 0) return [];

  return Array.from({ length: count }, (_, i) => {
    const n = i + 1;
    const d = byUnit[n] ?? { unit: n, attempts: 0, completions: 0, scores: [] };
    return {
      unit:      n,
      label:     isDay ? `Day ${n}` : `L${n}`,
      fullLabel: isDay ? `Day ${n}` : `Lesson ${n}`,
      attempts:    d.attempts,
      completions: d.completions,
      rate:     d.attempts > 0 ? Math.round((d.completions / d.attempts) * 100) : 0,
      avgScore: d.scores.length > 0
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

  return fetchCourseStats(courseRow.id, "ai-literacy", courseRow.total_days ?? 10, "day");
}

// ─── Simulations ──────────────────────────────────────────────

const SIMULATIONS = [
  { slug: "build-your-first-budget",      name: "Build Your First Budget",      category: "budgeting"  },
  { slug: "college-student-budget",       name: "College Student Budget",       category: "budgeting"  },
  { slug: "new-graduate-budget",          name: "New Graduate Budget",          category: "budgeting"  },
  { slug: "early-career-dual-income",     name: "Early Career – Dual Income",   category: "budgeting"  },
  { slug: "mid-career-family-budget",     name: "Mid-Career Family Budget",     category: "budgeting"  },
  { slug: "paper-trading",               name: "Paper Trading",                category: "investing"  },
  { slug: "investment-growth-calculator", name: "Investment Growth Calculator", category: "investing"  },
  { slug: "investment-calculator",        name: "Investment Growth Calculator", category: "investing"  },
  { slug: "paycheck-simulation",          name: "Paycheck Simulation",          category: "paycheck"   },
  { slug: "budget-simulation",            name: "Budget Simulation",            category: "budgeting"  },
];

export async function fetchSimulationStats(days = 30) {
  const since = days === 0
    ? "2000-01-01T00:00:00Z"
    : new Date(Date.now() - days * 864e5).toISOString();

  const { data, error } = await supabase
    .from("user_activity_events")
    .select("event_type, event_data, user_email, created_at")
    .in("event_type", ["simulation_start", "simulation_complete"])
    .gte("created_at", since);

  if (error) throw error;

  const bySlug = {};
  for (const row of data ?? []) {
    const slug = row.event_data?.simulation_slug;
    if (!slug) continue;
    if (!bySlug[slug]) bySlug[slug] = { starts: new Set(), completions: new Set() };
    if (row.event_type === "simulation_start")    bySlug[slug].starts.add(row.user_email);
    if (row.event_type === "simulation_complete") bySlug[slug].completions.add(row.user_email);
  }

  return SIMULATIONS.map((sim) => {
    const s = bySlug[sim.slug];
    const starts      = s?.starts.size      ?? 0;
    const completions = s?.completions.size ?? 0;
    return {
      slug:           sim.slug,
      name:           sim.name,
      category:       sim.category,
      uniqueStarts:       starts,
      uniqueCompletions:  completions,
      completionRate: starts > 0 ? Math.round((completions / starts) * 100) : 0,
    };
  });
}