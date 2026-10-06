// Native Android (Capacitor) build only. The web build keeps using vite.config.ts.
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindPostcss from "@tailwindcss/postcss";
import path from "path";

export default defineConfig({
  root: path.resolve(__dirname, "capacitor"),
  publicDir: path.resolve(__dirname, "public"),
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  css: { postcss: { plugins: [tailwindPostcss()] } },
  define: {
    "process.env": {},
    "import.meta.env.VITE_NATIVE": JSON.stringify("1"),
  },
  build: {
    outDir: path.resolve(__dirname, "dist-capacitor"),
    emptyOutDir: true,
  },
});
