import { useEffect, useState } from "react";
import { Info, X } from "lucide-react";
import { supabase } from "./lib/supabaseClient.js";
import { CALC_GROUPS } from "./investingData.js";

// Investing > Calculations: the custom calculators from the HEIE Planning sheet. Each one
// is a small table: what you type on the left, what it works out on the right, in blue.
// Typed figures are kept in Supabase, so they are there next time.
const DOC_ID = "investing-calcs";
const BAR_BG = "#F2C46D"; // section bar
const SUB_BG = "#FFE4B3"; // each calculator, one step down
const HEADER_BG = "#FCEFCF"; // column headings, one step further down
const head = "text-[11px] font-bold uppercase leading-[15px] tracking-[0.06em] text-neutral-900";

// A few plain words on how each calculator works, shown from the i beside its title.
const ABOUT = {
  "fv-annual":
    "Your starting amount grows by the return once a year, on the last day of the year. Any yearly payment goes in right after that growth, so it starts growing the year after. Total investment is everything you put in, without growth.",
  "fv-quarterly":
    "The yearly return is split into four and added at each quarter end (31 Mar, 30 Jun, 30 Sep, 31 Dec). Any quarterly payment goes in right after that growth. Growing four times a year earns a little more than once: 13% a year this way is about 13.65%.",
  "fv-monthly":
    "The yearly return is split into twelve and added at the end of each month. Any monthly payment goes in right after that growth. Growing every month earns a little more again: 13% a year this way is about 13.80%.",
  cagr:
    "The steady yearly growth rate that turns the beginning value into the ending value over the number of years, as if it had grown by the same percentage every year.",
  "cagr-period":
    "Turns a total percentage change between two dates into a yearly growth rate. For example, 250% up over exactly one year is 250% a year; the same rise over two years is about 87% a year.",
  "pct-change":
    "How much a value has gone up or down from where it started, as a percentage of the starting value.",
  "pct-change-value":
    "What a value becomes after a percentage rise or fall. Use a minus for a fall.",
  "rule-72":
    "A quick way to see how long money takes to double: 72 divided by the yearly return in percent. At 8% a year, about 9 years.",
  "future-price-mktcap":
    "If the company's total value (market cap) grows to the future figure, the share price grows by the same multiple, assuming the number of shares stays the same. Then your shares are valued at that price.",
  "future-price-growth":
    "The share price grown by the yearly rate for the number of years, compounded once a year. Then your shares are valued at that price.",
  "holding-scenario":
    "From what you paid: the price to sell at to reach your gain target, the date your holding period ends, and where you stand today at the current price.",
};

const CALCS = CALC_GROUPS.find((g) => g.group === "Custom Calculations")?.calcs || [];

// Typed numbers keep thousands commas as you go; dates use the calendar.
const commas = (s) => {
  const str = String(s ?? "");
  const neg = str.trim().startsWith("-");
  const cleaned = str.replace(/[^0-9.]/g, "");
  if (cleaned === "") return neg ? "-" : "";
  const [i, ...rest] = cleaned.split(".");
  return (neg ? "-" : "") + i.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (cleaned.includes(".") ? "." + rest.join("") : "");
};
const parse = (type, raw) => {
  if (type === "date") return raw;
  const n = parseFloat(String(raw ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : NaN;
};

export default function Calculations() {
  const [saved, setSaved] = useState(null); // { [calcId]: { [field]: raw } }
  const [about, setAbout] = useState(null); // the calculator whose explanation is open

  useEffect(() => {
    supabase
      .from("admin_docs")
      .select("data")
      .eq("id", DOC_ID)
      .maybeSingle()
      .then(({ data }) => setSaved(data?.data || {}));
  }, []);

  const setField = (id, key, raw) => {
    const next = { ...saved, [id]: { ...(saved[id] || {}), [key]: raw } };
    setSaved(next);
    supabase.from("admin_docs").upsert({ id: DOC_ID, data: next, updated_at: new Date().toISOString() }).then(() => {});
  };

  if (!saved) return <div className="w-full" />;

  return (
    <div className="w-full overflow-x-auto">
      <div className="w-full min-w-[760px] overflow-hidden border border-black bg-white shadow-sm">
        <div className="flex h-[22px] items-center px-2" style={{ backgroundColor: BAR_BG }}>
          <span className={head}>Custom calculations</span>
        </div>
        {CALCS.map((c) => {
          const raw = (k) => saved[c.id]?.[k] ?? String(c.defaults[k] ?? "");
          const vals = Object.fromEntries(c.fields.map((f) => [f.key, parse(f.type, raw(f.key))]));
          let results = [];
          try { results = c.compute(vals); } catch { results = []; }
          // Every cell the same width, typed ones first, then the results.
          const cols = c.fields.length + results.length;
          const grid = { gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` };
          return (
            <div key={c.id}>
              <div className="flex h-[22px] items-center border-t border-black px-2" style={{ backgroundColor: SUB_BG }}>
                <span className={head}>{c.title}</span>
                {ABOUT[c.id] && (
                  <button onClick={() => setAbout(c)} title="How this works" className="ml-1.5 flex items-center text-neutral-900 hover:text-[#9c7c33]">
                    <Info size={12} strokeWidth={2.5} />
                  </button>
                )}
              </div>
              <div className="grid border-t border-black" style={{ ...grid, backgroundColor: HEADER_BG }}>
                {c.fields.map((f, i) => (
                  <span key={f.key} className={`flex h-[22px] items-center px-2 ${head} ${i ? "border-l border-black" : ""}`}>
                    {f.label}{f.type === "pct" ? " %" : ""}
                  </span>
                ))}
                {results.map((r) => (
                  <span key={r.label} className={`flex h-[22px] items-center border-l border-black px-2 ${head}`}>{r.label}</span>
                ))}
              </div>
              <div className="grid border-t border-black" style={grid}>
                {c.fields.map((f, i) => (
                  <span key={f.key} className={`flex h-[22px] items-center px-2 ${i ? "border-l border-black" : ""}`}>
                    <input
                      type={f.type === "date" ? "date" : "text"}
                      inputMode={f.type === "date" ? undefined : "decimal"}
                      value={f.type === "date" ? raw(f.key) : commas(raw(f.key))}
                      onChange={(e) => setField(c.id, f.key, f.type === "date" ? e.target.value : e.target.value.replace(/,/g, ""))}
                      className="w-full bg-transparent text-[11px] tabular-nums text-neutral-900 outline-none"
                    />
                  </span>
                ))}
                {results.map((r) => (
                  <span key={r.label} className="flex h-[22px] items-center border-l border-black px-2 text-[11px] font-semibold tabular-nums text-[#1d4ed8]">
                    {r.value}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {about && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={() => setAbout(null)}>
          <div className="relative w-full max-w-sm border border-black bg-white p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setAbout(null)} title="Close" className="absolute right-2 top-2 text-neutral-900 hover:text-[#C1440E]">
              <X size={12} strokeWidth={2.5} />
            </button>
            <p className={`pr-5 ${head}`}>{about.title}</p>
            <p className="pt-2 text-[11px] leading-[16px] text-neutral-900">{ABOUT[about.id]}</p>
          </div>
        </div>
      )}
    </div>
  );
}
