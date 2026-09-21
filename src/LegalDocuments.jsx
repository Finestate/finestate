import { useEffect, useRef, useState } from "react";
import { Plus, Trash2, Calendar, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { supabase } from "./lib/supabaseClient.js";

// Personal ID numbers live in Supabase, never in this repo.
const DOC_ID = "legal-documents";
const BAR_BG = "#FFE4B3";
const HEADER_BG = "#FCEFCF";

const COLS = [
  { key: "item", label: "Document or ID", w: "30%" },
  { key: "number", label: "Number", w: "17%" },
  { key: "issued", label: "Issue date", w: "17%" },
  { key: "expiry", label: "Expiry date", w: "17%" },
  { key: "scan", label: "Link to document", w: "17%" },
];

const GOLD = "#9c7c33";
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const pad = (n) => String(n).padStart(2, "0");

// Dates are kept as plain text like "08 FEB 2034", so entries such as NA or
// "No expiry" survive untouched. The calendar only writes that same format.
function parseDate(s) {
  const m = String(s || "").trim().match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})$/);
  if (!m) return null;
  const mon = MONTHS.indexOf(m[2].toUpperCase());
  return mon < 0 ? null : { d: +m[1], m: mon, y: +m[3] };
}

// The same picker used on the other sites, in Finestate's gold.
function DatePicker({ value, onPick, onClose, anchor }) {
  const sel = parseDate(value);
  const now = new Date();
  const [view, setView] = useState(() => (sel ? { y: sel.y, m: sel.m } : { y: now.getFullYear(), m: now.getMonth() }));
  const daysIn = (y, m) => new Date(y, m + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < new Date(view.y, view.m, 1).getDay(); i++) cells.push(null);
  for (let d = 1; d <= daysIn(view.y, view.m); d++) cells.push(d);
  while (cells.length % 7) cells.push(null);
  const shift = (delta) => setView((v) => {
    let m = v.m + delta, y = v.y;
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    return { y, m };
  });
  const shiftYear = (delta) => setView((v) => ({ ...v, y: v.y + delta }));

  return (
    <>
      <div className="fixed inset-0 z-[70]" onClick={onClose} />
      <div className="fixed z-[80] w-56 rounded-lg border border-neutral-200 bg-white p-2 shadow-xl" style={{ top: anchor.top, left: anchor.left }}>
        {/* Double chevrons jump a year at a time, single ones a month. */}
        <div className="flex items-center justify-between px-1 pb-1.5">
          <span className="flex items-center">
            <button type="button" onClick={() => shiftYear(-1)} aria-label="Previous year" className="rounded p-1 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"><ChevronsLeft size={15} /></button>
            <button type="button" onClick={() => shift(-1)} aria-label="Previous month" className="rounded p-1 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"><ChevronLeft size={15} /></button>
          </span>
          <span className="text-[11px] font-bold uppercase tracking-wide text-neutral-700">{MONTHS[view.m]} {view.y}</span>
          <span className="flex items-center">
            <button type="button" onClick={() => shift(1)} aria-label="Next month" className="rounded p-1 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"><ChevronRight size={15} /></button>
            <button type="button" onClick={() => shiftYear(1)} aria-label="Next year" className="rounded p-1 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"><ChevronsRight size={15} /></button>
          </span>
        </div>
        <div className="mb-0.5 grid grid-cols-7 gap-0.5 text-center text-[9px] font-bold uppercase text-neutral-400">
          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => <div key={i}>{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-0.5">
          {cells.map((d, i) => {
            if (!d) return <div key={i} />;
            const isSel = sel && sel.d === d && sel.m === view.m && sel.y === view.y;
            return (
              <button
                key={i}
                type="button"
                onClick={() => onPick(`${pad(d)} ${MONTHS[view.m]} ${view.y}`)}
                className={`h-6 rounded text-[11px] transition-colors ${isSel ? "font-bold text-white" : "text-neutral-700 hover:bg-neutral-100"}`}
                style={isSel ? { backgroundColor: GOLD } : undefined}
              >
                {d}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

function DateCell({ value, onChange }) {
  const [anchor, setAnchor] = useState(null);
  const btn = useRef(null);
  const open = () => {
    const r = btn.current?.getBoundingClientRect();
    if (r) setAnchor({ top: r.bottom + 4, left: Math.min(r.left, window.innerWidth - 236) });
  };
  return (
    <span className="flex w-full items-center gap-1.5">
      <button ref={btn} type="button" onClick={() => (anchor ? setAnchor(null) : open())} title="Pick a date" className="shrink-0 text-neutral-400 hover:text-[#9c7c33]">
        <Calendar size={12} />
      </button>
      <input value={value || ""} onChange={(e) => onChange(e.target.value)} className={cell} />
      {anchor && <DatePicker value={value} anchor={anchor} onClose={() => setAnchor(null)} onPick={(v) => { onChange(v); setAnchor(null); }} />}
    </span>
  );
}

// Anything that looks like an address shows as a link reading "Link to document".
const isUrl = (v) => /^(https?:\/\/|www\.)/i.test(String(v || "").trim());

function LinkCell({ value, onChange }) {
  const [editing, setEditing] = useState(false);
  if (!editing && isUrl(value)) {
    const href = /^www\./i.test(value.trim()) ? `https://${value.trim()}` : value.trim();
    return (
      <span className="flex w-full items-center" onDoubleClick={() => setEditing(true)} title="Double click to edit">
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="truncate text-[12px] leading-snug underline underline-offset-2"
          style={{ color: GOLD }}
        >
          Link to document
        </a>
      </span>
    );
  }
  return (
    <input
      value={value || ""}
      autoFocus={editing}
      onChange={(e) => onChange(e.target.value)}
      onBlur={() => setEditing(false)}
      className={cell}
    />
  );
}

let _idc = 0;
const newId = () => "l" + Date.now().toString(36) + "-" + (_idc++);

const cell =
  "w-full bg-transparent py-0.5 text-[12px] leading-snug text-neutral-900 outline-none placeholder:text-neutral-300";
const head =
  "text-[12px] font-black uppercase leading-tight tracking-[0.06em] text-neutral-900";

export default function LegalDocuments() {
  const [items, setItems] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState("");
  const [confirm, setConfirm] = useState(null); // index waiting on a delete confirmation

  useEffect(() => {
    supabase
      .from("admin_docs")
      .select("data")
      .eq("id", DOC_ID)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) setErr(error.message);
        const list = Array.isArray(data?.data) ? data.data : [];
        setItems(list.map((r) => (r.id ? r : { ...r, id: newId() })));
        setLoaded(true);
      });
  }, []);

  const save = (next) => {
    setItems(next);
    supabase
      .from("admin_docs")
      .upsert({ id: DOC_ID, data: next, updated_at: new Date().toISOString() })
      .then(({ error }) => setErr(error ? error.message : ""));
  };

  // Sections keep the order you set; the documents under each sort A to Z.
  const order = (() => {
    const out = []; let group = [];
    const flush = () => { group.sort((a, b) => (items[a].item || "").localeCompare(items[b].item || "")); out.push(...group); group = []; };
    items.forEach((r, i) => { if (r.kind === "section") { flush(); out.push(i); } else group.push(i); });
    flush();
    return out;
  })();

  const update = (i, key, val) => save(items.map((r, idx) => (idx === i ? { ...r, [key]: val } : r)));
  // Deleting always asks first – these entries are not quick to retype.
  const remove = (i) => setConfirm(i);
  const confirmRemove = () => {
    save(items.filter((_, idx) => idx !== confirm));
    setConfirm(null);
  };
  const add = (kind) =>
    save([...items, kind === "section" ? { id: newId(), kind: "section", label: "" } : { id: newId(), kind: "row", item: "", number: "", issued: "", expiry: "", scan: "" }]);

  return (
    <div className="w-full">
      <div spellCheck={false} className="w-full overflow-hidden border-2 border-neutral-400 bg-white shadow-sm">
        {!loaded ? (
          <p className="px-2.5 py-3 text-[12px] italic text-neutral-400">Loading…</p>
        ) : (
          order.map((i) => {
            const r = items[i];
            return r.kind === "section" ? (
              // Each section carries its own column headings underneath it.
              <div key={r.id}>
                {/* Section bars carry no bin – a section only goes when I remove it. */}
                <div className="border-y-2 border-neutral-400 px-2.5 py-0.5" style={{ backgroundColor: BAR_BG }}>
                  <input value={r.label || ""} onChange={(e) => update(i, "label", e.target.value)} className={`block w-full bg-transparent py-0.5 ${head} outline-none`} />
                </div>
                <div className="flex items-center gap-2 border-b-2 border-neutral-400 px-2.5 py-1" style={{ backgroundColor: HEADER_BG }}>
                  <span className="flex min-w-0 flex-1 items-center gap-2">
                    {COLS.map((c) => (
                      <span key={c.key} style={{ width: c.w }} className={`shrink-0 ${head}`}>{c.label}</span>
                    ))}
                  </span>
                  <span className="flex w-8 shrink-0 items-center justify-end pr-1 text-neutral-900"><Trash2 size={12} /></span>
                </div>
              </div>
            ) : (
              <div key={r.id} className="flex items-center gap-2 border-t border-neutral-300 px-2.5 py-0.5">
                <span className="flex min-w-0 flex-1 items-center gap-2">
                  {COLS.map((c) => (
                    <span key={c.key} style={{ width: c.w }} className="shrink-0">
                      {c.key === "issued" || c.key === "expiry" ? (
                        <DateCell value={r[c.key] || ""} onChange={(v) => update(i, c.key, v)} />
                      ) : c.key === "scan" ? (
                        <LinkCell value={r.scan || ""} onChange={(v) => update(i, "scan", v)} />
                      ) : (
                        <input value={r[c.key] || ""} onChange={(e) => update(i, c.key, e.target.value)} className={cell} />
                      )}
                    </span>
                  ))}
                </span>
                <Bin i={i} remove={remove} />
              </div>
            );
          })
        )}

        <div className="flex items-center gap-4 border-t border-neutral-200 bg-neutral-50 px-2.5 py-1">
          <button onClick={() => add("row")} className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-neutral-500 hover:text-neutral-800"><Plus size={12} /> Add row</button>
        </div>
      </div>

      {confirm != null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={() => setConfirm(null)}>
          <div className="w-full max-w-sm rounded-xl border bg-white p-6 text-center shadow-xl" style={{ borderColor: "#C1440E" }} onClick={(e) => e.stopPropagation()}>
            <p className="text-[13px] font-semibold text-neutral-800">Delete this line?</p>
            <div className="mt-5 flex justify-center gap-6 text-[13px] font-semibold uppercase tracking-wide">
              <button onClick={confirmRemove} className="transition-opacity hover:opacity-70" style={{ color: "#C1440E" }}>Delete</button>
              <button onClick={() => setConfirm(null)} className="transition-opacity hover:opacity-70" style={{ color: "#C1440E" }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {err && <p className="pt-2 text-[11px] font-semibold text-[#C1440E]">{err}</p>}
    </div>
  );
}

function Bin({ i, remove }) {
  return (
    <div className="flex w-8 shrink-0 items-center justify-end pr-1">
      <button onClick={() => remove(i)} title="Delete" className="text-neutral-900 hover:text-[#C1440E]"><Trash2 size={12} /></button>
    </div>
  );
}
