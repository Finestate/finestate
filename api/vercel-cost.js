import { requireAdmin } from "./_bank.js";

// What Vercel has charged this month so far, across every Vercel team the token can see
// (Finestate, Says Ops, Silx Ops and the rest), read from Vercel's billing feed with the
// VERCEL_TOKEN that lives only in Vercel. Admin only.
export const config = { maxDuration: 30 };

const api = (path, key) =>
  fetch(`https://api.vercel.com${path}`, { headers: { Authorization: `Bearer ${key}`, "User-Agent": "Finestate/1.0 (https://www.finestate.xyz)" } });

export default async function handler(req, res) {
  try {
    if (!(await requireAdmin(req, res))) return;
    const key = process.env.VERCEL_TOKEN;
    if (!key) { res.status(500).json({ error: "The Vercel token is not set on this project yet." }); return; }

    // Every team the token belongs to.
    const teams = [];
    let until = "";
    for (let guard = 0; guard < 10; guard++) {
      const r = await api(`/v2/teams?limit=100${until ? `&until=${until}` : ""}`, key);
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error?.message || `Vercel answered ${r.status}`);
      teams.push(...(j.teams || []));
      until = j.pagination?.next;
      if (!until) break;
    }

    const now = new Date();
    const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
    const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)).toISOString();
    // All teams asked at once, so the answer comes back quickly.
    const notes = [];
    const per = await Promise.all(
      teams.map(async (t) => {
        const r = await api(`/v1/billing/charges?teamId=${encodeURIComponent(t.id)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, key);
        const body = await r.text();
        if (!r.ok) {
          // A team whose plan has no billing feed (or no charges yet) counts as nothing.
          let msg = "";
          try { msg = JSON.parse(body)?.error?.message || ""; } catch {}
          notes.push(`${t.name || t.slug}: ${msg || `answered ${r.status}`}`);
          return { team: t.name || t.slug, usd: 0 };
        }
        // One charge per line (JSONL); BilledCost is what is actually billed.
        let sum = 0;
        for (const line of body.split(/\r?\n/)) {
          if (!line.trim()) continue;
          try { sum += Number(JSON.parse(line).BilledCost) || 0; } catch {}
        }
        return { team: t.name || t.slug, usd: sum };
      })
    );
    const usd = per.reduce((s, p) => s + p.usd, 0);
    res.setHeader("Cache-Control", "private, max-age=300");
    res.status(200).json({ usd, per, notes, from, at: now.toISOString() });
  } catch (e) {
    res.status(502).json({ error: e.message || "Could not read the Vercel costs" });
  }
}
