import React, { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import {
  LayoutDashboard, Users, BookOpen, LogOut,
  Sprout, Menu, X, ChevronRight,
} from "lucide-react";

const NAV = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/users",     icon: Users,           label: "Users"     },
  { to: "/courses",   icon: BookOpen,        label: "Courses"   },
];

export default function Layout({ children }) {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-30 flex flex-col w-60
          bg-ink-900 border-r border-ink-700/50
          transition-transform duration-200
          ${open ? "translate-x-0" : "-translate-x-full"}
          lg:translate-x-0 lg:static
        `}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-ink-700/50">
          <div className="w-8 h-8 bg-sprout-500 rounded-lg flex items-center justify-center flex-shrink-0">
            <Sprout className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-display font-bold text-ink-50 text-sm leading-none">Sprout</p>
            <p className="text-ink-500 text-xs mt-0.5">Admin Console</p>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="ml-auto lg:hidden text-ink-500 hover:text-ink-300"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {NAV.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group
                 ${isActive
                   ? "bg-sprout-500/10 text-sprout-400 border border-sprout-500/20"
                   : "text-ink-400 hover:text-ink-100 hover:bg-ink-800"
                 }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? "text-sprout-400" : "text-ink-500 group-hover:text-ink-300"}`} />
                  <span>{label}</span>
                  {isActive && <ChevronRight className="w-3 h-3 ml-auto text-sprout-500" />}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User footer */}
        <div className="px-3 pb-4 space-y-1 border-t border-ink-700/50 pt-3">
          <div className="px-3 py-2">
            <p className="text-xs text-ink-500 truncate">{profile?.full_name || "Admin"}</p>
            <p className="text-xs text-ink-600 truncate">{profile?.email}</p>
          </div>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-ink-400 hover:text-red-400 hover:bg-red-500/5 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {open && (
        <div
          className="fixed inset-0 z-20 bg-black/60 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile topbar */}
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 border-b border-ink-700/50 bg-ink-900">
          <button onClick={() => setOpen(true)} className="text-ink-400 hover:text-ink-100">
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <Sprout className="w-4 h-4 text-sprout-400" />
            <span className="font-display font-bold text-ink-50 text-sm">Admin</span>
          </div>
        </header>

        <main className="flex-1 p-6 lg:p-8 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
