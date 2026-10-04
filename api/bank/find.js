import { eb } from "../_bank.js";

// Temporary: looks up a bank by name in the bank service's public list, to see whether
// it can be connected. Gives back names and countries only.
export default async function handler(req, res) {
  try {
    const q = String(req.query.q || "").toLowerCase().slice(0, 40);
    if (q.length < 3) { res.status(400).json({ error: "Name too short" }); return; }
    const found = [];
    for (const country of ["GB", "IE", "DE", "FR", "NL", "LT"]) {
      const list = await eb(`/aspsps?country=${country}`);
      for (const a of list.aspsps || []) {
        if (a.name.toLowerCase().includes(q)) found.push({ name: a.name, country, psu_types: a.psu_types });
      }
    }
    res.status(200).json({ found });
  } catch (e) {
    res.status(502).json({ error: e.message || "Lookup failed" });
  }
}
