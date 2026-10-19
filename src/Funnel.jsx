import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { supabase } from "./lib/supabaseClient.js";

// Investing > Funnel, built in stages from the top down. Stage 1, the Macro map: where the
// big money is being spent now, area by area, each with its stats, the reason, a plain
// explanation and the industries it pulls in. Claude writes it from a web search; the box
// under it asks for updates. Kept in Supabase with the version before, to go back to.
const DOC_ID = "macro-map";
const BAR_BG = "#F2C46D";
const SUB_BG = "#FFE4B3";
const GAP_BG = "#8A8A8A";
const PINK = "#FBEFEC";
const head = "text-[11px] font-bold uppercase leading-[15px] tracking-[0.06em] text-neutral-900";
// The plan for the Funnel, kept on the page so it is not forgotten while it is built.
const PLAN = [
  ["Stage 1 – Macro map", "Where the big money is being spent now, with stats and sources, why, a plain explanation, and the industries each area pulls in."],
  ["Stage 2 – Industries", "A closer look at each industry, following the money down the chain: who actually captures the spending (for example chips and power before software)."],
  ["Stage 3 – Top ETFs", "The leading ETFs per industry, used as a filter as well as a list: weak 3 to 5 year performance is a warning sign, and the top holdings give the stage 4 shortlist."],
  ["Stage 4 – Companies", "Individual companies to watch and why, each with a short scorecard: growth, profit margins, debt and price."],
  ["Monthly check", "Review from the top once a month; if a stage 1 area cools, everything under it gets flagged."],
];

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const dateOf = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
};

export default function Funnel() {
  const [doc, setDoc] = useState(null); // { map, at, prev, prevAt, open, openAreas }
  const [ask, setAsk] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    supabase
      .from("admin_docs")
      .select("data")
      .eq("id", DOC_ID)
      .maybeSingle()
      .then(({ data }) => setDoc(data?.data || { open: true }));
  }, []);

  const save = (next) => {
    setDoc(next);
    supabase.from("admin_docs").upsert({ id: DOC_ID, data: next, updated_at: new Date().toISOString() }).then(() => {});
  };

  // Ask Claude for a fresh or updated map; it searches the web, so it can take a minute.
  const update = async () => {
    if (busy) return;
    setBusy(true);
    setErr("");
    try {
      const { data } = await supabase.auth.getSession();
      const r = await fetch("/api/funnel-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${data?.session?.access_token || ""}` },
        body: JSON.stringify({ map: doc.map || null, ask: ask.trim() }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j.error) throw new Error(j.error || "Claude could not answer. If this keeps happening, try a shorter request.");
      save({ ...doc, map: j.map, at: new Date().toISOString(), prev: doc.map || null, prevAt: doc.at || "" });
      setAsk("");
    } catch (e) {
      setErr(e.message || "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  if (!doc) return <div className="w-full" />;
  const map = doc.map;
  const openAreas = doc.openAreas || [];
  const toggleArea = (name) => save({ ...doc, openAreas: openAreas.includes(name) ? openAreas.filter((x) => x !== name) : [...openAreas, name] });
  const label = "text-[10px] font-bold uppercase tracking-[0.06em] text-neutral-500";

  return (
    <div className="w-full overflow-x-auto">
      <div className="w-full min-w-[640px] overflow-hidden border border-black bg-white shadow-sm">
        <div className="h-[10px]" style={{ backgroundColor: GAP_BG }} />
        {/* The plan, opened and closed from its bar, remembered like everything else. */}
        <div onClick={() => save({ ...doc, planOpen: !doc.planOpen })} className="flex h-[22px] cursor-pointer select-none items-center gap-2 border-t border-black px-2" style={{ backgroundColor: BAR_BG }}>
          <span className={head}>Plan</span>
          <ChevronDown size={14} strokeWidth={2.75} className={`ml-auto shrink-0 text-neutral-900 transition-transform ${doc.planOpen ? "rotate-180" : ""}`} />
        </div>
        {doc.planOpen && PLAN.map(([t, d]) => (
          <div key={t} className="flex gap-2 border-t border-black px-2 py-[3px] text-[11px] leading-[15px] text-neutral-900" style={{ backgroundColor: PINK }}>
            <span className="w-[140px] shrink-0 font-bold">{t}</span>
            <span>{d}</span>
          </div>
        ))}
        <div className="h-[10px] border-t border-black" style={{ backgroundColor: GAP_BG }} />
        {/* The bar opens and closes the map, and stays as you left it. */}
        <div onClick={() => save({ ...doc, open: !doc.open })} className="flex h-[22px] cursor-pointer select-none items-center gap-2 border-t border-black px-2" style={{ backgroundColor: BAR_BG }}>
          <span className={head}>Macro map</span>
          <span className="text-[11px] text-neutral-700">Stage 1 – where the money is going</span>
          {doc.at && <span className="ml-2 text-[11px] text-neutral-700">updated {dateOf(doc.at)}</span>}
          <ChevronDown size={14} strokeWidth={2.75} className={`ml-auto shrink-0 text-neutral-900 transition-transform ${doc.open ? "rotate-180" : ""}`} />
        </div>
        {doc.open && (
          <>
            {/* Right now: the overview. */}
            <div className="border-t border-black px-2 py-1.5 text-[11px] leading-[16px] text-neutral-900" style={{ backgroundColor: PINK }}>
              {map ? (
                <>
                  <p>{map.overview}</p>
                  {map.asOf && <p className="pt-0.5 text-[10px] text-neutral-500">Picture as of {map.asOf}</p>}
                </>
              ) : (
                <p className="italic text-neutral-500">No map yet. Use the box below to ask Claude to build the first one.</p>
              )}
            </div>
            {/* Each spending area: a line that opens onto its stats, the reason, the plain
                version and the industries it pulls in. */}
            {map?.areas?.map((a, i) => {
              const open = openAreas.includes(a.name);
              return (
                <div key={a.name + i}>
                  <div onClick={() => toggleArea(a.name)} className="flex h-[22px] cursor-pointer select-none items-center gap-2 border-t border-black px-2" style={{ backgroundColor: SUB_BG }}>
                    <span className="w-4 shrink-0 text-right text-[11px] font-bold tabular-nums text-neutral-900">{i + 1}.</span>
                    <span className={head}>{a.name}</span>
                    <ChevronDown size={12} className={`ml-auto shrink-0 text-neutral-900 transition-transform ${open ? "rotate-180" : ""}`} />
                  </div>
                  {open && (
                    <div className="flex flex-col gap-1.5 border-t border-black px-2 py-1.5 pl-8 text-[11px] leading-[16px] text-neutral-900">
                      {a.stats?.length > 0 && (
                        <div>
                          <p className={label}>The numbers</p>
                          {a.stats.map((s, k) => <p key={k}>• {s}</p>)}
                        </div>
                      )}
                      {a.why && (
                        <div>
                          <p className={label}>Why</p>
                          <p>{a.why}</p>
                        </div>
                      )}
                      {a.simple && (
                        <div className="border-l-[3px] border-[#F2C46D] pl-2">
                          <p className={label}>Put simply</p>
                          <p>{a.simple}</p>
                        </div>
                      )}
                      {a.industries?.length > 0 && (
                        <div>
                          <p className={label}>Industries that play a role</p>
                          <div className="flex flex-wrap gap-1 pt-0.5">
                            {a.industries.map((n) => (
                              <span key={n} className="border border-neutral-400 bg-white px-1.5 text-[11px] leading-[16px]">{n}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            {doc.prev && (
              <div className="border-t border-black px-2 py-1">
                <button
                  onClick={() => save({ ...doc, map: doc.prev, at: doc.prevAt, prev: doc.map, prevAt: doc.at })}
                  className="text-[10px] text-[#0f766e] underline underline-offset-2 hover:text-[#0c5e57]"
                >
                  Swap back to the previous map
                </button>
              </div>
            )}
            {/* The AI box: what to update, then Update. Enter sends; Shift+Enter starts a new line. */}
            <div className="flex items-start gap-2 border-t border-black px-2 py-1.5">
              <textarea
                value={ask}
                onChange={(e) => setAsk(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); update(); } }}
                rows={2}
                placeholder={map ? "What should Claude update? Leave empty to refresh the whole map." : "Anything Claude should take into account? Leave empty for a general map."}
                className="min-w-0 flex-1 resize-none border border-neutral-400 bg-white px-1.5 py-1 text-[11px] leading-[15px] text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-[#0f766e]"
              />
              <button
                onClick={update}
                disabled={busy}
                className="h-[24px] shrink-0 border border-[#0f766e] bg-[#0f766e] px-3 text-[11px] font-bold uppercase tracking-wide text-white hover:bg-[#0c5e57] disabled:opacity-50"
              >
                {busy ? "Working…" : map ? "Update" : "Build"}
              </button>
            </div>
            {busy && <p className="border-t border-black px-2 py-1 text-[11px] italic text-neutral-500">Claude is searching the web and writing. This can take up to a minute.</p>}
            {err && <p className="border-t border-black px-2 py-1 text-[11px] font-semibold text-[#C1440E]">{err}</p>}
          </>
        )}
        <div className="h-[10px] border-t border-black" style={{ backgroundColor: GAP_BG }} />
      </div>
    </div>
  );
}
