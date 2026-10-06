import { Fragment, useState, useEffect, useRef } from "react";
import { Plus, Trash2, ChevronUp, ChevronDown, ChevronRight, List, ChevronsRight, ChevronsLeft, X, GripVertical, Calendar, Download } from "lucide-react";
import { supabase } from "./lib/supabaseClient.js";

// Blank editable table – exact dimensions/fonts of the Silxops MD-area table.
// Rows are header / subheader / text. Colours step brightest → lowest (title → header → sub-header).
// Same ramp as the Costs table: darkest gold on the main title bars, then down.
const BAR_BG = "#F2C46D";     // main title bar – darkest
const HEADER_BG = "#FFE4B3";  // one step down
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
const NOTES_KEY = "finestate.planning.notes"; // department notes, one per company board
const PLAN_KEY = "planning"; // the whole page, kept in the private admin_docs table

// The lists that sit under the daily area, side by side, under one folding bar.
const TWOCOLS = [["errands", "Errands prios"], ["hf", "H+F order"]];
const PERSONAL_ID = "personal-order";
// A tick lives on one day line. Older saves ticked the list itself, and those count
// as ticks on the first line.
const isPicked = (r, lineIdx) => (r?.pick ? !!r.pick[lineIdx] : lineIdx === 0 && !!r?.picked);

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
  { code: "Ycfoodmd ()" },
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

// Spacing before a bracket is whatever was typed, never touched here.

// Points that gained brackets to type into after they were first saved.
const FILLABLE = ["Ycfoodmd"];
const addBrackets = (s) => (FILLABLE.includes(String(s || "").trim()) ? `${String(s).trim()} ()` : s);
const fixCode = (s) => addBrackets(s);

const emptyLine = () => ({ codes: [], meetings: [], fills: {} });
// Older saves held a bare array of codes.
const normaliseLine = (l) =>
  Array.isArray(l) ? { codes: l, meetings: [], fills: {} } : { codes: l?.codes || [], meetings: l?.meetings || [], fills: l?.fills || {}, extras: l?.extras || {} };

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
  // Follows text that arrives after the first render, such as a load from storage,
  // but never rewrites itself while the caret is in it.
  useEffect(() => {
    const el = ref.current;
    if (el && document.activeElement !== el && el.innerHTML !== (html || "")) el.innerHTML = html || "";
  }, [html]);
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
  // Follows changes made elsewhere, such as ticking a personal order line, but
  // never rewrites itself while the caret is in it.
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
      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); } }}
      className="inline-block min-w-[1px] whitespace-pre text-[#B01E2F] outline-none"
    />
  );
}

// Rich notes saved as HTML, read back as plain lines for a backup file.
const htmlToLines = (html) => {
  const box = document.createElement("textarea");
  box.innerHTML = String(html || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<[^>]+>/g, "");
  return box.value.replace(/\n{3,}/g, "\n\n").trim();
};
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

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

// A personal order line. Uncontrolled so the caret stays put, and it wraps onto as
// many lines as the words need – nothing is ever cut off.
function WrapLine({ text, onChange, className }) {
  const ref = useRef(null);
  // Follows text that arrives later, such as a load from Supabase, but never
  // rewrites itself while the caret is in it.
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
      // Tab steps a line in, rather than jumping out of the field.
      onKeyDown={(e) => {
        if (e.key !== "Tab") return;
        e.preventDefault();
        document.execCommand("insertText", false, "    ");
        onChange(e.currentTarget.textContent);
      }}
      className={className}
    />
  );
}

// The daily group: one top bar, then a board per company underneath, each with its
// own pair of mirrored day lines, meetings and points.
const BOARDS = [
  ["master", "Prep"],
  ["silx", "Silx"],
  ["says", "Says"],
  ["servefast", "Servefast"],
];
// They were first called "Daily master" and so on; saved rows are renamed on load.
const OLD_LABELS = { "DAILY MASTER": "Prep", "MASTER": "Prep" };
// Only Prep carries a bar now; the company boards hang underneath it unlabelled.
const OLD_BARS = ["DAILY SILX", "DAILY SAYS", "DAILY SERVEFAST", "SILX", "SAYS", "SERVEFAST"];
const DAILY_GROUP = "Daily";
// What an empty day line shows, so the four boards still read apart at a glance.
const BOARD_TAGS = { master: "Finestate", silx: "Silx", says: "Says", servefast: "Servefast" };
// A solid burgundy for the marks on a meeting, so they read clearly.
const MEETING_ICON = "#7B1E3A";
// The faintest wash of the table red, behind every pair of day lines.
const DAY_BG = "#FBEFEC";
// Only Master plans meetings; the company boards are just their two point columns.
const MEETING_BOARDS = ["master"];
// On a company day line only the short code shows: "FI (financials)" reads as FI.
const shortCode = (c) => String(c || "").split("(")[0].trim();
const shortLine = (prios, rest) =>
  [prios.length ? `(${prios.map(shortCode).join("-")})` : "", rest.map(shortCode).join("-")]
    .filter(Boolean)
    .join("-");
// What the two point columns are called on each board, blank where they need no label.
const GROUP_LABELS = {
  master: ["", ""],
  silx: ["Prios", "Non-prios"],
  says: ["Prios", "Non-prios"],
  servefast: ["Prios", "Non-prios"],
};
// Points a board starts with, taken from the site it came from.
const BOARD_SEEDS = {
  silx: {
    core: ["FI (finances)", "CS (clientservices)", "YU (youandteamclientupdates)", "BD (businessdevelopment)", "TM (talentmanagement)", "OW (operationswebsite)"],
    rest: [
      "EU (emaillistupdates)", "CR (creativerefresh)", "WS (workflownewmonthsetups)", "OP (organictrafficpurchases)",
      "RE (reporting)", "TB (thirdpartybilling)", "SS (samirsalary)", "FR (freelancerinvoicesubmissionreminder)",
      "AP (accountspayablesilxsays)", "AR (accountsreceivable)", "CP (creditcardpayment)", "IN (invoicing)",
      "NM (newmonthsetup)", "VA (vat)", "MF (monthlyfinancials)", "MP (mdpayment)", "DS (dibtoswissquote)",
      "DM (dibtomortgagepayment)", "FU (financialworksheetupdates)", "NY (newtaxyearsetup)", "TF (taxfilings)",
    ],
  },
  says: {
    core: [
      "RE (contentpeoplecantwaittowatchworkonbusinessnotinit)", "FI (financials)",
      "SC (dropboxdesktopbookmarkswhatasappemailsdepartmentnotessaysopsf)", "TM (teammeets)",
      "PR (production)", "OW (operationswebsite)", "MA (marcomms)", "SA (sales)",
      "HR (dubaisateamsofficesstudios)", "LE (licensespermitslawyers)",
    ],
    rest: [],
  },
};
const DAILY_SECTIONS = [BOARDS[0][1]];
const boardOf = (r) => {
  const t = String(r?.text || "").trim().toUpperCase();
  const hit = BOARDS.find(([, label]) => label.toUpperCase() === t);
  return hit ? hit[0] : null;
};
// Master keeps the original storage keys so nothing already saved moves.
const keyFor = (base, b) => (b === "master" ? base : `${base}.${b}`);
const readJson = (key, fallback) => {
  try { const p = JSON.parse(localStorage.getItem(key) || "null"); return p == null ? fallback : p; } catch { return fallback; }
};
const loadBoards = () => {
  const out = {};
  for (const [b] of BOARDS) {
    const savedLines = readJson(keyFor(TODO_LINES_KEY, b), null);
    // Every board keeps the house spacing: one space before an opening bracket.
    const styleCode = fixCode;
    const lines = Array.isArray(savedLines) && savedLines.length === 2
      ? savedLines.map(normaliseLine).map((l) => ({
          ...l,
          codes: l.codes.map(styleCode),
          // Anything typed in brackets follows its code to the new spelling.
          fills: Object.fromEntries(Object.entries(l.fills || {}).map(([c, v]) => [styleCode(c), v])),
        }))
      : [emptyLine(), emptyLine()];
    const style = styleCode;
    const savedPoints = readJson(keyFor(POINTS_KEY, b), null);
    const points = savedPoints && Array.isArray(savedPoints.core) && Array.isArray(savedPoints.rest)
      ? { core: savedPoints.core.map((x) => ({ ...x, code: style(x.code) })), rest: savedPoints.rest.map((x) => ({ ...x, code: style(x.code) })) }
      // A board arrives with the points its site already used, where I have them.
      : b === "master"
        ? { core: TODO_CORE.map((it) => ({ id: newId(), code: it.code })), rest: TODO_REST.map((it) => ({ id: newId(), code: it.code })) }
        : BOARD_SEEDS[b]
          ? { core: BOARD_SEEDS[b].core.map((c) => ({ id: newId(), code: style(c) })), rest: BOARD_SEEDS[b].rest.map((c) => ({ id: newId(), code: style(c) })) }
          : { core: [], rest: [] };
    const meetings = readJson(keyFor(MEETINGS_KEY, b), []);
    let open = null;
    try { const v = localStorage.getItem(keyFor(TODO_OPEN_KEY, b)); open = v == null || v === "" ? null : Number(v); } catch {}
    let notes = "";
    try { notes = localStorage.getItem(keyFor(NOTES_KEY, b)) || ""; } catch {}
    out[b] = { lines, points, meetings: Array.isArray(meetings) ? meetings : [], open, notes };
  }
  return out;
};
// The Daily bar keeps its place at the top; the four board headings follow it in
// order, and any blank filler row left from an earlier layout is dropped.
const withDailySections = (rawList) => {
  const nameOf = (r) => String(r?.text || "").trim().toUpperCase();
  const list = rawList.map((r) =>
    r.type !== "text" && OLD_LABELS[nameOf(r)] ? { ...r, text: OLD_LABELS[nameOf(r)] } : r
  );
  const isBoardHead = (r) => r && r.type !== "text" && DAILY_SECTIONS.some((n) => n.toUpperCase() === nameOf(r));
  const isDailyHead = (r) => r && r.type !== "text" && nameOf(r) === DAILY_GROUP.toUpperCase();
  // Anything the old layout inserted under a board heading was a placeholder.
  const strippedBars = list.filter((r) => r.type === "text" || !OLD_BARS.includes(nameOf(r)));
  const cleaned = strippedBars.filter((r, i) => {
    if (r.type !== "text") return true;
    const prev = strippedBars[i - 1];
    return !(isBoardHead(prev) && !String(r.text || "").trim() && !String(r.html || "").replace(/<[^>]*>/g, "").trim());
  });
  let out = cleaned;
  // The old Daily heading carried the checklist; it becomes the group bar.
  let dailyIdx = out.findIndex(isDailyHead);
  if (dailyIdx < 0) {
    let anchorId = null;
    try { anchorId = localStorage.getItem(TODO_ANCHOR_KEY); } catch {}
    dailyIdx = out.findIndex((r) => r.id === anchorId);
    if (dailyIdx < 0) {
      out = [{ id: newId(), type: "header", text: DAILY_GROUP }, ...out];
      dailyIdx = 0;
    } else {
      out = out.map((r, i) => (i === dailyIdx ? { ...r, text: DAILY_GROUP } : r));
    }
  }
  // Each board heading sits under the Daily bar, in board order.
  let at = dailyIdx + 1;
  for (const label of DAILY_SECTIONS) {
    const found = out.findIndex((r) => r.type !== "text" && nameOf(r) === label.toUpperCase());
    if (found < 0) {
      out = [...out.slice(0, at), { id: newId(), type: "header", text: label }, ...out.slice(at)];
    }
    at = out.findIndex((r) => r.type !== "text" && nameOf(r) === label.toUpperCase()) + 1;
  }
  // Department notes live at the foot of each board's dropdown now, so any leftover
  // heading in the table goes, its lines having been moved across.
  for (let i = out.length - 1; i >= 0; i--) {
    const r = out[i];
    if (r.type === "text" || !/^DEPARTMENT ?NOTES$/.test(nameOf(r))) continue;
    let end = i + 1;
    while (end < out.length && out[end].type === "text") end++;
    out = [...out.slice(0, i), ...out.slice(end)];
  }
  // Sorting notes has moved out of this table; the empty heading goes with it, but
  // only while nothing is written under it.
  const sortIdx = out.findIndex((r) => r.type !== "text" && /sorting/i.test(String(r.text || "")));
  if (sortIdx >= 0) {
    let end = sortIdx + 1;
    while (end < out.length && !isBoardHead(out[end]) && !isDailyHead(out[end])) end++;
    const written = out
      .slice(sortIdx + 1, end)
      .some((r) => String(r.text || "").trim() || String(r.html || "").replace(/<[^>]*>/g, "").trim());
    if (!written) out = [...out.slice(0, sortIdx), ...out.slice(end)];
  }
  return out;
};

function AutoTextarea({ value, onChange, ...props }) {
  const ref = useRef(null);
  useEffect(() => { const el = ref.current; if (el) { el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; } }, [value]);
  return <textarea ref={ref} value={value} onChange={onChange} rows={1} {...props} />;
}

// How far a checklist point or list line is stepped in. Older saves only knew in or
// out (`sub`), so an indented one from before reads as one step.
const MAX_LEVEL = 4;
const levelOf = (x) => (Number.isFinite(x?.level) ? x.level : x?.sub ? 1 : 0);
// A line with stepped-in lines right under it heads a group: it can be closed and
// opened, and closing it hides everything under it until the next line at its level.
const isHead = (list, i) => i + 1 < list.length && levelOf(list[i + 1]) > levelOf(list[i]);
const hiddenRows = (list) => {
  const hidden = new Set();
  let closedAt = null;
  list.forEach((r, i) => {
    if (closedAt != null && levelOf(r) > closedAt) { hidden.add(r.id); return; }
    closedAt = null;
    if (r.closed && isHead(list, i)) closedAt = levelOf(r);
  });
  return hidden;
};
// Only the SC (CCEDB) point has the notes dropdown and the trimmable red letters.
const hasNotes = (p) => /^SC\s*\(CCEDB/i.test(String(p?.code || "").trim());
// A small text box that grows with its text. A line starting "- " becomes a bullet,
// and Enter on a bullet starts the next one.
function BulletBox({ value, onChange }) {
  const onKeyDown = (e) => {
    if (e.key !== "Enter" || e.shiftKey) return;
    const el = e.currentTarget;
    const at = el.selectionStart;
    const lineStart = value.lastIndexOf("\n", at - 1) + 1;
    const line = value.slice(lineStart, at);
    if (!line.startsWith("• ")) return;
    e.preventDefault();
    const next = line === "• " ? value.slice(0, lineStart) + value.slice(at) : value.slice(0, at) + "\n• " + value.slice(el.selectionEnd);
    const caret = line === "• " ? lineStart : at + 3;
    onChange(next);
    requestAnimationFrame(() => { el.selectionStart = el.selectionEnd = caret; });
  };
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/(^|\n)- /g, "$1• "))}
      onKeyDown={onKeyDown}
      rows={2}
      placeholder="- for a bullet"
      spellCheck
      ref={(el) => { if (el) { el.style.height = "auto"; el.style.height = `${el.scrollHeight + 2}px`; } }}
      className="block w-full resize-none overflow-hidden rounded border border-neutral-300 bg-white px-1.5 py-0.5 text-[11px] leading-[15px] text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-neutral-400"
    />
  );
}
const stepLevel = (x, d) => {
  const level = Math.max(0, Math.min(MAX_LEVEL, levelOf(x) + d));
  return { ...x, level, sub: level > 0 };
};

export default function Planning() {
  const [title, setTitle] = useState(() => { try { return localStorage.getItem(TITLE_KEY) || "Planning"; } catch { return "Planning"; } });
  const [rows, setRows] = useState(() => {
    try {
      const p = JSON.parse(localStorage.getItem(ROWS_KEY) || "null");
      // Nothing saved yet: draw the table itself, Daily bar and the four boards.
      if (!Array.isArray(p)) return withDailySections([]);
      // Text rows written before rich editing carry their words in `text`, and every
      // visual line becomes its own block so it can be bulleted or indented alone.
      const list = p.map((r) =>
        r.type !== "text"
          ? r
          : { ...r, html: toBlocks(r.html == null ? escapeHtml(r.text).replace(/\n/g, "<br>") : r.html) }
      );
      return withDailySections(list);
    } catch { return []; }
  });
  const [addMenu, setAddMenu] = useState(null); // row index whose insert menu is open, or "end"
  // One board per daily heading: Master keeps the original saves, the company ones
  // start empty and are stored beside them.
  const [boards, setBoards] = useState(loadBoards);
  const [newMeeting, setNewMeeting] = useState("");
  const [newPermanent, setNewPermanent] = useState(false);
  const [adding, setAdding] = useState(false);
  // What is being dragged: a box from the picker, or a name already on a line.
  const [drag, setDrag] = useState(null);
  const [editing, setEditing] = useState(null); // meeting being typed in, so dragging steps aside
  const [todoAnchor, setTodoAnchor] = useState(() => { try { return localStorage.getItem(TODO_ANCHOR_KEY) || null; } catch { return null; } });
  // Errands prios and H+F order: plain lists, each line typed, moved or binned.
  // These hold door codes and names, so they live in Supabase, never in this public repo.
  const [cols, setCols] = useState({ errands: [], hf: [], notes: "", scratch: "", quicks: [], temp: "" });
  useEffect(() => {
    supabase
      .from("admin_docs")
      .select("data")
      .eq("id", TWOCOL_KEY)
      .maybeSingle()
      .then(({ data }) => {
        const d = data?.data;
        // A column added later starts empty rather than undefined.
        if (d) setCols({ errands: d.errands || [], hf: d.hf || [], notes: d.notes || "", scratch: d.scratch || "", quicks: d.quicks || [], temp: d.temp || "" });
      });
  }, []);
  const saveCols = (next) => {
    setCols(next);
    supabase.from("admin_docs").upsert({ id: TWOCOL_KEY, data: next, updated_at: new Date().toISOString() }).then(() => {});
  };
  const addColRow = (k, sub = false) => saveCols({ ...cols, [k]: [...cols[k], { id: newId(), text: "", sub }] });
  // Retyping a ticked line updates the Errandsprios brackets on every day line it is ticked on.
  const setColRow = (k, id, text) => {
    const next = { ...cols, [k]: cols[k].map((r) => (r.id === id ? { ...r, text } : r)) };
    saveCols(next);
    const row = cols[k].find((r) => r.id === id);
    const lines = boards.master.lines.map((_, i) => i).filter((i) => isPicked(row, i));
    if (lines.length) syncErrands(next, lines);
  };
  const removeColRow = (k, id) => saveCols({ ...cols, [k]: cols[k].filter((r) => r.id !== id) });
  const toggleColClosed = (k, id) => saveCols({ ...cols, [k]: cols[k].map((r) => (r.id === id ? { ...r, closed: !r.closed } : r)) });
  const stepColRow = (k, id, d) => saveCols({ ...cols, [k]: cols[k].map((r) => (r.id === id ? stepLevel(r, d) : r)) });
  // Ticked lines write themselves into the Errandsprios brackets on today's line,
  // joined by a dash with no spaces, in the red the brackets already use.
  // `lineIdx` is one day line, or a list of them to update together.
  const syncErrands = (next, lineIdx = 0) => {
    const which = Array.isArray(lineIdx) ? lineIdx : [lineIdx];
    const master = boards.master;
    // Whatever the point is called now, it is the one about errands with brackets.
    const code = [...master.points.core, ...master.points.rest]
      .map((p) => String(p.code).trim())
      .find((c) => /errands/i.test(c) && /\(\s*\)$/.test(c));
    if (!code) return;
    const textFor = (li) => TWOCOLS
      .flatMap(([k]) => (next[k] || []).filter((r) => isPicked(r, li)).map((r) => String(r.text || "").trim()))
      .filter(Boolean)
      .join("-");
    // It lands on the day line whose picker is open, not always today's.
    saveLines("master", master.lines.map((l, i) => {
      if (!which.includes(i)) return l;
      const codes = l.codes.includes(code) ? l.codes : [...l.codes, code];
      return { ...l, codes, fills: { ...(l.fills || {}), [code]: textFor(i) } };
    }));
  };
  // The lists themselves are shared between the two day lines, but a tick belongs to
  // the line it was made on, so each day carries its own errands.
  const toggleColPick = (k, id, lineIdx) => {
    const next = {
      ...cols,
      [k]: cols[k].map((r) =>
        r.id === id ? { ...r, picked: undefined, pick: { ...(r.pick || {}), [lineIdx]: !isPicked(r, lineIdx) } } : r
      ),
    };
    saveCols(next);
    syncErrands(next, lineIdx);
  };
  // Drag and drop moves a line to where it was dropped, not by a step.
  const moveColRow = (k, from, to) => {
    if (from == null || to == null || from === to) return;
    const next = cols[k].slice();
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    saveCols({ ...cols, [k]: next });
  };
  const [dragC, setDragC] = useState(null); // personal order line being dragged inside its column
  const [dropAt, setDropAt] = useState(null); // where that line would land: { col, index }
  const [flash, setFlash] = useState(null); // column whose add button just fired
  // Drop the dragged line where the marker sits, counting the gap it leaves behind.
  const dropColRow = (k) => {
    if (dragC?.col === k && dropAt?.col === k) {
      const to = dropAt.index > dragC.index ? dropAt.index - 1 : dropAt.index;
      moveColRow(k, dragC.index, to);
    }
    setDragC(null);
    setDropAt(null);
  };
  const [dragP, setDragP] = useState(null); // point box being dragged inside its group
  const [dropP, setDropP] = useState(null); // where that point would land: { board, group, index }
  const [dropM, setDropM] = useState(null); // where a picker meeting would land: { board, index }
  // Both use the same rule as the personal order lines: land on the marker, counting
  // the gap the dragged box leaves behind.
  // A point can also be dragged into the other group of its column, as from Regular
  // prios up into Hyper-prios.
  const dropPoint = (b) => {
    if (dragP?.board === b && dropP?.board === b) {
      if (dragP.group === dropP.group) {
        movePoint(b, dropP.group, dragP.index, dropP.index > dragP.index ? dropP.index - 1 : dropP.index);
      } else {
        const pts = boards[b].points;
        const from = (pts[dragP.group] || []).slice();
        const [moved] = from.splice(dragP.index, 1);
        const to = (pts[dropP.group] || []).slice();
        to.splice(dropP.index, 0, moved);
        savePoints(b, { ...pts, [dragP.group]: from, [dropP.group]: to });
      }
    }
    setDragP(null);
    setDropP(null);
  };
  const dropPoolMeeting = (b) => {
    if (drag?.from === "pool" && drag.board === b && dropM?.board === b) {
      moveMeeting(b, drag.index, dropM.index > drag.index ? dropM.index - 1 : dropM.index);
    }
    setDrag(null);
    setDropM(null);
  };
  const [activeRow, setActiveRow] = useState(null); // row the ribbon acts on
  const [confirm, setConfirm] = useState(null); // delete waiting on Yes or Cancel
  // Headings folded shut, remembered across refreshes and visits.
  const [collapsed, setCollapsed] = useState(() => { try { const p = JSON.parse(localStorage.getItem(COLLAPSED_KEY) || "null"); return Array.isArray(p) ? p : []; } catch { return []; } });
  const ask = (run) => setConfirm({ run });


  // Everything on this page is mirrored into Supabase under one row, so it belongs to
  // the account rather than to whichever browser it was typed in.
  const cloudReady = useRef(false);
  const cloudTimer = useRef(null);
  const [planReady, setPlanReady] = useState(false); // the account copy has been read
  const [planErr, setPlanErr] = useState("");
  const pending = useRef(null); // a save waiting out the pause, so leaving the page can send it
  const writePlan = (next) => {
    pending.current = null;
    const now = new Date().toISOString();
    const data = { ...next, movedFromBrowser: true };
    // The page itself, and a full copy for today beside it. Each day keeps its own
    // copy, so any earlier day can be brought back whatever happens to the page.
    return supabase
      .from("admin_docs")
      .upsert([
        { id: PLAN_KEY, data, updated_at: now },
        { id: `${PLAN_KEY}-backup-${now.slice(0, 10)}`, data, updated_at: now },
      ])
      .then(({ error }) => setPlanErr(error ? `Not saved: ${error.message}` : ""));
  };
  const keepInCloud = (next) => {
    if (!cloudReady.current) return;
    pending.current = next;
    clearTimeout(cloudTimer.current);
    cloudTimer.current = setTimeout(() => writePlan(next), 800);
  };
  // A change made in the last moment before the tab is closed or hidden still goes.
  useEffect(() => {
    const flush = () => {
      if (document.visibilityState === "hidden" && pending.current) {
        clearTimeout(cloudTimer.current);
        writePlan(pending.current);
      }
    };
    document.addEventListener("visibilitychange", flush);
    return () => document.removeEventListener("visibilitychange", flush);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const noteRefs = useRef({}); // board -> its department notes element, for the ribbon
  const homeSpot = useRef({}); // meeting id -> where it sat in the picker before it went up
  const lineRefs = useRef({}); // row id -> its editable element, for the ribbon
  // Every save goes to the account copy in Supabase, and only there.
  const snapshot = (over = {}) => ({ rows, boards, collapsed, title, ...over });
  const persistRows = (next) => {
    setRows(next);
    keepInCloud(snapshot({ rows: next }));
  };
  const saveTitle = (val) => { setTitle(val); keepInCloud(snapshot({ title: val })); };

  // Planning used to live in the browser and was copied up to the account. It now
  // lives in Supabase only. The first browser opened after the change still holds
  // what you last saw, so that copy goes up once, and the account is marked as moved.
  // From then on every browser reads the account copy, and an older copy sitting in
  // another browser is never taken up over it. Nothing is shown or saved until
  // Supabase has answered, so a fresh browser can never write over the page.
  useEffect(() => {
    let savedHere = false;
    try { savedHere = localStorage.getItem(ROWS_KEY) != null; } catch {}
    supabase
      .from("admin_docs")
      .select("data")
      .eq("id", PLAN_KEY)
      .maybeSingle()
      .then(async ({ data, error }) => {
        if (error) {
          setPlanErr(`Could not load Planning, so nothing will be saved: ${error.message}`);
          return;
        }
        const d = data?.data;
        const hasCloud = d && (Array.isArray(d.rows) ? d.rows.length : 0) + Object.keys(d.boards || {}).length > 0;
        const takeBrowser = savedHere && !d?.movedFromBrowser;
        if (takeBrowser) {
          // Both copies are set aside first, each under its own name.
          const now = new Date().toISOString();
          const { error: e } = await supabase.from("admin_docs").upsert([
            ...(d ? [{ id: `${PLAN_KEY}-backup-account-before-move`, data: d, updated_at: now }] : []),
            { id: `${PLAN_KEY}-backup-browser-before-move`, data: { rows, boards, collapsed, title }, updated_at: now },
          ]);
          if (e) {
            setPlanErr(`Could not back up Planning, so nothing will be saved: ${e.message}`);
            return;
          }
          cloudReady.current = true;
          await writePlan({ rows, boards, collapsed, title });
        } else {
          if (hasCloud) {
            // The account copy goes through the same tidy up as ever, so renamed and
            // retired bars follow it; a board added since keeps its starting points.
            if (Array.isArray(d.rows)) setRows(withDailySections(d.rows));
            if (d.boards) setBoards((prev) => ({ ...prev, ...d.boards }));
            if (Array.isArray(d.collapsed)) setCollapsed(d.collapsed);
            if (d.title) setTitle(d.title);
          }
          cloudReady.current = true;
        }
        setPlanReady(true);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
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


  // Every board writes to its own saves; Master keeps the original keys.
  const patchBoard = (b, fields) =>
    setBoards((prev) => {
      const next = { ...prev, [b]: { ...prev[b], ...fields } };
      keepInCloud(snapshot({ boards: next }));
      return next;
    });
  const saveLines = (b, next) => patchBoard(b, { lines: next });
  // One day line open on the whole page: opening one shuts every other board's.
  const openLine = (b, idx) => {
    setBoards((prev) => {
      const next = {};
      for (const k of Object.keys(prev)) next[k] = { ...prev[k], open: k === b ? idx : null };
      keepInCloud(snapshot({ boards: next }));
      return next;
    });
  };
  const saveMeetings = (b, next) => patchBoard(b, { meetings: next });
  const savePoints = (b, next) => patchBoard(b, { points: next });
  const saveNotes = (b, text) => patchBoard(b, { notes: text });
  // The notes ribbon: the browser's own commands, on whatever is selected there.
  // "scratch" is Master's free column, which is kept with the personal order lists.
  const keepNotes = (b, html) => (b === "scratch" ? saveCols({ ...cols, scratch: html }) : saveNotes(b, html));
  const noteCmd = (b, cmd) => {
    const el = noteRefs.current[b];
    if (!el) return;
    el.focus();
    document.execCommand(cmd);
    keepNotes(b, el.innerHTML);
  };
  const noteRed = (b) => {
    const el = noteRefs.current[b];
    if (!el) return;
    el.focus();
    const now = String(document.queryCommandValue("foreColor") || "").replace(/\s/g, "");
    const isRed = now === "rgb(176,30,47)" || now.toLowerCase() === INK_RED.toLowerCase();
    document.execCommand("foreColor", false, isRed ? "#171717" : INK_RED);
    keepNotes(b, el.innerHTML);
  };
  const patchLine = (b, idx, fields) => saveLines(b, boards[b].lines.map((l, i) => (i === idx ? { ...l, ...fields } : l)));

  const toggleTodo = (b, idx, code) => {
    const line = boards[b].lines[idx];
    const has = line.codes.includes(code);
    const fills = { ...(line.fills || {}) };
    const extras = { ...(line.extras || {}) };
    if (has) { delete fills[code]; delete extras[code]; }
    patchLine(b, idx, { codes: has ? line.codes.filter((c) => c !== code) : [...line.codes, code], fills, extras });
  };

  // Picking a meeting moves it onto the line. A one-off also leaves the picker.
  const pickMeeting = (b, idx, m) => {
    const line = boards[b].lines[idx];
    if (line.meetings.some((x) => x.id === m.id)) {
      patchLine(b, idx, { meetings: line.meetings.filter((x) => x.id !== m.id) });
      return;
    }
    patchLine(b, idx, { meetings: [...line.meetings, m] });
    if (!m.permanent) {
      // Remember where it sat, so putting it back lands it in the same place.
      homeSpot.current[m.id] = boards[b].meetings.findIndex((x) => x.id === m.id);
      saveMeetings(b, boards[b].meetings.filter((x) => x.id !== m.id));
    }
  };
  const moveInLine = (b, lineIdx, from, to) => {
    if (from == null || to == null || from === to) return;
    const arr = boards[b].lines[lineIdx].meetings.slice();
    const [moved] = arr.splice(from, 1);
    arr.splice(to, 0, moved);
    patchLine(b, lineIdx, { meetings: arr });
  };
  // Dropping a picker box anywhere on a line adds it to that line.
  const dropOnLine = (b, lineIdx) => {
    if (drag?.from === "pool" && drag.board === b) {
      const m = boards[b].meetings.find((x) => x.id === drag.id);
      if (m && !boards[b].lines[lineIdx].meetings.some((x) => x.id === m.id)) pickMeeting(b, lineIdx, m);
    }
    setDrag(null);
  };
  // Dragging a name off a line and into the picker puts it back in the list.
  const returnToPool = (b) => {
    if (drag?.from === "line" && drag.board === b) {
      const m = boards[b].lines[drag.lineIdx].meetings.find((x) => x.id === drag.id);
      patchLine(b, drag.lineIdx, { meetings: boards[b].lines[drag.lineIdx].meetings.filter((x) => x.id !== drag.id) });
      if (m && !boards[b].meetings.some((x) => x.id === m.id)) saveMeetings(b, [...boards[b].meetings, m]);
    }
    setDrag(null);
  };
  const moveMeeting = (b, from, to) => {
    if (from == null || to == null || from === to) return;
    const next = boards[b].meetings.slice();
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    saveMeetings(b, next);
  };
  // A renamed point carries its new wording onto any line already holding it.
  const renamePoint = (b, g, id, raw) => {
    const code = raw;
    const pts = boards[b].points;
    const old = pts[g].find((p) => p.id === id)?.code;
    savePoints(b, { ...pts, [g]: pts[g].map((p) => (p.id === id ? { ...p, code } : p)) });
    if (old && old !== code) {
      saveLines(b, boards[b].lines.map((l) => ({ ...l, codes: l.codes.map((c) => (c === old ? code : c)) })));
    }
  };
  const removePoint = (b, g, id) => {
    const pts = boards[b].points;
    const gone = pts[g].find((p) => p.id === id)?.code;
    savePoints(b, { ...pts, [g]: pts[g].filter((p) => p.id !== id) });
    if (gone) saveLines(b, boards[b].lines.map((l) => ({ ...l, codes: l.codes.filter((c) => c !== gone) })));
  };
  // A point with stepped-in points under it opens and closes like a little dropdown.
  const togglePointClosed = (b, g, id) =>
    savePoints(b, { ...boards[b].points, [g]: boards[b].points[g].map((p) => (p.id === id ? { ...p, closed: !p.closed } : p)) });
  // The SC point carries its own little dropdown of bullet notes.
  const patchPoint = (b, g, id, fields) =>
    savePoints(b, { ...boards[b].points, [g]: boards[b].points[g].map((p) => (p.id === id ? { ...p, ...fields } : p)) });
  const stepPoint = (b, g, id, d) =>
    savePoints(b, { ...boards[b].points, [g]: boards[b].points[g].map((p) => (p.id === id ? stepLevel(p, d) : p)) });
  const addPoint = (b, g) => {
    const p = { id: newId(), code: "" };
    savePoints(b, { ...boards[b].points, [g]: [...boards[b].points[g], p] });
    setEditing(p.id);
  };
  const movePoint = (b, g, from, to) => {
    if (from == null || to == null || from === to) return;
    const arr = boards[b].points[g].slice();
    const [moved] = arr.splice(from, 1);
    arr.splice(to, 0, moved);
    savePoints(b, { ...boards[b].points, [g]: arr });
  };

  // Renaming reaches the picker copy and every line that already carries it.
  const renameMeeting = (b, id, name) => {
    saveMeetings(b, boards[b].meetings.map((m) => (m.id === id ? { ...m, name } : m)));
    saveLines(b, boards[b].lines.map((l) => ({ ...l, meetings: l.meetings.map((m) => (m.id === id ? { ...m, name } : m)) })));
  };
  const dropMeeting = (b, idx, id) => patchLine(b, idx, { meetings: boards[b].lines[idx].meetings.filter((x) => x.id !== id) });
  // Puts a meeting back in the picker below, into the spot it came from.
  const sendBack = (b, idx, m) => {
    patchLine(b, idx, { meetings: boards[b].lines[idx].meetings.filter((x) => x.id !== m.id) });
    if (!boards[b].meetings.some((x) => x.id === m.id)) {
      const next = boards[b].meetings.slice();
      const spot = homeSpot.current[m.id];
      next.splice(spot == null || spot < 0 ? next.length : Math.min(spot, next.length), 0, m);
      saveMeetings(b, next);
    }
  };
  const addMeeting = (b) => {
    const name = newMeeting.trim();
    if (!name) return;
    saveMeetings(b, [...boards[b].meetings, { id: newId(), name, permanent: newPermanent }]);
    setNewMeeting("");
    setNewPermanent(false);
  };

  // The up arrow on the second line rolls the next day's plan into today.
  const swapLines = (b) => {
    const { lines, open } = boards[b];
    saveLines(b, [lines[1], lines[0]]);
    openLine(b, open === 0 ? 1 : open === 1 ? 0 : open);
    // The ticks in Errands prios and H+F order are kept by line position, so they
    // swap with the lines; otherwise each day would show the other day's ticks.
    if (b === "master") {
      const swapPick = (r) => ({ ...r, picked: undefined, pick: { ...(r.pick || {}), 0: isPicked(r, 1), 1: isPicked(r, 0) } });
      saveCols({ ...cols, ...Object.fromEntries(TWOCOLS.map(([k]) => [k, (cols[k] || []).map(swapPick)])) });
    }
  };

  // The heading a given row sits under, so the Daily routine section can hide its Add bar.
  const headingFor = (i) => { for (let j = i; j >= 0; j--) if (rows[j].type !== "text") return rows[j]; return null; };

  // The Daily bar heads the group; each board heading under it carries its own lines.
  const nameOf = (r) => String(r?.text || "").trim().toUpperCase();
  const isDailyGroup = (r) => !!r && r.type !== "text" && nameOf(r) === DAILY_GROUP.toUpperCase();
  const anchorIdx = rows.findIndex(isDailyGroup);
  const isTodoHeader = (r) => isDailyGroup(r) || !!boardOf(r);

  // Personal order sits under the whole daily family: the Daily bar and the four
  // boards. This is the last row of that run.
  const inDailyFamily = (r) => isTodoHeader(r);
  const personalIdx = (() => {
    let last = -1;
    rows.forEach((r, i) => { if (inDailyFamily(headingFor(i))) last = i; });
    return last;
  })();

  // Codes on a line are split by a small solid gold square rather than a dot.
  // A point ending in empty brackets, like Errandsprios (), takes free text between
  // them on the line itself. Unticking the point clears it again.
  const setFill = (b, idx, code, text) => {
    const line = boards[b].lines[idx];
    patchLine(b, idx, { fills: { ...(line.fills || {}), [code]: text } });
  };
  // Words typed at the very end of a bracket on a Finestate line, after whatever the
  // ticks put there. Kept apart from the ticks' text, so a tick never wipes them.
  const setExtra = (b, idx, code, text) => {
    const line = boards[b].lines[idx];
    patchLine(b, idx, { extras: { ...(line.extras || {}), [code]: text } });
  };
  const renderCodeLine = (b, list, colour, idx) => (
    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0 text-[11px] font-semibold leading-[15px]" style={{ color: colour }}>
      {list.map((c, i) => {
        const fillable = /\(\)$/.test(c);
        const fill = boards[b].lines[idx]?.fills?.[c] || "";
        // SC carries its letters in brackets. On the line they show in red and can be
        // trimmed as each is done; the point below keeps them all, and unticking it
        // brings them back in full next time.
        const trim = hasNotes({ code: c }) && c.match(/^(.*\()([^)]+)\)$/);
        const trimmed = boards[b].lines[idx]?.fills?.[c] ?? (trim ? trim[2] : "");
        return (
          <span key={c} className="inline-flex items-center gap-1.5">
            {trim ? (
              <span className="inline-flex items-center">
                {trim[1]}
                <span onClick={(e) => e.stopPropagation()}>
                  <FillText key={`${b}-${idx}-${c}-trim`} text={trimmed} onChange={(t) => setFill(b, idx, c, t)} />
                </span>
                )
              </span>
            ) : fillable ? (
              // The ticks below fill the brackets. A double click puts the caret at the
              // very end, after them, to type anything else; a single click still just
              // opens the picker.
              <span
                className="inline-flex items-center"
                onDoubleClick={(e) => { e.stopPropagation(); focusEnd(e.currentTarget.querySelector("[contenteditable]")); }}
              >
                {c.slice(0, -1)}
                {/* On the line it always reads in lower case, whatever was typed below. */}
                <span className="whitespace-pre lowercase" style={{ color: "#B01E2F" }}>{fill}</span>
                <span className="lowercase" onClick={(e) => e.stopPropagation()}>
                  <FillText key={`${b}-${idx}-${c}-extra`} text={boards[b].lines[idx]?.extras?.[c] || ""} onChange={(t) => setExtra(b, idx, c, t)} />
                </span>
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

  // Today: the first line of every board, stacked here and working exactly as it does
  // in its own section, pickers and all.
  // `first`: Today opens the table (the Daily bar above it is hidden), so the frame
  // already draws the line over it.
  // A plain text copy of everything in the dropdowns (meetings, points with their
  // notes, the personal lists and the free fields), not the day lines themselves.
  const downloadBackup = () => {
    const out = [];
    const now = new Date();
    const stamp = `${String(now.getDate()).padStart(2, "0")} ${MONTHS[now.getMonth()]} ${now.getFullYear()}`;
    const pad = (x) => "  ".repeat(levelOf(x));
    out.push(`FINESTATE – DAILY DROPDOWNS – ${stamp}`, "");
    BOARDS.forEach(([b, name]) => {
      const board = boards[b];
      if (!board) return;
      out.push("=".repeat(40), name.toUpperCase(), "=".repeat(40));
      if (MEETING_BOARDS.includes(b)) {
        out.push("", "Meetings");
        (board.meetings || []).forEach((m) => out.push(`- ${m.name}${m.permanent ? " (permanent)" : ""}`));
      }
      (b === "master" ? ["core", "rest"] : ["hyper", "core", "rest"]).forEach((g) => {
        const gi = g === "rest" ? 1 : 0;
        const label = g === "hyper" ? "Hyper-prios" : (GROUP_LABELS[b] || [])[gi] || (g === "core" ? "Core points" : "Other points");
        out.push("", label);
        (board.points?.[g] || []).forEach((it) => {
          out.push(`${pad(it)}- ${it.code}`);
          if (it.notes) it.notes.split("\n").forEach((l) => out.push(`${pad(it)}    ${l}`));
        });
      });
      if (!MEETING_BOARDS.includes(b) && board.notes) out.push("", "Notes", htmlToLines(board.notes));
      if (MEETING_BOARDS.includes(b)) {
        TWOCOLS.forEach(([k, label]) => {
          out.push("", label);
          (cols[k] || []).forEach((r) => out.push(`${pad(r)}- ${r.text || ""}`));
        });
        if (cols.scratch) out.push("", "Free field", htmlToLines(cols.scratch));
      }
      out.push("");
    });
    const blob = new Blob([out.join("\r\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Finestate Daily backup ${stamp}.txt`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const renderToday = (first = false) => (
    <>
      <div className={`flex h-[18px] items-center px-2 ${first ? "" : "border-t border-black"}`} style={{ backgroundColor: BAR_BG }}>
        <span className="text-[11px] font-bold uppercase leading-[15px] tracking-[0.06em] text-neutral-900">Today</span>
        <button onClick={downloadBackup} title="Download a backup of the dropdowns" className="ml-auto text-neutral-900 hover:text-[#9c7c33]">
          <Download size={12} strokeWidth={2.5} />
        </button>
      </div>
      {BOARDS.map(([b]) => (
        <div key={b}>{renderTodoLines(b, 0)}</div>
      ))}
    </>
  );

  // A company day line: just the letter codes of the ticked points, dash separated,
  // as in AB-SC-FI-CU. Nothing in brackets shows here; the picker below is unchanged
  // and anything typed in brackets stays saved.
  // The hyper-prios lead, together in one small soft-gold box, same weight as the rest.
  const renderShortLine = (b, codes) => {
    const hyper = new Set((boards[b].points.hyper || []).map((it) => it.code));
    const items = codes.map((c) => ({ c, s: shortCode(c) })).filter((x) => x.s);
    const top = items.filter((x) => hyper.has(x.c)).map((x) => x.s);
    const rest = items.filter((x) => !hyper.has(x.c)).map((x) => x.s);
    return (
      <div className="flex flex-wrap items-center text-[11px] font-semibold leading-[15px] text-neutral-900">
        {top.length > 0 && (
          <span className="inline-flex h-[15px] items-center border border-[#C9A24A] bg-[#FFF3D6] px-[3px] leading-none">{top.join("-")}</span>
        )}
        {top.length > 0 && rest.length > 0 && "-"}
        {rest.join("-")}
      </div>
    );
  };

  // Plain function, not a component: a nested component would remount on every
  // keystroke and throw the caret to the end of the field.
  // `only` picks one of the two day lines: 0 is today, 1 is the day being planned.
  const renderTodoLines = (b, only) => (
    // Today's lines sit on the faint pink wash; the day being planned stays white.
    <div className="border-t border-black" style={{ backgroundColor: only === 0 ? DAY_BG : "#FFFFFF" }}>
      {boards[b].lines.map((line, idx) => {
        if (only != null && idx !== only) return null;
        const open = boards[b].open === idx;
        const { meetings, points } = boards[b];
        // Selected points keep their group on the line: meetings, core codes, then the rest.
        const coreCodes = [...(points.hyper || []), ...points.core].filter((it) => line.codes.includes(it.code)).map((it) => it.code);
        const restCodes = points.rest.filter((it) => line.codes.includes(it.code)).map((it) => it.code);
        return (
          // A heavy rule between today and the next day, so the two never blur.
          // Only the pair needs a rule between them; a single line already sits under
          // the wrapper's own line.
          <div key={idx} className={idx === 0 || only != null ? "" : "border-t border-black"}>
            {/* The whole line is the toggle – no chevron. */}
            <div
              onClick={() => openLine(b, open ? null : idx)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => dropOnLine(b, idx)}
              title="Choose to-dos"
              className="flex min-h-[21px] cursor-pointer items-start hover:brightness-[0.98]"
            >
              {/* Meetings lead, the core codes sit under them, then the long list. */}
              <div className="flex flex-1 flex-col gap-0 px-2 py-[3px]">
                {line.meetings.length > 0 && (
                  <div className="order-1 flex flex-wrap items-center gap-x-2 gap-y-0 leading-[15px]">
                    {line.meetings.map((m, mi) => (
                      <span
                        key={m.id}
                        draggable={editing !== m.id}
                        onDoubleClick={(e) => { e.stopPropagation(); setEditing(m.id); }}
                        onDragStart={(e) => { e.stopPropagation(); setDrag({ from: "line", board: b, lineIdx: idx, index: mi, id: m.id }); }}
                        onDragEnd={() => setDrag(null)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.stopPropagation();
                          if (drag?.from === "line" && drag.board === b && drag.lineIdx === idx) moveInLine(b, idx, drag.index, mi);
                          else dropOnLine(b, idx);
                          setDrag(null);
                        }}
                        className={`inline-flex cursor-grab items-center gap-0 text-[11px] font-semibold leading-[15px] text-neutral-900 active:cursor-grabbing ${drag?.from === "line" && drag.lineIdx === idx && drag.index === mi ? "opacity-40" : ""}`}
                      >
                        {/* Plain text until double clicked, so the bin sits right after the words. */}
                        {editing === m.id ? (
                          <input
                            ref={(el) => { if (el && document.activeElement !== el) el.focus(); }}
                            value={m.name}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => renameMeeting(b, m.id, e.target.value)}
                            onBlur={() => setEditing(null)}
                            style={{ width: `${Math.max(2, m.name.length)}ch` }}
                            className="bg-transparent text-[11px] leading-[15px] outline-none"
                          />
                        ) : (
                          <span className="mr-[3px] leading-[15px]">{m.name}</span>
                        )}
                        {/* The marks on a meeting share one burgundy. */}
                        <Calendar size={10} className="shrink-0" style={{ color: MEETING_ICON }} />
                        {/* Send it back down to the picker, still draggable for order. */}
                        <button
                          onClick={(e) => { e.stopPropagation(); sendBack(b, idx, m); }}
                          title="Put this back in the list below"
                          style={{ color: MEETING_ICON }}
                          className="flex shrink-0 items-center self-center leading-none transition-opacity hover:opacity-70"
                        >
                          <ChevronDown size={10} strokeWidth={3} />
                        </button>
                        <GripVertical size={10} className="shrink-0 cursor-grab" style={{ color: MEETING_ICON }} />
                        <button
                          onClick={(e) => { e.stopPropagation(); ask(() => dropMeeting(b, idx, m.id)); }}
                          title="Remove"
                          style={{ color: MEETING_ICON }}
                          className="flex shrink-0 items-center self-center leading-none transition-opacity hover:opacity-70"
                        >
                          <Trash2 size={10} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                {line.meetings.length === 0 && coreCodes.length === 0 && restCodes.length === 0 && (
                  <span style={{ color: MEETING_ICON }} className="inline-flex items-center text-[11px] font-semibold leading-[15px]">
                    {BOARD_TAGS[b]}
                  </span>
                )}
                {/* Finestate spells its points out in full; a company board shows only
                    the letter codes. */}
                {MEETING_BOARDS.includes(b) ? (
                  <>
                    <div className="order-2">{coreCodes.length > 0 && renderCodeLine(b, coreCodes, "#171717", idx)}</div>
                    <div className="order-3">{restCodes.length > 0 && renderCodeLine(b, restCodes, "#171717", idx)}</div>
                  </>
                ) : (
                  (coreCodes.length > 0 || restCodes.length > 0) &&
                    renderShortLine(b, [...coreCodes, ...restCodes])
                )}
              </div>

              {idx === 1 && (
                <button
                  onClick={(e) => { e.stopPropagation(); swapLines(b); }}
                  title="Make this today"
                  className="shrink-0 px-2 py-0.5 text-neutral-400 hover:text-[#9c7c33]"
                >
                  <ChevronUp size={14} />
                </button>
              )}
            </div>

            {open && (
              // Master carries a meetings column as well; the company boards are just
              // their two point columns.
              // No background of its own, so an open picker keeps the board's colour.
              // Master: core, meetings, the long list. A company board: prios,
              // non-prios and its department notes.
              <div className="grid grid-cols-3 items-start gap-1.5 border-t border-[#C1440E] px-2 py-1.5">
                {MEETING_BOARDS.includes(b) && (
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => { if (drag?.from === "pool") dropPoolMeeting(b); else returnToPool(b); }}
                  onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDropM(null); }}
                  // Meetings come first, on the left; the core codes sit in the middle.
                  className="order-1 flex flex-col gap-1 self-stretch border-[3px] border-[#C1440E] p-1.5"
                >
                  {meetings.map((m, mi) => (
                    <div key={m.id}>
                    {/* A red marker shows exactly where the meeting will land. */}
                    {drag?.from === "pool" && drag.board === b && dropM?.board === b && dropM.index === mi && (
                      <div className="mb-1 h-[2px] w-full bg-[#C1440E]" />
                    )}
                    <div
                      onDoubleClick={() => setEditing(m.id)}
                      onDragOver={(e) => {
                        e.preventDefault();
                        const box = e.currentTarget.getBoundingClientRect();
                        setDropM({ board: b, index: e.clientY < box.top + box.height / 2 ? mi : mi + 1 });
                      }}
                      onDrop={(e) => { e.stopPropagation(); dropPoolMeeting(b); }}
                      className={`flex w-full items-center gap-1.5 rounded border bg-white px-1.5 py-0.5 text-[11px] font-semibold text-neutral-700 hover:text-neutral-900 ${m.permanent ? "border-[#C1440E]" : "border-neutral-300 hover:border-neutral-400"} ${drag?.from === "pool" && drag.board === b && drag.index === mi ? "opacity-40" : ""}`}
                    >
                      <input
                        ref={(el) => { if (el && editing === m.id && document.activeElement !== el) el.focus(); }}
                        value={m.name}
                        readOnly={editing !== m.id}
                        onChange={(e) => renameMeeting(b, m.id, e.target.value)}
                        onBlur={() => setEditing(null)}
                        className={`min-w-0 flex-1 bg-transparent leading-[15px] outline-none ${editing === m.id ? "" : "pointer-events-none"}`}
                      />
                      {/* Click to put it on the line above. A one off leaves this list,
                          a permanent one stays here. */}
                      <button
                        onClick={() => pickMeeting(b, idx, m)}
                        title="Put this on the line above"
                        style={{ color: MEETING_ICON }}
                        className="flex h-[15px] shrink-0 items-center transition-opacity hover:opacity-70"
                      >
                        <ChevronUp size={11} strokeWidth={3} />
                      </button>
                      {/* The box holds a text field, so dragging starts from the handle. */}
                      <span
                        draggable
                        onDragStart={() => setDrag({ from: "pool", board: b, index: mi, id: m.id })}
                        onDragEnd={() => { setDrag(null); setDropM(null); }}
                        title="Drag to move"
                        className="flex h-[15px] shrink-0 cursor-grab items-center text-neutral-400 active:cursor-grabbing"
                      >
                        <GripVertical size={11} />
                      </span>
                      <button
                        onClick={() => ask(() => saveMeetings(b, meetings.filter((x) => x.id !== m.id)))}
                        title="Remove this meeting"
                        className="flex h-[15px] shrink-0 items-center text-neutral-900 hover:text-[#C1440E]"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                    </div>
                  ))}
                  {drag?.from === "pool" && drag.board === b && dropM?.board === b && dropM.index === meetings.length && (
                    <div className="h-[2px] w-full bg-[#C1440E]" />
                  )}

                  {/* The add sits on the floor of the column, right under the last box. */}
                  {adding ? (
                    <span className="mt-auto flex w-full items-center gap-1.5 rounded border border-neutral-400 bg-white px-1.5 py-0.5">
                      <input
                        autoFocus
                        value={newMeeting}
                        onChange={(e) => setNewMeeting(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") { addMeeting(b); setAdding(false); }
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
                      <button onClick={() => { addMeeting(b); setAdding(false); }} title="Save" className="shrink-0 text-[#9c7c33] hover:opacity-70">
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
                )}

                {["core", "rest"].map((col, gi) => (
                  <div key={col} className={`${col === "core" ? "order-2" : "order-3"} self-stretch border-[3px] border-[#C1440E] p-1.5`}>
                    <div
                      className="flex h-full flex-col gap-1"
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => dropPoint(b)}
                      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDropP(null); }}
                    >
                      {(GROUP_LABELS[b] || [])[gi] && !(col === "core" && b !== "master") && (
                        <p className="text-[11px] font-bold uppercase leading-[15px] tracking-[0.06em] text-neutral-500">{GROUP_LABELS[b][gi]}:</p>
                      )}
                      {/* A company board's Prios column holds two groups: Hyper-prios on top, then the
                          regular ones; points are dragged between them. */}
                      {(col === "core" && b !== "master" ? ["hyper", "core"] : [col]).map((g) => {
                        const list = points[g] || [];
                        return (
                      <Fragment key={g}>
                      {col === "core" && b !== "master" && (
                        <p className="text-[11px] font-bold uppercase leading-[15px] tracking-[0.06em] text-neutral-500">{g === "hyper" ? "Hyper-prios:" : "Regular prios:"}</p>
                      )}
                      {/* An empty group still takes a dragged point. */}
                      {list.length === 0 && (
                        <div
                          onDragOver={(e) => { e.preventDefault(); setDropP({ board: b, group: g, index: 0 }); }}
                          onDrop={(e) => { e.stopPropagation(); dropPoint(b); }}
                          className={`h-[19px] rounded border border-dashed ${dragP?.board === b && dropP?.board === b && dropP.group === g ? "border-[#C1440E]" : "border-neutral-300"}`}
                        />
                      )}
                      {list.map((it, pi) => hiddenRows(list).has(it.id) ? null : (
                        <div key={it.id}>
                        {/* A red marker shows exactly where the point will land. */}
                        {dragP?.board === b && dropP?.board === b && dropP.group === g && dropP.index === pi && (
                          <div className="mb-1 h-[2px] w-full bg-[#C1440E]" />
                        )}
                        <div
                          onDoubleClick={() => setEditing(it.id)}
                          // A group head opens and closes with a click anywhere on its line.
                          onClick={(e) => {
                            if (!isHead(list, pi) || editing === it.id) return;
                            if (e.target.closest("button, input[type=checkbox], [draggable]")) return;
                            togglePointClosed(b, g, it.id);
                          }}
                          onDragOver={(e) => {
                            e.preventDefault();
                            const box = e.currentTarget.getBoundingClientRect();
                            setDropP({ board: b, group: g, index: e.clientY < box.top + box.height / 2 ? pi : pi + 1 });
                          }}
                          onDrop={(e) => { e.stopPropagation(); dropPoint(b); }}
                          // A stepped in point is the same box, shifted from the left, a step at a time.
                          style={levelOf(it) ? { marginLeft: `${20 * levelOf(it)}px` } : undefined}
                          className={`flex items-center gap-1.5 rounded border border-neutral-300 bg-white px-1.5 py-0.5 text-[11px] font-semibold text-neutral-700 hover:border-neutral-400 hover:text-neutral-900 ${dragP?.group === g && dragP.board === b && dragP.index === pi ? "opacity-40" : ""}`}
                        >
                          {/* A group head opens and closes at a click; other points keep the space. */}
                          <span className="flex h-[15px] w-[11px] shrink-0 items-center">
                            {hasNotes(it) && !isHead(list, pi) && (
                              <button onClick={() => patchPoint(b, g, it.id, { notesOpen: !it.notesOpen })} title={it.notesOpen ? "Close" : "Open"} className="flex items-center text-neutral-900 hover:text-[#C1440E]">
                                {it.notesOpen ? <ChevronDown size={11} strokeWidth={2.75} /> : <ChevronRight size={11} strokeWidth={2.75} />}
                              </button>
                            )}
                            {isHead(list, pi) && (
                              <button onClick={() => togglePointClosed(b, g, it.id)} title={it.closed ? "Open" : "Close"} className="flex items-center text-neutral-900 hover:text-[#C1440E]">
                                {it.closed ? <ChevronRight size={11} strokeWidth={2.75} /> : <ChevronDown size={11} strokeWidth={2.75} />}
                              </button>
                            )}
                          </span>
                          {/* Boxed to the line height so it sits dead centre on the words. */}
                          <span className="flex h-[15px] shrink-0 items-center">
                            <input
                              type="checkbox"
                              checked={line.codes.includes(it.code)}
                              onChange={() => toggleTodo(b, idx, it.code)}
                              className="block h-3 w-3 cursor-pointer"
                              style={{ accentColor: GOLD, margin: 0 }}
                            />
                          </span>
                          <input
                            ref={(el) => { if (el && editing === it.id && document.activeElement !== el) el.focus(); }}
                            value={it.code}
                            readOnly={editing !== it.id}
                            onChange={(e) => renamePoint(b, g, it.id, e.target.value)}
                            onBlur={() => setEditing(null)}
                            className={`min-w-0 flex-1 bg-transparent leading-[15px] outline-none ${editing === it.id ? "" : "pointer-events-none"}`}
                          />
                          {/* Both ways always there: each press is one step, up to four in. */}
                          <button onClick={() => stepPoint(b, g, it.id, -1)} title="Step out" className="flex h-[15px] shrink-0 items-center text-neutral-400 hover:text-neutral-900">
                            <ChevronsLeft size={11} />
                          </button>
                          <button onClick={() => stepPoint(b, g, it.id, 1)} title="Step in" className="flex h-[15px] shrink-0 items-center text-neutral-400 hover:text-neutral-900">
                            <ChevronsRight size={11} />
                          </button>
                          {/* The box holds a text field, so dragging starts from the handle. */}
                          <span
                            draggable
                            onDragStart={() => setDragP({ board: b, group: g, index: pi })}
                            onDragEnd={() => { setDragP(null); setDropP(null); }}
                            title="Drag to move"
                            className="flex h-[15px] shrink-0 cursor-grab items-center text-neutral-400 active:cursor-grabbing"
                          >
                            <GripVertical size={11} />
                          </span>
                          <button
                            onClick={() => ask(() => removePoint(b, g, it.id))}
                            title="Remove this point"
                            className="flex h-[15px] shrink-0 items-center text-neutral-900 hover:text-[#C1440E]"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                        {hasNotes(it) && it.notesOpen && (
                          <div className="mt-1" style={levelOf(it) ? { marginLeft: `${20 * levelOf(it)}px` } : undefined}>
                            <BulletBox value={it.notes || ""} onChange={(t) => patchPoint(b, g, it.id, { notes: t })} />
                          </div>
                        )}
                        </div>
                      ))}
                      {dragP?.board === b && dropP?.board === b && dropP.group === g && list.length > 0 && dropP.index === list.length && (
                        <div className="h-[2px] w-full bg-[#C1440E]" />
                      )}
                      </Fragment>
                        );
                      })}

                      {/* Both groups take new points straight from here, on the floor of the column. */}
                      <button
                        onClick={() => addPoint(b, col)}
                        title="Add a point"
                        className="mt-auto flex h-[19px] w-full items-center justify-center rounded border border-neutral-300 bg-white px-1.5 text-[#9c7c33] hover:border-neutral-400 hover:opacity-70"
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                  </div>
                ))}
                {/* Master's personal lists sit at the very bottom of the open picker. */}
                {MEETING_BOARDS.includes(b) && renderTwoCols(idx)}
                {/* A company board closes with its department notes instead. */}
                {!MEETING_BOARDS.includes(b) && (
                  <div className="order-3 flex flex-col self-stretch border-[3px] border-[#C1440E] p-1.5">
                    {/* The tools sit in their own strip across the top of the field. */}
                    <div className="mb-1.5 flex items-center gap-1 border-b border-[#C1440E] pb-1">
                      {/* The same ribbon as the table rows, acting on these notes. */}
                      <button onMouseDown={(e) => e.preventDefault()} onClick={() => noteCmd(b, "bold")} title="Bold the highlighted words" className="flex h-4 w-4 items-center justify-center text-neutral-900 hover:text-[#9c7c33]">
                        <span className="text-[13px] font-black leading-none tracking-tight">B</span>
                      </button>
                      <button onMouseDown={(e) => e.preventDefault()} onClick={() => noteRed(b)} title="Switch the highlighted words between red and black" className="flex h-4 w-4 items-center justify-center">
                        <span className="block h-3 w-3" style={{ background: `linear-gradient(135deg, ${INK_RED} 50%, #171717 50%)` }} />
                      </button>
                      <button onMouseDown={(e) => e.preventDefault()} onClick={() => noteCmd(b, "insertUnorderedList")} title="Bullet the selected lines" className="flex h-4 w-4 items-center justify-center text-neutral-900 hover:text-[#9c7c33]"><List size={14} strokeWidth={2.75} /></button>
                      <button onMouseDown={(e) => e.preventDefault()} onClick={() => noteCmd(b, "outdent")} title="Decrease indent" className="flex h-4 w-4 items-center justify-center text-neutral-900 hover:text-[#9c7c33]"><ChevronsLeft size={14} strokeWidth={2.75} /></button>
                      <button onMouseDown={(e) => e.preventDefault()} onClick={() => noteCmd(b, "indent")} title="Increase indent" className="flex h-4 w-4 items-center justify-center text-neutral-900 hover:text-[#9c7c33]"><ChevronsRight size={14} strokeWidth={2.75} /></button>
                    </div>
                    <RichLine
                      key={`notes-${b}`}
                      html={boards[b].notes || ""}
                      innerRef={(el) => { noteRefs.current[b] = el; }}
                      onInput={(html) => saveNotes(b, html)}
                      // Empty, it is one line tall and grows as you type.
                      className="rich-line block min-h-[15px] w-full whitespace-pre-wrap break-words text-[11px] font-semibold leading-[15px] text-neutral-700 outline-none"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  // Errands quicks, prios and H+F order: the same three columns as the picker above,
  // sitting at the foot of Master's open day line.
  const renderTwoCols = (lineIdx) => (
    <>
      <div className="order-4 col-span-3 grid grid-cols-3 items-start gap-1.5">
        {TWOCOLS.map(([k, label]) => { const hidden = hiddenRows(cols[k]); return (
          // TEMPORARY: reminder-red turns all text in these two columns red, as a note
          // that they still need finishing. Remove the class to put them back.
          <div key={k} className="reminder-red flex flex-col self-stretch border-[3px] border-[#C1440E] p-1.5">
            <p className="mb-1 text-[11px] font-bold uppercase leading-[15px] tracking-[0.06em] text-neutral-900">{label}</p>
            <div
              className="flex flex-1 flex-col gap-1"
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => dropColRow(k)}
              onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDropAt(null); }}
            >
              {cols[k].map((r, i) => hidden.has(r.id) ? null : (
                <div key={r.id}>
                {/* A red marker shows exactly where the line will land. */}
                {dragC?.col === k && dropAt?.col === k && dropAt.index === i && (
                  <div className="mb-1 h-[2px] w-full bg-[#C1440E]" />
                )}
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    const box = e.currentTarget.getBoundingClientRect();
                    const before = e.clientY < box.top + box.height / 2;
                    setDropAt({ col: k, index: before ? i : i + 1 });
                  }}
                  onDrop={(e) => { e.stopPropagation(); dropColRow(k); }}
                  // A sub line is the same row, stepped in from the left, a step at a time.
                  style={levelOf(r) ? { marginLeft: `${20 * levelOf(r)}px` } : undefined}
                  className={`flex items-start gap-1.5 rounded border border-neutral-300 bg-white px-1.5 py-0.5 text-[11px] font-semibold text-neutral-700 hover:border-neutral-400 hover:text-neutral-900 ${dragC?.col === k && dragC.index === i ? "opacity-40" : ""}`}
                >
                  {/* A group head opens and closes at a click; other lines keep the space. */}
                  <span className="flex h-[15px] w-[11px] shrink-0 items-center">
                    {isHead(cols[k], i) && (
                      <button onClick={() => toggleColClosed(k, r.id)} title={r.closed ? "Open" : "Close"} className="flex items-center text-neutral-900 hover:text-[#C1440E]">
                        {r.closed ? <ChevronRight size={11} strokeWidth={2.75} /> : <ChevronDown size={11} strokeWidth={2.75} />}
                      </button>
                    )}
                  </span>
                  {/* Boxed to the exact line height, so it sits dead centre on the first line. */}
                  <span className="flex h-[15px] shrink-0 items-center">
                    <input
                      type="checkbox"
                      checked={isPicked(r, lineIdx)}
                      onChange={() => toggleColPick(k, r.id, lineIdx)}
                      title="Send to Errandsprios"
                      className="block h-[11px] w-[11px] cursor-pointer"
                      style={{ accentColor: "#C1440E", margin: 0 }}
                    />
                  </span>
                  {/* On a group head the words stay editable, and the space after them opens
                      and closes the group. */}
                  <WrapLine
                    key={r.id}
                    text={r.text}
                    onChange={(t) => setColRow(k, r.id, t)}
                    className={`min-w-0 ${isHead(cols[k], i) ? "max-w-full" : "flex-1"} whitespace-pre-wrap break-words bg-transparent leading-[15px] outline-none`}
                  />
                  {isHead(cols[k], i) && (
                    <span onClick={() => toggleColClosed(k, r.id)} title={r.closed ? "Open" : "Close"} className="h-[15px] min-w-[8px] flex-1 cursor-pointer" />
                  )}
                  {/* Both ways always there: each press is one step, up to four in. */}
                  <button onClick={() => stepColRow(k, r.id, -1)} title="Step out" className="flex h-[15px] shrink-0 items-center text-neutral-400 hover:text-neutral-900">
                    <ChevronsLeft size={11} />
                  </button>
                  <button onClick={() => stepColRow(k, r.id, 1)} title="Step in" className="flex h-[15px] shrink-0 items-center text-neutral-400 hover:text-neutral-900">
                    <ChevronsRight size={11} />
                  </button>
                  {/* The line is typed in, so dragging starts from the handle only. */}
                  <span
                    draggable
                    onDragStart={() => setDragC({ col: k, index: i })}
                    onDragEnd={() => { setDragC(null); setDropAt(null); }}
                    title="Drag to move"
                    className="flex h-[15px] shrink-0 cursor-grab items-center text-neutral-400 active:cursor-grabbing"
                  >
                    <GripVertical size={11} />
                  </span>
                  <button onClick={() => ask(() => removeColRow(k, r.id))} title="Remove this line" className="flex h-[15px] shrink-0 items-center text-neutral-900 hover:text-[#C1440E]">
                    <Trash2 size={11} />
                  </button>
                </div>
                </div>
              ))}
              {dragC?.col === k && dropAt?.col === k && dropAt.index === cols[k].length && (
                <div className="h-[2px] w-full bg-[#C1440E]" />
              )}
              {/* One add on the floor of the column; indent is set on the line itself. */}
              <button
                onClick={() => { addColRow(k, false); setFlash(k); setTimeout(() => setFlash((f) => (f === k ? null : f)), 400); }}
                title="Add a line"
                // It flashes red for a moment so you can see the line went in.
                className={`mt-auto flex h-[19px] w-full items-center justify-center rounded border px-1.5 transition-colors ${
                  flash === k
                    ? "border-[#C1440E] bg-[#C1440E] text-white"
                    : "border-neutral-300 bg-white text-[#9c7c33] hover:border-neutral-400 hover:opacity-70"
                }`}
              >
                <Plus size={12} />
              </button>
            </div>
          </div>
        ); })}
        {/* Third column: a free field, no lines and no tick boxes, just text. */}
        <div className="flex flex-col self-stretch border-[3px] border-[#C1440E] p-1.5">
          <div className="mb-1.5 flex items-center gap-1 border-b border-[#C1440E] pb-1">
            <button onMouseDown={(e) => e.preventDefault()} onClick={() => noteCmd("scratch", "bold")} title="Bold the highlighted words" className="flex h-4 w-4 items-center justify-center text-neutral-900 hover:text-[#9c7c33]">
              <span className="text-[13px] font-black leading-none tracking-tight">B</span>
            </button>
            <button onMouseDown={(e) => e.preventDefault()} onClick={() => noteRed("scratch")} title="Switch the highlighted words between red and black" className="flex h-4 w-4 items-center justify-center">
              <span className="block h-3 w-3" style={{ background: `linear-gradient(135deg, ${INK_RED} 50%, #171717 50%)` }} />
            </button>
            <button onMouseDown={(e) => e.preventDefault()} onClick={() => noteCmd("scratch", "insertUnorderedList")} title="Bullet the selected lines" className="flex h-4 w-4 items-center justify-center text-neutral-900 hover:text-[#9c7c33]"><List size={14} strokeWidth={2.75} /></button>
            <button onMouseDown={(e) => e.preventDefault()} onClick={() => noteCmd("scratch", "outdent")} title="Decrease indent" className="flex h-4 w-4 items-center justify-center text-neutral-900 hover:text-[#9c7c33]"><ChevronsLeft size={14} strokeWidth={2.75} /></button>
            <button onMouseDown={(e) => e.preventDefault()} onClick={() => noteCmd("scratch", "indent")} title="Increase indent" className="flex h-4 w-4 items-center justify-center text-neutral-900 hover:text-[#9c7c33]"><ChevronsRight size={14} strokeWidth={2.75} /></button>
          </div>
          <RichLine
            html={cols.scratch || ""}
            innerRef={(el) => { noteRefs.current.scratch = el; }}
            onInput={(html) => saveCols({ ...cols, scratch: html })}
            className="rich-line block min-h-[30px] w-full flex-1 whitespace-pre-wrap break-words text-[11px] font-semibold leading-[15px] text-neutral-700 outline-none"
          />
        </div>
      </div>
    </>
  );

  const toggleCollapse = (id) => {
    const wasClosed = collapsed.includes(id);
    // Only one section of a kind stays open: opening one folds its peers away.
    const peers = rows.filter((r) => r.id !== id && r.type === (rows.find((x) => x.id === id) || {}).type && collapsible(r)).map((r) => r.id);
    const next = wasClosed
      ? [...collapsed.filter((x) => x !== id && !peers.includes(x)), ...peers]
      : [...collapsed, id];
    setCollapsed(next);
    keepInCloud(snapshot({ collapsed: next }));
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
      <div className="flex h-[21px] items-center gap-3 border-t border-black bg-neutral-50 px-2">
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
    <div className="flex h-[21px] items-center gap-4 border-t border-black bg-neutral-50 px-2 text-[11px] font-bold uppercase leading-none tracking-wide">
      {opts.map(([lbl, type]) => (
        <button key={type} onClick={() => insertAt(at, type)} className="transition-opacity hover:opacity-70" style={{ color: "#C1440E" }}>{lbl}</button>
      ))}
      <button onClick={() => setAddMenu(null)} className="transition-opacity hover:opacity-70" style={{ color: "#C1440E" }}>Cancel</button>
    </div>
  );

  // Nothing is drawn until the account copy is in, so nothing can be typed over it.
  const planNote = planErr && <p className="pb-2 text-[11px] font-semibold text-[#C1440E]">{planErr}</p>;
  if (!planReady) return <div className="w-full">{planNote || <p className="text-[11px] text-neutral-400">Loading…</p>}</div>;

  return (
    <div className="w-full">
      {planNote}
      <div spellCheck={false} className="w-full border border-black shadow-sm overflow-hidden bg-white">
        {/* With no Daily bar to hang under, the master checklist sits up here. */}
        {anchorIdx < 0 && renderTodoLines("master")}

        <div>
          {rows.map((r, i) => {
            if (hidden[i]) return null;
            // Board headings sit one shade below the Daily bar; any other heading is
            // a plain white row of notes, like Personal order.
            const board = boardOf(r);
            const dailyHead = isTodoHeader(r);
            const plainHead = r.type !== "text" && !dailyHead;
            // Prep, the master board, takes the top orange like Today; other boards one shade down.
            const bg = r.type === "text" || plainHead ? "#fff" : board && board !== "master" ? HEADER_BG : BAR_BG;
            // The heading the checklist hangs under is locked: no typing, no bin, no dragging.
            const locked = isTodoHeader(r);
            const field = locked ? (
              <span className="flex-1 text-[11px] font-bold uppercase leading-[15px] tracking-[0.06em] text-neutral-900">{r.text}</span>
            ) : r.type === "text" ? (
              // One block, formatted line by line exactly as a Word document would be.
              // min-w-0 lets the words wrap instead of the row pushing past the table.
              <div className="flex min-w-0 flex-1 items-start gap-1">
                <RichLine
                  html={r.html ?? escapeHtml(r.text)}
                  innerRef={(el) => { lineRefs.current[r.id] = el; }}
                  onFocus={() => setActiveRow(r.id)}
                  onInput={(html) => updateHtml(i, html)}
                  className="rich-line min-h-[15px] min-w-0 flex-1 whitespace-pre-wrap break-words bg-transparent py-0 text-[11px] leading-[15px] text-neutral-900 outline-none"
                />
              </div>
            ) : collapsible(r) && /^department ?notes$/i.test(nameOf(r)) ? (
              // Department notes is a fixed heading: click to fold, but never retyped.
              <span className="flex flex-1 items-center gap-1 text-[11px] font-semibold leading-[15px] text-neutral-900">
                {r.text}
              </span>
            ) : collapsible(r) ? (
              // Headings fold away on a click of the words themselves, no chevron.
              <span className="flex flex-1 items-center gap-1">
                <input
                  value={r.text}
                  onChange={(e) => update(i, e.target.value)}
                  onClick={() => plainHead && toggleCollapse(r.id)}
                  title={collapsed.includes(r.id) ? "Open" : "Close"}
                  style={{ width: `${(r.text || "").length * 1.15 + 1}ch` }}
                  className={`cursor-pointer bg-transparent py-0 text-[11px] leading-[15px] text-neutral-900 outline-none ${plainHead ? "font-semibold" : "font-bold uppercase tracking-[0.06em]"}`}
                />
                {!plainHead && (
                  <button onClick={() => toggleCollapse(r.id)} title={collapsed.includes(r.id) ? "Open" : "Close"} className="flex h-[15px] items-center text-neutral-900 hover:text-[#9c7c33]">
                    <ChevronDown size={12} className={`block transition-transform ${collapsed.includes(r.id) ? "-rotate-90" : ""}`} />
                  </button>
                )}
              </span>
            ) : (
              <input value={r.text} onChange={(e) => update(i, e.target.value)} className="flex-1 bg-transparent py-0 text-[11px] font-bold uppercase leading-[15px] tracking-[0.06em] text-neutral-900 outline-none" />
            );
            // Hairline separators either side of a header – enough to group a section
            // without the bar turning into a thick band.
            const isHead = r.type !== "text";
            const prevHeader = i > 0 && rows[i - 1].type !== "text";
            // Exactly one line between any two bands: each band draws its own top rule
            // only. The daily block is framed in red, the rest of the table in black.
            const topBorder = i === 0 ? "" : "border-t border-black";
            const botBorder = "";
            // A section ends where the next header starts, or at the foot of the table.
            const sectionEnd =
              (i === rows.length - 1 || rows[i + 1].type !== "text") && !isTodoHeader(headingFor(i) || {});
            // The Daily bar itself is not shown; Today, which hangs under it, opens the table.
            if (isDailyGroup(r)) return <div key={r.id}>{renderToday(i === 0)}</div>;
            return (
              <div key={r.id}>
                <div
                  onClick={plainHead ? () => toggleCollapse(r.id) : undefined}
                  title={plainHead ? (collapsed.includes(r.id) ? "Open" : "Close") : undefined}
                  className={`group relative flex gap-2 ${topBorder} ${botBorder} px-2 ${plainHead ? "cursor-pointer" : ""} ${isHead ? `${plainHead ? "h-[21px]" : "h-[18px]"} items-center py-0` : "min-h-[21px] items-start py-[3px]"}`}
                  style={{ backgroundColor: bg }}
                >
                  {field}
                  {/* A plain heading like Sortingnotes stays put: no move, no bin. */}
                  {!locked && !plainHead && (
                    <div className="flex shrink-0 items-center gap-1 leading-none">
                      <button onClick={() => moveRow(i, -1)} disabled={i === 0} title="Move up" className="text-neutral-900 hover:text-[#9c7c33] disabled:opacity-25"><ChevronUp size={12} /></button>
                      <button onClick={() => moveRow(i, 1)} disabled={i === rows.length - 1} title="Move down" className="text-neutral-900 hover:text-[#9c7c33] disabled:opacity-25"><ChevronDown size={12} /></button>
                      <button onClick={() => ask(() => remove(i))} title="Delete" className="text-neutral-900 hover:text-[#C1440E]"><Trash2 size={12} /></button>
                    </div>
                  )}
                </div>
                {/* Notes areas are plain black text, so they carry no ribbon. */}
                {isHead && !locked && !plainHead && !collapsed.includes(r.id) && renderRibbon(i)}
                {/* Straight under the Daily bar: today's line from every board. */}
                {isDailyGroup(r) && renderToday()}
                {/* A board section then carries the day being planned. */}
                {board === "master" && BOARDS.map(([b]) => <div key={b}>{renderTodoLines(b, 1)}</div>)}
                {addMenu === i && <TypeMenu at={i + 1} opts={SECTION_TYPES} />}
              </div>
            );
          })}
          {rows.length === 0 && <p className="px-2 py-2 text-[11px] italic text-neutral-400">Empty. Use Add below to start.</p>}
        </div>

        {/* The table's shape is fixed now, so there is no Add at the foot. */}

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
