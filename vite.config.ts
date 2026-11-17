import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  server: { host: "127.0.0.1" },
  build: {
    rollupOptions: {
      // F8 Inspector is development-only; never bundle its heavy React UI in production.
      external: ["@babylonjs/inspector"],
    },
  },
});
