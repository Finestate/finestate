import { useEffect, useState } from "react";
import { Plus, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import { supabase } from "./lib/supabaseClient.js";

// Personal ID numbers live in Supabase, never in this repo.
const DOC_ID = "legal-documents";
const BAR_BG = "#FFE4B3";
const HEADER_BG = "#FCEFCF";

const COLS = [
  { key: "item", label: "Document or ID", cls: "flex-1" },
  { key: "number", label: "Number", cls: "w-44 shrink-0" },
  { key: "issued", label: "Issued / renewed", cls: "w-32 shrink-0" },
  { key: "expiry", label: "Expiry", cls: "w-32 shrink-0" },
  { key: "scan", label: "Scan", cls: "w-12 shrink-0" },
];

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

  const update = (i, key, val) => save(items.map((r, idx) => (idx === i ? { ...r, [key]: val } : r)));
  const remove = (i) => save(items.filter((_, idx) => idx !== i));
  const move = (i, d) => {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    const next = items.slice();
    [next[i], next[j]] = [next[j], next[i]];
    save(next);
  };
  const add = (kind) =>
    save([...items, kind === "section" ? { id: newId(), kind: "section", label: "" } : { id: newId(), kind: "row", item: "", number: "", issued: "", expiry: "", scan: "" }]);

  return (
    <div className="w-full">
      <div spellCheck={false} className="w-full overflow-hidden border-2 border-neutral-400 bg-white shadow-sm">
        <div className="border-b-2 border-neutral-400 px-2.5 py-1" style={{ backgroundColor: BAR_BG }}>
          <span className={`block py-0.5 ${head}`}>Legal documents</span>
        </div>

        <div className="flex items-center gap-2 border-b-2 border-neutral-400 px-2.5 py-1" style={{ backgroundColor: HEADER_BG }}>
          {COLS.map((c) => (
            <span key={c.key} className={`${c.cls} ${head}`}>{c.label}</span>
          ))}
          <span className="w-[54px] shrink-0" />
        </div>

        {!loaded ? (
          <p className="px-2.5 py-3 text-[12px] italic text-neutral-400">Loading…</p>
        ) : (
          items.map((r, i) =>
            r.kind === "section" ? (
              <div key={r.id} className="flex items-center gap-2 border-y-2 border-neutral-400 px-2.5 py-0.5" style={{ backgroundColor: HEADER_BG }}>
                <input value={r.label || ""} onChange={(e) => update(i, "label", e.target.value)} className={`flex-1 bg-transparent py-0.5 ${head} outline-none`} />
                <Controls i={i} last={items.length - 1} move={move} remove={remove} />
              </div>
            ) : (
              <div key={r.id} className={`flex items-center gap-2 px-2.5 py-0.5 ${i === 0 ? "" : "border-t border-neutral-300"}`}>
                {COLS.map((c) => (
                  <span key={c.key} className={c.cls}>
                    <input value={r[c.key] || ""} onChange={(e) => update(i, c.key, e.target.value)} className={cell} />
                  </span>
                ))}
                <Controls i={i} last={items.length - 1} move={move} remove={remove} />
              </div>
            )
          )
        )}

        <div className="flex items-center gap-4 border-t border-neutral-200 bg-neutral-50 px-2.5 py-1">
          <button onClick={() => add("row")} className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-neutral-500 hover:text-neutral-800"><Plus size={12} /> Add row</button>
          <button onClick={() => add("section")} className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-neutral-500 hover:text-neutral-800"><Plus size={12} /> Add section</button>
        </div>
      </div>

      {err && <p className="pt-2 text-[11px] font-semibold text-[#C1440E]">{err}</p>}
    </div>
  );
}

function Controls({ i, last, move, remove }) {
  return (
    <div className="flex w-[54px] shrink-0 items-center justify-end gap-1">
      <button onClick={() => move(i, -1)} disabled={i === 0} title="Move up" className="text-neutral-900 hover:text-[#9c7c33] disabled:opacity-25"><ChevronUp size={12} /></button>
      <button onClick={() => move(i, 1)} disabled={i === last} title="Move down" className="text-neutral-900 hover:text-[#9c7c33] disabled:opacity-25"><ChevronDown size={12} /></button>
      <button onClick={() => remove(i)} title="Delete" className="text-neutral-900 hover:text-[#C1440E]"><Trash2 size={12} /></button>
    </div>
  );
}
