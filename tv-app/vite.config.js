import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

// Builds into dist/. TV_BASE is the path the site lives at (GitHub Pages sets it),
// so the same code works on github.io/<repo>/ or a custom domain.
//   /             → the sign-up site
//   /tv/          → the TV display
//   /tv/flipped/  → the display for an upside-down TV
//   /admin/       → the manager dashboard
export default defineConfig({
  root: resolve(__dirname, "tv"),
  base: process.env.TV_BASE || "/",
  plugins: [react()],
  build: {
    outDir: resolve(__dirname, "dist"),
    emptyOutDir: true,
    target: "es2018",
    rollupOptions: {
      input: {
        app: resolve(__dirname, "tv/index.html"),
        display: resolve(__dirname, "tv/tv/index.html"),
        admin: resolve(__dirname, "tv/admin/index.html"),
        flipped: resolve(__dirname, "tv/tv/flipped/index.html"),
      },
    },
  },
  server: { fs: { allow: [resolve(__dirname, "..")] } },
});
