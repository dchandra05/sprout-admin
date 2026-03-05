import React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Cell,
} from "recharts";
import { Brain, CheckCircle, Clock, Star } from "lucide-react";
import { fetchAICourseStats } from "@/lib/adminApi";
import ChartCard from "@/components/ChartCard";
import StatCard  from "@/components/StatCard";

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

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div className="bg-ink-800 border border-ink-700 rounded-xl p-3 text-xs shadow-xl space-y-1.5 min-w-[160px]">
      <p className="text-ink-300 font-semibold">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex justify-between gap-4">
          <span className="text-ink-500 capitalize">{p.name}</span>
          <span className="font-mono-data text-ink-100">{p.value}{p.name === "rate" ? "%" : ""}</span>
        </div>
      ))}
    </div>
  );
};

export default function CoursesPage() {
  const { data: stats = [], isLoading } = useQuery({
    queryKey: ["aiCourseStats"],
    queryFn: fetchAICourseStats,
  });

  const totalCompletions   = stats.reduce((s, d) => s + d.completions, 0);
  const avgRate            = stats.length ? Math.round(stats.reduce((s, d) => s + d.rate, 0) / stats.length) : 0;
  const hardestDay         = stats.reduce((min, d) => (d.rate < (min?.rate ?? 999) ? d : min), null);
  const avgScoreOverall    = (() => {
    const scored = stats.filter((d) => d.avgScore != null);
    if (!scored.length) return null;
    return Math.round(scored.reduce((s, d) => s + d.avgScore, 0) / scored.length);
  })();

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink-50">AI Literacy Course</h1>
        <p className="text-ink-500 text-sm mt-1">Completion rates and performance analytics</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Completions"
          value={totalCompletions.toLocaleString()}
          sub="lesson completions across all users"
          icon={CheckCircle}
          accent="sprout"
          loading={isLoading}
        />
        <StatCard
          label="Avg Completion Rate"
          value={`${avgRate}%`}
          sub="across all 10 days"
          icon={Brain}
          accent="violet"
          loading={isLoading}
        />
        <StatCard
          label="Avg Quiz Score"
          value={avgScoreOverall != null ? `${avgScoreOverall}%` : "—"}
          sub="for completed lessons"
          icon={Star}
          accent="amber"
          loading={isLoading}
        />
        <StatCard
          label="Hardest Day"
          value={hardestDay ? `Day ${hardestDay.day}` : "—"}
          sub={hardestDay ? `${hardestDay.rate}% completion` : "No data yet"}
          icon={Clock}
          accent="red"
          loading={isLoading}
        />
      </div>

      {/* Bar charts */}
      <div className="grid lg:grid-cols-2 gap-6">
        <ChartCard
          title="Completions per Day"
          subtitle="Total students who completed each lesson"
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
                  <Cell key={i} fill={i < 3 ? "#22c55e" : i < 7 ? "#3b82f6" : "#8b5cf6"} />
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
              <XAxis dataKey="label" tick={{ fill: "#71717a", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} domain={[0, 100]} unit="%" />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="rate" radius={[4, 4, 0, 0]} maxBarSize={28} fill="#f59e0b" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Day-by-day table */}
      <div className="glass rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-ink-700/50">
          <h2 className="font-display font-semibold text-ink-200 text-sm">Day-by-Day Breakdown</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-700/40">
                {["Day", "Title", "Attempts", "Completions", "Rate", "Avg Score", "Avg Time"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 first:pl-6 text-ink-500 font-medium text-xs whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-800">
              {isLoading
                ? Array.from({ length: 10 }, (_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 7 }, (_, j) => (
                        <td key={j} className="px-4 py-3 first:pl-6">
                          <div className="h-4 bg-ink-800 rounded animate-pulse" />
                        </td>
                      ))}
                    </tr>
                  ))
                : stats.map((d) => (
                    <tr key={d.day} className="hover:bg-ink-800/40 transition-colors">
                      <td className="px-4 py-3.5 pl-6">
                        <span className="font-mono-data text-sprout-400 font-semibold text-xs">D{d.day}</span>
                      </td>
                      <td className="px-4 py-3.5 text-ink-300 max-w-[200px] truncate">
                        {DAY_TITLES[d.day - 1]}
                      </td>
                      <td className="px-4 py-3.5 font-mono-data text-ink-400 text-xs">{d.attempts}</td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono-data text-ink-200 text-xs">{d.completions}</span>
                          {d.completions > 0 && (
                            <CheckCircle className="w-3.5 h-3.5 text-sprout-500" />
                          )}
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
                      <td className="px-4 py-3.5 font-mono-data text-ink-400 text-xs">
                        {d.avgTime != null ? `${d.avgTime}m` : "—"}
                      </td>
                    </tr>
                  ))
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
