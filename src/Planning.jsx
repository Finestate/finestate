import { useState, useEffect, useRef } from "react";
import { Plus, Trash2, GripVertical } from "lucide-react";

// Blank editable table – exact dimensions/fonts of the Silxops MD-area table.
// Rows are header / subheader / text. Colours step brightest → lowest (title → header → sub-header).
const BAR_BG = "#FFE4B3";     // title bar – brightest
const HEADER_BG = "#FCEFCF";  // header row – mid
const SUBHEAD_BG = "#FDF7E8"; // sub-header row – lowest
const ROWS_KEY = "finestate.planning.rows";
const TITLE_KEY = "finestate.planning.title";
const COSTS_KEY = "finestate.planning.costs";
const COSTS_TITLE_KEY = "finestate.planning.costs.title";

// Seeded once; after that the user's edits in localStorage win.
const COSTS_SEED = [
  { item: "Anthropic (Claude API)", price: "0.00" },
  { item: "Domain name", price: "0.00" },
  { item: "GitHub", price: "0.00" },
  { item: "Stock data API", price: "0.00" },
  { item: "Vercel", price: "0.00" },
];

// Insert options: the bottom of the table can start a new section, a section's own
// add bar only offers the two row kinds that live inside it.
const ALL_TYPES = [["Header", "header"], ["Sub-title", "subheader"], ["Row", "text"]];
const SECTION_TYPES = [["Sub-title", "subheader"], ["Row", "text"]];

let _idc = 0;
const newId = () => "p" + Date.now().toString(36) + "-" + (_idc++);

function AutoTextarea({ value, onChange, ...props }) {
  const ref = useRef(null);
  useEffect(() => { const el = ref.current; if (el) { el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; } }, [value]);
  return <textarea ref={ref} value={value} onChange={onChange} rows={1} {...props} />;
}

// Small two-column costs table – same dimensions/fonts as the planning table above.
function CostsTable() {
  const [title, setTitle] = useState(() => { try { return localStorage.getItem(COSTS_TITLE_KEY) || "Site running costs"; } catch { return "Site running costs"; } });
  const [rows, setRows] = useState(() => {
    try {
      const p = JSON.parse(localStorage.getItem(COSTS_KEY) || "null");
      // Blank prices normalise to 0.00 so the column always reads as a USD amount.
      if (Array.isArray(p)) return p.map((r) => ({ ...r, price: r.price?.trim() ? r.price : "0.00" }));
    } catch {}
    return COSTS_SEED.map((c) => ({ id: newId(), ...c }));
  });

  const [dragI, setDragI] = useState(null);
  const [armed, setArmed] = useState(null);

  const persist = (next) => { setRows(next); try { localStorage.setItem(COSTS_KEY, JSON.stringify(next)); } catch {} };
  const saveTitle = (val) => { setTitle(val); try { localStorage.setItem(COSTS_TITLE_KEY, val); } catch {} };
  const update = (i, key, val) => persist(rows.map((r, idx) => (idx === i ? { ...r, [key]: val } : r)));
  const remove = (i) => persist(rows.filter((_, idx) => idx !== i));
  const reorder = (from, to) => { if (from == null || to == null || from === to) return; const next = rows.slice(); const [moved] = next.splice(from, 1); next.splice(to, 0, moved); persist(next); };
  const add = () => persist([...rows, { id: newId(), item: "", price: "0.00" }]);

  return (
    <div className="w-full">
      <div className="flex items-center gap-2 px-2.5 py-1 border-t-2 border-b-2 border-neutral-400" style={{ backgroundColor: HEADER_BG }}>
        <input value={title} onChange={(e) => saveTitle(e.target.value)} className="flex-1 bg-transparent py-0.5 text-[12px] font-black uppercase leading-tight tracking-[0.06em] text-neutral-900 outline-none" />
        <span className="w-24 shrink-0 whitespace-nowrap text-right text-[12px] font-black uppercase leading-tight tracking-[0.06em] text-neutral-900">Cost</span>
        <span className="w-[54px] shrink-0" />
      </div>

      <div>
        {rows.map((r, i) => (
          <div
            key={r.id}
            draggable={armed === i}
            onDragStart={() => setDragI(i)}
            onDragEnd={() => { setDragI(null); setArmed(null); }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => { reorder(dragI, i); setDragI(null); setArmed(null); }}
            className={`flex items-center gap-2 px-2.5 py-0.5 ${i === 0 ? "" : "border-t border-neutral-300"} ${dragI === i ? "opacity-40" : ""}`}
          >
            <input value={r.item} onChange={(e) => update(i, "item", e.target.value)} placeholder="Cost item" className="flex-1 bg-transparent py-0.5 text-[12px] leading-snug text-neutral-900 outline-none placeholder:text-neutral-300" />
            <div className="flex w-24 shrink-0 items-center justify-end gap-1">
              <span className="text-[12px] leading-snug text-neutral-900">USD</span>
              <input value={r.price} onChange={(e) => update(i, "price", e.target.value)} placeholder="0.00" className="w-14 bg-transparent py-0.5 text-right text-[12px] leading-snug tabular-nums text-neutral-900 outline-none placeholder:text-neutral-300" />
            </div>
            <div className="flex w-[54px] shrink-0 items-center justify-end gap-1">
              <span
                onMouseDown={() => setArmed(i)}
                onMouseUp={() => setArmed(null)}
                title="Drag to reorder"
                className="cursor-grab text-neutral-300 hover:text-neutral-600 active:cursor-grabbing"
              >
                <GripVertical size={12} />
              </span>
              <button onClick={() => remove(i)} title="Delete" className="text-neutral-300 hover:text-[#C1440E]"><Trash2 size={12} /></button>
            </div>
          </div>
        ))}
        {rows.length === 0 && <p className="px-2.5 py-3 text-[12px] text-neutral-400 italic">Empty. Use Add below to start.</p>}
      </div>

      <button onClick={add} className="flex w-full items-center gap-1 border-t border-neutral-200 bg-neutral-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-neutral-500 hover:text-neutral-800 transition-colors"><Plus size={12} /> Add cost</button>
    </div>
  );
}

export default function Planning() {
  const [title, setTitle] = useState(() => { try { return localStorage.getItem(TITLE_KEY) || "Planning"; } catch { return "Planning"; } });
  const [rows, setRows] = useState(() => { try { const p = JSON.parse(localStorage.getItem(ROWS_KEY) || "null"); return Array.isArray(p) ? p : []; } catch { return []; } });
  const [addMenu, setAddMenu] = useState(null); // row index whose insert menu is open, or "end"
  const [dragI, setDragI] = useState(null);     // row being dragged
  const [armed, setArmed] = useState(null);     // row whose grip is held, so only the grip starts a drag


  const persistRows = (next) => { setRows(next); try { localStorage.setItem(ROWS_KEY, JSON.stringify(next)); } catch {} };
  const saveTitle = (val) => { setTitle(val); try { localStorage.setItem(TITLE_KEY, val); } catch {} };
  const update = (i, text) => persistRows(rows.map((r, idx) => (idx === i ? { ...r, text } : r)));
  const remove = (i) => persistRows(rows.filter((_, idx) => idx !== i));
  const reorder = (from, to) => { if (from == null || to == null || from === to) return; const next = rows.slice(); const [moved] = next.splice(from, 1); next.splice(to, 0, moved); persistRows(next); };
  const insertAt = (i, type) => { persistRows([...rows.slice(0, i), { id: newId(), type, text: "" }, ...rows.slice(i)]); setAddMenu(null); };

  // The costs sub-table sits just above the Priorities header; with no such header it goes last.
  const costsAt = rows.findIndex((r) => r.type !== "text" && /priorit/i.test(r.text));

  const TypeMenu = ({ at, opts = ALL_TYPES }) => (
    <div className="flex flex-wrap items-center gap-2 border-t border-neutral-200 bg-neutral-50 px-2.5 py-1">
      <span className="text-[10px] font-bold uppercase tracking-wide text-neutral-400">Insert:</span>
      {opts.map(([lbl, type]) => (
        <button key={type} onClick={() => insertAt(at, type)} className="min-w-[84px] rounded border border-neutral-300 bg-white px-2 py-0.5 text-center text-[10px] font-semibold text-neutral-600 hover:bg-neutral-100 transition-colors">{lbl}</button>
      ))}
      <button onClick={() => setAddMenu(null)} className="ml-1 text-[10px] font-semibold uppercase tracking-wide text-[#9c7c33] hover:opacity-70 transition-opacity">Cancel</button>
    </div>
  );

  return (
    <div className="w-full">
      <div className="w-full border-2 border-neutral-400 shadow-sm overflow-hidden bg-white">
        {/* Header bar – editable title (brightest) */}
        <div className="px-2.5 py-1 border-b-2 border-neutral-400" style={{ backgroundColor: BAR_BG }}>
          <input value={title} onChange={(e) => saveTitle(e.target.value)} className="block w-full bg-transparent py-0.5 text-[12px] font-black uppercase leading-tight tracking-[0.06em] text-neutral-900 outline-none" />
        </div>

        <div>
          {rows.map((r, i) => {
            const bg = r.type === "header" ? HEADER_BG : r.type === "subheader" ? SUBHEAD_BG : "#fff";
            const field = r.type === "text" ? (
              <AutoTextarea value={r.text} onChange={(e) => update(i, e.target.value)} className="flex-1 resize-none overflow-hidden bg-transparent py-0.5 text-[12px] leading-snug text-neutral-900 outline-none" />
            ) : (
              <input value={r.text} onChange={(e) => update(i, e.target.value)} className="flex-1 bg-transparent py-0.5 text-[12px] font-black uppercase leading-tight tracking-[0.06em] text-neutral-900 outline-none" />
            );
            // Strong 2px separator (same as under the title bar) below a header, and above a header
            // that follows other rows – so each subtitle's items are clearly grouped.
            const prevHeader = i > 0 && rows[i - 1].type === "header";
            const topBorder = i === 0 ? "" : r.type === "header" ? "border-t-2 border-neutral-400" : prevHeader ? "" : "border-t border-neutral-300";
            const botBorder = r.type === "header" ? "border-b-2 border-neutral-400" : "";
            // A section ends where the next header starts; the final section uses the bottom Add.
            const sectionEnd = i < rows.length - 1 && rows[i + 1].type === "header";
            return (
              <div key={r.id}>
                {i === costsAt && <CostsTable />}
                <div
                  draggable={armed === i}
                  onDragStart={() => setDragI(i)}
                  onDragEnd={() => { setDragI(null); setArmed(null); }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => { reorder(dragI, i); setDragI(null); setArmed(null); }}
                  className={`flex items-start gap-2 ${topBorder} ${botBorder} px-2.5 py-0.5 ${dragI === i ? "opacity-40" : ""}`}
                  style={{ backgroundColor: bg }}
                >
                  {field}
                  <div className="flex shrink-0 items-center gap-1 py-0.5">
                    <span
                      onMouseDown={() => setArmed(i)}
                      onMouseUp={() => setArmed(null)}
                      title="Drag to reorder"
                      className="cursor-grab text-neutral-300 hover:text-neutral-600 active:cursor-grabbing"
                    >
                      <GripVertical size={12} />
                    </span>
                    <button onClick={() => remove(i)} title="Delete" className="text-neutral-300 hover:text-[#C1440E]"><Trash2 size={12} /></button>
                  </div>
                </div>
                {addMenu === i ? (
                  <TypeMenu at={i + 1} opts={SECTION_TYPES} />
                ) : (
                  sectionEnd && (
                    <button onClick={() => setAddMenu(i)} className="flex w-full items-center gap-1 border-t border-neutral-200 bg-neutral-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-neutral-400 hover:text-neutral-800 transition-colors"><Plus size={12} /> Add</button>
                  )
                )}
              </div>
            );
          })}
          {rows.length === 0 && <p className="px-2.5 py-3 text-[12px] text-neutral-400 italic">Empty. Use Add below to start.</p>}
        </div>

        {/* Bottom add */}
        {addMenu === "end" ? (
          <TypeMenu at={rows.length} />
        ) : (
          <button onClick={() => setAddMenu("end")} className="flex w-full items-center gap-1 border-t border-neutral-200 bg-neutral-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-neutral-500 hover:text-neutral-800 transition-colors"><Plus size={12} /> Add</button>
        )}

        {costsAt === -1 && <CostsTable />}
      </div>
    </div>
  );
}
