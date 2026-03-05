import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO, formatDistanceToNow } from "date-fns";
import {
  ArrowLeft, CheckCircle, Circle, Zap, Brain,
  Mail, School, Calendar, Clock, Activity, Trophy,
} from "lucide-react";
import { fetchUserDetail } from "@/lib/adminApi";

const DAY_TITLES = [
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

  const { profile, aiProgress, activity } = data;
  const completedDays = aiProgress.filter((p) => p.completed).length;
  const lastEvent = activity[0];

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
        {/* Quick stats */}
        <div className="flex gap-4 flex-wrap">
          {[
            { label: "Level",   value: profile.level ?? 1,       icon: Trophy, color: "text-amber-400" },
            { label: "XP",     value: (profile.xp_points ?? 0).toLocaleString(), icon: Zap,    color: "text-amber-400" },
            { label: "Streak", value: `${profile.current_streak ?? 0}d`, icon: Activity, color: "text-sprout-400" },
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
            <ProfileRow icon={Mail}     label="Email"   value={profile.email} mono />
            <ProfileRow icon={School}   label="School"  value={profile.school_id} />
            <ProfileRow icon={Calendar} label="Grade"   value={profile.grade} />
            <ProfileRow icon={Clock}    label="Joined"  value={profile.created_at ? format(parseISO(profile.created_at), "MMM d, yyyy") : null} />
            <ProfileRow icon={Activity} label="Longest streak" value={profile.longest_streak ? `${profile.longest_streak} days` : null} />
          </div>
        </div>

        {/* AI Course Progress */}
        <div className="lg:col-span-2 glass rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-semibold text-ink-200 text-sm">AI Literacy Course</h2>
            <span className="font-mono-data text-sprout-400 text-sm font-semibold">
              {completedDays}/10 days
            </span>
          </div>

          {/* Progress bar */}
          <div className="w-full h-2 bg-ink-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-sprout-500 to-sprout-400 rounded-full transition-all"
              style={{ width: `${(completedDays / 10) * 100}%` }}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            {DAY_TITLES.map((title, idx) => {
              const dayNum  = idx + 1;
              const row     = aiProgress.find((p) => p.day_number === dayNum);
              const done    = row?.completed ?? false;
              const score   = row?.quiz_score ?? null;
              const time    = row?.time_spent_minutes ?? null;

              return (
                <div
                  key={dayNum}
                  className={`flex items-start gap-2.5 p-3 rounded-xl border transition-colors ${
                    done
                      ? "bg-sprout-500/8 border-sprout-500/20"
                      : "bg-ink-800/50 border-ink-700/50"
                  }`}
                >
                  {done
                    ? <CheckCircle className="w-4 h-4 text-sprout-400 flex-shrink-0 mt-0.5" />
                    : <Circle className="w-4 h-4 text-ink-700 flex-shrink-0 mt-0.5" />
                  }
                  <div className="min-w-0">
                    <p className={`text-xs font-medium leading-tight ${done ? "text-ink-200" : "text-ink-500"}`}>
                      Day {dayNum}: {title}
                    </p>
                    {done && (
                      <p className="text-ink-600 text-xs mt-0.5 font-mono-data">
                        {score != null && `Score: ${score}%`}
                        {score != null && time != null && " · "}
                        {time != null && `${time}m`}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
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
                {ev.event_data?.day_number && (
                  <span className="text-ink-600 text-xs">· Day {ev.event_data.day_number}</span>
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
