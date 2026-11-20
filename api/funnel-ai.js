import Anthropic from "@anthropic-ai/sdk";
import { requireAdmin, readBody } from "./_bank.js";

// The Funnel: five stages from the top down, each written by Claude from a web search.
//   geo      – the geopolitical forces shaping where money goes
//   region   – the regions those forces lift or hurt
//   industry – the industries in those regions that capture the money
//   etf      – the ETFs that hold those industries, as a filter and a shortlist
//   company  – the companies inside them, each with a scorecard
// Each stage is built only from what was ticked in the stage above, so the chain from a
// force down to a company stays visible. "build" returns a stage as JSON; "ask" answers a
// question about a stage in plain words. Admin only. One route for all, to keep under the
// Vercel function limit.
export const config = { maxDuration: 60 };

const MODEL = "claude-opus-5-5";

const STAGES = {
  geo: {
    title: "Geopolitics",
    what: "the 6 to 9 biggest geopolitical and policy forces shaping where money will flow over the next 3 to 10 years (for example trade wars and tariffs, rearmament, the AI race, energy security, supply chain reshoring, sanctions, demographics). Biggest impact first.",
    facts: '"Horizon" (like 2026 to 2032), "Likelihood" (High, Medium or Low, with a few words), "Money involved" (a dated figure), "Regions most affected"',
    links: "leave links empty",
  },
  region: {
    title: "Regions",
    what: "the 5 to 8 regions or countries that gain or lose most from the ticked forces. Winners first, then any clear losers.",
    facts: '"Effect" (Gains or Loses), "Key policy" (the main law, budget or deal), "Money involved" (a dated figure), "Market" (the main stock market or index)',
    links: "the names of the ticked forces each region is tied to, exactly as given",
  },
  industry: {
    title: "Industries",
    what: "the 6 to 10 industries in the ticked regions that capture the money, following it down the chain to who actually gets paid (for example chips and power before software).",
    facts: '"Where in the chain" (a few words), "Growth" (a dated growth figure), "Region" (which ticked region), "Risk" (the main risk in a few words)',
    links: "the names of the ticked regions (and forces) each industry is tied to, exactly as given",
  },
  etf: {
    title: "ETFs",
    what: "the 5 to 10 leading ETFs that give exposure to the ticked industries in the ticked regions. Prefer large, liquid funds. Flag any with weak 3 to 5 year performance.",
    facts: '"Ticker", "3y return" (annualised, dated), "5y return" (annualised, dated), "Cost" (expense ratio), "Size" (assets), "Top holdings" (the 5 biggest, by name and ticker)',
    links: "the names of the ticked industries each ETF covers, exactly as given",
  },
  company: {
    title: "Companies",
    what: "the 6 to 12 most interesting companies, mostly taken from the top holdings of the ticked ETFs, that are most directly tied to the chain above.",
    facts: '"Ticker", "Revenue growth" (latest year, dated), "Profit margin", "Debt" (a few words), "Valuation" (P/E or similar, dated), "Market cap"',
    links: "the names of the ticked ETFs and industries each company sits in, exactly as given",
  },
};

const SHAPE =
  '{"overview": string, "asOf": string, "items": [{"name": string, "tag": string, "score": number, "stats": [string], "why": string, "simple": string, "facts": {string: string}, "links": [string], "watch": string}]}';

const buildSystem = (s) =>
  "You help a private investor understand how geopolitics flows down into regions, industries, ETFs and companies, so they can make easier selections. " +
  `You are writing the ${s.title} stage of their funnel: ${s.what} ` +
  "Search the web for current, dated figures from credible sources before writing. " +
  `Answer with JSON only, no other text, in exactly this shape: ${SHAPE}. ` +
  "overview: 2 to 3 plain sentences on the big picture of this stage right now. asOf: the month and year, like NOV 2026. " +
  "name: a short name. tag: a very short label (a ticker, a country code or 1 to 2 words). " +
  "score: 1 to 10, how strongly this item is tied to and lifted by the chain above, 10 strongest. " +
  "stats: 2 to 3 short facts with numbers, each ending with its source and year in brackets. " +
  "why: one or two sentences on why it matters here. simple: one sentence a seven-year-old could follow, starting with 'Because'. " +
  `facts: exactly these keys with short values: ${s.facts}. ` +
  `links: ${s.links}. ` +
  "watch: the one thing to keep an eye on that would change the picture, in a few words. " +
  "Use plain words, no markdown, no em dashes, no semicolons. When given an existing stage and an update request, return the whole stage with the update folded in. " +
  "This is information, not personal investment advice.";

const ASK_SYSTEM =
  "You help a private investor understand how geopolitics flows down into regions, industries, ETFs and companies. " +
  "Answer their question about the funnel stage given, in plain words, short and concrete, with dated numbers where they help. " +
  "Explain the links between the levels when it helps them understand. Search the web if the answer needs current facts. " +
  "No markdown headings, no em dashes. Keep it under 200 words unless they ask for more. This is information, not personal investment advice.";

// The JSON may arrive wrapped in a code fence or with a sentence around it.
const parseStage = (text) => {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("The answer was not in the expected form. Please try again.");
  const out = JSON.parse(text.slice(start, end + 1));
  if (!Array.isArray(out.items)) throw new Error("The answer was missing its items. Please try again.");
  return out;
};

const brief = (items) => (items || []).map((x) => ({ name: x.name, tag: x.tag, why: x.why, links: x.links }));

export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ error: "POST only" }); return; }
  try {
    if (!(await requireAdmin(req, res))) return;
    if (!process.env.ANTHROPIC_API_KEY) { res.status(500).json({ error: "The Anthropic key is not set on this project yet." }); return; }
    const { mode = "build", stage = "geo", current, ask, chain, question } = readBody(req);
    const s = STAGES[stage];
    if (!s) { res.status(400).json({ error: "Unknown stage." }); return; }
    const today = new Date().toISOString().slice(0, 10);
    // `chain`: what is ticked in every stage above, top first: [{ stage, items }].
    const chainText = (chain || []).filter((c) => c.items?.length).map((c) => `${STAGES[c.stage]?.title || c.stage} ticked: ${JSON.stringify(brief(c.items))}`).join("\n");

    let system, prompt;
    if (mode === "ask") {
      system = ASK_SYSTEM;
      prompt = `Today is ${today}.\n${chainText ? `What is ticked above:\n${chainText}\n` : ""}The ${s.title} stage now:\n${JSON.stringify(brief(current?.items))}\n\nQuestion: ${question || ""}`;
    } else {
      system = buildSystem(s);
      const base = chainText ? `Build it only from what is ticked above:\n${chainText}\n` : "";
      prompt = current && Array.isArray(current.items) && current.items.length
        ? `Today is ${today}.\n${base}Here is the current ${s.title} stage as JSON:\n\n${JSON.stringify({ overview: current.overview, asOf: current.asOf, items: current.items })}\n\nUpdate request: ${ask || "Bring the whole stage up to date, and in line with what is ticked above."}`
        : `Today is ${today}.\n${base}Build the ${s.title} stage. ${ask ? `Also take into account: ${ask}` : ""}`;
    }

    const client = new Anthropic();
    const messages = [{ role: "user", content: prompt }];
    let response;
    // The web search runs on Anthropic's side; a long one can pause and is simply resumed.
    for (let turn = 0; turn < 3; turn++) {
      response = await client.messages.create({
        model: MODEL,
        max_tokens: mode === "ask" ? 1500 : 7000,
        output_config: { effort: "low" },
        system,
        tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 3 }],
        messages,
      });
      if (response.stop_reason !== "pause_turn") break;
      messages.push({ role: "assistant", content: response.content });
    }
    if (response.stop_reason === "refusal") { res.status(200).json({ error: "Claude declined that request. Try asking it another way." }); return; }
    const text = response.content.filter((b) => b.type === "text").map((b) => b.text).join("").trim();
    if (mode === "ask") { res.status(200).json({ answer: text }); return; }
    res.status(200).json({ stage: parseStage(text) });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) { res.status(429).json({ error: "Claude is busy right now. Try again in a moment." }); return; }
    if (e instanceof Anthropic.APIError) { res.status(502).json({ error: `Claude could not answer (${e.status}): ${e.message}` }); return; }
    res.status(502).json({ error: e.message || "Claude could not answer." });
  }
}
