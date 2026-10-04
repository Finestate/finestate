import { requireAdmin } from "./_bank.js";

// Latest share prices for the holdings on the Assets page, read from Yahoo Finance's
// public chart feed. No key needed; a few minutes' cache keeps it light. Admin only.
export const config = { maxDuration: 20 };

export default async function handler(req, res) {
  try {
    if (!(await requireAdmin(req, res))) return;
    const symbols = String(req.query.symbols || "")
      .split(",")
      .map((x) => x.trim().toUpperCase())
      .filter((x) => /^[A-Z0-9.\-^=]{1,15}$/.test(x))
      .slice(0, 30);
    const quotes = {};
    await Promise.all(
      symbols.map(async (sym) => {
        try {
          const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=1d&interval=1d`, {
            headers: { "User-Agent": "Mozilla/5.0 (Finestate)" },
          });
          const j = await r.json();
          const m = j?.chart?.result?.[0]?.meta;
          if (m?.regularMarketPrice != null) {
            quotes[sym] = { price: m.regularMarketPrice, currency: m.currency || "USD", at: m.regularMarketTime ? new Date(m.regularMarketTime * 1000).toISOString() : null };
          }
        } catch {
          // A ticker that cannot be read is just left out.
        }
      })
    );
    res.setHeader("Cache-Control", "private, max-age=300");
    res.status(200).json({ quotes });
  } catch (e) {
    res.status(502).json({ error: e.message || "Could not read share prices" });
  }
}
