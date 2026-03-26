import React, { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";

import { AuthProvider, useAuth } from "@/lib/AuthContext";
import { queryClient }           from "@/lib/queryClient";

import LoginPage        from "@/pages/Login";
import DashboardPage    from "@/pages/Dashboard";
import UsersPage        from "@/pages/Users";
import UserDetailPage   from "@/pages/UserDetail";
import CoursesPage      from "@/pages/Courses";
import SimulationsPage  from "@/pages/Simulations";
import Layout           from "@/components/Layout";

function AdminGuard({ children }) {
  const { isLoading, session, isAdmin, signOut } = useAuth();

  useEffect(() => {
    if (!isLoading && session && !isAdmin) {
      if (import.meta.env.DEV) console.warn("[AdminGuard] not admin — signing out");
      signOut();
    }
  }, [isLoading, session, isAdmin]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-sprout-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-ink-500 text-sm">Verifying access…</p>
        </div>
      </div>
    );
  }

  if (!session) return <Navigate to="/login" replace />;

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-xs">
          <div className="text-5xl mb-5">🔒</div>
          <h1 className="font-display text-xl font-bold text-ink-50 mb-2">Not Authorized</h1>
          <p className="text-ink-400 text-sm">
            This account does not have admin access. Signing you out…
          </p>
        </div>
      </div>
    );
  }

  return children;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/*"
              element={
                <AdminGuard>
                  <Layout>
                    <Routes>
                      <Route index               element={<Navigate to="/dashboard" replace />} />
                      <Route path="dashboard"   element={<DashboardPage />} />
                      <Route path="users"       element={<UsersPage />} />
                      <Route path="users/:id"   element={<UserDetailPage />} />
                      <Route path="courses"     element={<CoursesPage />} />
                      <Route path="simulations" element={<SimulationsPage />} />
                      <Route path="*"           element={<Navigate to="/dashboard" replace />} />
                    </Routes>
                  </Layout>
                </AdminGuard>
              }
            />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}