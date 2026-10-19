import Anthropic from "@anthropic-ai/sdk";
import { requireAdmin, readBody } from "./_bank.js";

// The Macro map, stage 1: where the big money is being spent now and why, and which
// industries that pulls in. Claude searches the web so it is current, and answers as JSON
// the page lays out. Admin only. The page sends the map it holds now and what to update.
export const config = { maxDuration: 60 };

const MODEL = "claude-opus-5-5";
const SYSTEM =
  "You keep a private investor's Macro map: where the biggest spending in the economy is going over the next decade, by area, with a focus on what US-listed companies benefit from. " +
  "Search the web for current, dated figures from credible sources before writing. " +
  "Answer with JSON only, no other text, in exactly this shape: " +
  '{"overview": string, "asOf": string, "areas": [{"name": string, "stats": [string], "why": string, "simple": string, "industries": [string]}]}. ' +
  "overview: 2 to 3 plain sentences on where major spending is happening right now. asOf: month and year the picture describes, like OCT 2026. " +
  "areas: the 6 to 9 biggest spending areas, biggest first. stats: 2 to 3 short facts with numbers, each ending with its source and year in brackets. " +
  "why: one or two sentences on why the money is flowing there. simple: one or two sentences a seven-year-old could follow, starting with 'Because'. " +
  "industries: the 4 to 8 industries that play a role, as short names. " +
  "Use plain words, no markdown, no em dashes. When given an existing map and an update request, return the whole map with the update folded in. " +
  "This is information, not personal investment advice.";

// The JSON may arrive wrapped in a code fence or with a sentence around it.
const parseMap = (text) => {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("The answer was not in the expected form. Please try again.");
  const map = JSON.parse(text.slice(start, end + 1));
  if (!Array.isArray(map.areas)) throw new Error("The answer was missing its areas. Please try again.");
  return map;
};

export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ error: "POST only" }); return; }
  try {
    if (!(await requireAdmin(req, res))) return;
    if (!process.env.ANTHROPIC_API_KEY) { res.status(500).json({ error: "The Anthropic key is not set on this project yet." }); return; }
    const { map, ask } = readBody(req);
    const today = new Date().toISOString().slice(0, 10);
    const prompt = map && Array.isArray(map.areas) && map.areas.length
      ? `Today is ${today}. Here is the current Macro map as JSON:\n\n${JSON.stringify({ overview: map.overview, asOf: map.asOf, areas: map.areas })}\n\nUpdate request: ${ask || "Bring the whole map up to date."}`
      : `Today is ${today}. Build the first Macro map. ${ask ? `Also take into account: ${ask}` : ""}`;

    const client = new Anthropic();
    const messages = [{ role: "user", content: prompt }];
    let response;
    // The web search runs on Anthropic's side; a long one can pause and is simply resumed.
    for (let turn = 0; turn < 3; turn++) {
      response = await client.messages.create({
        model: MODEL,
        max_tokens: 5000,
        output_config: { effort: "low" },
        system: SYSTEM,
        tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 3 }],
        messages,
      });
      if (response.stop_reason !== "pause_turn") break;
      messages.push({ role: "assistant", content: response.content });
    }
    if (response.stop_reason === "refusal") { res.status(200).json({ error: "Claude declined that request. Try asking it another way." }); return; }
    const text = response.content.filter((b) => b.type === "text").map((b) => b.text).join("").trim();
    res.status(200).json({ map: parseMap(text) });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) { res.status(429).json({ error: "Claude is busy right now. Try again in a moment." }); return; }
    if (e instanceof Anthropic.APIError) { res.status(502).json({ error: `Claude could not answer (${e.status}): ${e.message}` }); return; }
    res.status(502).json({ error: e.message || "Claude could not answer." });
  }
}
