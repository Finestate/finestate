import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, X, Trash2, RefreshCw, SquarePen } from "lucide-react";
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
const TAB_PINK = "#F7DCD4";    // a closed tab, the same red watered down
const TAB_STRIP = "#D9C7B8";   // the strip behind the tabs: warm taupe, so the pink reads clearly
// The folder shape, and the same shape a hair inside it, which leaves the outline.
const FOLD_CUT = "polygon(9px 0, 100% 0, calc(100% - 9px) 100%, 0 100%)";
const FOLD_CUT_INNER = "polygon(10px 1px, calc(100% - 1px) 1px, calc(100% - 10px) 100%, 1px 100%)";
const BODY_BG = "#FFE9C4"; // the sheet the stories sit on, the nav gold
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

// How long ago it landed, for the read stamp.
const when = (s) => {
  const d = new Date(s);
  if (isNaN(d)) return "";
  const mins = Math.round((Date.now() - d) / 60000);
  return mins < 60 ? `${Math.max(mins, 1)} min` : `${Math.round(mins / 60)} h`;
};

// "28 SEP 2026, 20:58 (5 min)" under a story.
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const stamp = (s) => {
  const d = new Date(s);
  if (isNaN(d)) return "";
  const time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return `${String(d.getDate()).padStart(2, "0")} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${time} (${when(s)})`;
};

// Nothing older than a day shows.
const isFresh = (s) => {
  const d = new Date(s);
  return !isNaN(d) && Date.now() - d <= 24 * 60 * 60 * 1000;
};

export default function KnowledgeFeeds() {
  const [slots, setSlots] = useState(toSlots([]));
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(0); // the left panel's open tab
  const [open2, setOpen2] = useState(1); // the right panel's open tab
  const [items, setItems] = useState({}); // slot id -> parsed entries
  const [read, setRead] = useState({}); // slot id -> when it was last read
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [newest, setNewest] = useState({}); // feed address -> newest item it returned
  const [settings, setSettings] = useState(null); // the tab the popup is editing, by position
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

  // Everything in the popup works on the tab it was opened from, not on whatever the
  // left panel happens to be showing.
  const editIdx = settings != null ? settings : open;
  const slot = slots[editIdx] || blankSlot();
  const patchSlot = (fields) => save(slots.map((s, i) => (i === editIdx ? { ...s, ...fields } : s)));

  const pull = async (s, force) => {
    if (!s || !s.urls.length || (!force && pulled.current[s.id])) return;
    pulled.current[s.id] = true;
    setBusy(true);
    try {
      // Each feed is read on its own. One that fails, as Google does from time to
      // time, must not throw away the ones that answered.
      const all = await Promise.all(
        s.urls.map(async ({ url }) => {
          try {
            // The stamp keeps the browser and the edge from serving an old copy.
            const res = await fetch(`/api/rss?url=${encodeURIComponent(url)}&t=${Date.now()}`, { cache: "no-store" });
            const xml = await res.text();
            if (!res.ok) setNewest((prev) => ({ ...prev, [url]: "failed" }));
            if (!res.ok) return { rows: [], error: plain(xml).slice(0, 80) };
            const rows = parseFeedXml(xml);
            const top = rows.map((r) => new Date(r.published)).filter((d) => !isNaN(d)).sort((a, b) => b - a)[0];
            setNewest((prev) => ({ ...prev, [url]: top ? top.toISOString() : "none" }));
            return { rows, error: "" };
          } catch (e) {
            return { rows: [], error: e.message || "A feed could not be read." };
          }
        })
      );
      const rows = all.flatMap((r) => r.rows);
      const failed = all.filter((r) => r.error);
      setItems((prev) => ({ ...prev, [s.id]: dedupe([...rows, ...(prev[s.id] || [])]) }));
      setRead((prev) => ({ ...prev, [s.id]: Date.now() }));
      setErr(failed.length && !rows.length ? failed[0].error : "");
    } catch (e) {
      setErr(e.message || "A feed could not be read.");
    } finally {
      setBusy(false);
    }
  };

  // Reads whatever each panel has open, and again when a feed list changes.
  useEffect(() => {
    if (!loaded) return;
    pull(slots[open], true);
    pull(slots[open2], true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, open2, loaded, slots[open]?.urls.length, slots[open2]?.urls.length]);

  // And again every five minutes, so a page left open keeps up with the feeds.
  useEffect(() => {
    if (!loaded) return;
    const tick = setInterval(() => {
      pull(slots[open], true);
      pull(slots[open2], true);
    }, 5 * 60 * 1000);
    return () => clearInterval(tick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, open2, loaded, slots]);

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

  // One panel, built to the same measurements as the Says feeds box. Two of them sit
  // side by side, each with its own open tab, so two feeds can be read at once.
  const renderPanel = (which) => {
    const openIdx = which === 0 ? open : open2;
    const setOpenIdx = which === 0 ? setOpen : setOpen2;
    const panelSlot = slots[openIdx] || blankSlot();
    const panelRows = dedupe(
      (items[panelSlot.id] || [])
        .filter((r) => isFresh(r.published))
        .sort((a, b) => new Date(b.published) - new Date(a.published))
    );
    return (
      <div className="flex min-h-0 min-w-[320px] flex-1 flex-col overflow-hidden rounded-xl border-[3px] border-neutral-500 shadow-sm">
        <div className="border-b-[3px] border-neutral-500 px-4 py-1.5 text-center" style={{ backgroundColor: OPEN_TAB_BG }}>
          <h3 className="text-xs font-bold uppercase tracking-wide text-neutral-700">Intel</h3>
        </div>

        {/* The strip the tabs sit on, a deeper tone of the same red. */}
        <div className="flex gap-1 border-b-[3px] border-neutral-500 px-2 pt-1" style={{ backgroundColor: TAB_STRIP }}>
          {slots.map((s, i) => (
            <button
              key={s.id}
              onClick={() => setOpenIdx(i)}
              title={s.name || "Free tab"}
              className={`min-w-0 flex-1 truncate rounded-t-lg border border-neutral-300 px-1 py-1.5 text-[10px] font-bold uppercase tracking-tight shadow-sm transition-opacity ${
                i === openIdx ? "relative z-10 text-neutral-800" : "text-neutral-500 hover:opacity-80 hover:text-neutral-700"
              }`}
              // The open tab takes the sheet colour, the closed ones a watered down red.
              style={
                i === openIdx
                  ? { backgroundColor: BODY_BG, borderBottomColor: BODY_BG }
                  : { backgroundColor: TAB_PINK }
              }
            >
              {s.name || " "}
            </button>
          ))}
          <button
            onClick={() => { const next = [...slots, blankSlot()]; save(next); setOpenIdx(next.length - 1); setSettings(next.length - 1); }}
            title="Add another tab"
            style={{ backgroundColor: TAB_PINK }}
            className="shrink-0 rounded-t-lg border border-neutral-300 px-2 py-1.5 text-neutral-500 shadow-sm transition-opacity hover:opacity-80 hover:text-neutral-700"
          >
            <Plus size={12} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3" style={{ backgroundColor: BODY_BG }}>
          <div className="mb-1 flex items-center gap-2">
            <button onClick={() => pull(panelSlot, true)} title="Refresh" className="text-neutral-400 transition-colors hover:text-neutral-700">
              <RefreshCw size={14} className={busy ? "animate-spin text-[#C1440E]" : ""} />
            </button>
            <button onClick={() => setSettings(openIdx)} title="Name this tab and add feeds" className="text-neutral-400 transition-colors hover:text-neutral-700">
              <SquarePen size={14} />
            </button>
            {/* When the feed was last read, as against how old its newest story is. */}
            {read[panelSlot.id] && (
              <span className="text-[10px] text-neutral-400">read {when(read[panelSlot.id])} ago</span>
            )}
          </div>

          <ul className="divide-y-2 divide-neutral-400">
            {panelRows.map((r, i) => {
              const shown = story[r.link];
              return (
                // A click anywhere on the entry opens the summary; the headline still
                // goes to the story itself.
                <li
                  key={`${r.link}-${i}`}
                  onClick={() => readStory(r.link)}
                  title={shown ? "Close" : "Summary for investing"}
                  className="cursor-pointer py-1"
                >
                  <a
                    href={r.link}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-xs font-medium underline hover:text-[#0c5e57]"
                    style={{ color: "#0f766e" }}
                  >
                    {r.title}
                  </a>
                  {!shown && r.summary && <p className="truncate text-[11px] leading-[14px] text-neutral-500">{r.summary}</p>}
                  {shown && shown !== "loading" && <p className="mt-0.5 text-[11px] leading-[15px] text-neutral-700">{shown}</p>}
                  {shown === "loading" && <p className="text-[11px] leading-[14px] text-neutral-400">Summarising…</p>}
                  {r.published && <p className="text-[10px] leading-[12px] text-neutral-400">Published: {stamp(r.published)}</p>}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full">
      {/* The pair fills what is left of the screen and never pushes past it; each
          panel scrolls inside itself, as on the other sites. */}
      <div className="flex h-[calc(100vh-5rem)] w-full flex-row gap-4 overflow-x-auto">
        {renderPanel(0)}
        {renderPanel(1)}
      </div>

      {err && <p className="pt-2 text-[11px] font-semibold text-[#C1440E]">{err}</p>}

      {settings != null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={() => setSettings(null)}>
          {/* A table like every other one here: title bar, column heads, then a row
              per feed with its name on the left and its address on the right. */}
          {/* Plain white sheet, one hairline, the tab name at the top and a line per
              feed underneath. Nothing else. */}
          <div className="relative w-full max-w-3xl rounded-lg border-2 border-black bg-white px-6 py-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            {/* Closes the sheet, same as clicking away or pressing Escape. */}
            <button
              onClick={() => setSettings(null)}
              title="Close"
              className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full border border-black text-neutral-900 transition-colors hover:bg-neutral-100"
            >
              <X size={12} strokeWidth={2.5} />
            </button>
            <input
              autoFocus
              value={slot.name}
              onChange={(e) => patchSlot({ name: e.target.value.toUpperCase() })}
              placeholder="TAB NAME"
              className="w-full bg-transparent pb-2 text-[13px] font-bold uppercase tracking-[0.12em] text-neutral-900 outline-none placeholder:text-neutral-300"
            />

            {/* The feeds sit in their own framed table inside the sheet. */}
            <div className="mt-1 rounded border border-black">
            {[...slot.urls].sort((a, b) => (a.name || a.url).localeCompare(b.name || b.url)).map((u, i) => (
              <div key={u.id} className={`flex items-center gap-3 px-2 py-1.5 ${i === 0 ? "" : "border-t border-black"}`}>
                <input
                  value={u.name}
                  onChange={(e) => patchUrl(u.id, { name: e.target.value })}
                  placeholder="Keywords"
                  className="w-44 shrink-0 bg-transparent text-[11px] leading-[15px] text-neutral-900 outline-none placeholder:text-neutral-300"
                />
                <input
                  value={u.url}
                  onChange={(e) => patchUrl(u.id, { url: e.target.value })}
                  className="min-w-0 flex-1 bg-transparent text-[11px] leading-[15px] text-neutral-900 outline-none"
                />
                {/* What this one feed itself last carried, so a quiet source is
                    told apart from a broken one at a glance. */}
                <span className="w-24 shrink-0 text-right text-[11px] leading-[15px] text-neutral-900">
                  {newest[u.url] === "failed" ? "failed" : newest[u.url] === "none" ? "empty" : newest[u.url] ? when(newest[u.url]) : ""}
                </span>
                <button onClick={() => removeUrl(u.id)} title="Remove this feed" className="shrink-0 text-neutral-900 transition-colors hover:text-[#C1440E]">
                  <Trash2 size={12} />
                </button>
              </div>
            ))}

            <div className={`flex items-center gap-3 px-2 py-1.5 ${slot.urls.length ? "border-t border-black" : ""}`}>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Keywords"
                className="w-44 shrink-0 bg-transparent text-[11px] leading-[15px] text-neutral-900 outline-none placeholder:text-neutral-300"
              />
              <input
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addUrl(); if (e.key === "Escape") setSettings(null); }}
                placeholder="https:// feed address"
                className="min-w-0 flex-1 bg-transparent text-[11px] leading-[15px] text-neutral-900 outline-none placeholder:text-neutral-400"
              />
              <button onClick={addUrl} title="Add this feed" className="shrink-0" style={{ color: RED }}>
                <Plus size={13} />
              </button>
            </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
