/**
 * activityTracker.js
 * Drop this into the MAIN sprout app at: src/lib/activityTracker.js
 *
 * Tracks logins, lesson completions (all courses), and simulation sessions.
 * All writes go to the shared Supabase project — no extra setup needed.
 *
 * USAGE:
 *   import { trackLogin, trackLessonComplete, trackSimulationStart, trackSimulationComplete } from "@/lib/activityTracker";
 *
 *   // After successful login:
 *   await trackLogin();
 *
 *   // When a lesson day is finished (works for ALL courses):
 *   await trackLessonComplete("budgeting-fundamentals", 3, 85);
 *
 *   // When a simulation starts:
 *   await trackSimulationStart("paper-trading", "Paper Trading");
 *
 *   // When a simulation session ends:
 *   await trackSimulationComplete("paper-trading", "Paper Trading", { final_balance: 12400 });
 */
import { supabase } from "@/lib/supabaseClient";

// ─── Helpers ─────────────────────────────────────────────────

async function getUser() {
  const { data } = await supabase.auth.getUser();
  return data?.user ?? null;
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

/** Cache of slug → UUID to avoid redundant lookups within a session. */
const courseIdCache = {};

async function getCourseId(slug) {
  if (courseIdCache[slug]) return courseIdCache[slug];
  const { data } = await supabase
    .from("courses")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (data?.id) courseIdCache[slug] = data.id;
  return data?.id ?? null;
}

// ─── Throttled last-seen ──────────────────────────────────────

let lastTouched = 0;

/**
 * Updates profiles.last_seen_at. Call on route change.
 * Throttled to once per minute.
 */
export async function touchLastSeen() {
  const now = Date.now();
  if (now - lastTouched < 60_000) return;
  lastTouched = now;

  const user = await getUser();
  if (!user) return;

  const { error } = await supabase
    .from("profiles")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", user.id);

  if (error) console.warn("[activityTracker] touchLastSeen:", error.message);
}

// ─── Login ───────────────────────────────────────────────────

/**
 * Call after a successful Supabase sign-in.
 */
export async function trackLogin() {
  const user = await getUser();
  if (!user) return;
  await insertEvent(user.email, "login");
  await touchLastSeen();
}

// ─── Lesson / Course ─────────────────────────────────────────

/**
 * Call when a user completes any lesson, quiz, exam, or activity in ANY course.
 *
 * @param {string} courseSlug   e.g. "budgeting-fundamentals", "ai-literacy"
 * @param {number} lessonNumber 1-based sequential lesson/unit number within the course
 * @param {number|null} quizScore  0–100, or null if this unit has no quiz
 * @param {'lesson'|'quiz'|'exam'|'activity'} lessonType  defaults to 'lesson'
 */
export async function trackLessonComplete(courseSlug, lessonNumber, quizScore = null, lessonType = "lesson") {
  const user = await getUser();
  if (!user) return;

  // Fire the activity event (feeds the admin's activity feed)
  await insertEvent(user.email, "lesson_complete", {
    course_slug:  courseSlug,
    day_number:   lessonNumber,
    quiz_score:   quizScore,
    lesson_type:  lessonType,
  });

  // Write structured progress (feeds the admin's Courses page charts)
  const courseId = await getCourseId(courseSlug);
  if (!courseId) {
    console.warn("[activityTracker] Unknown course slug:", courseSlug);
    return;
  }

  const { error: progressErr } = await supabase
    .from("user_lesson_progress")
    .upsert(
      {
        user_id:      user.id,
        course_id:    courseId,
        day_number:   lessonNumber,
        lesson_type:  lessonType,
        status:       "completed",
        quiz_score:   quizScore,
        xp_earned:    10,
        completed_at: new Date().toISOString(),
        updated_at:   new Date().toISOString(),
      },
      { onConflict: "user_id,course_id,day_number" }
    );

  if (progressErr) console.warn("[activityTracker] lesson progress upsert:", progressErr.message);

  // Update overall course progress percentage
  await _updateCoursePercent(user.id, courseId);

  // Increment profile total_lessons_completed
  await supabase.rpc("increment_lessons_completed", { uid: user.id }).catch(() => {
    // RPC may not exist yet — fail silently
  });
}

/**
 * Recalculates and upserts user_course_progress.percent_complete.
 * @private
 */
async function _updateCoursePercent(userId, courseId) {
  const [progressRes, courseRes] = await Promise.all([
    supabase
      .from("user_lesson_progress")
      .select("day_number")
      .eq("user_id", userId)
      .eq("course_id", courseId)
      .eq("status", "completed"),
    supabase
      .from("courses")
      .select("total_days")
      .eq("id", courseId)
      .maybeSingle(),
  ]);

  const completedCount = progressRes.data?.length ?? 0;
  const totalDays      = courseRes.data?.total_days ?? 10;
  const percent        = Math.round((completedCount / totalDays) * 100);

  await supabase
    .from("user_course_progress")
    .upsert(
      {
        user_id:          userId,
        course_id:        courseId,
        completed_days:   completedCount,
        percent_complete: percent,
        last_day_completed: completedCount,
        updated_at:       new Date().toISOString(),
      },
      { onConflict: "user_id,course_id" }
    );
}

// ─── Simulations ─────────────────────────────────────────────

/**
 * Call when a user opens / starts a simulation.
 *
 * @param {string} simulationSlug  e.g. "paper-trading"
 * @param {string} simulationName  e.g. "Paper Trading"
 */
export async function trackSimulationStart(simulationSlug, simulationName) {
  const user = await getUser();
  if (!user) return;
  await insertEvent(user.email, "simulation_start", {
    simulation_slug: simulationSlug,
    simulation_name: simulationName,
  });
}

/**
 * Call when a user finishes / submits a simulation.
 *
 * @param {string} simulationSlug  e.g. "paper-trading"
 * @param {string} simulationName  e.g. "Paper Trading"
 * @param {object} metadata        Any sim-specific results (final_balance, roi, etc.)
 */
export async function trackSimulationComplete(simulationSlug, simulationName, metadata = {}) {
  const user = await getUser();
  if (!user) return;
  await insertEvent(user.email, "simulation_complete", {
    simulation_slug: simulationSlug,
    simulation_name: simulationName,
    ...metadata,
  });
}

// ─── Page view (optional) ─────────────────────────────────────

/**
 * Generic page view event — useful for funnel analysis in the admin dashboard.
 * @param {string} pageName
 */
export async function trackPageView(pageName) {
  const user = await getUser();
  if (!user) return;
  await insertEvent(user.email, "page_view", { page: pageName });
}
