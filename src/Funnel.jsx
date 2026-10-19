import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { supabase } from "./lib/supabaseClient.js";

// Investing > Funnel, the very top: where the big industry trends stand. A dropdown holds
// a summary Claude writes from a web search; under it, a box to ask Claude to update it.
// The summary (and the one before it, for going back) is kept in Supabase.
const DOC_ID = "funnel-trends";
const BAR_BG = "#F2C46D";
const GAP_BG = "#8A8A8A";
const PINK = "#FBEFEC";
const head = "text-[11px] font-bold uppercase leading-[15px] tracking-[0.06em] text-neutral-900";
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const dateOf = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
};

export default function Funnel() {
  const [doc, setDoc] = useState(null); // { summary, at, prev, prevAt, open }
  const [ask, setAsk] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    supabase
      .from("admin_docs")
      .select("data")
      .eq("id", DOC_ID)
      .maybeSingle()
      .then(({ data }) => setDoc(data?.data || { open: true }));
  }, []);

  const save = (next) => {
    setDoc(next);
    supabase.from("admin_docs").upsert({ id: DOC_ID, data: next, updated_at: new Date().toISOString() }).then(() => {});
  };

  // Ask Claude for a fresh or updated summary; it searches the web, so it can take a minute.
  const update = async () => {
    if (busy) return;
    setBusy(true);
    setErr("");
    try {
      const { data } = await supabase.auth.getSession();
      const r = await fetch("/api/funnel-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${data?.session?.access_token || ""}` },
        body: JSON.stringify({ summary: doc.summary || "", ask: ask.trim() }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j.error) throw new Error(j.error || "Claude could not answer.");
      save({ ...doc, summary: j.summary, at: new Date().toISOString(), prev: doc.summary || "", prevAt: doc.at || "" });
      setAsk("");
    } catch (e) {
      setErr(e.message || "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  if (!doc) return <div className="w-full" />;

  return (
    <div className="w-full overflow-x-auto">
      <div className="w-full min-w-[640px] overflow-hidden border border-black bg-white shadow-sm">
        <div className="h-[10px]" style={{ backgroundColor: GAP_BG }} />
        {/* The bar opens and closes the trends, and stays as you left it. */}
        <div onClick={() => save({ ...doc, open: !doc.open })} className="flex h-[22px] cursor-pointer select-none items-center gap-2 border-t border-black px-2" style={{ backgroundColor: BAR_BG }}>
          <span className={head}>Industry trends</span>
          {doc.at && <span className="text-[11px] text-neutral-700">updated {dateOf(doc.at)}</span>}
          <ChevronDown size={14} strokeWidth={2.75} className={`ml-auto shrink-0 text-neutral-900 transition-transform ${doc.open ? "rotate-180" : ""}`} />
        </div>
        {doc.open && (
          <>
            {/* The summary, as Claude last wrote it. */}
            <div className="border-t border-black px-2 py-1.5 text-[11px] leading-[16px] text-neutral-900" style={{ backgroundColor: PINK }}>
              {doc.summary ? (
                <p className="whitespace-pre-wrap">{doc.summary}</p>
              ) : (
                <p className="italic text-neutral-500">No summary yet. Use the box below to ask Claude for the first one.</p>
              )}
              {doc.prev && (
                <button
                  onClick={() => save({ ...doc, summary: doc.prev, at: doc.prevAt, prev: doc.summary, prevAt: doc.at })}
                  className="mt-1 text-[10px] text-[#0f766e] underline underline-offset-2 hover:text-[#0c5e57]"
                >
                  Swap back to the previous summary
                </button>
              )}
            </div>
            {/* The AI box: what to update, then Update. Enter sends; Shift+Enter starts a new line. */}
            <div className="flex items-start gap-2 border-t border-black px-2 py-1.5">
              <textarea
                value={ask}
                onChange={(e) => setAsk(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); update(); } }}
                rows={2}
                placeholder={doc.summary ? "What should Claude update? Leave empty to refresh the whole summary." : "Anything Claude should cover? Leave empty for a general summary."}
                className="min-w-0 flex-1 resize-none border border-neutral-400 bg-white px-1.5 py-1 text-[11px] leading-[15px] text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-[#0f766e]"
              />
              <button
                onClick={update}
                disabled={busy}
                className="h-[24px] shrink-0 border border-[#0f766e] bg-[#0f766e] px-3 text-[11px] font-bold uppercase tracking-wide text-white hover:bg-[#0c5e57] disabled:opacity-50"
              >
                {busy ? "Working…" : doc.summary ? "Update" : "Write"}
              </button>
            </div>
            {busy && <p className="border-t border-black px-2 py-1 text-[11px] italic text-neutral-500">Claude is searching the web and writing. This can take a minute.</p>}
            {err && <p className="border-t border-black px-2 py-1 text-[11px] font-semibold text-[#C1440E]">{err}</p>}
          </>
        )}
        <div className="h-[10px] border-t border-black" style={{ backgroundColor: GAP_BG }} />
      </div>
    </div>
  );
}
