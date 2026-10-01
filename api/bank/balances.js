import { eb, requireAdmin, readBody } from "../_bank.js";

// The current balance of each connected account. The bank allows only a few reads a
// day without you present, so the page keeps the last answer and asks sparingly.
// Booked first, as the bank's own Kontostand shows it. "Expected" adds payments
// still pending, and the "available" figures can include the overdraft limit, so
// they only stand in when no booked figure is given.
const PREFER = ["ITBD", "CLBD", "XPCD", "ITAV", "CLAV", "OTHR"];
const TYPES = { ITBD: "booked today", XPCD: "expected", CLBD: "booked at close", ITAV: "available today", CLAV: "available at close", OTHR: "other" };

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
          ? {
              amount: pick.balance_amount?.amount ?? "",
              currency: pick.balance_amount?.currency || "EUR",
              type: pick.balance_type || "",
              date: pick.reference_date || "",
              // Every figure the bank gave, so the page can show them on hover.
              all: list.map((x) => `${TYPES[x.balance_type] || x.balance_type}: ${x.balance_amount?.currency || ""} ${x.balance_amount?.amount ?? ""}${x.reference_date ? ` (${x.reference_date})` : ""}`),
            }
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
