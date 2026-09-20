import { createClient } from "@supabase/supabase-js";

// The Project URL and the publishable (anon) key are browser-safe by design – access is
// controlled by Row Level Security in the database, not by hiding these values.
// Set both in Vercel: VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.
const url = import.meta.env.VITE_SUPABASE_URL || "";
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";

export const supabaseReady = Boolean(url && key);
export const supabase = supabaseReady ? createClient(url, key) : null;
