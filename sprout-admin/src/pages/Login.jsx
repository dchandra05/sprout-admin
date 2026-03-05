import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { Sprout, Lock, Mail, AlertCircle, CheckCircle } from "lucide-react";

const ALLOWED_EMAIL = import.meta.env.VITE_ADMIN_EMAIL?.trim().toLowerCase() ?? null;

export default function LoginPage() {
  const { signIn, session, isAdmin, isLoading } = useAuth();
  const navigate = useNavigate();

  const [email,      setEmail]      = useState(ALLOWED_EMAIL ?? "");
  const [password,   setPassword]   = useState("");
  const [error,      setError]      = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Navigate only after isLoading resolves AND isAdmin is confirmed.
  // This prevents the guard from seeing a half-loaded state and bouncing back.
  useEffect(() => {
    if (!isLoading && session && isAdmin) {
      if (import.meta.env.DEV) console.log("[Login] admin confirmed, navigating to dashboard");
      navigate("/dashboard", { replace: true });
    }
  }, [isLoading, session, isAdmin, navigate]);

  const handleEmailChange = (e) => {
    setEmail(e.target.value);
    if (error) setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setError("");

    const normalizedEmail = email.trim().toLowerCase();

    if (ALLOWED_EMAIL && normalizedEmail !== ALLOWED_EMAIL) {
      setError("This email is not authorized to access the admin panel.");
      return;
    }

    if (import.meta.env.DEV) console.log("[Login] submitting for:", normalizedEmail);

    setSubmitting(true);
    try {
      await signIn(normalizedEmail, password);
      // Don't navigate here — the useEffect above handles it once
      // the profile finishes loading and isAdmin is confirmed.
    } catch (err) {
      if (import.meta.env.DEV) console.error("[Login] failed:", err.message);
      setError(err.message ?? "Sign in failed. Please try again.");
      setSubmitting(false);
    }
  };

  const emailIsAllowed = !ALLOWED_EMAIL || email.trim().toLowerCase() === ALLOWED_EMAIL;
  const showSpinner    = submitting || (session && isLoading);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(#22c55e 1px, transparent 1px), linear-gradient(90deg, #22c55e 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-sprout-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-sm relative z-10">
        <div className="flex flex-col items-center mb-10">
          <div className="w-12 h-12 bg-sprout-500 rounded-xl flex items-center justify-center mb-4 shadow-lg shadow-sprout-500/20">
            <Sprout className="w-7 h-7 text-white" />
          </div>
          <h1 className="font-display text-2xl font-bold text-ink-50">Sprout Admin</h1>
          <p className="text-ink-500 text-sm mt-1">Administrator access only</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {error && (
            <div className="flex items-start gap-2 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-ink-400 text-xs font-medium block">Email</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-600" />
              <input
                type="email"
                value={email}
                onChange={handleEmailChange}
                required
                autoComplete="email"
                placeholder="admin@example.com"
                disabled={showSpinner}
                className={`w-full bg-ink-800 border text-ink-100 rounded-xl pl-10 pr-10 py-3 text-sm placeholder:text-ink-600 focus:outline-none focus:ring-1 transition-colors disabled:opacity-50 ${
                  !emailIsAllowed && email.length > 0
                    ? "border-red-500/50 focus:border-red-500/50 focus:ring-red-500/20"
                    : "border-ink-700 focus:border-sprout-500/50 focus:ring-sprout-500/30"
                }`}
              />
              {emailIsAllowed && email.length > 0 && ALLOWED_EMAIL && (
                <CheckCircle className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-sprout-500" />
              )}
            </div>
            {!emailIsAllowed && email.length > 3 && (
              <p className="text-red-400 text-xs pl-1">Not an authorized admin email.</p>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-ink-400 text-xs font-medium block">Password</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-600" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="••••••••"
                disabled={showSpinner}
                className="w-full bg-ink-800 border border-ink-700 text-ink-100 rounded-xl pl-10 pr-4 py-3 text-sm placeholder:text-ink-600 focus:outline-none focus:border-sprout-500/50 focus:ring-1 focus:ring-sprout-500/30 transition-colors disabled:opacity-50"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={showSpinner || (!emailIsAllowed && email.length > 0)}
            className="w-full py-3 bg-sprout-500 hover:bg-sprout-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-xl text-sm transition-colors shadow-lg shadow-sprout-500/20 mt-2"
          >
            {showSpinner ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Signing in…
              </span>
            ) : (
              "Sign in"
            )}
          </button>
        </form>

        <p className="text-center text-ink-700 text-xs mt-8">
          Student app →{" "}
          <a href="/" className="text-ink-500 hover:text-ink-300 transition-colors underline underline-offset-2">
            sprout.app
          </a>
        </p>
      </div>
    </div>
  );
}