import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Trash2, RefreshCw, X } from "lucide-react";
import { supabase } from "./lib/supabaseClient.js";

// Knowledge feeds: a tab per RSS or Google Alerts feed, headlines underneath. The
// feed list is typed in here and kept in Supabase, so it follows you between devices.
const DOC_ID = "knowledge-feeds";
const BAR_BG = "#F2C46D";
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
      title: stripTags(entry.querySelector("title")?.textContent || ""),
      link: cleanLink(link),
      published: isAtom
        ? entry.querySelector("published")?.textContent || entry.querySelector("updated")?.textContent || ""
        : entry.querySelector("pubDate")?.textContent || "",
    };
  });
}

const stripTags = (s) => String(s || "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();

// Google Alerts wraps every link in its own redirect; the real address is in `url`.
const cleanLink = (href) => {
  try {
    const u = new URL(href);
    const inner = u.searchParams.get("url") || u.searchParams.get("q");
    return inner && /^https?:\/\//i.test(inner) ? inner : href;
  } catch {
    return href;
  }
};

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const shortDate = (s) => {
  const d = new Date(s);
  if (isNaN(d)) return "";
  return `${String(d.getDate()).padStart(2, "0")} ${MONTHS[d.getMonth()]}`;
};
const sourceOf = (link) => {
  try {
    return new URL(link).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};

export default function KnowledgeFeeds() {
  const [feeds, setFeeds] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [active, setActive] = useState(null); // feed id, or "all"
  const [items, setItems] = useState({}); // feed id -> parsed entries
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [confirm, setConfirm] = useState(null);
  const pulled = useRef({});

  useEffect(() => {
    supabase
      .from("admin_docs")
      .select("data")
      .eq("id", DOC_ID)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) setErr(error.message);
        const list = Array.isArray(data?.data) ? data.data : [];
        setFeeds(list);
        setActive(list.length ? list[0].id : null);
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
    if (!feed) return;
    if (!force && pulled.current[feed.id]) return;
    pulled.current[feed.id] = true;
    setBusy(true);
    try {
      const res = await fetch(`/api/rss?url=${encodeURIComponent(feed.url)}`);
      const xml = await res.text();
      if (!res.ok) throw new Error(xml.slice(0, 120));
      setItems((prev) => ({ ...prev, [feed.id]: parseFeedXml(xml, feed.name) }));
      setErr("");
    } catch (e) {
      setErr(`${feed.name}: ${e.message || "could not be read"}`);
    } finally {
      setBusy(false);
    }
  };

  // Opening a tab pulls that feed once; the refresh button pulls it again.
  useEffect(() => {
    if (active && active !== "all") pull(feeds.find((f) => f.id === active));
    if (active === "all") feeds.forEach((f) => pull(f));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, loaded]);

  const rows = useMemo(() => {
    const list = active === "all" ? feeds.flatMap((f) => items[f.id] || []) : items[active] || [];
    return [...list].sort((a, b) => new Date(b.published) - new Date(a.published));
  }, [active, feeds, items]);

  const addFeed = () => {
    const name = newName.trim();
    const url = newUrl.trim();
    if (!name || !/^https:\/\//i.test(url)) {
      setErr("A name and an https feed address are needed.");
      return;
    }
    const feed = { id: newId(), name, url };
    // Tabs read alphabetically, so a new feed slots into place.
    save([...feeds, feed].sort((a, b) => a.name.localeCompare(b.name)));
    setNewName("");
    setNewUrl("");
    setAdding(false);
    setActive(feed.id);
  };

  const removeFeed = () => {
    const next = feeds.filter((f) => f.id !== confirm);
    save(next);
    if (active === confirm) setActive(next.length ? next[0].id : null);
    setConfirm(null);
  };

  const tab = (on) =>
    `h-[21px] shrink-0 whitespace-nowrap border px-2 text-[11px] font-bold uppercase leading-none tracking-wide transition-colors ${
      on ? "border-black bg-white text-neutral-900" : "border-transparent text-neutral-500 hover:text-neutral-900"
    }`;

  return (
    <div className="w-full overflow-x-auto">
      <div className="w-full min-w-[720px] border border-black bg-white shadow-sm">
        {/* Title bar with the refresh and add controls on the right. */}
        <div className="flex h-[18px] items-center gap-2 px-2" style={{ backgroundColor: BAR_BG }}>
          <span className={`flex-1 ${head}`}>Knowledge feeds</span>
          <button
            onClick={() => (active === "all" ? feeds.forEach((f) => pull(f, true)) : pull(feeds.find((f) => f.id === active), true))}
            title="Refresh"
            className="flex h-[15px] items-center text-neutral-900 transition-opacity hover:opacity-70"
          >
            <RefreshCw size={11} className={busy ? "animate-spin" : ""} />
          </button>
          <button onClick={() => setAdding((v) => !v)} title="Add a feed" className="flex h-[15px] items-center text-neutral-900 transition-opacity hover:opacity-70">
            <Plus size={12} />
          </button>
        </div>

        {/* One slim tab per feed, the open one framed. */}
        <div className="flex items-center gap-1 overflow-x-auto border-t border-black px-2 py-1">
          <button onClick={() => setActive("all")} className={tab(active === "all")}>All</button>
          {feeds.map((f) => (
            <span key={f.id} className="group relative flex shrink-0 items-center">
              <button onClick={() => setActive(f.id)} className={tab(active === f.id)}>{f.name}</button>
              <button
                onClick={() => setConfirm(f.id)}
                title="Remove this feed"
                className="ml-0.5 hidden text-neutral-400 hover:text-[#C1440E] group-hover:block"
              >
                <X size={10} />
              </button>
            </span>
          ))}
          {!feeds.length && loaded && (
            <span className="text-[11px] italic text-neutral-400">No feeds yet. Use the plus above.</span>
          )}
        </div>

        {adding && (
          <div className="flex h-[21px] items-center gap-1 border-t border-black bg-neutral-50 px-2">
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Name"
              className="w-40 shrink-0 bg-transparent text-[11px] leading-[15px] outline-none placeholder:text-neutral-300"
            />
            <input
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addFeed(); if (e.key === "Escape") setAdding(false); }}
              placeholder="https:// feed address"
              className="min-w-0 flex-1 bg-transparent text-[11px] leading-[15px] outline-none placeholder:text-neutral-300"
            />
            <button onClick={addFeed} title="Save" style={{ color: GOLD }} className="flex h-[15px] items-center hover:opacity-70">
              <Plus size={12} />
            </button>
            <button onClick={() => setAdding(false)} title="Cancel" className="flex h-[15px] items-center text-neutral-900 hover:text-[#C1440E]">
              <X size={12} />
            </button>
          </div>
        )}

        {/* Column headings, then a row per headline. */}
        <div className="flex h-[18px] items-center gap-2 border-t border-black px-2" style={{ backgroundColor: "#FFE4B3" }}>
          <span className={`w-[14%] shrink-0 ${head}`}>Date</span>
          <span className={`w-[18%] shrink-0 ${head}`}>Source</span>
          <span className={`min-w-0 flex-1 ${head}`}>Headline</span>
        </div>

        {rows.map((r, i) => (
          <div key={`${r.link}-${i}`} className="flex h-[21px] items-center gap-2 border-t border-black px-2">
            <span className="w-[14%] shrink-0 text-[11px] leading-[15px] tabular-nums text-neutral-900">{shortDate(r.published)}</span>
            <span className="w-[18%] shrink-0 truncate text-[11px] leading-[15px] text-neutral-500">{sourceOf(r.link)}</span>
            <a
              href={r.link}
              target="_blank"
              rel="noreferrer"
              className="min-w-0 flex-1 truncate text-[11px] leading-[15px] underline underline-offset-2"
              style={{ color: "#171717" }}
              title={r.title}
            >
              {r.title}
            </a>
          </div>
        ))}

        {loaded && !rows.length && (
          <p className="border-t border-black px-2 py-2 text-[11px] italic text-neutral-400">
            {feeds.length ? "Nothing in this feed right now." : "Add a feed to start."}
          </p>
        )}
      </div>

      {err && <p className="pt-2 text-[11px] font-semibold text-[#C1440E]">{err}</p>}

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
