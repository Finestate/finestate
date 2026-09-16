import { useState, useEffect, useRef } from "react";
import { Plus, Trash2, ChevronUp, ChevronDown } from "lucide-react";

// Blank editable table – same setup as the Silx/Says MD-area table, finestate gold tints.
// Rows are header / subheader / text. Reorder with the up/down arrows. Saved to this browser.
const GOLD = "#9c7c33";
const GOLD_TINT = "#c2a15a";
const HEAD_TINT = "#faf7ef";
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
    <div className="flex flex-wrap items-center gap-2 border-t border-black/10 bg-neutral-50 px-2.5 py-1">
      <span className="text-[10px] font-bold uppercase tracking-wide text-neutral-400">Insert:</span>
      {[["Header", "header"], ["Sub-header", "subheader"], ["Row", "text"]].map(([lbl, type]) => (
        <button key={type} onClick={() => insertAt(at, type)} className="min-w-[84px] rounded border border-black/15 bg-white px-2 py-0.5 text-center text-[10px] font-semibold text-neutral-600 hover:bg-neutral-100 transition-colors">{lbl}</button>
      ))}
      <button onClick={() => setAddMenu(null)} className="ml-1 text-[10px] font-semibold uppercase tracking-wide text-[#9c7c33] hover:opacity-70 transition-opacity">Cancel</button>
    </div>
  );

  return (
    <div className="w-full">
      <div className="w-full overflow-hidden rounded-xl border border-black/10 bg-white shadow-sm">
        {/* Header bar – editable title */}
        <div className="border-b-2 px-2.5 py-1.5" style={{ backgroundColor: `${GOLD_TINT}1a`, borderColor: `${GOLD_TINT}66` }}>
          <input value={title} onChange={(e) => saveTitle(e.target.value)} className="block w-full bg-transparent py-0.5 text-[12px] font-black uppercase leading-tight tracking-[0.06em] text-neutral-900 outline-none" />
        </div>

        <div>
          {rows.map((r, i) => {
            const bg = r.type === "header" ? HEAD_TINT : r.type === "subheader" ? "#fdfbf6" : "#fff";
            const field = r.type === "text" ? (
              <AutoTextarea value={r.text} onChange={(e) => update(i, e.target.value)} className="flex-1 resize-none overflow-hidden bg-transparent py-0.5 text-[11px] leading-snug text-neutral-700 outline-none" />
            ) : (
              <input value={r.text} onChange={(e) => update(i, e.target.value)} className={"flex-1 bg-transparent py-0.5 uppercase leading-tight tracking-[0.06em] text-neutral-900 outline-none " + (r.type === "header" ? "text-[12px] font-black" : "text-[10px] font-bold text-neutral-500")} />
            );
            return (
              <div key={r.id}>
                <div className="flex items-start gap-2 border-t border-black/[0.08] first:border-t-0 px-2.5 py-0.5" style={{ backgroundColor: bg }}>
                  {field}
                  <div className="flex shrink-0 items-center gap-0.5 py-0.5">
                    <button onClick={() => move(i, -1)} disabled={i === 0} title="Move up" className="text-neutral-300 hover:text-neutral-600 disabled:opacity-25"><ChevronUp size={13} /></button>
                    <button onClick={() => move(i, 1)} disabled={i === rows.length - 1} title="Move down" className="text-neutral-300 hover:text-neutral-600 disabled:opacity-25"><ChevronDown size={13} /></button>
                    <button onClick={() => setAddMenu(addMenu === i ? null : i)} title="Insert below" className="text-[#9c7c33] hover:opacity-70"><Plus size={12} /></button>
                    <button onClick={() => remove(i)} title="Delete" className="text-neutral-300 hover:text-[#b91c1c]"><Trash2 size={12} /></button>
                  </div>
                </div>
                {addMenu === i && <TypeMenu at={i + 1} />}
              </div>
            );
          })}
          {rows.length === 0 && <p className="px-2.5 py-3 text-[12px] text-neutral-400 italic">Empty. Use Add below to start.</p>}
        </div>

        {addMenu === "end" ? (
          <TypeMenu at={rows.length} />
        ) : (
          <button onClick={() => setAddMenu("end")} className="flex w-full items-center gap-1 border-t border-black/10 bg-neutral-50 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wide text-neutral-500 hover:text-neutral-800 transition-colors"><Plus size={12} /> Add</button>
        )}
      </div>
    </div>
  );
}
