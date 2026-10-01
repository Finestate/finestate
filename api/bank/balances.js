import { eb, requireAdmin, readBody } from "../_bank.js";

// The current balance of each connected account. The bank allows only a few reads a
// day without you present, so the page keeps the last answer and asks sparingly.
const PREFER = ["ITAV", "CLAV", "ITBD", "CLBD", "XPCD", "OTHR"];

export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ error: "POST only" }); return; }
  try {
    if (!(await requireAdmin(req, res))) return;
    const { uids } = readBody(req);
    const out = {};
    for (const uid of Array.isArray(uids) ? uids : []) {
      try {
        const b = await eb(`/accounts/${encodeURIComponent(uid)}/balances`);
        const list = b.balances || [];
        const pick = PREFER.map((t) => list.find((x) => x.balance_type === t)).find(Boolean) || list[0];
        out[uid] = pick
          ? { amount: pick.balance_amount?.amount ?? "", currency: pick.balance_amount?.currency || "EUR", type: pick.balance_type || "", date: pick.reference_date || "" }
          : { error: "No balance given" };
      } catch (e) {
        out[uid] = { error: e.message || "Could not read" };
      }
    }
    res.status(200).json({ balances: out, at: new Date().toISOString() });
  } catch (e) {
    res.status(502).json({ error: e.message || "Could not read balances" });
  }
}
