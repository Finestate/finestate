import { useEffect, useState } from "react";
import { Plus, Trash2, ChevronDown, RefreshCw, Check } from "lucide-react";
import { supabase } from "./lib/supabaseClient.js";

// Cash flow page, rebuilt from the FC tab of HEIE Planning. The figures are private,
// so they live in Supabase (admin_docs), never in this repo.
const DOC_ID = "costs-fc";
// The read-only bank connection: which accounts it covers, until when, and the last
// balances read. Kept in Supabase like everything else.
const BANK_ID = "bank-link";
// The bank allows only a few reads a day, so a balance is read again at most every
// six hours.
const BANK_STALE_MS = 6 * 60 * 60 * 1000;

// Calls one of the site's bank routes with the signed-in person's token.
async function callBank(path, body) {
  const { data } = await supabase.auth.getSession();
  const r = await fetch(`/api/bank/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${data?.session?.access_token || ""}` },
    body: JSON.stringify(body || {}),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "The bank connection did not answer");
  return j;
}
const saveBank = (link) =>
  supabase.from("admin_docs").upsert({ id: BANK_ID, data: link, updated_at: new Date().toISOString() });

// Heading ladder: a deeper amber main band, then the site's prime
// shade for sections and its lighter shade for expense groups. Rows sit on white with
// hairline rules, so the headings carry the structure.
const MAIN_BG = "#F2C46D";
const SUB_BG = "#FFE4B3";
const SUBSUB_BG = "#FCEFCF";

const EMPTY = { rates: [], balances: { giro: "", card: "", mortgage: "" }, income: [], tax: [], pocket: [], groups: [], loans: [] };

let _idc = 0;
const newId = () => "c" + Date.now().toString(36) + "-" + (_idc++);

const num = (v) => {
  const n = parseFloat(String(v ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
};
const money = (n) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// How many times a year a payment falls, read from the frequency text:
// "Monthly" 12, "Annual (Feb)" 1, "3 X Per Year" 3, "Feb / May / Aug / Nov" 4.
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
function timesPerYear(freq) {
  const f = String(freq || "").toLowerCase();
  if (!f.trim()) return 0;
  if (/month/.test(f)) return 12;
  if (/week/.test(f)) return 52;
  if (/quarter/.test(f)) return 4;
  if (/annual|year(ly)?$|once/.test(f) && !/\d\s*x/.test(f)) return 1;
  const x = f.match(/(\d+)\s*x/);
  if (x) return +x[1];
  const listed = MONTHS.filter((m) => new RegExp(`\\b${m}`).test(f)).length;
  return listed || 0;
}

const txt = "w-full bg-transparent py-0 text-[11px] leading-none text-neutral-900 outline-none placeholder:text-neutral-300";
const numCls = `${txt} text-right tabular-nums`;
const head = "text-[11px] font-black uppercase leading-tight tracking-[0.06em] text-neutral-900";
const colHead = "whitespace-nowrap text-[11px] font-bold uppercase leading-none tracking-wide text-neutral-500";

// A money field: shows 13,882.06 when you are not in it, the plain figure while typing,
// and tidies to two decimals when you leave.
// `fit` sizes the box to the figure, so a label such as EUR can sit right beside it.
function MoneyInput({ value, onChange, placeholder = "0.00", fit = false }) {
  const [focus, setFocus] = useState(false);
  const shown = focus || value === "" || value == null ? value ?? "" : money(num(value));
  return (
    <input
      value={shown}
      inputMode="decimal"
      onFocus={() => setFocus(true)}
      onChange={(e) => onChange(e.target.value.replace(/[^0-9.-]/g, ""))}
      onBlur={() => { setFocus(false); if (String(value ?? "").trim() !== "") onChange(num(value).toFixed(2)); }}
      placeholder={placeholder}
      className={fit ? numCls.replace("w-full", "") : numCls}
      style={fit ? { width: `${Math.max(String(shown || placeholder).length, 1)}ch` } : undefined}
    />
  );
}

const Main = ({ children }) => (
  <div className="border-t border-black flex h-[22px] items-center px-2" style={{ backgroundColor: MAIN_BG }}>
    <span className={head}>{children}</span>
  </div>
);
const Sub = ({ children }) => (
  <div className="border-t border-black flex h-[22px] items-center px-2" style={{ backgroundColor: SUB_BG }}>
    <span className={head}>{children}</span>
  </div>
);
const Bin = ({ onClick }) => (
  <button onClick={onClick} title="Delete" className="flex w-6 shrink-0 items-center justify-end text-neutral-900 hover:text-[#C1440E]">
    <Trash2 size={12} />
  </button>
);
const AddBar = ({ onClick, label = "Add" }) => (
  <button onClick={onClick} className="flex h-[22px] w-full items-center gap-1 border-t border-black bg-white px-2 text-[11px] font-bold uppercase tracking-wide text-neutral-400 transition-colors hover:text-neutral-800">
    <Plus size={12} /> {label}
  </button>
);
const Row = ({ children, first }) => (
  <div className={`flex h-[22px] items-center gap-1.5 px-2 ${first ? "" : "border-t border-black"}`}>{children}</div>
);
// A two-column line: label on the left, a figure on the right.
const Figure = ({ label, value, onChange, calc, strong }) => (
  <div className="flex items-center gap-1.5 border-t border-black flex h-[22px] items-center px-2">
    <span className={`flex-1 text-[11px] leading-tight text-neutral-900 ${strong ? "font-bold" : ""}`}>{label}</span>
    <span className="w-28 shrink-0">
      {calc ? (
        <span className={`block text-right text-[11px] tabular-nums text-neutral-900 ${strong ? "font-bold" : ""}`}>EUR {money(value)}</span>
      ) : (
        <MoneyInput value={value} onChange={onChange} />
      )}
    </span>
    <span className="w-6 shrink-0" />
  </div>
);


export default function Costs({ seed }) {
  const [doc, setDoc] = useState(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState("");
  const [confirm, setConfirm] = useState(null); // delete waiting on Delete or Cancel
  const [live, setLive] = useState(null); // today's exchange rates against the euro
  const [bank, setBank] = useState(null); // the bank connection and its last balances
  const [bankMsg, setBankMsg] = useState("");
  const [bankBusy, setBankBusy] = useState(false);
  const [editLoanId, setEditLoanId] = useState(null); // the loan line open for editing

  // present: you pressed Refresh yourself, rather than the page reading on open.
  const refreshBank = async (link, present = false) => {
    if (!link?.accounts?.length) return;
    setBankBusy(true);
    try {
      const r = await callBank("balances", { uids: link.accounts.map((a) => a.uid), present });
      const next = { ...link, balances: r.balances, at: r.at };
      await saveBank(next);
      setBank(next);
      setBankMsg("");
    } catch (e) {
      setBankMsg(e.message);
    } finally {
      setBankBusy(false);
    }
  };

  // On open: the saved connection, then, if the bank has just sent you back, the
  // approval is finished here, and stale balances are read again.
  useEffect(() => {
    if (seed) return;
    (async () => {
      const { data } = await supabase.from("admin_docs").select("data").eq("id", BANK_ID).maybeSingle();
      let link = data?.data || {};
      const q = new URLSearchParams(window.location.search);
      const code = q.get("bankcode");
      const bankState = q.get("bankstate");
      if (code || q.get("bankerror")) window.history.replaceState(null, "", window.location.pathname + window.location.hash);
      if (q.get("bankerror")) setBankMsg("The bank approval was cancelled or did not go through.");
      if (code) {
        if (!link.state || bankState !== link.state) {
          setBankMsg("That bank approval did not match this page. Please connect again.");
        } else {
          try {
            setBankBusy(true);
            const sess = await callBank("session", { code });
            link = { session_id: sess.session_id, valid_until: sess.valid_until, accounts: sess.accounts, balances: {}, at: "" };
            await saveBank(link);
          } catch (e) {
            setBankMsg(e.message);
          } finally {
            setBankBusy(false);
          }
        }
      }
      setBank(link);
      const expired = link.valid_until && new Date(link.valid_until) < new Date();
      if (link.accounts?.length && !expired && (!link.at || Date.now() - new Date(link.at) > BANK_STALE_MS)) refreshBank(link);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sends you to the bank's own page to approve read-only access.
  const connectBank = async () => {
    setBankBusy(true);
    try {
      const state = crypto.randomUUID();
      await saveBank({ ...(bank || {}), state });
      const r = await callBank("start", { state });
      window.location.href = r.url;
    } catch (e) {
      setBankMsg(e.message);
      setBankBusy(false);
    }
  };

  useEffect(() => {
    fetch("/api/fx")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j?.rates) setLive(j); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (seed) { setDoc({ ...EMPTY, ...seed }); setLoaded(true); return; }
    supabase
      .from("admin_docs")
      .select("data")
      .eq("id", DOC_ID)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) setErr(error.message);
        const d = data?.data && typeof data.data === "object" && !Array.isArray(data.data) ? data.data : {};
        setDoc({ ...EMPTY, ...d, balances: { ...EMPTY.balances, ...(d.balances || {}) } });
        setLoaded(true);
      });
  }, []);

  const save = (next) => {
    setDoc(next);
    supabase
      .from("admin_docs")
      .upsert({ id: DOC_ID, data: next, updated_at: new Date().toISOString() })
      .then(({ error }) => setErr(error ? error.message : ""));
  };

  // Generic list helpers for the simple lists (rates, income, tax, pocket money).
  const setList = (key, list) => save({ ...doc, [key]: list });
  const editIn = (key, id, field, val) => setList(key, doc[key].map((r) => (r.id === id ? { ...r, [field]: val } : r)));
  const addTo = (key, row) => setList(key, [...doc[key], { id: newId(), ...row }]);
  const ask = (run) => setConfirm({ run });

  const setBalance = (field, val) => save({ ...doc, balances: { ...doc.balances, [field]: val } });

  // Expense groups.
  const setGroups = (groups) => save({ ...doc, groups });
  const editGroup = (gid, name) => setGroups(doc.groups.map((g) => (g.id === gid ? { ...g, name } : g)));
  const editRow = (gid, rid, field, val) =>
    setGroups(doc.groups.map((g) => (g.id !== gid ? g : { ...g, rows: g.rows.map((r) => (r.id === rid ? { ...r, [field]: val } : r)) })));
  const addRow = (gid) =>
    setGroups(doc.groups.map((g) => (g.id !== gid ? g : { ...g, rows: [...g.rows, { id: newId(), item: "", source: "", freq: "", amount: "", pending: "" }] })));
  const removeRow = (gid, rid) => setGroups(doc.groups.map((g) => (g.id !== gid ? g : { ...g, rows: g.rows.filter((r) => r.id !== rid) })));
  const addGroup = () => setGroups([...doc.groups, { id: newId(), name: "", rows: [] }]);
  const removeGroup = (gid) => setGroups(doc.groups.filter((g) => g.id !== gid));

  // Currency to EUR through the rate table ("AED / EUR" 0.2367 means 1 AED = 0.2367 EUR).
  const toEur = (amount, cur) => {
    const c = String(cur || "EUR").trim().toUpperCase();
    if (!c || c === "EUR") return num(amount);
    // Today's rate first; the rates saved in the table only stand in if it can't be had.
    if (live?.rates?.[c]) return num(amount) / live.rates[c];
    const pair = (p) => String(p || "").replace(/\s/g, "").toUpperCase();
    const direct = doc.rates.find((r) => pair(r.pair) === `${c}/EUR`);
    if (direct) return num(amount) * num(direct.rate);
    const inverse = doc.rates.find((r) => pair(r.pair) === `EUR/${c}`);
    if (inverse && num(inverse.rate)) return num(amount) / num(inverse.rate);
    return 0;
  };

  const monthlyAvg = (r) => (num(r.amount) * timesPerYear(r.freq)) / 12;
  const allRows = doc.groups.flatMap((g) => g.rows);
  const totalMonthly = allRows.reduce((s, r) => s + monthlyAvg(r), 0);
  const totalPending = allRows.reduce((s, r) => s + num(r.pending), 0);
  const totalIncome = doc.income.reduce((s, r) => s + toEur(r.amount, r.currency), 0);
  const balanceAfter = num(doc.balances.giro) - totalPending - num(doc.balances.card);

  // Simple list sections: name plus one figure (tax payments, pocket money).
  const simpleList = (key, placeholder) => (
    <>
      {doc[key].map((r, i) => (
        <Row key={r.id} first={i === 0}>
          <input value={r.name || ""} onChange={(e) => editIn(key, r.id, "name", e.target.value)} placeholder={placeholder} className={`${txt} flex-1`} />
          <span className="w-28 shrink-0">
            <MoneyInput value={r.amount || ""} onChange={(v) => editIn(key, r.id, "amount", v)} />
          </span>
          <Bin onClick={() => ask(() => setList(key, doc[key].filter((x) => x.id !== r.id)))} />
        </Row>
      ))}
      <AddBar onClick={() => addTo(key, { name: "", amount: "" })} />
    </>
  );

  if (!loaded) return <p className="px-2 py-3 text-[11px] italic text-neutral-400">Loading…</p>;

  return (
    // Narrow windows scroll the table sideways rather than squashing the columns.
    <div className="w-full overflow-x-auto">
      {/* The new table, being built up step by step. */}
      <div className="mb-6 w-full min-w-[680px] overflow-hidden border border-black bg-white text-[11px] leading-none shadow-sm">
        <div className="flex h-[22px] items-center px-2" style={{ backgroundColor: MAIN_BG }}>
          <span className={head}>Income and costs</span>
        </div>
        {/* Balances always come first. */}
        <Sub>Accounts</Sub>
        {/* Your own account on its own line, with a chevron; a click anywhere in its
            name cell opens the other accounts (the company's and the kids') under it.
            Told apart by the bank's own account type, so no number sits in this code. */}
        {(() => {
          const kindOf = (a) => {
            const t = `${a.product || ""} ${a.name || ""}`;
            return /jugend/i.test(t) ? "kid" : /gesch|business|gmbh/i.test(t) ? "business" : "own";
          };
          const accts = bank?.accounts || [];
          const kidsOpen = !!doc.ui?.accountsOpen;
          const own = accts.filter((a) => kindOf(a) === "own");
          // Under your account when opened: the company's first, then the kids'.
          const others = [...accts.filter((a) => kindOf(a) === "business"), ...accts.filter((a) => kindOf(a) === "kid")];
          const amountOf = (a) => {
            const b = bank.balances?.[a.uid];
            return b && !b.error && b.amount !== "" ? num(b.amount) : null;
          };
          // The controls don't open or shut the accounts under the line.
          const stop = (e) => e.stopPropagation();
          const expired = bank?.valid_until && new Date(bank.valid_until) < new Date();
          // One space after your account number, in red and lower case: when the bank's
          // approval runs out.
          // Once it has, the note offers the reconnect itself.
          const until = bank?.valid_until
            ? new Date(bank.valid_until).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
            : "";
          const status = until ? (
            <span className="whitespace-nowrap text-[11px] lowercase text-[#C1440E]">
              {expired ? (
                <>
                  (connection expired,{" "}
                  <button onClick={(e) => { stop(e); connectBank(); }} disabled={bankBusy} className="font-semibold text-[#C1440E] underline underline-offset-2">
                    Reconnect
                  </button>
                  )
                </>
              ) : (
                `(connection expires ${until})`
              )}
            </span>
          ) : null;
          const line = (a, sub, toggle) => {
            const b = bank.balances?.[a.uid];
            const v = amountOf(a);
            return (
              // The accounts that open under yours sit on the faint pink of Planning's day lines.
              <div key={a.uid} className="flex h-[22px] items-stretch border-t border-black" style={sub ? { backgroundColor: "#FBEFEC" } : undefined}>
                <span
                  onClick={toggle}
                  className={`flex flex-1 items-center gap-1 text-[11px] text-neutral-900 ${sub ? "pl-6 pr-2" : "px-2"} ${toggle ? "cursor-pointer select-none" : ""}`}
                >
                  {/* Bank – holder: number. The bank sends the holder in capitals, so it is
                      set in ordinary case; the number reads in blocks of four. */}
                  {`Stadtsparkasse – ${
                    (a.name || a.product || "Account").toLowerCase().replace(/(^|[\s-])\p{L}/gu, (m) => m.toUpperCase())
                  }${a.iban ? `: ${a.iban.replace(/\s/g, "").replace(/(.{4})/g, "$1 ").trim()}` : ""}`}
                  {!sub && status}
                  {toggle && <ChevronDown size={12} className={`ml-auto shrink-0 transition-transform ${kidsOpen ? "rotate-180" : ""}`} />}
                </span>
                <span className={`flex w-36 shrink-0 items-center justify-end border-l border-black text-[11px] tabular-nums text-neutral-900 ${sub ? "px-2" : "pl-1 pr-2"}`} title={b?.all?.join("\n") || b?.error || undefined}>
                  {!sub && (
                    <button onClick={() => refreshBank(bank, true)} disabled={bankBusy} title="Fetch the latest balances now" className="mr-auto text-[#0f766e] hover:text-[#0c5e57]">
                      <RefreshCw size={11} className={bankBusy ? "animate-spin" : ""} />
                    </button>
                  )}
                  {v == null ? "–" : `${b.currency || "EUR"} ${money(v)}`}
                </span>
              </div>
            );
          };
          // Whether the other accounts are showing is kept with the page in Supabase, so a
          // refresh, or another device, opens it the way you left it.
          const toggle = others.length ? () => save({ ...doc, ui: { ...(doc.ui || {}), accountsOpen: !kidsOpen } }) : undefined;
          return (
            <>
              {own.map((a) => line(a, false, toggle))}
              {kidsOpen && others.map((a) => line(a, true))}
            </>
          );
        })()}
        {/* The credit card isn't shared by the bank, so its figure is typed in. */}
        <div className="flex h-[22px] items-stretch border-t border-black">
          <span className="flex flex-1 items-center px-2 text-[11px] text-neutral-900">Credit card</span>
          <span className="flex w-36 shrink-0 items-center justify-end gap-1 border-l border-black px-2 text-[11px] tabular-nums text-neutral-900">
            <span>EUR</span>
            <MoneyInput value={doc.balances.card} onChange={(v) => setBalance("card", v)} placeholder="0.00" fit />
          </span>
        </div>
        {/* The mortgage isn't shared by the bank, so its loans are typed in. The Debt line
            shows what they add up to, and opens, like your account line, onto the loans
            themselves on the same faint pink: name, account number, expiry and amount.
            The lines read as plain text; a double click opens one for editing. */}
        {(() => {
          const loans = doc.loans || [];
          const open = !!doc.ui?.debtOpen;
          const total = loans.reduce((sum, l) => sum + num(l.amount), 0);
          const setLoans = (next) => save({ ...doc, loans: next });
          const editLoan = (id, field, val) => setLoans(loans.map((l) => (l.id === id ? { ...l, [field]: val } : l)));
          const sub = "flex h-[22px] items-stretch border-t border-black";
          const cellTxt = "bg-transparent py-0 text-[11px] leading-none text-neutral-900 outline-none";
          return (
            <>
              <div className={sub}>
                <span
                  onClick={() => save({ ...doc, ui: { ...(doc.ui || {}), debtOpen: !open } })}
                  className="flex flex-1 cursor-pointer select-none items-center gap-1 px-2 text-[11px] text-neutral-900"
                >
                  {/* Debt: <what it is>; each loan's account number is in the dropdown. The
                      name is typed in the row and kept in Supabase, so no address sits in
                      this code. */}
                  <span>Debt:</span>
                  <input
                    value={doc.debtName || ""}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => save({ ...doc, debtName: e.target.value })}
                    size={Math.max((doc.debtName || "").length, 6)}
                    className="bg-transparent py-0 text-[11px] leading-none text-neutral-900 outline-none"
                  />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const l = { id: newId(), name: "", number: "", expires: "", amount: "" };
                      save({ ...doc, loans: [...loans, l], ui: { ...(doc.ui || {}), debtOpen: true } });
                      setEditLoanId(l.id);
                    }}
                    title="Add a loan"
                    className="ml-auto shrink-0 text-neutral-400 hover:text-neutral-900"
                  >
                    <Plus size={12} />
                  </button>
                  <ChevronDown size={12} className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
                </span>
                <span className="flex w-36 shrink-0 items-center justify-end border-l border-black px-2 text-[11px] tabular-nums text-neutral-900">
                  EUR {money(total)}
                </span>
              </div>
              {open && (
                <>
                  {loans.map((l) => {
                    const editing = editLoanId === l.id;
                    return (
                      <div key={l.id} className={sub} style={{ backgroundColor: "#FBEFEC" }} onDoubleClick={() => setEditLoanId(l.id)}>
                        {editing ? (
                          // Editing: plain boxes in a row, the bin, and a tick to finish.
                          <span className="flex flex-1 items-center gap-3 pl-6 pr-2">
                            <input autoFocus value={l.name || ""} onChange={(e) => editLoan(l.id, "name", e.target.value)} className={`${cellTxt} w-44 border-b border-neutral-300`} />
                            <input value={l.number || ""} onChange={(e) => editLoan(l.id, "number", e.target.value)} className={`${cellTxt} w-40 border-b border-neutral-300 tabular-nums`} />
                            <input value={l.expires || ""} onChange={(e) => editLoan(l.id, "expires", e.target.value)} className={`${cellTxt} w-24 border-b border-neutral-300`} />
                            <button onClick={() => ask(() => setLoans(loans.filter((x) => x.id !== l.id)))} title="Remove this loan" className="ml-auto text-neutral-900 hover:text-[#C1440E]">
                              <Trash2 size={11} />
                            </button>
                            <button onClick={() => setEditLoanId(null)} title="Done" className="text-neutral-900 hover:text-[#0f766e]">
                              <Check size={12} />
                            </button>
                          </span>
                        ) : (
                          // Read: Name: number (expires date), like the account line.
                          <span className="flex flex-1 items-center gap-1 pl-6 pr-2 text-[11px] text-neutral-900">
                            {[l.name, l.number].filter(Boolean).join(": ")}
                            {l.expires && <span className="whitespace-nowrap lowercase text-[#C1440E]">(expires {l.expires})</span>}
                          </span>
                        )}
                        <span className="flex w-36 shrink-0 items-center justify-end gap-1 border-l border-black px-2 text-[11px] tabular-nums text-neutral-900">
                          {editing ? (
                            <>
                              <span>EUR</span>
                              <MoneyInput value={l.amount || ""} onChange={(v) => editLoan(l.id, "amount", v)} placeholder="" fit />
                            </>
                          ) : (
                            `EUR ${money(num(l.amount))}`
                          )}
                        </span>
                      </div>
                    );
                  })}
                </>
              )}
            </>
          );
        })()}
        {/* With no bank connected yet, a line to connect one. */}
        {!bank?.accounts?.length && (
          <div className="flex h-[22px] items-center border-t border-black px-2 text-[10px] uppercase tracking-wide text-neutral-500">
            <button onClick={connectBank} disabled={bankBusy || bank == null} className="font-bold hover:text-neutral-900">
              {bankBusy ? "Opening the bank…" : "Connect bank"}
            </button>
          </div>
        )}
        {bankMsg && <p className="border-t border-black px-2 py-1 text-[11px] font-semibold text-[#C1440E]">{bankMsg}</p>}

        <Sub>Income</Sub>
        {/* The same saved income lines as Net incoming below: the name, the amount as
            paid where it is not in euros, and the euro figure. */}
        {doc.income.map((r) => {
          const cur = String(r.currency || "EUR").trim().toUpperCase() || "EUR";
          return (
            <div key={r.id} className="flex h-[22px] items-stretch border-t border-black">
              <span className="flex flex-1 items-center px-2 text-[11px] text-neutral-900">{r.name}</span>
              <span className="flex w-36 shrink-0 items-center justify-end border-l border-black px-2 text-[11px] tabular-nums text-neutral-900">
                {cur !== "EUR" && `${cur} ${money(num(r.amount))}`}
              </span>
              <span className="flex w-36 shrink-0 items-center justify-end border-l border-black px-2 text-[11px] tabular-nums text-neutral-900"
                title={cur !== "EUR" && live?.rates?.[cur] ? `1 ${cur} = ${(1 / live.rates[cur]).toFixed(4)} EUR, today's rate` : undefined}
              >
                EUR {money(toEur(r.amount, r.currency))}
              </span>
            </div>
          );
        })}
        {/* The month's income in euros, every line added up. */}
        <div className="flex h-[22px] items-stretch border-t border-black">
          <span className="flex flex-1 items-center px-2 text-[11px] font-bold text-neutral-900">Total</span>
          <span className="w-36 shrink-0 border-l border-black" />
          <span className="flex w-36 shrink-0 items-center justify-end border-l border-black px-2 text-[11px] font-bold tabular-nums text-neutral-900">
            EUR {money(totalIncome)}
          </span>
        </div>
      </div>

      {/* The earlier table, kept below as a holding area while the new one is built. */}
      <div spellCheck={false} className="w-full min-w-[680px] overflow-hidden border border-black bg-white text-[11px] leading-none shadow-sm">
        {/* Exchange rates are hidden for now; the saved ones still convert income to EUR. */}
        {/* Title bar: page name with the current month, and the headline balance on the right. */}
        <div className="flex h-[22px] items-center gap-1.5 px-2" style={{ backgroundColor: MAIN_BG }}>
          <span className={`flex-1 ${head}`}>
            Monthly income and costs –{["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"][new Date().getMonth()]} {new Date().getFullYear()}
          </span>
          <span className={head}>Balance after pending</span>
          <span className={`w-28 shrink-0 text-right tabular-nums ${head}`}>EUR {money(balanceAfter)}</span>
          <span className="w-6 shrink-0" />
        </div>

        <Sub>Balances</Sub>
        <Figure label="SP Giro account balance" value={doc.balances.giro} onChange={(v) => setBalance("giro", v)} />
        <Figure label="Pending fixed costs" value={totalPending} calc />
        <Figure label="Credit card balance" value={doc.balances.card} onChange={(v) => setBalance("card", v)} />
        <Figure label="Balance after all pending fixed costs and pending credit card bill" value={balanceAfter} calc strong />
        <Figure label="Mortgage to clear with extra payments" value={doc.balances.mortgage} onChange={(v) => setBalance("mortgage", v)} />

        <Sub>Net incoming</Sub>
        <div className="flex items-center gap-1.5 border-t border-black bg-white flex h-[22px] items-center px-2">
          <span className={`flex-1 ${colHead}`}>Source</span>
          <span className={`w-24 shrink-0 text-right ${colHead}`}>Amount</span>
          <span className={`w-16 shrink-0 ${colHead}`}>Currency</span>
          <span className={`w-24 shrink-0 text-right ${colHead}`}>In EUR</span>
          <span className="w-6 shrink-0" />
        </div>
        {doc.income.map((r, i) => (
          <Row key={r.id} first={i === 0}>
            <input value={r.name || ""} onChange={(e) => editIn("income", r.id, "name", e.target.value)} placeholder="Source" className={`${txt} flex-1`} />
            <span className="w-28 shrink-0"><MoneyInput value={r.amount || ""} onChange={(v) => editIn("income", r.id, "amount", v)} /></span>
            <span className="w-16 shrink-0"><input value={r.currency || ""} onChange={(e) => editIn("income", r.id, "currency", e.target.value.toUpperCase())} placeholder="EUR" className={`${txt} uppercase`} /></span>
            <span className="w-24 shrink-0 text-right text-[11px] tabular-nums text-neutral-900">EUR {money(toEur(r.amount, r.currency))}</span>
            <Bin onClick={() => ask(() => setList("income", doc.income.filter((x) => x.id !== r.id)))} />
          </Row>
        ))}
        <Figure label="Total income (some of it to be taxed)" value={totalIncome} calc strong />
        <AddBar onClick={() => addTo("income", { name: "", amount: "", currency: "EUR" })} />


        <Sub>Tax payments</Sub>
        {simpleList("tax", "Payment")}

        <Sub>Pocket money – current month</Sub>
        {simpleList("pocket", "Who and how much weekly")}

        <Sub>Expenses</Sub>
        {doc.groups.map((g) => {
          const gMonthly = g.rows.reduce((s, r) => s + monthlyAvg(r), 0);
          return (
            <div key={g.id}>
              <div className="flex items-center gap-1.5 border-t border-black flex h-[22px] items-center px-2" style={{ backgroundColor: SUBSUB_BG }}>
                <input value={g.name || ""} onChange={(e) => editGroup(g.id, e.target.value)} placeholder="Group" className={`flex-1 bg-transparent py-0 outline-none ${head}`} />
                <Bin onClick={() => ask(() => removeGroup(g.id))} />
              </div>
              <div className="flex items-center gap-1.5 border-t border-black flex h-[22px] items-center px-2">
                <span className={`flex-1 ${colHead}`}>Item</span>
                <span className={`w-28 shrink-0 ${colHead}`}>Payment source</span>
                <span className={`w-32 shrink-0 ${colHead}`}>Frequency</span>
                <span className={`w-24 shrink-0 text-right ${colHead}`}>Amount</span>
                <span className={`w-24 shrink-0 text-right ${colHead}`}>Monthly avg</span>
                <span className={`w-24 shrink-0 text-right ${colHead}`}>Pending</span>
                <span className="w-6 shrink-0" />
              </div>
              {g.rows.map((r, i) => (
                <Row key={r.id} first={i === 0}>
                  <input value={r.item || ""} onChange={(e) => editRow(g.id, r.id, "item", e.target.value)} placeholder="Item" className={`${txt} flex-1`} />
                  <span className="w-28 shrink-0"><input value={r.source || ""} onChange={(e) => editRow(g.id, r.id, "source", e.target.value)} className={txt} /></span>
                  <span className="w-32 shrink-0"><input value={r.freq || ""} onChange={(e) => editRow(g.id, r.id, "freq", e.target.value)} placeholder="Monthly" className={txt} /></span>
                  <span className="w-24 shrink-0"><MoneyInput value={r.amount || ""} onChange={(v) => editRow(g.id, r.id, "amount", v)} /></span>
                  <span className="w-24 shrink-0 text-right text-[11px] tabular-nums text-neutral-900">{money(monthlyAvg(r))}</span>
                  <span className="w-24 shrink-0"><MoneyInput value={r.pending || ""} onChange={(v) => editRow(g.id, r.id, "pending", v)} placeholder="–" /></span>
                  <Bin onClick={() => ask(() => removeRow(g.id, r.id))} />
                </Row>
              ))}
              <div className="flex items-center gap-1.5 border-t border-black bg-neutral-50 flex h-[22px] items-center px-2">
                <span className="flex-1 text-[11px] font-bold uppercase tracking-wide text-neutral-500">Group monthly</span>
                <span className="w-24 shrink-0 text-right text-[11px] font-bold tabular-nums text-neutral-900">{money(gMonthly)}</span>
                <span className="w-24 shrink-0" />
                <span className="w-6 shrink-0" />
              </div>
              <AddBar onClick={() => addRow(g.id)} />
            </div>
          );
        })}
        <AddBar onClick={addGroup} label="Add group" />

        {/* Totals */}
        <div className="flex items-center gap-1.5 border-t border-black flex h-[22px] items-center px-2" style={{ backgroundColor: MAIN_BG }}>
          <span className={`flex-1 ${head}`}>Totals</span>
          <span className={`w-24 shrink-0 text-right ${head} tabular-nums`}>{money(totalMonthly)}</span>
          <span className={`w-24 shrink-0 text-right ${head} tabular-nums`}>{money(totalPending)}</span>
          <span className="w-6 shrink-0" />
        </div>
      </div>

      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={() => setConfirm(null)}>
          <div className="w-full max-w-sm rounded-xl border bg-white p-6 text-center shadow-xl" style={{ borderColor: "#C1440E" }} onClick={(e) => e.stopPropagation()}>
            <p className="text-[13px] font-semibold text-neutral-800">Delete this?</p>
            <div className="mt-5 flex justify-center gap-6 text-[13px] font-semibold uppercase tracking-wide">
              <button onClick={() => { confirm.run(); setConfirm(null); }} className="transition-opacity hover:opacity-70" style={{ color: "#C1440E" }}>Delete</button>
              <button onClick={() => setConfirm(null)} className="transition-opacity hover:opacity-70" style={{ color: "#C1440E" }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {err && <p className="pt-2 text-[11px] font-semibold text-[#C1440E]">{err}</p>}
    </div>
  );
}
