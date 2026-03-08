// sprout-admin/src/pages/Courses.jsx
import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Cell,
} from "recharts";
import { Brain, CheckCircle, Clock, Star, Users } from "lucide-react";
import { fetchCourses, fetchCourseStats, fetchEnrolledCount } from "@/lib/adminApi";
import ChartCard    from "@/components/ChartCard";
import StatCard     from "@/components/StatCard";
import CourseSelector from "@/components/CourseSelector";

const SPROUT_COLORS = ["#22c55e", "#4ade80", "#86efac", "#16a34a", "#15803d"];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-ink-800 border border-ink-700 rounded-xl p-3 text-xs shadow-xl space-y-1.5 min-w-[160px]">
      <p className="text-ink-300 font-semibold">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex justify-between gap-4">
          <span className="text-ink-500 capitalize">{p.name}</span>
          <span className="font-mono text-ink-100">
            {p.value}{p.name === "rate" ? "%" : ""}
          </span>
        </div>
      ))}
    </div>
  );
};

export default function CoursesPage() {
  // ── course list ───────────────────────────────────────────────
  const { data: courses = [], isLoading: loadingCourses } = useQuery({
    queryKey: ["courses"],
    queryFn:  fetchCourses,
  });

  // ── selected course (default to first in list) ────────────────
  const [selectedCourse, setSelectedCourse] = useState(null);

  // Once courses load, auto-select the first one
  const activeCourse = selectedCourse ?? courses[0] ?? null;

  // ── stats for selected course ─────────────────────────────────
  const { data: stats = [], isLoading: loadingStats } = useQuery({
    queryKey: ["courseStats", activeCourse?.id],
    queryFn:  () => fetchCourseStats(
      activeCourse.id,
      activeCourse.slug,
      activeCourse.total_days ?? 10
    ),
    enabled: !!activeCourse,
  });

  // ── enrollment for selected course ───────────────────────────
  const { data: enrollment = { enrolled: 0, completed: 0 }, isLoading: loadingEnrollment } = useQuery({
    queryKey: ["courseEnrollment", activeCourse?.id],
    queryFn:  () => fetchEnrolledCount(activeCourse.id, activeCourse.slug),
    enabled: !!activeCourse,
  });

  // ── derived KPIs ──────────────────────────────────────────────
  const isLoading = loadingCourses || loadingStats || loadingEnrollment;

  const totalCompletions = stats.reduce((s, d) => s + d.completions, 0);
  const avgRate = stats.length
    ? Math.round(stats.reduce((s, d) => s + d.rate, 0) / stats.length)
    : 0;

  const hardestDay = stats.reduce(
    (min, d) => (d.rate < (min?.rate ?? 999) ? d : min),
    null
  );

  const avgScoreOverall = (() => {
    const scored = stats.filter((d) => d.avgScore != null);
    if (!scored.length) return null;
    return Math.round(scored.reduce((s, d) => s + d.avgScore, 0) / scored.length);
  })();

  const completionRate = enrollment.enrolled > 0
    ? Math.round((enrollment.completed / enrollment.enrolled) * 100)
    : 0;

  return (
    <div className="space-y-8 max-w-7xl mx-auto">

      {/* ── Header + Course Selector ──────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink-50">
            {activeCourse ? activeCourse.name : "Courses"}
          </h1>
          <p className="text-ink-500 text-sm mt-1">
            Completion rates and performance analytics
          </p>
        </div>

        <CourseSelector
          selectedCourseId={activeCourse?.id ?? null}
          onChange={setSelectedCourse}
          showAll={false}
        />
      </div>

      {/* ── No courses yet ────────────────────────────────────── */}
      {!loadingCourses && courses.length === 0 && (
        <div className="rounded-2xl border border-ink-700 bg-ink-800/50 p-10 text-center">
          <p className="text-ink-400 text-sm">
            No courses found. Run the SQL migration to seed the courses table.
          </p>
        </div>
      )}

      {activeCourse && (
        <>
          {/* ── KPIs ──────────────────────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Enrolled Users"
              value={enrollment.enrolled.toLocaleString()}
              sub="unique users who started this course"
              icon={Users}
              accent="sprout"
              loading={isLoading}
            />
            <StatCard
              label="Course Completions"
              value={enrollment.completed.toLocaleString()}
              sub={`${completionRate}% completion rate`}
              icon={CheckCircle}
              accent="sprout"
              loading={isLoading}
            />
            <StatCard
              label="Avg Lesson Complete Rate"
              value={`${avgRate}%`}
              sub={`across all ${activeCourse.total_days} days`}
              icon={Brain}
              accent="violet"
              loading={isLoading}
            />
            <StatCard
              label="Avg Quiz Score"
              value={avgScoreOverall != null ? `${avgScoreOverall}%` : "—"}
              sub="across completed lessons"
              icon={Star}
              accent="amber"
              loading={isLoading}
            />
          </div>

          {/* ── Completion Rate by Day ─────────────────────────── */}
          <ChartCard title="Lesson Completion Rate by Day">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={stats} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "#71717a", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "#71717a", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  domain={[0, 100]}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="rate" name="rate" radius={[6, 6, 0, 0]} maxBarSize={48}>
                  {stats.map((entry, i) => (
                    <Cell
                      key={`cell-${i}`}
                      fill={
                        entry === hardestDay
                          ? "#ef4444"
                          : SPROUT_COLORS[i % SPROUT_COLORS.length]
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* ── Completions by Day ────────────────────────────── */}
          <ChartCard title="Total Lesson Completions by Day">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={stats} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "#71717a", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "#71717a", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="completions" name="completions" fill="#6366f1" radius={[6, 6, 0, 0]} maxBarSize={48} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* ── Avg Quiz Score by Day ─────────────────────────── */}
          {stats.some((d) => d.avgScore != null) && (
            <ChartCard title="Avg Quiz Score by Day">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart
                  data={stats.filter((d) => d.avgScore != null)}
                  margin={{ top: 4, right: 8, left: -10, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: "#71717a", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "#71717a", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    domain={[0, 100]}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="avgScore" name="avg score" fill="#f59e0b" radius={[6, 6, 0, 0]} maxBarSize={48} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          )}

          {/* ── Hardest Day callout ───────────────────────────── */}
          {hardestDay && hardestDay.rate < 80 && (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/5 px-5 py-4 flex items-start gap-3">
              <Clock className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-ink-200 text-sm font-semibold">
                  Hardest day: {hardestDay.label} — only {hardestDay.rate}% completion
                </p>
                <p className="text-ink-500 text-xs mt-0.5">
                  Consider reviewing the content or adding extra support for this lesson.
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
