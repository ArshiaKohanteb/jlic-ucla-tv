import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

// Builds into dist/. TV_BASE is the path the site lives at (GitHub Pages sets it),
// so the same code works on github.io/<repo>/ or a custom domain.
//   /          → the TV display
//   /admin/    → the manager dashboard
//   /flipped/  → the display for an upside-down TV
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
        display: resolve(__dirname, "tv/index.html"),
        admin: resolve(__dirname, "tv/admin/index.html"),
        flipped: resolve(__dirname, "tv/flipped/index.html"),
      },
    },
  },
  server: { fs: { allow: [resolve(__dirname, "..")] } },
});
