import { defineConfig } from "vite";
import { writeFileSync } from "node:fs";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

// The app was first written for a phone wrapper (Capacitor). On the web the
// splash screen has nothing to hide, so that import points at a no-op.
//
// The app is the home page (index.html). The public pages — about, guides,
// privacy, contact — are plain HTML generated into public/ by
// scripts/build-site.mjs, so search engines and AdSense can read them.
const buildId = process.env.GITHUB_SHA || `build-${Date.now()}`;
export default defineConfig({
  define: { __APP_BUILD_ID__: JSON.stringify(buildId) },
  plugins: [react(), { name: "publish-version", closeBundle() { writeFileSync("dist/version.json", JSON.stringify({ version: buildId })); } }],
  resolve: {
    alias: {
      "@capacitor/splash-screen": fileURLToPath(new URL("./src/stubs/splash.js", import.meta.url)),
    },
  },
  build: { chunkSizeWarningLimit: 1500 },
});
