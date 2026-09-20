import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "./lib/supabaseClient.js";

// Personal ID numbers live in Supabase, never in this repo.
const DOC_ID = "legal-documents";
const BAR_BG = "#FFE4B3";
const HEADER_BG = "#FCEFCF";

const COLS = [
  { key: "item", label: "Document or ID", w: "40%" },
  { key: "number", label: "Number", w: "20%" },
  { key: "issued", label: "Issued / renewed", w: "15%" },
  { key: "expiry", label: "Expiry", w: "15%" },
  { key: "scan", label: "Scan", w: "10%" },
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
        <div className="border-b-2 border-neutral-400 px-2.5 py-1" style={{ backgroundColor: BAR_BG }}>
          <span className={`block py-0.5 ${head}`}>Legal documents</span>
        </div>

        {!loaded ? (
          <p className="px-2.5 py-3 text-[12px] italic text-neutral-400">Loading…</p>
        ) : (
          order.map((i) => {
            const r = items[i];
            return r.kind === "section" ? (
              // Each section carries its own column headings underneath it.
              <div key={r.id}>
                <div className="flex items-center gap-2 border-y-2 border-neutral-400 px-2.5 py-0.5" style={{ backgroundColor: BAR_BG }}>
                  <input value={r.label || ""} onChange={(e) => update(i, "label", e.target.value)} className={`flex-1 bg-transparent py-0.5 ${head} outline-none`} />
                  <Bin i={i} remove={remove} />
                </div>
                <div className="flex items-center gap-2 border-b-2 border-neutral-400 px-2.5 py-1" style={{ backgroundColor: HEADER_BG }}>
                  {COLS.map((c) => (
                    <span key={c.key} style={{ width: c.w }} className={`shrink-0 ${head}`}>{c.label}</span>
                  ))}
                  <span className="w-[54px] shrink-0" />
                </div>
              </div>
            ) : (
              <div key={r.id} className="flex items-center gap-2 border-t border-neutral-300 px-2.5 py-0.5">
                {COLS.map((c) => (
                  <span key={c.key} style={{ width: c.w }} className="shrink-0">
                    <input value={r[c.key] || ""} onChange={(e) => update(i, c.key, e.target.value)} className={cell} />
                  </span>
                ))}
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
              <button onClick={confirmRemove} className="transition-opacity hover:opacity-70" style={{ color: "#C1440E" }}>Yes</button>
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
    <div className="flex w-[54px] shrink-0 items-center justify-end">
      <button onClick={() => remove(i)} title="Delete" className="text-neutral-900 hover:text-[#C1440E]"><Trash2 size={12} /></button>
    </div>
  );
}
