import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import os from "node:os";
import path from "node:path";
import https from "node:https";

function fetchXml(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { insecureHTTPParser: true, timeout: 12_000 }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          resolve(fetchXml(new URL(res.headers.location, url).toString()));
          return;
        }
        let data = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => resolve(data));
      })
      .on("timeout", function () { this.destroy(new Error("Timed out")); })
      .on("error", reject);
  });
}

// Local dev answers the same /api paths that Vercel answers in production.
function rssDevServer() {
  return {
    name: "rss-dev",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url && req.url.startsWith("/api/article?")) {
          const target = new URL(req.url, "http://localhost").searchParams.get("url");
          const mod = await import("./api/article.js");
          await mod.default({ query: { url: target } }, {
            status(code) { res.statusCode = code; return this; },
            setHeader(k, v) { res.setHeader(k, v); },
            json(obj) { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(obj)); },
          });
          return;
        }
        if (!req.url || !req.url.startsWith("/api/rss?")) return next();
        const target = new URL(req.url, "http://localhost").searchParams.get("url");
        if (!target || !/^https:\/\//i.test(target)) {
          res.statusCode = 400;
          res.end("Bad url");
          return;
        }
        try {
          const xml = await fetchXml(target);
          res.setHeader("Content-Type", "application/xml; charset=utf-8");
          res.end(xml);
        } catch {
          res.statusCode = 502;
          res.end("Failed to fetch feed");
        }
      });
    },
  };
}

// Keep Vite's dependency cache OUT of the Dropbox folder – Dropbox keeps
// locking node_modules/.vite and causing EBUSY errors during optimize.
export default defineConfig({
  plugins: [react(), tailwindcss(), rssDevServer()],
  cacheDir: path.join(os.tmpdir(), "vite-finestate"),
  server: { port: 5180, strictPort: true },
});
