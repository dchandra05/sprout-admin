import { createClient } from "@supabase/supabase-js";

const supabaseUrl     = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// ─── Startup diagnostics (dev only, never prints secret values) ──────────────
if (import.meta.env.DEV) {
  console.group("[Sprout Admin] Supabase config check");
  console.log("VITE_SUPABASE_URL    :", supabaseUrl
    ? `✅ set → ${supabaseUrl}`
    : "❌ MISSING — requests will fail with 'Failed to fetch'");
  console.log("VITE_SUPABASE_ANON_KEY:", supabaseAnonKey
    ? `✅ set (length=${supabaseAnonKey.length})`
    : "❌ MISSING");
  console.log("VITE_ADMIN_EMAIL     :", import.meta.env.VITE_ADMIN_EMAIL
    ? "✅ set"
    : "⚠️  not set — set this in .env.local to restrict login to one email");
  console.groupEnd();
}

// Hard guard: createClient(undefined, ...) makes requests to the literal string
// "undefined/auth/v1/token" which is the root cause of "Failed to fetch".
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "[Sprout Admin] Missing env vars.\n" +
    "Create sprout-admin/.env.local with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY,\n" +
    "then restart the Vite dev server (env vars are baked in at build time)."
  );
}

try {
  new URL(supabaseUrl);
} catch {
  throw new Error(
    `[Sprout Admin] VITE_SUPABASE_URL is not a valid URL: "${supabaseUrl}"`
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession:     true,
    storageKey:         "sprout-admin-auth",
    autoRefreshToken:   true,
    detectSessionInUrl: true,
  },
});

// Dev helper: run window.__sproutCheck() in the browser console
if (import.meta.env.DEV) {
  window.__sproutCheck = async () => {
    console.group("[Sprout Admin] Live connectivity check");
    try {
      const { data, error } = await supabase.auth.getSession();
      console.log(error ? "❌ Error:" : "✅ Reachable. Session:", error?.message ?? (data.session ? "active" : "none"));
    } catch (e) {
      console.error("❌ Network error:", e.message);
    }
    console.groupEnd();
  };
  console.info("[Sprout Admin] Tip: run window.__sproutCheck() in the console to test connectivity.");
}