import { useState, useEffect, useRef } from "react";
import { Plus, Trash2, ChevronUp, ChevronDown } from "lucide-react";

// Blank editable table – exact dimensions/fonts of the Silxops MD-area table.
// Rows are header / subheader / text. Colours step brightest → lowest (title → header → sub-header).
const BAR_BG = "#FFE4B3";     // title bar – brightest
const HEADER_BG = "#FCEFCF";  // header row – mid
const SUBHEAD_BG = "#FDF7E8"; // sub-header row – lowest
const ROWS_KEY = "finestate.planning.rows";
const TITLE_KEY = "finestate.planning.title";

let _idc = 0;
const newId = () => "p" + Date.now().toString(36) + "-" + (_idc++);

function AutoTextarea({ value, onChange, ...props }) {
  const ref = useRef(null);
  useEffect(() => { const el = ref.current; if (el) { el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; } }, [value]);
  return <textarea ref={ref} value={value} onChange={onChange} rows={1} {...props} />;
}

export default function Planning() {
  const [title, setTitle] = useState(() => { try { return localStorage.getItem(TITLE_KEY) || "Planning"; } catch { return "Planning"; } });
  const [rows, setRows] = useState(() => { try { const p = JSON.parse(localStorage.getItem(ROWS_KEY) || "null"); return Array.isArray(p) ? p : []; } catch { return []; } });
  const [addMenu, setAddMenu] = useState(null); // row index whose insert menu is open, or "end"

  const persistRows = (next) => { setRows(next); try { localStorage.setItem(ROWS_KEY, JSON.stringify(next)); } catch {} };
  const saveTitle = (val) => { setTitle(val); try { localStorage.setItem(TITLE_KEY, val); } catch {} };
  const update = (i, text) => persistRows(rows.map((r, idx) => (idx === i ? { ...r, text } : r)));
  const remove = (i) => persistRows(rows.filter((_, idx) => idx !== i));
  const move = (i, d) => { const j = i + d; if (j < 0 || j >= rows.length) return; const next = rows.slice(); [next[i], next[j]] = [next[j], next[i]]; persistRows(next); };
  const insertAt = (i, type) => { persistRows([...rows.slice(0, i), { id: newId(), type, text: "" }, ...rows.slice(i)]); setAddMenu(null); };

  const TypeMenu = ({ at }) => (
    <div className="flex flex-wrap items-center gap-2 border-t border-neutral-200 bg-neutral-50 px-2.5 py-1">
      <span className="text-[10px] font-bold uppercase tracking-wide text-neutral-400">Insert:</span>
      {[["Header", "header"], ["Sub-header", "subheader"], ["Row", "text"]].map(([lbl, type]) => (
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
              <AutoTextarea value={r.text} onChange={(e) => update(i, e.target.value)} className="flex-1 resize-none overflow-hidden bg-transparent py-0.5 text-[11px] leading-snug text-neutral-700 outline-none" />
            ) : (
              <input value={r.text} onChange={(e) => update(i, e.target.value)} className="flex-1 bg-transparent py-0.5 text-[12px] font-black uppercase leading-tight tracking-[0.06em] text-neutral-900 outline-none" />
            );
            // Strong 2px separator (same as under the title bar) below a header, and above a header
            // that follows other rows – so each subtitle's items are clearly grouped.
            const prevHeader = i > 0 && rows[i - 1].type === "header";
            const topBorder = i === 0 ? "" : r.type === "header" ? "border-t-2 border-neutral-400" : prevHeader ? "" : "border-t border-neutral-300";
            const botBorder = r.type === "header" ? "border-b-2 border-neutral-400" : "";
            return (
              <div key={r.id}>
                <div className={`flex items-start gap-2 ${topBorder} ${botBorder} px-2.5 py-0.5`} style={{ backgroundColor: bg }}>
                  {field}
                  <div className="flex shrink-0 items-center gap-1 py-0.5">
                    <button onClick={() => move(i, -1)} disabled={i === 0} title="Move up" className="text-neutral-300 hover:text-neutral-600 disabled:opacity-25"><ChevronUp size={12} /></button>
                    <button onClick={() => move(i, 1)} disabled={i === rows.length - 1} title="Move down" className="text-neutral-300 hover:text-neutral-600 disabled:opacity-25"><ChevronDown size={12} /></button>
                    <button onClick={() => setAddMenu(addMenu === i ? null : i)} title="Insert below" className="text-[#9c7c33] hover:opacity-70"><Plus size={12} /></button>
                    <button onClick={() => remove(i)} title="Delete" className="text-neutral-300 hover:text-[#C1440E]"><Trash2 size={12} /></button>
                  </div>
                </div>
                {addMenu === i && <TypeMenu at={i + 1} />}
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
      </div>
    </div>
  );
}
