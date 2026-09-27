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
const BODY_BG = "#FFFFFF"; // the sheet the stories sit on
const RED = "#C1440E";

let _idc = 0;
const newId = () => "s" + Date.now().toString(36) + "-" + (_idc++);

const blankSlot = () => ({ id: newId(), name: "", urls: [] });

// Older saves held one address per tab; they become tabs with a single address.
const toSlots = (data) => {
  const list = Array.isArray(data) ? data : [];
  const slots = list.map((x) =>
    x && Array.isArray(x.urls)
      ? { id: x.id || newId(), name: x.name || "", urls: x.urls }
      : { id: x?.id || newId(), name: x?.name || "", urls: x?.url ? [x.url] : [] }
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

const dedupe = (items) => {
  const seen = new Set();
  return items.filter((i) => (seen.has(i.link) ? false : seen.add(i.link)));
};

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const when = (s) => {
  const d = new Date(s);
  if (isNaN(d)) return "";
  const mins = Math.round((Date.now() - d) / 60000);
  const age = mins < 60 ? `${Math.max(mins, 1)} min` : mins < 1440 ? `${Math.round(mins / 60)} h` : `${Math.round(mins / 1440)} d`;
  const time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return `${String(d.getDate()).padStart(2, "0")} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${time} (${age})`;
};

export default function KnowledgeFeeds() {
  const [slots, setSlots] = useState(toSlots([]));
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(0); // which tab is open, by position
  const [items, setItems] = useState({}); // slot id -> parsed entries
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [settings, setSettings] = useState(false); // the popup for the open tab
  const [newUrl, setNewUrl] = useState("");
  const [story, setStory] = useState({}); // link -> text, or "loading"
  const pulled = useRef({});

  // Fetches the page behind a headline and shows its text in place.
  const readStory = async (link) => {
    if (story[link]) {
      setStory((prev) => ({ ...prev, [link]: undefined }));
      return;
    }
    setStory((prev) => ({ ...prev, [link]: "loading" }));
    try {
      const res = await fetch(`/api/article?url=${encodeURIComponent(link)}`);
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Could not read that page");
      setStory((prev) => ({ ...prev, [link]: data.text || "Nothing readable on that page." }));
    } catch (e) {
      setStory((prev) => ({ ...prev, [link]: e.message || "Could not read that page." }));
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
        s.urls.map(async (url) => {
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
    () => dedupe([...(items[slot.id] || [])].sort((a, b) => new Date(b.published) - new Date(a.published))),
    [items, slot.id]
  );

  const addUrl = () => {
    const url = newUrl.trim();
    if (!/^https:\/\//i.test(url)) {
      setErr("Paste an https feed address.");
      return;
    }
    const next = { ...slot, urls: [...slot.urls, url] };
    patchSlot({ urls: next.urls });
    pulled.current[slot.id] = false;
    setNewUrl("");
    setErr("");
    // Read it straight away rather than waiting for the tab to be opened again.
    pull(next, true);
  };

  const removeUrl = (url) => {
    patchSlot({ urls: slot.urls.filter((u) => u !== url) });
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
        <div className="flex items-end gap-0 border-t border-black px-1 pt-1" style={{ backgroundColor: TAB_BG }}>
          {slots.map((s, i) => (
            <button
              key={s.id}
              onClick={() => setOpen(i)}
              title={s.name || "Free tab"}
              className={`-mr-2 flex h-[22px] min-w-0 flex-1 items-center gap-1.5 pl-3.5 pr-4 text-[10px] font-bold uppercase leading-none tracking-[0.08em] transition-colors ${
                i === open ? "relative z-10 text-neutral-900" : "text-neutral-600 hover:text-neutral-900"
              }`}
              style={{
                clipPath: "polygon(9px 0, 100% 0, calc(100% - 9px) 100%, 0 100%)",
                backgroundColor: i === open ? "#FFFFFF" : FOLD_BG,
              }}
            >
              <span className="min-w-0 flex-1 truncate text-left">{s.name || "–"}</span>
              {(items[s.id]?.length || 0) > 0 && (
                <span className="shrink-0 text-[9px] font-semibold tabular-nums text-neutral-500">{items[s.id].length}</span>
              )}
            </button>
          ))}
          <button
            onClick={() => { const next = [...slots, blankSlot()]; save(next); setOpen(next.length - 1); setSettings(true); }}
            title="Add another tab"
            className="flex h-[22px] w-9 shrink-0 items-center justify-center pl-2 text-neutral-600 transition-colors hover:text-neutral-900"
            style={{ clipPath: "polygon(9px 0, 100% 0, calc(100% - 9px) 100%, 0 100%)", backgroundColor: FOLD_BG }}
          >
            <Plus size={11} />
          </button>
        </div>

        <div className="min-h-[200px] p-2">
          <div className="mb-2 flex items-center gap-2">
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
              <div key={`${r.link}-${i}`} className={`py-1.5 ${i === 0 ? "" : "border-t border-neutral-300"}`}>
                <div className="flex items-start gap-2">
                  {/* The chevron reads the story into the page; the headline still opens it. */}
                  <button
                    onClick={() => readStory(r.link)}
                    title={shown ? "Close the story" : "Read the story here"}
                    className="mt-[1px] shrink-0 text-neutral-400 transition-colors hover:text-neutral-800"
                  >
                    <ChevronDown size={12} className={`block transition-transform ${shown ? "" : "-rotate-90"}`} />
                  </button>
                  <a
                    href={r.link}
                    target="_blank"
                    rel="noreferrer"
                    className="min-w-0 flex-1 text-[11px] font-medium leading-[15px] underline underline-offset-2"
                    style={{ color: "#0f766e" }}
                  >
                    {r.title}
                  </a>
                </div>
                {!shown && r.summary && <p className="mt-0.5 pl-5 text-[11px] leading-[15px] text-neutral-500">{r.summary}</p>}
                {shown && (
                  <p className="mt-1 whitespace-pre-line pl-5 text-[11px] leading-[16px] text-neutral-700">
                    {shown === "loading" ? "Reading…" : shown}
                  </p>
                )}
                {r.published && <p className="mt-0.5 pl-5 text-[10px] leading-[14px] text-neutral-400">Published: {when(r.published)}</p>}
              </div>
            );
          })}
        </div>
      </div>

      {err && <p className="pt-2 text-[11px] font-semibold text-[#C1440E]">{err}</p>}

      {settings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={() => setSettings(false)}>
          <div className="w-full max-w-md border-[3px] bg-white p-5 shadow-2xl" style={{ borderColor: RED }} onClick={(e) => e.stopPropagation()}>
            <p className="mb-3 text-[12px] font-bold uppercase tracking-[0.06em] text-neutral-900">Tab {open + 1}</p>

            {/* The tab name, always in capitals. */}
            <input
              autoFocus
              value={slot.name}
              onChange={(e) => patchSlot({ name: e.target.value.toUpperCase() })}
              placeholder="TAB NAME"
              className="mb-3 w-full border border-neutral-400 px-2 py-1 text-[11px] font-bold uppercase leading-[15px] outline-none focus:border-black"
            />

            {/* Its feeds, each one visible so the keywords stay in view. */}
            {slot.urls.map((u) => (
              <div key={u} className="flex items-start gap-2 border-t border-neutral-200 py-1">
                <span className="min-w-0 flex-1 break-all text-[10px] leading-[14px] text-neutral-500">{u}</span>
                <button onClick={() => removeUrl(u)} title="Remove this feed" className="shrink-0 text-neutral-400 transition-colors hover:text-[#C1440E]">
                  <Trash2 size={12} />
                </button>
              </div>
            ))}

            <div className="mt-3 flex items-center gap-2">
              <input
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addUrl(); if (e.key === "Escape") setSettings(false); }}
                placeholder="https:// RSS or Google Alerts address"
                className="min-w-0 flex-1 border border-neutral-400 px-2 py-1 text-[11px] leading-[15px] outline-none focus:border-black"
              />
              <button onClick={addUrl} title="Add this feed" className="shrink-0 text-neutral-600 hover:text-neutral-900">
                <Plus size={14} />
              </button>
            </div>

            <div className="mt-4 flex justify-end text-[12px] font-bold uppercase tracking-wide">
              <button onClick={() => setSettings(false)} className="border-2 px-5 py-1.5 transition-opacity hover:opacity-70" style={{ borderColor: RED, color: RED }}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
