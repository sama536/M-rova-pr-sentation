import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

// L'interface compilée est servie par le serveur Python (backend/app/static).
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  build: { outDir: "../backend/app/static", emptyOutDir: true, chunkSizeWarningLimit: 900 },
  server: { port: 5173, proxy: { "/api": "http://127.0.0.1:8000" } },
});
