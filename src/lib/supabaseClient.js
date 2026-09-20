import { createClient } from "@supabase/supabase-js";

// The Project URL and publishable key are browser-safe (public by design): access is
// controlled by Row Level Security policies, not by hiding these values. Env vars win if set;
// the fallbacks keep production working without extra config. The SECRET key is never used here.
const url = import.meta.env.VITE_SUPABASE_URL || "https://ngmjqamqrvqyopqecgcj.supabase.co";
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_0FR9a0JsHRqQvOpEN1FCUA_5kqHI1Gf";

export const supabaseReady = Boolean(url && key);
export const supabase = supabaseReady ? createClient(url, key) : null;
