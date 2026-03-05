import React from "react";

export default function StatCard({ label, value, sub, icon: Icon, accent = "sprout", loading }) {
  const accents = {
    sprout: "text-sprout-400 bg-sprout-500/10 border-sprout-500/20",
    blue:   "text-blue-400 bg-blue-500/10 border-blue-500/20",
    violet: "text-violet-400 bg-violet-500/10 border-violet-500/20",
    amber:  "text-amber-400 bg-amber-500/10 border-amber-500/20",
    red:    "text-red-400 bg-red-500/10 border-red-500/20",
  };

  const iconClasses = accents[accent] ?? accents.sprout;

  return (
    <div className="stat-card flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <p className="text-ink-400 text-sm font-medium">{label}</p>
        {Icon && (
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center border ${iconClasses}`}>
            <Icon className="w-4 h-4" />
          </div>
        )}
      </div>

      {loading ? (
        <div className="h-8 w-24 bg-ink-700 rounded animate-pulse" />
      ) : (
        <div>
          <p className="font-display text-3xl font-bold text-ink-50 tabular-nums leading-none">
            {value ?? "—"}
          </p>
          {sub && <p className="text-ink-500 text-xs mt-1.5">{sub}</p>}
        </div>
      )}
    </div>
  );
}
