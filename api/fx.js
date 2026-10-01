// Today's exchange rates against the euro, for turning income paid in other
// currencies into EUR. The source updates once a day; an hour at the edge keeps the
// page from asking it on every visit.
export default async function handler(req, res) {
  try {
    const r = await fetch("https://open.er-api.com/v6/latest/EUR");
    const j = await r.json();
    if (!r.ok || j.result !== "success" || !j.rates) throw new Error("No rates");
    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=3600");
    // rates.AED is how many dirhams one euro buys.
    res.status(200).json({ updated: j.time_last_update_utc, rates: j.rates });
  } catch {
    res.status(502).json({ error: "Could not fetch exchange rates" });
  }
}
