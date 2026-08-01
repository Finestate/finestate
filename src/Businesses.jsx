import { useState, useEffect } from "react";
import { Plus, X } from "lucide-react";

const STORAGE_KEY = "finestate.priorities";

function autoGrow(el) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = el.scrollHeight + "px";
}

function newRow() {
  return {
    id:
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : String(Date.now() + Math.random()),
    company: "",
    focus: "",
  };
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) return parsed;
    }
  } catch {
    /* ignore */
  }
  return [newRow()];
}

export default function Businesses() {
  const [rows, setRows] = useState(load);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
    } catch {
      /* ignore */
    }
  }, [rows]);

  const update = (id, field, value) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  const addRow = () => setRows((rs) => [...rs, newRow()]);
  const removeRow = (id) => setRows((rs) => rs.filter((r) => r.id !== id));

  return (
    <div>
      <h2 className="mb-3 pl-[13px] text-base font-semibold uppercase tracking-wide text-neutral-800">
        Priorities
      </h2>

      <div className="overflow-hidden rounded-xl border border-black/10 bg-white shadow-sm">
        <table className="w-full table-fixed border-collapse text-sm">
          <colgroup>
            <col style={{ width: "16%" }} />
            <col />
            <col style={{ width: "44px" }} />
          </colgroup>
          <thead>
            <tr className="border-b-2 border-[#c2a15a]/40 bg-[#c2a15a]/10">
              <th className="px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wide text-[#7a5f26]">
                Company
              </th>
              <th className="px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wide text-[#7a5f26]">
                Focus
              </th>
              <th className="px-2 py-2.5" aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={r.id}
                className={
                  "group border-b border-black/[0.06] last:border-b-0 " +
                  (i % 2 ? "bg-[#faf7ef]" : "bg-white")
                }
              >
                <td className="border-r border-black/[0.06] p-0 align-top">
                  <input
                    value={r.company}
                    onChange={(e) => update(r.id, "company", e.target.value)}
                    placeholder="Company…"
                    className="w-full bg-transparent px-3 py-2 text-[13px] font-medium text-neutral-800 outline-none placeholder:text-neutral-300 focus:bg-[#c2a15a]/[0.06]"
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
                    className="w-full resize-none bg-transparent px-3 py-2 text-[13px] leading-relaxed text-neutral-700 outline-none placeholder:text-neutral-300 focus:bg-[#c2a15a]/[0.06]"
                  />
                </td>
                <td className="text-center align-middle">
                  <button
                    onClick={() => removeRow(r.id)}
                    aria-label="Remove row"
                    className="cursor-pointer text-neutral-300 opacity-0 transition-opacity hover:text-rose-500 group-hover:opacity-100"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button
        onClick={addRow}
        className="mt-3 inline-flex cursor-pointer items-center gap-1.5 text-[13px] font-medium text-[#9c7c33] hover:text-[#7a5f26]"
      >
        <Plus className="h-4 w-4" /> Add company
      </button>
    </div>
  );
}
