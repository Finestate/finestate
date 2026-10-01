import { useEffect, useRef, useState } from "react";
import { Plus, Trash2, Calendar, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, SquarePen, X } from "lucide-react";
import { supabase } from "./lib/supabaseClient.js";

// Personal ID numbers live in Supabase, never in this repo.
const DOC_ID = "legal-documents";
// Same ramp as the Costs table: darkest gold on the section bars, then down.
const BAR_BG = "#F2C46D";
const HEADER_BG = "#FFE4B3";

const COLS = [
  { key: "item", label: "Document or ID", w: "30%" },
  { key: "number", label: "Number", w: "17%" },
  { key: "issued", label: "Issue date", w: "17%" },
  { key: "expiry", label: "Expiry date", w: "17%" },
  { key: "scan", label: "Links to document", w: "17%" },
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

// True when a date in "08 FEB 2034" form is a year or less away, or already past.
const withinAYear = (v) => {
  const d = parseDate(v);
  if (!d) return false;
  const days = (Date.UTC(d.y, d.m, d.d) - Date.now()) / 86400000;
  return days <= 365;
};

function DateCell({ value, onChange, flagSoon }) {
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
      <input value={value || ""} onChange={(e) => onChange(e.target.value)} className={`${cell} ${flagSoon && withinAYear(value) ? "!font-bold !text-[#E0101F] !bg-[#E0101F]/10 rounded px-1" : ""}`} />
      {anchor && <DatePicker value={value} anchor={anchor} onClose={() => setAnchor(null)} onPick={(v) => { onChange(v); setAnchor(null); }} />}
    </span>
  );
}

// Anything that looks like an address shows as a link reading "Link to document".
const isUrl = (v) => /^(https?:\/\/|www\.)/i.test(String(v || "").trim());

const toHref = (v) => (/^www\./i.test(String(v).trim()) ? `https://${String(v).trim()}` : String(v).trim());

// A row holds any number of links, each with a short name of its own. Rows saved
// before this held one address in `scan`; that becomes their first link.
const linksOf = (r) =>
  Array.isArray(r.links) ? r.links : r.scan ? [{ id: "scan", name: "", url: r.scan }] : [];

// The cell: the links by name, a dot between them, and a pencil that shows on hover
// (always, while there are none) to add or change them.
function LinksCell({ links, onEdit }) {
  return (
    <span className="group flex w-full items-center gap-1 overflow-hidden">
      <span className="flex min-w-0 items-center gap-1 overflow-hidden">
        {links.map((l, k) => (
          <span key={l.id || k} className="flex min-w-0 items-center gap-1">
            {k > 0 && <span className="text-[11px] leading-[15px] text-neutral-400">·</span>}
            {isUrl(l.url) ? (
              <a href={toHref(l.url)} target="_blank" rel="noreferrer" title={l.url} className="truncate text-[11px] leading-[15px] underline underline-offset-2" style={{ color: GOLD }}>
                {l.name || `Link ${k + 1}`}
              </a>
            ) : (
              <span className="truncate text-[11px] leading-[15px] text-neutral-900">{l.name || l.url}</span>
            )}
          </span>
        ))}
      </span>
      <button
        onClick={onEdit}
        title="Add or change links"
        className={`ml-auto shrink-0 text-neutral-400 hover:text-neutral-900 ${links.length ? "opacity-0 group-hover:opacity-100" : ""}`}
      >
        <SquarePen size={11} />
      </button>
    </span>
  );
}

let _idc = 0;
const newId = () => "l" + Date.now().toString(36) + "-" + (_idc++);

// One size, one line height across the whole table – same as the Planning page.
const cell =
  "w-full bg-transparent py-0 text-[11px] leading-[15px] text-neutral-900 outline-none placeholder:text-neutral-300";
const head =
  "text-[11px] font-bold uppercase leading-[15px] tracking-[0.06em] text-neutral-900";

export default function LegalDocuments() {
  const [items, setItems] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState("");
  const [confirm, setConfirm] = useState(null); // index waiting on a delete confirmation
  const [linksFor, setLinksFor] = useState(null); // row whose links the popup is editing
  const [newLinkName, setNewLinkName] = useState("");
  const [newLinkUrl, setNewLinkUrl] = useState("");

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
  // Links are written as a list; the old single address is cleared once it has moved in.
  const setLinks = (i, next) => save(items.map((r, idx) => (idx === i ? { ...r, links: next, scan: "" } : r)));
  const addLink = () => {
    if (!newLinkUrl.trim()) return;
    setLinks(linksFor, [...linksOf(items[linksFor]), { id: newId(), name: newLinkName.trim(), url: newLinkUrl.trim() }]);
    setNewLinkName("");
    setNewLinkUrl("");
  };
  const add = (kind) =>
    save([...items, kind === "section" ? { id: newId(), kind: "section", label: "" } : { id: newId(), kind: "row", item: "", number: "", issued: "", expiry: "", scan: "" }]);

  return (
    // Narrow windows scroll the table sideways rather than squashing the columns.
    <div className="w-full overflow-x-auto">
      <div spellCheck={false} className="w-full min-w-[760px] overflow-hidden border border-black bg-white shadow-sm">
        {!loaded ? (
          <p className="px-2 py-2 text-[11px] italic text-neutral-400">Loading…</p>
        ) : (
          order.map((i, pos) => {
            const r = items[i];
            // Exactly one line between any two bands: every band draws its own top
            // rule, the outer frame closes the table, so nothing ever doubles up.
            const rule = pos === 0 ? "" : "border-t border-black";
            return r.kind === "section" ? (
              // Each section carries its own column headings underneath it.
              <div key={r.id}>
                {/* Section bars carry no bin – a section only goes when I remove it. */}
                <div className={`flex h-[18px] items-center px-2 ${rule}`} style={{ backgroundColor: BAR_BG }}>
                  <input value={r.label || ""} onChange={(e) => update(i, "label", e.target.value)} className={`block w-full bg-transparent py-0 ${head} outline-none`} />
                </div>
                <div className="flex h-[18px] items-center gap-2 border-t border-black px-2" style={{ backgroundColor: HEADER_BG }}>
                  <span className="flex min-w-0 flex-1 items-center gap-2">
                    {COLS.map((c) => (
                      <span key={c.key} style={{ width: c.w }} className={`shrink-0 ${head}`}>{c.label}</span>
                    ))}
                  </span>
                  <span className="flex w-8 shrink-0 items-center justify-end pr-1 text-neutral-900"><Trash2 size={12} /></span>
                </div>
              </div>
            ) : (
              <div key={r.id} className={`flex h-[21px] items-center gap-2 px-2 ${rule}`}>
                <span className="flex min-w-0 flex-1 items-center gap-2">
                  {COLS.map((c) => (
                    <span key={c.key} style={{ width: c.w }} className="shrink-0">
                      {c.key === "issued" || c.key === "expiry" ? (
                        <DateCell value={r[c.key] || ""} onChange={(v) => update(i, c.key, v)} flagSoon={c.key === "expiry"} />
                      ) : c.key === "scan" ? (
                        <LinksCell links={linksOf(r)} onEdit={() => setLinksFor(i)} />
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

        <div className="flex h-[21px] items-center gap-4 border-t border-black bg-neutral-50 px-2">
          <button onClick={() => add("row")} className="flex items-center gap-1 text-[11px] font-bold uppercase leading-none tracking-wide text-neutral-500 hover:text-neutral-800"><Plus size={12} /> Add row</button>
        </div>
      </div>

      {linksFor != null && items[linksFor] && (() => {
        const links = linksOf(items[linksFor]);
        const lc = "border border-black px-2 py-1";
        const li = "w-full bg-transparent text-[11px] leading-[15px] text-neutral-900 outline-none";
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={() => setLinksFor(null)}>
            <div className="relative w-full max-w-xl border-4 border-black bg-white px-6 py-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <button onClick={() => setLinksFor(null)} title="Close" className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full border border-black text-neutral-900 transition-colors hover:bg-neutral-100">
                <X size={12} strokeWidth={2.5} />
              </button>
              <p className="pb-2 pr-8 text-[13px] font-bold uppercase tracking-[0.12em] text-neutral-900">{items[linksFor].item || "Document"}</p>
              {/* Every cell framed, heading row included; the shaded row adds a link. */}
              <table className="w-full table-fixed border-collapse border-[3px] border-black">
                <colgroup>
                  <col className="w-36" />
                  <col />
                  <col className="w-16" />
                </colgroup>
                <thead>
                  <tr className="bg-neutral-100 text-left text-[10px] font-bold uppercase tracking-wide text-neutral-700">
                    <th className={`${lc} font-bold`}>Name</th>
                    <th className={`${lc} font-bold`}>Link</th>
                    <th className={lc} />
                  </tr>
                </thead>
                <tbody>
                  {links.map((l, k) => (
                    <tr key={l.id || k}>
                      <td className={lc}>
                        <input value={l.name} onChange={(e) => setLinks(linksFor, links.map((x, j) => (j === k ? { ...x, name: e.target.value } : x)))} className={li} />
                      </td>
                      <td className={lc}>
                        <input value={l.url} onChange={(e) => setLinks(linksFor, links.map((x, j) => (j === k ? { ...x, url: e.target.value } : x)))} className={li} />
                      </td>
                      <td className={`${lc} text-center`}>
                        <button onClick={() => setLinks(linksFor, links.filter((_, j) => j !== k))} title="Remove this link" className="inline-flex text-neutral-900 transition-colors hover:text-[#C1440E]">
                          <Trash2 size={12} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-neutral-50">
                    <td className={lc}>
                      <input value={newLinkName} onChange={(e) => setNewLinkName(e.target.value)} className={li} />
                    </td>
                    <td className={lc}>
                      <input
                        value={newLinkUrl}
                        onChange={(e) => setNewLinkUrl(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") addLink(); if (e.key === "Escape") setLinksFor(null); }}
                        className={li}
                      />
                    </td>
                    <td className={`${lc} text-center`}>
                      <button onClick={addLink} title="Add this link" className="inline-flex items-center gap-0.5 text-[10px] font-bold uppercase" style={{ color: "#C1440E" }}>
                        <Plus size={12} /> Add
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

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
