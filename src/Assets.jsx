// What is owned, section by section. Built up step by step; the figures will live in
// Supabase, never in this public repo.
const BAR_BG = "#F2C46D"; // section bars
const GAP_BG = "#8A8A8A"; // the grey band between sections
const head = "text-[11px] font-bold uppercase leading-[15px] tracking-[0.06em] text-neutral-900";

// In the order they are worked through.
const SECTIONS = ["Cash", "Stocks", "Real estate", "Canada"];

export default function Assets() {
  return (
    // Narrow windows scroll the table sideways rather than squashing the columns.
    <div className="w-full overflow-x-auto">
      <div className="w-full min-w-[760px] overflow-hidden border border-black bg-white shadow-sm">
        {SECTIONS.map((name, i) => (
          <div key={name}>
            {/* A grey band, then the section's bar. */}
            <div className={`h-[10px] ${i ? "border-t border-black" : ""}`} style={{ backgroundColor: GAP_BG }} />
            <div className="flex h-[22px] items-center border-t border-black px-2" style={{ backgroundColor: BAR_BG }}>
              <span className={head}>{name}</span>
            </div>
          </div>
        ))}
        <div className="h-[10px] border-t border-black" style={{ backgroundColor: GAP_BG }} />
      </div>
    </div>
  );
}
