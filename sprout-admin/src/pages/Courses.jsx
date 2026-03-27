// sprout-admin/src/pages/Courses.jsx
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

// ─── Tooltip ──────────────────────────────────────────────────────────────────

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
  if (loading) return <div className="h-10 w-56 bg-ink-800 rounded-xl animate-pulse" />;
  if (!courses.length) return <p className="text-ink-500 text-sm">No courses found in the database.</p>;

  return (
    <div className="relative">
      <select
        value={selected?.id ?? ""}
        onChange={(e) => onChange(courses.find((c) => c.id === e.target.value) ?? null)}
        className="appearance-none bg-ink-800 border border-ink-700 text-ink-100 text-sm rounded-xl px-4 pr-10 py-2.5 focus:outline-none focus:border-sprout-500/50 focus:ring-1 focus:ring-sprout-500/30 cursor-pointer min-w-[220px]"
      >
        {courses.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-500 pointer-events-none" />
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CoursesPage() {
  const [selectedCourse, setSelectedCourse] = useState(null);

  const { data: courses = [], isLoading: coursesLoading } = useQuery({
    queryKey: ["courses"],
    queryFn:  fetchCourses,
  });

  React.useEffect(() => {
    if (courses.length > 0 && !selectedCourse) setSelectedCourse(courses[0]);
  }, [courses]);

  const trackingType = selectedCourse?.tracking_type ?? "lesson";
  const isDay        = trackingType === "day";
  const unitLabel    = isDay ? "Day" : "Lesson";
  const unitLabelPl  = isDay ? "Days" : "Lessons";

  const { data: stats = [], isLoading: statsLoading } = useQuery({
    queryKey: ["courseStats", selectedCourse?.id],
    queryFn:  () => fetchCourseStats(
      selectedCourse.id,
      selectedCourse.slug,
      selectedCourse.total_days ?? 10,
      trackingType
    ),
    enabled: !!selectedCourse,
  });

  const { data: enrollment = { enrolled: 0, completed: 0 }, isLoading: enrollLoading } = useQuery({
    queryKey: ["courseEnrollment", selectedCourse?.id],
    queryFn:  () => fetchEnrolledCount(selectedCourse.id, selectedCourse.slug),
    enabled:  !!selectedCourse,
  });

  const isLoading = statsLoading || enrollLoading;

  // ─── Derived KPIs ───────────────────────────────────────────────────────────
  const totalCompletions = stats.reduce((s, d) => s + d.completions, 0);
  const unitCount        = stats.length;
  const avgRate = unitCount
    ? Math.round(stats.reduce((s, d) => s + d.rate, 0) / unitCount)
    : 0;
  const hardestUnit = stats.reduce(
    (min, d) => (d.attempts > 0 && d.rate < (min?.rate ?? 999) ? d : min),
    null
  );
  const scoredUnits = stats.filter((d) => d.avgScore != null);
  const avgScore    = scoredUnits.length
    ? Math.round(scoredUnits.reduce((s, d) => s + d.avgScore, 0) / scoredUnits.length)
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

      {/* Empty state */}
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
              sub={`${unitLabel.toLowerCase()} completions across all users`}
              icon={CheckCircle}
              accent="violet"
              loading={isLoading}
            />
            <StatCard
              label="Avg Completion Rate"
              value={isLoading ? null : `${avgRate}%`}
              sub={unitCount > 0
                ? `across ${unitCount} ${unitLabelPl.toLowerCase()}`
                : "no data yet"}
              icon={BookOpen}
              accent="blue"
              loading={isLoading}
            />
            <StatCard
              label="Avg Quiz Score"
              value={isLoading ? null : (avgScore != null ? `${avgScore}%` : "—")}
              sub="for completed lessons with quizzes"
              icon={Star}
              accent="amber"
              loading={isLoading}
            />
          </div>

          {/* Hardest unit banner */}
          {!isLoading && hardestUnit && hardestUnit.rate < 80 && (
            <div className="glass rounded-2xl px-6 py-4 border border-red-500/20 bg-red-500/5 flex items-center gap-3">
              <Clock className="w-5 h-5 text-red-400 flex-shrink-0" />
              <p className="text-sm text-ink-300">
                <span className="text-red-400 font-semibold">
                  Hardest {unitLabel.toLowerCase()}:
                </span>{" "}
                {hardestUnit.fullLabel} — only{" "}
                <span className="font-mono text-red-300">{hardestUnit.rate}%</span> completion rate.
                Consider reviewing the content for this {unitLabel.toLowerCase()}.
              </p>
            </div>
          )}

          {/* No data state for lesson-based courses */}
          {!isLoading && stats.length === 0 && (
            <div className="glass rounded-2xl p-8 text-center">
              <BookOpen className="w-8 h-8 text-ink-700 mx-auto mb-3" />
              <p className="text-ink-500 text-sm">No progress data yet for this course.</p>
              <p className="text-ink-700 text-xs mt-1">
                Data appears once students complete lessons and the main app calls{" "}
                <code className="text-ink-500">trackLessonComplete()</code>.
              </p>
            </div>
          )}

          {stats.length > 0 && (
            <>
              {/* Charts */}
              <div className="grid lg:grid-cols-2 gap-6">
                <ChartCard
                  title={`Completions per ${unitLabel}`}
                  subtitle={`Total students who completed each ${unitLabel.toLowerCase()}`}
                  loading={isLoading}
                >
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={stats} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                      <CartesianGrid stroke="#27272a" strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="label" tick={{ fill: "#71717a", fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
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
                  title={`Completion Rate per ${unitLabel}`}
                  subtitle={`% of students who started and finished each ${unitLabel.toLowerCase()}`}
                  loading={isLoading}
                >
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={stats} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                      <CartesianGrid stroke="#27272a" strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="label" tick={{ fill: "#71717a", fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} domain={[0, 100]} unit="%" />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="rate" radius={[4, 4, 0, 0]} maxBarSize={28} fill="#f59e0b" />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              </div>

              {/* Quiz score chart — only shown when quiz data exists */}
              {scoredUnits.length > 0 && (
                <ChartCard
                  title={`Avg Quiz Score per ${unitLabel}`}
                  subtitle={`Average score among students who completed each ${unitLabel.toLowerCase()}`}
                  loading={isLoading}
                >
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={stats} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                      <CartesianGrid stroke="#27272a" strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="label" tick={{ fill: "#71717a", fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} domain={[0, 100]} unit="%" />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="avgScore" radius={[4, 4, 0, 0]} maxBarSize={28} fill="#6366f1" />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              )}

              {/* Breakdown table */}
              <div className="glass rounded-2xl overflow-hidden">
                <div className="px-6 py-4 border-b border-ink-700/50">
                  <h2 className="font-display font-semibold text-ink-200 text-sm">
                    {unitLabel}-by-{unitLabel} Breakdown
                  </h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-ink-700/40">
                        {[unitLabel, "Attempts", "Completions", "Rate", "Avg Score"].map((h) => (
                          <th key={h} className="text-left px-4 py-3 first:pl-6 text-ink-500 font-medium text-xs whitespace-nowrap">
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
                            <tr key={d.unit} className="hover:bg-ink-800/40 transition-colors">
                              <td className="px-4 py-3.5 pl-6">
                                <span className="font-mono-data text-sprout-400 font-semibold text-xs">
                                  {d.fullLabel}
                                </span>
                              </td>
                              <td className="px-4 py-3.5 font-mono-data text-ink-400 text-xs">
                                {d.attempts}
                              </td>
                              <td className="px-4 py-3.5">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono-data text-ink-200 text-xs">{d.completions}</span>
                                  {d.completions > 0 && <CheckCircle className="w-3.5 h-3.5 text-sprout-500" />}
                                </div>
                              </td>
                              <td className="px-4 py-3.5">
                                <div className="flex items-center gap-2">
                                  <div className="w-16 h-1.5 bg-ink-700 rounded-full overflow-hidden flex-shrink-0">
                                    <div
                                      className={`h-full rounded-full ${d.rate >= 70 ? "bg-sprout-500" : d.rate >= 40 ? "bg-amber-500" : "bg-red-500"}`}
                                      style={{ width: `${d.rate}%` }}
                                    />
                                  </div>
                                  <span className="font-mono-data text-xs text-ink-300">{d.rate}%</span>
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
        </>
      )}
    </div>
  );
}
