import { useState } from "react";
import { supabase } from "./lib/supabaseClient.js";

const GOLD = "#9c7c33";

const field =
  "w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-neutral-800 outline-none focus:border-[#c2a15a]";
const button =
  "mt-3 w-full rounded-md bg-[#9c7c33] py-2 text-sm font-bold uppercase tracking-wide text-white hover:opacity-90 transition-opacity disabled:opacity-50";
const link =
  "text-[11px] font-semibold text-[#9c7c33] underline underline-offset-2 hover:opacity-70";

// Sign in / sign up / reset, all in one small card. New accounts land as
// pending members until an admin approves them on the Logins page.
export default function Auth() {
  const [mode, setMode] = useState("in"); // "in" | "up" | "reset"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    setMsg("");
    const em = email.trim().toLowerCase();

    if (mode === "reset") {
      const { error } = await supabase.auth.resetPasswordForEmail(em, { redirectTo: window.location.origin });
      setErr(error ? error.message : "");
      setMsg(error ? "" : "Check your email for the reset link.");
    } else if (mode === "up") {
      const { error } = await supabase.auth.signUp({
        email: em,
        password,
        options: { data: { full_name: name.trim() } },
      });
      setErr(error ? error.message : "");
      setMsg(error ? "" : "Account created. Ask the admin to approve you.");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email: em, password });
      setErr(error ? error.message : "");
    }
    setBusy(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FBF3E4] px-4">
      <form onSubmit={submit} className="w-full max-w-xs rounded-xl border border-black/10 bg-white p-6 shadow-sm">
        <div className="mb-4 text-center text-[13px] font-black uppercase tracking-[0.15em]" style={{ color: GOLD }}>
          Finestate
        </div>

        {mode === "up" && (
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" className={`${field} mb-2`} />
        )}

        <input
          type="email"
          autoFocus
          value={email}
          onChange={(e) => { setEmail(e.target.value); setErr(""); }}
          placeholder="Email"
          className={field}
          required
        />

        {mode !== "reset" && (
          <input
            type="password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setErr(""); }}
            placeholder="Password"
            className={`${field} mt-2`}
            required
            minLength={8}
          />
        )}

        {err && <p className="mt-2 text-[11px] font-semibold text-[#b91c1c]">{err}</p>}
        {msg && <p className="mt-2 text-[11px] font-semibold text-[#15803d]">{msg}</p>}

        <button type="submit" disabled={busy} className={button}>
          {mode === "in" ? "Sign in" : mode === "up" ? "Create account" : "Send reset link"}
        </button>

        <div className="mt-3 flex items-center justify-between">
          {mode === "in" ? (
            <>
              <button type="button" onClick={() => { setMode("up"); setErr(""); setMsg(""); }} className={link}>Create account</button>
              <button type="button" onClick={() => { setMode("reset"); setErr(""); setMsg(""); }} className={link}>Forgot password</button>
            </>
          ) : (
            <button type="button" onClick={() => { setMode("in"); setErr(""); setMsg(""); }} className={link}>Back to sign in</button>
          )}
        </div>
      </form>
    </div>
  );
}
