import Anthropic from "@anthropic-ai/sdk";
import { requireAdmin, readBody } from "./_bank.js";

// The top of the Funnel: Claude writes, and on request updates, a short summary of where
// the big industry trends stand today, searching the web so it is current. Admin only.
// The page sends the summary it holds now and what to update; the new summary comes back.
export const config = { maxDuration: 300 };

const MODEL = "claude-opus-5-5";
const SYSTEM =
  "You keep a private investor's map of the big industry trends, with a focus on US-listed companies. " +
  "Search the web for current, dated information before writing. Write plain text only, no markdown symbols: " +
  "start with one short paragraph on the overall state of affairs, then one line per major trend, each line starting with the trend's name and a colon, " +
  "saying where it stands now, what is driving it, how far along it is (early, growing or mature) and the main thing to watch. " +
  "Keep it under 350 words, factual and calm, and note the month and year the picture describes. " +
  "When given an existing summary and an update request, return the whole summary rewritten with the update folded in, not just the change. " +
  "This is information, not personal investment advice.";

export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ error: "POST only" }); return; }
  try {
    if (!(await requireAdmin(req, res))) return;
    if (!process.env.ANTHROPIC_API_KEY) { res.status(500).json({ error: "The Anthropic key is not set on this project yet." }); return; }
    const { summary, ask } = readBody(req);
    const today = new Date().toISOString().slice(0, 10);
    const prompt = summary && String(summary).trim()
      ? `Today is ${today}. Here is the current summary:\n\n${summary}\n\nUpdate request: ${ask || "Bring the whole summary up to date."}`
      : `Today is ${today}. Write the first summary of the big industry trends. ${ask ? `Also cover: ${ask}` : ""}`;

    const client = new Anthropic();
    const messages = [{ role: "user", content: prompt }];
    let response;
    // The web search runs on Anthropic's side; a long one can pause and is simply resumed.
    for (let turn = 0; turn < 4; turn++) {
      response = await client.messages.create({
        model: MODEL,
        max_tokens: 6000,
        output_config: { effort: "medium" },
        system: SYSTEM,
        tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 6 }],
        messages,
      });
      if (response.stop_reason !== "pause_turn") break;
      messages.push({ role: "assistant", content: response.content });
    }
    if (response.stop_reason === "refusal") { res.status(200).json({ error: "Claude declined that request. Try asking it another way." }); return; }
    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    if (!text) { res.status(502).json({ error: "No summary came back. Please try again." }); return; }
    res.status(200).json({ summary: text });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) { res.status(429).json({ error: "Claude is busy right now. Try again in a moment." }); return; }
    if (e instanceof Anthropic.APIError) { res.status(502).json({ error: `Claude could not answer (${e.status}): ${e.message}` }); return; }
    res.status(502).json({ error: e.message || "Claude could not answer." });
  }
}
