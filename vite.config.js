import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import os from "node:os";
import path from "node:path";

// Keep Vite's dependency cache OUT of the Dropbox folder – Dropbox keeps
// locking node_modules/.vite and causing EBUSY errors during optimize.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  cacheDir: path.join(os.tmpdir(), "vite-finestate"),
  server: { port: 5180, strictPort: true },
});
