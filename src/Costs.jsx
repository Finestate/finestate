import { useEffect, useRef, useState } from "react";
import { Plus, Trash2, ChevronDown, RefreshCw, Check } from "lucide-react";
import { supabase } from "./lib/supabaseClient.js";
import { EXPENSES_SEED } from "./expensesSeed.js";
import { DateCell } from "./LegalDocuments.jsx";

// Cash flow page, rebuilt from the FC tab of HEIE Planning. The figures are private,
// so they live in Supabase (admin_docs), never in this repo.
const DOC_ID = "costs-fc";
// The read-only bank connection: which accounts it covers, until when, and the last
// balances read. Kept in Supabase like everything else.
const BANK_ID = "bank-link";
// The columns of an expense line, left to right.
const EXPENSE_COLS = [
  { label: "Description" },
  { label: "Payment source" },
  { label: "Payment frequency" },
  { label: "Amount (exact or estimate)", money: true },
  { label: "Averaged monthly", money: true },
  { label: "This month pending", money: true },
];
const MONTH_CODES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
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
// A card number, kept only as its first and last four digits, the way the bank shows
// it. Whatever is typed stays in this box until you leave it; only the masked form is
// ever saved, so the full number is never stored.
const maskCard = (v) => {
  const d = String(v || "").replace(/\D/g, "");
  return d.length >= 8 ? `${d.slice(0, 4)} •••• •••• ${d.slice(-4)}` : String(v || "").trim();
};
function CardNumber({ value, onChange }) {
  const [draft, setDraft] = useState(null);
  const shown = draft ?? value ?? "";
  return (
    <input
      value={shown}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => { if (draft != null) onChange(maskCard(draft)); setDraft(null); }}
      onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
      size={Math.max(shown.length, 6)}
      className="bg-transparent py-0 text-[11px] leading-none tabular-nums outline-none"
    />
  );
}

// An interest rate: reads as plain text with the % right against it, and turns into a
// box to type in when clicked. Only the bare figure is kept.
function RateInput({ value, onChange }) {
  const [edit, setEdit] = useState(false);
  if (!edit) {
    return (
      <button type="button" onClick={() => setEdit(true)} className="w-full text-left text-[11px] leading-none tabular-nums text-neutral-900">
        {value ? `${value}%` : <span className="text-neutral-400">Interest %</span>}
      </button>
    );
  }
  return (
    <input
      autoFocus
      value={value || ""}
      onChange={(e) => onChange(e.target.value.replace(/[^0-9.,]/g, ""))}
      onBlur={() => setEdit(false)}
      onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
      className="w-full bg-transparent py-0 text-[11px] leading-none tabular-nums text-neutral-900 outline-none"
    />
  );
}

// How often an expense goes out, picked in two columns: Monthly on the left, or on the
// right exactly the months of the year it is due. Kept as "Monthly" or the months in
// calendar order ("Feb - Aug"), which is also what the monthly average reads.
const FREQ_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function FrequencyPicker({ value, onChange }) {
  const [anchor, setAnchor] = useState(null);
  const btn = useRef(null);
  const v = String(value || "");
  const monthly = /month/i.test(v);
  const picked = monthly ? [] : FREQ_MONTHS.filter((m) => new RegExp(`\\b${m}`, "i").test(v));
  const open = () => {
    const r = btn.current?.getBoundingClientRect();
    if (r) setAnchor({ top: r.bottom + 4, left: Math.min(r.left, window.innerWidth - 260) });
  };
  const toggle = (m) => {
    const next = picked.includes(m) ? picked.filter((x) => x !== m) : [...picked, m];
    onChange(FREQ_MONTHS.filter((x) => next.includes(x)).join(" - "));
  };
  const tile = (on) =>
    `h-6 text-[11px] border ${on ? "border-black bg-[#F2C46D] font-bold text-neutral-900" : "border-neutral-300 bg-white text-neutral-700 hover:border-black"}`;
  return (
    <>
      <button ref={btn} type="button" onClick={() => (anchor ? setAnchor(null) : open())} className="flex w-full items-center gap-1 text-left text-[11px] leading-none text-neutral-900">
        <span className={`min-w-0 flex-1 ${!monthly && !picked.length && v ? "text-neutral-400" : ""}`}>{monthly ? "Monthly" : picked.length ? picked.join(" - ") : v}</span>
        <ChevronDown size={11} className="shrink-0 text-neutral-400" />
      </button>
      {anchor && (
        <>
          {/* One block: Monthly as a tall button down the left, the months in a 3 by 4 grid,
              and Done in red along the bottom under them. It stays open until Done. */}
          <div className="fixed z-50 grid grid-cols-[5rem_repeat(3,3rem)] grid-rows-5 gap-1 border-2 border-black bg-white p-2 shadow-xl" style={{ top: anchor.top, left: anchor.left }}>
            <button type="button" onClick={() => onChange(monthly ? "" : "Monthly")} className={`row-span-5 !h-auto ${tile(monthly)}`}>
              Monthly
            </button>
            {FREQ_MONTHS.map((m) => (
              <button key={m} type="button" onClick={() => toggle(m)} className={tile(picked.includes(m))}>
                {m}
              </button>
            ))}
            <button type="button" onClick={() => setAnchor(null)} className="col-span-3 h-6 bg-[#C1440E] text-[11px] font-bold text-white hover:bg-[#a63a0c]">
              Done
            </button>
          </div>
        </>
      )}
    </>
  );
}

// `fit` sizes the box to the figure, so a label such as EUR can sit right beside it.
function MoneyInput({ value, onChange, placeholder = "0.00", fit = false }) {
  const [focus, setFocus] = useState(false);
  const shown = focus || value === "" || value == null ? value ?? "" : money(num(value));
  // Sized to fit, the figure reads as plain text, so it sits one space after its label
  // exactly like the figures beside it; a click turns it into the box to type in.
  if (fit && !focus) {
    return (
      <button type="button" onClick={() => setFocus(true)} className="text-[11px] leading-none tabular-nums">
        {shown || <span className="text-neutral-400">{placeholder}</span>}
      </button>
    );
  }
  return (
    <input
      value={shown}
      inputMode="decimal"
      autoFocus={fit}
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
// A band inside the table that sets one section apart from the next.
const GAP_BG = "#8A8A8A"; // mid grey
const Gap = () => <div className="h-[10px] border-t border-black" style={{ backgroundColor: GAP_BG }} />;
// The new table's section bars, in the top orange; the groups under them take the next shade.
const Section = ({ children, first }) => (
  <div className={`${first ? "" : "border-t border-black"} flex h-[22px] items-center px-2`} style={{ backgroundColor: MAIN_BG }}>
    <span className={head}>{children}</span>
  </div>
);
// `first`: the bar that opens a table, where the frame already draws the line above.
const Sub = ({ children, first }) => (
  <div className={`${first ? "" : "border-t border-black"} flex h-[22px] items-center px-2`} style={{ backgroundColor: SUB_BG }}>
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
        const loadedDoc = { ...EMPTY, ...d, balances: { ...EMPTY.balances, ...(d.balances || {}) } };
        setDoc(loadedDoc);
        setLoaded(true);
        // ONE-OFF: the expense lines from the sheet go into Supabase once, and only when
        // the saved page loaded cleanly, so nothing already there can be written over.
        if (!error && !loadedDoc.expensesSeeded) {
          const next = {
            ...loadedDoc,
            expenses: {
              groups: EXPENSES_SEED.map((g) => ({
                id: newId(),
                name: g.name,
                rows: g.rows.map(([description, source, amount]) => ({ id: newId(), description, source, freq: "", amount })),
              })),
            },
            expensesSeeded: true,
          };
          setDoc(next);
          supabase
            .from("admin_docs")
            .upsert({ id: DOC_ID, data: next, updated_at: new Date().toISOString() })
            .then(({ error: e }) => setErr(e ? e.message : ""));
        }
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
  // Asks before going ahead: a delete by default, or any other step with its own words.
  const ask = (run, words) => setConfirm({ run, ...(words || {}) });

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

  // Tax payments: date and amount, kept in Supabase with the rest of the page.
  const taxPayments = doc.taxPayments || [];
  const editTax = (id, field, val) =>
    save({
      ...doc,
      taxPayments: taxPayments.length
        ? taxPayments.map((t) => (t.id === id ? { ...t, [field]: val } : t))
        : [{ id: newId(), date: "", amount: "", [field]: val }],
    });
  // What is shown: the saved lines, or one blank line while there are none.
  const taxRows = taxPayments.length ? taxPayments : [{ id: "blank", date: "", amount: "" }];
  // Pocket money: two lines, one per child, made the first time the page is opened.
  const pocketKids = doc.pocketKids || [
    { id: "kid-1", initial: "", month: "", payments: [], open: false },
    { id: "kid-2", initial: "", month: "", payments: [], open: false },
  ];
  const editKid = (id, fields) => save({ ...doc, pocketKids: pocketKids.map((k) => (k.id === id ? { ...k, ...fields } : k)) });
  const editPayment = (kidId, payId, fields) => {
    const list = pocketKids.find((k) => k.id === kidId)?.payments || [];
    editKid(kidId, {
      payments: list.length ? list.map((x) => (x.id === payId ? { ...x, ...fields } : x)) : [{ id: newId(), date: "", amount: "", ...fields }],
    });
  };
  const paymentRows = (k) => ((k.payments || []).length ? k.payments : [{ id: "blank", date: "", amount: "" }]);

  // Expenses in groups, each with its own lines, kept in Supabase. Lines saved before
  // under Home-related carry over as the first group.
  const blankExpense = () => ({ id: newId(), description: "", source: "", freq: "", amount: "" });
  const expenseGroups = doc.expenses?.groups || [{ id: "home", name: "Home-related", rows: doc.expenses?.home || [] }];
  const setExpenseGroups = (groups) => save({ ...doc, expenses: { groups } });
  const setExpenseRows = (gid, rows) => setExpenseGroups(expenseGroups.map((g) => (g.id === gid ? { ...g, rows } : g)));
  // A group never shows empty: a blank line stands ready, and the first thing typed
  // into it makes it real.
  const rowsOf = (g) => (g.rows?.length ? g.rows : [{ ...blankExpense(), id: "blank" }]);
  const editExpense = (gid, id, fields) => {
    const rows = expenseGroups.find((g) => g.id === gid)?.rows || [];
    setExpenseRows(gid, rows.length ? rows.map((e) => (e.id === id ? { ...e, ...fields } : e)) : [{ ...blankExpense(), ...fields }]);
  };
  const allExpenses = expenseGroups.flatMap((g) => g.rows || []);
  // Where an expense is paid from. Your own account appears as SP and its number, read
  // from the connected bank, so the number itself never sits in this code.
  const paymentSources = (() => {
    const own = (bank?.accounts || []).find((a) => !/jugend|gesch|business|gmbh/i.test(`${a.product || ""} ${a.name || ""}`));
    const nr = own?.iban ? own.iban.replace(/\s/g, "").slice(-8) : "";
    return [nr ? `SP ${nr}` : "SP account", "PayPal (SP MC)", "Per invoice", "SSI account"];
  })();

  // Fixed costs still to go out: nil until the costs part of the table is built.
  // An expense is due this month when it goes out monthly, or this month is one of its
  // months. It is pending until ticked as paid for this month; the tick is kept with
  // the month it was made in, so next month it is pending again by itself.
  const now = new Date();
  const thisMonth = FREQ_MONTHS[now.getMonth()];
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const dueThisMonth = (e) => /month/i.test(e.freq || "") || new RegExp(`\\b${thisMonth}`, "i").test(e.freq || "");
  const isPaid = (e) => e.paidMonth === monthKey;
  const pendingOf = (e) => (dueThisMonth(e) && !isPaid(e) ? num(e.amount) : 0);
  const pendingFixed = allExpenses.reduce((sum, e) => sum + pendingOf(e), 0);
  const expensesMonthly = allExpenses.reduce((sum, e) => sum + monthlyAvg(e), 0);
  // Your own account's balance, read from the bank (not the company's or the kids').
  const ownBalance = (() => {
    const own = (bank?.accounts || []).find((a) => !/jugend|gesch|business|gmbh/i.test(`${a.product || ""} ${a.name || ""}`));
    const b = own && bank.balances?.[own.uid];
    return b && !b.error && b.amount !== "" ? num(b.amount) : 0;
  })();

  if (!loaded) return <p className="px-2 py-3 text-[11px] italic text-neutral-400">Loading…</p>;

  return (
    // Narrow windows scroll the table sideways rather than squashing the columns.
    <div className="w-full overflow-x-auto">
      {/* The new table, being built up step by step. */}
      <div className="w-full min-w-[680px] overflow-hidden border border-black bg-white text-[11px] leading-none shadow-sm">
        {/* Balances always come first. */}
        <Section first>Accounts</Section>
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
        {/* Fixed costs still to go out this month. Nil for now; it will come from the
            costs part of the table once that is built. */}
        {/* Money going out reads in red: pending fixed costs, the card and the debt. */}
        <div className="flex h-[22px] items-stretch border-t border-black">
          <span className="flex flex-1 items-center px-2 text-[11px] text-[#C1440E]">Pending fixed costs</span>
          <span className="flex w-36 shrink-0 items-center justify-end border-l border-black px-2 text-[11px] tabular-nums text-[#C1440E]">
            EUR {money(pendingFixed)}
          </span>
        </div>
        {/* The credit card isn't shared by the bank, so its figure is typed in. */}
        <div className="flex h-[22px] items-stretch border-t border-black">
          <span className="flex flex-1 items-center gap-1 px-2 text-[11px] text-[#C1440E]">
            Credit card: <CardNumber value={doc.cardNumber} onChange={(v) => save({ ...doc, cardNumber: v })} />
          </span>
          <span className="flex w-36 shrink-0 items-center justify-end gap-1 border-l border-black px-2 text-[11px] tabular-nums text-[#C1440E]">
            <span>EUR</span>
            <MoneyInput value={doc.balances.card} onChange={(v) => setBalance("card", v)} placeholder="0.00" fit />
          </span>
        </div>
        {/* Your account's balance once the pending fixed costs and the credit card bill
            have gone out. The card counts as owed whichever way its sign was typed. */}
        <div className="flex h-[22px] items-stretch border-t border-black">
          <span className="flex flex-1 items-center px-2 text-[11px] font-bold text-neutral-900">Bank balance after fixed costs and credit card deductions</span>
          <span className="flex w-36 shrink-0 items-center justify-end border-l border-black px-2 text-[11px] font-bold tabular-nums text-neutral-900">
            EUR {money(ownBalance - pendingFixed - Math.abs(num(doc.balances.card)))}
          </span>
        </div>
        {/* The mortgage isn't shared by the bank, so its loans are typed in. The Debt line
            shows what they add up to, and opens, like your account line, onto the loans
            themselves on the same faint pink: name, account number, interest rate, expiry
            and amount. */}
        {(() => {
          const loans = doc.loans || [];
          const open = !!doc.ui?.debtOpen;
          const total = loans.reduce((sum, l) => sum + num(l.amount), 0);
          const setLoans = (next) => save({ ...doc, loans: next });
          const editLoan = (id, field, val) =>
            setLoans(
              loans.length
                ? loans.map((l) => (l.id === id ? { ...l, [field]: val } : l))
                : [{ id: newId(), name: "", number: "", rate: "", expires: "", amount: "", [field]: val }]
            );
          const loanRows = loans.length ? loans : [{ id: "blank", name: "", number: "", rate: "", expires: "", amount: "" }];
          const sub = "flex h-[22px] items-stretch border-t border-black";
          const cellTxt = "bg-transparent py-0 text-[11px] leading-none text-neutral-900 outline-none";
          return (
            <>
              <div className={sub}>
                <span
                  onClick={() => save({ ...doc, ui: { ...(doc.ui || {}), debtOpen: !open } })}
                  className="flex flex-1 cursor-pointer select-none items-center gap-1 px-2 text-[11px] text-[#C1440E]"
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
                    className="bg-transparent py-0 text-[11px] leading-none outline-none"
                  />
                  <ChevronDown size={12} className={`ml-auto shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
                </span>
                <span className="flex w-36 shrink-0 items-center justify-end border-l border-black px-2 text-[11px] tabular-nums text-[#C1440E]">
                  EUR {money(total)}
                </span>
              </div>
              {open && (
                <>
                  {/* One framed row per loan: four equal columns, each with a faint label of
                      what goes in it, and the amount on the right. Always ready to type in. */}
                  {loanRows.map((l) => {
                    const col = "flex min-w-0 items-center border-l border-black px-2";
                    const box = `${cellTxt} w-full placeholder:text-neutral-400`;
                    return (
                      <div key={l.id} className={`group ${sub}`} style={{ backgroundColor: "#FBEFEC" }}>
                        <div className="grid flex-1 grid-cols-4 pl-4">
                          <span className="flex min-w-0 items-center px-2">
                            <input value={l.name || ""} onChange={(e) => editLoan(l.id, "name", e.target.value)} placeholder="Loan name" className={box} />
                          </span>
                          <span className={col}>
                            <input value={l.number || ""} onChange={(e) => editLoan(l.id, "number", e.target.value)} placeholder="Account number" className={`${box} tabular-nums`} />
                          </span>
                          <span className={col}>
                            <RateInput value={l.rate} onChange={(v) => editLoan(l.id, "rate", v)} />
                          </span>
                          <span className={col}>
                            {/* The same calendar as the Legal documents page. */}
                            <DateCell value={l.expires || ""} onChange={(v) => editLoan(l.id, "expires", v)} placeholder="Expires" />
                            {/* The bin shows only while the pointer is on the row. */}
                            <button onClick={() => ask(() => setLoans(loans.filter((x) => x.id !== l.id)))} title="Remove this loan" className="ml-1 shrink-0 text-neutral-900 opacity-0 hover:text-[#C1440E] group-hover:opacity-100">
                              <Trash2 size={11} />
                            </button>
                          </span>
                        </div>
                        <span className="flex w-36 shrink-0 items-center justify-end gap-1 border-l border-black px-2 text-[11px] tabular-nums text-neutral-900">
                          <span>EUR</span>
                          <MoneyInput value={l.amount || ""} onChange={(v) => editLoan(l.id, "amount", v)} placeholder="0.00" fit />
                        </span>
                      </div>
                    );
                  })}
                  {/* Under the last loan, a quiet line to add the next one. */}
                  <button
                    onClick={() => setLoans([...loans, { id: newId(), name: "", number: "", rate: "", expires: "", amount: "" }])}
                    className="flex h-[22px] w-full items-center gap-1 border-t border-black pl-6 text-[11px] text-neutral-400 transition-colors hover:text-neutral-900"
                    style={{ backgroundColor: "#FBEFEC" }}
                  >
                    <Plus size={11} /> Add loan
                  </button>
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

        <Gap />
        <Section>Income</Section>
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

        <Gap />
        <Section>Unique payments tracking</Section>

        {/* Tax payments: one line each, the date on the left (the same calendar as Legal
            documents) and the amount on the right. Editable from the start. */}
        <div className="flex h-[22px] items-center border-t border-black px-2" style={{ backgroundColor: SUB_BG }}>
          <span className={head}>Tax payments</span>
        </div>
        {taxRows.map((t) => (
          <div key={t.id} className="group flex h-[22px] items-stretch border-t border-black">
            <span className="flex flex-1 items-center gap-2 px-2">
              <span className="w-40">
                <DateCell value={t.date} onChange={(v) => editTax(t.id, "date", v)} placeholder="Date" />
              </span>
              <button onClick={() => ask(() => save({ ...doc, taxPayments: taxPayments.filter((x) => x.id !== t.id) }))} title="Remove" className="ml-auto text-neutral-900 opacity-0 hover:text-[#C1440E] group-hover:opacity-100">
                <Trash2 size={11} />
              </button>
            </span>
            <span className="flex w-36 shrink-0 items-center justify-end gap-1 border-l border-black px-2 text-[11px] tabular-nums text-neutral-900">
              <span>EUR</span>
              <MoneyInput value={t.amount} onChange={(v) => editTax(t.id, "amount", v)} placeholder="0.00" fit />
            </span>
          </div>
        ))}
        {/* Always under the last tax payment: a quiet line to add the next one. */}
        <button
          onClick={() => save({ ...doc, taxPayments: [...taxPayments, { id: newId(), date: "", amount: "" }] })}
          className="flex h-[22px] w-full items-center gap-1 border-t border-black px-2 text-[11px] text-neutral-400 transition-colors hover:text-neutral-900"
        >
          <Plus size={11} /> Add payment
        </button>

        {/* Pocket money: one line per child, with their initial and the month, and what
            was paid out that month in total. Each line opens, on the faint pink, onto the
            payments themselves (usually weekly): date and amount, in pairs. */}
        <div className="flex h-[22px] items-center border-t border-black px-2" style={{ backgroundColor: SUB_BG }}>
          <span className={head}>Pocket money current month</span>
        </div>
        {pocketKids.map((k) => {
          const total = (k.payments || []).reduce((sum, x) => sum + num(x.amount), 0);
          return (
            <div key={k.id}>
              <div className="flex h-[22px] items-stretch border-t border-black">
                <span className="flex w-10 shrink-0 items-center px-2">
                  <input
                    value={k.initial || ""}
                    onChange={(e) => editKid(k.id, { initial: e.target.value.slice(0, 1).toUpperCase() })}
                    placeholder="–"
                    className="w-full bg-transparent py-0 text-[11px] font-bold leading-none text-neutral-900 outline-none placeholder:text-neutral-400"
                  />
                </span>
                <span className="flex w-20 shrink-0 items-center border-l border-black px-1">
                  <select
                    value={k.month ? k.month.charAt(0).toUpperCase() + k.month.slice(1).toLowerCase() : ""}
                    onChange={(e) => editKid(k.id, { month: e.target.value })}
                    className="w-full cursor-pointer bg-transparent py-0 text-[11px] leading-none text-neutral-900 outline-none"
                  >
                    <option value="">Month</option>
                    {MONTH_CODES.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </span>
                <span
                  onClick={() => editKid(k.id, { open: !k.open })}
                  className="flex flex-1 cursor-pointer select-none items-center gap-2 border-l border-black px-2 text-[11px] text-neutral-500"
                >
                  <ChevronDown size={12} className={`ml-auto shrink-0 text-neutral-900 transition-transform ${k.open ? "rotate-180" : ""}`} />
                </span>
                <span className="flex w-36 shrink-0 items-center justify-end border-l border-black px-2 text-[11px] tabular-nums text-neutral-900">
                  EUR {money(total)}
                </span>
              </div>
              {k.open && paymentRows(k).map((x) => (
                <div key={x.id} className="group flex h-[22px] items-stretch border-t border-black" style={{ backgroundColor: "#FBEFEC" }}>
                  <span className="flex flex-1 items-center gap-2 px-2">
                    {/* Pulled left by the icon's own inner margin, so it lines up with the A and S. */}
                    <span className="-ml-[1.5px] w-40">
                      <DateCell value={x.date} onChange={(v) => editPayment(k.id, x.id, { date: v })} placeholder="Date" />
                    </span>
                    <button onClick={() => ask(() => editKid(k.id, { payments: k.payments.filter((y) => y.id !== x.id) }))} title="Remove" className="ml-auto text-neutral-900 opacity-0 hover:text-[#C1440E] group-hover:opacity-100">
                      <Trash2 size={11} />
                    </button>
                  </span>
                  <span className="flex w-36 shrink-0 items-center justify-end gap-1 border-l border-black px-2 text-[11px] tabular-nums text-neutral-900">
                    <span>EUR</span>
                    <MoneyInput value={x.amount} onChange={(v) => editPayment(k.id, x.id, { amount: v })} placeholder="0.00" fit />
                  </span>
                </div>
              ))}
              {/* Under the last payment, a quiet line to add the next one. */}
              {k.open && (
                <button
                  onClick={() => editKid(k.id, { payments: [...(k.payments || []), { id: newId(), date: "", amount: "" }] })}
                  className="flex h-[22px] w-full items-center gap-1 border-t border-black px-2 text-[11px] text-neutral-400 transition-colors hover:text-neutral-900"
                  style={{ backgroundColor: "#FBEFEC" }}
                >
                  <Plus size={11} /> Add payment
                </button>
              )}
            </div>
          );
        })}

        <Gap />
        <Section>Expenses</Section>
        {/* Expenses come in groups, each built the same: its bar (the name typed straight
            into it), the column headings, its lines, Add expense, and its total. */}
        {expenseGroups.map((g) => {
          const rows = g.rows || [];
          return (
            <div key={g.id}>
              <div className="group flex h-[22px] items-center border-t border-black px-2" style={{ backgroundColor: SUB_BG }}>
                <input
                  value={g.name || ""}
                  onChange={(ev) => setExpenseGroups(expenseGroups.map((x) => (x.id === g.id ? { ...x, name: ev.target.value } : x)))}
                  className={`w-full bg-transparent py-0 outline-none ${head}`}
                />
                {expenseGroups.length > 1 && (
                  <button onClick={() => ask(() => setExpenseGroups(expenseGroups.filter((x) => x.id !== g.id)))} title="Remove this group" className="ml-1 shrink-0 text-neutral-900 opacity-0 hover:text-[#C1440E] group-hover:opacity-100">
                    <Trash2 size={11} />
                  </button>
                )}
              </div>
              {/* The column headings: six equal, framed columns, the money ones set right,
                  in the rows' own type, just bold, on the next shade down from the group bar. */}
              <div className="grid h-[22px] grid-cols-6 border-t border-black" style={{ backgroundColor: SUBSUB_BG }}>
                {EXPENSE_COLS.map((c, i) => (
                  <span key={c.label} className={`flex items-center px-2 text-[11px] font-bold uppercase leading-none text-neutral-900 ${i ? "border-l border-black" : ""} ${c.money ? "justify-end text-right" : ""}`}>
                    {c.label}
                  </span>
                ))}
              </div>
              {rowsOf(g).map((e) => {
                const cell = "flex min-w-0 items-center border-l border-black px-2 text-[11px] tabular-nums text-neutral-900";
                const edit = (fields) => editExpense(g.id, e.id, fields);
                return (
                  <div key={e.id} className="group grid h-[22px] grid-cols-6 border-t border-black">
                    <span className="flex min-w-0 items-center px-2">
                      <input value={e.description || ""} onChange={(ev) => edit({ description: ev.target.value })} className="w-full bg-transparent py-0 text-[11px] leading-none text-neutral-900 outline-none" />
                      <button onClick={() => ask(() => setExpenseRows(g.id, rows.filter((x) => x.id !== e.id)))} title="Remove" className="ml-1 shrink-0 text-neutral-900 opacity-0 hover:text-[#C1440E] group-hover:opacity-100">
                        <Trash2 size={11} />
                      </button>
                    </span>
                    <span className={cell}>
                      <select
                        // A line saved under the old name reads under the new one.
                        value={e.source === "Silke Account" ? "SSI account" : e.source || ""}
                        onChange={(ev) => edit({ source: ev.target.value })}
                        className="w-full cursor-pointer bg-transparent py-0 text-[11px] leading-none text-neutral-900 outline-none"
                      >
                        <option value="" />
                        {paymentSources.map((o) => <option key={o} value={o}>{o}</option>)}
                        {e.source && e.source !== "Silke Account" && !paymentSources.includes(e.source) && <option value={e.source}>{e.source}</option>}
                      </select>
                    </span>
                    <span className={cell}>
                      <FrequencyPicker value={e.freq} onChange={(v) => edit({ freq: v })} />
                    </span>
                    <span className={`${cell} justify-end gap-1`}>
                      <span>EUR</span>
                      <MoneyInput value={e.amount} onChange={(v) => edit({ amount: v })} placeholder="0.00" fit />
                    </span>
                    {/* Worked out from the frequency, so blank until one is set. */}
                    <span className={`${cell} justify-end`}>{e.freq ? `EUR ${money(monthlyAvg(e))}` : ""}</span>
                    <span className={`${cell} justify-end`}>
                      {/* Due this month: a tick marks it paid; it shows teal once ticked. */}
                      {dueThisMonth(e) && e.id !== "blank" && (
                        <button
                          onClick={() => edit({ paidMonth: isPaid(e) ? "" : monthKey })}
                          title={isPaid(e) ? "Paid this month (click to undo)" : "Mark as paid this month"}
                          className={`mr-auto ${isPaid(e) ? "text-[#0f766e]" : "text-neutral-300 hover:text-neutral-700"}`}
                        >
                          <Check size={12} strokeWidth={3} />
                        </button>
                      )}
                      {e.freq ? `EUR ${money(pendingOf(e))}` : ""}
                    </span>
                  </div>
                );
              })}
              <button
                onClick={() => setExpenseRows(g.id, [...rows, blankExpense()])}
                className="flex h-[22px] w-full items-center gap-1 border-t border-black px-2 text-[11px] text-neutral-400 transition-colors hover:text-neutral-900"
              >
                <Plus size={11} /> Add expense
              </button>
            </div>
          );
        })}
        <button
          onClick={() => setExpenseGroups([...expenseGroups, { id: newId(), name: "New group", rows: [] }])}
          className="flex h-[22px] w-full items-center gap-1 border-t border-black px-2 text-[11px] text-neutral-400 transition-colors hover:text-neutral-900"
          style={{ backgroundColor: SUB_BG }}
        >
          <Plus size={11} /> Add group
        </button>
        {/* Every group together, on white, in bold red: money going out. */}
        <div className="grid h-[22px] grid-cols-6 border-t border-black">
            <span className="col-span-4 flex items-center px-2 text-[11px] font-bold text-[#C1440E]">Expenses total</span>
            <span className="flex items-center justify-end border-l border-black px-2 text-[11px] font-bold tabular-nums text-[#C1440E]">EUR {money(expensesMonthly)}</span>
            <span className="flex items-center justify-end border-l border-black px-2 text-[11px] font-bold tabular-nums text-[#C1440E]">EUR {money(pendingFixed)}</span>
          </div>
      </div>

      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={() => setConfirm(null)}>
          <div className="w-full max-w-sm rounded-xl border bg-white p-6 text-center shadow-xl" style={{ borderColor: "#C1440E" }} onClick={(e) => e.stopPropagation()}>
            <p className="text-[13px] font-semibold text-neutral-800">{confirm.question || "Delete this?"}</p>
            <div className="mt-5 flex justify-center gap-6 text-[13px] font-semibold uppercase tracking-wide">
              <button onClick={() => { confirm.run(); setConfirm(null); }} className="transition-opacity hover:opacity-70" style={{ color: "#C1440E" }}>{confirm.action || "Delete"}</button>
              <button onClick={() => setConfirm(null)} className="transition-opacity hover:opacity-70" style={{ color: "#C1440E" }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {err && <p className="pt-2 text-[11px] font-semibold text-[#C1440E]">{err}</p>}
    </div>
  );
}
