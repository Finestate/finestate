import { useEffect, useState } from "react";
import { ChevronDown, Plus, Trash2 } from "lucide-react";
import { supabase } from "./lib/supabaseClient.js";

// Investing > Funnel: from the whole US market down to a single stock, one level at a
// time. Level 1 is the eleven market sectors (GICS); each opens onto its industries.
// Further levels are added as we build them. Kept in Supabase.
const DOC_ID = "funnel";
const BAR_BG = "#F2C46D";
const GAP_BG = "#8A8A8A";
const PINK = "#FBEFEC";
const head = "text-[11px] font-bold uppercase leading-[15px] tracking-[0.06em] text-neutral-900";

let _idc = 0;
const newId = () => "f" + Date.now().toString(36) + "-" + (_idc++);

// The eleven sectors of the US market, A to Z.
const SECTORS = [
  "Communication Services",
  "Consumer Discretionary",
  "Consumer Staples",
  "Energy",
  "Financials",
  "Health Care",
  "Industrials",
  "Information Technology",
  "Materials",
  "Real Estate",
  "Utilities",
];
const START = { sectors: SECTORS.map((name, i) => ({ id: `s${i}`, name, industries: [] })) };

export default function Funnel() {
  const [doc, setDoc] = useState(null);
  const [confirm, setConfirm] = useState(null); // { name, run }

  useEffect(() => {
    supabase
      .from("admin_docs")
      .select("data")
      .eq("id", DOC_ID)
      .maybeSingle()
      .then(({ data }) => setDoc(Array.isArray(data?.data?.sectors) ? data.data : START));
  }, []);

  const save = (next) => {
    setDoc(next);
    supabase.from("admin_docs").upsert({ id: DOC_ID, data: next, updated_at: new Date().toISOString() }).then(() => {});
  };
  const editSector = (sid, fn) => save({ ...doc, sectors: doc.sectors.map((s) => (s.id === sid ? fn(s) : s)) });

  if (!doc) return <div className="w-full" />;

  return (
    <div className="w-full overflow-x-auto">
      <div className="w-full min-w-[640px] overflow-hidden border border-black bg-white shadow-sm">
        <div className="h-[10px]" style={{ backgroundColor: GAP_BG }} />
        <div className="flex h-[22px] items-center border-t border-black px-2" style={{ backgroundColor: BAR_BG }}>
          <span className={head}>Sectors</span>
        </div>
        {doc.sectors.map((s) => (
          <div key={s.id}>
            {/* The whole line opens it (and stays as you left it); the name is for typing. */}
            <div onClick={() => editSector(s.id, (x) => ({ ...x, open: !x.open }))} className="flex h-[22px] cursor-pointer select-none items-center gap-2 border-t border-black px-2">
              <input
                value={s.name}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => editSector(s.id, (x) => ({ ...x, name: e.target.value }))}
                style={{ fieldSizing: "content" }}
                className="min-w-[4ch] bg-transparent text-[11px] leading-[15px] text-neutral-900 outline-none"
              />
              {s.industries.length > 0 && <span className="text-[11px] text-neutral-500">({s.industries.length})</span>}
              <ChevronDown size={12} className={`ml-auto shrink-0 text-neutral-900 transition-transform ${s.open ? "rotate-180" : ""}`} />
            </div>
            {s.open && (
              <div className="border-t border-black px-2 py-1.5" style={{ backgroundColor: PINK }}>
                {s.industries.length > 0 && (
                  <div className="border border-neutral-400">
                    {s.industries.map((ind, k) => (
                      <div key={ind.id} className={`flex h-[20px] items-center gap-1.5 px-1.5 ${k ? "border-t border-neutral-400" : ""}`}>
                        <input
                          value={ind.name}
                          placeholder="Industry"
                          onChange={(e) => editSector(s.id, (x) => ({ ...x, industries: x.industries.map((y) => (y.id === ind.id ? { ...y, name: e.target.value } : y)) }))}
                          className="min-w-0 flex-1 bg-transparent text-[11px] leading-[15px] text-neutral-900 outline-none placeholder:text-neutral-400"
                        />
                        <button
                          onClick={() => setConfirm({ name: ind.name, run: () => editSector(s.id, (x) => ({ ...x, industries: x.industries.filter((y) => y.id !== ind.id) })) })}
                          title="Delete"
                          className="shrink-0 text-neutral-900 hover:text-[#C1440E]"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <button
                  onClick={() => editSector(s.id, (x) => ({ ...x, industries: [...x.industries, { id: newId(), name: "" }] }))}
                  className={`flex items-center gap-[2px] text-[11px] font-bold text-[#0f766e] hover:text-[#0c5e57] ${s.industries.length ? "mt-1" : ""}`}
                >
                  <Plus size={11} strokeWidth={3} />Add industry
                </button>
              </div>
            )}
          </div>
        ))}
        <div className="h-[10px] border-t border-black" style={{ backgroundColor: GAP_BG }} />
      </div>

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
