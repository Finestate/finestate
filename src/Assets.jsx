import { useEffect, useRef, useState } from "react";
import { ChevronDown, Minus, Plus, RefreshCw, Trash2 } from "lucide-react";
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
const SECTIONS = ["Cash", "Companies", "Stocks", "Real estate", "Parent estates", "Totals"];

// The cash accounts to start with; balances are typed in by hand for now.
// The companies to start with; more can be added.
const START_COMPANIES = [
  { id: "servefast", name: "Servefast GmbH" },
  { id: "silx", name: "Silx FZ LLE" },
  { id: "tlz", name: "Trade License Zone FZCO" },
];

// Germany starts with three lines; more can be added.
const DE_START = [
  { id: "invest", name: "Investment account" },
  { id: "gold", name: "Gold" },
  { id: "savings", name: "Savings account" },
];

// Stocks start with one account that opens onto its holdings, added as you go.
const START_STOCKS = [{ id: "swissquote", name: "Swissquote (Silx FZ LLE)", subs: [] }];

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
// `auto`: the figure was worked out by the site, so it reads in blue.
function Amount({ value, onChange, cur, auto }) {
  const [typing, setTyping] = useState(false);
  return (
    <input
      value={typing ? value : money(value) && `${cur} ${money(value)}`}
      onFocus={() => setTyping(true)}
      onBlur={() => setTyping(false)}
      onChange={(e) => onChange(e.target.value)}
      inputMode="decimal"
      className={`w-full bg-transparent text-right text-[11px] tabular-nums outline-none ${auto && !typing ? "text-[#1d4ed8]" : "text-neutral-900"}`}
    />
  );
}

// A typed percentage: plain while you type, then shown with its % sign.
function Percent({ value, onChange }) {
  const [typing, setTyping] = useState(false);
  const n = num(value);
  return (
    <input
      value={typing ? value ?? "" : n == null ? "" : `${n}%`}
      onFocus={() => setTyping(true)}
      onBlur={() => setTyping(false)}
      onChange={(e) => onChange(e.target.value.replace(/%/g, ""))}
      inputMode="decimal"
      className="w-full bg-transparent text-right text-[11px] tabular-nums text-neutral-900 outline-none"
    />
  );
}

export default function Assets() {
  const [doc, setDoc] = useState(null);
  const [err, setErr] = useState("");
  // The size of the whole table, so all of it fits on screen: the left button makes it
  // smaller a step at a time, the right one larger again, up to full size. Remembered
  // in this browser only.
  const [zoom, setZoom] = useState(() => {
    try { const z = Number(localStorage.getItem("assets-zoom")); return z >= 40 && z <= 100 ? z : 100; } catch { return 100; }
  });
  const setZoomTo = (z) => {
    const next = Math.max(40, Math.min(100, z));
    setZoom(next);
    try { localStorage.setItem("assets-zoom", String(next)); } catch {}
  };
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
        // A line left completely empty is dropped.
        const used = (r) => r.subs || r.name?.trim() || r.aed || r.eur;
        setDoc({ ...d, cash: withParts(d.cash || START_CASH).filter(used), personal: (d.personal || []).filter(used), stocks: d.stocks || START_STOCKS, germany: d.germany || DE_START, companies: d.companies || START_COMPANIES });
      });
  }, []);

  // Your own Stadtsparkasse account, as last read from the bank on the Cash flow page.
  // It fills the first personal account, so the two pages always agree.
  const [ownBank, setOwnBank] = useState(null); // { eur, at }
  useEffect(() => {
    supabase
      .from("admin_docs")
      .select("data")
      .eq("id", "bank-link")
      .maybeSingle()
      .then(({ data }) => {
        const link = data?.data || {};
        // The same rule as Cash flow: yours is the one that is not a youth or business account.
        const own = (link.accounts || []).find((a) => !/jugend|gesch|business|gmbh/i.test(`${a.product || ""} ${a.name || ""}`));
        const b = own && link.balances?.[own.uid];
        if (b && !b.error && b.amount !== "" && num(b.amount) != null) setOwnBank({ eur: num(b.amount), at: link.at, nr: String(own.iban || "").replace(/\D/g, "").slice(-8) });
      });
  }, []);

  // Latest share prices for every ticker under Stocks, read once the page has its figures.
  const [quotes, setQuotes] = useState({});
  const [quoteTick, setQuoteTick] = useState(0); // bumped by the refresh button
  const [quoteBusy, setQuoteBusy] = useState(false);
  const tickers = [...new Set((doc?.stocks || []).flatMap((r) => r.subs || []).map((x) => String(x.ticker || "").trim().toUpperCase()).filter(Boolean))].join(",");
  useEffect(() => {
    if (!tickers) return;
    (async () => {
      setQuoteBusy(true);
      const { data } = await supabase.auth.getSession();
      // A refresh skips the browser's short-term copy and asks again.
      const r = await fetch(`/api/quote?symbols=${encodeURIComponent(tickers)}`, { cache: quoteTick ? "no-store" : "default", headers: { Authorization: `Bearer ${data?.session?.access_token || ""}` } });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.quotes) setQuotes(j.quotes);
      setQuoteBusy(false);
    })();
  }, [tickers, quoteTick]);

  // The mortgage loans, as typed on the Cash flow page (its Debt line), so the house
  // here always nets off the same figures.
  const [loans, setLoans] = useState([]);
  useEffect(() => {
    supabase
      .from("admin_docs")
      .select("data")
      .eq("id", "costs-fc")
      .maybeSingle()
      .then(({ data }) => setLoans((data?.data?.loans || []).filter((l) => num(l.amount) != null)));
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
  // A bin at the end of a name cell, asking first; and the green Add line under a list.
  const binFor = (list, id, name) => (
    <button onClick={() => setConfirm({ list, id, name })} title="Delete" className="mr-2 shrink-0 self-center text-neutral-900 hover:text-[#C1440E]">
      <Trash2 size={11} />
    </button>
  );
  const addLine = (list, fresh) => (
    <button
      onClick={() => save({ ...doc, [list]: [...(doc[list] || []), { id: newId(), name: "", ...fresh }] })}
      className="flex h-[22px] w-full items-center gap-[2px] border-t border-black px-2 text-[11px] font-bold text-[#0f766e] hover:text-[#0c5e57]"
    >
      <Plus size={11} strokeWidth={3} />Add
    </button>
  );
  const toggleOpen = (id) => save({ ...doc, ui: { ...(doc.ui || {}), open: { ...(doc.ui?.open || {}), [id]: !doc.ui?.open?.[id] } } });
  // Any currency to any other, through the euro: rates.X is how much X one euro buys.
  const rateOf = (cur) => (cur === "eur" ? 1 : rates?.[cur.toUpperCase()]);
  const shown = (r, cur) => {
    if (!r.from || r.from === cur) return r[cur] || "";
    const n = num(r[r.from]);
    const a = rateOf(r.from), b = rateOf(cur);
    if (n == null || !a || !b) return "";
    return ((n / a) * b).toFixed(2);
  };
  // The rows of a list as shown: your Stadtsparkasse account, wherever it sits among the
  // personal accounts, takes its EUR balance and date from the bank; its AED follows at
  // today's rate. It is found by its account number in the name.
  const rowsOf = (list) => {
    const rows = doc[list] || [];
    // A holding with a ticker and a number of shares is valued at the latest price, in
    // the share's own currency; the CHF and EUR follow at today's rates.
    if (list === "stocks") {
      return rows.map((r) => ({
        ...r,
        subs: (r.subs || []).map((x) => {
          const q = quotes[String(x.ticker || "").trim().toUpperCase()];
          const n = num(x.shares);
          if (!q || n == null) return x;
          const cur = q.currency.toLowerCase();
          return { ...x, [cur]: String(q.price * n), from: cur, updated: q.at || x.updated, live: true, price: q };
        }),
      }));
    }
    if (list !== "personal" || !ownBank) return rows;
    // The row carrying your account number; failing that, the only Sparkasse row.
    const digits = (r) => String(r.name || "").replace(/\D/g, "");
    let at = ownBank.nr ? rows.findIndex((r) => digits(r).includes(ownBank.nr)) : -1;
    if (at < 0) { const sp = rows.filter((r) => /sparkasse/i.test(r.name || "")); if (sp.length === 1) at = rows.indexOf(sp[0]); }
    return rows.map((r, i) => (i === at ? { ...r, from: "eur", eur: String(ownBank.eur), updated: ownBank.at, live: true } : r));
  };
  const [confirm, setConfirm] = useState(null); // a line waiting on Delete or Cancel
  const removeRow = (list, id, sub) =>
    save({
      ...doc,
      [list]: (doc[list] || []).flatMap((r) => (sub ? (r.id === id ? [{ ...r, subs: r.subs.filter((x) => x.id !== sub) }] : [r]) : r.id === id ? [] : [r])),
    });
  // A new line inside an account, such as a holding under Swissquote.
  const addSub = (list, id) =>
    save({ ...doc, [list]: (doc[list] || []).map((r) => (r.id === id ? { ...r, subs: [...(r.subs || []), { id: newId(), name: "" }] } : r)) });
  const dateOf = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    return `${String(d.getDate()).padStart(2, "0")} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  };

  if (!doc) return <div className="w-full" />;

  // Cash: the account on the left, the day it was last updated, then its balance in AED
  // and in EUR. Type either; the other fills itself at today's rate. One group of
  // accounts after another, each under its own bar.
  // `title` is left out where the section bar already says it all, as in Stocks.
  // `extra`: more typed columns after the name, such as Ticker and Shares for a holding.
  // They are filled in on the lines inside an account; the account line leaves them empty.
  // `curs`: the money columns, EUR always last – AED and EUR for the Dubai accounts;
  // CHF, USD and EUR for Swissquote. `cw` is their width.
  // An `extra` column named "price" is not typed: it shows a holding's latest share price.
  const cashGroup = (list, title, withBlank, firstCol = "Account", extra = [], curs = ["aed", "eur"], cw = "w-40") => {
    const local = curs[0];
    return (
    <>
      {/* Whose accounts these are, then the column headings under it. */}
      {title && (
        <div className="flex h-[22px] items-center border-t border-black px-2" style={{ backgroundColor: SUB_BG }}>
          <span className={head}>{title}</span>
        </div>
      )}
      <div className="flex h-[22px] items-stretch border-t border-black" style={{ backgroundColor: HEADER_BG }}>
        <span className={`flex flex-1 items-center px-2 ${head}`}>{firstCol}</span>
        {extra.map(([k, label, w]) => (
          <span key={k} className={`flex ${w} shrink-0 items-center gap-1 border-l border-black px-2 ${head}`}>
            {label}
            {k === "price" && (
              <button onClick={() => setQuoteTick((t) => t + 1)} disabled={quoteBusy} title="Fetch the latest prices now" className="ml-auto text-[#0f766e] hover:text-[#0c5e57]">
                <RefreshCw size={11} className={quoteBusy ? "animate-spin" : ""} />
              </button>
            )}
          </span>
        ))}
        <span className={`flex w-28 shrink-0 items-center border-l border-black px-2 ${head}`}>Updated</span>
        {curs.map((cur) => (
          <span key={cur} className={`flex ${cw} shrink-0 items-center justify-end border-l border-black px-2 ${head}`}>{cur.toUpperCase()}</span>
        ))}
        <span className="flex w-7 shrink-0 items-center justify-center border-l border-black text-neutral-900"><Trash2 size={11} /></span>
      </div>
      {[...rowsOf(list), ...(withBlank ? [{ id: blankId.current, name: "" }] : [])].map((r) => {
        const row = (x, sub) => (
          // The lines inside an account sit on the faint pink, as in Cash flow.
          <div key={sub || x.id} className={`flex h-[22px] items-stretch border-t border-black ${sub ? "pt-px" : ""}`} style={sub ? { backgroundColor: "#FBEFEC" } : undefined}>
            <input
              value={x.name}
              onChange={(e) => editCash(list, r.id, { name: e.target.value, updated: new Date().toISOString() }, sub)}
              className={`min-w-0 flex-1 bg-transparent text-[11px] text-neutral-900 outline-none ${sub ? "pl-6 pr-2" : "px-2"}`}
            />
            {extra.map(([k, , w]) => (
              <span key={k} className={`flex ${w} shrink-0 items-center border-l border-black px-2 ${k === "price" ? "justify-end" : ""}`}>
                {k === "price" ? (
                  x.price && <span className="text-[11px] tabular-nums text-[#1d4ed8]">{`${x.price.currency} ${money(x.price.price)}`}</span>
                ) : sub && (
                  <input
                    value={x[k] || ""}
                    onChange={(e) => editCash(list, r.id, { [k]: k === "ticker" ? e.target.value.toUpperCase() : e.target.value, updated: new Date().toISOString() }, sub)}
                    className="w-full bg-transparent text-[11px] tabular-nums text-neutral-900 outline-none"
                  />
                )}
              </span>
            ))}
            <span className="flex w-28 shrink-0 items-center border-l border-black px-2 text-[11px] tabular-nums text-neutral-900">{dateOf(x.updated)}</span>
            {x.live ? (
              // From the bank: not typed here, so shown as plain figures.
              curs.map((cur) => (
                <span key={cur} title={x.price ? `${x.shares} shares at ${x.price.currency} ${money(x.price.price)}, latest price` : "From the bank, as on the Cash flow page"} className={`flex ${cw} shrink-0 items-center justify-end border-l border-black px-2 text-[11px] tabular-nums text-[#1d4ed8]`}>
                  {money(shown(x, cur)) && `${cur.toUpperCase()} ${money(shown(x, cur))}`}
                </span>
              ))
            ) : (
              curs.map((cur) => (
                <span key={cur} className={`flex ${cw} shrink-0 items-center border-l border-black px-2`}>
                  <Amount cur={cur.toUpperCase()} auto={!!x.from && x.from !== cur} value={shown(x, cur)} onChange={(v) => setBalance(list, r.id, cur, v, sub)} />
                </span>
              ))
            )}
            <span className="flex w-7 shrink-0 items-center justify-center border-l border-black">
              {(sub || (doc[list] || []).some((y) => y.id === r.id)) && (
                <button onClick={() => setConfirm({ list, id: r.id, sub, name: x.name })} title="Delete" className="text-neutral-900 hover:text-[#C1440E]">
                  <Trash2 size={11} />
                </button>
              )}
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
            {/* The whole line opens and closes it, as in Cash flow; only the name itself is for typing. */}
            <div onClick={() => toggleOpen(r.id)} className="flex h-[22px] cursor-pointer select-none items-stretch border-t border-black">
              <span className="flex min-w-0 flex-1 items-center gap-1 px-2">
                <input
                  value={r.name}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => editCash(list, r.id, { name: e.target.value })}
                  style={{ fieldSizing: "content" }}
                  className="min-w-0 bg-transparent text-[11px] text-neutral-900 outline-none"
                />
                <button title={open ? "Close" : "Open"} className="ml-auto shrink-0 text-neutral-900 hover:text-[#9c7c33]">
                  <ChevronDown size={12} className={`transition-transform ${open ? "rotate-180" : ""}`} />
                </button>
              </span>
              {extra.map(([k, , w]) => <span key={k} className={`${w} shrink-0 border-l border-black`} />)}
              <span className="flex w-28 shrink-0 items-center border-l border-black px-2 text-[11px] tabular-nums text-neutral-900">{dateOf(latest)}</span>
              {curs.map((cur) => (
                <span key={cur} className={`flex ${cw} shrink-0 items-center justify-end border-l border-black px-2 text-[11px] tabular-nums text-neutral-900`}>{sum(cur) && `${cur.toUpperCase()} ${sum(cur)}`}</span>
              ))}
              <span className="flex w-7 shrink-0 items-center justify-center border-l border-black">
                <button onClick={(e) => { e.stopPropagation(); setConfirm({ list, id: r.id, name: r.name }); }} title="Delete" className="text-neutral-900 hover:text-[#C1440E]">
                  <Trash2 size={11} />
                </button>
              </span>
            </div>
            {open && r.subs.map((x) => row(x, x.id))}
            {/* Inside an open account (not DIB, whose two lines are fixed): a line to add another. */}
            {open && r.id !== "dib" && (
              <button
                onClick={() => addSub(list, r.id)}
                className="flex h-[22px] w-full items-center gap-[2px] border-t border-black pl-6 pr-2 text-[11px] font-bold text-[#0f766e] hover:text-[#0c5e57]"
                style={{ backgroundColor: "#FBEFEC" }}
              >
                <Plus size={11} strokeWidth={3} />Add
              </button>
            )}
          </div>
        );
      })}
      {/* Add puts a fresh line at the foot of the group, ready to type in. */}
      <button
        onClick={() => save({ ...doc, [list]: [...(doc[list] || []), { id: newId(), name: "" }] })}
        className="flex h-[22px] w-full items-center gap-[2px] border-t border-black px-2 text-[11px] font-bold text-[#0f766e] hover:text-[#0c5e57]"
      >
        <Plus size={11} strokeWidth={3} />Add
      </button>
      {/* The group's total: every account added up, in EUR only, far right. */}
      <div className="flex h-[22px] items-stretch border-t border-black">
        <span className="flex flex-1 items-center px-2 text-[11px] font-bold uppercase tracking-[0.06em] text-neutral-900">Total</span>
        {["eur"].map((cur) => {
          const vals = rowsOf(list).flatMap((r) => r.subs || [r]).map((x) => num(shown(x, cur))).filter((n) => n != null);
          return (
            <span key={cur} className={`flex ${cw} shrink-0 items-center justify-end border-l border-black px-2 text-[11px] font-bold tabular-nums text-neutral-900`}>
              {vals.length ? `${cur.toUpperCase()} ${money(vals.reduce((a, b) => a + b, 0))}` : ""}
            </span>
          );
        })}
        <span className="w-7 shrink-0 border-l border-black" />
      </div>
    </>
    );
  };
  // Real estate: the house opens onto its value (typed here) and its mortgage loans
  // (from Cash flow, in blue); its own line shows what is owned – value less the loans.
  const house = doc.house || { name: "Hunkelestr. house", value: "", updated: "" };
  const saveHouse = (fields) => save({ ...doc, house: { ...house, ...fields, updated: new Date().toISOString() } });
  const owed = loans.reduce((sum, l) => sum + Math.abs(num(l.amount) || 0), 0);
  const owned = num(house.value) != null ? num(house.value) - owed : null;
  // The Kennedy Court flat in Varosha: listed, though sealed off since 1974 and so with
  // no market value for now. Its value is typed, like the house's.
  const FLAT_NAME = "Kennedy Court apartment – JFK Avenue, Varosha, Famagusta, Cyprus";
  const flat0 = doc.flat || { name: FLAT_NAME, value: "", updated: "" };
  // The first name it had, without the avenue, takes the fuller one.
  const flat = flat0.name === "Kennedy Court apartment – Varosha, Famagusta, Cyprus" ? { ...flat0, name: FLAT_NAME } : flat0;
  const saveFlat = (fields) => save({ ...doc, flat: { ...flat, ...fields, updated: new Date().toISOString() } });
  // Any further properties, added as you go: a name, its date and a value in EUR.
  const moreProps = doc.moreProps || [];
  const editProp = (id, fields) => save({ ...doc, moreProps: moreProps.map((x) => (x.id === id ? { ...x, ...fields, updated: new Date().toISOString() } : x)) });
  const reTotal = (owned ?? 0) + (num(flat.value) ?? 0) + moreProps.reduce((sum, x) => sum + (num(x.value) ?? 0), 0);
  const houseOpen = !!doc.ui?.open?.house;
  const reRow = "flex h-[22px] items-stretch border-t border-black";
  const reCell = "flex w-40 shrink-0 items-center justify-end border-l border-black px-2 text-[11px] tabular-nums";
  const realEstate = (
    <>
      <div className={reRow} style={{ backgroundColor: HEADER_BG }}>
        <span className={`flex flex-1 items-center px-2 ${head}`}>Property</span>
        <span className={`flex w-28 shrink-0 items-center border-l border-black px-2 ${head}`}>Updated</span>
        <span className={`flex w-40 shrink-0 items-center justify-end border-l border-black px-2 ${head}`}>EUR</span>
      </div>
      {/* The whole line opens and closes it; only the name itself is for typing. */}
      <div onClick={() => toggleOpen("house")} className={`${reRow} cursor-pointer select-none`}>
        <span className="flex min-w-0 flex-1 items-center gap-1 px-2">
          <input
            value={house.name}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => saveHouse({ name: e.target.value })}
            style={{ fieldSizing: "content" }}
            className="min-w-0 bg-transparent text-[11px] text-neutral-900 outline-none"
          />
          <button title={houseOpen ? "Close" : "Open"} className="ml-auto shrink-0 text-neutral-900 hover:text-[#9c7c33]">
            <ChevronDown size={12} className={`transition-transform ${houseOpen ? "rotate-180" : ""}`} />
          </button>
        </span>
        <span className="flex w-28 shrink-0 items-center border-l border-black px-2 text-[11px] tabular-nums text-neutral-900">{dateOf(house.updated)}</span>
        <span className={`${reCell} text-neutral-900`} title="House value less the mortgage loans">{owned != null && `EUR ${money(owned)}`}</span>
      </div>
      {houseOpen && (
        <>
          <div className={`${reRow} pt-px`} style={{ backgroundColor: "#FBEFEC" }}>
            <span className="flex flex-1 items-center pl-6 pr-2 text-[11px] text-neutral-900">House value</span>
            <span className="w-28 shrink-0 border-l border-black" />
            <span className="flex w-40 shrink-0 items-center border-l border-black px-2">
              <Amount cur="EUR" value={house.value} onChange={(v) => saveHouse({ value: v })} />
            </span>
          </div>
          {loans.map((l) => (
            <div key={l.id} className={`${reRow} pt-px`} style={{ backgroundColor: "#FBEFEC" }}>
              <span className="flex flex-1 items-center pl-6 pr-2 text-[11px] text-neutral-900">Mortgage{l.name ? `: ${l.name}` : ""}</span>
              <span className="w-28 shrink-0 border-l border-black" />
              <span className={`${reCell} text-[#1d4ed8]`} title="From the Debt line on the Cash flow page">
                EUR -{money(Math.abs(num(l.amount)))}
              </span>
            </div>
          ))}
        </>
      )}
      <div className={reRow}>
        <input
          value={flat.name}
          onChange={(e) => saveFlat({ name: e.target.value })}
          className="min-w-0 flex-1 bg-transparent px-2 text-[11px] text-neutral-900 outline-none"
        />
        <span className="flex w-28 shrink-0 items-center border-l border-black px-2 text-[11px] tabular-nums text-neutral-900">{dateOf(flat.updated)}</span>
        <span className="flex w-40 shrink-0 items-center border-l border-black px-2">
          <Amount cur="EUR" value={flat.value} onChange={(v) => saveFlat({ value: v })} />
        </span>
      </div>
      {moreProps.map((x) => (
        <div key={x.id} className={reRow}>
          <input
            value={x.name}
            onChange={(e) => editProp(x.id, { name: e.target.value })}
            className="min-w-0 flex-1 bg-transparent px-2 text-[11px] text-neutral-900 outline-none"
          />
          {binFor("moreProps", x.id, x.name)}
          <span className="flex w-28 shrink-0 items-center border-l border-black px-2 text-[11px] tabular-nums text-neutral-900">{dateOf(x.updated)}</span>
          <span className="flex w-40 shrink-0 items-center border-l border-black px-2">
            <Amount cur="EUR" value={x.value} onChange={(v) => editProp(x.id, { value: v })} />
          </span>
        </div>
      ))}
      {addLine("moreProps", { value: "" })}
      <div className={reRow}>
        <span className="flex flex-1 items-center px-2 text-[11px] font-bold uppercase tracking-[0.06em] text-neutral-900">Total</span>
        <span className={`${reCell} font-bold text-neutral-900`}>EUR {money(reTotal)}</span>
      </div>
    </>
  );

  // Canada: the Canaccord account opens onto its three parts, each typed in CAD with
  // EUR beside it at today's rate. The taxable part carries its tax rate; the tax it
  // would cost is worked out under them, and the Total is what is left after tax.
  const CANACCORD_PARTS = [
    { id: "taxable", name: "Taxable", tax: "50" },
    { id: "tfsa", name: "A and S – grandkids' TFSA (tax free)", tax: "0" },
    { id: "free", name: "Remainder (tax free)", tax: "0" },
  ];
  const acct = doc.canaccord || { name: "Canaccord account", subs: CANACCORD_PARTS };
  const editPart = (id, fields) =>
    save({ ...doc, canaccord: { ...acct, subs: acct.subs.map((x) => (x.id === id ? { ...x, ...fields, updated: new Date().toISOString() } : x)) } });
  const eurOf = (x) => num(shown(x, "eur")) ?? 0;
  const cadOf = (x) => num(shown(x, "cad")) ?? 0;
  // The family home, on its own line under the account, typed the same way.
  const caHouse = doc.caHouse || { name: "870 Farmleigh Road, West Vancouver, BC, Canada", tax: "0" };
  const editHouse = (fields) => save({ ...doc, caHouse: { ...caHouse, ...fields, updated: new Date().toISOString() } });
  // Further Canada lines, added as you go, typed like the house.
  const caMore = doc.caMore || [];
  const editCaMore = (id, fields) => save({ ...doc, caMore: caMore.map((x) => (x.id === id ? { ...x, ...fields, updated: new Date().toISOString() } : x)) });
  const taxed = [...acct.subs, caHouse, ...caMore];
  const taxEur = taxed.reduce((sum, x) => sum + (eurOf(x) * (num(x.tax) ?? 0)) / 100, 0);
  const taxCad = taxed.reduce((sum, x) => sum + (cadOf(x) * (num(x.tax) ?? 0)) / 100, 0);
  const grossEur = acct.subs.reduce((sum, x) => sum + eurOf(x), 0) + caMore.reduce((sum, x) => sum + eurOf(x), 0);
  const grossCad = acct.subs.reduce((sum, x) => sum + cadOf(x), 0) + caMore.reduce((sum, x) => sum + cadOf(x), 0);
  // Your part of each line, after that line's tax. Share % only applies where you type
  // one; a line left empty counts in full.
  const shareOf = (x) => num(x.share) ?? 100;
  const mineEur = taxed.reduce((sum, x) => sum + eurOf(x) * (shareOf(x) / 100) * (1 - (num(x.tax) ?? 0) / 100), 0);
  const caOpen = !!doc.ui?.open?.canaccord;
  const caLatest = acct.subs.map((x) => x.updated).filter(Boolean).sort().pop();
  const caRow = "flex h-[22px] items-stretch border-t border-black";
  const caFig = "flex w-40 shrink-0 items-center justify-end border-l border-black px-2 text-[11px] tabular-nums";
  const canada = (
    <>
      <div className={caRow} style={{ backgroundColor: HEADER_BG }}>
        <span className={`flex flex-1 items-center px-2 ${head}`}>Account</span>
        <span className={`flex w-20 shrink-0 items-center justify-end border-l border-black px-2 ${head}`}>Share %</span>
        <span className={`flex w-20 shrink-0 items-center justify-end border-l border-black px-2 ${head}`}>Tax %</span>
        <span className={`flex w-28 shrink-0 items-center border-l border-black px-2 ${head}`}>Updated</span>
        <span className={`flex w-40 shrink-0 items-center justify-end border-l border-black px-2 ${head}`}>CAD</span>
        <span className={`flex w-40 shrink-0 items-center justify-end border-l border-black px-2 ${head}`}>EUR</span>
      </div>
      {/* The whole line opens and closes it; only the name itself is for typing. */}
      <div onClick={() => toggleOpen("canaccord")} className={`${caRow} cursor-pointer select-none`}>
        <span className="flex min-w-0 flex-1 items-center gap-1 px-2">
          <input
            value={acct.name}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => save({ ...doc, canaccord: { ...acct, name: e.target.value } })}
            style={{ fieldSizing: "content" }}
            className="min-w-0 bg-transparent text-[11px] text-neutral-900 outline-none"
          />
          <button title={caOpen ? "Close" : "Open"} className="ml-auto shrink-0 text-neutral-900 hover:text-[#9c7c33]">
            <ChevronDown size={12} className={`transition-transform ${caOpen ? "rotate-180" : ""}`} />
          </button>
        </span>
        <span className="w-20 shrink-0 border-l border-black" />
        <span className="w-20 shrink-0 border-l border-black" />
        <span className="flex w-28 shrink-0 items-center border-l border-black px-2 text-[11px] tabular-nums text-neutral-900">{dateOf(caLatest)}</span>
        <span className={`${caFig} text-neutral-900`}>{grossCad ? `CAD ${money(grossCad)}` : ""}</span>
        <span className={`${caFig} text-neutral-900`}>{grossEur ? `EUR ${money(grossEur)}` : ""}</span>
      </div>
      {caOpen &&
        acct.subs.map((x) => (
          <div key={x.id} className={`${caRow} pt-px`} style={{ backgroundColor: "#FBEFEC" }}>
            <input
              value={x.name}
              onChange={(e) => editPart(x.id, { name: e.target.value })}
              className="min-w-0 flex-1 bg-transparent pl-6 pr-2 text-[11px] text-neutral-900 outline-none"
            />
            <span className="flex w-20 shrink-0 items-center border-l border-black px-2">
              <Percent value={x.share} onChange={(v) => editPart(x.id, { share: v })} />
            </span>
            <span className="flex w-20 shrink-0 items-center border-l border-black px-2">
              <Percent value={x.tax} onChange={(v) => editPart(x.id, { tax: v })} />
            </span>
            <span className="flex w-28 shrink-0 items-center border-l border-black px-2 text-[11px] tabular-nums text-neutral-900">{dateOf(x.updated)}</span>
            {["cad", "eur"].map((cur) => (
              <span key={cur} className="flex w-40 shrink-0 items-center border-l border-black px-2">
                <Amount cur={cur.toUpperCase()} auto={!!x.from && x.from !== cur} value={shown(x, cur)} onChange={(v) => editPart(x.id, { [cur]: v, from: cur })} />
              </span>
            ))}
          </div>
        ))}
      <div className={caRow}>
        <input
          value={caHouse.name}
          onChange={(e) => editHouse({ name: e.target.value })}
          className="min-w-0 flex-1 bg-transparent px-2 text-[11px] text-neutral-900 outline-none"
        />
        <span className="flex w-20 shrink-0 items-center border-l border-black px-2">
          <Percent value={caHouse.share} onChange={(v) => editHouse({ share: v })} />
        </span>
        <span className="flex w-20 shrink-0 items-center border-l border-black px-2">
          <Percent value={caHouse.tax} onChange={(v) => editHouse({ tax: v })} />
        </span>
        <span className="flex w-28 shrink-0 items-center border-l border-black px-2 text-[11px] tabular-nums text-neutral-900">{dateOf(caHouse.updated)}</span>
        {["cad", "eur"].map((cur) => (
          <span key={cur} className="flex w-40 shrink-0 items-center border-l border-black px-2">
            <Amount cur={cur.toUpperCase()} auto={!!caHouse.from && caHouse.from !== cur} value={shown(caHouse, cur)} onChange={(v) => editHouse({ [cur]: v, from: cur })} />
          </span>
        ))}
      </div>
      {caMore.map((x) => (
        <div key={x.id} className={caRow}>
          <input
            value={x.name}
            onChange={(e) => editCaMore(x.id, { name: e.target.value })}
            className="min-w-0 flex-1 bg-transparent px-2 text-[11px] text-neutral-900 outline-none"
          />
          {binFor("caMore", x.id, x.name)}
          <span className="flex w-20 shrink-0 items-center border-l border-black px-2">
            <Percent value={x.share} onChange={(v) => editCaMore(x.id, { share: v })} />
          </span>
          <span className="flex w-20 shrink-0 items-center border-l border-black px-2">
            <Percent value={x.tax} onChange={(v) => editCaMore(x.id, { tax: v })} />
          </span>
          <span className="flex w-28 shrink-0 items-center border-l border-black px-2 text-[11px] tabular-nums text-neutral-900">{dateOf(x.updated)}</span>
          {["cad", "eur"].map((cur) => (
            <span key={cur} className="flex w-40 shrink-0 items-center border-l border-black px-2">
              <Amount cur={cur.toUpperCase()} auto={!!x.from && x.from !== cur} value={shown(x, cur)} onChange={(v) => editCaMore(x.id, { [cur]: v, from: cur })} />
            </span>
          ))}
        </div>
      ))}
      {addLine("caMore", {})}
      {/* What the taxable parts would cost in tax, at their rates. */}
      <div className={caRow}>
        <span className="flex flex-1 items-center px-2 text-[11px] text-[#C1440E]">Estimated tax</span>
        <span className={`${caFig} text-[#C1440E]`}>{grossCad + cadOf(caHouse) ? `CAD ${taxCad ? "-" : ""}${money(taxCad)}` : ""}</span>
        <span className={`${caFig} text-[#C1440E]`}>{grossEur + eurOf(caHouse) ? `EUR ${taxEur ? "-" : ""}${money(taxEur)}` : ""}</span>
      </div>
      <div className={caRow}>
        <span className="flex flex-1 items-center px-2 text-[11px] font-bold uppercase tracking-[0.06em] text-neutral-900">Total after tax</span>
        <span className={`${caFig} font-bold text-neutral-900`}>{grossEur + eurOf(caHouse) ? `EUR ${money(grossEur + eurOf(caHouse) - taxEur)}` : ""}</span>
      </div>
      <div className={caRow}>
        <span className="flex flex-1 items-center px-2 text-[11px] font-bold uppercase tracking-[0.06em] text-neutral-900">Share after tax</span>
        <span className={`${caFig} font-bold text-neutral-900`}>{mineEur ? `EUR ${money(mineEur)}` : ""}</span>
      </div>
    </>
  );

  // Germany: three lines, each in EUR, with the same Share % and Tax % as Canada and
  // the same totals under them.
  const de = doc.germany || DE_START;
  const editDe = (id, fields) => save({ ...doc, germany: de.map((x) => (x.id === id ? { ...x, ...fields, updated: new Date().toISOString() } : x)) });
  const deEur = (x) => num(x.eur) ?? 0;
  const deGross = de.reduce((sum, x) => sum + deEur(x), 0);
  const deTax = de.reduce((sum, x) => sum + (deEur(x) * (num(x.tax) ?? 0)) / 100, 0);
  const deMine = de.reduce((sum, x) => sum + deEur(x) * ((num(x.share) ?? 100) / 100) * (1 - (num(x.tax) ?? 0) / 100), 0);
  const germany = (
    <>
      <div className={caRow} style={{ backgroundColor: HEADER_BG }}>
        <span className={`flex flex-1 items-center px-2 ${head}`}>Account</span>
        <span className={`flex w-20 shrink-0 items-center justify-end border-l border-black px-2 ${head}`}>Share %</span>
        <span className={`flex w-20 shrink-0 items-center justify-end border-l border-black px-2 ${head}`}>Tax %</span>
        <span className={`flex w-28 shrink-0 items-center border-l border-black px-2 ${head}`}>Updated</span>
        <span className={`flex w-40 shrink-0 items-center justify-end border-l border-black px-2 ${head}`}>EUR</span>
      </div>
      {de.map((x) => (
        <div key={x.id} className={caRow}>
          <input
            value={x.name}
            onChange={(e) => editDe(x.id, { name: e.target.value })}
            className="min-w-0 flex-1 bg-transparent px-2 text-[11px] text-neutral-900 outline-none"
          />
          {binFor("germany", x.id, x.name)}
          <span className="flex w-20 shrink-0 items-center border-l border-black px-2">
            <Percent value={x.share} onChange={(v) => editDe(x.id, { share: v })} />
          </span>
          <span className="flex w-20 shrink-0 items-center border-l border-black px-2">
            <Percent value={x.tax} onChange={(v) => editDe(x.id, { tax: v })} />
          </span>
          <span className="flex w-28 shrink-0 items-center border-l border-black px-2 text-[11px] tabular-nums text-neutral-900">{dateOf(x.updated)}</span>
          <span className="flex w-40 shrink-0 items-center border-l border-black px-2">
            <Amount cur="EUR" value={x.eur} onChange={(v) => editDe(x.id, { eur: v })} />
          </span>
        </div>
      ))}
      {addLine("germany", {})}
      <div className={caRow}>
        <span className="flex flex-1 items-center px-2 text-[11px] text-[#C1440E]">Estimated tax</span>
        <span className={`${caFig} text-[#C1440E]`}>{deGross ? `EUR ${deTax ? "-" : ""}${money(deTax)}` : ""}</span>
      </div>
      <div className={caRow}>
        <span className="flex flex-1 items-center px-2 text-[11px] font-bold uppercase tracking-[0.06em] text-neutral-900">Total after tax</span>
        <span className={`${caFig} font-bold text-neutral-900`}>{deGross ? `EUR ${money(deGross - deTax)}` : ""}</span>
      </div>
      <div className={caRow}>
        <span className="flex flex-1 items-center px-2 text-[11px] font-bold uppercase tracking-[0.06em] text-neutral-900">Share after tax</span>
        <span className={`${caFig} font-bold text-neutral-900`}>{deMine ? `EUR ${money(deMine)}` : ""}</span>
      </div>
    </>
  );

  // Totals: everything above in three lines, all in EUR. Your own accounts and property
  // count in full; a parent estate line counts only your Share %, after its Tax %.
  const eurNow = (x) => num(shown(x, "eur")) ?? 0;
  const mine = (x) => eurNow(x) * ((num(x.share) ?? 100) / 100) * (1 - (num(x.tax) ?? 0) / 100);
  const deMineOf = (x) => (num(x.eur) ?? 0) * ((num(x.share) ?? 100) / 100) * (1 - (num(x.tax) ?? 0) / 100);
  const isGold = (x) => /gold/i.test(x.name || "");
  const cashOwn = ["cash", "personal", "stocks"].reduce((sum, list) => sum + rowsOf(list).flatMap((r) => r.subs || [r]).reduce((t, x) => t + eurNow(x), 0), 0);
  const cashEstates = [...acct.subs, ...caMore].reduce((sum, x) => sum + mine(x), 0) + de.filter((x) => !isGold(x)).reduce((sum, x) => sum + deMineOf(x), 0);
  const totalCash = cashOwn + cashEstates;
  const totalProperty = reTotal + mine(caHouse);
  const totalGold = de.filter(isGold).reduce((sum, x) => sum + deMineOf(x), 0);
  const totLine = (label, value, bold) => (
    <div className={caRow}>
      <span className={`flex flex-1 items-center px-2 text-[11px] text-neutral-900 ${bold ? "font-bold uppercase tracking-[0.06em]" : ""}`}>{label}</span>
      <span className={`${caFig} text-neutral-900 ${bold ? "font-bold" : ""}`}>EUR {money(value)}</span>
    </div>
  );
  const totals = (
    <>
      <div className={caRow} style={{ backgroundColor: HEADER_BG }}>
        <span className={`flex flex-1 items-center px-2 ${head}`}>Asset</span>
        <span className={`flex w-40 shrink-0 items-center justify-end border-l border-black px-2 ${head}`}>EUR</span>
      </div>
      {totLine("Cash – all accounts and trading accounts", totalCash)}
      {totLine("Property – all properties", totalProperty)}
      {totLine("Gold", totalGold)}
      {totLine("Total", totalCash + totalProperty + totalGold, true)}
    </>
  );

  // Companies: each one's name, how much of it is owned, its value and any dividend owed.
  const companiesList = doc.companies || START_COMPANIES;
  const editCo = (id, fields) => save({ ...doc, companies: companiesList.map((x) => (x.id === id ? { ...x, ...fields } : x)) });
  // Value and dividend owed are each typed in AED or EUR; the other follows at today's
  // rate, in blue. A value typed before the AED column existed counts as EUR.
  const pairOf = (x, k) => x[k] || (k === "val" && x.value ? { eur: x.value, from: "eur" } : k === "div" && x.dividend ? { eur: x.dividend, from: "eur" } : {});
  const setPair = (x, k, cur, v) => editCo(x.id, { [k]: { [cur]: v, from: cur } });
  const pairCell = (x, k, cur) => {
    const pr = pairOf(x, k);
    return (
      <span key={k + cur} className="flex w-32 shrink-0 items-center border-l border-black px-2">
        <Amount cur={cur.toUpperCase()} auto={!!pr.from && pr.from !== cur} value={shown(pr, cur)} onChange={(v) => setPair(x, k, cur, v)} />
      </span>
    );
  };
  const companies = (
    <>
      <div className={caRow} style={{ backgroundColor: HEADER_BG }}>
        <span className={`flex flex-1 items-center px-2 ${head}`}>Name</span>
        <span className={`flex w-24 shrink-0 items-center justify-end border-l border-black px-2 ${head}`}>Ownership</span>
        <span className={`flex w-32 shrink-0 items-center justify-end border-l border-black px-2 ${head}`}>Value AED</span>
        <span className={`flex w-32 shrink-0 items-center justify-end border-l border-black px-2 ${head}`}>Value EUR</span>
        <span className={`flex w-32 shrink-0 items-center justify-end border-l border-black px-2 ${head}`}>My value EUR</span>
        <span className={`flex w-32 shrink-0 items-center justify-end border-l border-black px-2 ${head}`}>Dividend AED</span>
        <span className={`flex w-32 shrink-0 items-center justify-end border-l border-black px-2 ${head}`}>Dividend EUR</span>
      </div>
      {companiesList.map((x) => {
        const valEur = num(shown(pairOf(x, "val"), "eur"));
        return (
        <div key={x.id} className={caRow}>
          <input
            value={x.name}
            onChange={(e) => editCo(x.id, { name: e.target.value })}
            className="min-w-0 flex-1 bg-transparent px-2 text-[11px] text-neutral-900 outline-none"
          />
          {binFor("companies", x.id, x.name)}
          <span className="flex w-24 shrink-0 items-center border-l border-black px-2">
            <Percent value={x.own} onChange={(v) => editCo(x.id, { own: v })} />
          </span>
          {pairCell(x, "val", "aed")}
          {pairCell(x, "val", "eur")}
          {/* Your part: the value times your ownership, worked out here, so in blue. */}
          <span className="flex w-32 shrink-0 items-center justify-end border-l border-black px-2 text-[11px] tabular-nums text-[#1d4ed8]">
            {valEur != null && num(x.own) != null ? `EUR ${money((valEur * num(x.own)) / 100)}` : ""}
          </span>
          {pairCell(x, "div", "aed")}
          {pairCell(x, "div", "eur")}
        </div>
        );
      })}
      {addLine("companies", {})}
    </>
  );

  const cash = (
    <>
      {cashGroup("cash", "Company accounts", false)}
      {cashGroup("personal", "Personal accounts", false)}
    </>
  );

  return (
    // Narrow windows scroll the table sideways rather than squashing the columns.
    <div className="w-full">
      <div className="mb-1 flex items-center justify-end gap-1 text-[11px] text-neutral-900">
        <button onClick={() => setZoomTo(zoom - 10)} disabled={zoom <= 40} title="Smaller" className="flex h-[18px] w-[18px] items-center justify-center border border-black bg-white hover:bg-neutral-100 disabled:opacity-30">
          <Minus size={11} strokeWidth={2.75} />
        </button>
        <span className="w-9 text-center tabular-nums">{zoom}%</span>
        <button onClick={() => setZoomTo(zoom + 10)} disabled={zoom >= 100} title="Larger" className="flex h-[18px] w-[18px] items-center justify-center border border-black bg-white hover:bg-neutral-100 disabled:opacity-30">
          <Plus size={11} strokeWidth={2.75} />
        </button>
      </div>
    <div className="w-full overflow-x-auto" style={{ zoom: zoom / 100 }}>
      <div className="w-full min-w-[760px] overflow-hidden border border-black bg-white shadow-sm">
        {SECTIONS.map((name, i) => (
          <div key={name}>
            {/* A grey band, then the section's bar. */}
            <div className={`h-[10px] ${i ? "border-t border-black" : ""}`} style={{ backgroundColor: GAP_BG }} />
            <div className="flex h-[22px] items-center border-t border-black px-2" style={{ backgroundColor: BAR_BG }}>
              <span className={head}>{name}</span>
            </div>
            {name === "Cash" && cash}
            {name === "Real estate" && realEstate}
            {name === "Companies" && companies}
            {name === "Totals" && totals}
            {/* The parents' estates, one country after another, each under its own bar. */}
            {name === "Parent estates" && (
              <>
                <div className="flex h-[22px] items-center border-t border-black px-2" style={{ backgroundColor: SUB_BG }}>
                  <span className={head}>Canada</span>
                </div>
                {canada}
                <div className="flex h-[22px] items-center border-t border-black px-2" style={{ backgroundColor: SUB_BG }}>
                  <span className={head}>Germany</span>
                </div>
                {germany}
              </>
            )}
            {name === "Stocks" && cashGroup("stocks", "", false, "Account", [["ticker", "Ticker", "w-20"], ["shares", "Shares", "w-20"], ["price", "Price", "w-28"]], ["chf", "usd", "eur"], "w-32")}
          </div>
        ))}
        <div className="h-[10px] border-t border-black" style={{ backgroundColor: GAP_BG }} />
      </div>
    </div>
      {err && <p className="pt-2 text-[11px] font-semibold text-[#C1440E]">{err}</p>}

      {/* The warning: a heavy red frame, the question in bold, a solid button to go ahead. */}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={() => setConfirm(null)}>
          <div className="w-full max-w-sm border-[5px] bg-white p-6 text-center shadow-2xl" style={{ borderColor: "#C1440E" }} onClick={(e) => e.stopPropagation()}>
            <p className="text-[14px] font-bold uppercase tracking-[0.06em] text-neutral-900">Delete {confirm.name || "this line"}?</p>
            <div className="mt-5 flex justify-center gap-3 text-[12px] font-bold uppercase tracking-wide">
              <button
                onClick={() => { removeRow(confirm.list, confirm.id, confirm.sub); setConfirm(null); }}
                className="border-2 px-5 py-1.5 text-white transition-opacity hover:opacity-80"
                style={{ backgroundColor: "#C1440E", borderColor: "#C1440E" }}
              >
                Delete
              </button>
              <button onClick={() => setConfirm(null)} className="border-2 px-5 py-1.5 transition-opacity hover:opacity-70" style={{ borderColor: "#C1440E", color: "#C1440E" }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
