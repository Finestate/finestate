import { useState } from "react";

// Light client-side gate. NOT real security (the password ships in the site code) –
// just a cover until a proper login is built. Unlocking is remembered in this browser,
// so you only enter it once per device (until you clear the browser's site data).
const PASSWORD = "gold";          // change this to whatever you like
const KEY = "finestate.unlocked";

export default function PasswordGate({ children }) {
  const [ok, setOk] = useState(() => { try { return localStorage.getItem(KEY) === "yes"; } catch { return false; } });
  const [val, setVal] = useState("");
  const [err, setErr] = useState(false);

  if (ok) return children;

  const submit = (e) => {
    e.preventDefault();
    if (val === PASSWORD) {
      try { localStorage.setItem(KEY, "yes"); } catch {}
      setOk(true);
    } else {
      setErr(true);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FBF3E4] px-4">
      <form onSubmit={submit} className="w-full max-w-xs rounded-xl border border-black/10 bg-white p-6 shadow-sm">
        <div className="mb-4 text-center text-[13px] font-black uppercase tracking-[0.15em] text-[#9c7c33]">Finestate</div>
        <input
          type="password"
          autoFocus
          value={val}
          onChange={(e) => { setVal(e.target.value); setErr(false); }}
          placeholder="Password"
          className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-neutral-800 outline-none focus:border-[#c2a15a]"
        />
        {err && <p className="mt-2 text-[11px] font-semibold text-[#b91c1c]">Wrong password.</p>}
        <button type="submit" className="mt-3 w-full rounded-md bg-[#9c7c33] py-2 text-sm font-bold uppercase tracking-wide text-white hover:opacity-90 transition-opacity">Enter</button>
      </form>
    </div>
  );
}
