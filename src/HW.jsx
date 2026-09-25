import { useEffect, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "./lib/supabaseClient.js";

// Health and wellbeing, lifted from the HE tab of the planning workbook. It holds
// medical history, membership numbers and private links, so it lives in Supabase
// and never in this public repo.
const DOC_ID = "hw";
const BAR_BG = "#F2C46D";   // section bars
const HEADER_BG = "#FFE4B3"; // column headings inside a section
const GOLD = "#9c7c33";

let _idc = 0;
const newId = () => "h" + Date.now().toString(36) + "-" + (_idc++);

const head = "text-[11px] font-bold uppercase leading-[15px] tracking-[0.06em] text-neutral-900";
const cellText = "text-[11px] leading-[15px] text-neutral-900";

// Any address in a cell becomes a link reading "Link", so rows stay one line tall.
const LINK_RE = /(https?:\/\/\S+)/;

// Uncontrolled so the caret never jumps, and it wraps rather than cutting words off.
function Cell({ text, onChange, className }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (el && document.activeElement !== el && el.textContent !== (text || "")) el.textContent = text || "";
  }, [text]);
  return (
    <span
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      onInput={(e) => onChange(e.currentTarget.textContent)}
      className={className}
    />
  );
}

export default function HW() {
  const [rows, setRows] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState("");
  const [confirm, setConfirm] = useState(null);

  useEffect(() => {
    supabase
      .from("admin_docs")
      .select("data")
      .eq("id", DOC_ID)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) setErr(error.message);
        const list = Array.isArray(data?.data) ? data.data : [];
        setRows(list.map((r) => (r.id ? r : { ...r, id: newId() })));
        setLoaded(true);
      });
  }, []);

  const save = (next) => {
    setRows(next);
    supabase
      .from("admin_docs")
      .upsert({ id: DOC_ID, data: next, updated_at: new Date().toISOString() })
      .then(({ error }) => setErr(error ? error.message : ""));
  };

  const update = (i, key, val) => save(rows.map((r, idx) => (idx === i ? { ...r, [key]: val } : r)));
  const addAfter = (i, kind) =>
    save([...rows.slice(0, i + 1), { id: newId(), kind, a: "", b: "" }, ...rows.slice(i + 1)]);
  const remove = () => {
    save(rows.filter((_, idx) => idx !== confirm));
    setConfirm(null);
  };

  return (
    <div className="w-full overflow-x-auto">
      <div spellCheck={false} className="w-full min-w-[760px] border border-black bg-white shadow-sm">
        <div className="flex h-[18px] items-center px-2" style={{ backgroundColor: BAR_BG }}>
          <span className={head}>HW</span>
        </div>

        {!loaded ? (
          <p className="px-2 py-2 text-[11px] italic text-neutral-400">Loading…</p>
        ) : (
          rows.map((r, i) => {
            const rule = "border-t border-black";
            if (r.kind === "section")
              return (
                <div key={r.id} className={`group flex h-[18px] items-center gap-2 px-2 ${rule}`} style={{ backgroundColor: BAR_BG }}>
                  <Cell text={r.a} onChange={(t) => update(i, "a", t)} className={`min-w-0 flex-1 ${head} outline-none`} />
                  <RowTools i={i} onAdd={addAfter} onRemove={setConfirm} />
                </div>
              );
            if (r.kind === "subhead")
              return (
                <div key={r.id} className={`group flex h-[18px] items-center gap-2 px-2 ${rule}`} style={{ backgroundColor: HEADER_BG }}>
                  <Cell text={r.a} onChange={(t) => update(i, "a", t)} className={`w-[30%] shrink-0 ${head} outline-none`} />
                  <Cell text={r.b} onChange={(t) => update(i, "b", t)} className={`min-w-0 flex-1 ${head} outline-none`} />
                  <RowTools i={i} onAdd={addAfter} onRemove={setConfirm} />
                </div>
              );
            const link = LINK_RE.exec(r.b || "") || LINK_RE.exec(r.a || "");
            return (
              <div key={r.id} className={`group flex items-start gap-2 px-2 py-[3px] ${rule}`}>
                <Cell text={r.a} onChange={(t) => update(i, "a", t)} className={`w-[30%] shrink-0 whitespace-pre-wrap break-words font-semibold ${cellText} outline-none`} />
                <Cell text={r.b} onChange={(t) => update(i, "b", t)} className={`min-w-0 flex-1 whitespace-pre-wrap break-words ${cellText} outline-none`} />
                {link && (
                  <a
                    href={link[1]}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 text-[11px] leading-[15px] underline underline-offset-2"
                    style={{ color: GOLD }}
                  >
                    Open
                  </a>
                )}
                <RowTools i={i} onAdd={addAfter} onRemove={setConfirm} />
              </div>
            );
          })
        )}

        <button
          onClick={() => addAfter(rows.length - 1, "row")}
          style={{ color: "#C1440E" }}
          className="flex h-[21px] w-full items-center gap-1 border-t border-black bg-neutral-50 px-2 text-[11px] font-bold uppercase leading-none tracking-wide transition-opacity hover:opacity-70"
        >
          <Plus size={12} /> Add
        </button>
      </div>

      {err && <p className="pt-2 text-[11px] font-semibold text-[#C1440E]">{err}</p>}

      {confirm != null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={() => setConfirm(null)}>
          <div className="w-full max-w-sm border-[3px] bg-white p-6 text-center shadow-2xl" style={{ borderColor: "#C1440E" }} onClick={(e) => e.stopPropagation()}>
            <p className="text-[14px] font-bold uppercase tracking-[0.06em] text-neutral-900">Delete this?</p>
            <div className="mt-5 flex justify-center gap-3 text-[12px] font-bold uppercase tracking-wide">
              <button onClick={remove} className="border-2 px-5 py-1.5 text-white transition-opacity hover:opacity-80" style={{ backgroundColor: "#C1440E", borderColor: "#C1440E" }}>
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

// Add a row or a section under this line, or bin it. Shown on hover only, so the
// table stays clean to read.
function RowTools({ i, onAdd, onRemove }) {
  return (
    <span className="flex h-[15px] shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
      <button onClick={() => onAdd(i, "row")} title="Add a line below" className="text-neutral-900 hover:text-[#9c7c33]"><Plus size={11} /></button>
      <button onClick={() => onAdd(i, "section")} title="Add a section below" className="text-[10px] font-bold text-neutral-900 hover:text-[#9c7c33]">S</button>
      <button onClick={() => onRemove(i)} title="Delete" className="text-neutral-900 hover:text-[#C1440E]"><Trash2 size={11} /></button>
    </span>
  );
}
