import https from "node:https";
import http from "node:http";
import dns from "node:dns/promises";

// Pulls the readable text out of a story page so it can be read without leaving the
// site. Same guards as the feed proxy: nothing inside the network, size capped.
const MAX_BYTES = 3_000_000;

function isPrivate(ip) {
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

function fetchPage(url, hops = 0) {
  const lib = url.startsWith("http://") ? http : https;
  return new Promise((resolve, reject) => {
    lib
      .get(
        url,
        {
          timeout: 12_000,
          headers: {
            // Plain browser headers, or many sites answer with nothing useful.
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

// Scripts and styles out, paragraphs kept, entities turned back into characters.
function readable(html) {
  const body = String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ");
  const paras = [...body.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((m) => decode(m[1].replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim())
    .filter((p) => p.length > 60);
  const text = (paras.length ? paras : [decode(body.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim()]).join("\n\n");
  return text.slice(0, 8000);
}

const decode = (s) =>
  String(s)
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n));

export default async function handler(req, res) {
  let target;
  try {
    target = new URL(String(req.query?.url || ""));
  } catch {
    res.status(400).json({ error: "Bad url" });
    return;
  }
  if (!/^https?:$/.test(target.protocol)) {
    res.status(400).json({ error: "Only web addresses" });
    return;
  }
  try {
    const hosts = await dns.lookup(target.hostname, { all: true });
    if (hosts.some((h) => isPrivate(h.address))) {
      res.status(400).json({ error: "Refused host" });
      return;
    }
  } catch {
    res.status(400).json({ error: "Unknown host" });
    return;
  }
  try {
    const html = await fetchPage(target.toString());
    res.setHeader("Cache-Control", "s-maxage=600, stale-while-revalidate");
    res.status(200).json({ text: readable(html) });
  } catch {
    res.status(502).json({ error: "Could not read that page" });
  }
}
