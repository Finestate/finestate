import { Fragment, useEffect, useRef, useState } from "react";
import { Plus, Trash2, ChevronDown, List, GripVertical, ChevronsLeft, ChevronsRight, Download } from "lucide-react";
import { supabase } from "./lib/supabaseClient.js";
import { backupStamp, downloadText, htmlToLines } from "./backup.js";

// Health and wellbeing. It holds medical history, membership numbers and private links,
// so it lives in Supabase and never in this public repo. (The earlier table's data is
// still kept in Supabase under "hw", untouched, but is no longer shown.)
const NOTES_ID = "hw-notes"; // the HW table, saved in Supabase
// The meals of the day, one row each in Nutrition.
const MEALS = ["Meal 1", "Meal 2", "Meal 3", "Meal 4"];
// The three parts of Nutrition, left to right, in equal columns. The saved keys stay
// as they were, so anything already written keeps its column.
const NUTRITION_PARTS = [
  ["weekdays", "Sun+Mon+Tue+Thu+Fri"],
  ["saturday", "Wed+Sat"],
  ["considerations", "Considerations"],
];
// The week, one line a day. Each day first shows what its old group of days held,
// until something is written for that day itself.
const DAYS = [
  ["mon", "Monday", "weekdays"],
  ["tue", "Tuesday", "weekdays"],
  ["wed", "Wednesday", "saturday"],
  ["thu", "Thursday", "weekdays"],
  ["fri", "Friday", "weekdays"],
  ["sat", "Saturday", "saturday"],
  ["sun", "Sunday", "weekdays"],
];
const BAR_BG = "#F2C46D";   // section bars
const HEADER_BG = "#FFE4B3"; // column headings inside a section
const GAP_BG = "#8A8A8A"; // the grey band, as on the Monthly page

let _idc = 0;
const newId = () => "h" + Date.now().toString(36) + "-" + (_idc++);

const head = "text-[11px] font-bold uppercase leading-[15px] tracking-[0.06em] text-neutral-900";

export default function HW() {
  const [err, setErr] = useState("");
  // The new table: its entries, each a title that opens onto notes. Kept in Supabase.
  const [noteConfirm, setNoteConfirm] = useState(null); // entry waiting on Delete or Cancel
  const [notes, setNotes] = useState([]);
  // Name-and-details lists, by key: medicines, supplements.
  const [lists, setLists] = useState({ medicines: [], supplements: [], fitness: [], monitoring: [], diagnostics: [], procedures: [], vaccinations: [], labs: [], insurance: [], procedureTracking: [] });
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
          labs: Array.isArray(d.labs) ? d.labs : [],
          insurance: Array.isArray(d.insurance) ? d.insurance : [],
          procedureTracking: Array.isArray(d.procedureTracking) ? d.procedureTracking : [],
        });
        setNutrition({ ...(d.nutrition || {}), meals: d.nutrition?.meals || {} });
        setNotesLoaded(true);
      });
  }, []);

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
  // A day's meal: its own text once written, otherwise what its old group held.
  const mealOf = (day, group, meal) => nutrition.days?.[day]?.[meal] ?? nutrition.meals?.[meal]?.[group] ?? "";
  const saveDayMeal = (day, meal, text) => {
    const days = nutrition.days || {};
    const next = { ...nutrition, days: { ...days, [day]: { ...(days[day] || {}), [meal]: text } } };
    setNutrition(next);
    persist({ foundational: notes, ...lists, nutrition: next });
  };
  // The days open in Nutrition: today to start. Each line opens and closes on its own,
  // and the chevron on the bar opens or closes them all at once.
  const todayKey = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][new Date().getDay()];
  const [openDays, setOpenDays] = useState(() => [todayKey]);
  const ALL_NUTRITION = [...DAYS.map(([d]) => d), "considerations"];
  const allOpen = openDays.length === ALL_NUTRITION.length;
  const toggleDay = (day) => setOpenDays((list) => (list.includes(day) ? list.filter((d) => d !== day) : [...list, day]));
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
  // `twoCols`: the space after the name split into two equal columns, the new one first
  // and the details as before, far right (Medicines).
  const listBlock = (key, withLink = false, twoCols = false) => (
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
            {twoCols && (
              <span className="flex min-w-0 flex-1 basis-0 items-start border-l border-black px-2 py-[3px]">
                <GrowText value={m.col2 || ""} onChange={(t) => editItem(key, m.id, { col2: t })} rows={1} />
              </span>
            )}
            <span className="flex min-w-0 flex-1 basis-0 items-start border-l border-black px-2 py-[3px]">
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


  // Nothing is drawn until the saved table is in, so the whole page appears at once
  // rather than its bars first and the rest a moment later.
  // A plain text copy of the whole HW page, section by section, top to bottom.
  const downloadBackup = () => {
    const out = [`FINESTATE – HW – ${backupStamp()}`, ""];
    const section = (name) => out.push("", "=".repeat(40), name.toUpperCase(), "=".repeat(40));
    const indent = (text, by = "    ") => String(text || "").split("\n").forEach((l) => out.push(by + l));
    section("Foundational");
    notes.forEach((n) => {
      out.push("", `- ${n.title || "(untitled)"}`);
      indent(n.html != null ? htmlToLines(n.html) : n.text);
      (n.chat || []).forEach((m) => indent(`${m.role === "user" ? "You" : "Claude"}: ${m.content}`));
    });
    const named = (key, title) => {
      section(title);
      (lists[key] || []).forEach((m) => {
        out.push(`- ${m.name || ""}${m.link ? ` (${m.link})` : ""}`);
        if (m.col2) indent(m.col2);
        if (m.text) indent(m.text);
      });
    };
    const lines = (key, title) => {
      section(title);
      (lists[key] || []).forEach((m) => out.push(`- ${m.text || ""}`));
    };
    named("medicines", "Medicines");
    named("supplements", "Supplements");
    section("Nutrition");
    DAYS.forEach(([day, name, group]) => {
      out.push("", name);
      MEALS.forEach((meal) => out.push(`- Meal: ${mealOf(day, group, meal)}`));
    });
    out.push("", "Considerations");
    indent(nutrition.considerations);
    lines("fitness", "Fitness");
    section("Monitoring");
    (lists.monitoring || []).forEach((m) => out.push(`- Focus: ${m.focus || ""} | Planning: ${m.planning || ""} | Situation: ${m.situation || ""}`));
    named("diagnostics", "Diagnostics");
    named("labs", "Labs");
    lines("procedureTracking", "Procedures tracking");
    lines("vaccinations", "Vaccinations");
    lines("insurance", "Insurance");
    downloadText("HW", out);
  };

  if (!notesLoaded) return <div className="w-full" />;

  return (
    <div className="w-full overflow-x-auto">
      {/* The HW table, in the Monthly page's style: grey bands between sections. */}
      <div spellCheck className="w-full min-w-[760px] overflow-hidden border border-black bg-white shadow-sm">
        <div className="h-[10px]" style={{ backgroundColor: GAP_BG }} />
        <div className="flex h-[22px] items-center border-t border-black px-2" style={{ backgroundColor: BAR_BG }}>
          <span className={head}>Foundational</span>
          <button onClick={downloadBackup} title="Download a backup of this page" className="ml-auto text-neutral-900 hover:text-[#9c7c33]">
            <Download size={12} strokeWidth={2.5} />
          </button>
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
                  <RichNotes
                    key={n.id}
                    html={n.html ?? plainToHtml(n.text)}
                    onChange={(html) => editNote(n.id, { html })}
                  />
                  {/^g(od)?$/i.test((n.title || "").trim()) && (
                    <BibleChat chat={n.chat || []} onChange={(chat) => editNote(n.id, { chat })} />
                  )}
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
        {notesLoaded && listBlock("medicines", false, true)}
        {/* Supplements belong with medicines: its own bar, no grey band before it. */}
        <div className="flex h-[22px] items-center border-t border-black px-2" style={{ backgroundColor: BAR_BG }}>
          <span className={head}>Supplements</span>
        </div>
        {notesLoaded && listBlock("supplements", true)}
        {/* Nutrition: no grey band before it. */}
        <div className="flex h-[22px] items-center border-t border-black px-2" style={{ backgroundColor: BAR_BG }}>
          <span className={head}>Nutrition</span>
          {/* Opens every day at once, or closes them all. */}
          <button
            onClick={() => setOpenDays(allOpen ? [] : ALL_NUTRITION)}
            title={allOpen ? "Close all" : "Open all"}
            className="ml-auto text-neutral-900 hover:text-[#9c7c33]"
          >
            <ChevronDown size={14} strokeWidth={2.75} className={`transition-transform ${allOpen ? "rotate-180" : ""}`} />
          </button>
        </div>
        {/* Seven lines, Monday to Sunday, like Foundational. A click opens a day's meals
            underneath on the faint pink; today is open to start. Considerations closes the
            list the same way. */}
        {notesLoaded &&
          [...DAYS, ["considerations", "Considerations"]].map(([day, name, group]) => {
            const open = openDays.includes(day);
            return (
              <div key={day}>
                <div
                  onClick={() => toggleDay(day)}
                  // Today's line sits on the pink, so it stands out from the other days.
                  className={`flex h-[22px] cursor-pointer select-none items-center gap-2 border-t border-black px-2 ${day === todayKey ? "bg-[#FBEFEC]" : ""}`}
                >
                  <span className="text-[11px] leading-none text-neutral-900">{name}</span>
                  <span className="flex-1" />
                  <ChevronDown size={12} className={`shrink-0 text-neutral-900 transition-transform ${open ? "rotate-180" : ""}`} />
                </div>
                {open && day !== "considerations" && (
                  <div className="border-t border-black px-2 py-1.5" style={{ backgroundColor: "#FBEFEC" }}>
                    {/* A thin framed grid on the pink: Meal on the left, what it is on the right. */}
                    <div className="border border-neutral-400">
                      {MEALS.map((meal, mi) => (
                        <div key={meal} className={`flex items-stretch ${mi ? "border-t border-neutral-400" : ""}`}>
                          <span className="w-[44px] shrink-0 border-r border-neutral-400 px-1.5 py-[2px] text-[11px] font-bold leading-[15px] text-neutral-900">Meal</span>
                          <div className="min-w-0 flex-1 px-1.5 py-[2px]">
                            <GrowText value={mealOf(day, group, meal)} onChange={(t) => saveDayMeal(day, meal, t)} rows={1} spell />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {open && day === "considerations" && (
                  <div className="flex items-start gap-2 border-t border-black px-2 py-1" style={{ backgroundColor: "#FBEFEC" }}>
                    <div className="min-w-0 flex-1">
                      <GrowText value={nutrition.considerations || ""} onChange={(t) => saveConsiderations(t)} rows={2} bullets boxRef={considerationsBox} spell />
                    </div>
                    <button
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={toggleBullet}
                      title="Bullet the line the cursor is on"
                      className="shrink-0 text-neutral-900 hover:text-[#9c7c33]"
                    >
                      <List size={14} strokeWidth={2.75} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
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
        {/* Testing, straight after Monitoring, with Diagnostics under it: a title and its
            full Dropbox path on each line. */}
        <div className="flex h-[22px] items-center border-t border-black px-2" style={{ backgroundColor: BAR_BG }}>
          <span className={head}>Testing</span>
        </div>
        {/* One level down from Testing, so the lighter shade. */}
        <div className="flex h-[22px] items-center border-t border-black px-2" style={{ backgroundColor: HEADER_BG }}>
          <span className={head}>Diagnostics</span>
        </div>
        {notesLoaded && listBlock("diagnostics")}
        {/* Labs, the same as Diagnostics: one level under Testing. */}
        <div className="flex h-[22px] items-center border-t border-black px-2" style={{ backgroundColor: HEADER_BG }}>
          <span className={head}>Labs</span>
        </div>
        {notesLoaded && listBlock("labs")}
        <div className="flex h-[22px] items-center border-t border-black px-2" style={{ backgroundColor: BAR_BG }}>
          <span className={head}>Procedures tracking</span>
        </div>
        {notesLoaded && lineBlock("procedureTracking")}
        {/* Vaccinations, under Labs: single-column lines for now. */}
        <div className="flex h-[22px] items-center border-t border-black px-2" style={{ backgroundColor: BAR_BG }}>
          <span className={head}>Vaccinations</span>
        </div>
        {notesLoaded && lineBlock("vaccinations")}
        {/* The grey band, then Insurance: single-column lines, like Vaccinations. */}
        <div className="h-[10px] border-t border-black" style={{ backgroundColor: GAP_BG }} />
        <div className="flex h-[22px] items-center border-t border-black px-2" style={{ backgroundColor: BAR_BG }}>
          <span className={head}>Insurance</span>
        </div>
        {notesLoaded && lineBlock("insurance")}
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

// A conversation with Claude for Bible questions, under the G entry. Every question and
// answer is saved with the entry in Supabase, so it is all there next time.
function BibleChat({ chat, onChange }) {
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const ask = async () => {
    const question = draft.trim();
    if (!question || busy) return;
    const asked = [...chat, { role: "user", content: question }];
    onChange(asked);
    setDraft("");
    setBusy(true);
    setError("");
    try {
      const { data } = await supabase.auth.getSession();
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${data?.session?.access_token || ""}` },
        body: JSON.stringify({ messages: asked }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "Claude could not answer.");
      onChange([...asked, { role: "assistant", content: j.reply }]);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    // One white box holds it all: the conversation, then the line to type on. Enter sends,
    // the line empties at once, and the answer appears in the box when it is ready.
    <div className="relative mt-2 border border-black bg-white px-2 py-1">
      {chat.length > 0 && (
        <button
          onClick={() => onChange([])}
          className="absolute right-2 top-1 text-[11px] text-neutral-500 underline underline-offset-2 hover:text-[#C1440E]"
        >
          Clear
        </button>
      )}
      {chat.map((m, i) => (
        <p key={i} className={`mb-1.5 whitespace-pre-wrap text-[11px] leading-[15px] text-neutral-900 ${m.role === "user" ? "pr-12 font-bold" : ""}`}>
          {m.content}
        </p>
      ))}
      {busy && <p className="mb-1.5 text-[11px] italic text-neutral-500">Claude is thinking…</p>}
      {error && <p className="mb-1.5 text-[11px] font-semibold text-[#C1440E]">{error}</p>}
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(); } }}
        rows={2}
        className="block w-full resize-none bg-transparent text-[11px] leading-[15px] text-neutral-900 outline-none"
      />
    </div>
  );
}

// Notes written before formatting arrived were plain text; they show the same, line by line.
const plainToHtml = (t) =>
  String(t || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");

// The Daily page's editing bar over formatted notes: bold, red, bullets and indent, each
// acting on whatever is selected. Uncontrolled, so the cursor never jumps while typing.
const INK_RED = "#B01E2F";
function RichNotes({ html, onChange }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (el && document.activeElement !== el && el.innerHTML !== (html || "")) el.innerHTML = html || "";
  }, [html]);
  const run = (cmd, arg) => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    document.execCommand(cmd, false, arg);
    onChange(el.innerHTML);
  };
  const red = () => {
    const now = String(document.queryCommandValue("foreColor") || "").replace(/\s/g, "");
    const isRed = now === "rgb(176,30,47)" || now.toLowerCase() === INK_RED.toLowerCase();
    run("foreColor", isRed ? "#171717" : INK_RED);
  };
  const btn = "flex h-4 w-4 items-center justify-center text-neutral-900 hover:text-[#9c7c33]";
  const keep = (e) => e.preventDefault();
  return (
    <>
      <div className="-mx-2 mb-1.5 flex items-center gap-1 border-b border-[#C1440E] px-2 pb-1">
        <button onMouseDown={keep} onClick={() => run("bold")} title="Bold the highlighted words" className={btn}>
          <span className="text-[13px] font-black leading-none tracking-tight">B</span>
        </button>
        <button onMouseDown={keep} onClick={red} title="Switch the highlighted words between red and black" className="flex h-4 w-4 items-center justify-center">
          <span className="block h-3 w-3" style={{ background: `linear-gradient(135deg, ${INK_RED} 50%, #171717 50%)` }} />
        </button>
        <button onMouseDown={keep} onClick={() => run("insertUnorderedList")} title="Bullet the selected lines" className={btn}><List size={14} strokeWidth={2.75} /></button>
        <button onMouseDown={keep} onClick={() => run("outdent")} title="Decrease indent" className={btn}><ChevronsLeft size={14} strokeWidth={2.75} /></button>
        <button onMouseDown={keep} onClick={() => run("indent")} title="Increase indent" className={btn}><ChevronsRight size={14} strokeWidth={2.75} /></button>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={(e) => onChange(e.currentTarget.innerHTML)}
        className="rich-line block min-h-[30px] w-full whitespace-pre-wrap break-words text-[11px] leading-[15px] text-neutral-900 outline-none"
      />
    </>
  );
}

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

