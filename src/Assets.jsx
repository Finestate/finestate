import { useEffect, useState } from "react";
import { supabase } from "./lib/supabaseClient.js";

// What is owned, section by section. Built up step by step; the figures live in
// Supabase, never in this public repo.
const DOC_ID = "assets";
const BAR_BG = "#F2C46D"; // section bars
const HEADER_BG = "#FFE4B3"; // column headings inside a section
const GAP_BG = "#8A8A8A"; // the grey band between sections
const head = "text-[11px] font-bold uppercase leading-[15px] tracking-[0.06em] text-neutral-900";

// In the order they are worked through.
const SECTIONS = ["Cash", "Stocks", "Real estate", "Canada"];

// The cash accounts to start with; balances are typed in by hand for now.
const START_CASH = [
  { id: "dib", name: "Dubai Islamic Bank (Silx FZ LLE)", aed: "", eur: "" },
  { id: "moneycorp", name: "Moneycorp (Silx FZ LLE)", aed: "", eur: "" },
];

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

// Amounts are kept as typed; on screen they read with thousands commas and two decimals.
const num = (v) => {
  const n = parseFloat(String(v ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : null;
};
const money = (v) => {
  const n = num(v);
  return n == null ? "" : n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// A typed amount: plain while you type in it, formatted once you leave it.
function Amount({ value, onChange }) {
  const [typing, setTyping] = useState(false);
  return (
    <input
      value={typing ? value : money(value)}
      onFocus={() => setTyping(true)}
      onBlur={() => setTyping(false)}
      onChange={(e) => onChange(e.target.value)}
      inputMode="decimal"
      className="w-full bg-transparent text-right text-[11px] tabular-nums text-neutral-900 outline-none"
    />
  );
}

export default function Assets() {
  const [doc, setDoc] = useState(null);
  const [err, setErr] = useState("");
  // Today's rates against the euro: rates.AED is how many dirhams one euro buys.
  const [rates, setRates] = useState(null);
  useEffect(() => {
    fetch("/api/fx")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j?.rates) setRates(j.rates); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    supabase
      .from("admin_docs")
      .select("data")
      .eq("id", DOC_ID)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) setErr(error.message);
        const d = data?.data || {};
        setDoc({ ...d, cash: d.cash || START_CASH });
      });
  }, []);

  const save = (next) => {
    setDoc(next);
    supabase
      .from("admin_docs")
      .upsert({ id: DOC_ID, data: next, updated_at: new Date().toISOString() })
      .then(({ error }) => setErr(error ? error.message : ""));
  };
  const editCash = (id, fields) => save({ ...doc, cash: doc.cash.map((r) => (r.id === id ? { ...r, ...fields } : r)) });
  // A balance is typed in one currency; the other follows at today's rate, and the
  // row is marked with the day it was typed. Any change to the row marks it too.
  const setBalance = (id, cur, v) => editCash(id, { [cur]: v, from: cur, updated: new Date().toISOString() });
  const shown = (r, cur) => {
    if (!r.from || r.from === cur) return r[cur] || "";
    const n = num(r[r.from]);
    if (n == null || !rates?.AED) return "";
    return (cur === "eur" ? n / rates.AED : n * rates.AED).toFixed(2);
  };
  const dateOf = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    return `${String(d.getDate()).padStart(2, "0")} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  };

  if (!doc) return <div className="w-full" />;

  // Cash: the account on the left, the day it was last updated, then its balance in AED
  // and in EUR. Type either; the other fills itself at today's rate.
  const cash = (
    <>
      <div className="flex h-[22px] items-stretch border-t border-black" style={{ backgroundColor: HEADER_BG }}>
        <span className={`flex flex-1 items-center px-2 ${head}`}>Account</span>
        <span className={`flex w-28 shrink-0 items-center border-l border-black px-2 ${head}`}>Updated</span>
        <span className={`flex w-40 shrink-0 items-center justify-end border-l border-black px-2 ${head}`}>AED</span>
        <span className={`flex w-40 shrink-0 items-center justify-end border-l border-black px-2 ${head}`}>EUR</span>
      </div>
      {doc.cash.map((r) => (
        <div key={r.id} className="flex h-[22px] items-stretch border-t border-black">
          <input
            value={r.name}
            onChange={(e) => editCash(r.id, { name: e.target.value, updated: new Date().toISOString() })}
            className="min-w-0 flex-1 bg-transparent px-2 text-[11px] text-neutral-900 outline-none"
          />
          <span className="flex w-28 shrink-0 items-center border-l border-black px-2 text-[11px] tabular-nums text-neutral-900">{dateOf(r.updated)}</span>
          <span className="flex w-40 shrink-0 items-center border-l border-black px-2">
            <Amount value={shown(r, "aed")} onChange={(v) => setBalance(r.id, "aed", v)} />
          </span>
          <span className="flex w-40 shrink-0 items-center border-l border-black px-2">
            <Amount value={shown(r, "eur")} onChange={(v) => setBalance(r.id, "eur", v)} />
          </span>
        </div>
      ))}
    </>
  );

  return (
    // Narrow windows scroll the table sideways rather than squashing the columns.
    <div className="w-full overflow-x-auto">
      <div className="w-full min-w-[760px] overflow-hidden border border-black bg-white shadow-sm">
        {SECTIONS.map((name, i) => (
          <div key={name}>
            {/* A grey band, then the section's bar. */}
            <div className={`h-[10px] ${i ? "border-t border-black" : ""}`} style={{ backgroundColor: GAP_BG }} />
            <div className="flex h-[22px] items-center border-t border-black px-2" style={{ backgroundColor: BAR_BG }}>
              <span className={head}>{name}</span>
            </div>
            {name === "Cash" && cash}
          </div>
        ))}
        <div className="h-[10px] border-t border-black" style={{ backgroundColor: GAP_BG }} />
      </div>
      {err && <p className="pt-2 text-[11px] font-semibold text-[#C1440E]">{err}</p>}
    </div>
  );
}
