// Read-only table: the lines and figures are maintained here in code, so changes
// come through Claude rather than being typed into the page.
const BAR_BG = "#FFE4B3";

const TITLE = "Name";

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
        <div className="flex items-center gap-2 border-b-2 border-neutral-400 py-1 pl-2.5 pr-6" style={{ backgroundColor: BAR_BG }}>
          <span className="flex-1 py-0.5 text-[12px] font-black uppercase leading-tight tracking-[0.06em] text-neutral-900">{TITLE}</span>
          <span className="w-32 shrink-0 whitespace-nowrap text-left text-[12px] font-black uppercase leading-tight tracking-[0.06em] text-neutral-900">Monthly cost</span>
        </div>

        <div>
          {COSTS.map((c, i) => (
            <div key={c.item} className={`flex items-center gap-2 py-0.5 pl-2.5 pr-6 ${i === 0 ? "" : "border-t border-neutral-300"}`}>
              <span className="flex-1 py-0.5 text-[12px] leading-snug text-neutral-900">{c.item}</span>
              <div className="flex w-32 shrink-0 items-center justify-start gap-1">
                <span className="text-[12px] leading-snug text-neutral-900">USD</span>
                <span className="py-0.5 text-[12px] leading-snug tabular-nums text-neutral-900">{c.price}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 border-t-2 border-neutral-400 py-1 pl-2.5 pr-6">
          <span className="flex-1 text-[12px] font-black uppercase leading-tight tracking-[0.06em] text-neutral-900">Total monthly cost</span>
          <div className="flex w-32 shrink-0 items-center justify-start gap-1">
            <span className="text-[12px] font-black leading-snug text-neutral-900">USD</span>
            <span className="text-[12px] font-black leading-snug tabular-nums text-neutral-900">{total.toFixed(2)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
