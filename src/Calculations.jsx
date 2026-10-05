import { useEffect, useState } from "react";
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
    </div>
  );
}
