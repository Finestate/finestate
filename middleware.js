import { next } from "@vercel/edge";

// Gate every request at the edge. Nothing (not even the JS bundle) is served until the
// browser carries the unlock cookie, so the password never ships inside the site code.
// Env vars, set in Vercel: SITE_PASSWORD (what you type) and SITE_TOKEN (random string).
const COOKIE = "fs_auth";
const OPEN_PATHS = ["/login.html", "/api/unlock", "/robots.txt", "/favicon.ico"];

export const config = { matcher: "/(.*)" };

export default function middleware(request) {
  const url = new URL(request.url);
  if (OPEN_PATHS.includes(url.pathname)) return next();

  const token = process.env.SITE_TOKEN || "";
  const cookie = request.headers.get("cookie") || "";
  const unlocked =
    token.length > 0 &&
    cookie.split(";").some((c) => c.trim() === `${COOKIE}=${token}`);

  if (unlocked) return next();
  return Response.redirect(new URL("/login.html", url), 307);
}
