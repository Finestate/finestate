import { useState } from "react";
import { Plus, Trash2, GripVertical } from "lucide-react";

// Same dimensions/fonts as the Compass table: square corners, 2px neutral-400 border,
// 12px black uppercase headings, tight rows.
const BAR_BG = "#FFE4B3";
const HEADER_BG = "#FCEFCF";
const COSTS_KEY = "finestate.planning.costs";
const TITLE_KEY = "finestate.planning.costs.title";

const SEED = [
  { item: "Anthropic (Claude API)", price: "0.00" },
  { item: "Domain name", price: "0.00" },
  { item: "GitHub", price: "0.00" },
  { item: "Stock data API", price: "0.00" },
  { item: "Supabase", price: "0.00" },
  { item: "Vercel", price: "0.00" },
];

let _idc = 0;
const newId = () => "c" + Date.now().toString(36) + "-" + (_idc++);

export default function SiteRunningCosts() {
  const [title, setTitle] = useState(() => { try { return localStorage.getItem(TITLE_KEY) || "Site running costs"; } catch { return "Site running costs"; } });
  const [rows, setRows] = useState(() => {
    try {
      const p = JSON.parse(localStorage.getItem(COSTS_KEY) || "null");
      if (Array.isArray(p)) return p.map((r) => ({ ...r, price: r.price?.trim() ? r.price : "0.00" }));
    } catch {}
    return SEED.map((c) => ({ id: newId(), ...c }));
  });
  const [dragI, setDragI] = useState(null);
  const [armed, setArmed] = useState(null);

  const persist = (next) => { setRows(next); try { localStorage.setItem(COSTS_KEY, JSON.stringify(next)); } catch {} };
  const saveTitle = (val) => { setTitle(val); try { localStorage.setItem(TITLE_KEY, val); } catch {} };
  const update = (i, key, val) => persist(rows.map((r, idx) => (idx === i ? { ...r, [key]: val } : r)));
  const remove = (i) => persist(rows.filter((_, idx) => idx !== i));
  const reorder = (from, to) => { if (from == null || to == null || from === to) return; const next = rows.slice(); const [moved] = next.splice(from, 1); next.splice(to, 0, moved); persist(next); };
  const add = () => persist([...rows, { id: newId(), item: "", price: "0.00" }]);

  const total = rows.reduce((sum, r) => sum + (parseFloat(String(r.price).replace(/[^0-9.-]/g, "")) || 0), 0);

  return (
    <div className="w-full">
      <div className="w-full border-2 border-neutral-400 shadow-sm overflow-hidden bg-white">
        <div className="flex items-center gap-2 px-2.5 py-1 border-b-2 border-neutral-400" style={{ backgroundColor: BAR_BG }}>
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
                {/* Width follows the value so "USD" always sits right next to the number. */}
                <input
                  value={r.price}
                  onChange={(e) => update(i, "price", e.target.value)}
                  placeholder="0.00"
                  style={{ width: `${Math.max(4, String(r.price || "").length)}ch` }}
                  className="bg-transparent py-0.5 text-right text-[12px] leading-snug tabular-nums text-neutral-900 outline-none placeholder:text-neutral-300"
                />
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

        <div className="flex items-center gap-2 border-t-2 border-neutral-400 px-2.5 py-1" style={{ backgroundColor: HEADER_BG }}>
          <span className="flex-1 text-[12px] font-black uppercase leading-tight tracking-[0.06em] text-neutral-900">Total / month</span>
          <div className="flex w-24 shrink-0 items-center justify-end gap-1">
            <span className="text-[12px] font-black leading-snug text-neutral-900">USD</span>
            <span className="text-[12px] font-black leading-snug tabular-nums text-neutral-900">{total.toFixed(2)}</span>
          </div>
          <span className="w-[54px] shrink-0" />
        </div>

        <button onClick={add} className="flex w-full items-center gap-1 border-t border-neutral-200 bg-neutral-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-neutral-500 hover:text-neutral-800 transition-colors"><Plus size={12} /> Add cost</button>
      </div>
    </div>
  );
}
