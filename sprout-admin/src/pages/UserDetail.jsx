import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO, formatDistanceToNow } from "date-fns";
import {
  ArrowLeft, CheckCircle, Circle, Zap,
  Mail, School, Calendar, Clock, Activity, Trophy, BookOpen,
} from "lucide-react";
import { fetchUserDetail } from "@/lib/adminApi";

// Day titles for AI Literacy only — other courses just show "Day N"
const AI_DAY_TITLES = [
  "What is AI?",
  "How Machines Learn",
  "AI in the Real World",
  "Generative AI & Hallucinations",
  "Using AI Effectively",
  "Ethics: Bias, Privacy, Deepfakes",
  "AI and Society",
  "Practical AI Skills Lab",
  "Capstone + Review",
  "Final Exam + Certification",
];

function ProfileRow({ icon: Icon, label, value, mono }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3">
      <Icon className="w-4 h-4 text-ink-500 mt-0.5 flex-shrink-0" />
      <div>
        <p className="text-ink-500 text-xs">{label}</p>
        <p className={`text-ink-100 text-sm mt-0.5 ${mono ? "font-mono-data" : ""}`}>{value}</p>
      </div>
    </div>
  );
}

function CourseProgressCard({ courseName, courseSlug, lessons, totalDays, trackingType }) {
  const isDay       = trackingType === "day";
  const completed   = lessons.filter((l) => l.status === "completed");
  const isAI        = courseSlug === "ai-literacy";

  // For day-based courses: use fixed totalDays grid
  // For lesson-based courses: use highest lesson number seen
  const maxUnit     = isDay
    ? (totalDays > 0 ? totalDays : 10)
    : (lessons.length > 0 ? Math.max(...lessons.map((l) => l.day_number)) : 0);

  const pct = maxUnit > 0 ? Math.round((completed.length / maxUnit) * 100) : 0;
  const unitLabel = isDay ? "day" : "lesson";

  return (
    <div className="glass rounded-2xl p-5 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <BookOpen className="w-4 h-4 text-sprout-400 flex-shrink-0" />
          <h3 className="font-display font-semibold text-ink-200 text-sm truncate">{courseName}</h3>
        </div>
        <span className="font-mono-data text-sprout-400 text-xs font-semibold flex-shrink-0">
          {completed.length}{maxUnit > 0 ? `/${maxUnit}` : ""} {unitLabel}s
        </span>
      </div>

      {maxUnit > 0 && (
        <div className="w-full h-1.5 bg-ink-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-sprout-500 to-sprout-400 rounded-full transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}

      {maxUnit === 0 ? (
        <p className="text-ink-600 text-xs">No progress recorded yet.</p>
      ) : (
        <div className={isDay ? "grid grid-cols-2 gap-1.5" : "space-y-1.5"}>
          {Array.from({ length: maxUnit }, (_, idx) => {
            const unitNum = idx + 1;
            const row     = lessons.find((l) => l.day_number === unitNum);
            const done    = row?.status === "completed";
            const score   = row?.quiz_score ?? null;
            const lType   = row?.lesson_type ?? "lesson";

            const typeLabel = lType === "quiz"     ? "Quiz"
                            : lType === "exam"     ? "Exam"
                            : lType === "activity" ? "Activity"
                            : null;

            return (
              <div
                key={unitNum}
                className={`flex items-start gap-2 p-2.5 rounded-lg border transition-colors ${
                  done
                    ? "bg-sprout-500/8 border-sprout-500/20"
                    : "bg-ink-800/50 border-ink-700/40"
                }`}
              >
                {done
                  ? <CheckCircle className="w-3.5 h-3.5 text-sprout-400 flex-shrink-0 mt-0.5" />
                  : <Circle      className="w-3.5 h-3.5 text-ink-700   flex-shrink-0 mt-0.5" />
                }
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className={`text-xs font-medium leading-tight ${done ? "text-ink-200" : "text-ink-600"}`}>
                      {isAI && AI_DAY_TITLES[idx]
                        ? `Day ${unitNum}: ${AI_DAY_TITLES[idx]}`
                        : `${isDay ? "Day" : "Lesson"} ${unitNum}`}
                    </p>
                    {typeLabel && (
                      <span className="text-ink-600 text-[10px] bg-ink-700 px-1 rounded">{typeLabel}</span>
                    )}
                  </div>
                  {done && score != null && (
                    <p className="text-ink-600 text-xs mt-0.5 font-mono-data">Score: {score}%</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function UserDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data, isLoading, error } = useQuery({
    queryKey: ["userDetail", id],
    queryFn: () => fetchUserDetail(id),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-sprout-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-center py-16 text-ink-500">
        <p>User not found or access denied.</p>
        <button onClick={() => navigate("/users")} className="mt-4 text-sprout-400 text-sm hover:underline">
          ← Back to users
        </button>
      </div>
    );
  }

  const { profile, aiProgress, activity, lessonProgress } = data;
  const lastEvent = activity[0];

  // Group new-schema lesson progress by course
  const courseGroups = lessonProgress.reduce((acc, row) => {
    const key = row.course_id;
    if (!acc[key]) {
      acc[key] = {
        courseId:     key,
        courseName:   row.courses?.name         ?? "Unknown Course",
        courseSlug:   row.courses?.slug         ?? "",
        totalDays:    row.courses?.total_days   ?? 10,
        trackingType: row.courses?.tracking_type ?? "lesson",
        lessons:      [],
      };
    }
    acc[key].lessons.push(row);
    return acc;
  }, {});

  const courseGroupList = Object.values(courseGroups);

  // If new schema has no AI Literacy data but legacy table does, synthesise it
  const hasNewAI = courseGroupList.some((g) => g.courseSlug === "ai-literacy");
  if (!hasNewAI && aiProgress.length > 0) {
    courseGroupList.unshift({
      courseId:     "legacy-ai",
      courseName:   "AI Literacy",
      courseSlug:   "ai-literacy",
      totalDays:    10,
      trackingType: "day",
      lessons:      aiProgress.map((p) => ({
        day_number:  p.day_number,
        status:      p.completed ? "completed" : "not_started",
        quiz_score:  p.quiz_score ?? null,
        lesson_type: "lesson",
      })),
    });
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Back */}
      <button
        onClick={() => navigate("/users")}
        className="flex items-center gap-2 text-ink-500 hover:text-ink-200 text-sm transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        All Users
      </button>

      {/* Header */}
      <div className="glass rounded-2xl p-6 flex flex-col sm:flex-row items-start gap-5">
        <div className="w-14 h-14 rounded-2xl bg-sprout-500/20 border border-sprout-500/30 flex items-center justify-center text-sprout-400 font-display font-bold text-2xl flex-shrink-0">
          {(profile.full_name || profile.email || "?")[0].toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="font-display text-xl font-bold text-ink-50">{profile.full_name || "Unnamed User"}</h1>
            {profile.role === "admin" && (
              <span className="px-2 py-0.5 rounded bg-red-500/15 border border-red-500/25 text-red-400 text-xs font-medium">
                Admin
              </span>
            )}
          </div>
          <p className="text-ink-400 text-sm mt-0.5">{profile.email}</p>
          {profile.last_seen_at && (
            <p className="text-ink-600 text-xs mt-1">
              Last seen {formatDistanceToNow(parseISO(profile.last_seen_at), { addSuffix: true })}
            </p>
          )}
        </div>
        <div className="flex gap-4 flex-wrap">
          {[
            { label: "Level",  value: profile.level ?? 1,                          icon: Trophy,   color: "text-amber-400"  },
            { label: "XP",     value: (profile.xp_points ?? 0).toLocaleString(),   icon: Zap,      color: "text-amber-400"  },
            { label: "Streak", value: `${profile.current_streak ?? 0}d`,           icon: Activity, color: "text-sprout-400" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-ink-800 rounded-xl px-4 py-3 text-center min-w-[72px]">
              <Icon className={`w-4 h-4 ${color} mx-auto mb-1`} />
              <p className="font-mono-data text-ink-100 text-sm font-semibold">{value}</p>
              <p className="text-ink-600 text-xs">{label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Profile Details */}
        <div className="glass rounded-2xl p-6 space-y-4">
          <h2 className="font-display font-semibold text-ink-200 text-sm">Profile</h2>
          <div className="space-y-3">
            <ProfileRow icon={Mail}     label="Email"          value={profile.email} mono />
            <ProfileRow icon={School}   label="School"         value={profile.school_id} />
            <ProfileRow icon={Calendar} label="Grade"          value={profile.grade} />
            <ProfileRow icon={Clock}    label="Joined"         value={profile.created_at ? format(parseISO(profile.created_at), "MMM d, yyyy") : null} />
            <ProfileRow icon={Activity} label="Longest streak" value={profile.longest_streak ? `${profile.longest_streak} days` : null} />
            <ProfileRow icon={BookOpen} label="Total lessons"  value={profile.total_lessons_completed ? `${profile.total_lessons_completed} completed` : null} />
          </div>
        </div>

        {/* Course Progress — dynamic, all courses */}
        <div className="lg:col-span-2 space-y-4">
          {courseGroupList.length === 0 ? (
            <div className="glass rounded-2xl p-8 text-center">
              <BookOpen className="w-8 h-8 text-ink-700 mx-auto mb-3" />
              <p className="text-ink-500 text-sm">No course progress recorded yet.</p>
            </div>
          ) : (
            courseGroupList.map((group) => (
              <CourseProgressCard
                key={group.courseId}
                courseName={group.courseName}
                courseSlug={group.courseSlug}
                lessons={group.lessons}
                totalDays={group.totalDays ?? 10}
                trackingType={group.trackingType ?? "lesson"}
              />
            ))
          )}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="glass rounded-2xl p-6 space-y-4">
        <h2 className="font-display font-semibold text-ink-200 text-sm">Recent Activity</h2>
        {activity.length === 0 ? (
          <p className="text-ink-600 text-sm">No activity recorded yet.</p>
        ) : (
          <div className="space-y-2">
            {activity.slice(0, 20).map((ev) => (
              <div key={ev.id} className="flex items-center gap-3 py-2 border-b border-ink-800 last:border-0">
                <div className="w-1.5 h-1.5 rounded-full bg-sprout-500 flex-shrink-0" />
                <span className="text-ink-300 text-sm capitalize">{ev.event_type.replace(/_/g, " ")}</span>
                {ev.event_data?.course_slug && (
                  <span className="text-ink-600 text-xs">· {ev.event_data.course_slug}</span>
                )}
                {ev.event_data?.day_number && (
                  <span className="text-ink-600 text-xs">Day {ev.event_data.day_number}</span>
                )}
                {ev.event_data?.simulation_slug && (
                  <span className="text-ink-600 text-xs">· {ev.event_data.simulation_name ?? ev.event_data.simulation_slug}</span>
                )}
                <span className="ml-auto text-ink-600 text-xs font-mono-data flex-shrink-0">
                  {ev.created_at ? format(parseISO(ev.created_at), "MMM d, HH:mm") : "—"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
