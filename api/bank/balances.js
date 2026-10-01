import { eb, requireAdmin, readBody } from "../_bank.js";

// The bank can be slow; the reads get up to a minute rather than the default.
export const config = { maxDuration: 60 };

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
    const { uids, present } = readBody(req);
    // When you press Refresh yourself, the bank is told you are there, so the read
    // does not count against its few unattended reads a day.
    const psu = present
      ? {
          "Psu-Ip-Address": String(req.headers["x-forwarded-for"] || "").split(",")[0].trim(),
          "Psu-User-Agent": String(req.headers["user-agent"] || ""),
        }
      : undefined;
    const list = Array.isArray(uids) ? uids : [];
    // All accounts at once, so a slow bank doesn't add the waits up.
    const results = await Promise.all(
      list.map(async (uid) => {
        try {
          const b = await eb(`/accounts/${encodeURIComponent(uid)}/balances`, { headers: psu });
          const all = b.balances || [];
          const pick = PREFER.map((t) => all.find((x) => x.balance_type === t)).find(Boolean) || all[0];
          return [
            uid,
            pick
              ? {
                  amount: pick.balance_amount?.amount ?? "",
                  currency: pick.balance_amount?.currency || "EUR",
                  type: pick.balance_type || "",
                  date: pick.reference_date || "",
                  // Every figure the bank gave, so the page can show them on hover.
                  all: all.map((x) => `${TYPES[x.balance_type] || x.balance_type}: ${x.balance_amount?.currency || ""} ${x.balance_amount?.amount ?? ""}${x.reference_date ? ` (${x.reference_date})` : ""}`),
                }
              : { error: "No balance given" },
          ];
        } catch (e) {
          return [uid, { error: e.message || "Could not read" }];
        }
      })
    );
    res.status(200).json({ balances: Object.fromEntries(results), at: new Date().toISOString() });
  } catch (e) {
    res.status(502).json({ error: e.message || "Could not read balances" });
  }
}
