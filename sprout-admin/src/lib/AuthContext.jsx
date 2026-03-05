import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

const AuthContext = createContext(null);

const ALLOWED_ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL?.trim().toLowerCase() ?? null;

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined);  // undefined = still initializing
  const [profile, setProfile] = useState(undefined);  // undefined = not yet fetched

  // ─── 1. Session bootstrap ───────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) console.error("[AdminAuth] getSession error:", error.message);
      setSession(data.session ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      if (import.meta.env.DEV) console.log("[AdminAuth] auth event:", event);
      setSession(s);
      if (!s) setProfile(null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // ─── 2. Profile fetch ───────────────────────────────────────────────────────
  useEffect(() => {
    if (session === undefined) return;

    if (!session?.user) {
      setProfile(null);
      return;
    }

    const userId = session.user.id;
    const email  = session.user.email;

    if (import.meta.env.DEV) console.log("[AdminAuth] fetching profile for", email);

    supabase
      .from("profiles")
      .select("*")
      .or(`id.eq.${userId},email.eq.${email}`)
      .maybeSingle()
      .then(async ({ data: existing, error: fetchError }) => {
        if (fetchError) {
          console.error("[AdminAuth] profile fetch error:", fetchError.message);
          setProfile(null);
          return;
        }

        if (existing) {
          if (import.meta.env.DEV) console.log("[AdminAuth] profile loaded, role:", existing.role);
          setProfile(existing);
          supabase
            .from("profiles")
            .update({ last_seen_at: new Date().toISOString() })
            .or(`id.eq.${userId},email.eq.${email}`)
            .then(() => {});
        } else {
          if (import.meta.env.DEV) console.log("[AdminAuth] no profile found, creating one");
          const newProfile = {
            id:           userId,
            email:        email,
            full_name:    session.user.user_metadata?.full_name ?? "",
            role:         "user",
            last_seen_at: new Date().toISOString(),
            created_at:   new Date().toISOString(),
          };
          const { data: created, error: insertError } = await supabase
            .from("profiles")
            .upsert(newProfile, { onConflict: "id" })
            .select()
            .single();

          if (insertError) {
            console.error("[AdminAuth] profile create error:", insertError.message);
            setProfile(null);
          } else {
            if (import.meta.env.DEV) console.log("[AdminAuth] profile created, role:", created.role);
            setProfile(created);
          }
        }
      });
  }, [session?.user?.id, session === undefined ? "init" : "ready"]);

  // ─── 3. signIn ──────────────────────────────────────────────────────────────
  const signIn = async (email, password) => {
    const normalized = email.trim().toLowerCase();

    if (ALLOWED_ADMIN_EMAIL && normalized !== ALLOWED_ADMIN_EMAIL) {
      throw new Error("This email is not authorized to access the admin panel.");
    }

    if (import.meta.env.DEV) console.log("[AdminAuth] signing in:", normalized);

    const { data, error } = await supabase.auth.signInWithPassword({ email: normalized, password });

    if (error) {
      if (import.meta.env.DEV) console.error("[AdminAuth] signIn error:", error.message);
      if (
        error.message?.toLowerCase().includes("invalid login") ||
        error.message?.toLowerCase().includes("invalid credentials") ||
        error.message?.toLowerCase().includes("email not confirmed")
      ) {
        throw new Error("Incorrect email or password.");
      }
      throw new Error(error.message ?? "Sign in failed. Check your connection and try again.");
    }

    if (!data?.session) {
      throw new Error("Sign in succeeded but no session was returned. Check your Supabase project settings.");
    }

    if (import.meta.env.DEV) console.log("[AdminAuth] sign in successful");
  };

  // ─── 4. signOut ─────────────────────────────────────────────────────────────
  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
  };

  const isLoading = session === undefined || profile === undefined;
  const isAdmin   = profile?.role === "admin";

  return (
    <AuthContext.Provider value={{ session, profile, isLoading, isAdmin, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}