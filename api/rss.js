import https from "node:https";
import dns from "node:dns/promises";

// Feeds are added in the page, so the address arrives as ?url=. The browser cannot
// read these feeds itself, hence the server side fetch.
const MAX_BYTES = 2_000_000;

// Anything that could reach inside the network is refused.
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
        res.on("data", (chunk) => {
          data += chunk;
          if (data.length > MAX_BYTES) {
            res.destroy();
            reject(new Error("Feed too large"));
          }
        });
        res.on("end", () => resolve(data));
      })
      .on("timeout", function () { this.destroy(new Error("Timed out")); })
      .on("error", reject);
  });
}

export default async function handler(req, res) {
  const raw = req.query?.url;
  let target;
  try {
    target = new URL(String(raw || ""));
  } catch {
    res.status(400).send("Bad url");
    return;
  }
  if (target.protocol !== "https:") {
    res.status(400).send("Only https feeds");
    return;
  }
  try {
    const hosts = await dns.lookup(target.hostname, { all: true });
    if (hosts.some((h) => isPrivate(h.address))) {
      res.status(400).send("Refused host");
      return;
    }
  } catch {
    res.status(400).send("Unknown host");
    return;
  }
  try {
    const xml = await fetchXml(target.toString());
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate");
    res.status(200).send(xml);
  } catch {
    res.status(502).send("Failed to fetch feed");
  }
}
