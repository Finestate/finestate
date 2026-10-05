import { createClient } from "@supabase/supabase-js";

// The Project URL and publishable key are browser-safe (public by design): access is
// controlled by Row Level Security policies, not by hiding these values. Env vars win if set;
// the fallbacks keep production working without extra config. The SECRET key is never used here.
const url = import.meta.env.VITE_SUPABASE_URL || "https://ngmjqamqrvqyopqecgcj.supabase.co";
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_0FR9a0JsHRqQvOpEN1FCUA_5kqHI1Gf";

// Right after the login is renewed, Supabase's database can briefly see the new token as
// "issued at future" (its clocks differ by a second or two). Such a refusal is waited out
// and asked again, up to three times, instead of failing the page.
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const patientFetch = async (input, init) => {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(input, init);
    if (res.status !== 401 || attempt >= 3) return res;
    const body = await res.clone().text().catch(() => "");
    if (!/issued at future/i.test(body)) return res;
    await wait(1000 * (attempt + 1));
  }
};

export const supabaseReady = Boolean(url && key);
export const supabase = supabaseReady ? createClient(url, key, { global: { fetch: patientFetch } }) : null;
