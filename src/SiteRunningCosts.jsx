import { useEffect, useState } from "react";
import { supabase } from "./lib/supabaseClient.js";

// Read-only table: the lines and figures are maintained here in code, so changes
// come through Claude rather than being typed into the page. The exceptions are the
// lines marked `live`: Anthropic and Vercel are read from their own cost reports.
const BAR_BG = "#F2C46D"; // same ramp as the Costs table: darkest gold on the title bar

const TITLE = "Name";

// One size, one line height across the whole table – same as the Planning page.
const txt = "text-[11px] leading-[15px] text-neutral-900";
const head = "text-[11px] font-bold uppercase leading-[15px] tracking-[0.06em] text-neutral-900";

// Every paid or potentially paid service behind the site, A to Z. Free tiers sit at 0.00.
// `live` names the cost report the figure comes from, this month, across all sites.
const COSTS = [
  { item: "Anthropic – Claude API (this month, all sites on the account)", price: "0.00", live: "anthropic" },
  { item: "Claude – Claude Code plan (building the site)", price: "0.00" },
  { item: "Domain name – finestate.xyz", price: "0.00" },
  { item: "Dropbox – project files", price: "0.00" },
  { item: "Enable Banking – bank connection (Sparkasse balances)", price: "0.00" },
  { item: "Exchange rates – open.er-api.com (live currency rates)", price: "0.00" },
  { item: "GitHub – code repository", price: "0.00" },
  { item: "Supabase – logins and database", price: "0.00" },
  { item: "Vercel – hosting (this month, all sites on the account)", price: "0.00", live: "vercel" },
  { item: "Yahoo Finance – share prices", price: "0.00" },
];

// A live figure: the last one is kept in this browser and shown at once; when it is over
// an hour old a fresh one is read quietly behind it and swapped in.
function useLiveCost(name, path) {
  const month = new Date().toISOString().slice(0, 7);
  const store = `${name}-cost`;
  const saved = (() => {
    try { return JSON.parse(localStorage.getItem(store) || "null"); } catch { return null; }
  })();
  const usable = saved?.month === month;
  const [usd, setUsd] = useState(usable ? saved.usd : null);
  const [err, setErr] = useState("");
  useEffect(() => {
    if (usable && Date.now() - saved.at < 60 * 60 * 1000) return;
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const r = await fetch(path, { headers: { Authorization: `Bearer ${data?.session?.access_token || ""}` } });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || `Could not read the ${name} costs`);
        setUsd(j.usd);
        try { localStorage.setItem(store, JSON.stringify({ month, at: Date.now(), usd: j.usd })); } catch {}
      } catch (e) {
        setErr(e.message);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return [usd, err];
}

export default function SiteRunningCosts() {
  const [anthropic, errA] = useLiveCost("anthropic", "/api/anthropic-cost");
  const [vercel, errV] = useLiveCost("vercel", "/api/vercel-cost");
  const live = { anthropic, vercel };

  const priceOf = (c) => (c.live ? (live[c.live] ?? 0) : parseFloat(c.price) || 0);
  const total = COSTS.reduce((sum, c) => sum + priceOf(c), 0);

  return (
    // Narrow windows scroll the table sideways rather than squashing the columns.
    <div className="w-full overflow-x-auto">
      <div className="w-full min-w-[560px] border border-black bg-white shadow-sm overflow-hidden">
        <div className="flex h-[18px] items-center gap-2 border-b border-black pl-2 pr-4" style={{ backgroundColor: BAR_BG }}>
          <span className={`flex-1 ${head}`}>{TITLE}</span>
          <span className={`w-32 shrink-0 whitespace-nowrap text-right ${head}`}>Monthly cost</span>
        </div>

        <div>
          {COSTS.map((c, i) => (
            <div key={c.item} className={`flex h-[21px] items-center gap-2 pl-2 pr-4 ${i === 0 ? "" : "border-t border-black"}`}>
              <span className={`flex-1 ${txt}`}>{c.item}</span>
              <div className="flex w-32 shrink-0 items-center justify-end gap-1">
                <span className={txt}>USD</span>
                <span className={`tabular-nums ${txt}`}>{c.live && live[c.live] == null ? "…" : priceOf(c).toFixed(2)}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="flex h-[18px] items-center gap-2 border-t border-black pl-2 pr-4">
          <span className={`flex-1 ${head}`}>Total monthly cost</span>
          <div className="flex w-32 shrink-0 items-center justify-end gap-1">
            <span className={`font-bold ${txt}`}>USD</span>
            <span className={`font-bold tabular-nums ${txt}`}>{total.toFixed(2)}</span>
          </div>
        </div>
      </div>
      {[errA, errV].filter(Boolean).map((e) => (
        <p key={e} className="pt-2 text-[11px] font-semibold text-[#C1440E]">{e}</p>
      ))}
    </div>
  );
}
