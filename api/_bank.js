import crypto from "node:crypto";

// Shared pieces for the read-only bank connection through Enable Banking. The app id
// and its private key live only in Vercel's environment variables.
const API = "https://api.enablebanking.com";

// The same browser-safe Supabase details the site itself uses; access is decided by
// the signed-in person's own token, never by these.
const SB_URL = process.env.VITE_SUPABASE_URL || "https://ngmjqamqrvqyopqecgcj.supabase.co";
const SB_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_0FR9a0JsHRqQvOpEN1FCUA_5kqHI1Gf";

const b64url = (buf) => Buffer.from(buf).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");

// A short-lived token signed with the app's key, which Enable Banking asks for on
// every call.
function appToken() {
  const kid = process.env.ENABLE_BANKING_APP_ID;
  const key = String(process.env.ENABLE_BANKING_PRIVATE_KEY || "").replace(/\\n/g, "\n");
  if (!kid || !key) throw new Error("The bank connection is not set up on this project yet.");
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ typ: "JWT", alg: "RS256", kid }));
  const body = b64url(JSON.stringify({ iss: "enablebanking.com", aud: "api.enablebanking.com", iat: now, exp: now + 3600 }));
  const sig = crypto.createSign("RSA-SHA256").update(`${head}.${body}`).sign(key);
  return `${head}.${body}.${b64url(sig)}`;
}

export async function eb(path, { method = "GET", body, headers } = {}) {
  const r = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${appToken()}`, "Content-Type": "application/json", ...(headers || {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let data = null;
  try { data = JSON.parse(text); } catch { /* not JSON */ }
  if (!r.ok) throw new Error(data?.message || data?.detail || `Bank service answered ${r.status}`);
  return data;
}

// Only a signed-in admin may use the bank routes. The page sends its Supabase token;
// it is checked with Supabase, and the person's own profile must say admin.
export async function requireAdmin(req, res) {
  const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) { res.status(401).json({ error: "Not signed in" }); return false; }
  const headers = { apikey: SB_KEY, Authorization: `Bearer ${token}` };
  const u = await fetch(`${SB_URL}/auth/v1/user`, { headers });
  if (!u.ok) { res.status(401).json({ error: "Not signed in" }); return false; }
  const user = await u.json();
  const p = await fetch(`${SB_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=role`, { headers });
  const rows = p.ok ? await p.json() : [];
  if (rows?.[0]?.role !== "admin") { res.status(403).json({ error: "Admins only" }); return false; }
  return true;
}

export const readBody = (req) => (typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {});
