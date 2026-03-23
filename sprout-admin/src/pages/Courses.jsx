// sprout-admin/src/pages/Courses.jsx
// Fully dynamic — loads all courses from Supabase, no hardcoded AI Literacy logic
import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Cell,
} from "recharts";
import { BookOpen, CheckCircle, Clock, Star, Users, ChevronDown } from "lucide-react";
import {
  fetchCourses,
  fetchCourseStats,
  fetchEnrolledCount,
} from "@/lib/adminApi";
import ChartCard from "@/components/ChartCard";
import StatCard  from "@/components/StatCard";

// ─── Tooltip ─────────────────────────────────────────────────────────────────

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-ink-800 border border-ink-700 rounded-xl p-3 text-xs shadow-xl space-y-1.5 min-w-[160px]">
      <p className="text-ink-300 font-semibold">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex justify-between gap-4">
          <span className="text-ink-500 capitalize">{p.name}</span>
          <span className="font-mono-data text-ink-100">
            {p.value}{p.name === "rate" ? "%" : ""}
          </span>
        </div>
      ))}
    </div>
  );
};

// ─── Course selector ──────────────────────────────────────────────────────────

function CourseSelector({ courses, selected, onChange, loading }) {
  if (loading) {
    return (
      <div className="h-10 w-56 bg-ink-800 rounded-xl animate-pulse" />
    );
  }

  if (!courses.length) {
    return (
      <p className="text-ink-500 text-sm">No courses found in the database.</p>
    );
  }

  return (
    <div className="relative">
      <select
        value={selected?.id ?? ""}
        onChange={(e) => {
          const course = courses.find((c) => c.id === e.target.value);
          onChange(course ?? null);
        }}
        className="appearance-none bg-ink-800 border border-ink-700 text-ink-100 text-sm rounded-xl px-4 pr-10 py-2.5 focus:outline-none focus:border-sprout-500/50 focus:ring-1 focus:ring-sprout-500/30 cursor-pointer min-w-[220px]"
      >
        {courses.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-500 pointer-events-none" />
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CoursesPage() {
  const [selectedCourse, setSelectedCourse] = useState(null);

  // 1. Load all courses
  const {
    data: courses = [],
    isLoading: coursesLoading,
  } = useQuery({
    queryKey: ["courses"],
    queryFn:  fetchCourses,
  });

  // Auto-select first course after load (works alongside onSuccess for React Query v5)
  React.useEffect(() => {
    if (courses.length > 0 && !selectedCourse) {
      setSelectedCourse(courses[0]);
    }
  }, [courses]);

  // 2. Load per-day stats for the selected course
  const {
    data: stats = [],
    isLoading: statsLoading,
  } = useQuery({
    queryKey: ["courseStats", selectedCourse?.id],
    queryFn:  () => fetchCourseStats(
      selectedCourse.id,
      selectedCourse.slug,
      selectedCourse.total_days ?? 10
    ),
    enabled: !!selectedCourse,
  });

  // 3. Load enrolled / completed count for the selected course
  const {
    data: enrollment = { enrolled: 0, completed: 0 },
    isLoading: enrollLoading,
  } = useQuery({
    queryKey: ["courseEnrollment", selectedCourse?.id],
    queryFn:  () => fetchEnrolledCount(selectedCourse.id, selectedCourse.slug),
    enabled:  !!selectedCourse,
  });

  const isLoading = statsLoading || enrollLoading;

  // ─── Derived KPIs ───────────────────────────────────────────────────────────
  const totalCompletions = stats.reduce((s, d) => s + d.completions, 0);
  const avgRate = stats.length
    ? Math.round(stats.reduce((s, d) => s + d.rate, 0) / stats.length)
    : 0;
  const hardestDay = stats.reduce(
    (min, d) => (d.attempts > 0 && d.rate < (min?.rate ?? 999) ? d : min),
    null
  );
  const scoredDays  = stats.filter((d) => d.avgScore != null);
  const avgScore    = scoredDays.length
    ? Math.round(scoredDays.reduce((s, d) => s + d.avgScore, 0) / scoredDays.length)
    : null;

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink-50">
            {selectedCourse ? selectedCourse.name : "Courses"}
          </h1>
          <p className="text-ink-500 text-sm mt-1">
            Completion rates and performance analytics
          </p>
        </div>

        <CourseSelector
          courses={courses}
          selected={selectedCourse}
          onChange={setSelectedCourse}
          loading={coursesLoading}
        />
      </div>

      {/* No course state */}
      {!coursesLoading && courses.length === 0 && (
        <div className="glass rounded-2xl p-12 text-center">
          <BookOpen className="w-10 h-10 text-ink-600 mx-auto mb-4" />
          <p className="text-ink-400 text-sm">
            No courses found. Add a row to the <code className="text-sprout-400">courses</code> table in Supabase.
          </p>
        </div>
      )}

      {selectedCourse && (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Enrolled Users"
              value={enrollLoading ? null : enrollment.enrolled.toLocaleString()}
              sub="students who started this course"
              icon={Users}
              accent="sprout"
              loading={enrollLoading}
            />
            <StatCard
              label="Total Completions"
              value={isLoading ? null : totalCompletions.toLocaleString()}
              sub="lesson completions across all users"
              icon={CheckCircle}
              accent="violet"
              loading={isLoading}
            />
            <StatCard
              label="Avg Completion Rate"
              value={isLoading ? null : `${avgRate}%`}
              sub={`across all ${selectedCourse.total_days ?? 10} days`}
              icon={BookOpen}
              accent="blue"
              loading={isLoading}
            />
            <StatCard
              label="Avg Quiz Score"
              value={isLoading ? null : (avgScore != null ? `${avgScore}%` : "—")}
              sub="for completed lessons"
              icon={Star}
              accent="amber"
              loading={isLoading}
            />
          </div>

          {/* Hardest day banner */}
          {!isLoading && hardestDay && hardestDay.rate < 80 && (
            <div className="glass rounded-2xl px-6 py-4 border border-red-500/20 bg-red-500/5 flex items-center gap-3">
              <Clock className="w-5 h-5 text-red-400 flex-shrink-0" />
              <p className="text-sm text-ink-300">
                <span className="text-red-400 font-semibold">Hardest day:</span>{" "}
                Day {hardestDay.day} — only{" "}
                <span className="font-mono text-red-300">{hardestDay.rate}%</span> completion rate.
                Consider reviewing the content for this lesson.
              </p>
            </div>
          )}

          {/* Charts */}
          <div className="grid lg:grid-cols-2 gap-6">
            <ChartCard
              title="Completions per Day"
              subtitle="Total students who completed each lesson"
              loading={isLoading}
            >
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={stats} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid stroke="#27272a" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: "#71717a", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "#71717a", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="completions" radius={[4, 4, 0, 0]} maxBarSize={28}>
                    {stats.map((_, i) => (
                      <Cell
                        key={i}
                        fill={i < 3 ? "#22c55e" : i < Math.floor(stats.length * 0.7) ? "#3b82f6" : "#8b5cf6"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard
              title="Completion Rate per Day"
              subtitle="% of students who started a day and finished it"
              loading={isLoading}
            >
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={stats} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid stroke="#27272a" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: "#71717a", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "#71717a", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    domain={[0, 100]}
                    unit="%"
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="rate" radius={[4, 4, 0, 0]} maxBarSize={28} fill="#f59e0b" />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          {/* Quiz score chart */}
          {scoredDays.length > 0 && (
            <ChartCard
              title="Avg Quiz Score per Day"
              subtitle="Average score among students who completed each lesson"
              loading={isLoading}
            >
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={stats} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid stroke="#27272a" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: "#71717a", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "#71717a", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    domain={[0, 100]}
                    unit="%"
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar
                    dataKey="avgScore"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={28}
                    fill="#6366f1"
                  />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          )}

          {/* Day-by-day table */}
          <div className="glass rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-ink-700/50">
              <h2 className="font-display font-semibold text-ink-200 text-sm">
                Day-by-Day Breakdown
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink-700/40">
                    {["Day", "Attempts", "Completions", "Rate", "Avg Score"].map((h) => (
                      <th
                        key={h}
                        className="text-left px-4 py-3 first:pl-6 text-ink-500 font-medium text-xs whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-800">
                  {isLoading
                    ? Array.from({ length: 5 }, (_, i) => (
                        <tr key={i}>
                          {Array.from({ length: 5 }, (_, j) => (
                            <td key={j} className="px-4 py-3 first:pl-6">
                              <div className="h-4 bg-ink-800 rounded animate-pulse" />
                            </td>
                          ))}
                        </tr>
                      ))
                    : stats.map((d) => (
                        <tr key={d.day} className="hover:bg-ink-800/40 transition-colors">
                          <td className="px-4 py-3.5 pl-6">
                            <span className="font-mono-data text-sprout-400 font-semibold text-xs">
                              Day {d.day}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 font-mono-data text-ink-400 text-xs">
                            {d.attempts}
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-2">
                              <span className="font-mono-data text-ink-200 text-xs">
                                {d.completions}
                              </span>
                              {d.completions > 0 && (
                                <CheckCircle className="w-3.5 h-3.5 text-sprout-500" />
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-1.5 bg-ink-700 rounded-full overflow-hidden flex-shrink-0">
                                <div
                                  className={`h-full rounded-full ${
                                    d.rate >= 70
                                      ? "bg-sprout-500"
                                      : d.rate >= 40
                                      ? "bg-amber-500"
                                      : "bg-red-500"
                                  }`}
                                  style={{ width: `${d.rate}%` }}
                                />
                              </div>
                              <span className="font-mono-data text-xs text-ink-300">
                                {d.rate}%
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3.5 font-mono-data text-ink-400 text-xs">
                            {d.avgScore != null ? `${d.avgScore}%` : "—"}
                          </td>
                        </tr>
                      ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}