import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Trash2, RefreshCw, Settings } from "lucide-react";
import { supabase } from "./lib/supabaseClient.js";

// Intel: ten tabs, each one named by you and holding as many RSS or Google Alerts
// addresses as you like. Everything is kept in Supabase, so it follows you between
// devices, and the sheet under the tabs stays blank until a feed returns something.
const DOC_ID = "knowledge-feeds";
const SLOTS = 10;
const BODY_BG = "#FBF5E9";
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
  while (slots.length < SLOTS) slots.push(blankSlot());
  return slots.slice(0, SLOTS);
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
  const pulled = useRef({});

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

  useEffect(() => {
    if (loaded) pull(slots[open]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, loaded]);

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
    patchSlot({ urls: [...slot.urls, url] });
    pulled.current[slot.id] = false;
    setNewUrl("");
    setErr("");
  };

  const removeUrl = (url) => {
    patchSlot({ urls: slot.urls.filter((u) => u !== url) });
    pulled.current[slot.id] = false;
    setItems((prev) => ({ ...prev, [slot.id]: [] }));
  };

  return (
    <div className="w-full overflow-x-auto">
      <div className="w-full min-w-[720px] overflow-hidden rounded-xl border border-neutral-300 shadow-sm" style={{ backgroundColor: BODY_BG }}>
        <div className="border-b-2 border-neutral-300 px-4 py-3 text-center" style={{ backgroundColor: BODY_BG }}>
          <h3 className="text-sm font-bold uppercase tracking-wide text-neutral-700">Intel</h3>
        </div>

        {/* Every tab opens, named or not; the settings icon names it and adds feeds. */}
        <div className="flex gap-1 border-b-2 border-neutral-300 bg-neutral-100 px-2 pt-1">
          {slots.map((s, i) => (
            <button
              key={s.id}
              onClick={() => setOpen(i)}
              title={s.name || "Unnamed tab"}
              className={`min-w-0 flex-1 truncate rounded-t-lg border border-neutral-300 px-1 py-1.5 text-[10px] font-bold uppercase tracking-tight shadow-sm transition-colors ${
                i === open ? "relative z-10 text-neutral-800" : "bg-neutral-200 text-neutral-500 hover:bg-neutral-50 hover:text-neutral-700"
              }`}
              style={i === open ? { backgroundColor: BODY_BG, borderBottomColor: BODY_BG } : undefined}
            >
              {s.name || " "}
            </button>
          ))}
        </div>

        <div className="min-h-[200px] p-3">
          <div className="mb-2 flex items-center gap-2">
            <span className="flex-1 text-[10px] font-bold uppercase tracking-wide text-neutral-400">
              {slot.name || "Unnamed"} {slot.urls.length ? `· ${slot.urls.length} feeds` : ""}
            </span>
            <button onClick={() => pull(slot, true)} title="Refresh" className="text-neutral-400 transition-colors hover:text-neutral-700">
              <RefreshCw size={12} className={busy ? "animate-spin" : ""} />
            </button>
            <button onClick={() => setSettings(true)} title="Name this tab and add feeds" className="text-neutral-400 transition-colors hover:text-neutral-700">
              <Settings size={12} />
            </button>
          </div>

          {rows.map((r, i) => (
            <div key={`${r.link}-${i}`} className={`py-1.5 ${i === 0 ? "" : "border-t-2 border-neutral-300"}`}>
              <a
                href={r.link}
                target="_blank"
                rel="noreferrer"
                className="text-[11px] font-medium leading-[15px] underline underline-offset-2"
                style={{ color: "#0f766e" }}
              >
                {r.title}
              </a>
              {r.summary && <p className="mt-0.5 text-[11px] leading-[15px] text-neutral-500">{r.summary}</p>}
              {r.published && <p className="mt-0.5 text-[10px] leading-[14px] text-neutral-400">Published: {when(r.published)}</p>}
            </div>
          ))}
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
