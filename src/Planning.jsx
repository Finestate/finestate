import { useState, useEffect, useRef } from "react";
import { Plus, Trash2, ChevronUp, ChevronDown, List, ChevronsRight, ChevronsLeft, X, GripVertical } from "lucide-react";
import { supabase } from "./lib/supabaseClient.js";

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
const COLLAPSED_KEY = "finestate.planning.collapsed";
const TWOCOL_KEY = "personal-order"; // row id in the private admin_docs table

// The two lists that sit under the daily area, side by side, under one folding bar.
const TWOCOLS = [["errands", "Errands prios"], ["hf", "H+F order"]];
const PERSONAL_ID = "personal-order";

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
const ALL_TYPES = [["Header", "header"], ["Row", "text"]];
const SECTION_TYPES = [["Header", "header"], ["Row", "text"]];

let _idc = 0;
const newId = () => "p" + Date.now().toString(36) + "-" + (_idc++);

// Each visual line needs its own block element, otherwise the browser cannot
// bullet or indent one line at a time.
const toBlocks = (html) => {
  const h = String(html || "");
  // Already in blocks (anything typed since rich editing): leave it alone, or the
  // empty-line markers get split apart and blank lines vanish on refresh.
  if (/<(div|p|ul|ol|li|blockquote)\b/i.test(h)) return h;
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

// Text between a point's brackets. It hugs its words exactly – no padding either
// side – and stays uncontrolled so the caret never jumps while typing.
function FillText({ text, onChange }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.textContent = text || "";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <span
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      onInput={(e) => onChange(e.currentTarget.textContent)}
      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); } }}
      className="inline-block min-w-[1px] whitespace-pre text-[#B01E2F] outline-none"
    />
  );
}

// Put the caret at the end of an editable span.
const focusEnd = (el) => {
  if (!el) return;
  el.focus();
  const r = document.createRange();
  r.selectNodeContents(el);
  r.collapse(false);
  const s = window.getSelection();
  s.removeAllRanges();
  s.addRange(r);
};

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
  // Errands prios and H+F order: plain lists, each line typed, moved or binned.
  // These hold door codes and names, so they live in Supabase, never in this public repo.
  const [cols, setCols] = useState({ errands: [], hf: [] });
  useEffect(() => {
    supabase
      .from("admin_docs")
      .select("data")
      .eq("id", TWOCOL_KEY)
      .maybeSingle()
      .then(({ data }) => {
        const d = data?.data;
        if (d && Array.isArray(d.errands) && Array.isArray(d.hf)) setCols(d);
      });
  }, []);
  const saveCols = (next) => {
    setCols(next);
    supabase.from("admin_docs").upsert({ id: TWOCOL_KEY, data: next, updated_at: new Date().toISOString() }).then(() => {});
  };
  const addColRow = (k, sub = false) => saveCols({ ...cols, [k]: [...cols[k], { id: newId(), text: "", sub }] });
  const setColRow = (k, id, text) => saveCols({ ...cols, [k]: cols[k].map((r) => (r.id === id ? { ...r, text } : r)) });
  const removeColRow = (k, id) => saveCols({ ...cols, [k]: cols[k].filter((r) => r.id !== id) });
  const moveColRow = (k, i, d) => {
    const j = i + d;
    if (j < 0 || j >= cols[k].length) return;
    const next = cols[k].slice();
    [next[i], next[j]] = [next[j], next[i]];
    saveCols({ ...cols, [k]: next });
  };
  const [dragC, setDragC] = useState(null); // personal order line being dragged inside its column
  const [dragP, setDragP] = useState(null); // point box being dragged inside its group
  const [activeRow, setActiveRow] = useState(null); // row the ribbon acts on
  const [confirm, setConfirm] = useState(null); // delete waiting on Yes or Cancel
  // Headings folded shut, remembered across refreshes and visits.
  const [collapsed, setCollapsed] = useState(() => { try { const p = JSON.parse(localStorage.getItem(COLLAPSED_KEY) || "null"); return Array.isArray(p) ? p : []; } catch { return []; } });
  const ask = (run) => setConfirm({ run });
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
  // Red for the highlighted words; pressed again on red text it goes back to black.
  const INK_RED = "#B01E2F";
  const applyRed = (i) => {
    const r = rows[i];
    const el = r && lineRefs.current[r.id];
    if (!el) return;
    el.focus();
    const now = String(document.queryCommandValue("foreColor") || "").replace(/\s/g, "");
    const isRed = now === "rgb(176,30,47)" || now.toLowerCase() === INK_RED.toLowerCase();
    document.execCommand("foreColor", false, isRed ? "#171717" : INK_RED);
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
    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0 text-[11px] font-semibold leading-[15px]" style={{ color: colour }}>
      {list.map((c, i) => {
        const fillable = /\(\)$/.test(c);
        const fill = todoLines[idx]?.fills?.[c] || "";
        return (
          <span key={c} className="inline-flex items-center gap-1.5">
            {fillable ? (
              // Clicking anywhere on the point drops the caret between its brackets.
              // Empty, the field is one space wide – typing fills that space.
              <span
                onClick={(e) => { e.stopPropagation(); focusEnd(e.currentTarget.querySelector("[contenteditable]")); }}
                className="inline-flex cursor-text items-center"
              >
                {c.slice(0, -1)}
                <FillText key={`${idx}-${c}`} text={fill} onChange={(t) => setFill(idx, c, t)} />
                )
              </span>
            ) : (
              c
            )}
            {i < list.length - 1 && <span className="inline-block h-[5px] w-[5px] shrink-0" style={{ backgroundColor: colour }} />}
          </span>
        );
      })}
    </div>
  );

  // Plain function, not a component: a nested component would remount on every
  // keystroke and throw the caret to the end of the field.
  const renderTodoLines = () => (
    <div>
      {todoLines.map((line, idx) => {
        const open = todoOpen === idx;
        // Selected points keep their group on the line: meetings, core codes, then the rest.
        const coreCodes = points.core.filter((it) => line.codes.includes(it.code)).map((it) => it.code);
        const restCodes = points.rest.filter((it) => line.codes.includes(it.code)).map((it) => it.code);
        return (
          // A heavy rule between today and the next day, so the two never blur.
          <div key={idx} className={`bg-white ${idx === 0 ? "border-t border-neutral-300" : "border-t-2 border-neutral-500"}`}>
            {/* The whole line is the toggle – no chevron. */}
            <div
              onClick={() => openLine(open ? null : idx)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => dropOnLine(idx)}
              title="Choose to-dos"
              className="flex min-h-[21px] cursor-pointer items-start hover:bg-neutral-50"
            >
              <div className="flex flex-1 flex-col gap-0 px-2 py-[3px]">
                {line.meetings.length > 0 && (
                  <div className="flex flex-wrap items-center gap-x-1 gap-y-0 leading-[15px]">
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
                        className={`inline-flex cursor-grab items-center gap-1 text-[11px] font-semibold leading-[15px] text-neutral-900 active:cursor-grabbing ${drag?.from === "line" && drag.lineIdx === idx && drag.index === mi ? "opacity-40" : ""}`}
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
                            className="bg-transparent text-[11px] leading-[15px] outline-none"
                          />
                        ) : (
                          <span className="leading-[15px]">{m.name}</span>
                        )}
                        <GripVertical size={10} className="shrink-0 cursor-grab text-neutral-400" />
                        <button
                          onClick={(e) => { e.stopPropagation(); ask(() => dropMeeting(idx, m.id)); }}
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
                  <span className="my-[4px] inline-flex items-center gap-1.5">
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
              // Three columns side by side: meetings, the core codes, then the long list.
              <div className="grid grid-cols-3 items-start gap-1.5 border-t border-[#C1440E] bg-white px-2 py-1.5">
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => returnToPool(idx)}
                  className="flex flex-col gap-1 self-stretch border-[3px] border-[#C1440E] p-1.5"
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
                      className={`flex w-full cursor-grab items-center gap-1.5 rounded border bg-white px-1.5 py-0.5 text-[11px] font-semibold text-neutral-700 hover:text-neutral-900 active:cursor-grabbing ${m.permanent ? "border-[#C1440E]" : "border-neutral-300 hover:border-neutral-400"} ${drag?.from === "pool" && drag.index === mi ? "opacity-40" : ""}`}
                    >
                      <input
                        ref={(el) => { if (el && editing === m.id && document.activeElement !== el) el.focus(); }}
                        value={m.name}
                        readOnly={editing !== m.id}
                        onChange={(e) => renameMeeting(m.id, e.target.value)}
                        onBlur={() => setEditing(null)}
                        className={`min-w-0 flex-1 bg-transparent leading-[15px] outline-none ${editing === m.id ? "" : "pointer-events-none"}`}
                      />
                      <GripVertical size={11} className="shrink-0 cursor-grab text-neutral-400" />
                      <button
                        onClick={() => ask(() => saveMeetings(meetings.filter((x) => x.id !== m.id)))}
                        title="Remove this meeting"
                        className="shrink-0 text-neutral-900 hover:text-[#C1440E]"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  ))}

                  {/* The add sits on the floor of the column, right under the last box. */}
                  {adding ? (
                    <span className="mt-auto flex w-full items-center gap-1.5 rounded border border-neutral-400 bg-white px-1.5 py-0.5">
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
                      <button onClick={() => { addMeeting(); setAdding(false); }} title="Save" className="shrink-0 text-[#9c7c33] hover:opacity-70">
                        <Plus size={12} />
                      </button>
                      {/* Changed your mind: drop the half typed meeting. */}
                      <button onClick={() => { setNewMeeting(""); setNewPermanent(false); setAdding(false); }} title="Cancel" className="shrink-0 text-neutral-900 hover:text-[#C1440E]">
                        <X size={12} />
                      </button>
                    </span>
                  ) : (
                    <button
                      onClick={() => setAdding(true)}
                      title="Add a meeting"
                      className="mt-auto flex h-[19px] w-full items-center justify-center rounded border border-neutral-300 bg-white px-1.5 text-[#9c7c33] hover:border-neutral-400 hover:opacity-70"
                    >
                      <Plus size={12} />
                    </button>
                  )}
                </div>

                {["core", "rest"].map((g) => (
                  <div key={g} className="self-stretch border-[3px] border-[#C1440E] p-1.5">
                    <div className="flex h-full flex-col gap-1">
                      {points[g].map((it, pi) => (
                        <div
                          key={it.id}
                          draggable={editing !== it.id}
                          onDoubleClick={() => setEditing(it.id)}
                          onDragStart={() => setDragP({ group: g, index: pi })}
                          onDragEnd={() => setDragP(null)}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={() => { if (dragP?.group === g) movePoint(g, dragP.index, pi); setDragP(null); }}
                          className={`flex w-full cursor-grab items-center gap-1.5 rounded border border-neutral-300 bg-white px-1.5 py-0.5 text-[11px] font-semibold text-neutral-700 hover:border-neutral-400 hover:text-neutral-900 active:cursor-grabbing ${dragP?.group === g && dragP.index === pi ? "opacity-40" : ""}`}
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
                            className={`min-w-0 flex-1 bg-transparent leading-[15px] outline-none ${editing === it.id ? "" : "pointer-events-none"}`}
                          />
                          <GripVertical size={11} className="shrink-0 cursor-grab self-start text-neutral-400" />
                          <button
                            onClick={() => ask(() => removePoint(g, it.id))}
                            title="Remove this point"
                            className="shrink-0 self-start text-neutral-900 hover:text-[#C1440E]"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      ))}

                      {/* Both groups take new points straight from here, on the floor of the column. */}
                      <button
                        onClick={() => addPoint(g)}
                        title="Add a point"
                        className="mt-auto flex h-[19px] w-full items-center justify-center rounded border border-neutral-300 bg-white px-1.5 text-[#9c7c33] hover:border-neutral-400 hover:opacity-70"
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
      {renderTwoCols()}
    </div>
  );

  // Errands prios on the left, H+F order on the right, each line its own row.
  const renderTwoCols = () => (
    <>
    {/* One bar across the pair, same colour as the Daily and Co sorting bars, and it folds. */}
    <div className="flex h-[18px] items-center gap-1 border-y border-neutral-400 px-2" style={{ backgroundColor: BAR_BG }}>
      <span className="text-[11px] font-bold uppercase leading-[15px] tracking-[0.06em] text-neutral-900">Personal order</span>
      <button onClick={() => toggleCollapse(PERSONAL_ID)} title={collapsed.includes(PERSONAL_ID) ? "Open" : "Close"} className="text-neutral-900 hover:text-[#9c7c33]">
        <ChevronDown size={12} className={`block transition-transform ${collapsed.includes(PERSONAL_ID) ? "-rotate-90" : ""}`} />
      </button>
    </div>
    {collapsed.includes(PERSONAL_ID) && (
      // Folded, but never gone: a blank line with the squares says there is more here.
      <div
        onClick={() => toggleCollapse(PERSONAL_ID)}
        title="Open"
        className="flex h-[21px] cursor-pointer items-center gap-1.5 bg-white px-2 hover:bg-neutral-50"
      >
        {[0, 1, 2, 3, 4].map((n) => (
          <span key={n} className="inline-block h-[5px] w-[5px] bg-neutral-300" />
        ))}
      </div>
    )}
    {!collapsed.includes(PERSONAL_ID) && (
      // Same shape as the daily picker: one red framed column per list.
      <div className="grid grid-cols-2 items-start gap-1.5 bg-white px-2 py-1.5">
        {TWOCOLS.map(([k, label]) => (
          <div key={k} className="flex flex-col self-stretch border-[3px] border-[#C1440E] p-1.5">
            <p className="mb-1 text-[11px] font-bold uppercase leading-[15px] tracking-[0.06em] text-neutral-900">{label}</p>
            <div className="flex flex-1 flex-col gap-1">
              {cols[k].map((r, i) => (
                <div
                  key={r.id}
                  draggable={editing !== r.id}
                  onDoubleClick={() => setEditing(r.id)}
                  onDragStart={() => setDragC({ col: k, index: i })}
                  onDragEnd={() => setDragC(null)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => { if (dragC?.col === k) moveColRow(k, dragC.index, i); setDragC(null); }}
                  // A sub line is the same row, stepped in from the left.
                  style={r.sub ? { marginLeft: "20px" } : undefined}
                  className={`flex cursor-grab items-center gap-1.5 rounded border border-neutral-300 bg-white px-1.5 py-0.5 text-[11px] font-semibold text-neutral-700 hover:border-neutral-400 hover:text-neutral-900 active:cursor-grabbing ${dragC?.col === k && dragC.index === i ? "opacity-40" : ""}`}
                >
                  <input
                    ref={(el) => { if (el && editing === r.id && document.activeElement !== el) el.focus(); }}
                    value={r.text}
                    readOnly={editing !== r.id}
                    onChange={(e) => setColRow(k, r.id, e.target.value)}
                    onBlur={() => setEditing(null)}
                    className={`min-w-0 flex-1 bg-transparent leading-[15px] outline-none ${editing === r.id ? "" : "pointer-events-none"}`}
                  />
                  <GripVertical size={11} className="shrink-0 cursor-grab text-neutral-400" />
                  <button onClick={() => ask(() => removeColRow(k, r.id))} title="Remove this line" className="shrink-0 text-neutral-900 hover:text-[#C1440E]">
                    <Trash2 size={11} />
                  </button>
                </div>
              ))}
              {/* The two adds sit on the floor of the column, right under the last line. */}
              <div className="mt-auto flex w-full gap-1">
                <button
                  onClick={() => addColRow(k, false)}
                  title="Add a line"
                  className="flex h-[19px] flex-1 items-center justify-center rounded border border-neutral-300 bg-white px-1.5 text-[#9c7c33] hover:border-neutral-400 hover:opacity-70"
                >
                  <Plus size={12} />
                </button>
                <button
                  onClick={() => addColRow(k, true)}
                  title="Add a sub line"
                  className="flex h-[19px] flex-1 items-center justify-center gap-0.5 rounded border border-neutral-300 bg-white px-1.5 text-[#9c7c33] hover:border-neutral-400 hover:opacity-70"
                >
                  <ChevronsRight size={11} /> <Plus size={12} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    )}
    </>
  );

  const toggleCollapse = (id) => {
    const next = collapsed.includes(id) ? collapsed.filter((x) => x !== id) : [...collapsed, id];
    setCollapsed(next);
    try { localStorage.setItem(COLLAPSED_KEY, JSON.stringify(next)); } catch {}
  };
  // Every heading folds, except the locked Daily routine one that carries the checklist.
  const collapsible = (r) => r.type !== "text" && !isTodoHeader(r);
  // A folded heading hides only its own rows, up to the very next heading of any kind.
  const rank = (r) => (r.type === "header" ? 1 : r.type === "subheader" ? 2 : 3);
  const hidden = (() => {
    const out = []; let until = null;
    rows.forEach((r, i) => {
      if (until !== null && r.type !== "text") until = null;
      out[i] = until !== null;
      if (until === null && collapsed.includes(r.id) && collapsible(r)) until = rank(r);
    });
    return out;
  })();

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
      <div className="flex h-[21px] items-center gap-3 border-b border-neutral-300 bg-neutral-50 px-2">
        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => applyCmd(target, "bold")}
          title="Bold the highlighted words"
          className={`flex h-4 w-4 items-center justify-center ${!r ? off : on}`}
        >
          <span className="text-[14px] font-black leading-none tracking-tight">B</span>
        </button>
        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => applyRed(target)}
          title="Switch the highlighted words between red and black"
          className="flex h-4 w-4 items-center justify-center"
        >
          {/* Half red, half black: it switches text between the two. */}
          <span className="block h-3 w-3" style={{ background: `linear-gradient(135deg, ${INK_RED} 50%, #171717 50%)` }} />
        </button>
        <button onMouseDown={(e) => e.preventDefault()} onClick={() => applyCmd(target, "insertUnorderedList")} title="Bullet the selected lines" className={`flex h-4 w-4 items-center justify-center ${!r ? off : on}`}><List size={15} strokeWidth={2.75} /></button>
        <button onMouseDown={(e) => e.preventDefault()} onClick={() => applyCmd(target, "outdent")} title="Decrease indent" className={`flex h-4 w-4 items-center justify-center ${!r ? off : on}`}><ChevronsLeft size={15} strokeWidth={2.75} /></button>
        <button onMouseDown={(e) => e.preventDefault()} onClick={() => applyCmd(target, "indent")} title="Increase indent" className={`flex h-4 w-4 items-center justify-center ${!r ? off : on}`}><ChevronsRight size={15} strokeWidth={2.75} /></button>
      </div>
    );
  };

  const TypeMenu = ({ at, opts = ALL_TYPES }) => (
    // Plain words in the same style as the Add bar, no boxes.
    <div className="flex h-[21px] items-center gap-4 border-t border-neutral-200 bg-neutral-50 px-2 text-[11px] font-bold uppercase leading-none tracking-wide">
      {opts.map(([lbl, type]) => (
        <button key={type} onClick={() => insertAt(at, type)} className="transition-opacity hover:opacity-70" style={{ color: "#C1440E" }}>{lbl}</button>
      ))}
      <button onClick={() => setAddMenu(null)} className="transition-opacity hover:opacity-70" style={{ color: "#C1440E" }}>Cancel</button>
    </div>
  );

  return (
    <div className="w-full">
      <div spellCheck={false} className="w-full border-2 border-neutral-400 shadow-sm overflow-hidden bg-white">
        {/* With no Daily routine heading to hang under, the checklist sits up here. */}
        {anchorIdx < 0 && renderTodoLines()}

        <div>
          {rows.map((r, i) => {
            if (hidden[i]) return null;
            // Every heading in this table is a main heading, so they share one colour.
            const bg = r.type === "text" ? "#fff" : BAR_BG;
            // The heading the checklist hangs under is locked: no typing, no bin, no dragging.
            const locked = isTodoHeader(r);
            const field = locked ? (
              <span className="flex-1 text-[11px] font-bold uppercase leading-[15px] tracking-[0.06em] text-neutral-900">{r.text}</span>
            ) : r.type === "text" ? (
              // One block, formatted line by line exactly as a Word document would be.
              <div className="flex flex-1 items-start gap-1">
                <RichLine
                  html={r.html ?? escapeHtml(r.text)}
                  innerRef={(el) => { lineRefs.current[r.id] = el; }}
                  onFocus={() => setActiveRow(r.id)}
                  onInput={(html) => updateHtml(i, html)}
                  className="rich-line min-h-[15px] flex-1 whitespace-pre-wrap break-words bg-transparent py-0 text-[11px] leading-[15px] text-neutral-900 outline-none"
                />
              </div>
            ) : collapsible(r) ? (
              // Headings fold away: the chevron sits right after the word.
              <span className="flex flex-1 items-center gap-1">
                <input
                  value={r.text}
                  onChange={(e) => update(i, e.target.value)}
                  style={{ width: `${(r.text || "").length * 1.15 + 1}ch` }}
                  className="bg-transparent py-0 text-[11px] font-bold uppercase leading-[15px] tracking-[0.06em] text-neutral-900 outline-none"
                />
                <button onClick={() => toggleCollapse(r.id)} title={collapsed.includes(r.id) ? "Open" : "Close"} className="text-neutral-900 hover:text-[#9c7c33]">
                  <ChevronDown size={12} className={`block transition-transform ${collapsed.includes(r.id) ? "-rotate-90" : ""}`} />
                </button>
              </span>
            ) : (
              <input value={r.text} onChange={(e) => update(i, e.target.value)} className="flex-1 bg-transparent py-0 text-[11px] font-bold uppercase leading-[15px] tracking-[0.06em] text-neutral-900 outline-none" />
            );
            // Hairline separators either side of a header – enough to group a section
            // without the bar turning into a thick band.
            const isHead = r.type !== "text";
            const prevHeader = i > 0 && rows[i - 1].type !== "text";
            const topBorder = i === 0 ? "" : isHead ? "border-t border-neutral-400" : prevHeader ? "" : "border-t border-neutral-300";
            const botBorder = isHead ? "border-b border-neutral-400" : "";
            // A section ends where the next header starts, or at the foot of the table.
            const sectionEnd =
              (i === rows.length - 1 || rows[i + 1].type !== "text") && !isTodoHeader(headingFor(i) || {});
            return (
              <div key={r.id}>
                <div
                  className={`group relative flex gap-2 ${topBorder} ${botBorder} px-2 ${isHead ? "h-[18px] items-center py-0" : "min-h-[21px] items-start py-[3px]"}`}
                  style={{ backgroundColor: bg }}
                >
                  {field}
                  {!locked && (
                    <div className="flex shrink-0 items-center gap-1 leading-none">
                      <button onClick={() => moveRow(i, -1)} disabled={i === 0} title="Move up" className="text-neutral-900 hover:text-[#9c7c33] disabled:opacity-25"><ChevronUp size={12} /></button>
                      <button onClick={() => moveRow(i, 1)} disabled={i === rows.length - 1} title="Move down" className="text-neutral-900 hover:text-[#9c7c33] disabled:opacity-25"><ChevronDown size={12} /></button>
                      <button onClick={() => ask(() => remove(i))} title="Delete" className="text-neutral-900 hover:text-[#C1440E]"><Trash2 size={12} /></button>
                    </div>
                  )}
                </div>
                {/* One ribbon per section, always there, acting on the row you last clicked. */}
                {isHead && !locked && !collapsed.includes(r.id) && renderRibbon(i)}
                {isTodoHeader(r) && renderTodoLines()}
                {/* Folded, but never gone: a blank line with the squares says there is more here. */}
                {collapsed.includes(r.id) && collapsible(r) && (
                  <div
                    onClick={() => toggleCollapse(r.id)}
                    title="Open"
                    className="flex h-[21px] cursor-pointer items-center gap-1.5 bg-white px-2 hover:bg-neutral-50"
                  >
                    {[0, 1, 2, 3, 4].map((n) => (
                      <span key={n} className="inline-block h-[5px] w-[5px] bg-neutral-300" />
                    ))}
                  </div>
                )}
                {addMenu === i ? (
                  <TypeMenu at={i + 1} opts={SECTION_TYPES} />
                ) : (
                  // Only an open section carries its Add bar; folded, the squares line stands alone.
                  sectionEnd && !hidden[i] && !collapsed.includes(r.id) && (
                    <button
                      onClick={() => setAddMenu(i)}
                      style={{ color: "#C1440E" }}
                      className="flex h-[21px] w-full items-center gap-1 border-t border-neutral-200 bg-neutral-50 px-2 text-[11px] font-bold uppercase leading-none tracking-wide transition-opacity hover:opacity-70"
                    >
                      <Plus size={12} /> Add
                    </button>
                  )
                )}
              </div>
            );
          })}
          {rows.length === 0 && <p className="px-2 py-2 text-[11px] italic text-neutral-400">Empty. Use Add below to start.</p>}
        </div>

        {/* No table wide add: each section carries its own, and an empty table starts one. */}
        {rows.length === 0 && (addMenu === "end" ? <TypeMenu at={0} /> : (
          <button onClick={() => setAddMenu("end")} style={{ color: "#C1440E" }} className="flex h-[21px] w-full items-center gap-1 border-t border-neutral-200 bg-neutral-50 px-2 text-[11px] font-bold uppercase leading-none tracking-wide transition-opacity hover:opacity-70"><Plus size={12} /> Add</button>
        ))}

      </div>

      {/* Every bin on this page asks first. */}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={() => setConfirm(null)}>
          <div className="w-full max-w-sm border-[3px] bg-white p-6 text-center shadow-2xl" style={{ borderColor: "#C1440E" }} onClick={(e) => e.stopPropagation()}>
            <p className="text-[14px] font-bold uppercase tracking-[0.06em] text-neutral-900">Delete this?</p>
            <div className="mt-5 flex justify-center gap-3 text-[12px] font-bold uppercase tracking-wide">
              <button
                onClick={() => { confirm.run(); setConfirm(null); }}
                className="border-2 px-5 py-1.5 text-white transition-opacity hover:opacity-80"
                style={{ backgroundColor: "#C1440E", borderColor: "#C1440E" }}
              >
                Delete
              </button>
              <button
                onClick={() => setConfirm(null)}
                className="border-2 px-5 py-1.5 transition-opacity hover:opacity-70"
                style={{ borderColor: "#C1440E", color: "#C1440E" }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
