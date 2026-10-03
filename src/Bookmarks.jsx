import { useEffect, useRef, useState } from "react";
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

export default function Bookmarks() {
  const [data, setData] = useState(null); // { sections: [...] }
  const [err, setErr] = useState("");
  const fileRef = useRef(null);

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

  return (
    <div className="w-full">
      <div className="w-full border border-black bg-white shadow-sm">
        <div className="flex h-[18px] items-center px-2" style={{ backgroundColor: BAR_BG }}>
          <span className={`flex-1 ${head}`}>Bookmarks</span>
          <button
            onClick={() => fileRef.current?.click()}
            className="text-[11px] font-semibold text-[#0f766e] underline underline-offset-2 hover:text-[#0c5e57]"
          >
            {empty ? "Import from Chrome" : "Import again (replaces all)"}
          </button>
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
            <div className="flex h-[18px] items-center border-y border-black bg-[#FFE4B3] px-2">
              <span className={head}>{s.name}</span>
            </div>
            {s.groups.map((g, gi) => (
              <div key={gi} className={`flex flex-col px-2 py-1 ${gi > 0 ? "border-t border-neutral-300" : ""}`}>
                {g.map((b, bi) => (
                  <a
                    key={bi}
                    href={b.href}
                    target="_blank"
                    rel="noreferrer"
                    title={b.href}
                    className="truncate text-[11px] leading-[17px] text-[#0f766e] underline underline-offset-2 hover:text-[#0c5e57]"
                  >
                    {b.title}
                  </a>
                ))}
              </div>
            ))}
          </div>
        ))}
        </div>
        )}
      </div>
      {err && <p className="pt-2 text-[11px] font-semibold text-[#C1440E]">{err}</p>}
    </div>
  );
}
