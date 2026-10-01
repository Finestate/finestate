import { eb, requireAdmin, readBody } from "../_bank.js";

// Turns the bank's one-time code into a session, and returns the accounts it covers.
export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ error: "POST only" }); return; }
  try {
    if (!(await requireAdmin(req, res))) return;
    const { code } = readBody(req);
    if (!code) throw new Error("No code from the bank");
    const s = await eb("/sessions", { method: "POST", body: { code } });
    const accounts = (s.accounts || []).map((a) => ({
      uid: a.uid,
      iban: a.account_id?.iban || "",
      name: a.name || a.product || "",
      product: a.product || "",
    }));
    res.status(200).json({ session_id: s.session_id, valid_until: s.access?.valid_until || "", accounts });
  } catch (e) {
    res.status(502).json({ error: e.message || "Could not finish the bank connection" });
  }
}
