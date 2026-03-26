import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Monitor, CheckCircle, TrendingUp, Users } from "lucide-react";
import { fetchSimulationStats } from "@/lib/adminApi";
import StatCard from "@/components/StatCard";

const RANGE_OPTIONS = [
  { label: "7d",  days: 7  },
  { label: "30d", days: 30 },
  { label: "All", days: 0  },
];

function RangePicker({ value, onChange }) {
  return (
    <div className="flex items-center gap-1 bg-ink-800 rounded-lg p-1">
      {RANGE_OPTIONS.map((o) => (
        <button
          key={o.days}
          onClick={() => onChange(o.days)}
          className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
            value === o.days
              ? "bg-sprout-500 text-white"
              : "text-ink-400 hover:text-ink-200"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function CategoryBadge({ category }) {
  const styles = {
    budgeting: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    investing: "bg-violet-500/10 text-violet-400 border-violet-500/20",
    paycheck:  "bg-amber-500/10 text-amber-400 border-amber-500/20",
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded border text-xs font-medium ${styles[category] ?? "bg-ink-700 text-ink-400 border-ink-600"}`}>
      {category}
    </span>
  );
}

export default function SimulationsPage() {
  const [range, setRange] = useState(30);

  const { data: sims = [], isLoading } = useQuery({
    queryKey: ["simulationStats", range],
    queryFn: () => fetchSimulationStats(range),
  });

  const totalStarts      = sims.reduce((s, r) => s + r.uniqueStarts, 0);
  const totalCompletions = sims.reduce((s, r) => s + r.uniqueCompletions, 0);
  const overallRate      = totalStarts > 0 ? Math.round((totalCompletions / totalStarts) * 100) : 0;
  const mostUsed         = sims.reduce((best, r) => (r.uniqueStarts > (best?.uniqueStarts ?? -1) ? r : best), null);

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink-50">Simulations</h1>
          <p className="text-ink-500 text-sm mt-1">Usage and completion rates across all interactive simulations</p>
        </div>
        <RangePicker value={range} onChange={setRange} />
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Sessions Started"
          value={isLoading ? null : totalStarts.toLocaleString()}
          sub="unique users who opened a sim"
          icon={Monitor}
          accent="sprout"
          loading={isLoading}
        />
        <StatCard
          label="Total Completions"
          value={isLoading ? null : totalCompletions.toLocaleString()}
          sub="unique users who finished a sim"
          icon={CheckCircle}
          accent="blue"
          loading={isLoading}
        />
        <StatCard
          label="Overall Completion Rate"
          value={isLoading ? null : `${overallRate}%`}
          sub="across all simulations"
          icon={TrendingUp}
          accent="violet"
          loading={isLoading}
        />
        <StatCard
          label="Most Used"
          value={isLoading ? null : (mostUsed?.uniqueStarts > 0 ? mostUsed.name : "—")}
          sub={mostUsed?.uniqueStarts > 0 ? `${mostUsed.uniqueStarts} sessions` : "no data yet"}
          icon={Users}
          accent="amber"
          loading={isLoading}
        />
      </div>

      {/* Simulation table */}
      <div className="glass rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-ink-700/50">
          <h2 className="font-display font-semibold text-ink-200 text-sm">All Simulations</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-700/40">
                {["Simulation", "Category", "Unique Starts", "Completions", "Completion Rate"].map((h) => (
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
                ? Array.from({ length: 7 }, (_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 5 }, (_, j) => (
                        <td key={j} className="px-4 py-3.5 first:pl-6">
                          <div className="h-4 bg-ink-800 rounded animate-pulse" />
                        </td>
                      ))}
                    </tr>
                  ))
                : sims.map((sim) => (
                    <tr key={sim.slug} className="hover:bg-ink-800/40 transition-colors">
                      <td className="px-4 py-3.5 pl-6">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-ink-700 flex items-center justify-center flex-shrink-0">
                            <Monitor className="w-3.5 h-3.5 text-ink-400" />
                          </div>
                          <span className="text-ink-100 font-medium text-xs">{sim.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <CategoryBadge category={sim.category} />
                      </td>
                      <td className="px-4 py-3.5 font-mono-data text-ink-300 text-xs">
                        {sim.uniqueStarts.toLocaleString()}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono-data text-ink-200 text-xs">
                            {sim.uniqueCompletions.toLocaleString()}
                          </span>
                          {sim.uniqueCompletions > 0 && (
                            <CheckCircle className="w-3.5 h-3.5 text-sprout-500" />
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        {sim.uniqueStarts > 0 ? (
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 bg-ink-700 rounded-full overflow-hidden flex-shrink-0">
                              <div
                                className={`h-full rounded-full ${
                                  sim.completionRate >= 70
                                    ? "bg-sprout-500"
                                    : sim.completionRate >= 40
                                    ? "bg-amber-500"
                                    : "bg-red-500"
                                }`}
                                style={{ width: `${sim.completionRate}%` }}
                              />
                            </div>
                            <span className="font-mono-data text-xs text-ink-300">{sim.completionRate}%</span>
                          </div>
                        ) : (
                          <span className="text-ink-700 text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>

          {!isLoading && sims.every((s) => s.uniqueStarts === 0) && (
            <div className="flex flex-col items-center py-12 text-ink-600">
              <Monitor className="w-8 h-8 mb-3 opacity-40" />
              <p className="text-sm">No simulation data yet.</p>
              <p className="text-xs mt-1 text-ink-700">
                Data appears once the main app calls <code className="text-ink-500">trackSimulationStart()</code>.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
