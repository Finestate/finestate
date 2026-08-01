import { useState, useEffect } from "react";
import { Pencil, Check, ChevronUp, ChevronDown, Trash2, Plus } from "lucide-react";

const STORAGE_KEY = "finestate.priorities";

function autoGrow(el) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = el.scrollHeight + "px";
}
function uid() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : String(Date.now() + Math.random());
}
const newRow = () => ({ id: uid(), type: "row", company: "", focus: "" });
const newHeader = () => ({ id: uid(), type: "header", label: "NEW HEADER" });

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (Array.isArray(p) && p.length)
        return p.map((r) => (r.type ? r : { ...r, type: "row" }));
    }
  } catch {
    /* ignore */
  }
  return [newRow()];
}

const IDLE_BTN =
  "inline-flex items-center gap-1 rounded-md border border-neutral-300 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800 transition-colors cursor-pointer";
const ACTIVE_BTN =
  "inline-flex items-center gap-1 rounded-md border border-[#9c7c33]/40 bg-[#9c7c33]/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#9c7c33] transition-colors cursor-pointer";
const ADD_BTN =
  "inline-flex items-center gap-1 rounded-md border border-neutral-300 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-neutral-600 hover:bg-neutral-100 hover:text-neutral-800 transition-colors cursor-pointer";
const HDR =
  "px-3 py-2.5 text-left text-[12px] font-bold uppercase tracking-wide text-[#7a5f26]";
const CELL =
  "w-full bg-transparent px-3 py-2 text-[13px] leading-relaxed text-neutral-700 outline-none placeholder:text-neutral-300 focus:bg-[#c2a15a]/[0.06]";

export default function Businesses() {
  const [rows, setRows] = useState(load);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
    } catch {
      /* ignore */
    }
  }, [rows]);

  const update = (id, field, val) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, [field]: val } : r)));
  const move = (i, dir) =>
    setRows((rs) => {
      const j = i + dir;
      if (j < 0 || j >= rs.length) return rs;
      const c = [...rs];
      [c[i], c[j]] = [c[j], c[i]];
      return c;
    });
  const del = (i) => setRows((rs) => rs.filter((_, k) => k !== i));

  const Controls = ({ i }) => (
    <div className="flex items-center justify-center gap-0.5">
      <button
        onClick={() => move(i, -1)}
        disabled={i === 0}
        title="Move up"
        className="cursor-pointer text-neutral-400 hover:text-neutral-800 disabled:cursor-default disabled:opacity-25"
      >
        <ChevronUp size={14} />
      </button>
      <button
        onClick={() => move(i, 1)}
        disabled={i === rows.length - 1}
        title="Move down"
        className="cursor-pointer text-neutral-400 hover:text-neutral-800 disabled:cursor-default disabled:opacity-25"
      >
        <ChevronDown size={14} />
      </button>
      <button
        onClick={() => del(i)}
        title="Delete"
        className="cursor-pointer text-neutral-400 hover:text-rose-500"
      >
        <Trash2 size={13} />
      </button>
    </div>
  );

  return (
    <div>
      {/* Title + edit controls */}
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-base font-semibold uppercase tracking-wide text-neutral-800">
          Priorities
        </h2>
        <div className="ml-auto flex items-center gap-1.5">
          {editing && (
            <>
              <button onClick={() => setRows((rs) => [...rs, newHeader()])} className={ADD_BTN}>
                <Plus size={12} /> Header
              </button>
              <button onClick={() => setRows((rs) => [...rs, newRow()])} className={ADD_BTN}>
                <Plus size={12} /> Line
              </button>
            </>
          )}
          <button
            onClick={() => setEditing((e) => !e)}
            className={editing ? ACTIVE_BTN : IDLE_BTN}
            title={editing ? "Done editing" : "Edit"}
          >
            {editing ? (
              <>
                <Check size={12} /> Done
              </>
            ) : (
              <>
                <Pencil size={12} /> Edit
              </>
            )}
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-black/10 bg-white shadow-sm">
        <table className="w-full table-fixed border-collapse text-sm">
          <colgroup>
            <col style={{ width: "16%" }} />
            <col />
            {editing && <col style={{ width: "84px" }} />}
          </colgroup>
          <thead>
            <tr className="border-b-2 border-[#c2a15a]/40 bg-[#c2a15a]/10">
              <th className={HDR}>Company</th>
              <th className={HDR}>Focus</th>
              {editing && <th className="px-2 py-2.5" aria-label="Actions" />}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) =>
              r.type === "header" ? (
                <tr key={r.id} className="border-b border-black/[0.06] bg-[#FBF3E4]">
                  <td colSpan={editing ? 3 : 2} className="px-3 py-1.5">
                    <div className="flex items-center gap-2">
                      {editing ? (
                        <input
                          value={r.label}
                          onChange={(e) => update(r.id, "label", e.target.value)}
                          className="flex-1 bg-transparent text-[11px] font-extrabold uppercase tracking-widest text-neutral-700 outline-none"
                        />
                      ) : (
                        <span className="flex-1 text-[11px] font-extrabold uppercase tracking-widest text-neutral-700">
                          {r.label}
                        </span>
                      )}
                      {editing && (
                        <div className="w-[80px] shrink-0">
                          <Controls i={i} />
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                <tr
                  key={r.id}
                  className={
                    "border-b border-black/[0.06] last:border-b-0 " +
                    (i % 2 ? "bg-[#faf7ef]" : "bg-white")
                  }
                >
                  <td className="border-r border-black/[0.06] p-0 align-top">
                    <input
                      value={r.company}
                      onChange={(e) => update(r.id, "company", e.target.value)}
                      placeholder="Company…"
                      className={CELL + " font-medium text-neutral-800"}
                    />
                  </td>
                  <td className="p-0 align-top">
                    <textarea
                      value={r.focus}
                      onChange={(e) => update(r.id, "focus", e.target.value)}
                      ref={(el) => autoGrow(el)}
                      onInput={(e) => autoGrow(e.target)}
                      rows={1}
                      placeholder="What I want…"
                      className={CELL + " resize-none"}
                    />
                  </td>
                  {editing && (
                    <td className="px-1 align-middle">
                      <Controls i={i} />
                    </td>
                  )}
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
