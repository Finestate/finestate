import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Trash2, RefreshCw, Settings, ChevronDown, Folder } from "lucide-react";
import { supabase } from "./lib/supabaseClient.js";

// Intel: ten tabs, each one named by you and holding as many RSS or Google Alerts
// addresses as you like. Everything is kept in Supabase, so it follows you between
// devices, and the sheet under the tabs stays blank until a feed returns something.
const DOC_ID = "knowledge-feeds";
// Five tabs to start with; the plus at the end adds the next one when they fill up.
const SLOTS = 5;
const BAR_BG = "#F2C46D";  // title bar, as on every other table here
const TAB_BG = "#FFE4B3";  // the strip the folder tabs sit on
const FOLD_BG = "#F7D9A3"; // a closed folder tab
const OPEN_TAB_BG = "#FBE3DC"; // the tab you are on, a light pink red
// The folder shape, and the same shape a hair inside it, which leaves the outline.
const FOLD_CUT = "polygon(9px 0, 100% 0, calc(100% - 9px) 100%, 0 100%)";
const FOLD_CUT_INNER = "polygon(10px 1px, calc(100% - 1px) 1px, calc(100% - 10px) 100%, 1px 100%)";
const BODY_BG = "#FFFFFF"; // the sheet the stories sit on
const RED = "#C1440E";

let _idc = 0;
const newId = () => "s" + Date.now().toString(36) + "-" + (_idc++);

// A tab holds feeds, each one a name and its address, so the keywords stay readable.
const blankSlot = () => ({ id: newId(), name: "", urls: [] });
const toFeed = (u) => (typeof u === "string" ? { id: newId(), name: "", url: u } : { id: u.id || newId(), name: u.name || "", url: u.url || "" });

// Older saves held one address per tab; they become tabs with a single address.
const toSlots = (data) => {
  const list = Array.isArray(data) ? data : [];
  const slots = list.map((x) =>
    x && Array.isArray(x.urls)
      ? { id: x.id || newId(), name: x.name || "", urls: x.urls.map(toFeed) }
      : { id: x?.id || newId(), name: x?.name || "", urls: x?.url ? [toFeed(x.url)] : [] }
  );
  // Trailing empties from an earlier ten tab layout are dropped, then the row is
  // padded back up to five.
  while (slots.length > SLOTS && !slots[slots.length - 1].name && !slots[slots.length - 1].urls.length) slots.pop();
  while (slots.length < SLOTS) slots.push(blankSlot());
  return slots;
};

// Atom entries and RSS items both reduce to a headline, a link and a date.
function parseFeedXml(xmlText) {
  const doc = new DOMParser().parseFromString(xmlText, "text/xml");
  return Array.from(doc.querySelectorAll("entry, item")).map((entry) => {
    const isAtom = entry.tagName.toLowerCase() === "entry";
    let link = "";
    if (isAtom) {
      const linkEl = entry.querySelector("link");
      link = linkEl?.getAttribute("href") || "";
      const base = linkEl?.getAttribute("xml:base");
      if (link && base && !/^https?:\/\//i.test(link)) {
        link = base.replace(/\/$/, "") + "/" + link.replace(/^\//, "");
      }
    } else {
      link = entry.querySelector("link")?.textContent || "";
    }
    return {
      title: plain(entry.querySelector("title")?.textContent || ""),
      link: cleanLink(link),
      published: isAtom
        ? entry.querySelector("published")?.textContent || entry.querySelector("updated")?.textContent || ""
        : entry.querySelector("pubDate")?.textContent || "",
      summary: plain(
        isAtom
          ? entry.querySelector("content")?.textContent || entry.querySelector("summary")?.textContent || ""
          : entry.querySelector("description")?.textContent || ""
      ),
    };
  });
}

const plain = (s) => String(s || "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();

// Google Alerts wraps every link in its own redirect; the real address sits in `url`.
const cleanLink = (href) => {
  try {
    const u = new URL(href);
    const inner = u.searchParams.get("url") || u.searchParams.get("q");
    return inner && /^https?:\/\//i.test(inner) ? inner : href;
  } catch {
    return href;
  }
};

// A story arrives as many short paragraphs; this runs them together and cuts even
// blocks at the end of a sentence, so the reading is steady rather than choppy.
const BLOCK = 700;
const blocks = (text) => {
  const flat = String(text || "").replace(/\s+/g, " ").trim();
  const out = [];
  let rest = flat;
  // Hard stop as well as the length test, so a strange page can never spin here.
  let guard = 0;
  while (rest.length > BLOCK && guard++ < 60) {
    const window = rest.slice(0, BLOCK + 200);
    let cut = window.lastIndexOf(". ", BLOCK);
    if (cut < BLOCK * 0.5) cut = window.indexOf(". ", BLOCK);
    if (cut < 0) cut = BLOCK;
    out.push(rest.slice(0, cut + 1).trim());
    rest = rest.slice(cut + 1).trim();
  }
  if (rest) out.push(rest);
  return out;
};

const dedupe = (items) => {
  const seen = new Set();
  return items.filter((i) => (seen.has(i.link) ? false : seen.add(i.link)));
};

// Only how long ago it landed, no date.
const when = (s) => {
  const d = new Date(s);
  if (isNaN(d)) return "";
  const mins = Math.round((Date.now() - d) / 60000);
  return mins < 60 ? `${Math.max(mins, 1)} min` : `${Math.round(mins / 60)} h`;
};

// Nothing older than a day shows.
const isFresh = (s) => {
  const d = new Date(s);
  return !isNaN(d) && Date.now() - d <= 24 * 60 * 60 * 1000;
};

export default function KnowledgeFeeds() {
  const [slots, setSlots] = useState(toSlots([]));
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(0); // which tab is open, by position
  const [items, setItems] = useState({}); // slot id -> parsed entries
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [settings, setSettings] = useState(false); // the popup for the open tab
  const [newName, setNewName] = useState(""); // the keywords for the feed being added
  const [newUrl, setNewUrl] = useState("");
  const [story, setStory] = useState({}); // link -> text, or "loading"
  const pulled = useRef({});

  // The arrow asks for a short summary of whatever in the story bears on investing.
  const readStory = async (link) => {
    if (story[link]) {
      setStory((prev) => ({ ...prev, [link]: undefined }));
      return;
    }
    setStory((prev) => ({ ...prev, [link]: "loading" }));
    try {
      const res = await fetch(`/api/summarise?url=${encodeURIComponent(link)}`);
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Could not summarise that page");
      setStory((prev) => ({ ...prev, [link]: data.summary || "No summary came back." }));
    } catch (e) {
      setStory((prev) => ({ ...prev, [link]: e.message || "Could not summarise that page." }));
    }
  };

  useEffect(() => {
    supabase
      .from("admin_docs")
      .select("data")
      .eq("id", DOC_ID)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) setErr(error.message);
        setSlots(toSlots(data?.data));
        setLoaded(true);
      });
  }, []);

  const save = (next) => {
    setSlots(next);
    supabase
      .from("admin_docs")
      .upsert({ id: DOC_ID, data: next, updated_at: new Date().toISOString() })
      .then(({ error }) => setErr(error ? error.message : ""));
  };

  const slot = slots[open] || blankSlot();
  const patchSlot = (fields) => save(slots.map((s, i) => (i === open ? { ...s, ...fields } : s)));

  const pull = async (s, force) => {
    if (!s || !s.urls.length || (!force && pulled.current[s.id])) return;
    pulled.current[s.id] = true;
    setBusy(true);
    try {
      const all = await Promise.all(
        s.urls.map(async ({ url }) => {
          const res = await fetch(`/api/rss?url=${encodeURIComponent(url)}`);
          const xml = await res.text();
          if (!res.ok) throw new Error(plain(xml).slice(0, 80));
          return parseFeedXml(xml);
        })
      );
      setItems((prev) => ({ ...prev, [s.id]: all.flat() }));
      setErr("");
    } catch (e) {
      setErr(e.message || "A feed could not be read.");
    } finally {
      setBusy(false);
    }
  };

  // Reads the open tab once, and again whenever its feed list changes.
  useEffect(() => {
    if (loaded) pull(slots[open]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, loaded, slots[open]?.urls.length]);

  const rows = useMemo(
    () =>
      dedupe(
        (items[slot.id] || [])
          .filter((r) => isFresh(r.published))
          .sort((a, b) => new Date(b.published) - new Date(a.published))
      ),
    [items, slot.id]
  );

  const addUrl = () => {
    const url = newUrl.trim();
    if (!/^https:\/\//i.test(url)) {
      setErr("Paste an https feed address.");
      return;
    }
    const next = { ...slot, urls: [...slot.urls, { id: newId(), name: newName.trim(), url }] };
    patchSlot({ urls: next.urls });
    pulled.current[slot.id] = false;
    setNewUrl("");
    setNewName("");
    setErr("");
    // Read it straight away rather than waiting for the tab to be opened again.
    pull(next, true);
  };

  const patchUrl = (id, fields) => patchSlot({ urls: slot.urls.map((u) => (u.id === id ? { ...u, ...fields } : u)) });

  const removeUrl = (id) => {
    patchSlot({ urls: slot.urls.filter((u) => u.id !== id) });
    pulled.current[slot.id] = false;
    setItems((prev) => ({ ...prev, [slot.id]: [] }));
  };

  return (
    <div className="w-full overflow-x-auto">
      <div className="w-full min-w-[720px] overflow-hidden border border-black shadow-sm" style={{ backgroundColor: BODY_BG }}>
        {/* Title bar exactly as the Planning table: 18px, gold, name on the left. */}
        <div className="flex h-[18px] items-center px-2" style={{ backgroundColor: BAR_BG }}>
          <span className="text-[11px] font-bold uppercase leading-[15px] tracking-[0.06em] text-neutral-900">Intel</span>
        </div>

        {/* Every tab opens, named or not; the cog names it and adds feeds. The plus at
            the end opens one more tab once these are used up. */}
        {/* Tabs on the second gold, one hairline each, the open one white. */}
        {/* File folder tabs: each one cut to the shape of a folder and set to overlap
            its neighbour, the open one white and sitting on top. */}
        {/* Plain square tabs, flush against each other, no gaps anywhere. */}
        <div className="flex border-t border-b border-black">
          {slots.map((s, i) => (
            <button
              key={s.id}
              onClick={() => setOpen(i)}
              title={s.name || "Free tab"}
              className={`flex h-[21px] min-w-0 flex-1 items-center justify-center gap-1.5 px-2 text-[10px] font-bold uppercase leading-none tracking-[0.08em] transition-colors ${
                i === 0 ? "" : "border-l border-black"
              } ${i === open ? "text-neutral-900" : "text-neutral-600 hover:text-neutral-900"}`}
              style={{ backgroundColor: i === open ? OPEN_TAB_BG : TAB_BG }}
            >
              <span className="min-w-0 truncate text-center">{s.name || "–"}</span>
              {(items[s.id]?.length || 0) > 0 && (
                <span className="shrink-0 text-[9px] font-semibold tabular-nums text-neutral-500">{items[s.id].length}</span>
              )}
            </button>
          ))}
          <button
            onClick={() => { const next = [...slots, blankSlot()]; save(next); setOpen(next.length - 1); setSettings(true); }}
            title="Add another tab"
            className="flex h-[21px] w-8 shrink-0 items-center justify-center border-l border-black text-neutral-600 transition-colors hover:text-neutral-900"
            style={{ backgroundColor: TAB_BG }}
          >
            <Plus size={11} />
          </button>
        </div>

        {/* No padding on the sheet, so every rule runs edge to edge. */}
        <div className="min-h-[200px]">
          <div className="flex items-center gap-2 px-2 py-1">
            <span className="flex-1" />
            <button onClick={() => pull(slot, true)} title="Refresh" className="text-neutral-400 transition-colors hover:text-neutral-700">
              <RefreshCw size={12} className={busy ? "animate-spin" : ""} />
            </button>
            <button onClick={() => setSettings(true)} title="Name this tab and add feeds" className="text-neutral-400 transition-colors hover:text-neutral-700">
              <Settings size={12} />
            </button>
          </div>

          {rows.map((r, i) => {
            const shown = story[r.link];
            return (
              // A click anywhere on the row opens the summary; the headline itself
              // still goes to the story.
              <div
                key={`${r.link}-${i}`}
                onClick={() => readStory(r.link)}
                title={shown ? "Close" : "Summary for investing"}
                className={`cursor-pointer px-2 py-1 ${i === 0 ? "" : "border-t border-black"}`}
              >
                <div className="flex items-start gap-2">
                  <a
                    href={r.link}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="min-w-0 flex-1 truncate text-[11px] font-medium leading-[15px] underline underline-offset-2"
                    style={{ color: "#0f766e" }}
                    title={r.title}
                  >
                    {r.title}
                  </a>
                  <span className="shrink-0 whitespace-nowrap text-[10px] leading-[15px] tabular-nums text-neutral-400">{when(r.published)}</span>
                </div>
                {!shown && r.summary && <p className="mt-0.5 truncate text-[10px] leading-[14px] text-neutral-500">{r.summary}</p>}
                {shown && shown !== "loading" && (
                  <p className="mt-1 text-[11px] leading-[16px] text-neutral-700">{shown}</p>
                )}
                {shown === "loading" && <p className="mt-1 text-[10px] leading-[14px] text-neutral-400">Summarising…</p>}
              </div>
            );
          })}
        </div>
      </div>

      {err && <p className="pt-2 text-[11px] font-semibold text-[#C1440E]">{err}</p>}

      {settings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={() => setSettings(false)}>
          {/* A table like every other one here: title bar, column heads, then a row
              per feed with its name on the left and its address on the right. */}
          <div className="w-full max-w-2xl border-[3px] border-black bg-white p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex h-[21px] items-center gap-2">
              <input
                autoFocus
                value={slot.name}
                onChange={(e) => patchSlot({ name: e.target.value.toUpperCase() })}
                placeholder="TAB NAME"
                className="min-w-0 flex-1 bg-transparent text-[11px] font-bold uppercase leading-[15px] tracking-[0.06em] text-neutral-900 outline-none placeholder:text-neutral-500"
              />
            </div>

            <div className="mt-2 flex h-[18px] items-center gap-2">
              <span className="w-48 shrink-0 text-[11px] font-bold uppercase leading-[15px] tracking-[0.06em] text-neutral-900">Feed name</span>
              <span className="min-w-0 flex-1 text-[11px] font-bold uppercase leading-[15px] tracking-[0.06em] text-neutral-900">Link</span>
              <span className="w-4 shrink-0" />
            </div>

            {slot.urls.map((u) => (
              <div key={u.id} className="flex h-[21px] items-center gap-2">
                <input
                  value={u.name}
                  onChange={(e) => patchUrl(u.id, { name: e.target.value })}
                  placeholder="Keywords"
                  className="w-48 shrink-0 bg-transparent text-[11px] leading-[15px] text-neutral-900 outline-none placeholder:text-neutral-300"
                />
                <input
                  value={u.url}
                  onChange={(e) => patchUrl(u.id, { url: e.target.value })}
                  className="min-w-0 flex-1 bg-transparent text-[11px] leading-[15px] text-neutral-500 outline-none"
                />
                <button onClick={() => removeUrl(u.id)} title="Remove this feed" className="flex h-[15px] w-4 shrink-0 items-center text-neutral-900 hover:text-[#C1440E]">
                  <Trash2 size={11} />
                </button>
              </div>
            ))}

            {/* The row that adds the next feed. */}
            <div className="flex h-[21px] items-center gap-2">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Keywords"
                className="w-48 shrink-0 bg-transparent text-[11px] leading-[15px] text-neutral-900 outline-none placeholder:text-neutral-300"
              />
              <input
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addUrl(); if (e.key === "Escape") setSettings(false); }}
                placeholder="https:// feed address"
                className="min-w-0 flex-1 bg-transparent text-[11px] leading-[15px] text-neutral-500 outline-none placeholder:text-neutral-300"
              />
              <button onClick={addUrl} title="Add this feed" className="flex h-[15px] w-4 shrink-0 items-center" style={{ color: RED }}>
                <Plus size={12} />
              </button>
            </div>

            {/* Every other tab's feeds, so all the keyword sets stay in one view. */}
            {slots.some((s, i) => i !== open && s.urls.length) && (
              <>
                <div className="mt-3 flex h-[18px] items-center">
                  <span className="text-[11px] font-bold uppercase leading-[15px] tracking-[0.06em] text-neutral-900">Other tabs</span>
                </div>
                {slots.map((s, i) =>
                  i === open
                    ? null
                    : s.urls.map((u) => (
                        <div key={u.id} className="flex h-[21px] items-center gap-2">
                          <span className="w-24 shrink-0 truncate text-[10px] font-bold uppercase leading-[15px] tracking-wide text-neutral-500">{s.name || "–"}</span>
                          <span className="w-48 shrink-0 truncate text-[11px] leading-[15px] text-neutral-900">{u.name}</span>
                          <span className="min-w-0 flex-1 truncate text-[11px] leading-[15px] text-neutral-500">{u.url}</span>
                        </div>
                      ))
                )}
              </>
            )}

            <button
              onClick={() => setSettings(false)}
              style={{ color: RED }}
              className="mt-3 flex h-[21px] w-full items-center justify-center text-[11px] font-bold uppercase leading-none tracking-wide transition-opacity hover:opacity-70"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
