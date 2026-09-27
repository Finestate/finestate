import { checkHost, fetchPage, readable } from "./_readable.js";

// Reads the story behind a headline and gives back a short summary of whatever in it
// matters to stock investing. Nothing is stored; each open asks again.
const MODEL = "claude-haiku-4-5-20251001";

export default async function handler(req, res) {
  let target;
  try {
    target = new URL(String(req.query?.url || ""));
  } catch {
    res.status(400).json({ error: "Bad url" });
    return;
  }
  const bad = await checkHost(target);
  if (bad) {
    res.status(400).json({ error: bad });
    return;
  }
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    res.status(500).json({ error: "The Anthropic key is not set on this project yet." });
    return;
  }

  let text = "";
  try {
    text = readable(await fetchPage(target.toString()), 12000);
  } catch {
    res.status(502).json({ error: "Could not read that page" });
    return;
  }
  if (text.length < 200) {
    res.status(200).json({ summary: "That page gives nothing readable to summarise." });
    return;
  }

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 400,
        system:
          "You summarise news for a private investor who holds listed equities. Write at most 150 words, plain sentences, no headings, no bullet points, no preamble. Cover only what bears on stock investing: companies and tickers named, earnings, guidance, deals, regulation, rates, commodities, currencies, and the likely direction of the effect. If the story has nothing to do with investing, reply with one short sentence saying so.",
        messages: [{ role: "user", content: `${target.toString()}\n\n${text}` }],
      }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data?.error?.message || "The summary service refused that request");
    const summary = (data.content || []).map((c) => c.text || "").join(" ").trim();
    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate");
    res.status(200).json({ summary: summary || "No summary came back." });
  } catch (e) {
    res.status(502).json({ error: e.message || "Could not summarise that page" });
  }
}
