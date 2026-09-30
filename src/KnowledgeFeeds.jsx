import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, X, Trash2, RefreshCw, SquarePen } from "lucide-react";
import { supabase } from "./lib/supabaseClient.js";

// Intel: ten tabs, each one named by you and holding as many RSS or Google Alerts
// addresses as you like. Everything is kept in Supabase, so it follows you between
// devices, and the sheet under the tabs stays blank until a feed returns something.
const DOC_ID = "knowledge-feeds";
// Every story read in the last day, per tab. A Google Alert feed only ever holds its
// latest twenty or so, so on a busy subject older stories fall out of it within hours;
// kept here, they stay on the tab for the full day and survive a reload.
const ITEMS_ID = "knowledge-feed-items";
const VIEW_ID = "knowledge-feeds-open"; // the tab each panel was left on
// The right panel is a table of its own: its own tabs, saved apart, sharing nothing
// with the left.
const RIGHT_ID = "knowledge-feeds-right";
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
const BODY_BG = "#FFFFFF"; // the sheet the stories sit on, plain white
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

// A feed address is taken as typed. Anything else is read as words to follow, and
// becomes a Google News search feed, which carries stories as they are published
// rather than in the batches a Google Alert sends.
const toFeedUrl = (raw) => {
  const s = String(raw || "").trim();
  if (!s) return "";
  if (/^https:\/\//i.test(s)) return s;
  if (/^http:\/\//i.test(s)) return "";
  return `https://news.google.com/rss/search?q=${encodeURIComponent(s)}&hl=en&gl=US&ceid=US:en`;
};

// Left to itself a Google News search returns its best matches from the past few
// weeks, most of which the one day cut then throws away. Asking for the last day
// only fills the list with stories that will actually show. Applied when reading, so
// feeds saved before this change get it too.
const lastDay = (url) => {
  if (!/^https:\/\/news\.google\.com\/rss\/search\?/i.test(url)) return url;
  const u = new URL(url);
  const q = u.searchParams.get("q") || "";
  if (!/\bwhen:\d+[hd]\b/i.test(q)) u.searchParams.set("q", `${q} when:1d`.trim());
  return u.toString();
};

// Nothing older than a day shows.
const isFresh = (s) => {
  const d = new Date(s);
  return !isNaN(d) && Date.now() - d <= 24 * 60 * 60 * 1000;
};

export default function KnowledgeFeeds() {
  const [slots, setSlots] = useState(toSlots([]));
  const [slots2, setSlots2] = useState(toSlots([])); // the right panel's own tabs
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(0); // the left panel's open tab
  const [open2, setOpen2] = useState(0); // the right panel's open tab
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
  const itemsRef = useRef({}); // the latest stories, for reads that overlap

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
    const get = (id) => supabase.from("admin_docs").select("data").eq("id", id).maybeSingle();
    Promise.all([get(DOC_ID), get(ITEMS_ID), get(VIEW_ID), get(RIGHT_ID)]).then(([tabs, kept, view, rightTabs]) => {
      const error = tabs.error || kept.error || view.error || rightTabs.error;
      if (error) setErr(error.message);
      const list = toSlots(tabs.data?.data);
      const list2 = toSlots(rightTabs.data?.data);
      setSlots(list);
      setSlots2(list2);
      // Its empty tabs are saved the first time, so they keep the same ids from then on.
      if (!rightTabs.error && !rightTabs.data) {
        supabase.from("admin_docs").upsert({ id: RIGHT_ID, data: list2, updated_at: new Date().toISOString() })
          .then(({ error: e }) => { if (e) setErr(e.message); });
      }
      // Each panel opens on the tab it was left on.
      const left = list.findIndex((s) => s.id === view.data?.data?.left);
      const right = list2.findIndex((s) => s.id === view.data?.data?.right);
      if (left >= 0) setOpen(left);
      if (right >= 0) setOpen2(right);
      const stored = kept.data?.data && !Array.isArray(kept.data.data) ? kept.data.data : {};
      itemsRef.current = stored;
      setItems(stored);
      setLoaded(true);
    });
  }, []);

  // Which tab each panel is on, kept with the account so a refresh comes back to it.
  // Written only once the saved one has been read, so it is never reset on open.
  const leftId = slots[open]?.id;
  const rightId = slots2[open2]?.id;
  useEffect(() => {
    if (!loaded) return;
    supabase
      .from("admin_docs")
      .upsert({ id: VIEW_ID, data: { left: leftId, right: rightId }, updated_at: new Date().toISOString() })
      .then(({ error }) => { if (error) setErr(error.message); });
  }, [loaded, leftId, rightId]);

  // Stories are written back after every read, trimmed to the last day.
  const keepItems = (next) => {
    itemsRef.current = next;
    setItems(next);
    supabase
      .from("admin_docs")
      .upsert({ id: ITEMS_ID, data: next, updated_at: new Date().toISOString() })
      .then(({ error }) => { if (error) setErr(error.message); });
  };

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
            const res = await fetch(`/api/rss?url=${encodeURIComponent(lastDay(url))}&t=${Date.now()}`, { cache: "no-store" });
            const xml = await res.text();
            if (!res.ok) setNewest((prev) => ({ ...prev, [url]: { at: "failed", title: "" } }));
            if (!res.ok) return { rows: [], error: plain(xml).slice(0, 80) };
            const rows = parseFeedXml(xml);
            const top = rows.map((r) => new Date(r.published)).filter((d) => !isNaN(d)).sort((a, b) => b - a)[0];
            // The feed states its own subject; a mistyped address shows up here at once.
            const feedTitle = (xml.match(/<title[^>]*>([^]*?)<\/title>/i) || ["", ""])[1];
            setNewest((prev) => ({ ...prev, [url]: { at: top ? top.toISOString() : "none", title: plain(feedTitle).replace(/^Google Alert - /, "") } }));
            return { rows, error: "" };
          } catch (e) {
            return { rows: [], error: e.message || "A feed could not be read." };
          }
        })
      );
      const rows = all.flatMap((r) => r.rows);
      const failed = all.filter((r) => r.error);
      const kept = dedupe([...rows, ...(itemsRef.current[s.id] || [])]).filter((r) => isFresh(r.published));
      keepItems({ ...itemsRef.current, [s.id]: kept });
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
    pull(slots2[open2], true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, open2, loaded, slots[open]?.urls.length, slots2[open2]?.urls.length]);

  // And again every five minutes, so a page left open keeps up with the feeds.
  useEffect(() => {
    if (!loaded) return;
    const tick = setInterval(() => {
      pull(slots[open], true);
      pull(slots2[open2], true);
    }, 5 * 60 * 1000);
    return () => clearInterval(tick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, open2, loaded, slots, slots2]);

  const addUrl = () => {
    const url = toFeedUrl(newUrl);
    if (!url) {
      setErr("Type words to follow, or paste an https feed address.");
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
    keepItems({ ...itemsRef.current, [slot.id]: [] });
  };

  // One panel, built to the same measurements as the Says feeds box. Two of them sit
  // side by side, each with its own open tab, so two feeds can be read at once.
  const renderPanel = (which) => {
    const list = which === 0 ? slots : slots2;
    const openIdx = which === 0 ? open : open2;
    const setOpenIdx = which === 0 ? setOpen : setOpen2;
    const panelSlot = list[openIdx] || blankSlot();
    const panelRows = dedupe(
      (items[panelSlot.id] || [])
        .filter((r) => isFresh(r.published))
        .sort((a, b) => new Date(b.published) - new Date(a.published))
    );
    return (
      <div className="flex min-h-0 min-w-[320px] flex-1 flex-col overflow-hidden rounded-xl border-[3px] border-neutral-500 bg-white shadow-sm">
        {/* Plain text tabs on white, every one the same width, with a hairline
            between them; the open one carries a burgundy underline. Tabs not yet
            named stay out of sight until they are given a name. */}
        <div className="flex divide-x divide-neutral-300 border-b border-neutral-300 bg-white">
          {list.map((s, i) => !s.name ? null : (
            <button
              key={s.id}
              onClick={() => setOpenIdx(i)}
              title={s.name}
              className={`-mb-px min-w-0 flex-1 truncate border-b-[3px] px-2 pb-2 pt-3 text-center text-[11px] font-bold uppercase tracking-wide transition-colors ${
                i === openIdx ? "border-[#B01E2F] text-neutral-900" : "border-transparent text-neutral-400 hover:text-neutral-700"
              }`}
            >
              {`${s.name} (${s.urls.length})`}
            </button>
          ))}
          {/* The plus opens the popup, which belongs to the left panel only. */}
          {which === 0 && (
            <button
              onClick={() => { const next = [...slots, blankSlot()]; save(next); setOpenIdx(next.length - 1); setSettings(next.length - 1); }}
              title="Add another tab"
              className="-mb-px flex w-9 shrink-0 items-center justify-center border-b-[3px] border-transparent pb-2 pt-3 text-neutral-400 transition-colors hover:text-neutral-700"
            >
              <Plus size={14} />
            </button>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto bg-white px-4 py-3">
          <div className="mb-1 flex items-center gap-3">
            <button onClick={() => pull(panelSlot, true)} title="Refresh" className="text-neutral-400 transition-colors hover:text-neutral-700">
              <RefreshCw size={14} className={busy ? "animate-spin text-[#C1440E]" : ""} />
            </button>
            {which === 0 && (
              <button onClick={() => setSettings(openIdx)} title="Name this tab and add feeds" className="text-neutral-400 transition-colors hover:text-neutral-700">
                <SquarePen size={14} />
              </button>
            )}
          </div>

          <ul className="divide-y divide-neutral-200">
            {panelRows.map((r, i) => {
              const shown = story[r.link];
              return (
                // A click anywhere on the entry opens the summary; the headline still
                // goes to the story itself.
                <li
                  key={`${r.link}-${i}`}
                  onClick={() => readStory(r.link)}
                  title={shown ? "Close" : "Summary for investing"}
                  className="cursor-pointer py-2.5"
                >
                  <a
                    href={r.link}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-[13px] font-semibold leading-snug hover:underline"
                    style={{ color: "#0f766e" }}
                  >
                    {r.title}
                  </a>
                  {!shown && r.summary && <p className="mt-0.5 truncate text-[12px] leading-[16px] text-neutral-500">{r.summary}</p>}
                  {shown && shown !== "loading" && <p className="mt-1 text-[12px] leading-[17px] text-neutral-700">{shown}</p>}
                  {shown === "loading" && <p className="mt-0.5 text-[12px] leading-[16px] text-neutral-400">Summarising…</p>}
                  {r.published && <p className="mt-1 text-[10px] leading-[12px] tracking-wide text-neutral-400">{stamp(r.published)}</p>}
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
          <div className="relative w-full max-w-2xl rounded-lg border-4 border-black bg-white px-6 py-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
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
            <div className="mt-1 rounded border-[3px] border-black">
            {[...slot.urls].sort((a, b) => (a.name || a.url).localeCompare(b.name || b.url)).map((u, i) => (
              <div key={u.id} className={`flex items-center gap-3 px-2 py-1.5 ${i === 0 ? "" : "border-t border-black"}`}>
                <input
                  value={u.name}
                  onChange={(e) => patchUrl(u.id, { name: e.target.value })}
                  className="w-44 shrink-0 bg-transparent text-[11px] leading-[15px] text-neutral-900 outline-none placeholder:text-neutral-300"
                />
                <input
                  value={u.url}
                  onChange={(e) => patchUrl(u.id, { url: e.target.value })}
                  className="min-w-0 flex-1 bg-transparent text-[11px] leading-[15px] text-neutral-900 outline-none"
                />
                <button onClick={() => removeUrl(u.id)} title="Remove this feed" className="shrink-0 text-neutral-900 transition-colors hover:text-[#C1440E]">
                  <Trash2 size={12} />
                </button>
              </div>
            ))}

            <div className={`flex items-center gap-3 px-2 py-1.5 ${slot.urls.length ? "border-t border-black" : ""}`}>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-44 shrink-0 bg-transparent text-[11px] leading-[15px] text-neutral-900 outline-none placeholder:text-neutral-300"
              />
              <input
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addUrl(); if (e.key === "Escape") setSettings(null); }}
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
