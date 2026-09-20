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
const TODO_LINES_KEY = "finestate.planning.todoLines";
const TODO_OPEN_KEY = "finestate.planning.todoOpen";
const MEETINGS_KEY = "finestate.planning.meetings";

// Two identical checklist lines under the Daily routine heading: today, and the
// next day being planned while today is still in front of you.
// These fixed points are maintained here in code – ask for changes when they shift.
const TODO_ITEMS = [
  { code: "A-HEIEDR" },
  { code: "B-SIDR" },
  { code: "C-SYDR" },
  { code: "D-SFDR" },
];

const emptyLine = () => ({ codes: [], meetings: [] });
// Older saves held a bare array of codes.
const normaliseLine = (l) =>
  Array.isArray(l) ? { codes: l, meetings: [] } : { codes: l?.codes || [], meetings: l?.meetings || [] };

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
  const [todoLines, setTodoLines] = useState(() => {
    try {
      const p = JSON.parse(localStorage.getItem(TODO_LINES_KEY) || "null");
      if (Array.isArray(p) && p.length === 2) return p.map(normaliseLine);
    } catch {}
    return [emptyLine(), emptyLine()];
  });
  // Meetings are typed in by hand. Permanent ones stay in the picker after being
  // used; one-offs move onto the line and leave the picker.
  const [meetings, setMeetings] = useState(() => { try { const p = JSON.parse(localStorage.getItem(MEETINGS_KEY) || "null"); return Array.isArray(p) ? p : []; } catch { return []; } });
  const [newMeeting, setNewMeeting] = useState("");
  const [newPermanent, setNewPermanent] = useState(false);
  const [adding, setAdding] = useState(false);
  const [todoOpen, setTodoOpen] = useState(() => { try { const v = localStorage.getItem(TODO_OPEN_KEY); return v == null || v === "" ? null : Number(v); } catch { return null; } });
  const [dragI, setDragI] = useState(null);     // row being dragged
  const [armed, setArmed] = useState(null);     // row whose grip is held, so only the grip starts a drag


  const persistRows = (next) => { setRows(next); try { localStorage.setItem(ROWS_KEY, JSON.stringify(next)); } catch {} };
  const saveTitle = (val) => { setTitle(val); try { localStorage.setItem(TITLE_KEY, val); } catch {} };
  const update = (i, text) => persistRows(rows.map((r, idx) => (idx === i ? { ...r, text } : r)));
  const remove = (i) => persistRows(rows.filter((_, idx) => idx !== i));
  const reorder = (from, to) => { if (from == null || to == null || from === to) return; const next = rows.slice(); const [moved] = next.splice(from, 1); next.splice(to, 0, moved); persistRows(next); };
  const insertAt = (i, type) => { persistRows([...rows.slice(0, i), { id: newId(), type, text: "" }, ...rows.slice(i)]); setAddMenu(null); };


  const saveLines = (next) => { setTodoLines(next); try { localStorage.setItem(TODO_LINES_KEY, JSON.stringify(next)); } catch {} };
  const openLine = (idx) => { setTodoOpen(idx); try { idx == null ? localStorage.removeItem(TODO_OPEN_KEY) : localStorage.setItem(TODO_OPEN_KEY, String(idx)); } catch {} };
  const saveMeetings = (next) => { setMeetings(next); try { localStorage.setItem(MEETINGS_KEY, JSON.stringify(next)); } catch {} };
  const patchLine = (idx, fields) => saveLines(todoLines.map((l, i) => (i === idx ? { ...l, ...fields } : l)));

  const toggleTodo = (idx, code) => {
    const line = todoLines[idx];
    const has = line.codes.includes(code);
    patchLine(idx, { codes: has ? line.codes.filter((c) => c !== code) : [...line.codes, code] });
  };

  // Picking a meeting moves it onto the line. A one-off also leaves the picker.
  const pickMeeting = (idx, m) => {
    const line = todoLines[idx];
    if (line.meetings.some((x) => x.id === m.id)) {
      patchLine(idx, { meetings: line.meetings.filter((x) => x.id !== m.id) });
      return;
    }
    patchLine(idx, { meetings: [...line.meetings, m] });
    if (!m.permanent) saveMeetings(meetings.filter((x) => x.id !== m.id));
  };
  const dropMeeting = (idx, id) => patchLine(idx, { meetings: todoLines[idx].meetings.filter((x) => x.id !== id) });
  const addMeeting = () => {
    const name = newMeeting.trim();
    if (!name) return;
    saveMeetings([...meetings, { id: newId(), name, permanent: newPermanent }]);
    setNewMeeting("");
    setNewPermanent(false);
  };

  // The up arrow on the second line rolls the next day's plan into today.
  const swapLines = () => { saveLines([todoLines[1], todoLines[0]]); openLine(todoOpen === 0 ? 1 : todoOpen === 1 ? 0 : todoOpen); };

  // The heading a given row sits under, so the Daily routine section can hide its Add bar.
  const headingFor = (i) => { for (let j = i; j >= 0; j--) if (rows[j].type !== "text") return rows[j]; return null; };

  // A Daily routine / To-dos heading is what the two checklist lines hang under.
  const isTodoHeader = (r) =>
    r.type !== "text" && /dailyroutine|todo|todos/.test((r.text || "").toLowerCase().replace(/[^a-z]/g, ""));

  const TodoLines = () => (
    <>
      {todoLines.map((line, idx) => {
        const open = todoOpen === idx;
        const codes = TODO_ITEMS.filter((it) => line.codes.includes(it.code)).map((it) => it.code);
        return (
          <div key={idx} className="border-t border-neutral-300 bg-white">
            <div className="flex items-center">
              <button
                onClick={() => openLine(open ? null : idx)}
                title="Choose to-dos"
                className="flex shrink-0 items-center px-2.5 py-0.5 hover:bg-neutral-50"
              >
                <ChevronDown size={14} className={`text-neutral-500 transition-transform ${open ? "rotate-180" : ""}`} />
              </button>

              <div className="flex flex-1 flex-wrap items-center gap-1.5 py-0.5 pr-2">
                {line.meetings.map((m) => (
                  <span key={m.id} className="group inline-flex items-center gap-1 text-[12px] leading-snug text-neutral-900">
                    {m.name}
                    <button onClick={() => dropMeeting(idx, m.id)} title="Remove" className="text-neutral-300 hover:text-[#C1440E]">
                      <Trash2 size={10} />
                    </button>
                  </span>
                ))}
                {codes.length > 0 && (
                  <span className="text-[12px] leading-snug text-neutral-900">{codes.join(" · ")}</span>
                )}
              </div>

              {idx === 1 && (
                <button onClick={swapLines} title="Make this today" className="shrink-0 pr-2 text-neutral-400 hover:text-[#9c7c33]">
                  <ChevronUp size={14} />
                </button>
              )}
            </div>

            {open && (
              <div className="border-t border-neutral-200 bg-white px-2.5 py-2">
                <div className="text-[9px] font-bold uppercase tracking-wide text-neutral-400">Meetings:</div>
                <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                  {meetings.map((m) => (
                    <label
                      key={m.id}
                      className="group flex cursor-pointer items-center gap-1.5 rounded border border-neutral-300 bg-white px-1.5 py-0.5 text-[11px] font-semibold text-neutral-700 hover:border-neutral-400 hover:text-neutral-900"
                    >
                      <input
                        type="checkbox"
                        checked={line.meetings.some((x) => x.id === m.id)}
                        onChange={() => pickMeeting(idx, m)}
                        className="h-3.5 w-3.5 shrink-0"
                        style={{ accentColor: GOLD }}
                      />
                      <span className="whitespace-nowrap leading-snug">{m.name}</span>
                      {m.permanent && <span className="shrink-0 text-[9px] uppercase text-neutral-300">fixed</span>}
                      <button
                        onClick={(e) => { e.preventDefault(); saveMeetings(meetings.filter((x) => x.id !== m.id)); }}
                        title="Remove this meeting"
                        className="hidden shrink-0 text-neutral-300 hover:text-[#C1440E] group-hover:block"
                      >
                        <Trash2 size={11} />
                      </button>
                    </label>
                  ))}

                  {adding ? (
                    <span className="flex items-center gap-1.5 rounded border border-neutral-400 bg-white px-1.5 py-0.5">
                      <input
                        autoFocus
                        value={newMeeting}
                        onChange={(e) => setNewMeeting(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") { addMeeting(); setAdding(false); }
                          if (e.key === "Escape") { setNewMeeting(""); setAdding(false); }
                        }}
                        placeholder="Meeting"
                        className="w-28 bg-transparent text-[11px] outline-none placeholder:text-neutral-300"
                      />
                      <label className="flex cursor-pointer items-center gap-1 text-[9px] font-bold uppercase tracking-wide text-neutral-400">
                        <input type="checkbox" checked={newPermanent} onChange={(e) => setNewPermanent(e.target.checked)} className="h-3 w-3" style={{ accentColor: GOLD }} />
                        Keep
                      </label>
                      <button onClick={() => { addMeeting(); setAdding(false); }} title="Save" className="text-[#9c7c33] hover:opacity-70">
                        <Plus size={12} />
                      </button>
                    </span>
                  ) : (
                    <button
                      onClick={() => setAdding(true)}
                      title="Add a meeting"
                      className="flex items-center rounded border border-neutral-300 bg-white px-1.5 py-1 text-[#9c7c33] hover:border-neutral-400 hover:opacity-70"
                    >
                      <Plus size={12} />
                    </button>
                  )}
                </div>

                <div className="mt-3 text-[9px] font-bold uppercase tracking-wide text-neutral-400">Daily:</div>
                <div className="mt-0.5 grid grid-cols-2 gap-x-3 gap-y-1.5 sm:grid-cols-3 lg:grid-cols-4">
                  {TODO_ITEMS.map((it) => (
                    <label key={it.code} className="flex min-w-0 cursor-pointer items-start gap-1.5 text-[11px] font-semibold text-neutral-700 hover:text-neutral-900">
                      <input
                        type="checkbox"
                        checked={line.codes.includes(it.code)}
                        onChange={() => toggleTodo(idx, it.code)}
                        className="mt-0.5 h-3.5 w-3.5 shrink-0"
                        style={{ accentColor: GOLD }}
                      />
                      <span className="min-w-0 break-words leading-snug">
                        {it.code}{it.label ? ` (${it.label})` : ""}
                      </span>
                    </label>
                  ))}
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
            const sectionEnd =
              i < rows.length - 1 && rows[i + 1].type !== "text" && !isTodoHeader(headingFor(i) || {});
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
