// Checks the password server-side and hands back an httpOnly cookie that the edge
// middleware looks for. The password itself never reaches the browser.
export default function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "method" });
    return;
  }

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { body = {}; }
  }

  const expected = process.env.SITE_PASSWORD;
  const token = process.env.SITE_TOKEN;
  if (!expected || !token) {
    res.status(500).json({ ok: false, error: "not-configured" });
    return;
  }

  if (!body || body.password !== expected) {
    res.status(401).json({ ok: false, error: "wrong" });
    return;
  }

  res.setHeader(
    "Set-Cookie",
    `fs_auth=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=31536000`
  );
  res.status(200).json({ ok: true });
}
