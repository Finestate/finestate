import { useEffect, useRef, useState } from "react";
import { AppWindow, Bookmark, Columns2, ExternalLink, GripVertical, Pencil, Trash2 } from "lucide-react";
import { supabase } from "./lib/supabaseClient.js";

// The bookmarks that used to live in Chrome. They hold private links (sheets, drives,
// logins), so they live in Supabase, never in this public repo. Each opens in a new tab.
const DOC_ID = "bookmarks";
const BAR_BG = "#F2C46D";
const head = "text-[11px] font-bold uppercase leading-[15px] tracking-[0.06em] text-neutral-900";

// Reads a Chrome bookmarks export: every folder that holds links becomes a section, and
// Chrome's "____" divider lines split a section into groups. Script links are left out.
function parseChrome(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const sections = [];
  const walk = (dl, name) => {
    const groups = [[]];
    // Placed before its subfolders, so the sections keep Chrome's order.
    const section = { name, groups };
    sections.push(section);
    for (const dt of dl.querySelectorAll(":scope > dt")) {
      const h3 = dt.querySelector(":scope > h3");
      const a = dt.querySelector(":scope > a");
      if (h3) {
        const sub = dt.querySelector(":scope > dl");
        if (sub) walk(sub, h3.textContent.trim());
      } else if (a) {
        const href = a.getAttribute("href") || "";
        const title = a.textContent.trim();
        if (href === "about:blank" || /^_+$/.test(title)) {
          if (groups[groups.length - 1].length) groups.push([]);
        } else if (/^https?:/i.test(href)) {
          groups[groups.length - 1].push({ title: title || href, href });
        }
      }
    }
    section.groups = groups.filter((g) => g.length);
  };
  const top = doc.querySelector("dl");
  if (top) walk(top, "Bookmarks");
  return sections.filter((s) => s.groups.length);
}

// Three ways to open a link, like Chrome's own. A site cannot start Chrome's split view
// itself, so "side by side" opens its own window filling the right half of the screen.
const OPENERS = [
  { key: "tab", icon: ExternalLink, title: "New tab", run: (href) => window.open(href, "_blank", "noopener") },
  {
    key: "window",
    icon: AppWindow,
    title: "New window",
    run: (href) => window.open(href, "_blank", `noopener,popup,width=${Math.round(screen.availWidth * 0.8)},height=${Math.round(screen.availHeight * 0.85)}`),
  },
  {
    key: "split",
    icon: Columns2,
    title: "Split screen",
    run: (href) => {
      const w = Math.round(screen.availWidth / 2);
      window.open(href, "_blank", `noopener,popup,width=${w},height=${screen.availHeight},left=${(screen.availLeft || 0) + w},top=${screen.availTop || 0}`);
    },
  },
];

export default function Bookmarks() {
  const [data, setData] = useState(null); // { sections: [...] }
  const [err, setErr] = useState("");
  const fileRef = useRef(null);
  const [drafts, setDrafts] = useState({}); // the blank line at the foot of each column
  const [confirm, setConfirm] = useState(null);

  const save = (next) => {
    setData(next);
    supabase.from("admin_docs").upsert({ id: DOC_ID, data: next, updated_at: new Date().toISOString() })
      .then(({ error }) => { if (error) setErr(error.message); });
  };
  // A new link goes to the foot of the column. A link typed without http gets https.
  const addLink = (si) => {
    const d = drafts[si] || {};
    const title = (d.title || "").trim();
    let href = (d.href || "").trim();
    if (!href) return;
    if (!/^https?:\/\//i.test(href)) href = "https://" + href;
    const sections = data.sections.map((s, i) => {
      if (i !== si) return s;
      const groups = s.groups.length ? s.groups.map((g) => g.slice()) : [[]];
      groups[groups.length - 1].push({ title: title || href, href });
      return { ...s, groups };
    });
    save({ ...data, sections });
    setDrafts({ ...drafts, [si]: {} });
  };
  // Editing one link in place: its name and its address.
  const [editing, setEditing] = useState(null); // { si, gi, bi, title, href }
  const saveEdit = () => {
    const e = editing;
    setEditing(null);
    if (!e) return;
    let href = e.href.trim();
    if (!href) return;
    if (!/^https?:\/\//i.test(href)) href = "https://" + href;
    const title = e.title.trim() || href;
    const sections = data.sections.map((sec, i) =>
      i !== e.si ? sec : { ...sec, groups: sec.groups.map((g, j) => (j !== e.gi ? g : g.map((b, k) => (k === e.bi ? { ...b, title, href } : b)))) }
    );
    save({ ...data, sections });
  };
  // Moving a link by its grip: to any place in any column, a red line shows where.
  const [drag, setDrag] = useState(null); // { si, gi, bi }
  const [dropAt, setDropAt] = useState(null); // { si, gi, bi } – lands before that spot
  const moveLink = () => {
    const from = drag;
    const to = dropAt;
    setDrag(null);
    setDropAt(null);
    if (!from || !to) return;
    const sections = data.sections.map((sec) => ({ ...sec, groups: sec.groups.map((g) => g.slice()) }));
    const [link] = sections[from.si].groups[from.gi].splice(from.bi, 1);
    let at = to.bi;
    if (from.si === to.si && from.gi === to.gi && from.bi < to.bi) at -= 1;
    sections[to.si].groups[to.gi].splice(at, 0, link);
    save({ ...data, sections: sections.map((sec) => ({ ...sec, groups: sec.groups.filter((g) => g.length) })) });
  };
  const removeLink = (si, gi, bi) => {
    const sections = data.sections.map((s, i) =>
      i !== si ? s : { ...s, groups: s.groups.map((g, j) => (j !== gi ? g : g.filter((_, k) => k !== bi))).filter((g) => g.length) }
    );
    save({ ...data, sections });
  };

  useEffect(() => {
    supabase
      .from("admin_docs")
      .select("data")
      .eq("id", DOC_ID)
      .maybeSingle()
      .then(({ data: row, error }) => {
        if (error) setErr(error.message);
        setData(row?.data || { sections: [] });
      });
  }, []);

  const importFile = async (file) => {
    if (!file) return;
    try {
      const sections = parseChrome(await file.text());
      if (!sections.length) throw new Error("No links were found in that file.");
      const next = { sections };
      const { error } = await supabase.from("admin_docs").upsert({ id: DOC_ID, data: next, updated_at: new Date().toISOString() });
      if (error) throw error;
      setData(next);
      setErr("");
    } catch (e) {
      setErr(e.message || "Could not read that file.");
    }
  };

  if (!data) return null;
  const empty = !data.sections.length;
  const count = data.sections.reduce((n, s) => n + s.groups.reduce((m, g) => m + g.length, 0), 0);

  return (
    <div className="w-full">
      <div className="w-full border border-black bg-white shadow-sm">
        {/* Title: the page's own mark, its name and how many links it holds. */}
        <div className="flex h-[26px] items-center gap-1.5 border-b border-black px-2" style={{ backgroundColor: BAR_BG }}>
          <Bookmark size={13} strokeWidth={2.5} className="shrink-0 fill-neutral-900 text-neutral-900" />
          <span className="text-[13px] font-bold uppercase tracking-[0.08em] text-neutral-900">Bookmarks</span>
          <span className="flex-1 pl-1 text-[11px] text-neutral-700">
            {count} {count === 1 ? "link" : "links"}
          </span>
          {/* Only while the page is empty: importing again would replace everything. */}
          {empty && (
            <button
              onClick={() => fileRef.current?.click()}
              className="text-[11px] font-semibold text-[#0f766e] underline underline-offset-2 hover:text-[#0c5e57]"
            >
              Import from Chrome
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept=".html,text/html"
            className="hidden"
            onChange={(e) => { importFile(e.target.files?.[0]); e.target.value = ""; }}
          />
        </div>

        {empty && (
          <p className="px-2 py-1 text-[11px] italic text-neutral-500">
            No bookmarks yet. Click Import from Chrome and pick the bookmarks file you exported.
          </p>
        )}

        {/* One column per Chrome folder, side by side, links listed down in Chrome's order. */}
        {!empty && (
        <div className="grid items-start" style={{ gridTemplateColumns: `repeat(${data.sections.length}, minmax(0, 1fr))` }}>
        {data.sections.map((s, si) => (
          <div key={si} className={si > 0 ? "border-l border-black" : ""}>
            {s.groups.map((g, gi) => (
              <div
                key={gi}
                className={`flex flex-col gap-1 px-2 py-1.5 ${gi > 0 ? "border-t border-neutral-300" : ""}`}
                onDragOver={(e) => { if (drag) { e.preventDefault(); if (e.target === e.currentTarget) setDropAt({ si, gi, bi: g.length }); } }}
                onDrop={(e) => { e.preventDefault(); moveLink(); }}
              >
                {g.map((b, bi) => {
                  const isEdit = editing && editing.si === si && editing.gi === gi && editing.bi === bi;
                  const marked = drag && dropAt && dropAt.si === si && dropAt.gi === gi;
                  return (
                  <div key={bi}>
                  {marked && dropAt.bi === bi && <div className="h-[2px] w-full bg-[#C1440E]" />}
                  <div
                    className={`flex items-center gap-1.5 border border-neutral-300 bg-white px-1.5 ${drag && drag.si === si && drag.gi === gi && drag.bi === bi ? "opacity-40" : ""}`}
                    onDragOver={(e) => {
                      if (!drag) return;
                      e.preventDefault();
                      e.stopPropagation();
                      const box = e.currentTarget.getBoundingClientRect();
                      setDropAt({ si, gi, bi: e.clientY < box.top + box.height / 2 ? bi : bi + 1 });
                    }}
                  >
                    {isEdit ? (
                      <>
                        {[["title", "w-1/3"], ["href", "flex-1"]].map(([f, w]) => (
                          <input
                            key={f}
                            autoFocus={f === "title"}
                            value={editing[f]}
                            onChange={(e) => setEditing({ ...editing, [f]: e.target.value })}
                            onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") setEditing(null); }}
                            className={`${w} min-w-0 border border-neutral-500 bg-white px-1 text-[11px] leading-[15px] text-neutral-900 outline-none`}
                          />
                        ))}
                        <button onClick={saveEdit} className="shrink-0 text-[11px] font-semibold text-[#0f766e] underline underline-offset-2 hover:text-[#0c5e57]">Save</button>
                      </>
                    ) : (
                    <a
                      href={b.href}
                      target="_blank"
                      rel="noreferrer"
                      title={b.href}
                      className="min-w-0 flex-1 truncate text-[11px] leading-[17px] text-[#0f766e] underline underline-offset-2 hover:text-[#0c5e57]"
                    >
                      {b.title}
                    </a>
                    )}
                    {!isEdit && OPENERS.map((o) => (
                      <button key={o.key} onClick={() => o.run(b.href)} title={o.title} className="shrink-0 text-neutral-900 hover:text-[#0f766e]">
                        <o.icon size={11} />
                      </button>
                    ))}
                    {!isEdit && <span className="h-[11px] w-px shrink-0 bg-neutral-300" />}
                    {!isEdit && (
                    <button
                      onClick={() => setEditing({ si, gi, bi, title: b.title, href: b.href })}
                      title="Edit this link"
                      className="shrink-0 text-neutral-900 hover:text-[#0f766e]"
                    >
                      <Pencil size={11} />
                    </button>
                    )}
                    <span
                      draggable
                      onDragStart={() => setDrag({ si, gi, bi })}
                      onDragEnd={() => { setDrag(null); setDropAt(null); }}
                      title="Drag to move"
                      className="shrink-0 cursor-grab text-neutral-400 active:cursor-grabbing"
                    >
                      <GripVertical size={11} />
                    </span>
                    <button
                      onClick={() => setConfirm({ run: () => removeLink(si, gi, bi), question: `Delete ${b.title}?` })}
                      title="Delete this link"
                      className="shrink-0 text-neutral-900 hover:text-[#C1440E]"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                  </div>
                  );
                })}
                {drag && dropAt && dropAt.si === si && dropAt.gi === gi && dropAt.bi === g.length && <div className="h-[2px] w-full bg-[#C1440E]" />}
              </div>
            ))}
            {/* Always a blank line ready: a name, the link, Enter to add. */}
            <div className="flex items-center gap-1 border-t border-neutral-300 px-2 py-1">
              {[["title", "Name", "w-1/3"], ["href", "Link", "flex-1"]].map(([f, ph, w]) => (
                <input
                  key={f}
                  value={drafts[si]?.[f] || ""}
                  placeholder={ph}
                  onChange={(e) => setDrafts({ ...drafts, [si]: { ...(drafts[si] || {}), [f]: e.target.value } })}
                  onKeyDown={(e) => { if (e.key === "Enter") addLink(si); }}
                  className={`${w} min-w-0 border border-neutral-300 bg-white px-1 text-[11px] leading-[15px] text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-neutral-500`}
                />
              ))}
              <button onClick={() => addLink(si)} className="shrink-0 text-[11px] font-semibold text-[#0f766e] underline underline-offset-2 hover:text-[#0c5e57]">Add</button>
            </div>
          </div>
        ))}
        </div>
        )}
      </div>
      {err && <p className="pt-2 text-[11px] font-semibold text-[#C1440E]">{err}</p>}

      {/* The warning: a heavy red frame, the question in bold, a solid button to go ahead. */}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={() => setConfirm(null)}>
          <div className="w-full max-w-sm border-[5px] bg-white p-6 text-center shadow-2xl" style={{ borderColor: "#C1440E" }} onClick={(e) => e.stopPropagation()}>
            <p className="text-[14px] font-bold uppercase tracking-[0.06em] text-neutral-900">{confirm.question}</p>
            <div className="mt-5 flex justify-center gap-3 text-[12px] font-bold uppercase tracking-wide">
              <button
                onClick={() => { confirm.run(); setConfirm(null); }}
                className="border-2 px-5 py-1.5 text-white transition-opacity hover:opacity-80"
                style={{ backgroundColor: "#C1440E", borderColor: "#C1440E" }}
              >
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
