import { Fragment, useEffect, useRef, useState } from "react";
import { Plus, Trash2, ChevronDown, SquarePen, ExternalLink, List, GripVertical } from "lucide-react";
import { supabase } from "./lib/supabaseClient.js";

// Health and wellbeing, lifted from the HE tab of the planning workbook. It holds
// medical history, membership numbers and private links, so it lives in Supabase
// and never in this public repo.
const DOC_ID = "hw";
const NOTES_ID = "hw-notes"; // the new table, being rebuilt section by section
// The meals of the day, one row each in Nutrition.
const MEALS = ["Meal 1", "Meal 2", "Meal 3", "Meal 4"];
// The three parts of Nutrition, left to right, in equal columns. The saved keys stay
// as they were, so anything already written keeps its column.
const NUTRITION_PARTS = [
  ["weekdays", "Sun+Mon+Tue+Thu+Fri"],
  ["saturday", "Wed+Sat"],
  ["considerations", "Considerations"],
];
const BAR_BG = "#F2C46D";   // section bars
const HEADER_BG = "#FFE4B3"; // column headings inside a section
const GOLD = "#9c7c33";
const GAP_BG = "#8A8A8A"; // the grey band, as on the Monthly page

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
  // The new table: its entries, each a title that opens onto notes. Kept in Supabase.
  const [noteConfirm, setNoteConfirm] = useState(null); // entry waiting on Delete or Cancel
  const [notes, setNotes] = useState([]);
  // Name-and-details lists, by key: medicines, supplements.
  const [lists, setLists] = useState({ medicines: [], supplements: [], fitness: [], monitoring: [], diagnostics: [], procedures: [], vaccinations: [] });
  // Nutrition: three notes side by side, by key.
  const [nutrition, setNutrition] = useState({ meals: {} });
  const [listConfirm, setListConfirm] = useState(null); // { key, id } waiting on Delete or Cancel
  const [editingLink, setEditingLink] = useState(null); // the line whose web address is open for editing
  // Moving lines by drag and drop, within their own section. A red line marks where the
  // dragged line will land.
  const [drag, setDrag] = useState(null); // { section, from }
  const [dropAt, setDropAt] = useState(null); // { section, index }
  const moved = (list, from, to) => {
    const next = list.slice();
    const [item] = next.splice(from, 1);
    next.splice(to > from ? to - 1 : to, 0, item);
    return next;
  };
  // Props for a draggable line: where it is, and what to do when something lands on it.
  const dropProps = (section, index, onDrop) => ({
    onDragOver: (e) => {
      if (drag?.section !== section) return;
      e.preventDefault();
      const box = e.currentTarget.getBoundingClientRect();
      setDropAt({ section, index: e.clientY < box.top + box.height / 2 ? index : index + 1 });
    },
    onDrop: (e) => {
      e.preventDefault();
      if (drag?.section === section && dropAt?.section === section && dropAt.index !== drag.from && dropAt.index !== drag.from + 1) onDrop(drag.from, dropAt.index);
      setDrag(null);
      setDropAt(null);
    },
  });
  const marker = (section, index) =>
    drag?.section === section && dropAt?.section === section && dropAt.index === index ? <div className="h-[2px] w-full bg-[#C1440E]" /> : null;
  const grip = (section, index, real) =>
    real ? (
      <span
        draggable
        onDragStart={(e) => { e.stopPropagation(); setDrag({ section, from: index }); }}
        onDragEnd={() => { setDrag(null); setDropAt(null); }}
        onClick={(e) => e.stopPropagation()}
        title="Drag to move"
        className="flex shrink-0 cursor-grab items-center text-neutral-400 hover:text-neutral-900 active:cursor-grabbing"
      >
        <GripVertical size={11} />
      </span>
    ) : (
      <span className="w-[11px] shrink-0" />
    );
  const [notesLoaded, setNotesLoaded] = useState(false);
  const considerationsBox = useRef(null);
  // The bullet button: the line the cursor is on becomes a bullet, or stops being one.
  const toggleBullet = () => {
    const el = considerationsBox.current;
    const text = nutrition.considerations || "";
    if (!el) return;
    const at = document.activeElement === el ? el.selectionStart : text.length;
    const lineStart = text.lastIndexOf("\n", at - 1) + 1;
    const bulleted = text.startsWith("• ", lineStart);
    const next = bulleted ? text.slice(0, lineStart) + text.slice(lineStart + 2) : text.slice(0, lineStart) + "• " + text.slice(lineStart);
    saveConsiderations(next);
    const caret = bulleted ? Math.max(lineStart, at - 2) : at + 2;
    requestAnimationFrame(() => { el.focus(); el.selectionStart = el.selectionEnd = caret; });
  };
  useEffect(() => {
    supabase
      .from("admin_docs")
      .select("data")
      .eq("id", NOTES_ID)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) setErr(error.message);
        notesOk.current = !error;
        setNotes(Array.isArray(data?.data?.foundational) ? data.data.foundational : []);
        const d = data?.data || {};
        setLists({
          medicines: Array.isArray(d.medicines) ? d.medicines : [],
          supplements: Array.isArray(d.supplements) ? d.supplements : [],
          fitness: Array.isArray(d.fitness) ? d.fitness : [],
          monitoring: Array.isArray(d.monitoring) ? d.monitoring : [],
          diagnostics: Array.isArray(d.diagnostics) ? d.diagnostics : [],
          procedures: Array.isArray(d.procedures) ? d.procedures : [],
          vaccinations: Array.isArray(d.vaccinations) ? d.vaccinations : [],
        });
        setNutrition({ ...(d.nutrition || {}), meals: d.nutrition?.meals || {} });
        setNotesLoaded(true);
      });
  }, []);
  // ONE-OFF: lines from the old table fill the new sections, once both tables have
  // loaded cleanly, each only while that new section has nothing typed in it. The old
  // table is left as it is. To be removed once done.
  //   Appointments and strategy -> Monitoring: first column Focus, second Planning.
  //   Diagnostics and Procedures -> Diagnostics: the title (without its colon) and the path.
  const notesOk = useRef(false);
  const oldOk = useRef(false);
  useEffect(() => {
    if (!loaded || !notesLoaded || !notesOk.current || !oldOk.current) return;
    const linesUnder = (re) => {
      const start = rows.findIndex((r) => r.kind !== "row" && re.test(r.a || ""));
      if (start < 0) return [];
      const out = [];
      for (let i = start + 1; i < rows.length && rows[i].kind === "row"; i++) {
        const r = rows[i];
        if ((r.a || "").trim() || (r.b || "").trim()) out.push(r);
      }
      return out;
    };
    // A title and a path: from two cells, or from one cell split at its first ": ".
    const titleAndPath = (r) => {
      let title = (r.a || "").trim();
      let path = (r.b || "").trim();
      if (!path && title.includes(": ")) {
        path = title.slice(title.indexOf(": ") + 2).trim();
        title = title.slice(0, title.indexOf(": "));
      }
      return { id: newId(), name: title.replace(/:\s*$/, ""), text: path };
    };
    const empty = (list, fields) => !list.some((r) => fields.map((f) => r[f] || "").join("").trim());
    const next = { ...lists };
    let changed = false;
    if (empty(lists.monitoring, ["focus", "planning", "situation"])) {
      const got = linesUnder(/appointments and strategy/i).map((r) => ({ id: newId(), focus: r.a || "", planning: r.b || "", situation: "" }));
      if (got.length) { next.monitoring = got; changed = true; }
    }
    // Diagnostics holds everything from the old Diagnostics and Procedures, in one list.
    if (empty(lists.diagnostics, ["name", "text"])) {
      const seen = new Set();
      const got = [...linesUnder(/diagnostic/i), ...linesUnder(/procedure/i)]
        .filter((r) => (seen.has(r.id) ? false : seen.add(r.id)))
        .map(titleAndPath);
      if (got.length) { next.diagnostics = got; changed = true; }
    }
    // Anything already copied under Procedures moves up into Diagnostics.
    if (!empty(lists.procedures, ["name", "text"])) {
      next.diagnostics = [...next.diagnostics, ...lists.procedures];
      next.procedures = [];
      changed = true;
    }
    // Lines copied in twice: only the first of each exact title and path is kept.
    {
      const seen = new Set();
      const once = next.diagnostics.filter((r) => {
        const k = `${(r.name || "").trim()}|${(r.text || "").trim()}`;
        if (k !== "|" && seen.has(k)) return false;
        seen.add(k);
        return true;
      });
      if (once.length !== next.diagnostics.length) { next.diagnostics = once; changed = true; }
    }
    if (changed) {
      setLists(next);
      persist({ foundational: notes, ...next, nutrition });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, notesLoaded]);

  // The whole new table is one saved document; each section saves with the others.
  const persist = (doc) =>
    supabase
      .from("admin_docs")
      .upsert({ id: NOTES_ID, data: doc, updated_at: new Date().toISOString() })
      .then(({ error }) => setErr(error ? error.message : ""));
  const saveConsiderations = (text) => {
    const next = { ...nutrition, considerations: text };
    setNutrition(next);
    persist({ foundational: notes, ...lists, nutrition: next });
  };
  const saveNutrition = (meal, key, text) => {
    const meals = nutrition.meals || {};
    const next = { ...nutrition, meals: { ...meals, [meal]: { ...(meals[meal] || {}), [key]: text } } };
    setNutrition(next);
    persist({ foundational: notes, ...lists, nutrition: next });
  };
  const saveList = (key, next) => {
    const all = { ...lists, [key]: next };
    setLists(all);
    persist({ foundational: notes, ...all, nutrition });
  };
  // A list never shows empty: a blank line stands ready until the first is typed.
  const listRows = (key) => (lists[key].length ? lists[key] : [{ id: "blank", name: "", text: "" }]);
  const editItem = (key, id, fields) =>
    saveList(
      key,
      lists[key].length ? lists[key].map((m) => (m.id === id ? { ...m, ...fields } : m)) : [{ id: newId(), name: "", text: "", ...fields }]
    );
  // Two framed columns, no headings: a short one for the name, a long one for the
  // details, which grows with its text. Then the Add line under the last one.
  // withLink adds a column, right after the name, for where to buy: it reads "Link to
  // buy", and a click in the space beside the words opens the address to change it. An address typed into the details
  // before this column existed is read as the link.
  const columnsBlock = (key, cols) => (
    <>
      <div className="flex border-t border-black" style={{ backgroundColor: HEADER_BG }}>
        <div className="grid flex-1" style={{ gridTemplateColumns: `repeat(${cols.length}, minmax(0, 1fr))` }}>
          {cols.map(([field, label], i) => (
            <span key={field} className={`flex h-[22px] items-center px-2 ${head} ${i ? "border-l border-black" : ""}`}>{label}</span>
          ))}
        </div>
        {/* The grip and bin shown in the heading too, so the columns line up and balance. */}
        <span className="flex w-[49px] shrink-0 items-center gap-2 border-l border-black px-2 text-neutral-900">
          <GripVertical size={11} />
          <Trash2 size={11} />
        </span>
      </div>
      {listRows(key).map((m, idx) => (
        <div key={m.id} {...dropProps(key, idx, (from, to) => saveList(key, moved(lists[key], from, to)))}>
          {marker(key, idx)}
          <div className="flex items-stretch border-t border-black">
            <div className="grid flex-1" style={{ gridTemplateColumns: `repeat(${cols.length}, minmax(0, 1fr))` }}>
              {cols.map(([field], i) => (
                <span key={field} className={`min-w-0 px-2 py-[3px] ${i ? "border-l border-black" : ""}`}>
                  <GrowText value={m[field] || ""} onChange={(t) => editItem(key, m.id, { [field]: t })} rows={1} />
                </span>
              ))}
            </div>
            {/* The grip always sits just left of the bin. */}
            <span className="flex w-[49px] shrink-0 items-start gap-2 border-l border-black px-2 py-[5px]">
              {grip(key, idx, m.id !== "blank")}
              {m.id !== "blank" ? (
                <button onClick={() => setListConfirm({ key, id: m.id })} title="Remove" className="text-neutral-900 hover:text-[#C1440E]">
                  <Trash2 size={11} />
                </button>
              ) : (
                <span className="w-[11px]" />
              )}
            </span>
          </div>
        </div>
      ))}
      <button
        onClick={() => saveList(key, [...lists[key], { id: newId(), name: "", text: "" }])}
        className="flex h-[22px] w-full items-center gap-[2px] border-t border-black px-2 text-[11px] font-bold text-[#0f766e] transition-colors hover:text-[#0c5e57]"
      >
        <Plus size={11} strokeWidth={3} />Add
      </button>
    </>
  );
  const lineBlock = (key) => (
    <>
      {listRows(key).map((m, idx) => (
        <div key={m.id} {...dropProps(key, idx, (from, to) => saveList(key, moved(lists[key], from, to)))}>
          {marker(key, idx)}
          <div className="flex items-stretch border-t border-black">
            <span className="flex min-w-0 flex-1 items-start px-2 py-[3px]">
              <GrowText value={m.text || ""} onChange={(t) => editItem(key, m.id, { text: t })} rows={1} />
            </span>
            {/* The grip always sits just left of the bin. */}
            <span className="flex shrink-0 items-start gap-2 px-2 py-[5px]">
              {grip(key, idx, m.id !== "blank")}
              {m.id !== "blank" ? (
                <button onClick={() => setListConfirm({ key, id: m.id })} title="Remove" className="text-neutral-900 hover:text-[#C1440E]">
                  <Trash2 size={11} />
                </button>
              ) : (
                <span className="w-[11px]" />
              )}
            </span>
          </div>
        </div>
      ))}
      <button
        onClick={() => saveList(key, [...lists[key], { id: newId(), name: "", text: "" }])}
        className="flex h-[22px] w-full items-center gap-[2px] border-t border-black px-2 text-[11px] font-bold text-[#0f766e] transition-colors hover:text-[#0c5e57]"
      >
        <Plus size={11} strokeWidth={3} />Add
      </button>
    </>
  );
  const listBlock = (key, withLink = false) => (
    <>
      {listRows(key).map((m, idx) => {
        const oldLink = withLink && !m.link && isWebAddress(m.text);
        const link = withLink ? (m.link ?? (oldLink ? m.text : "")) : "";
        const details = oldLink ? "" : m.text || "";
        const setDetails = (t) => editItem(key, m.id, oldLink ? { text: t, link: m.text } : { text: t });
        const setLink = (v) => editItem(key, m.id, oldLink ? { link: v, text: "" } : { link: v });
        return (
          <div key={m.id} {...dropProps(key, idx, (from, to) => saveList(key, moved(lists[key], from, to)))}>
          {marker(key, idx)}
          <div className="flex items-stretch border-t border-black">
            <span className="flex w-1/4 min-w-[160px] shrink-0 items-start px-2 py-[3px]">
              <input
                value={m.name || ""}
                onChange={(e) => editItem(key, m.id, { name: e.target.value })}
                className="w-full bg-transparent py-0 text-[11px] leading-[15px] text-neutral-900 outline-none"
              />
            </span>
            {/* The words open the shop; a click in the space beside them opens the address. */}
            {withLink && (
              <span
                onClick={() => { if (isWebAddress(link)) setEditingLink(m.id); }}
                className={`flex w-56 shrink-0 items-start justify-center border-l border-black px-2 py-[3px] ${isWebAddress(link) && editingLink !== m.id ? "cursor-text" : ""}`}
              >
                {isWebAddress(link) && editingLink !== m.id ? (
                  <a href={link.trim()} target="_blank" rel="noreferrer" title={link.trim()} onClick={(e) => e.stopPropagation()} className="text-[11px] leading-[15px] text-[#0f766e] underline underline-offset-2 hover:text-[#0c5e57]">
                    Link to buy
                  </a>
                ) : (
                  <input
                    autoFocus={editingLink === m.id}
                    value={link}
                    onChange={(e) => setLink(e.target.value)}
                    onBlur={() => setEditingLink(null)}
                    onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                    className="w-full bg-transparent py-0 text-[11px] leading-[15px] text-neutral-900 outline-none"
                  />
                )}
              </span>
            )}
            <span className="flex min-w-0 flex-1 items-start border-l border-black px-2 py-[3px]">
              <GrowText value={details} onChange={setDetails} rows={1} />
            </span>
            {/* The grip always sits just left of the bin. */}
            <span className="flex shrink-0 items-start gap-2 px-2 py-[5px]">
              {grip(key, idx, m.id !== "blank")}
              {m.id !== "blank" ? (
                <button onClick={() => setListConfirm({ key, id: m.id })} title="Remove" className="text-neutral-900 hover:text-[#C1440E]">
                  <Trash2 size={11} />
                </button>
              ) : (
                <span className="w-[11px]" />
              )}
            </span>
          </div>
          </div>
        );
      })}
      <button
        onClick={() => saveList(key, [...lists[key], { id: newId(), name: "", text: "", ...(withLink ? { link: "" } : {}) }])}
        className="flex h-[22px] w-full items-center gap-[2px] border-t border-black px-2 text-[11px] font-bold text-[#0f766e] transition-colors hover:text-[#0c5e57]"
      >
        <Plus size={11} strokeWidth={3} />Add
      </button>
    </>
  );
  const saveNotes = (next) => {
    setNotes(next);
    supabase
      .from("admin_docs")
      .upsert({ id: NOTES_ID, data: { foundational: next, ...lists, nutrition }, updated_at: new Date().toISOString() })
      .then(({ error }) => setErr(error ? error.message : ""));
  };
  // Never an empty section: a blank entry stands ready until the first is typed.
  const noteRows = notes.length ? notes : [{ id: "blank", title: "", text: "", open: false }];
  const editNote = (id, fields) =>
    saveNotes(notes.length ? notes.map((n) => (n.id === id ? { ...n, ...fields } : n)) : [{ id: newId(), title: "", text: "", open: false, ...fields }]);

  useEffect(() => {
    supabase
      .from("admin_docs")
      .select("data")
      .eq("id", DOC_ID)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) setErr(error.message);
        const list = Array.isArray(data?.data) ? data.data : [];
        oldOk.current = !error;
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
      {/* The new table, being rebuilt section by section, in the Monthly page's style:
          a grey band top and bottom and between sections. */}
      <div spellCheck className="mb-48 w-full min-w-[760px] overflow-hidden border border-black bg-white shadow-sm">
        <div className="h-[10px]" style={{ backgroundColor: GAP_BG }} />
        <div className="flex h-[22px] items-center border-t border-black px-2" style={{ backgroundColor: BAR_BG }}>
          <span className={head}>Foundational</span>
        </div>
        {/* Each entry is one line: a title typed on the left; a click anywhere else on
            the line, or its arrow, opens the notes underneath on the faint pink. */}
        {notesLoaded &&
          noteRows.map((n, idx) => (
            <div key={n.id} {...dropProps("foundational", idx, (from, to) => saveNotes(moved(notes, from, to)))}>
              {marker("foundational", idx)}
              <div
                // Only one entry open at a time: opening one shuts the others.
                onClick={() => (notes.length ? saveNotes(notes.map((x) => ({ ...x, open: x.id === n.id ? !x.open : false }))) : editNote(n.id, { open: !n.open }))}
                className="flex h-[22px] cursor-pointer select-none items-center gap-2 border-t border-black px-2"
              >
                <input
                  value={n.title || ""}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => editNote(n.id, { title: e.target.value })}
                  // Only as wide as its words, so a click just after them opens the line.
                  size={Math.max((n.title || "").length + 1, 6)}
                  className="bg-transparent py-0 text-[11px] leading-none text-neutral-900 outline-none"
                />
                <span className="flex-1" />
                <ChevronDown size={12} className={`shrink-0 text-neutral-900 transition-transform ${n.open ? "rotate-180" : ""}`} />
                {/* The grip always sits just left of the bin. */}
                {grip("foundational", idx, n.id !== "blank")}
                {n.id !== "blank" && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setNoteConfirm(n.id); }}
                    title="Remove"
                    className="shrink-0 text-neutral-900 hover:text-[#C1440E]"
                  >
                    <Trash2 size={11} />
                  </button>
                )}
              </div>
              {n.open && (
                <div className="border-t border-black px-2 py-1.5" style={{ backgroundColor: "#FBEFEC" }}>
                  <GrowText value={n.text || ""} onChange={(t) => editNote(n.id, { text: t })} />
                </div>
              )}
            </div>
          ))}
        <button
          onClick={() => saveNotes([...notes, { id: newId(), title: "", text: "", open: false }])}
          className="flex h-[22px] w-full items-center gap-[2px] border-t border-black px-2 text-[11px] font-bold text-[#0f766e] transition-colors hover:text-[#0c5e57]"
        >
          <Plus size={11} strokeWidth={3} />Add
        </button>
        {/* The grey band between sections, then the next section. */}
        <div className="h-[10px] border-t border-black" style={{ backgroundColor: GAP_BG }} />
        <div className="flex h-[22px] items-center border-t border-black px-2" style={{ backgroundColor: BAR_BG }}>
          <span className={head}>Medicines</span>
        </div>
        {notesLoaded && listBlock("medicines")}
        {/* Supplements belong with medicines: its own bar, no grey band before it. */}
        <div className="flex h-[22px] items-center border-t border-black px-2" style={{ backgroundColor: BAR_BG }}>
          <span className={head}>Supplements</span>
        </div>
        {notesLoaded && listBlock("supplements", true)}
        {/* Nutrition: no grey band before it. A row per meal, a column per group of days
            and one for considerations; every cell grows with what is written. */}
        <div className="flex h-[22px] items-center border-t border-black px-2" style={{ backgroundColor: BAR_BG }}>
          <span className={head}>Nutrition</span>
        </div>
        {/* One grid: the meal number, the two groups of days per meal, and Considerations
            as a single block down the right, the full height of all four meals. */}
        <div className="grid grid-cols-[7rem_1fr_1fr_1fr] border-t border-black" style={{ backgroundColor: HEADER_BG }}>
          <span className={`flex h-[22px] items-center px-2 ${head}`}>Meal number</span>
          {NUTRITION_PARTS.map(([key, label]) => (
            <span key={key} className={`flex h-[22px] items-center border-l border-black px-2 ${head}`}>
              {label}
              {key === "considerations" && (
                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={toggleBullet}
                  title="Bullet the line the cursor is on"
                  className="ml-auto text-neutral-900 hover:text-[#9c7c33]"
                >
                  <List size={14} strokeWidth={2.75} />
                </button>
              )}
            </span>
          ))}
        </div>
        {notesLoaded && (
          <div className="grid grid-cols-[7rem_1fr_1fr_1fr]">
            {MEALS.map((meal, i) => (
              <Fragment key={meal}>
                <span className={`flex items-start border-t border-black px-2 py-[3px] ${head}`} style={{ gridColumn: 1, gridRow: i + 1 }}>
                  {meal}
                </span>
                {NUTRITION_PARTS.filter(([key]) => key !== "considerations").map(([key], j) => (
                  <span key={key} className="border-l border-t border-black px-2 py-[3px]" style={{ gridColumn: j + 2, gridRow: i + 1 }}>
                    <GrowText value={nutrition.meals?.[meal]?.[key] || ""} onChange={(t) => saveNutrition(meal, key, t)} rows={1} spell />
                  </span>
                ))}
              </Fragment>
            ))}
            <span className="border-l border-t border-black px-2 py-[3px]" style={{ gridColumn: 4, gridRow: `1 / span ${MEALS.length}` }}>
              <GrowText value={nutrition.considerations || ""} onChange={(t) => saveConsiderations(t)} rows={4} bullets boxRef={considerationsBox} spell />
            </span>
          </div>
        )}
        {/* The grey band, then Fitness. */}
        <div className="h-[10px] border-t border-black" style={{ backgroundColor: GAP_BG }} />
        <div className="flex h-[22px] items-center border-t border-black px-2" style={{ backgroundColor: BAR_BG }}>
          <span className={head}>Fitness</span>
        </div>
        {notesLoaded && lineBlock("fitness")}
        {/* The grey band, then Monitoring: Focus, Planning and Situation side by side. */}
        <div className="h-[10px] border-t border-black" style={{ backgroundColor: GAP_BG }} />
        <div className="flex h-[22px] items-center border-t border-black px-2" style={{ backgroundColor: BAR_BG }}>
          <span className={head}>Monitoring</span>
        </div>
        {notesLoaded && columnsBlock("monitoring", [["focus", "Focus"], ["planning", "Planning"], ["situation", "Situation"]])}
        {/* Vaccinations, part of the Monitoring area: single-column lines for now. */}
        <div className="flex h-[22px] items-center border-t border-black px-2" style={{ backgroundColor: BAR_BG }}>
          <span className={head}>Vaccinations</span>
        </div>
        {notesLoaded && lineBlock("vaccinations")}
        {/* The grey band, then Testing, with Diagnostics under it: a title and its full
            Dropbox path on each line. */}
        <div className="h-[10px] border-t border-black" style={{ backgroundColor: GAP_BG }} />
        <div className="flex h-[22px] items-center border-t border-black px-2" style={{ backgroundColor: BAR_BG }}>
          <span className={head}>Testing</span>
        </div>
        {/* One level down from Testing, so the lighter shade. */}
        <div className="flex h-[22px] items-center border-t border-black px-2" style={{ backgroundColor: HEADER_BG }}>
          <span className={head}>Diagnostics</span>
        </div>
        {notesLoaded && listBlock("diagnostics")}
      </div>

      {/* The earlier table, kept below as a holding area while the new one is built. */}
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

      {listConfirm != null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={() => setListConfirm(null)}>
          <div className="w-full max-w-sm border-[5px] bg-white p-6 text-center shadow-2xl" style={{ borderColor: "#C1440E" }} onClick={(e) => e.stopPropagation()}>
            <p className="text-[14px] font-bold uppercase tracking-[0.06em] text-neutral-900">Delete this?</p>
            <div className="mt-5 flex justify-center gap-3 text-[12px] font-bold uppercase tracking-wide">
              <button
                onClick={() => { saveList(listConfirm.key, lists[listConfirm.key].filter((x) => x.id !== listConfirm.id)); setListConfirm(null); }}
                className="border-2 px-5 py-1.5 text-white transition-opacity hover:opacity-80"
                style={{ backgroundColor: "#C1440E", borderColor: "#C1440E" }}
              >
                Delete
              </button>
              <button onClick={() => setListConfirm(null)} className="border-2 px-5 py-1.5 transition-opacity hover:opacity-70" style={{ borderColor: "#C1440E", color: "#C1440E" }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {noteConfirm != null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={() => setNoteConfirm(null)}>
          <div className="w-full max-w-sm border-[5px] bg-white p-6 text-center shadow-2xl" style={{ borderColor: "#C1440E" }} onClick={(e) => e.stopPropagation()}>
            <p className="text-[14px] font-bold uppercase tracking-[0.06em] text-neutral-900">Delete this?</p>
            <div className="mt-5 flex justify-center gap-3 text-[12px] font-bold uppercase tracking-wide">
              <button
                onClick={() => { saveNotes(notes.filter((x) => x.id !== noteConfirm)); setNoteConfirm(null); }}
                className="border-2 px-5 py-1.5 text-white transition-opacity hover:opacity-80"
                style={{ backgroundColor: "#C1440E", borderColor: "#C1440E" }}
              >
                Delete
              </button>
              <button onClick={() => setNoteConfirm(null)} className="border-2 px-5 py-1.5 transition-opacity hover:opacity-70" style={{ borderColor: "#C1440E", color: "#C1440E" }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {confirm != null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={() => setConfirm(null)}>
          <div className="w-full max-w-sm border-[5px] bg-white p-6 text-center shadow-2xl" style={{ borderColor: "#C1440E" }} onClick={(e) => e.stopPropagation()}>
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
// A whole web address, and the site it belongs to, read as "amazon.de".
const isWebAddress = (v) => /^https?:\/\/\S+$/i.test(String(v || "").trim());
const siteName = (v) => {
  try { return new URL(String(v).trim()).hostname.replace(/^www\./, ""); } catch { return String(v); }
};

// Notes that grow with what is typed, so nothing is ever cut off or scrolls inside.
// `bullets`: a line started with "- " becomes a bullet, Enter starts the next one, and
// Enter on an empty bullet ends the list.
// `spell`: the browser underlines misspelt words (on everywhere in the new table).
function GrowText({ value, onChange, rows = 2, autoFocus = false, bullets = false, boxRef = null, spell = true }) {
  const ref = useRef(null);
  if (boxRef) boxRef.current = ref.current;
  const onKeyDown = (e) => {
    if (!bullets || e.key !== "Enter" || e.shiftKey) return;
    const el = e.currentTarget;
    const at = el.selectionStart;
    const lineStart = value.lastIndexOf("\n", at - 1) + 1;
    const line = value.slice(lineStart, at);
    if (!line.startsWith("• ")) return;
    e.preventDefault();
    // An empty bullet: Enter takes it away and the list ends there.
    const next = line === "• " ? value.slice(0, lineStart) + value.slice(at) : value.slice(0, at) + "\n• " + value.slice(el.selectionEnd);
    const caret = line === "• " ? lineStart : at + 3;
    onChange(next);
    requestAnimationFrame(() => { el.selectionStart = el.selectionEnd = caret; });
  };
  useEffect(() => {
    const el = ref.current;
    if (el) { el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; }
  }, [value]);
  return (
    <textarea
      ref={(el) => { ref.current = el; if (boxRef) boxRef.current = el; }}
      value={value}
      onChange={(e) => onChange(bullets ? e.target.value.replace(/(^|\n)- /g, "$1• ") : e.target.value)}
      onKeyDown={onKeyDown}
      rows={rows}
      autoFocus={autoFocus}
      spellCheck={spell}
      className="block w-full resize-none bg-transparent text-[11px] leading-[15px] text-neutral-900 outline-none"
    />
  );
}

function RowTools({ i, onAdd, onRemove }) {
  return (
    <span className="flex h-[15px] shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
      <button onClick={() => onAdd(i, "row")} title="Add a line below" className="text-neutral-900 hover:text-[#9c7c33]"><Plus size={11} /></button>
      <button onClick={() => onAdd(i, "section")} title="Add a section below" className="text-[10px] font-bold text-neutral-900 hover:text-[#9c7c33]">S</button>
      <button onClick={() => onRemove(i)} title="Delete" className="text-neutral-900 hover:text-[#C1440E]"><Trash2 size={11} /></button>
    </span>
  );
}
