import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "./lib/supabaseClient.js";

// Cash flow page, rebuilt from the FC tab of HEIE Planning. The figures are private,
// so they live in Supabase (admin_docs), never in this repo.
const DOC_ID = "costs-fc";

// Heading ladder: a deeper amber main band, then the site's prime
// shade for sections and its lighter shade for expense groups. Rows sit on white with
// hairline rules, so the headings carry the structure.
const MAIN_BG = "#F2C46D";
const SUB_BG = "#FFE4B3";
const SUBSUB_BG = "#FCEFCF";

const EMPTY = { rates: [], balances: { giro: "", card: "", mortgage: "" }, income: [], tax: [], pocket: [], groups: [] };

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
function MoneyInput({ value, onChange, placeholder = "0.00" }) {
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
      className={numCls}
    />
  );
}

const Main = ({ children }) => (
  <div className="border-y-2 border-neutral-400 flex h-[22px] items-center px-2" style={{ backgroundColor: MAIN_BG }}>
    <span className={head}>{children}</span>
  </div>
);
const Sub = ({ children }) => (
  <div className="border-y border-neutral-400 flex h-[22px] items-center px-2" style={{ backgroundColor: SUB_BG }}>
    <span className={head}>{children}</span>
  </div>
);
const Bin = ({ onClick }) => (
  <button onClick={onClick} title="Delete" className="flex w-6 shrink-0 items-center justify-end text-neutral-900 hover:text-[#C1440E]">
    <Trash2 size={12} />
  </button>
);
const AddBar = ({ onClick, label = "Add" }) => (
  <button onClick={onClick} className="flex h-[22px] w-full items-center gap-1 border-t border-neutral-200 bg-white px-2 text-[11px] font-bold uppercase tracking-wide text-neutral-400 transition-colors hover:text-neutral-800">
    <Plus size={12} /> {label}
  </button>
);
const Row = ({ children, first }) => (
  <div className={`flex h-[22px] items-center gap-1.5 px-2 ${first ? "" : "border-t border-neutral-200"}`}>{children}</div>
);
// A two-column line: label on the left, a figure on the right.
const Figure = ({ label, value, onChange, calc, strong }) => (
  <div className="flex items-center gap-1.5 border-t border-neutral-200 flex h-[22px] items-center px-2">
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
    <div className="w-full">
      <div spellCheck={false} className="w-full overflow-hidden border-2 border-neutral-400 bg-white text-[11px] leading-none shadow-sm">
        {/* Exchange rates are hidden for now; the saved ones still convert income to EUR. */}
        {/* The nav already says Monthly, so the page opens straight on Balances. */}

        <Sub>Balances</Sub>
        <Figure label="SP Giro account balance" value={doc.balances.giro} onChange={(v) => setBalance("giro", v)} />
        <Figure label="Pending fixed costs" value={totalPending} calc />
        <Figure label="Credit card balance" value={doc.balances.card} onChange={(v) => setBalance("card", v)} />
        <Figure label="Balance after all pending fixed costs and pending credit card bill" value={balanceAfter} calc strong />
        <Figure label="Mortgage to clear with extra payments" value={doc.balances.mortgage} onChange={(v) => setBalance("mortgage", v)} />

        <Sub>Net incoming</Sub>
        <div className="flex items-center gap-1.5 border-b border-neutral-300 bg-white flex h-[22px] items-center px-2">
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
              <div className="flex items-center gap-1.5 border-y border-neutral-300 flex h-[22px] items-center px-2" style={{ backgroundColor: SUBSUB_BG }}>
                <input value={g.name || ""} onChange={(e) => editGroup(g.id, e.target.value)} placeholder="Group" className={`flex-1 bg-transparent py-0 outline-none ${head}`} />
                <Bin onClick={() => ask(() => removeGroup(g.id))} />
              </div>
              <div className="flex items-center gap-1.5 border-b border-neutral-300 flex h-[22px] items-center px-2">
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
              <div className="flex items-center gap-1.5 border-t border-neutral-300 bg-neutral-50 flex h-[22px] items-center px-2">
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
        <div className="flex items-center gap-1.5 border-y-2 border-neutral-400 flex h-[22px] items-center px-2" style={{ backgroundColor: MAIN_BG }}>
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
