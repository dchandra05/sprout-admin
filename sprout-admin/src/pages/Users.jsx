import React, { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { format, parseISO, formatDistanceToNow } from "date-fns";
import { Search, ChevronRight, Users, Brain, Zap } from "lucide-react";
import { fetchAllUsers } from "@/lib/adminApi";

function useDebounce(value, delay = 350) {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

function RoleBadge({ role }) {
  if (role === "admin") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium">
        Admin
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-ink-700 border border-ink-600 text-ink-400 text-xs">
      User
    </span>
  );
}

function LastSeen({ ts }) {
  if (!ts) return <span className="text-ink-600">Never</span>;
  try {
    return (
      <span className="text-ink-400" title={format(parseISO(ts), "PPpp")}>
        {formatDistanceToNow(parseISO(ts), { addSuffix: true })}
      </span>
    );
  } catch {
    return <span className="text-ink-600">—</span>;
  }
}

export default function UsersPage() {
  const navigate  = useNavigate();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search);

  const { data, isLoading } = useQuery({
    queryKey: ["users", debouncedSearch],
    queryFn: () => fetchAllUsers({ search: debouncedSearch }),
  });

  const users = data?.users ?? [];
  const total = data?.total ?? 0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink-50">Users</h1>
          <p className="text-ink-500 text-sm mt-1">
            {isLoading ? "Loading…" : `${total.toLocaleString()} total users`}
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-600" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email…"
          className="w-full bg-ink-800 border border-ink-700 text-ink-100 rounded-xl pl-11 pr-4 py-3 text-sm placeholder:text-ink-600 focus:outline-none focus:border-sprout-500/50 focus:ring-1 focus:ring-sprout-500/30 transition-colors"
        />
      </div>

      {/* Table */}
      <div className="glass rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-700/60">
                {["User", "Role", "XP / Level", "AI Progress", "Last Seen", "Joined", ""].map((h) => (
                  <th
                    key={h}
                    className="text-left text-ink-500 font-medium text-xs px-4 py-3 first:pl-6 last:pr-6 whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-800">
              {isLoading
                ? Array.from({ length: 8 }, (_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 7 }, (_, j) => (
                        <td key={j} className="px-4 py-4 first:pl-6">
                          <div className="h-4 bg-ink-800 rounded animate-pulse" style={{ width: `${60 + j * 10}%` }} />
                        </td>
                      ))}
                    </tr>
                  ))
                : users.map((u) => (
                    <tr
                      key={u.id}
                      onClick={() => navigate(`/users/${u.id}`)}
                      className="hover:bg-ink-800/50 cursor-pointer transition-colors group"
                    >
                      {/* User */}
                      <td className="px-4 py-4 pl-6">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-sprout-500/20 border border-sprout-500/30 flex items-center justify-center text-sprout-400 font-display font-bold text-sm flex-shrink-0">
                            {(u.full_name || u.email || "?")[0].toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-ink-100 font-medium truncate max-w-[180px]">
                              {u.full_name || "—"}
                            </p>
                            <p className="text-ink-500 text-xs truncate max-w-[180px]">{u.email}</p>
                          </div>
                        </div>
                      </td>

                      {/* Role */}
                      <td className="px-4 py-4">
                        <RoleBadge role={u.role} />
                      </td>

                      {/* XP / Level */}
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-1.5">
                          <Zap className="w-3.5 h-3.5 text-amber-400" />
                          <span className="font-mono-data text-ink-200 text-xs">
                            {(u.xp_points ?? 0).toLocaleString()}
                          </span>
                          <span className="text-ink-600 text-xs">· Lv.{u.level ?? 1}</span>
                        </div>
                      </td>

                      {/* AI Progress */}
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <Brain className="w-3.5 h-3.5 text-violet-400 flex-shrink-0" />
                          <div className="flex items-center gap-1">
                            <span className="font-mono-data text-xs text-ink-200">
                              {u.ai_days_completed ?? 0}
                            </span>
                            <span className="text-ink-600 text-xs">/10</span>
                          </div>
                          {/* Mini progress bar */}
                          <div className="w-16 h-1.5 bg-ink-700 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-violet-500 rounded-full"
                              style={{ width: `${((u.ai_days_completed ?? 0) / 10) * 100}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Last Seen */}
                      <td className="px-4 py-4 text-xs">
                        <LastSeen ts={u.last_seen_at} />
                      </td>

                      {/* Joined */}
                      <td className="px-4 py-4 text-xs text-ink-500 font-mono-data">
                        {u.created_at ? format(parseISO(u.created_at), "MMM d, yyyy") : "—"}
                      </td>

                      {/* Arrow */}
                      <td className="px-4 py-4 pr-6">
                        <ChevronRight className="w-4 h-4 text-ink-700 group-hover:text-ink-400 transition-colors" />
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>

          {!isLoading && users.length === 0 && (
            <div className="flex flex-col items-center py-16 text-ink-600">
              <Users className="w-10 h-10 mb-3 opacity-40" />
              <p className="text-sm">No users found{search ? ` matching "${search}"` : ""}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
