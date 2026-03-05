/**
 * adminApi.js
 * All data fetching for the admin dashboard.
 * Every function verifies admin role server-side via RLS.
 */
import { supabase } from "@/lib/supabaseClient";

// ─── Utility ────────────────────────────────────────────────
function dateStr(d) {
  return d.toISOString().slice(0, 10);
}

function fillDateRange(rows, keyField, valueField, days) {
  const map = Object.fromEntries(rows.map((r) => [r[keyField], r[valueField]]));
  const result = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = dateStr(d);
    result.push({ date: key, value: Number(map[key] ?? 0) });
  }
  return result;
}

// ─── KPI Overview ────────────────────────────────────────────

export async function fetchKPIs() {
  const [usersRes, activityRes, aiRes] = await Promise.all([
    supabase.from("profiles").select("id, created_at, last_seen_at", { count: "exact" }),
    supabase
      .from("user_activity_events")
      .select("user_email, created_at")
      .gte("created_at", new Date(Date.now() - 30 * 864e5).toISOString()),
    supabase.from("ai_course_day_progress").select("user_email, completed"),
  ]);

  if (usersRes.error) throw usersRes.error;
  if (activityRes.error) throw activityRes.error;
  if (aiRes.error) throw aiRes.error;

  const users       = usersRes.data ?? [];
  const activity    = activityRes.data ?? [];
  const aiProgress  = aiRes.data ?? [];

  const now     = Date.now();
  const day1    = now - 1   * 864e5;
  const week1   = now - 7   * 864e5;
  const month1  = now - 30  * 864e5;

  const dauEmails = new Set(activity.filter(e => new Date(e.created_at) >= new Date(day1)).map(e => e.user_email));
  const wauEmails = new Set(activity.filter(e => new Date(e.created_at) >= new Date(week1)).map(e => e.user_email));
  const mauEmails = new Set(activity.map(e => e.user_email));

  const newUsersToday  = users.filter(u => new Date(u.created_at) >= new Date(day1)).length;
  const newUsersWeek   = users.filter(u => new Date(u.created_at) >= new Date(week1)).length;
  const newUsersMonth  = users.filter(u => new Date(u.created_at) >= new Date(month1)).length;

  const aiCompletions = aiProgress.filter(p => p.completed).length;

  return {
    totalUsers:     users.length,
    newUsersToday,
    newUsersWeek,
    newUsersMonth,
    dau:            dauEmails.size,
    wau:            wauEmails.size,
    mau:            mauEmails.size,
    aiCompletions,
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

  // Group by date client-side (avoids needing RPC for simple case)
  const counts = {};
  for (const row of data ?? []) {
    const d = row.created_at.slice(0, 10);
    counts[d] = (counts[d] ?? 0) + 1;
  }

  return fillDateRange(
    Object.entries(counts).map(([date, v]) => ({ date, new_users: v })),
    "date", "new_users", days
  );
}

export async function fetchDailyActiveUsers(days = 30) {
  const since = new Date(Date.now() - days * 864e5).toISOString();
  const { data, error } = await supabase
    .from("user_activity_events")
    .select("user_email, created_at")
    .gte("created_at", since);

  if (error) throw error;

  const byDate = {};
  for (const row of data ?? []) {
    const d = row.created_at.slice(0, 10);
    if (!byDate[d]) byDate[d] = new Set();
    byDate[d].add(row.user_email);
  }

  const counts = Object.fromEntries(
    Object.entries(byDate).map(([d, s]) => [d, s.size])
  );

  return fillDateRange(
    Object.entries(counts).map(([date, v]) => ({ date, active_users: v })),
    "date", "active_users", days
  );
}

// ─── Users List ──────────────────────────────────────────────

export async function fetchAllUsers({ search = "", limit = 200, offset = 0 } = {}) {
  let query = supabase
    .from("profiles")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (search) {
    query = query.or(`email.ilike.%${search}%,full_name.ilike.%${search}%`);
  }

  const { data, error, count } = await query;
  if (error) throw error;
  return { users: data ?? [], total: count ?? 0 };
}

// ─── Single User Drilldown ───────────────────────────────────

export async function fetchUserDetail(userId) {
  const [profileRes, aiRes, activityRes] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).single(),
    supabase.from("ai_course_day_progress").select("*").eq("user_email",
      // sub-query via RPC not available; we'll pass email after we get profile
      // For now fetch by user_id — requires email from profile first
      // Handled below after profile loads
      "__placeholder__"
    ),
    supabase
      .from("user_activity_events")
      .select("*")
      .eq("user_email", "__placeholder__")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  // Re-fetch with real email
  const profile = profileRes.data;
  if (profileRes.error || !profile) throw profileRes.error ?? new Error("User not found");

  const [aiRes2, activityRes2] = await Promise.all([
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
  ]);

  return {
    profile,
    aiProgress: aiRes2.data ?? [],
    activity:   activityRes2.data ?? [],
  };
}

// ─── AI Course Stats ─────────────────────────────────────────

export async function fetchAICourseStats() {
  const { data, error } = await supabase
    .from("ai_course_day_progress")
    .select("day_number, completed, quiz_score, time_spent_minutes, user_email");

  if (error) throw error;
  const rows = data ?? [];

  // Group by day_number
  const byDay = {};
  for (const row of rows) {
    const d = row.day_number;
    if (!byDay[d]) byDay[d] = { day: d, attempts: 0, completions: 0, scores: [], times: [] };
    byDay[d].attempts++;
    if (row.completed) {
      byDay[d].completions++;
      if (row.quiz_score != null) byDay[d].scores.push(row.quiz_score);
      if (row.time_spent_minutes != null) byDay[d].times.push(row.time_spent_minutes);
    }
  }

  return Array.from({ length: 10 }, (_, i) => {
    const d = byDay[i + 1] ?? { day: i + 1, attempts: 0, completions: 0, scores: [], times: [] };
    return {
      day:         d.day,
      label:       `Day ${d.day}`,
      attempts:    d.attempts,
      completions: d.completions,
      rate:        d.attempts > 0 ? Math.round((d.completions / d.attempts) * 100) : 0,
      avgScore:    d.scores.length > 0 ? Math.round(d.scores.reduce((a, b) => a + b, 0) / d.scores.length) : null,
      avgTime:     d.times.length  > 0 ? Math.round(d.times.reduce((a, b) => a + b, 0)  / d.times.length)  : null,
    };
  });
}

// ─── Activity tracking (called from main app via this same client) ────────────

export async function trackEvent(userEmail, eventType, eventData = {}) {
  const { error } = await supabase.from("user_activity_events").insert({
    user_email: userEmail,
    event_type: eventType,
    event_data: eventData,
  });
  if (error) console.warn("[trackEvent] failed:", error.message);
}

export async function updateLastSeen(userId) {
  const { error } = await supabase
    .from("profiles")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", userId);
  if (error) console.warn("[updateLastSeen] failed:", error.message);
}
