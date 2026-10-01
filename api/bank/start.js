import { eb, requireAdmin, readBody } from "../_bank.js";

// Starts a read-only approval at the bank: finds Stadtsparkasse München, asks for the
// longest access the bank allows, and hands back the bank's own approval page.
export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ error: "POST only" }); return; }
  try {
    if (!(await requireAdmin(req, res))) return;
    const { state } = readBody(req);
    const list = await eb("/aspsps?country=DE");
    const bank = (list.aspsps || []).find((a) => /stadtsparkasse m(ü|ue)nchen/i.test(a.name));
    if (!bank) throw new Error("Stadtsparkasse München was not found at the bank service.");
    // Never longer than the bank allows, and no more than 180 days.
    const secs = Math.min(bank.maximum_consent_validity || 90 * 86400, 180 * 86400);
    const validUntil = new Date(Date.now() + secs * 1000 - 60_000).toISOString();
    const host = `https://${req.headers["x-forwarded-host"] || req.headers.host}`;
    const out = await eb("/auth", {
      method: "POST",
      body: {
        access: { valid_until: validUntil },
        aspsp: { name: bank.name, country: "DE" },
        state: String(state || ""),
        redirect_url: `${host}/api/bank/callback`,
        psu_type: "personal",
      },
    });
    res.status(200).json({ url: out.url, valid_until: validUntil });
  } catch (e) {
    res.status(502).json({ error: e.message || "Could not start the bank approval" });
  }
}
