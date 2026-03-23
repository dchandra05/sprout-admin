import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5174,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react:    ["react", "react-dom", "react-router-dom"],
          query:    ["@tanstack/react-query"],
          charts:   ["recharts"],
          supabase: ["@supabase/supabase-js"],
        },
      },
    },
  },
});
