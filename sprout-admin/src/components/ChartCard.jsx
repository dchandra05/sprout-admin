import React from "react";

export default function ChartCard({ title, subtitle, children, loading, action }) {
  return (
    <div className="glass rounded-2xl p-6">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h3 className="font-display font-semibold text-ink-100 text-base">{title}</h3>
          {subtitle && <p className="text-ink-500 text-xs mt-0.5">{subtitle}</p>}
        </div>
        {action}
      </div>

      {loading ? (
        <div className="h-48 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-sprout-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        children
      )}
    </div>
  );
}
