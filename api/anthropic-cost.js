import { requireAdmin } from "./_bank.js";

// What the Anthropic account has cost this month so far, across every site that uses it
// (Finestate, Says Ops, and later Silx Ops share one account). Read from Anthropic's
// cost report with the Admin key, which lives only in Vercel. Admin only.
export const config = { maxDuration: 30 };

export default async function handler(req, res) {
  try {
    if (!(await requireAdmin(req, res))) return;
    const key = process.env.ANTHROPIC_ADMIN_KEY;
    if (!key) { res.status(500).json({ error: "The Anthropic Admin key is not set on this project yet." }); return; }

    const now = new Date();
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    // The report runs in whole days, so it ends at the start of tomorrow.
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
    let cents = 0;
    let page = "";
    for (let guard = 0; guard < 10; guard++) {
      const q = new URLSearchParams({ starting_at: start.toISOString(), ending_at: end.toISOString(), bucket_width: "1d" });
      if (page) q.set("page", page);
      const r = await fetch(`https://api.anthropic.com/v1/organizations/cost_report?${q}`, {
        headers: { "anthropic-version": "2023-06-01", "x-api-key": key, "User-Agent": "Finestate/1.0 (https://www.finestate.xyz)" },
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error?.message || `Anthropic answered ${r.status}`);
      // Amounts are decimal strings in cents (USD).
      for (const bucket of j.data || []) for (const row of bucket.results || []) cents += parseFloat(row.amount) || 0;
      if (!j.has_more || !j.next_page) break;
      page = j.next_page;
    }
    res.setHeader("Cache-Control", "private, max-age=300");
    res.status(200).json({ usd: cents / 100, from: start.toISOString(), at: now.toISOString() });
  } catch (e) {
    res.status(502).json({ error: e.message || "Could not read the Anthropic costs" });
  }
}
