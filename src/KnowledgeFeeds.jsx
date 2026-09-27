import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Trash2, RefreshCw, X } from "lucide-react";
import { supabase } from "./lib/supabaseClient.js";

// Knowledge feeds, built the way the Says feeds box works: a strip of tabs, then the
// headlines from the feed behind the open tab. The feed list is typed in here and
// kept in Supabase, so it follows you between devices.
const DOC_ID = "knowledge-feeds";
const BAR_BG = "#F2C46D";   // title bar
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
const when = (s) => {
  const d = new Date(s);
  if (isNaN(d)) return "";
  const mins = Math.round((Date.now() - d) / 60000);
  const age = mins < 60 ? `${Math.max(mins, 1)}m` : mins < 1440 ? `${Math.round(mins / 60)}h` : `${Math.round(mins / 1440)}d`;
  return `${String(d.getDate()).padStart(2, "0")} ${MONTHS[d.getMonth()]} · ${age}`;
};

export default function KnowledgeFeeds() {
  const [feeds, setFeeds] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState("all"); // "all", a feed id, or "manage"
  const [items, setItems] = useState({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
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
    if (tab === "all") feeds.forEach((f) => pull(f));
    else if (tab !== "manage") pull(feeds.find((f) => f.id === tab));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, loaded, feeds.length]);

  const rows = useMemo(() => {
    const list = tab === "all" ? feeds.flatMap((f) => items[f.id] || []) : items[tab] || [];
    return dedupe([...list].sort((a, b) => new Date(b.published) - new Date(a.published)));
  }, [tab, feeds, items]);

  const addFeed = () => {
    const name = newName.trim();
    const url = newUrl.trim();
    if (!name || !/^https:\/\//i.test(url)) {
      setErr("A name and an https feed address are needed.");
      return;
    }
    save([...feeds, { id: newId(), name, url }].sort((a, b) => a.name.localeCompare(b.name)));
    setNewName("");
    setNewUrl("");
    setErr("");
  };

  const removeFeed = () => {
    const next = feeds.filter((f) => f.id !== confirm);
    save(next);
    if (tab === confirm) setTab("all");
    setConfirm(null);
  };

  const refresh = () => {
    if (tab === "all") feeds.forEach((f) => pull(f, true));
    else if (tab !== "manage") pull(feeds.find((f) => f.id === tab), true);
  };

  // Tabs: square cornered, one hairline, the open one carrying the panel colour so it
  // reads as part of the sheet below it.
  const tabClass = (on) =>
    `h-[19px] shrink-0 whitespace-nowrap border px-2 text-[10px] font-bold uppercase leading-none tracking-wide transition-colors ${
      on
        ? "relative z-10 border-black border-b-transparent text-neutral-900"
        : "border-transparent text-neutral-500 hover:text-neutral-900"
    }`;

  return (
    <div className="w-full overflow-x-auto">
      <div className="w-full min-w-[720px] border border-black shadow-sm" style={{ backgroundColor: BODY_BG }}>
        <div className="flex h-[18px] items-center gap-2 px-2" style={{ backgroundColor: BAR_BG }}>
          <span className={`flex-1 ${head}`}>Knowledge feeds</span>
          <span className="text-[10px] font-bold uppercase tracking-wide text-neutral-700">{rows.length}</span>
          <button onClick={refresh} title="Refresh" className="flex h-[15px] items-center text-neutral-900 transition-opacity hover:opacity-70">
            <RefreshCw size={11} className={busy ? "animate-spin" : ""} />
          </button>
        </div>

        <div className="flex items-end gap-0.5 border-t border-black px-2 pt-1" style={{ backgroundColor: BAR_BG }}>
          <button onClick={() => setTab("all")} className={tabClass(tab === "all")} style={tab === "all" ? { backgroundColor: BODY_BG } : undefined}>
            All
          </button>
          {feeds.map((f) => (
            <button
              key={f.id}
              onClick={() => setTab(f.id)}
              title={f.name}
              className={tabClass(tab === f.id)}
              style={tab === f.id ? { backgroundColor: BODY_BG } : undefined}
            >
              {f.name}
            </button>
          ))}
          <button onClick={() => setTab("manage")} className={tabClass(tab === "manage")} style={tab === "manage" ? { backgroundColor: BODY_BG } : undefined}>
            Feeds
          </button>
        </div>

        {tab === "manage" ? (
          <div className="border-t border-black">
            <div className="flex h-[21px] items-center gap-1 border-b border-black px-2">
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
            {feeds.map((f) => (
              <div key={f.id} className="flex h-[21px] items-center gap-2 border-b border-black px-2">
                <span className="w-40 shrink-0 truncate text-[11px] font-semibold leading-[15px] text-neutral-900">{f.name}</span>
                <span className="min-w-0 flex-1 truncate text-[11px] leading-[15px] text-neutral-500">{f.url}</span>
                <button onClick={() => setConfirm(f.id)} title="Remove this feed" className="flex h-[15px] items-center text-neutral-900 hover:text-[#C1440E]">
                  <Trash2 size={11} />
                </button>
              </div>
            ))}
            {!feeds.length && <p className="px-2 py-2 text-[11px] italic text-neutral-400">No feeds yet. Paste a Google Alerts or RSS address above.</p>}
          </div>
        ) : (
          <div className="border-t border-black">
            {rows.map((r, i) => (
              <div key={`${r.link}-${i}`} className={`px-2 py-[3px] ${i === 0 ? "" : "border-t border-neutral-300"}`}>
                <div className="flex items-start gap-2">
                  <a
                    href={r.link}
                    target="_blank"
                    rel="noreferrer"
                    title={r.title}
                    className="min-w-0 flex-1 truncate text-[11px] leading-[15px] underline underline-offset-2"
                    style={{ color: "#171717" }}
                  >
                    <span className="font-bold uppercase" style={{ color: GOLD }}>{r.feedName}: </span>
                    {r.title}
                  </a>
                  <span className="shrink-0 whitespace-nowrap text-[10px] leading-[15px] tabular-nums text-neutral-500">{when(r.published)}</span>
                </div>
                {r.summary && (
                  <p className="truncate text-[10px] leading-[14px] text-neutral-500">{r.summary}</p>
                )}
              </div>
            ))}
            {loaded && !rows.length && (
              <p className="px-2 py-2 text-[11px] italic text-neutral-400">
                {feeds.length ? "Nothing in this feed right now." : "Open the Feeds tab to add one."}
              </p>
            )}
          </div>
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
