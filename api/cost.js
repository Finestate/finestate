import anthropic from "./_anthropic-cost.js";
import vercel from "./_vercel-cost.js";

// One route for the live costs on Site running costs (?service=anthropic or vercel), so
// the site stays within the free plan's twelve server functions. Admin only, as before.
export const config = { maxDuration: 30 };

export default async function handler(req, res) {
  const service = String(req.query.service || "");
  if (service === "anthropic") return anthropic(req, res);
  if (service === "vercel") return vercel(req, res);
  res.status(400).json({ error: "Unknown service" });
}
