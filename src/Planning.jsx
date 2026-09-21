import { useState, useEffect, useRef } from "react";
import { Plus, Trash2, ChevronUp, ChevronDown, List, ChevronsRight, ChevronsLeft } from "lucide-react";

// Blank editable table – exact dimensions/fonts of the Silxops MD-area table.
// Rows are header / subheader / text. Colours step brightest → lowest (title → header → sub-header).
const BAR_BG = "#FFE4B3";     // title bar – brightest
const HEADER_BG = "#FCEFCF";  // header row – mid
const SUBHEAD_BG = HEADER_BG; // sub-titles sit one shade below a main header
const GOLD = "#9c7c33";
const ROWS_KEY = "finestate.planning.rows";
const TITLE_KEY = "finestate.planning.title";
const TODO_LINES_KEY = "finestate.planning.todoLines";
const TODO_OPEN_KEY = "finestate.planning.todoOpen";
const MEETINGS_KEY = "finestate.planning.meetings";
const TODO_ANCHOR_KEY = "finestate.planning.todoAnchor";
const POINTS_KEY = "finestate.planning.points";

// Two identical checklist lines under the Daily routine heading: today, and the
// next day being planned while today is still in front of you.
// These fixed points are maintained here in code – ask for changes when they shift.
const TODO_CORE = [
  { code: "A-HEIEDR" },
  { code: "B-SIDR" },
  { code: "C-SYDR" },
  { code: "D-SFDR" },
];

const TODO_REST = [
  { code: "G (textaudiorecordaitalkwritegrammarongo)" },
  { code: "W (perhetab)" },
  { code: "M (twicedaily)" },
  { code: "SC (CCEDB)" },
  { code: "Safetyaudit" },
  { code: "Ycfoodmd" },
  { code: "Hydrateheavily" },
  { code: "Mailcheck" },
  { code: "Gardening" },
  { code: "Houseimprovementsseebelow" },
  { code: "Garbagerun" },
  { code: "Personalitemsandofficecleanadminfilesbasketbinders" },
  { code: "Financesexcelsppocketmoneycoins" },
  { code: "Photosoffalldevicestodropbox" },
  { code: "Groom" },
  { code: "Deepgroom" },
  { code: "Haircut" },
  { code: "Socialyfastlft" },
  { code: "Martinvisit" },
  { code: "Defensemuaythaigrappling" },
  { code: "Cmeditatetalkshometherresearchther" },
  { code: "Passportsexpirychecks" },
  { code: "Dxbrentpay" },
  { code: "Csupplementscheck" },
  { code: "Medssupplementstakeandprep" },
  { code: "Setupfornextday" },
  { code: "Errandsprios ()" },
  { code: "Sleepeight" },
];

const TODO_ITEMS = [...TODO_CORE, ...TODO_REST];

// House style: one space before an opening bracket, e.g. "SC (CCEDB)".
const spaceBrackets = (s) => String(s || "").replace(/([^\s(])\(/g, "$1 (");

const emptyLine = () => ({ codes: [], meetings: [], fills: {} });
// Older saves held a bare array of codes.
const normaliseLine = (l) =>
  Array.isArray(l) ? { codes: l, meetings: [], fills: {} } : { codes: l?.codes || [], meetings: l?.meetings || [], fills: l?.fills || {} };

// Insert options: the bottom of the table can start a new section, a section's own
// add bar only offers the two row kinds that live inside it.
const ALL_TYPES = [["Header", "header"], ["Sub-title", "subheader"], ["Row", "text"]];
const SECTION_TYPES = [["Sub-title", "subheader"], ["Row", "text"]];

let _idc = 0;
const newId = () => "p" + Date.now().toString(36) + "-" + (_idc++);

// Each visual line needs its own block element, otherwise the browser cannot
// bullet or indent one line at a time.
const toBlocks = (html) => {
  const h = String(html || "");
  if (!/<br\s*\/?>/i.test(h)) return h;
  return h.split(/<br\s*\/?>/i).map((part) => `<div>${part.trim() ? part : "<br>"}</div>`).join("");
};

const escapeHtml = (s) =>
  String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// A row of rich text. Uncontrolled on purpose: React never rewrites the markup while
// you type, so the caret stays put and part-line bold survives.
function RichLine({ html, onInput, onFocus, onEnter, innerRef, className }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (el && el.innerHTML !== (html || "")) el.innerHTML = html || "";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div
      ref={(el) => { ref.current = el; if (innerRef) innerRef(el); }}
      contentEditable
      suppressContentEditableWarning
      onInput={(e) => onInput(e.currentTarget.innerHTML)}
      onFocus={onFocus}
      className={className}
    />
  );
}

function AutoTextarea({ value, onChange, ...props }) {
  const ref = useRef(null);
  useEffect(() => { const el = ref.current; if (el) { el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; } }, [value]);
  return <textarea ref={ref} value={value} onChange={onChange} rows={1} {...props} />;
}

export default function Planning() {
  const [title, setTitle] = useState(() => { try { return localStorage.getItem(TITLE_KEY) || "Planning"; } catch { return "Planning"; } });
  const [rows, setRows] = useState(() => {
    try {
      const p = JSON.parse(localStorage.getItem(ROWS_KEY) || "null");
      if (!Array.isArray(p)) return [];
      // Text rows written before rich editing carry their words in `text`, and every
      // visual line becomes its own block so it can be bulleted or indented alone.
      return p.map((r) =>
        r.type !== "text"
          ? r
          : { ...r, html: toBlocks(r.html == null ? escapeHtml(r.text).replace(/\n/g, "<br>") : r.html) }
      );
    } catch { return []; }
  });
  const [addMenu, setAddMenu] = useState(null); // row index whose insert menu is open, or "end"
  const [todoLines, setTodoLines] = useState(() => {
    try {
      const p = JSON.parse(localStorage.getItem(TODO_LINES_KEY) || "null");
      if (Array.isArray(p) && p.length === 2) return p.map(normaliseLine).map((l) => ({ ...l, codes: l.codes.map(spaceBrackets) }));
    } catch {}
    return [emptyLine(), emptyLine()];
  });
  // Meetings are typed in by hand. Permanent ones stay in the picker after being
  // used; one-offs move onto the line and leave the picker.
  const [meetings, setMeetings] = useState(() => { try { const p = JSON.parse(localStorage.getItem(MEETINGS_KEY) || "null"); return Array.isArray(p) ? p : []; } catch { return []; } });
  const [newMeeting, setNewMeeting] = useState("");
  const [newPermanent, setNewPermanent] = useState(false);
  const [adding, setAdding] = useState(false);
  // What is being dragged: a box from the picker, or a name already on a line.
  const [drag, setDrag] = useState(null);
  const [editing, setEditing] = useState(null); // meeting being typed in, so dragging steps aside
  const [todoAnchor, setTodoAnchor] = useState(() => { try { return localStorage.getItem(TODO_ANCHOR_KEY) || null; } catch { return null; } });
  // The two fixed groups of points, seeded once and then yours to edit.
  const [points, setPoints] = useState(() => {
    try {
      const p = JSON.parse(localStorage.getItem(POINTS_KEY) || "null");
      if (p && Array.isArray(p.core) && Array.isArray(p.rest)) {
        const fix = (list) => list.map((x) => ({ ...x, code: spaceBrackets(x.code) }));
        return { core: fix(p.core), rest: fix(p.rest) };
      }
    } catch {}
    return {
      core: TODO_CORE.map((it) => ({ id: newId(), code: it.code })),
      rest: TODO_REST.map((it) => ({ id: newId(), code: it.code })),
    };
  });
  const [dragP, setDragP] = useState(null); // point box being dragged inside its group
  const [activeRow, setActiveRow] = useState(null); // row the ribbon acts on
  const [todoOpen, setTodoOpen] = useState(() => { try { const v = localStorage.getItem(TODO_OPEN_KEY); return v == null || v === "" ? null : Number(v); } catch { return null; } });


  const lineRefs = useRef({}); // row id -> its editable element, for the ribbon
  const persistRows = (next) => { setRows(next); try { localStorage.setItem(ROWS_KEY, JSON.stringify(next)); } catch {} };
  const saveTitle = (val) => { setTitle(val); try { localStorage.setItem(TITLE_KEY, val); } catch {} };
  const update = (i, text) => persistRows(rows.map((r, idx) => (idx === i ? { ...r, text } : r)));
  const remove = (i) => persistRows(rows.filter((_, idx) => idx !== i));
  const moveRow = (i, d) => { const j = i + d; if (j < 0 || j >= rows.length) return; const next = rows.slice(); [next[i], next[j]] = [next[j], next[i]]; persistRows(next); };
  const toggleFlag = (i, key) => persistRows(rows.map((r, idx) => (idx === i ? { ...r, [key]: !r[key] } : r)));
  const updateHtml = (i, html) => persistRows(rows.map((r, idx) => (idx === i ? { ...r, html } : r)));
  // Enter starts a fresh row, so indent and bullets stay per line like in Word.
  const newRowAfter = (i, r) => {
    const row = { id: newId(), type: "text", text: "", html: "", indent: r.indent || 0, bullet: !!r.bullet };
    persistRows([...rows.slice(0, i + 1), row, ...rows.slice(i + 1)]);
    setActiveRow(row.id);
    setTimeout(() => lineRefs.current[row.id]?.focus(), 0);
  };
  // Word style: the ribbon runs the browser's own command on whatever is selected,
  // so bold hits the highlighted words and bullets or indent hit those lines only.
  const applyCmd = (i, cmd) => {
    const r = rows[i];
    const el = r && lineRefs.current[r.id];
    if (!el) return;
    el.focus();
    document.execCommand(cmd);
    updateHtml(i, el.innerHTML);
  };
  const bump = (i, d) => persistRows(rows.map((r, idx) => (idx === i ? { ...r, indent: Math.max(0, Math.min(6, (r.indent || 0) + d)) } : r)));
  const insertAt = (i, type) => { persistRows([...rows.slice(0, i), { id: newId(), type, text: "" }, ...rows.slice(i)]); setAddMenu(null); };


  const saveLines = (next) => { setTodoLines(next); try { localStorage.setItem(TODO_LINES_KEY, JSON.stringify(next)); } catch {} };
  const openLine = (idx) => { setTodoOpen(idx); try { idx == null ? localStorage.removeItem(TODO_OPEN_KEY) : localStorage.setItem(TODO_OPEN_KEY, String(idx)); } catch {} };
  const saveMeetings = (next) => { setMeetings(next); try { localStorage.setItem(MEETINGS_KEY, JSON.stringify(next)); } catch {} };
  const patchLine = (idx, fields) => saveLines(todoLines.map((l, i) => (i === idx ? { ...l, ...fields } : l)));

  const toggleTodo = (idx, code) => {
    const line = todoLines[idx];
    const has = line.codes.includes(code);
    const fills = { ...(line.fills || {}) };
    if (has) delete fills[code];
    patchLine(idx, { codes: has ? line.codes.filter((c) => c !== code) : [...line.codes, code], fills });
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
  const moveInLine = (lineIdx, from, to) => {
    if (from == null || to == null || from === to) return;
    const arr = todoLines[lineIdx].meetings.slice();
    const [moved] = arr.splice(from, 1);
    arr.splice(to, 0, moved);
    patchLine(lineIdx, { meetings: arr });
  };
  // Dropping a picker box anywhere on a line adds it to that line.
  const dropOnLine = (lineIdx) => {
    if (drag?.from === "pool") {
      const m = meetings.find((x) => x.id === drag.id);
      if (m && !todoLines[lineIdx].meetings.some((x) => x.id === m.id)) pickMeeting(lineIdx, m);
    }
    setDrag(null);
  };
  // Dragging a name off a line and into the picker puts it back in the list.
  const returnToPool = (lineIdx) => {
    if (drag?.from === "line") {
      const m = todoLines[drag.lineIdx].meetings.find((x) => x.id === drag.id);
      patchLine(drag.lineIdx, { meetings: todoLines[drag.lineIdx].meetings.filter((x) => x.id !== drag.id) });
      if (m && !meetings.some((x) => x.id === m.id)) saveMeetings([...meetings, m]);
    }
    setDrag(null);
  };
  const moveMeeting = (from, to) => {
    if (from == null || to == null || from === to) return;
    const next = meetings.slice();
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    saveMeetings(next);
  };
  const savePoints = (next) => { setPoints(next); try { localStorage.setItem(POINTS_KEY, JSON.stringify(next)); } catch {} };
  // A renamed point carries its new wording onto any line already holding it.
  const renamePoint = (g, id, raw) => {
    const code = spaceBrackets(raw);
    const old = points[g].find((p) => p.id === id)?.code;
    savePoints({ ...points, [g]: points[g].map((p) => (p.id === id ? { ...p, code } : p)) });
    if (old && old !== code) {
      saveLines(todoLines.map((l) => ({ ...l, codes: l.codes.map((c) => (c === old ? code : c)) })));
    }
  };
  const removePoint = (g, id) => {
    const gone = points[g].find((p) => p.id === id)?.code;
    savePoints({ ...points, [g]: points[g].filter((p) => p.id !== id) });
    if (gone) saveLines(todoLines.map((l) => ({ ...l, codes: l.codes.filter((c) => c !== gone) })));
  };
  const addPoint = (g) => {
    const p = { id: newId(), code: "" };
    savePoints({ ...points, [g]: [...points[g], p] });
    setEditing(p.id);
  };
  const movePoint = (g, from, to) => {
    if (from == null || to == null || from === to) return;
    const arr = points[g].slice();
    const [moved] = arr.splice(from, 1);
    arr.splice(to, 0, moved);
    savePoints({ ...points, [g]: arr });
  };

  // Renaming reaches the picker copy and every line that already carries it.
  const renameMeeting = (id, name) => {
    saveMeetings(meetings.map((m) => (m.id === id ? { ...m, name } : m)));
    saveLines(todoLines.map((l) => ({ ...l, meetings: l.meetings.map((m) => (m.id === id ? { ...m, name } : m)) })));
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

  // The two checklist lines hang under one heading. It is found by name the first
  // time, then remembered by id, so renaming that heading cannot detach them.
  const matchesTodoName = (r) =>
    r.type !== "text" && /dailyroutine|todo|todos/.test((r.text || "").toLowerCase().replace(/[^a-z]/g, ""));

  let anchorIdx = rows.findIndex((r) => r.id === todoAnchor && r.type !== "text");
  if (anchorIdx < 0) anchorIdx = rows.findIndex(matchesTodoName);
  // No such heading: the checklist sits at the top and no heading gets locked.

  useEffect(() => {
    const r = rows[anchorIdx];
    if (r && r.id !== todoAnchor) {
      setTodoAnchor(r.id);
      try { localStorage.setItem(TODO_ANCHOR_KEY, r.id); } catch {}
    }
  }, [anchorIdx, rows, todoAnchor]);

  const isTodoHeader = (r) => anchorIdx >= 0 && r && rows[anchorIdx] && r.id === rows[anchorIdx].id;

  // Codes on a line are split by a small solid gold square rather than a dot.
  // A point ending in empty brackets, like Errandsprios (), takes free text between
  // them on the line itself. Unticking the point clears it again.
  const setFill = (idx, code, text) => {
    const line = todoLines[idx];
    patchLine(idx, { fills: { ...(line.fills || {}), [code]: text } });
  };
  const renderCodeLine = (list, colour, idx) => (
    <div className="flex flex-wrap items-center gap-1.5 text-[12px] leading-snug" style={{ color: colour }}>
      {list.map((c, i) => {
        const fillable = /\(\)$/.test(c);
        const fill = todoLines[idx]?.fills?.[c] || "";
        return (
          <span key={c} className="inline-flex items-center gap-1.5">
            {i > 0 && <span className="inline-block h-[5px] w-[5px] shrink-0" style={{ backgroundColor: colour }} />}
            {fillable ? (
              <span className="inline-flex items-center">
                {c.slice(0, -1)}
                <input
                  value={fill}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => setFill(idx, c, e.target.value)}
                  style={{ width: `${Math.max(2, fill.length + 1)}ch`, color: colour }}
                  className="bg-transparent outline-none"
                />
                )
              </span>
            ) : (
              c
            )}
          </span>
        );
      })}
    </div>
  );

  // Plain function, not a component: a nested component would remount on every
  // keystroke and throw the caret to the end of the field.
  const renderTodoLines = () => (
    // Red frame so the daily block stands apart from the rest of the table.
    <div className={`border-2 border-[#C1440E] ${anchorIdx >= 0 ? "border-t" : ""}`}>
      {todoLines.map((line, idx) => {
        const open = todoOpen === idx;
        // Selected points keep their group on the line: meetings, core codes, then the rest.
        const coreCodes = points.core.filter((it) => line.codes.includes(it.code)).map((it) => it.code);
        const restCodes = points.rest.filter((it) => line.codes.includes(it.code)).map((it) => it.code);
        return (
          // A heavy rule between today and the next day, so the two never blur.
          <div key={idx} className={`bg-white ${idx === 0 ? "" : "border-t-[3px] border-neutral-500"}`}>
            {/* The whole line is the toggle – no chevron. */}
            <div
              onClick={() => openLine(open ? null : idx)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => dropOnLine(idx)}
              title="Choose to-dos"
              className="flex min-h-[22px] cursor-pointer items-start hover:bg-neutral-50"
            >
              <div className="flex flex-1 flex-col gap-0.5 px-2.5 py-0.5">
                {line.meetings.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    {line.meetings.map((m, mi) => (
                      <span
                        key={m.id}
                        draggable={editing !== m.id}
                        onDoubleClick={(e) => { e.stopPropagation(); setEditing(m.id); }}
                        onDragStart={(e) => { e.stopPropagation(); setDrag({ from: "line", lineIdx: idx, index: mi, id: m.id }); }}
                        onDragEnd={() => setDrag(null)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.stopPropagation();
                          if (drag?.from === "line" && drag.lineIdx === idx) moveInLine(idx, drag.index, mi);
                          else dropOnLine(idx);
                          setDrag(null);
                        }}
                        className={`inline-flex cursor-grab items-center gap-[3px] text-[12px] leading-snug text-[#C1440E] active:cursor-grabbing ${drag?.from === "line" && drag.lineIdx === idx && drag.index === mi ? "opacity-40" : ""}`}
                      >
                        {/* Plain text until double clicked, so the bin sits right after the words. */}
                        {editing === m.id ? (
                          <input
                            ref={(el) => { if (el && document.activeElement !== el) el.focus(); }}
                            value={m.name}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => renameMeeting(m.id, e.target.value)}
                            onBlur={() => setEditing(null)}
                            style={{ width: `${Math.max(2, m.name.length)}ch` }}
                            className="bg-transparent leading-snug outline-none"
                          />
                        ) : (
                          <span className="leading-snug">{m.name}</span>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); dropMeeting(idx, m.id); }}
                          title="Remove"
                          className="flex shrink-0 items-center self-center leading-none text-neutral-900 hover:text-[#C1440E]"
                        >
                          <Trash2 size={10} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                {line.meetings.length === 0 && coreCodes.length === 0 && restCodes.length === 0 && (
                  <span className="my-[7px] inline-flex items-center gap-1.5">
                    {[0, 1, 2, 3, 4].map((n) => (
                      <span key={n} className="inline-block h-[5px] w-[5px] bg-neutral-300" />
                    ))}
                  </span>
                )}
                {coreCodes.length > 0 && renderCodeLine(coreCodes, "#171717", idx)}
                {restCodes.length > 0 && renderCodeLine(restCodes, "#171717", idx)}
              </div>

              {idx === 1 && (
                <button
                  onClick={(e) => { e.stopPropagation(); swapLines(); }}
                  title="Make this today"
                  className="shrink-0 px-2 py-0.5 text-neutral-400 hover:text-[#9c7c33]"
                >
                  <ChevronUp size={14} />
                </button>
              )}
            </div>

            {open && (
              <div className="border-t border-[#C1440E] bg-white px-2.5 py-2">
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => returnToPool(idx)}
                  className="grid grid-cols-2 items-stretch gap-1.5 border border-[#C1440E] p-2 sm:grid-cols-3 lg:grid-cols-4"
                >
                  {meetings.map((m, mi) => (
                    <div
                      key={m.id}
                      draggable={editing !== m.id}
                      onDoubleClick={() => setEditing(m.id)}
                      onDragStart={() => setDrag({ from: "pool", index: mi, id: m.id })}
                      onDragEnd={() => setDrag(null)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => { if (drag?.from === "pool") moveMeeting(drag.index, mi); setDrag(null); }}
                      className={`flex h-full w-full cursor-grab items-center gap-1.5 rounded border bg-white px-1.5 py-0.5 text-[11px] font-semibold text-neutral-700 hover:text-neutral-900 active:cursor-grabbing ${m.permanent ? "border-[#C1440E]" : "border-neutral-300 hover:border-neutral-400"} ${drag?.from === "pool" && drag.index === mi ? "opacity-40" : ""}`}
                    >
                      <input
                        ref={(el) => { if (el && editing === m.id && document.activeElement !== el) el.focus(); }}
                        value={m.name}
                        readOnly={editing !== m.id}
                        onChange={(e) => renameMeeting(m.id, e.target.value)}
                        onBlur={() => setEditing(null)}
                        className={`min-w-0 flex-1 bg-transparent leading-snug outline-none ${editing === m.id ? "" : "pointer-events-none"}`}
                      />
                      <button
                        onClick={() => saveMeetings(meetings.filter((x) => x.id !== m.id))}
                        title="Remove this meeting"
                        className="shrink-0 text-neutral-900 hover:text-[#C1440E]"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  ))}

                  {adding ? (
                    <span className="flex h-full w-full items-center gap-1.5 rounded border border-neutral-400 bg-white px-1.5 py-0.5">
                      <input
                        autoFocus
                        value={newMeeting}
                        onChange={(e) => setNewMeeting(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") { addMeeting(); setAdding(false); }
                          if (e.key === "Escape") { setNewMeeting(""); setAdding(false); }
                        }}
                        placeholder="Meeting"
                        className="w-full min-w-0 bg-transparent text-[11px] outline-none placeholder:text-neutral-300"
                      />
                      <input
                        type="checkbox"
                        checked={newPermanent}
                        onChange={(e) => setNewPermanent(e.target.checked)}
                        title="Tick to make this a permanent meeting"
                        className="h-3.5 w-3.5 shrink-0"
                        style={{ accentColor: "#C1440E" }}
                      />
                      <button onClick={() => { addMeeting(); setAdding(false); }} title="Save" className="text-[#9c7c33] hover:opacity-70">
                        <Plus size={12} />
                      </button>
                    </span>
                  ) : (
                    <button
                      onClick={() => setAdding(true)}
                      title="Add a meeting"
                      className="flex h-full w-full items-center justify-center rounded border border-neutral-300 bg-white px-1.5 py-1 text-[#9c7c33] hover:border-neutral-400 hover:opacity-70"
                    >
                      <Plus size={12} />
                    </button>
                  )}
                </div>

                {["core", "rest"].map((g) => (
                  <div key={g} className="mt-2 border border-[#C1440E] p-2">
                    <div className="grid grid-cols-2 items-stretch gap-1.5 sm:grid-cols-3 lg:grid-cols-4">
                      {points[g].map((it, pi) => (
                        <div
                          key={it.id}
                          draggable={editing !== it.id}
                          onDoubleClick={() => setEditing(it.id)}
                          onDragStart={() => setDragP({ group: g, index: pi })}
                          onDragEnd={() => setDragP(null)}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={() => { if (dragP?.group === g) movePoint(g, dragP.index, pi); setDragP(null); }}
                          className={`flex h-full w-full cursor-grab items-center gap-1.5 rounded border border-neutral-300 bg-white px-1.5 py-0.5 text-[11px] font-semibold text-neutral-700 hover:border-neutral-400 hover:text-neutral-900 active:cursor-grabbing ${dragP?.group === g && dragP.index === pi ? "opacity-40" : ""}`}
                        >
                          <input
                            type="checkbox"
                            checked={line.codes.includes(it.code)}
                            onChange={() => toggleTodo(idx, it.code)}
                            className="h-3.5 w-3.5 shrink-0 self-start"
                            style={{ accentColor: GOLD }}
                          />
                          <input
                            ref={(el) => { if (el && editing === it.id && document.activeElement !== el) el.focus(); }}
                            value={it.code}
                            readOnly={editing !== it.id}
                            onChange={(e) => renamePoint(g, it.id, e.target.value)}
                            onBlur={() => setEditing(null)}
                            className={`min-w-0 flex-1 bg-transparent leading-snug outline-none ${editing === it.id ? "" : "pointer-events-none"}`}
                          />
                          <button
                            onClick={() => removePoint(g, it.id)}
                            title="Remove this point"
                            className="shrink-0 self-start text-neutral-900 hover:text-[#C1440E]"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      ))}

                      {/* The A-HEIEDR group rarely changes, so new points there come through Claude. */}
                      {g !== "core" && (
                        <button
                          onClick={() => addPoint(g)}
                          title="Add a point"
                          className="flex h-full w-full items-center justify-center rounded border border-neutral-300 bg-white px-1.5 py-1 text-[#9c7c33] hover:border-neutral-400 hover:opacity-70"
                        >
                          <Plus size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  // The ribbon works on the row that has the caret, as long as it sits in this section.
  const renderRibbon = (headerIdx) => {
    let end = headerIdx + 1;
    while (end < rows.length && rows[end].type === "text") end++;
    const target = rows.findIndex((r, k) => r.id === activeRow && k > headerIdx && k < end);
    const r = target >= 0 ? rows[target] : null;
    // Always the same black as the text, whether a row is selected or not.
    const off = "text-neutral-900";
    const on = "text-neutral-900 hover:text-[#9c7c33]";
    return (
      <div className="flex items-center gap-3 border-b border-neutral-300 bg-neutral-50 px-2.5 py-1">
        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => applyCmd(target, "bold")}
          title="Bold the highlighted words"
          className={`flex h-4 w-4 items-center justify-center ${!r ? off : on}`}
        >
          <span className="text-[14px] font-black leading-none tracking-tight">B</span>
        </button>
        <button onMouseDown={(e) => e.preventDefault()} onClick={() => applyCmd(target, "insertUnorderedList")} title="Bullet the selected lines" className={`flex h-4 w-4 items-center justify-center ${!r ? off : on}`}><List size={15} strokeWidth={2.75} /></button>
        <button onMouseDown={(e) => e.preventDefault()} onClick={() => applyCmd(target, "outdent")} title="Decrease indent" className={`flex h-4 w-4 items-center justify-center ${!r ? off : on}`}><ChevronsLeft size={15} strokeWidth={2.75} /></button>
        <button onMouseDown={(e) => e.preventDefault()} onClick={() => applyCmd(target, "indent")} title="Increase indent" className={`flex h-4 w-4 items-center justify-center ${!r ? off : on}`}><ChevronsRight size={15} strokeWidth={2.75} /></button>
      </div>
    );
  };

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
      <div spellCheck={false} className="w-full border-2 border-neutral-400 shadow-sm overflow-hidden bg-white">
        {/* With no Daily routine heading to hang under, the checklist sits up here. */}
        {anchorIdx < 0 && renderTodoLines()}

        <div>
          {rows.map((r, i) => {
            // Every heading in this table is a main heading, so they share one colour.
            const bg = r.type === "text" ? "#fff" : BAR_BG;
            // The heading the checklist hangs under is locked: no typing, no bin, no dragging.
            const locked = isTodoHeader(r);
            const field = locked ? (
              <span className="flex-1 py-0.5 text-[12px] font-black uppercase leading-tight tracking-[0.06em] text-neutral-900">{r.text}</span>
            ) : r.type === "text" ? (
              // One block, formatted line by line exactly as a Word document would be.
              <div className="flex flex-1 items-start gap-1">
                <RichLine
                  html={r.html ?? escapeHtml(r.text)}
                  innerRef={(el) => { lineRefs.current[r.id] = el; }}
                  onFocus={() => setActiveRow(r.id)}
                  onInput={(html) => updateHtml(i, html)}
                  className="rich-line min-h-[18px] flex-1 whitespace-pre-wrap break-words bg-transparent py-0.5 text-[12px] leading-snug text-neutral-900 outline-none"
                />
              </div>
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
                  className={`group relative flex items-start gap-2 ${locked ? "border-2 border-b-0 border-[#C1440E]" : `${topBorder} ${botBorder}`} px-2.5 py-0.5`}
                  style={{ backgroundColor: bg }}
                >
                  {field}
                  {!locked && (
                    <div className="flex shrink-0 items-center gap-1 py-0.5">
                      <button onClick={() => moveRow(i, -1)} disabled={i === 0} title="Move up" className="text-neutral-900 hover:text-[#9c7c33] disabled:opacity-25"><ChevronUp size={12} /></button>
                      <button onClick={() => moveRow(i, 1)} disabled={i === rows.length - 1} title="Move down" className="text-neutral-900 hover:text-[#9c7c33] disabled:opacity-25"><ChevronDown size={12} /></button>
                      <button onClick={() => remove(i)} title="Delete" className="text-neutral-900 hover:text-[#C1440E]"><Trash2 size={12} /></button>
                    </div>
                  )}
                </div>
                {/* One ribbon per section, always there, acting on the row you last clicked. */}
                {isHead && !locked && renderRibbon(i)}
                {isTodoHeader(r) && renderTodoLines()}
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
