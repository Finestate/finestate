import { useEffect, useState } from "react";
import { supabase } from "./lib/supabaseClient.js";

// Read-only table: the lines and figures are maintained here in code, so changes
// come through Claude rather than being typed into the page. The Anthropic line is the
// one exception: it is read live from Anthropic's cost report.
const BAR_BG = "#F2C46D"; // same ramp as the Costs table: darkest gold on the title bar

const TITLE = "Name";

// One size, one line height across the whole table – same as the Planning page.
const txt = "text-[11px] leading-[15px] text-neutral-900";
const head = "text-[11px] font-bold uppercase leading-[15px] tracking-[0.06em] text-neutral-900";

// Every paid or potentially paid service behind the site, A to Z. Free tiers sit at 0.00.
// `live` marks the line whose figure comes from Anthropic this month.
const COSTS = [
  { item: "Anthropic – Claude API (this month, all sites on the account)", price: "0.00", live: true },
  { item: "Claude – Claude Code plan (building the site)", price: "0.00" },
  { item: "Domain name – finestate.xyz", price: "0.00" },
  { item: "Dropbox – project files", price: "0.00" },
  { item: "GitHub – code repository", price: "0.00" },
  { item: "Stock data API – market feed (planned)", price: "0.00" },
  { item: "Supabase – logins and database", price: "0.00" },
  { item: "Vercel – hosting", price: "0.00" },
];

export default function SiteRunningCosts() {
  // The Anthropic figure: null while it loads, a number once read. It is read once a day
  // and kept in this browser, so the page shows it at once on every other visit.
  const today = new Date().toISOString().slice(0, 10);
  const saved = (() => {
    try { return JSON.parse(localStorage.getItem("anthropic-cost") || "null"); } catch { return null; }
  })();
  const [anthropic, setAnthropic] = useState(saved?.day === today ? saved.usd : null);
  const [err, setErr] = useState("");
  useEffect(() => {
    if (saved?.day === today) return;
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const r = await fetch("/api/anthropic-cost", { headers: { Authorization: `Bearer ${data?.session?.access_token || ""}` } });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || "Could not read the Anthropic costs");
        setAnthropic(j.usd);
        try { localStorage.setItem("anthropic-cost", JSON.stringify({ day: today, usd: j.usd })); } catch {}
      } catch (e) {
        setErr(e.message);
      }
    })();
  }, []);

  const priceOf = (c) => (c.live ? (anthropic ?? 0) : parseFloat(c.price) || 0);
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
                <span className={`tabular-nums ${txt}`}>{c.live && anthropic == null ? "…" : priceOf(c).toFixed(2)}</span>
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
      {err && <p className="pt-2 text-[11px] font-semibold text-[#C1440E]">{err}</p>}
    </div>
  );
}
