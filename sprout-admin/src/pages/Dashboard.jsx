import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import {
  Users, UserCheck, TrendingUp, Activity,
  Brain, Calendar,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import StatCard  from "@/components/StatCard";
import ChartCard from "@/components/ChartCard";
import { fetchKPIs, fetchDailySignups, fetchDailyActiveUsers } from "@/lib/adminApi";

const RANGE_OPTIONS = [
  { label: "7d",  days: 7  },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
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

const CustomTooltip = ({ active, payload, label, valueLabel }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-ink-800 border border-ink-700 rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="text-ink-400 mb-1">{label}</p>
      <p className="text-ink-100 font-semibold font-mono-data">
        {payload[0].value} {valueLabel}
      </p>
    </div>
  );
};

export default function DashboardPage() {
  const [range, setRange] = useState(30);

  const { data: kpis, isLoading: kpiLoading } = useQuery({
    queryKey: ["kpis"],
    queryFn: fetchKPIs,
    refetchInterval: 60_000,
  });

  const { data: signupData = [], isLoading: signupLoading } = useQuery({
    queryKey: ["dailySignups", range],
    queryFn: () => fetchDailySignups(range),
  });

  const { data: dauData = [], isLoading: dauLoading } = useQuery({
    queryKey: ["dau", range],
    queryFn: () => fetchDailyActiveUsers(range),
  });

  const fmtDate = (str) => {
    try { return format(parseISO(str), range <= 7 ? "EEE d" : "MMM d"); }
    catch { return str; }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Page header */}
      <div>
        <h1 className="font-display text-2xl font-bold text-ink-50">Dashboard</h1>
        <p className="text-ink-500 text-sm mt-1">Platform overview and activity trends</p>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Users"
          value={kpis?.totalUsers?.toLocaleString()}
          sub={`+${kpis?.newUsersWeek ?? 0} this week`}
          icon={Users}
          accent="sprout"
          loading={kpiLoading}
        />
        <StatCard
          label="Daily Active (DAU)"
          value={kpis?.dau?.toLocaleString()}
          sub={`${kpis?.wau ?? 0} WAU · ${kpis?.mau ?? 0} MAU`}
          icon={Activity}
          accent="blue"
          loading={kpiLoading}
        />
        <StatCard
          label="New Users Today"
          value={kpis?.newUsersToday?.toLocaleString()}
          sub={`${kpis?.newUsersMonth ?? 0} this month`}
          icon={TrendingUp}
          accent="violet"
          loading={kpiLoading}
        />
        <StatCard
          label="AI Lessons Completed"
          value={kpis?.aiCompletions?.toLocaleString()}
          sub="all time, all users"
          icon={Brain}
          accent="amber"
          loading={kpiLoading}
        />
      </div>

      {/* DAU/WAU/MAU summary row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "DAU", value: kpis?.dau, sub: "Last 24 h" },
          { label: "WAU", value: kpis?.wau, sub: "Last 7 days" },
          { label: "MAU", value: kpis?.mau, sub: "Last 30 days" },
        ].map(({ label, value, sub }) => (
          <div key={label} className="glass rounded-2xl p-5 flex items-center gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-ink-500 text-xs">{sub}</p>
              <p className="font-display text-2xl font-bold text-ink-50 tabular-nums mt-0.5">
                {kpiLoading ? "—" : (value ?? 0).toLocaleString()}
              </p>
            </div>
            <div className="text-right">
              <p className="font-display text-xs font-bold text-ink-600">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-6">
        <ChartCard
          title="New Signups"
          subtitle="Users who created an account"
          loading={signupLoading}
          action={<RangePicker value={range} onChange={setRange} />}
        >
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={signupData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="signupGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#22c55e" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0}   />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#27272a" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={fmtDate}
                tick={{ fill: "#71717a", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fill: "#71717a", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip content={<CustomTooltip valueLabel="new users" />} />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#22c55e"
                strokeWidth={2}
                fill="url(#signupGrad)"
                dot={false}
                activeDot={{ r: 4, fill: "#22c55e", stroke: "#09090b", strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Daily Active Users"
          subtitle="Unique users with any activity"
          loading={dauLoading}
          action={<RangePicker value={range} onChange={setRange} />}
        >
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={dauData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid stroke="#27272a" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={fmtDate}
                tick={{ fill: "#71717a", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fill: "#71717a", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip content={<CustomTooltip valueLabel="active users" />} />
              <Bar
                dataKey="value"
                fill="#3b82f6"
                radius={[4, 4, 0, 0]}
                maxBarSize={32}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}
