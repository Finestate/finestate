import { useState, useEffect, useRef } from "react";
import { Plus, Trash2, GripVertical, ChevronDown, ChevronUp } from "lucide-react";

// Blank editable table – exact dimensions/fonts of the Silxops MD-area table.
// Rows are header / subheader / text. Colours step brightest → lowest (title → header → sub-header).
const BAR_BG = "#FFE4B3";     // title bar – brightest
const HEADER_BG = "#FCEFCF";  // header row – mid
const SUBHEAD_BG = HEADER_BG;  // sub-title rows read exactly like a section header
const GOLD = "#9c7c33";
const ROWS_KEY = "finestate.planning.rows";
const TITLE_KEY = "finestate.planning.title";
const TODO_ITEMS_KEY = "finestate.planning.todoItems";
const TODO_LINES_KEY = "finestate.planning.todoLines";
const TODO_OPEN_KEY = "finestate.planning.todoOpen";

// The two checklist lines that sit under the Daily routine heading: today, and the
// next day being planned while today is still in front of you.
const LINE_LABELS = ["Today", "Next day"];

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

export default function Planning() {
  const [title, setTitle] = useState(() => { try { return localStorage.getItem(TITLE_KEY) || "Planning"; } catch { return "Planning"; } });
  const [rows, setRows] = useState(() => { try { const p = JSON.parse(localStorage.getItem(ROWS_KEY) || "null"); return Array.isArray(p) ? p : []; } catch { return []; } });
  const [addMenu, setAddMenu] = useState(null); // row index whose insert menu is open, or "end"
  const [todoItems, setTodoItems] = useState(() => { try { const p = JSON.parse(localStorage.getItem(TODO_ITEMS_KEY) || "null"); return Array.isArray(p) ? p : []; } catch { return []; } });
  const [todoLines, setTodoLines] = useState(() => { try { const p = JSON.parse(localStorage.getItem(TODO_LINES_KEY) || "null"); return Array.isArray(p) && p.length === 2 ? p : [[], []]; } catch { return [[], []]; } });
  const [todoOpen, setTodoOpen] = useState(() => { try { const v = localStorage.getItem(TODO_OPEN_KEY); return v == null || v === "" ? null : Number(v); } catch { return null; } });
  const [newCode, setNewCode] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [dragI, setDragI] = useState(null);     // row being dragged
  const [armed, setArmed] = useState(null);     // row whose grip is held, so only the grip starts a drag


  const persistRows = (next) => { setRows(next); try { localStorage.setItem(ROWS_KEY, JSON.stringify(next)); } catch {} };
  const saveTitle = (val) => { setTitle(val); try { localStorage.setItem(TITLE_KEY, val); } catch {} };
  const update = (i, text) => persistRows(rows.map((r, idx) => (idx === i ? { ...r, text } : r)));
  const remove = (i) => persistRows(rows.filter((_, idx) => idx !== i));
  const reorder = (from, to) => { if (from == null || to == null || from === to) return; const next = rows.slice(); const [moved] = next.splice(from, 1); next.splice(to, 0, moved); persistRows(next); };
  const insertAt = (i, type) => { persistRows([...rows.slice(0, i), { id: newId(), type, text: "" }, ...rows.slice(i)]); setAddMenu(null); };


  const saveItems = (next) => { setTodoItems(next); try { localStorage.setItem(TODO_ITEMS_KEY, JSON.stringify(next)); } catch {} };
  const saveLines = (next) => { setTodoLines(next); try { localStorage.setItem(TODO_LINES_KEY, JSON.stringify(next)); } catch {} };
  const openLine = (idx) => { setTodoOpen(idx); try { idx == null ? localStorage.removeItem(TODO_OPEN_KEY) : localStorage.setItem(TODO_OPEN_KEY, String(idx)); } catch {} };
  const toggleTodo = (idx, code) =>
    saveLines(todoLines.map((line, i) => (i !== idx ? line : line.includes(code) ? line.filter((c) => c !== code) : [...line, code])));
  // The up arrow on the second line rolls the next day's plan into today.
  const swapLines = () => { saveLines([todoLines[1], todoLines[0]]); openLine(todoOpen === 0 ? 1 : todoOpen === 1 ? 0 : todoOpen); };
  const addItem = () => {
    const code = newCode.trim().toUpperCase();
    if (!code || todoItems.some((it) => it.code === code)) return;
    saveItems([...todoItems, { code, label: newLabel.trim() }]);
    setNewCode("");
    setNewLabel("");
  };

  // A Daily routine / To-dos heading is what the two checklist lines hang under.
  const isTodoHeader = (r) =>
    r.type !== "text" && /dailyroutine|todo|todos/.test((r.text || "").toLowerCase().replace(/[^a-z]/g, ""));

  const TodoLines = () => (
    <>
      {todoLines.map((codes, idx) => {
        const open = todoOpen === idx;
        const chosen = todoItems.filter((it) => codes.includes(it.code)).map((it) => it.code);
        return (
          <div key={idx} className="border-t border-neutral-300 bg-white">
            <div className="flex items-center">
              <button
                onClick={() => openLine(open ? null : idx)}
                title="Choose to-dos"
                className="flex flex-1 items-center gap-1.5 px-2.5 py-0.5 text-left hover:bg-neutral-50"
              >
                <span className="w-16 shrink-0 text-[10px] font-bold uppercase tracking-wide text-neutral-400">{LINE_LABELS[idx]}</span>
                {chosen.length > 0 && <span className="py-0.5 text-[12px] leading-snug text-neutral-900">{chosen.join("-")}</span>}
                <ChevronDown size={14} className={`shrink-0 text-neutral-500 transition-transform ${open ? "rotate-180" : ""}`} />
              </button>
              {idx === 1 && (
                <button onClick={swapLines} title="Make this today" className="shrink-0 pr-2 text-neutral-400 hover:text-[#9c7c33]">
                  <ChevronUp size={14} />
                </button>
              )}
            </div>

            {open && (
              <div className="border-t border-neutral-200 bg-white px-2.5 py-2">
                {todoItems.length === 0 ? (
                  <p className="text-[11px] italic text-neutral-400">No to-do points yet – add them below.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 sm:grid-cols-3 lg:grid-cols-4">
                    {todoItems.map((it) => (
                      <label key={it.code} className="group flex min-w-0 cursor-pointer items-start gap-1.5 text-[11px] font-semibold text-neutral-700 hover:text-neutral-900">
                        <input
                          type="checkbox"
                          checked={codes.includes(it.code)}
                          onChange={() => toggleTodo(idx, it.code)}
                          className="mt-0.5 h-3.5 w-3.5 shrink-0"
                          style={{ accentColor: GOLD }}
                        />
                        <span className="min-w-0 break-words leading-snug">
                          {it.code}{it.label ? ` (${it.label})` : ""}
                        </span>
                        <button
                          onClick={(e) => { e.preventDefault(); saveItems(todoItems.filter((x) => x.code !== it.code)); }}
                          title="Remove this point"
                          className="ml-auto hidden shrink-0 text-neutral-300 hover:text-[#C1440E] group-hover:block"
                        >
                          <Trash2 size={11} />
                        </button>
                      </label>
                    ))}
                  </div>
                )}

                <div className="mt-2 flex items-center gap-2 border-t border-neutral-200 pt-2">
                  <input value={newCode} onChange={(e) => setNewCode(e.target.value)} placeholder="Code" className="w-16 rounded border border-neutral-300 px-1.5 py-0.5 text-[11px] uppercase outline-none focus:border-neutral-500 placeholder:text-neutral-300" />
                  <input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="What it means" className="flex-1 rounded border border-neutral-300 px-1.5 py-0.5 text-[11px] outline-none focus:border-neutral-500 placeholder:text-neutral-300" />
                  <button onClick={addItem} className="rounded border border-neutral-300 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-600 hover:bg-neutral-100">Add point</button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </>
  );

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
            const isHead = r.type !== "text";
            const prevHeader = i > 0 && rows[i - 1].type !== "text";
            const topBorder = i === 0 ? "" : isHead ? "border-t-2 border-neutral-400" : prevHeader ? "" : "border-t border-neutral-300";
            const botBorder = isHead ? "border-b-2 border-neutral-400" : "";
            // A section ends where the next header starts; the final section uses the bottom Add.
            const sectionEnd = i < rows.length - 1 && rows[i + 1].type !== "text";
            return (
              <div key={r.id}>
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
                {isTodoHeader(r) && <TodoLines />}
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

      </div>
    </div>
  );
}
