import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { supabase } from "./lib/supabaseClient.js";

// What is owned, section by section. Built up step by step; the figures live in
// Supabase, never in this public repo.
const DOC_ID = "assets";
const BAR_BG = "#F2C46D"; // section bars
const SUB_BG = "#FFE4B3"; // a group inside a section, one step down
const HEADER_BG = "#FCEFCF"; // column headings, one step further down
const GAP_BG = "#8A8A8A"; // the grey band between sections
const head = "text-[11px] font-bold uppercase leading-[15px] tracking-[0.06em] text-neutral-900";

// In the order they are worked through.
const SECTIONS = ["Cash", "Stocks", "Real estate", "Canada"];

// The cash accounts to start with; balances are typed in by hand for now.
const START_CASH = [
  { id: "dib", name: "Dubai Islamic Bank (Silx FZ LLE)", aed: "", eur: "" },
  { id: "moneycorp", name: "Moneycorp (Silx FZ LLE)", aed: "", eur: "" },
];

// DIB opens, like an account in Cash flow, onto the lines it is made of.
const DIB_PARTS = [
  { id: "balance", name: "Bank balance" },
  { id: "ar", name: "Account receivable" },
];
// Gives DIB its two lines the first time; a balance already typed on DIB itself
// moves down into Bank balance, so nothing typed is lost.
const withParts = (cash) =>
  cash.map((r) => {
    if (r.id !== "dib" || r.subs) return r;
    const { aed, eur, from, updated, ...rest } = r;
    return { ...rest, subs: DIB_PARTS.map((x) => (x.id === "balance" ? { ...x, aed, eur, from, updated } : { ...x })) };
  });

let _idc = 0;
const newId = () => "a" + Date.now().toString(36) + "-" + (_idc++);

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

// A typed amount: plain while you type in it, then shown with its currency, as in
// Cash flow, once you leave it.
function Amount({ value, onChange, cur }) {
  const [typing, setTyping] = useState(false);
  return (
    <input
      value={typing ? value : money(value) && `${cur} ${money(value)}`}
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
  const blankId = useRef(newId()); // the id the blank line will keep once typed in
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
        setDoc({ ...d, cash: withParts(d.cash || START_CASH), personal: d.personal || [] });
      });
  }, []);

  const save = (next) => {
    setDoc(next);
    supabase
      .from("admin_docs")
      .upsert({ id: DOC_ID, data: next, updated_at: new Date().toISOString() })
      .then(({ error }) => setErr(error ? error.message : ""));
  };
  // `list` is "cash" (Silx) or "personal". `sub` is one of the lines inside an
  // account, such as DIB's Bank balance. Typing in the blank line at the foot of a
  // list makes it a real line, and a fresh blank one appears under it.
  const editCash = (list, id, fields, sub) => {
    const rows = doc[list] || [];
    // The blank line already carries the id it will keep, so the caret stays put.
    if (!rows.some((r) => r.id === id)) { blankId.current = newId(); save({ ...doc, [list]: [...rows, { id, name: "", ...fields }] }); return; }
    save({
      ...doc,
      [list]: rows.map((r) =>
        r.id !== id ? r : sub ? { ...r, subs: r.subs.map((x) => (x.id === sub ? { ...x, ...fields } : x)) } : { ...r, ...fields }
      ),
    });
  };
  // A balance is typed in one currency; the other follows at today's rate, and the
  // row is marked with the day it was typed. Any change to the row marks it too.
  const setBalance = (list, id, cur, v, sub) => editCash(list, id, { [cur]: v, from: cur, updated: new Date().toISOString() }, sub);
  const toggleOpen = (id) => save({ ...doc, ui: { ...(doc.ui || {}), open: { ...(doc.ui?.open || {}), [id]: !doc.ui?.open?.[id] } } });
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
  // and in EUR. Type either; the other fills itself at today's rate. One group of
  // accounts after another, each under its own bar.
  const cashGroup = (list, title, withBlank) => (
    <>
      {/* Whose accounts these are, then the column headings under it. */}
      <div className="flex h-[22px] items-center border-t border-black px-2" style={{ backgroundColor: SUB_BG }}>
        <span className={head}>{title}</span>
      </div>
      <div className="flex h-[22px] items-stretch border-t border-black" style={{ backgroundColor: HEADER_BG }}>
        <span className={`flex flex-1 items-center px-2 ${head}`}>Account</span>
        <span className={`flex w-28 shrink-0 items-center border-l border-black px-2 ${head}`}>Updated</span>
        <span className={`flex w-40 shrink-0 items-center justify-end border-l border-black px-2 ${head}`}>AED</span>
        <span className={`flex w-40 shrink-0 items-center justify-end border-l border-black px-2 ${head}`}>EUR</span>
      </div>
      {[...(doc[list] || []), ...(withBlank ? [{ id: blankId.current, name: "" }] : [])].map((r) => {
        const row = (x, sub) => (
          // The lines inside an account sit on the faint pink, as in Cash flow.
          <div key={sub || x.id} className="flex h-[22px] items-stretch border-t border-black" style={sub ? { backgroundColor: "#FBEFEC" } : undefined}>
            <input
              value={x.name}
              onChange={(e) => editCash(list, r.id, { name: e.target.value, updated: new Date().toISOString() }, sub)}
              className={`min-w-0 flex-1 bg-transparent text-[11px] text-neutral-900 outline-none ${sub ? "pl-6 pr-2" : "px-2"}`}
            />
            <span className="flex w-28 shrink-0 items-center border-l border-black px-2 text-[11px] tabular-nums text-neutral-900">{dateOf(x.updated)}</span>
            <span className="flex w-40 shrink-0 items-center border-l border-black px-2">
              <Amount cur="AED" value={shown(x, "aed")} onChange={(v) => setBalance(list, r.id, "aed", v, sub)} />
            </span>
            <span className="flex w-40 shrink-0 items-center border-l border-black px-2">
              <Amount cur="EUR" value={shown(x, "eur")} onChange={(v) => setBalance(list, r.id, "eur", v, sub)} />
            </span>
          </div>
        );
        if (!r.subs) return row(r);
        // An account with lines inside: its figures are those lines added up, its date
        // the latest of theirs, and a click on the chevron opens or closes them.
        const open = !!doc.ui?.open?.[r.id];
        const sum = (cur) => {
          const vals = r.subs.map((x) => num(shown(x, cur))).filter((n) => n != null);
          return vals.length ? money(vals.reduce((a, b) => a + b, 0)) : "";
        };
        const latest = r.subs.map((x) => x.updated).filter(Boolean).sort().pop();
        return (
          <div key={r.id}>
            <div className="flex h-[22px] items-stretch border-t border-black">
              <span className="flex min-w-0 flex-1 items-center gap-1 px-2">
                <input
                  value={r.name}
                  onChange={(e) => editCash(list, r.id, { name: e.target.value })}
                  style={{ fieldSizing: "content" }}
                  className="min-w-0 bg-transparent text-[11px] text-neutral-900 outline-none"
                />
                <button onClick={() => toggleOpen(r.id)} title={open ? "Close" : "Open"} className="ml-auto shrink-0 text-neutral-900 hover:text-[#9c7c33]">
                  <ChevronDown size={12} className={`transition-transform ${open ? "rotate-180" : ""}`} />
                </button>
              </span>
              <span className="flex w-28 shrink-0 items-center border-l border-black px-2 text-[11px] tabular-nums text-neutral-900">{dateOf(latest)}</span>
              <span className="flex w-40 shrink-0 items-center justify-end border-l border-black px-2 text-[11px] tabular-nums text-neutral-900">{sum("aed") && `AED ${sum("aed")}`}</span>
              <span className="flex w-40 shrink-0 items-center justify-end border-l border-black px-2 text-[11px] tabular-nums text-neutral-900">{sum("eur") && `EUR ${sum("eur")}`}</span>
            </div>
            {open && r.subs.map((x) => row(x, x.id))}
          </div>
        );
      })}
    </>
  );
  const cash = (
    <>
      {cashGroup("cash", "Silx FZ LLE accounts", false)}
      {cashGroup("personal", "Personal accounts", true)}
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
