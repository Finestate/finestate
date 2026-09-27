import https from "node:https";
import http from "node:http";
import dns from "node:dns/promises";

// Shared by the article reader and the summariser: fetch a page safely and pull the
// readable text out of it.
const MAX_BYTES = 3_000_000;

export function isPrivate(ip) {
  return (
    /^127\./.test(ip) ||
    /^10\./.test(ip) ||
    /^169\.254\./.test(ip) ||
    /^192\.168\./.test(ip) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(ip) ||
    ip === "0.0.0.0" ||
    ip === "::1" ||
    /^fe80:/i.test(ip) ||
    /^f[cd]/i.test(ip)
  );
}

export async function checkHost(target) {
  if (!/^https?:$/.test(target.protocol)) return "Only web addresses";
  try {
    const hosts = await dns.lookup(target.hostname, { all: true });
    if (hosts.some((h) => isPrivate(h.address))) return "Refused host";
  } catch {
    return "Unknown host";
  }
  return null;
}

export function fetchPage(url, hops = 0) {
  const lib = url.startsWith("http://") ? http : https;
  return new Promise((resolve, reject) => {
    lib
      .get(
        url,
        {
          timeout: 12_000,
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
            Accept: "text/html,application/xhtml+xml",
          },
        },
        (res) => {
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && hops < 4) {
            res.resume();
            resolve(fetchPage(new URL(res.headers.location, url).toString(), hops + 1));
            return;
          }
          let data = "";
          res.setEncoding("utf8");
          res.on("data", (chunk) => {
            data += chunk;
            if (data.length > MAX_BYTES) {
              res.destroy();
              reject(new Error("Page too large"));
            }
          });
          res.on("end", () => resolve(data));
        }
      )
      .on("timeout", function () { this.destroy(new Error("Timed out")); })
      .on("error", reject);
  });
}

export const decode = (s) =>
  String(s)
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));

export function readable(html, limit = 8000) {
  const body = String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ");
  const paras = [...body.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((m) => decode(m[1].replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim())
    .filter((p) => p.length > 60);
  const text = (paras.length ? paras : [decode(body.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim()]).join("\n\n");
  return text.slice(0, limit);
}
