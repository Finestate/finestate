import { useEffect, useState } from "react";
import { ChevronDown, Trash2 } from "lucide-react";
import { supabase } from "./lib/supabaseClient.js";

// Investing > Funnel: from geopolitics down to companies, one stage under the other.
// Each stage is written by Claude from a web search. Ticking items in a stage decides what
// the next stage is built from, so the chain from a force down to a company stays visible:
// each item shows what it is tied to above, and is flagged when that is no longer ticked.
// Each stage also has an Ask box for questions, kept as a short thread.
// Everything is kept in Supabase, with the version before each update to go back to.
const DOC_ID = "funnel";
const BAR_BG = "#F2C46D";
const GAP_BG = "#8A8A8A";
const PINK = "#FBEFEC";
const TEAL = "#0f766e";
const RED = "#E0101F";
const head = "text-[11px] font-bold uppercase leading-[15px] tracking-[0.06em] text-neutral-900";
const label = "text-[10px] font-bold uppercase tracking-[0.06em] text-neutral-500";

const STAGES = [
  ["geo", "Geopolitics", "the forces shaping where money goes"],
  ["region", "Regions", "who gains and who loses from them"],
  ["industry", "Industries", "who captures the money in those regions"],
  ["etf", "ETFs", "funds that hold those industries"],
  ["company", "Companies", "the businesses inside, with a scorecard"],
];

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const dateOf = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
};
// The score's colour: strong ties in green, weak in grey.
const scoreColor = (n) => (n >= 8 ? "#15803d" : n >= 5 ? "#9c7c33" : "#737373");

export default function Funnel() {
  const [doc, setDoc] = useState(null);
  const [asks, setAsks] = useState({}); // what is typed in each stage's Update box
  const [questions, setQuestions] = useState({}); // what is typed in each stage's Ask box
  const [busy, setBusy] = useState(""); // "geo:build", "region:ask" and so on
  const [err, setErr] = useState({});

  useEffect(() => {
    supabase
      .from("admin_docs")
      .select("data")
      .eq("id", DOC_ID)
      .maybeSingle()
      .then(({ data }) => setDoc(data?.data || { open: { geo: true } }));
  }, []);

  const save = (next) => {
    setDoc(next);
    supabase.from("admin_docs").upsert({ id: DOC_ID, data: next, updated_at: new Date().toISOString() }).then(() => {});
  };

  if (!doc) return <div className="w-full" />;

  const stages = doc.stages || {};
  const picks = doc.picks || {};
  const open = doc.open || {};
  const openItems = doc.openItems || [];
  const chat = doc.chat || {};
  const itemsOf = (key) => stages[key]?.data?.items || [];
  const tickedOf = (key) => itemsOf(key).filter((x) => (picks[key] || []).includes(x.name));
  // Everything ticked above a stage, top first.
  const chainFor = (i) => STAGES.slice(0, i).map(([k]) => ({ stage: k, items: tickedOf(k) }));

  const call = async (key, i, mode) => {
    if (busy) return;
    setBusy(`${key}:${mode}`);
    setErr((e) => ({ ...e, [key]: "" }));
    try {
      const { data } = await supabase.auth.getSession();
      const r = await fetch("/api/funnel-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${data?.session?.access_token || ""}` },
        body: JSON.stringify({
          mode,
          stage: key,
          current: stages[key]?.data || null,
          chain: chainFor(i),
          ask: (asks[key] || "").trim(),
          question: (questions[key] || "").trim(),
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j.error) throw new Error(j.error || "Claude could not answer. If this keeps happening, try a shorter request.");
      if (mode === "ask") {
        save({ ...doc, chat: { ...chat, [key]: [{ q: questions[key].trim(), a: j.answer, at: new Date().toISOString() }, ...(chat[key] || [])].slice(0, 20) } });
        setQuestions((q) => ({ ...q, [key]: "" }));
      } else {
        const was = stages[key];
        // Ticks carry over for items that are still there.
        const names = j.stage.items.map((x) => x.name);
        save({
          ...doc,
          stages: { ...stages, [key]: { data: j.stage, at: new Date().toISOString(), prev: was?.data || null, prevAt: was?.at || "" } },
          picks: { ...picks, [key]: (picks[key] || []).filter((n) => names.includes(n)) },
          open: { ...open, [key]: true },
        });
        setAsks((a) => ({ ...a, [key]: "" }));
      }
    } catch (e) {
      setErr((x) => ({ ...x, [key]: e.message || "Something went wrong. Please try again." }));
    } finally {
      setBusy("");
    }
  };

  const toggle = (obj, k) => ({ ...obj, [k]: !obj[k] });
  const togglePick = (key, name) => {
    const cur = picks[key] || [];
    save({ ...doc, picks: { ...picks, [key]: cur.includes(name) ? cur.filter((n) => n !== name) : [...cur, name] } });
  };
  const toggleItem = (id) => save({ ...doc, openItems: openItems.includes(id) ? openItems.filter((x) => x !== id) : [...openItems, id] });

  return (
    <div className="w-full overflow-hidden border border-black bg-white shadow-sm">
      {STAGES.map(([key, title, sub], i) => {
        const st = stages[key];
        const data = st?.data;
        const items = data?.items || [];
        const mine = picks[key] || [];
        const above = i > 0 ? tickedOf(STAGES[i - 1][0]) : [];
        // Names ticked anywhere above, to check each item's ties against.
        const tickedAbove = chainFor(i).flatMap((c) => c.items.map((x) => x.name));
        const blocked = i > 0 && above.length === 0;
        const isOpen = !!open[key];
        return (
          <div key={key}>
            <div className={`h-[10px] ${i ? "border-t border-black" : ""}`} style={{ backgroundColor: GAP_BG }} />
            {/* The stage's bar: number, name, what it is, how many ticked, when updated. */}
            <div onClick={() => save({ ...doc, open: toggle(open, key) })} className="flex h-[21px] cursor-pointer select-none items-center gap-2 border-t border-black px-2" style={{ backgroundColor: BAR_BG }}>
              <span className={head}>{i + 1}. {title}</span>
              <span className="truncate text-[11px] text-neutral-700">{sub}</span>
              <span className="ml-auto shrink-0 text-[11px] tabular-nums text-neutral-700">
                {items.length > 0 && `${mine.length} of ${items.length} ticked`}
                {st?.at && ` – updated ${dateOf(st.at)}`}
              </span>
              <ChevronDown size={14} strokeWidth={2.75} className={`shrink-0 text-neutral-900 transition-transform ${isOpen ? "rotate-180" : ""}`} />
            </div>
            {isOpen && (
              <>
                {/* What this stage is built from: the ticks in the stage above. */}
                {i > 0 && (
                  <div className="flex min-h-[21px] flex-wrap items-center gap-1 border-t border-black px-2 py-[2px] text-[11px]">
                    <span className={label}>Built from</span>
                    {above.length ? above.map((x) => (
                      <span key={x.name} className="border border-neutral-400 bg-white px-1.5 leading-[15px] text-neutral-900">{x.name}</span>
                    )) : <span className="italic text-neutral-500">Tick at least one item in {STAGES[i - 1][1]} first.</span>}
                  </div>
                )}
                {/* The big picture of this stage. */}
                <div className="border-t border-black px-2 py-1 text-[11px] leading-[16px] text-neutral-900" style={{ backgroundColor: PINK }}>
                  {data ? (
                    <>
                      <p>{data.overview}</p>
                      {data.asOf && <p className="text-[10px] text-neutral-500">Picture as of {data.asOf}</p>}
                    </>
                  ) : (
                    <p className="italic text-neutral-500">Not built yet. Press Build below and Claude will search the web and write it.</p>
                  )}
                </div>
                {/* One line per item: tick, name, tag, score; it opens onto the detail. */}
                {items.map((x, n) => {
                  const id = `${key}:${x.name}`;
                  const itemOpen = openItems.includes(id);
                  const ticked = mine.includes(x.name);
                  const lost = i > 0 && (x.links || []).length > 0 && !(x.links || []).some((l) => tickedAbove.includes(l));
                  return (
                    <div key={id}>
                      <div onClick={() => toggleItem(id)} className={`flex h-[21px] cursor-pointer select-none items-center gap-2 border-t border-black px-2 ${ticked ? "bg-[#EEF7EE]" : ""}`}>
                        <input
                          type="checkbox"
                          checked={ticked}
                          onClick={(e) => e.stopPropagation()}
                          onChange={() => togglePick(key, x.name)}
                          className="h-3 w-3 shrink-0 cursor-pointer accent-[#0f766e]"
                          title="Tick to take this into the next stage"
                        />
                        <span className="w-4 shrink-0 text-right text-[11px] tabular-nums text-neutral-500">{n + 1}.</span>
                        <span className="truncate text-[11px] font-semibold text-neutral-900">{x.name}</span>
                        {x.tag && x.tag !== x.name && <span className="shrink-0 text-[10px] font-bold uppercase tracking-[0.04em] text-neutral-500">{x.tag}</span>}
                        {lost && <span className="shrink-0 text-[10px] font-bold" style={{ color: RED }} title="What this is tied to above is no longer ticked">Unticked above</span>}
                        <span className="ml-auto flex shrink-0 items-center gap-1.5">
                          {x.links?.length > 0 && <span className="hidden max-w-[260px] truncate text-[10px] text-neutral-500 md:inline">{x.links.join(", ")}</span>}
                          {Number.isFinite(+x.score) && (
                            <span className="w-[34px] text-right text-[11px] font-bold tabular-nums" style={{ color: scoreColor(+x.score) }} title="How strongly it is tied to the chain above, out of 10">
                              {x.score}/10
                            </span>
                          )}
                          <ChevronDown size={12} className={`text-neutral-900 transition-transform ${itemOpen ? "rotate-180" : ""}`} />
                        </span>
                      </div>
                      {itemOpen && (
                        <div className="grid grid-cols-1 gap-x-4 gap-y-1.5 border-t border-black px-2 py-1.5 pl-[46px] text-[11px] leading-[16px] text-neutral-900 md:grid-cols-2">
                          <div className="flex flex-col gap-1.5">
                            {x.simple && (
                              <div className="border-l-[3px] border-[#F2C46D] pl-2">
                                <p className={label}>Put simply</p>
                                <p>{x.simple}</p>
                              </div>
                            )}
                            {x.why && (
                              <div>
                                <p className={label}>Why it matters</p>
                                <p>{x.why}</p>
                              </div>
                            )}
                            {x.stats?.length > 0 && (
                              <div>
                                <p className={label}>The numbers</p>
                                {x.stats.map((s, k) => <p key={k}>• {s}</p>)}
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col gap-1.5">
                            {x.facts && Object.keys(x.facts).length > 0 && (
                              <div className="border border-neutral-300">
                                {Object.entries(x.facts).map(([k, v]) => (
                                  <div key={k} className="flex border-t border-neutral-300 first:border-t-0">
                                    <span className="w-[110px] shrink-0 bg-neutral-50 px-1.5 text-[10px] font-bold uppercase leading-[18px] tracking-[0.04em] text-neutral-500">{k}</span>
                                    <span className="min-w-0 flex-1 px-1.5 leading-[18px]">{String(v)}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                            {x.links?.length > 0 && (
                              <div>
                                <p className={label}>Tied to above</p>
                                <div className="flex flex-wrap gap-1 pt-0.5">
                                  {x.links.map((l) => (
                                    <span key={l} className={`border px-1.5 leading-[16px] ${tickedAbove.includes(l) ? "border-[#0f766e] text-[#0f766e]" : "border-neutral-300 text-neutral-400 line-through"}`}>{l}</span>
                                  ))}
                                </div>
                              </div>
                            )}
                            {x.watch && (
                              <div>
                                <p className={label}>Watch</p>
                                <p>{x.watch}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
                {st?.prev && (
                  <div className="border-t border-black px-2 py-[3px]">
                    <button
                      onClick={() => save({ ...doc, stages: { ...stages, [key]: { ...st, data: st.prev, at: st.prevAt, prev: st.data, prevAt: st.at } } })}
                      className="text-[10px] text-[#0f766e] underline underline-offset-2 hover:text-[#0c5e57]"
                    >
                      Swap back to the version before
                    </button>
                  </div>
                )}
                {/* Build or update: what to change, then the button. Enter sends. */}
                <div className="flex items-center gap-2 border-t border-black px-2 py-1">
                  <input
                    value={asks[key] || ""}
                    onChange={(e) => setAsks((a) => ({ ...a, [key]: e.target.value }))}
                    onKeyDown={(e) => { if (e.key === "Enter" && !blocked) call(key, i, "build"); }}
                    placeholder={data ? "What should Claude change? Leave empty to refresh it all." : "Anything Claude should focus on? Leave empty for a general picture."}
                    className="h-[21px] min-w-0 flex-1 border border-neutral-400 bg-white px-1.5 text-[11px] text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-[#0f766e]"
                  />
                  <button
                    onClick={() => call(key, i, "build")}
                    disabled={!!busy || blocked}
                    className="h-[21px] w-[78px] shrink-0 bg-[#0f766e] text-[11px] font-bold uppercase tracking-wide text-white hover:bg-[#0c5e57] disabled:opacity-40"
                  >
                    {busy === `${key}:build` ? "Working…" : data ? "Update" : "Build"}
                  </button>
                </div>
                {/* Ask: questions about this stage, answered in plain words. */}
                <div className="flex items-center gap-2 border-t border-black px-2 py-1">
                  <input
                    value={questions[key] || ""}
                    onChange={(e) => setQuestions((q) => ({ ...q, [key]: e.target.value }))}
                    onKeyDown={(e) => { if (e.key === "Enter" && (questions[key] || "").trim()) call(key, i, "ask"); }}
                    placeholder={`Ask anything about ${title.toLowerCase()}, such as how two of them are linked.`}
                    className="h-[21px] min-w-0 flex-1 border border-neutral-400 bg-white px-1.5 text-[11px] text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-[#0f766e]"
                  />
                  <button
                    onClick={() => call(key, i, "ask")}
                    disabled={!!busy || !(questions[key] || "").trim()}
                    className="h-[21px] w-[78px] shrink-0 border border-[#0f766e] bg-white text-[11px] font-bold uppercase tracking-wide text-[#0f766e] hover:bg-[#EEF7EE] disabled:opacity-40"
                  >
                    {busy === `${key}:ask` ? "Working…" : "Ask"}
                  </button>
                </div>
                {busy.startsWith(`${key}:`) && <p className="border-t border-black px-2 py-[3px] text-[11px] italic text-neutral-500">Claude is searching the web and writing. This can take up to a minute.</p>}
                {err[key] && <p className="border-t border-black px-2 py-[3px] text-[11px] font-semibold" style={{ color: RED }}>{err[key]}</p>}
                {/* The thread: newest first. */}
                {(chat[key] || []).map((c, k) => (
                  <div key={c.at + k} className="group flex gap-2 border-t border-black px-2 py-1 text-[11px] leading-[16px] text-neutral-900">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{c.q}</p>
                      <p className="whitespace-pre-wrap">{c.a}</p>
                    </div>
                    <button
                      onClick={() => save({ ...doc, chat: { ...chat, [key]: chat[key].filter((_, m) => m !== k) } })}
                      title="Remove this question"
                      className="shrink-0 self-start pt-[2px] text-neutral-400 opacity-0 hover:text-[#C1440E] group-hover:opacity-100"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                ))}
              </>
            )}
          </div>
        );
      })}
      <div className="h-[10px] border-t border-black" style={{ backgroundColor: GAP_BG }} />
    </div>
  );
}
