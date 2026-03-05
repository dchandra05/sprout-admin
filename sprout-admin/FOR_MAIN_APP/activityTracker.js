/**
 * activityTracker.js
 * Drop this into the MAIN sprout app at: src/lib/activityTracker.js
 *
 * Call trackLogin() after successful Supabase sign-in.
 * Call trackLessonComplete() when a lesson/day is finished.
 * Call touchLastSeen() periodically (e.g. on route change).
 *
 * All writes go to the same Supabase project — no extra setup needed.
 */
import { supabase } from "@/lib/supabaseClient";

async function getUserEmail() {
  const { data } = await supabase.auth.getUser();
  return data?.user?.email ?? null;
}

async function getUserId() {
  const { data } = await supabase.auth.getUser();
  return data?.user?.id ?? null;
}

async function insertEvent(email, eventType, eventData = {}) {
  if (!email) return;
  const { error } = await supabase.from("user_activity_events").insert({
    user_email: email,
    event_type: eventType,
    event_data: eventData,
  });
  if (error) console.warn("[activityTracker]", eventType, error.message);
}

// ─── Public API ──────────────────────────────────────────────

/**
 * Call after a successful login.
 */
export async function trackLogin() {
  const email = await getUserEmail();
  await insertEvent(email, "login");
  await touchLastSeen();
}

/**
 * Call when a user completes an AI Literacy day.
 * @param {number} dayNumber  1–10
 * @param {number} quizScore  0–100
 */
export async function trackLessonComplete(dayNumber, quizScore) {
  const email = await getUserEmail();
  await insertEvent(email, "lesson_complete", { day_number: dayNumber, quiz_score: quizScore });
}

/**
 * Updates profiles.last_seen_at. Call on route change (throttled).
 */
let lastTouched = 0;
export async function touchLastSeen() {
  const now = Date.now();
  if (now - lastTouched < 60_000) return; // max once per minute
  lastTouched = now;

  const userId = await getUserId();
  if (!userId) return;

  const { error } = await supabase
    .from("profiles")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", userId);

  if (error) console.warn("[activityTracker] touchLastSeen:", error.message);
}

/**
 * Generic page view event (optional, for future funnels).
 */
export async function trackPageView(pageName) {
  const email = await getUserEmail();
  await insertEvent(email, "page_view", { page: pageName });
}
