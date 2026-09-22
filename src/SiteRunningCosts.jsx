// Read-only table: the lines and figures are maintained here in code, so changes
// come through Claude rather than being typed into the page.
const BAR_BG = "#FFE4B3";

const TITLE = "Name";

// One size, one line height across the whole table – same as the Planning page.
const txt = "text-[11px] leading-[15px] text-neutral-900";
const head = "text-[11px] font-bold uppercase leading-[15px] tracking-[0.06em] text-neutral-900";

// Every paid or potentially paid service behind the site, A to Z. Free tiers sit at 0.00.
const COSTS = [
  { item: "Anthropic – Claude API (AI research, planned)", price: "0.00" },
  { item: "Claude – Claude Code plan (building the site)", price: "0.00" },
  { item: "Domain name – finestate.xyz", price: "0.00" },
  { item: "Dropbox – project files", price: "0.00" },
  { item: "GitHub – code repository", price: "0.00" },
  { item: "Stock data API – market feed (planned)", price: "0.00" },
  { item: "Supabase – logins and database", price: "0.00" },
  { item: "Vercel – hosting", price: "0.00" },
];

export default function SiteRunningCosts() {
  const total = COSTS.reduce((sum, c) => sum + (parseFloat(c.price) || 0), 0);

  return (
    <div className="w-full">
      <div className="w-full border-2 border-neutral-400 bg-white shadow-sm overflow-hidden">
        <div className="flex h-[18px] items-center gap-2 border-b border-neutral-400 pl-2 pr-4" style={{ backgroundColor: BAR_BG }}>
          <span className={`flex-1 ${head}`}>{TITLE}</span>
          <span className={`w-32 shrink-0 whitespace-nowrap text-right ${head}`}>Monthly cost</span>
        </div>

        <div>
          {COSTS.map((c, i) => (
            <div key={c.item} className={`flex h-[21px] items-center gap-2 pl-2 pr-4 ${i === 0 ? "" : "border-t border-neutral-300"}`}>
              <span className={`flex-1 ${txt}`}>{c.item}</span>
              <div className="flex w-32 shrink-0 items-center justify-end gap-1">
                <span className={txt}>USD</span>
                <span className={`tabular-nums ${txt}`}>{c.price}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="flex h-[18px] items-center gap-2 border-t border-neutral-400 pl-2 pr-4">
          <span className={`flex-1 ${head}`}>Total monthly cost</span>
          <div className="flex w-32 shrink-0 items-center justify-end gap-1">
            <span className={`font-bold ${txt}`}>USD</span>
            <span className={`font-bold tabular-nums ${txt}`}>{total.toFixed(2)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
