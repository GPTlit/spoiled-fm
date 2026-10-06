// Native Android (Capacitor) build only. The web build keeps using vite.config.ts.
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindPostcss from "@tailwindcss/postcss";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  css: { postcss: { plugins: [tailwindPostcss()] } },
  define: {
    "process.env": {},
    "import.meta.env.VITE_NATIVE": JSON.stringify("1"),
  },
  build: { outDir: "dist-capacitor", emptyOutDir: true },
});
