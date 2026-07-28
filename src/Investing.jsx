import { useState } from "react";
import { Info } from "lucide-react";
import { CALC_GROUPS } from "./investingData.js";

function parseVal(type, raw) {
  if (type === "date") return raw;
  const n = parseFloat(String(raw).replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : NaN;
}

function Calc({ calc }) {
  const [raw, setRaw] = useState(() => {
    const o = {};
    for (const f of calc.fields) o[f.key] = String(calc.defaults[f.key] ?? "");
    return o;
  });
  const [showInfo, setShowInfo] = useState(false);

  const v = {};
  for (const f of calc.fields) v[f.key] = parseVal(f.type, raw[f.key]);
  let outputs = [];
  try {
    outputs = calc.compute(v) || [];
  } catch {
    outputs = [];
  }

  return (
    <div className="flex flex-col rounded-xl border border-black/10 bg-white/70 p-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <h4 className="text-sm font-semibold leading-snug text-neutral-800">
          {calc.title}
        </h4>
        {calc.blurb && (
          <button
            onClick={() => setShowInfo((s) => !s)}
            className="shrink-0 cursor-pointer text-neutral-400 hover:text-[#c2a15a]"
            aria-label="Definition"
          >
            <Info className="h-4 w-4" />
          </button>
        )}
      </div>

      {showInfo && calc.blurb && (
        <p className="mb-3 rounded-md bg-black/[0.03] p-2 text-xs leading-relaxed text-neutral-500">
          {calc.blurb}
        </p>
      )}

      <div className="mb-3 grid grid-cols-2 gap-2">
        {calc.fields.map((f) => (
          <label key={f.key} className="block">
            <span className="mb-0.5 block text-[10px] uppercase tracking-wide text-neutral-400">
              {f.label}
            </span>
            <input
              type={f.type === "date" ? "date" : "text"}
              inputMode={f.type === "date" ? undefined : "decimal"}
              value={raw[f.key]}
              onChange={(e) =>
                setRaw((s) => ({ ...s, [f.key]: e.target.value }))
              }
              className="w-full rounded-md border border-black/10 bg-white px-2 py-1 text-sm text-neutral-800 outline-none focus:border-[#c2a15a]"
            />
          </label>
        ))}
      </div>

      <div className="mt-auto space-y-1 border-t border-black/10 pt-3">
        {outputs.map((o) => (
          <div key={o.label} className="flex items-center justify-between gap-3">
            <span className="text-xs text-neutral-500">{o.label}</span>
            <span className="text-sm font-semibold tabular-nums text-neutral-900">
              {o.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Investing() {
  return (
    <div className="max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold text-neutral-900">Tools</h1>
        <p className="mt-1 text-neutral-500">
          Live calculators – edit any input and the result updates instantly.
        </p>
      </div>

      <div className="space-y-8">
        {CALC_GROUPS.map((g) => (
          <section key={g.group}>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#c2a15a]">
              {g.group}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {g.calcs.map((c) => (
                <Calc key={c.id} calc={c} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
