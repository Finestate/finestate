import Anthropic from "@anthropic-ai/sdk";
import { requireAdmin, readBody } from "./_bank.js";

// Bible study with Claude, from the G entry on the HW page. Admin only. The page sends
// the conversation so far; the reply comes back as plain text.
export const config = { maxDuration: 60 };

const MODEL = "claude-opus-5-5";
const SYSTEM =
  "You are a thoughtful Bible study companion for one person's private notes. Answer questions about scripture with careful analysis: quote and cite book, chapter and verse; note where translations differ and why; give the historical, cultural and literary context; and set out the main ways the passage has been read across Christian traditions, saying plainly which parts are the text itself and which are interpretation. Be warm and direct, write every answer as one single paragraph, with no headings, lists or line breaks, and keep answers to what was asked. Never write more than 100 words in an answer (fewer is fine): pick the most important points rather than covering everything, and if more would help, offer to go deeper.";

// Only the latest part of a long conversation is sent, to keep each answer quick.
const HISTORY = 30;

export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ error: "POST only" }); return; }
  try {
    if (!(await requireAdmin(req, res))) return;
    if (!process.env.ANTHROPIC_API_KEY) { res.status(500).json({ error: "The Anthropic key is not set on this project yet." }); return; }
    const { messages } = readBody(req);
    const turns = (Array.isArray(messages) ? messages : [])
      .filter((m) => (m.role === "user" || m.role === "assistant") && String(m.content || "").trim())
      .map((m) => ({ role: m.role, content: String(m.content) }))
      .slice(-HISTORY);
    // The conversation must open with a question.
    while (turns.length && turns[0].role !== "user") turns.shift();
    if (!turns.length || turns[turns.length - 1].role !== "user") { res.status(400).json({ error: "No question to answer" }); return; }

    const client = new Anthropic();
    // Server-side fallback: if the request is declined, it is re-run on a suitable model
    // within the same call.
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 4000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium" },
      system: SYSTEM,
      messages: turns,
    });
    if (response.stop_reason === "refusal") {
      res.status(200).json({ reply: "Claude declined to answer that one. Try asking it another way." });
      return;
    }
    const reply = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    res.status(200).json({ reply: reply || "No answer came back." });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) { res.status(429).json({ error: "Claude is busy right now. Try again in a moment." }); return; }
    if (e instanceof Anthropic.APIError) { res.status(502).json({ error: `Claude could not answer (${e.status}).` }); return; }
    res.status(502).json({ error: e.message || "Claude could not answer." });
  }
}
