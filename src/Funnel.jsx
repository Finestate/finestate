import { useEffect, useState } from "react";
import { ChevronDown, Info, Plus, Trash2, X } from "lucide-react";
import { supabase } from "./lib/supabaseClient.js";

// Investing > Funnel: from big shifts down to single stocks, the same way every time.
// Radar: each theme scored 1–5 on the five signals of a lasting shift. Funnel: each theme
// opens onto what it needs, each need onto the companies that supply it, and each company
// gets the same scorecard. Kept in Supabase.
const DOC_ID = "funnel";
const BAR_BG = "#F2C46D";
const HEADER_BG = "#FCEFCF";
const GAP_BG = "#8A8A8A";
const PINK = "#FBEFEC";
const head = "text-[11px] font-bold uppercase leading-[15px] tracking-[0.06em] text-neutral-900";
const row = "flex h-[22px] items-stretch border-t border-black";

let _idc = 0;
const newId = () => "f" + Date.now().toString(36) + "-" + (_idc++);

// The five signals of a big shift, each scored 1 (weak) to 5 (strong).
const SIGNALS = [
  ["money", "Money in", "Where the biggest companies and governments are committing spending."],
  ["cost", "Cost falling", "When something gets much cheaper fast, new demand explodes."],
  ["adoption", "Early", "Early on the adoption curve (about 5–20% adopted), so most growth is ahead."],
  ["bottleneck", "Bottlenecks", "Shortages appearing (power, parts, people) show who gets paid next."],
  ["lasting", "Lasting", "A structural shift of 10+ years, not a one-year fad."],
];
// The same five tests for every company, each scored 1 to 5.
const TESTS = [
  ["growth", "Growth", "How fast sales and profits are growing."],
  ["margins", "Margins", "How much of each sale is kept as profit."],
  ["moat", "Moat", "How hard it is for others to take its customers."],
  ["debt", "Debt", "How safe its borrowing is (5 = little or none)."],
  ["value", "Valuation", "How reasonable the price is for what you get (5 = cheap)."],
];
const STATUS = ["", "Watch", "Buy", "Own", "Pass"];

// A starting theme and what it needs; companies are added as you research them.
const START = {
  themes: [
    {
      id: "dc",
      name: "AI data centres",
      needs: ["Chips", "Networking", "Memory", "Power generation", "Grid equipment", "Cooling", "Construction", "Copper", "Uranium"].map((n, i) => ({ id: "dc" + i, name: n, companies: [] })),
    },
  ],
};

const scoreOf = (x, list) => {
  const vals = list.map(([k]) => Number(x[k])).filter((n) => n >= 1 && n <= 5);
  return vals.length ? vals.reduce((a, b) => a + b, 0) : null;
};

// One score cell: a number from 1 to 5, nothing else.
function Score({ value, onChange }) {
  return (
    <span className="flex w-16 shrink-0 items-center border-l border-black px-2">
      <input
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value.replace(/[^1-5]/g, "").slice(-1))}
        inputMode="numeric"
        className="w-full bg-transparent text-center text-[11px] tabular-nums text-neutral-900 outline-none"
      />
    </span>
  );
}

export default function Funnel() {
  const [doc, setDoc] = useState(null);
  const [about, setAbout] = useState(null); // { title, text }
  const [confirm, setConfirm] = useState(null); // { name, run }

  useEffect(() => {
    supabase
      .from("admin_docs")
      .select("data")
      .eq("id", DOC_ID)
      .maybeSingle()
      .then(({ data }) => setDoc(data?.data?.themes ? data.data : START));
  }, []);

  const save = (next) => {
    setDoc(next);
    supabase.from("admin_docs").upsert({ id: DOC_ID, data: next, updated_at: new Date().toISOString() }).then(() => {});
  };
  // Change one theme, need or company, found by its ids.
  const editTheme = (tid, fn) => save({ ...doc, themes: doc.themes.map((t) => (t.id === tid ? fn(t) : t)) });
  const editNeed = (tid, nid, fn) => editTheme(tid, (t) => ({ ...t, needs: t.needs.map((n) => (n.id === nid ? fn(n) : n)) }));
  const editCo = (tid, nid, cid, fields) => editNeed(tid, nid, (n) => ({ ...n, companies: n.companies.map((c) => (c.id === cid ? { ...c, ...fields } : c)) }));
  const toggle = (key) => save({ ...doc, open: { ...(doc.open || {}), [key]: !doc.open?.[key] } });
  const isOpen = (key) => !!doc.open?.[key];

  if (!doc) return <div className="w-full" />;

  const bin = (name, run) => (
    <button onClick={(e) => { e.stopPropagation(); setConfirm({ name, run }); }} title="Delete" className="shrink-0 text-neutral-900 hover:text-[#C1440E]">
      <Trash2 size={11} />
    </button>
  );
  const addBtn = (label, onClick, indent = "px-2", pink) => (
    <button
      onClick={onClick}
      className={`flex h-[22px] w-full items-center gap-[2px] border-t border-black ${indent} text-[11px] font-bold text-[#0f766e] hover:text-[#0c5e57]`}
      style={pink ? { backgroundColor: PINK } : undefined}
    >
      <Plus size={11} strokeWidth={3} />{label}
    </button>
  );
  const headCell = ([k, label, text]) => (
    <span key={k} className={`flex w-16 shrink-0 items-center justify-center gap-0.5 border-l border-black px-1 ${head}`}>
      {label}
      <button onClick={() => setAbout({ title: label, text })} title="What this means" className="text-neutral-900 hover:text-[#9c7c33]">
        <Info size={10} strokeWidth={2.5} />
      </button>
    </span>
  );
  const total = (x, list) => {
    const s = scoreOf(x, list);
    return (
      <span className="flex w-16 shrink-0 items-center justify-center border-l border-black px-2 text-[11px] font-bold tabular-nums text-[#1d4ed8]">
        {s != null ? `${s}/${list.length * 5}` : ""}
      </span>
    );
  };

  // Strongest themes first in the funnel; the radar keeps the order you typed them in.
  const ranked = [...doc.themes].sort((a, b) => (scoreOf(b, SIGNALS) ?? -1) - (scoreOf(a, SIGNALS) ?? -1));

  return (
    <div className="w-full overflow-x-auto">
      <div className="w-full min-w-[900px] overflow-hidden border border-black bg-white shadow-sm">
        {/* Radar */}
        <div className="h-[10px]" style={{ backgroundColor: GAP_BG }} />
        <div className="flex h-[22px] items-center border-t border-black px-2" style={{ backgroundColor: BAR_BG }}>
          <span className={head}>Radar – big shifts</span>
        </div>
        <div className={row} style={{ backgroundColor: HEADER_BG }}>
          <span className={`flex flex-1 items-center px-2 ${head}`}>Theme</span>
          {SIGNALS.map(headCell)}
          <span className={`flex w-16 shrink-0 items-center justify-center border-l border-black px-2 ${head}`}>Score</span>
        </div>
        {doc.themes.map((t) => (
          <div key={t.id} className={row}>
            <span className="flex min-w-0 flex-1 items-center gap-1 px-2">
              <input
                value={t.name}
                onChange={(e) => editTheme(t.id, (x) => ({ ...x, name: e.target.value }))}
                className="min-w-0 flex-1 bg-transparent text-[11px] text-neutral-900 outline-none"
              />
              {bin(t.name, () => save({ ...doc, themes: doc.themes.filter((x) => x.id !== t.id) }))}
            </span>
            {SIGNALS.map(([k]) => (
              <Score key={k} value={t[k]} onChange={(v) => editTheme(t.id, (x) => ({ ...x, [k]: v }))} />
            ))}
            {total(t, SIGNALS)}
          </div>
        ))}
        {addBtn("Add theme", () => save({ ...doc, themes: [...doc.themes, { id: newId(), name: "", needs: [] }] }))}

        {/* Funnel */}
        <div className="h-[10px] border-t border-black" style={{ backgroundColor: GAP_BG }} />
        <div className="flex h-[22px] items-center border-t border-black px-2" style={{ backgroundColor: BAR_BG }}>
          <span className={head}>Funnel – theme ▸ needs ▸ companies</span>
        </div>
        <div className={row} style={{ backgroundColor: HEADER_BG }}>
          <span className={`flex flex-1 items-center px-2 ${head}`}>Theme / need / company</span>
          <span className={`flex w-20 shrink-0 items-center border-l border-black px-2 ${head}`}>Ticker</span>
          {TESTS.map(headCell)}
          <span className={`flex w-16 shrink-0 items-center justify-center border-l border-black px-2 ${head}`}>Score</span>
          <span className={`flex w-20 shrink-0 items-center border-l border-black px-2 ${head}`}>Status</span>
        </div>
        {ranked.map((t) => {
          const tOpen = isOpen(t.id);
          return (
            <div key={t.id}>
              {/* The theme: the whole line opens it. */}
              <div onClick={() => toggle(t.id)} className={`${row} cursor-pointer select-none`}>
                <span className="flex flex-1 items-center gap-1 px-2 text-[11px] font-bold text-neutral-900">
                  {t.name || "Untitled theme"}
                  <ChevronDown size={12} className={`ml-auto shrink-0 transition-transform ${tOpen ? "rotate-180" : ""}`} />
                </span>
                <span className="w-20 shrink-0 border-l border-black" />
                <span className="flex shrink-0 items-center justify-end border-l border-black px-2 text-[11px] tabular-nums text-[#1d4ed8]" style={{ width: `${TESTS.length * 4}rem` }}>
                  {scoreOf(t, SIGNALS) != null ? `Radar ${scoreOf(t, SIGNALS)}/25` : ""}
                </span>
                <span className="w-16 shrink-0 border-l border-black" />
                <span className="w-20 shrink-0 border-l border-black" />
              </div>
              {tOpen && (
                <>
                  {t.needs.map((n) => {
                    const nKey = `${t.id}/${n.id}`;
                    const nOpen = isOpen(nKey);
                    return (
                      <div key={n.id}>
                        {/* A need: the line opens its companies; the name is for typing. */}
                        <div onClick={() => toggle(nKey)} className={`${row} cursor-pointer select-none pt-px`} style={{ backgroundColor: PINK }}>
                          <span className="flex min-w-0 flex-1 items-center gap-1 pl-6 pr-2">
                            <input
                              value={n.name}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => editNeed(t.id, n.id, (x) => ({ ...x, name: e.target.value }))}
                              style={{ fieldSizing: "content" }}
                              className="min-w-[4ch] bg-transparent text-[11px] text-neutral-900 outline-none"
                            />
                            <span className="text-[11px] text-neutral-500">({n.companies.length})</span>
                            <ChevronDown size={12} className={`ml-auto shrink-0 transition-transform ${nOpen ? "rotate-180" : ""}`} />
                            {bin(n.name, () => editTheme(t.id, (x) => ({ ...x, needs: x.needs.filter((y) => y.id !== n.id) })))}
                          </span>
                          <span className="w-20 shrink-0 border-l border-black" />
                          <span className="shrink-0 border-l border-black" style={{ width: `${TESTS.length * 4}rem` }} />
                          <span className="w-16 shrink-0 border-l border-black" />
                          <span className="w-20 shrink-0 border-l border-black" />
                        </div>
                        {nOpen && (
                          <>
                            {n.companies.map((c) => (
                              <div key={c.id} className={`${row} pt-px`}>
                                <span className="flex min-w-0 flex-1 items-center gap-1 pl-10 pr-2">
                                  <input
                                    value={c.name}
                                    onChange={(e) => editCo(t.id, n.id, c.id, { name: e.target.value })}
                                    className="min-w-0 flex-1 bg-transparent text-[11px] text-neutral-900 outline-none"
                                  />
                                  {bin(c.name, () => editNeed(t.id, n.id, (x) => ({ ...x, companies: x.companies.filter((y) => y.id !== c.id) })))}
                                </span>
                                <span className="flex w-20 shrink-0 items-center border-l border-black px-2">
                                  <input
                                    value={c.ticker || ""}
                                    onChange={(e) => editCo(t.id, n.id, c.id, { ticker: e.target.value.toUpperCase() })}
                                    className="w-full bg-transparent text-[11px] tabular-nums text-neutral-900 outline-none"
                                  />
                                </span>
                                {TESTS.map(([k]) => (
                                  <Score key={k} value={c[k]} onChange={(v) => editCo(t.id, n.id, c.id, { [k]: v })} />
                                ))}
                                {total(c, TESTS)}
                                <span className="flex w-20 shrink-0 items-center border-l border-black px-1">
                                  <select
                                    value={c.status || ""}
                                    onChange={(e) => editCo(t.id, n.id, c.id, { status: e.target.value })}
                                    className="w-full cursor-pointer bg-transparent text-[11px] text-neutral-900 outline-none"
                                  >
                                    {STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
                                  </select>
                                </span>
                              </div>
                            ))}
                            {addBtn("Add company", () => editNeed(t.id, n.id, (x) => ({ ...x, companies: [...x.companies, { id: newId(), name: "" }] })), "pl-10 pr-2")}
                          </>
                        )}
                      </div>
                    );
                  })}
                  {addBtn("Add need", () => editTheme(t.id, (x) => ({ ...x, needs: [...x.needs, { id: newId(), name: "", companies: [] }] })), "pl-6 pr-2", true)}
                </>
              )}
            </div>
          );
        })}
        <div className="h-[10px] border-t border-black" style={{ backgroundColor: GAP_BG }} />
      </div>

      {about && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={() => setAbout(null)}>
          <div className="relative w-full max-w-sm border border-black bg-white p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setAbout(null)} title="Close" className="absolute right-2 top-2 text-neutral-900 hover:text-[#C1440E]">
              <X size={12} strokeWidth={2.5} />
            </button>
            <p className={`pr-5 ${head}`}>{about.title}</p>
            <p className="pt-2 text-[11px] leading-[16px] text-neutral-900">{about.text} Score it 1 (weak) to 5 (strong).</p>
          </div>
        </div>
      )}

      {/* The warning: a heavy red frame, the question in bold, a solid button to go ahead. */}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={() => setConfirm(null)}>
          <div className="w-full max-w-sm border-[5px] bg-white p-6 text-center shadow-2xl" style={{ borderColor: "#C1440E" }} onClick={(e) => e.stopPropagation()}>
            <p className="text-[14px] font-bold uppercase tracking-[0.06em] text-neutral-900">Delete {confirm.name || "this line"}?</p>
            <div className="mt-5 flex justify-center gap-3 text-[12px] font-bold uppercase tracking-wide">
              <button
                onClick={() => { confirm.run(); setConfirm(null); }}
                className="border-2 px-5 py-1.5 text-white transition-opacity hover:opacity-80"
                style={{ backgroundColor: "#C1440E", borderColor: "#C1440E" }}
              >
                Delete
              </button>
              <button onClick={() => setConfirm(null)} className="border-2 px-5 py-1.5 transition-opacity hover:opacity-70" style={{ borderColor: "#C1440E", color: "#C1440E" }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
