import { Fragment, useEffect, useRef, useState } from "react";
import { Plus, Trash2, ChevronDown, List, GripVertical, ChevronsLeft, ChevronsRight, Download, Pencil } from "lucide-react";
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
  const [linkDraft, setLinkDraft] = useState(""); // what is being typed there, saved on Enter
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
          // Fitness opens line by line, like Nutrition. The first time, the old lines move in
          // under one line called Workouts, each keeping its two halves.
          fitnessGroups: (() => {
            const base = Array.isArray(d.fitnessGroups)
              ? d.fitnessGroups
              : [{ id: "fg-workouts", title: "Workouts", rows: (Array.isArray(d.fitness) ? d.fitness : []).map((r) => ({ id: r.id, a: r.text || "", b: r.col2 || "" })) }];
            // A Looks line, a plain list of its own, arrives once; delete it and it stays gone.
            return d.fitnessLooksAdded ? base : [...base, { id: "fg-looks", title: "Looks", kind: "list", rows: [] }];
          })(),
          fitnessLooksAdded: true,
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
  // The second set of meals under each day, kept apart from the first.
  const saveDayMeal2 = (day, meal, text) => {
    const days2 = nutrition.days2 || {};
    const next = { ...nutrition, days2: { ...days2, [day]: { ...(days2[day] || {}), [meal]: text } } };
    setNutrition(next);
    persist({ foundational: notes, ...lists, nutrition: next });
  };
  // Days whose six meal lines read exactly the same (spaces at the ends aside) form a
  // group; each group gets a letter and colour, shown after the day name. Worked out
  // afresh every time, so a change drops a day from its group straight away.
  const DAY_LINES = ["Meal 1", "Meal 2", "Extra 2", "Meal 3", "Extra 3", "Meal 4"];
  // Each day's own lines: saved, or the usual six to start (Meal, Meal, Extra, Meal,
  // Extra, Meal). A line's text is kept under its key, so binning a line leaves the
  // others untouched.
  const rowsOfDay = (day) =>
    nutrition.dayRows?.[day] || DAY_LINES.map((k) => ({ id: k, key: k, label: k.startsWith("Extra") ? "Extra" : "Meal" }));
  const saveDayRows = (day, rows) => {
    const next = { ...nutrition, dayRows: { ...(nutrition.dayRows || {}), [day]: rows } };
    setNutrition(next);
    persist({ foundational: notes, ...lists, nutrition: next });
  };
  const twinOf = (() => {
    const COLORS = ["#0f766e", "#9c7c33", "#C1440E", "#1d4ed8", "#7A0019", "#525252"];
    const byKey = {};
    DAYS.forEach(([day, name, group]) => {
      const lines = rowsOfDay(day).map((r) => `${String(r.label || "").trim()}: ${String(mealOf(day, group, r.key) || "").trim()}`);
      if (!rowsOfDay(day).some((r) => String(mealOf(day, group, r.key) || "").trim())) return;
      const key = lines.join(" | ~ | ");
      (byKey[key] = byKey[key] || []).push([day, name]);
    });
    const out = {};
    // Matching days share a colour and the = sign; a day that matches no other still
    // gets a colour of its own (orange first), as a plain circle.
    const SOLO = ["#E07B00", "#7c3aed", "#db2777", "#0891b2", "#65a30d", "#525252"];
    let gi = 0;
    let si = 0;
    Object.values(byKey).forEach((g) => {
      const single = g.length === 1;
      const t = { single, color: single ? SOLO[si++ % SOLO.length] : COLORS[gi++ % COLORS.length], days: g.map(([, n]) => n) };
      g.forEach(([day]) => { out[day] = t; });
    });
    return out;
  })();
  const saveDayMeal = (day, meal, text) => {
    const days = nutrition.days || {};
    const next = { ...nutrition, days: { ...days, [day]: { ...(days[day] || {}), [meal]: text } } };
    setNutrition(next);
    persist({ foundational: notes, ...lists, nutrition: next });
  };
  // The days open in Nutrition. Each line opens and closes on its own,
  // and the chevron on the bar opens or closes them all at once.
  const todayKey = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][new Date().getDay()];
  // Nothing opens by itself: the days you leave open stay open after a refresh, the
  // closed ones stay closed. Remembered in this browser.
  const [openDays, setOpenDaysRaw] = useState(() => {
    try { const v = JSON.parse(localStorage.getItem("hw-nutrition-open") || "[]"); return Array.isArray(v) ? v : []; } catch { return []; }
  });
  const setOpenDays = (next) => setOpenDaysRaw((prev) => {
    const v = typeof next === "function" ? next(prev) : next;
    try { localStorage.setItem("hw-nutrition-open", JSON.stringify(v)); } catch {}
    return v;
  });
  const ALL_NUTRITION = [...DAYS.map(([d]) => d), "considerations"];
  const allOpen = openDays.length === ALL_NUTRITION.length;
  const toggleDay = (day) => setOpenDays((list) => (list.includes(day) ? list.filter((d) => d !== day) : [...list, day]));
  // Fitness: white lines that open, like the days in Nutrition, onto lines of two equal
  // halves on the faint pink. Each part has its own bin, and Add lines for more.
  // Which Fitness+Look lines are open stays as you left it after a refresh (this browser).
  const [fitOpen, setFitOpenRaw] = useState(() => {
    try { const v = JSON.parse(localStorage.getItem("hw-fitness-open") || "[]"); return Array.isArray(v) ? v : []; } catch { return []; }
  });
  const setFitOpen = (next) => setFitOpenRaw((prev) => {
    const v = typeof next === "function" ? next(prev) : next;
    try { localStorage.setItem("hw-fitness-open", JSON.stringify(v)); } catch {}
    return v;
  });
  const fitnessBlock = () => {
    const groups = lists.fitnessGroups || [];
    const saveGroups = (next) => saveList("fitnessGroups", next);
    const editGroup = (gid, fn) => saveGroups(groups.map((g) => (g.id === gid ? fn(g) : g)));
    // A line's week: saved days, or the first time, Monday to Sunday filled from any
    // earlier lines in order (both halves of a line kept together).
    const WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    const weekOf = (g) =>
      g.week ||
      WEEK.map((day, i) => {
        const r = (g.rows || [])[i];
        return { day, text: r ? [r.a, r.b].filter(Boolean).join(" | ") : "" };
      });
    const binBtn = (run) => (
      <button onClick={(e) => { e.stopPropagation(); setListConfirm({ run }); }} title="Remove" className="shrink-0 text-neutral-900 hover:text-[#C1440E]">
        <Trash2 size={11} />
      </button>
    );
    return (
      <>
        {groups.map((g) => {
          const open = fitOpen.includes(g.id);
          return (
            <div key={g.id}>
              <div
                onClick={() => setFitOpen((l) => (l.includes(g.id) ? l.filter((x) => x !== g.id) : [...l, g.id]))}
                className="flex h-[22px] cursor-pointer select-none items-center gap-2 border-t border-black px-2"
              >
                <input
                  value={g.title || ""}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => editGroup(g.id, (x) => ({ ...x, title: e.target.value }))}
                  style={{ fieldSizing: "content" }}
                  className="min-w-[4ch] bg-transparent py-0 text-[11px] leading-none text-neutral-900 outline-none"
                />
                <span className="flex-1" />
                <ChevronDown size={12} className={`shrink-0 text-neutral-900 transition-transform ${open ? "rotate-180" : ""}`} />
                {binBtn(() => saveGroups(groups.filter((x) => x.id !== g.id)))}
              </div>
              {open && (
                <div className="border-t border-black px-2 py-1.5" style={{ backgroundColor: "#FBEFEC" }}>
                  {g.kind === "list" ? (
                    <>
                      {/* A plain list: one line each, added and binned as you go. */}
                      {(g.rows || []).length > 0 && (
                        <div className="border border-neutral-400">
                          {g.rows.map((r, ri) => (
                            <div key={r.id} {...dropProps(`list-${g.id}`, ri, (from, to) => editGroup(g.id, (x) => ({ ...x, rows: moved(x.rows, from, to) })))}>
                            {marker(`list-${g.id}`, ri)}
                            <div className={`flex items-stretch ${ri ? "border-t border-neutral-400" : ""}`}>
                              <div className="min-w-0 flex-1 px-1.5 py-[2px]">
                                <GrowText value={r.text || ""} onChange={(t) => editGroup(g.id, (x) => ({ ...x, rows: x.rows.map((y) => (y.id === r.id ? { ...y, text: t } : y)) }))} rows={1} />
                              </div>
                              {/* The grip sits just left of the bin. */}
                              <span className="flex shrink-0 items-start gap-1.5 border-l border-neutral-400 px-1.5 py-[4px]">
                                {grip(`list-${g.id}`, ri, true)}
                                {binBtn(() => editGroup(g.id, (x) => ({ ...x, rows: x.rows.filter((y) => y.id !== r.id) })))}
                              </span>
                            </div>
                            {/* Under the Clothes line, always shown: a chat with Claude for fashion tips and links. */}
                            {/^\s*clothes/i.test(r.text || "") && (
                              <div className="border-t border-neutral-400 px-1.5 pb-1.5">
                                <BibleChat topic="fashion" chat={r.chat || []} onChange={(chat) => editGroup(g.id, (x) => ({ ...x, rows: x.rows.map((y) => (y.id === r.id ? { ...y, chat } : y)) }))} />
                              </div>
                            )}
                            </div>
                          ))}
                          {marker(`list-${g.id}`, g.rows.length)}
                        </div>
                      )}
                      <button
                        onClick={() => editGroup(g.id, (x) => ({ ...x, rows: [...(x.rows || []), { id: newId(), text: "" }] }))}
                        className={`flex items-center gap-[2px] text-[11px] font-bold text-[#0f766e] hover:text-[#0c5e57] ${(g.rows || []).length ? "mt-1" : ""}`}
                      >
                        <Plus size={11} strokeWidth={3} />Add
                      </button>
                    </>
                  ) : (
                  <>
                  {/* Seven fixed lines, Monday to Sunday: a narrow day column you can retype,
                      then the workout. The first time, earlier lines fill the days in order. */}
                  <div className="border border-neutral-400">
                  {/* At the top of the table, always shown: the body areas to train, one column,
                      each followed by how many workout lines name it. */}
                  {(() => {
                    const BODY = ["Chest", "Back – upper (lats, traps, rhomboids)", "Back – lower", "Shoulders", "Biceps", "Triceps", "Forearms and grip", "Core – abs", "Core – obliques", "Glutes", "Quads", "Hamstrings", "Calves", "Hips and adductors", "Neck", "Cardio and conditioning", "Mobility and stretching"];
                    const bp = g.body || { title: "Body areas", items: BODY.map((t, k) => ({ id: `b${k}`, text: t })) };
                    const setBp = (fields) => editGroup(g.id, (x) => ({ ...x, body: { ...(x.body || bp), ...fields } }));
                    // How many workout lines mention each area: its words found anywhere in a
                    // line, capitals aside. Shown after the area as (2).
                    const lines = weekOf(g).map((w) => String(w.text || "").toLowerCase());
                    const countOf = (t) => {
                      const k = String(t || "").trim().toLowerCase();
                      return k ? lines.filter((l) => l.includes(k)).length : 0;
                    };
                    // All the areas in one line, side by side in equal cells with a thin line
                    // between each; a long name wraps inside its cell. The + at the end adds one.
                    return (
                      <div className="flex items-stretch" style={{ backgroundColor: "#F4D3CA" }}>
                        {bp.items.map((it, k) => (
                          <div key={it.id} className={`group relative flex min-h-[19px] min-w-0 flex-1 basis-0 items-center justify-center gap-0.5 px-1 py-[2px] ${k ? "border-l border-neutral-400" : ""}`}>
                            {/* Name and count centred in the cell; the bin shows on hover, at the right. */}
                            <input
                              value={it.text}
                              onChange={(e) => setBp({ items: bp.items.map((y) => (y.id === it.id ? { ...y, text: e.target.value } : y)) })}
                              style={{ fieldSizing: "content" }}
                              className="min-w-[2ch] max-w-full bg-transparent text-center text-[11px] leading-[15px] text-neutral-900 outline-none"
                            />
                            {String(it.text || "").trim() && <span className="shrink-0 text-[11px] font-semibold leading-[15px] text-[#0f766e]">({countOf(it.text)})</span>}
                            <span className="absolute right-0.5 top-1/2 hidden -translate-y-1/2 group-hover:flex">{binBtn(() => setBp({ items: bp.items.filter((y) => y.id !== it.id) }))}</span>
                          </div>
                        ))}
                        <button
                          onClick={() => setBp({ items: [...bp.items, { id: newId(), text: "" }] })}
                          title="Add a body area"
                          className={`flex shrink-0 items-center px-1.5 text-[#0f766e] hover:text-[#0c5e57] ${bp.items.length ? "border-l border-neutral-400" : ""}`}
                        >
                          <Plus size={11} strokeWidth={3} />
                        </button>
                      </div>
                    );
                  })()}
                    {weekOf(g).map((w, wi) => {
                      return (
                      <div key={wi} className="flex items-stretch border-t border-neutral-400">
                        {/* How long: a short dropdown, the same width as the day. */}
                        <span className="flex w-[72px] shrink-0 items-start border-r border-neutral-400 px-1 py-[2px]">
                          <select
                            value={w.mins || ""}
                            onChange={(e) => editGroup(g.id, (x) => ({ ...x, week: weekOf(x).map((y, yi) => (yi === wi ? { ...y, mins: e.target.value } : y)) }))}
                            className="w-full cursor-pointer bg-transparent py-0 text-[11px] leading-[15px] text-neutral-900 outline-none"
                          >
                            {["", "30M", "60M", "75M", "90M"].map((m) => <option key={m} value={m}>{m}</option>)}
                          </select>
                        </span>
                        {/* The workout itself, one column. (Second and third columns were tried; their text stays saved.) */}
                        {["text"].map((k, ki) => (
                          <div key={k} className={`min-w-0 flex-1 basis-0 px-1.5 py-[2px] ${ki ? "border-l border-neutral-400" : ""}`}>
                            <GrowText value={w[k] || ""} onChange={(t) => editGroup(g.id, (x) => ({ ...x, week: weekOf(x).map((y, yi) => (yi === wi ? { ...y, [k]: t } : y)) }))} rows={1} />
                          </div>
                        ))}
                        <span className="flex shrink-0 items-start gap-1.5 border-l border-neutral-400 px-1.5 py-[4px]">
                          {binBtn(() => editGroup(g.id, (x) => ({ ...x, week: weekOf(x).filter((_, yi) => yi !== wi) })))}
                        </span>
                      </div>
                      );
                    })}
                  </div>
                  {/* Add sits under the frame, plain: a fresh row to fill in. */}
                  <button
                    onClick={() => editGroup(g.id, (x) => ({ ...x, week: [...weekOf(x), { day: "", mins: "", text: "", text2: "" }] }))}
                    className="mt-1 flex items-center gap-[2px] text-[11px] font-bold text-[#0f766e] hover:text-[#0c5e57]"
                  >
                    <Plus size={11} strokeWidth={3} />Add
                  </button>
                  </>
                  )}
                </div>
              )}
            </div>
          );
        })}
        <button
          onClick={() => saveGroups([...groups, { id: newId(), title: "", rows: [] }])}
          className="flex h-[22px] w-full items-center gap-[2px] border-t border-black px-2 text-[11px] font-bold text-[#0f766e] transition-colors hover:text-[#0c5e57]"
        >
          <Plus size={11} strokeWidth={3} />Add
        </button>
      </>
    );
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
  // `split`: a second column of the same width beside the first (Fitness).
  const lineBlock = (key, split = false) => (
    <>
      {listRows(key).map((m, idx) => (
        <div key={m.id} {...dropProps(key, idx, (from, to) => saveList(key, moved(lists[key], from, to)))}>
          {marker(key, idx)}
          <div className="flex items-stretch border-t border-black">
            <span className="flex min-w-0 flex-1 basis-0 items-start px-2 py-[3px]">
              <GrowText value={m.text || ""} onChange={(t) => editItem(key, m.id, { text: t })} rows={1} />
            </span>
            {split && (
              <span className="flex min-w-0 flex-1 basis-0 items-start border-l border-black px-2 py-[3px]">
                <GrowText value={m.col2 || ""} onChange={(t) => editItem(key, m.id, { col2: t })} rows={1} />
              </span>
            )}
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
            {/* With a link: the name, then a short (link) right after it. With an address
                it opens the shop, and the pencil after it changes the address. Without one, a grey
                (add link) opens the same short box. Enter or a click away saves; Esc cancels. */}
            <span className="flex w-1/4 min-w-[160px] shrink-0 items-start gap-1 px-2 py-[3px]">
              <input
                value={m.name || ""}
                onChange={(e) => editItem(key, m.id, { name: e.target.value })}
                style={withLink ? { fieldSizing: "content" } : undefined}
                className={`${withLink ? "min-w-[2ch] max-w-full" : "w-full"} bg-transparent py-0 text-[11px] leading-[15px] text-neutral-900 outline-none`}
              />
              {withLink && m.id !== "blank" && (editingLink === m.id ? (
                <input
                  autoFocus
                  value={linkDraft}
                  placeholder="paste the link"
                  onFocus={(e) => e.currentTarget.select()}
                  onChange={(e) => setLinkDraft(e.target.value)}
                  onBlur={(e) => { setLink(e.currentTarget.value.trim()); setEditingLink(null); }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.currentTarget.blur();
                    // Esc puts the old address back before leaving, so nothing changes.
                    if (e.key === "Escape") { e.currentTarget.value = link; e.currentTarget.blur(); }
                  }}
                  className="w-[15ch] min-w-0 shrink border border-neutral-400 bg-white px-1 py-0 text-[11px] leading-[15px] text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-[#0f766e]"
                />
              ) : isWebAddress(link) ? (
                <>
                  <a href={link.trim()} target="_blank" rel="noreferrer" title={link.trim()} className="shrink-0 text-[11px] leading-[15px] text-[#0f766e] hover:text-[#0c5e57]">
                    (link)
                  </a>
                  <button onClick={() => { setLinkDraft(link); setEditingLink(m.id); }} title="Change the link" className="flex h-[15px] shrink-0 items-center text-neutral-400 hover:text-neutral-900">
                    <Pencil size={10} />
                  </button>
                </>
              ) : (
                <button onClick={() => { setLinkDraft(""); setEditingLink(m.id); }} title="Add a link" className="shrink-0 text-[11px] leading-[15px] text-neutral-400 hover:text-neutral-700">
                  (add link)
                </button>
              ))}
            </span>
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
      (lists[key] || []).forEach((m) => out.push(`- ${m.text || ""}${m.col2 ? ` | ${m.col2}` : ""}`));
    };
    named("medicines", "Medicines");
    named("supplements", "Supplements");
    section("Nutrition");
    DAYS.forEach(([day, name, group]) => {
      out.push("", name);
      rowsOfDay(day).forEach((r) => out.push(`- ${r.label}: ${mealOf(day, group, r.key)}`));
    });
    out.push("", "Considerations");
    indent(nutrition.considerations);
    section("Fitness");
    (lists.fitnessGroups || []).forEach((g) => {
      out.push("", g.title || "(untitled)");
      (g.week || []).forEach((w) => out.push(`- ${w.day}${w.mins ? ` (${w.mins})` : ""}: ${w.text || ""}${w.text2 ? ` | ${w.text2}` : ""}${w.text3 ? ` | ${w.text3}` : ""}`));
      if (g.kind === "list") (g.rows || []).forEach((r) => out.push(`- ${r.text || ""}`));
      else if (!g.week) (g.rows || []).forEach((r) => out.push(`- ${r.a || ""}${r.b ? ` | ${r.b}` : ""}`));
    });
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
            const twin = twinOf[day];
            return (
              <div key={day}>
                <div
                  onClick={() => toggleDay(day)}
                  // Today's line sits on the pink, so it stands out from the other days.
                  className={`flex h-[22px] cursor-pointer select-none items-center gap-2 border-t border-black px-2 ${day === todayKey ? "bg-[#FBEFEC]" : ""}`}
                >
                  {/* Days as three letters in a fixed width, so the = marks line up exactly. */}
                  <span className={`text-[11px] leading-none text-neutral-900 ${day === "considerations" ? "" : "w-[24px] shrink-0"}`}>{day === "considerations" ? name : name.slice(0, 3)}</span>
                  {/* Days with exactly the same meals share a small circled =. */}
                  {twin && (
                    <span
                      title={twin.single ? "No other day has the same meals" : `Same meals as ${twin.days.filter((d) => d !== name).join(", ")}`}
                      // A small filled circle with a crisp equals sign drawn from two white bars,
                      // so it stays sharp at any size.
                      className="inline-flex h-[12px] w-[12px] shrink-0 flex-col items-center justify-center gap-[2px] rounded-full"
                      style={{ backgroundColor: twin.color }}
                    >
                      {!twin.single && <span className="block h-px w-[6px] bg-white" />}
                      {!twin.single && <span className="block h-px w-[6px] bg-white" />}
                    </span>
                  )}
                  <span className="flex-1" />
                  <ChevronDown size={12} className={`shrink-0 text-neutral-900 transition-transform ${open ? "rotate-180" : ""}`} />
                </div>
                {open && day !== "considerations" && (
                  <div className="border-t border-black px-2 py-1.5" style={{ backgroundColor: "#FBEFEC" }}>
                    {/* A thin framed grid on the pink: Meal or Extra on the left, what it is on the
                        right. (A second, amber set was tried and set aside; its text stays saved.) */}
                    {/* The day's lines: each a label (Meal, Extra, or anything you type) and what
                        it is; lines can be added under the frame and binned. */}
                    <div className="border border-neutral-400">
                      {rowsOfDay(day).map((r, mi) => (
                        <div key={r.id} {...dropProps(`nut-${day}`, mi, (from, to) => saveDayRows(day, moved(rowsOfDay(day), from, to)))}>
                        {marker(`nut-${day}`, mi)}
                        {/* A line labelled "In consideration" stands out: red text on a slightly deeper pink. */}
                        <div className={`flex items-stretch ${mi ? "border-t border-neutral-400" : ""} ${/^\s*in consideration/i.test(r.label || "") ? "bg-[#F4D3CA] [&_textarea]:text-[#C1440E] [&_.red-base]:text-[#C1440E]" : ""}`}>
                          {/* A wider label that wraps, so a longer name grows the line rather than hiding. */}
                          <div className="w-[100px] shrink-0 border-r border-neutral-400 px-1.5 py-[2px]">
                            <GrowText value={r.label || ""} onChange={(t) => saveDayRows(day, rowsOfDay(day).map((x) => (x.id === r.id ? { ...x, label: t } : x)))} rows={1} />
                          </div>
                          <div className="min-w-0 flex-1 px-1.5 py-[2px]">
                            <RedWords value={mealOf(day, group, r.key)} onChange={(t) => saveDayMeal(day, r.key, t)} />
                          </div>
                          {/* The grip sits just left of the bin. */}
                          <span className="flex shrink-0 items-start gap-1.5 border-l border-neutral-400 px-1.5 py-[4px]">
                            {grip(`nut-${day}`, mi, true)}
                            <button onClick={() => setListConfirm({ run: () => saveDayRows(day, rowsOfDay(day).filter((x) => x.id !== r.id)) })} title="Remove" className="shrink-0 text-neutral-900 hover:text-[#C1440E]">
                              <Trash2 size={11} />
                            </button>
                          </span>
                        </div>
                        </div>
                      ))}
                      {marker(`nut-${day}`, rowsOfDay(day).length)}
                    </div>
                    <button
                      onClick={() => { const key = newId(); saveDayRows(day, [...rowsOfDay(day), { id: key, label: "", key }]); }}
                      className="mt-1 flex items-center gap-[2px] text-[11px] font-bold text-[#0f766e] hover:text-[#0c5e57]"
                    >
                      <Plus size={11} strokeWidth={3} />Add
                    </button>
                  </div>
                )}
                {open && day === "considerations" && (
                  <div className="flex items-start gap-2 border-t border-black px-2 py-1 [&_textarea]:text-[#C1440E]" style={{ backgroundColor: "#F4D3CA" }}>
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
        {/* Fitness+Look follows straight on, no grey band before it. */}
        <div className="flex h-[22px] items-center border-t border-black px-2" style={{ backgroundColor: BAR_BG }}>
          <span className={head}>Fitness+Look</span>
        </div>
        {notesLoaded && fitnessBlock()}
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
        {/* The grey band closes the table, as it opens it. */}
        <div className="h-[10px] border-t border-black" style={{ backgroundColor: GAP_BG }} />
      </div>

      {err && <p className="pt-2 text-[11px] font-semibold text-[#C1440E]">{err}</p>}

      {listConfirm != null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={() => setListConfirm(null)}>
          <div className="w-full max-w-sm border-[5px] bg-white p-6 text-center shadow-2xl" style={{ borderColor: "#C1440E" }} onClick={(e) => e.stopPropagation()}>
            <p className="text-[14px] font-bold uppercase tracking-[0.06em] text-neutral-900 [overflow-wrap:anywhere]">Delete this?</p>
            <div className="mt-5 flex justify-center gap-3 text-[12px] font-bold uppercase tracking-wide">
              <button
                onClick={() => { if (listConfirm.run) listConfirm.run(); else saveList(listConfirm.key, lists[listConfirm.key].filter((x) => x.id !== listConfirm.id)); setListConfirm(null); }}
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
            <p className="text-[14px] font-bold uppercase tracking-[0.06em] text-neutral-900 [overflow-wrap:anywhere]">Delete this?</p>
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

// A conversation with Claude for Bible questions, under the G entry, and for fashion tips,
// under the Clothes line in Looks. Every question and answer is saved with its entry in
// Supabase, so it is all there next time.
function BibleChat({ chat, onChange, topic = "bible" }) {
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
      // A dropped connection is tried once more by itself before giving up.
      const send = () => fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${data?.session?.access_token || ""}` },
        body: JSON.stringify({ messages: asked, topic }),
      });
      let r;
      try { r = await send(); } catch {
        await new Promise((ok) => setTimeout(ok, 1500));
        try { r = await send(); } catch { throw new Error("The connection dropped before Claude answered. Please ask again."); }
      }
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
      {/* Always there, so both chat boxes look the same, empty or not. */}
      <button
        onClick={() => onChange([])}
        // A tiny frame tucked into the box's top right corner, sharing its border.
        className="absolute -right-px -top-px border border-black bg-white px-1.5 text-[10px] leading-[14px] text-neutral-900 hover:text-[#C1440E]"
      >
        Clear
      </button>
      {chat.map((m, i) => (
        // Your questions in bold black; Claude's answers in a strong deep blue, a touch heavier, so they read easily.
        <p key={i} className={`mb-1.5 whitespace-pre-wrap text-[11px] leading-[16px] ${m.role === "user" ? "pr-12 font-bold text-neutral-900" : "font-medium text-[#1e3a8a]"}`}>
          {m.role === "user" ? m.content : linkify(m.content)}
        </p>
      ))}
      {busy && <p className="mb-1.5 text-[11px] italic text-neutral-500">Claude is thinking…</p>}
      {error && <p className="mb-1.5 text-[11px] font-semibold text-[#C1440E]">{error}</p>}
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(); } }}
        rows={2}
        className={`block w-full resize-none bg-transparent text-[11px] leading-[15px] text-neutral-900 outline-none ${chat.length ? "" : "pr-12"}`}
      />
    </div>
  );
}

// Web addresses in an answer become underlined links that open in a new tab.
const linkify = (t) =>
  String(t || "").split(/(https?:\/\/[^\s)\]]+)/g).map((part, k) =>
    /^https?:\/\//.test(part) ? (
      <a key={k} href={part.replace(/[.,;:]+$/, "")} target="_blank" rel="noreferrer" className="break-all underline">
        {part}
      </a>
    ) : (
      part
    )
  );

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
  // Two colour buttons: one turns the highlighted words red, the other black.
  const red = () => run("foreColor", INK_RED);
  const black = () => run("foreColor", "#171717");
  const btn = "flex h-4 w-4 items-center justify-center text-neutral-900 hover:text-[#9c7c33]";
  const keep = (e) => e.preventDefault();
  return (
    <>
      <div className="-mx-2 mb-1.5 flex items-center gap-1 border-b border-[#C1440E] px-2 pb-1">
        <button onMouseDown={keep} onClick={() => run("bold")} title="Bold the highlighted words" className="-m-1 flex h-6 w-6 items-center justify-center rounded text-neutral-900 hover:bg-black/5">
          <span className="flex h-3 w-3 -translate-y-px items-center justify-center text-[17px] font-black leading-none">B</span>
        </button>
        <button onMouseDown={keep} onClick={red} title="Turn the highlighted words red" className="-m-1 flex h-6 w-6 items-center justify-center rounded hover:bg-black/5">
          <span className="block h-3 w-3 rounded-[2px]" style={{ backgroundColor: INK_RED }} />
        </button>
        <button onMouseDown={keep} onClick={black} title="Turn the highlighted words black" className="-m-1 flex h-6 w-6 items-center justify-center rounded hover:bg-black/5">
          <span className="block h-3 w-3 rounded-[2px]" style={{ backgroundColor: "#171717" }} />
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
// Words that always show in red wherever they appear in a Nutrition line.
const RED_WORDS = ["and Al Natura bread"];
// A text box whose chosen words read in red. The words are drawn underneath in colour and
// the box sits on top with clear letters, so typing stays exactly as in any other box.
function RedWords({ value, onChange }) {
  const text = String(value || "");
  const parts = [];
  const re = new RegExp(RED_WORDS.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"), "gi");
  let last = 0;
  for (const m of text.matchAll(re)) {
    if (m.index > last) parts.push([text.slice(last, m.index), false]);
    parts.push([m[0], true]);
    last = m.index + m[0].length;
  }
  parts.push([text.slice(last), false]);
  const font = "text-[11px] leading-[15px] whitespace-pre-wrap break-words";
  return (
    <div className="relative">
      <div aria-hidden className={`red-base ${font} text-neutral-900`}>
        {parts.map(([t, red], k) => (red ? <span key={k} className="text-[#C1440E]">{t}</span> : <span key={k}>{t}</span>))}
        {/* Keeps the last line its full height, even when it ends in a line break. */}
        {"​"}
      </div>
      <textarea
        value={text}
        onChange={(e) => onChange(e.target.value)}
        spellCheck
        className={`absolute inset-0 block h-full w-full resize-none overflow-hidden bg-transparent p-0 !text-transparent caret-neutral-900 outline-none ${font}`}
      />
    </div>
  );
}

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

