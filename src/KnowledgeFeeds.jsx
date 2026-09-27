import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Trash2, RefreshCw, X } from "lucide-react";
import { supabase } from "./lib/supabaseClient.js";

// Knowledge feeds, built the way the Says feeds box works: a strip of tabs, then the
// headlines from the feed behind the open tab. The feed list is typed in here and
// kept in Supabase, so it follows you between devices.
const DOC_ID = "knowledge-feeds";
const BAR_BG = "#F2C46D";   // title bar
const TAB_BG = "#FFE9C4";   // the nav cream, behind the tab rows
const BODY_BG = "#FBF5E9";  // panel behind the headlines, as on the other sites
const GOLD = "#9c7c33";
const RED = "#C1440E";

const head = "text-[11px] font-bold uppercase leading-[15px] tracking-[0.06em] text-neutral-900";

let _idc = 0;
const newId = () => "f" + Date.now().toString(36) + "-" + (_idc++);

// Atom entries and RSS items both reduce to a headline, a link and a date.
function parseFeedXml(xmlText, feedName) {
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
      feedName,
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
// "27 SEP 2026, 19:01 (20 min)" – the same reading as the other sites.
const when = (s) => {
  const d = new Date(s);
  if (isNaN(d)) return "";
  const mins = Math.round((Date.now() - d) / 60000);
  const age = mins < 60 ? `${Math.max(mins, 1)} min` : mins < 1440 ? `${Math.round(mins / 60)} h` : `${Math.round(mins / 1440)} d`;
  const time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return `${String(d.getDate()).padStart(2, "0")} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${time} (${age})`;
};

export default function KnowledgeFeeds() {
  const [feeds, setFeeds] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState("manage"); // a feed id, or "manage"
  const [items, setItems] = useState({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [confirm, setConfirm] = useState(null);
  const [addOpen, setAddOpen] = useState(false); // the add a feed popup
  const pulled = useRef({});

  useEffect(() => {
    supabase
      .from("admin_docs")
      .select("data")
      .eq("id", DOC_ID)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) setErr(error.message);
        setFeeds(Array.isArray(data?.data) ? data.data : []);
        setLoaded(true);
      });
  }, []);

  const save = (next) => {
    setFeeds(next);
    supabase
      .from("admin_docs")
      .upsert({ id: DOC_ID, data: next, updated_at: new Date().toISOString() })
      .then(({ error }) => setErr(error ? error.message : ""));
  };

  const pull = async (feed, force) => {
    if (!feed || (!force && pulled.current[feed.id])) return;
    pulled.current[feed.id] = true;
    setBusy(true);
    try {
      const res = await fetch(`/api/rss?url=${encodeURIComponent(feed.url)}`);
      const xml = await res.text();
      if (!res.ok) throw new Error(plain(xml).slice(0, 80));
      setItems((prev) => ({ ...prev, [feed.id]: parseFeedXml(xml, feed.name) }));
      setErr("");
    } catch (e) {
      setErr(`${feed.name}: ${e.message || "could not be read"}`);
    } finally {
      setBusy(false);
    }
  };

  // Opening a tab reads that feed once; the refresh arrow reads it again.
  useEffect(() => {
    if (!loaded) return;
    if (tab !== "manage") pull(feeds.find((f) => f.id === tab));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, loaded, feeds.length]);

  const rows = useMemo(() => {
    const list = items[tab] || [];
    return dedupe([...list].sort((a, b) => new Date(b.published) - new Date(a.published)));
  }, [tab, feeds, items]);

  const addFeed = () => {
    const name = newName.trim();
    const url = newUrl.trim();
    if (!name || !/^https:\/\//i.test(url)) {
      setErr("A name and an https feed address are needed.");
      return;
    }
    const feed = { id: newId(), name, url };
    save([...feeds, feed].sort((a, b) => a.name.localeCompare(b.name)));
    setNewName("");
    setNewUrl("");
    setErr("");
    setAddOpen(false);
    setTab(feed.id);
  };

  const removeFeed = () => {
    const next = feeds.filter((f) => f.id !== confirm);
    save(next);
    if (tab === confirm) setTab("manage");
    setConfirm(null);
  };

  const refresh = () => {
    if (tab !== "manage") pull(feeds.find((f) => f.id === tab), true);
  };

  // Flat square tabs in the table's own language: a hairline each, the open one white
  // and bold, a free slot marked by a dashed edge.
  const tabClass = (on) =>
    `flex h-[19px] min-w-0 flex-1 items-center justify-center truncate border border-black px-1 text-[10px] font-semibold uppercase leading-none tracking-wide transition-colors ${
      on ? "bg-white font-bold text-neutral-900" : "text-neutral-600 hover:text-neutral-900"
    }`;
  // Ten slots on one row, filled in order by the feeds you add.
  const SLOTS = 10;
  const slots = Array.from({ length: SLOTS }, (_, i) => {
    const f = feeds[i];
    return f ? { key: f.id, name: f.name } : { key: `empty-${i}`, name: "", empty: true };
  });

  return (
    <div className="w-full overflow-x-auto">
      <div className="w-full min-w-[720px] overflow-hidden rounded-xl border border-neutral-300 shadow-sm" style={{ backgroundColor: BODY_BG }}>
        {/* Header, tab rows and body exactly as the Says feeds box is put together. */}
        <div className="border-b-2 border-neutral-300 px-4 py-3 text-center" style={{ backgroundColor: BODY_BG }}>
          <h3 className="text-sm font-bold uppercase tracking-wide text-neutral-700">Intel</h3>
        </div>

        <div className="flex gap-1 border-b-2 border-neutral-300 bg-neutral-100 px-2 pt-1">
          {slots.map((t) => (
            <button
              key={t.key}
              onClick={() => (t.empty ? setAddOpen(true) : setTab(t.key))}
              title={t.empty ? "Free slot, click to add a feed" : t.name}
              className={`min-w-0 flex-1 truncate rounded-t-lg border border-neutral-300 px-1 py-1.5 text-[10px] font-bold uppercase tracking-tight shadow-sm transition-colors ${
                tab === t.key
                  ? "relative z-10 text-neutral-800"
                  : "bg-neutral-200 text-neutral-500 hover:bg-neutral-50 hover:text-neutral-700"
              }`}
              style={tab === t.key ? { backgroundColor: BODY_BG, borderBottomColor: BODY_BG } : undefined}
            >
              {t.name || " "}
            </button>
          ))}
          <button
            onClick={() => setTab("manage")}
            title="Feeds manager"
            className={`shrink-0 rounded-t-lg border border-neutral-300 px-2 py-1.5 text-[10px] font-bold uppercase tracking-tight shadow-sm transition-colors ${
              tab === "manage" ? "relative z-10 text-neutral-800" : "bg-neutral-200 text-neutral-500 hover:bg-neutral-50 hover:text-neutral-700"
            }`}
            style={tab === "manage" ? { backgroundColor: BODY_BG, borderBottomColor: BODY_BG } : undefined}
          >
            Feeds
          </button>
        </div>

        {tab === "manage" ? (
          <div className="p-3">
            <div className="mb-1 flex items-center gap-2 border-b-2 border-neutral-300 pb-1">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Name"
                className="w-40 shrink-0 bg-transparent text-[11px] leading-[15px] outline-none placeholder:text-neutral-400"
              />
              <input
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addFeed(); }}
                placeholder="https:// feed address"
                className="min-w-0 flex-1 bg-transparent text-[11px] leading-[15px] outline-none placeholder:text-neutral-400"
              />
              <button onClick={addFeed} title="Add this feed" style={{ color: GOLD }} className="flex h-[15px] items-center hover:opacity-70">
                <Plus size={12} />
              </button>
            </div>
            {feeds.map((f, i) => (
              <div key={f.id} className={`flex items-center gap-2 py-1 ${i === 0 ? "" : "border-t-2 border-neutral-300"}`}>
                <span className="w-40 shrink-0 truncate text-[11px] font-semibold leading-[15px] text-neutral-800">{f.name}</span>
                <span className="min-w-0 flex-1 truncate text-[11px] leading-[15px] text-neutral-500">{f.url}</span>
                <button onClick={() => setConfirm(f.id)} title="Remove this feed" className="text-neutral-400 transition-colors hover:text-[#C1440E]">
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          // Empty until a feed is open: a plain sheet, nothing written in it.
          <div className="min-h-[180px] p-3">
            {rows.length > 0 && (
              <div className="mb-1 flex items-center">
                <button onClick={refresh} title="Refresh" className="text-neutral-400 transition-colors hover:text-neutral-700">
                  <RefreshCw size={12} className={busy ? "animate-spin" : ""} />
                </button>
              </div>
            )}
            {rows.map((r, i) => (
              <div key={`${r.link}-${i}`} className={`py-1.5 ${i === 0 ? "" : "border-t-2 border-neutral-300"}`}>
                <a
                  href={r.link}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] font-medium leading-[15px] underline underline-offset-2"
                  style={{ color: "#0f766e" }}
                >
                  <span className="font-bold uppercase">{r.feedName}: </span>
                  {r.title}
                </a>
                {r.summary && <p className="mt-0.5 text-[11px] leading-[15px] text-neutral-500">{r.summary}</p>}
                {r.published && (
                  <p className="mt-0.5 text-[10px] leading-[14px] text-neutral-400">Published: {when(r.published)}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {err && <p className="pt-2 text-[11px] font-semibold text-[#C1440E]">{err}</p>}

      {/* Clicking a free tab asks for the feed here. */}
      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={() => setAddOpen(false)}>
          <div className="w-full max-w-md border-[3px] bg-white p-5 shadow-2xl" style={{ borderColor: RED }} onClick={(e) => e.stopPropagation()}>
            <p className="mb-3 text-[12px] font-bold uppercase tracking-[0.06em] text-neutral-900">Add a feed</p>
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Tab name"
              className="mb-2 w-full border border-neutral-400 px-2 py-1 text-[11px] leading-[15px] outline-none focus:border-black"
            />
            <input
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addFeed(); if (e.key === "Escape") setAddOpen(false); }}
              placeholder="https:// RSS or Google Alerts address"
              className="w-full border border-neutral-400 px-2 py-1 text-[11px] leading-[15px] outline-none focus:border-black"
            />
            <div className="mt-4 flex justify-end gap-3 text-[12px] font-bold uppercase tracking-wide">
              <button onClick={addFeed} className="border-2 px-5 py-1.5 text-white transition-opacity hover:opacity-80" style={{ backgroundColor: RED, borderColor: RED }}>
                Add
              </button>
              <button onClick={() => setAddOpen(false)} className="border-2 px-5 py-1.5 transition-opacity hover:opacity-70" style={{ borderColor: RED, color: RED }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={() => setConfirm(null)}>
          <div className="w-full max-w-sm border-[3px] bg-white p-6 text-center shadow-2xl" style={{ borderColor: RED }} onClick={(e) => e.stopPropagation()}>
            <p className="text-[14px] font-bold uppercase tracking-[0.06em] text-neutral-900">Remove this feed?</p>
            <div className="mt-5 flex justify-center gap-3 text-[12px] font-bold uppercase tracking-wide">
              <button onClick={removeFeed} className="border-2 px-5 py-1.5 text-white transition-opacity hover:opacity-80" style={{ backgroundColor: RED, borderColor: RED }}>
                Remove
              </button>
              <button onClick={() => setConfirm(null)} className="border-2 px-5 py-1.5 transition-opacity hover:opacity-70" style={{ borderColor: RED, color: RED }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
