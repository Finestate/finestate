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
    <div className="border-b border-black/10 py-2.5">
      {/* Title line */}
      <div className="mb-1.5 flex items-center gap-1.5">
        <span className="text-[13px] font-semibold text-neutral-800">
          {calc.title}
        </span>
        {calc.blurb && (
          <button
            onClick={() => setShowInfo((s) => !s)}
            className="shrink-0 cursor-pointer text-neutral-400 hover:text-[#c2a15a]"
            aria-label="Definition"
          >
            <Info className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Inputs + outputs flow on one line (results pushed right) */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {calc.fields.map((f) => (
          <div key={f.key} className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-wide text-neutral-400">
              {f.label}
            </span>
            <input
              type={f.type === "date" ? "date" : "text"}
              inputMode={f.type === "date" ? undefined : "decimal"}
              value={raw[f.key]}
              onChange={(e) =>
                setRaw((s) => ({ ...s, [f.key]: e.target.value }))
              }
              className={
                "rounded-md border border-black/10 bg-white px-2 py-1 text-sm text-neutral-800 outline-none focus:border-[#c2a15a] " +
                (f.type === "date" ? "w-36" : "w-24")
              }
            />
          </div>
        ))}

        <div className="ml-auto flex flex-wrap items-center gap-x-5 gap-y-1 border-l border-black/10 pl-4">
          {outputs.map((o) => (
            <div key={o.label} className="flex items-center gap-1.5">
              <span className="text-[10px] uppercase tracking-wide text-neutral-400">
                {o.label}
              </span>
              <span className="text-sm font-semibold tabular-nums text-[#9c7c33]">
                {o.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {showInfo && calc.blurb && (
        <p className="mt-2 max-w-3xl rounded-md bg-black/[0.03] p-2 text-xs leading-relaxed text-neutral-500">
          {calc.blurb}
        </p>
      )}
    </div>
  );
}

export default function Investing() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-semibold text-neutral-900">Tools</h1>
        <p className="mt-1 text-neutral-500">
          Live calculators – edit any input and the result updates instantly.
        </p>
      </div>

      <div className="space-y-8">
        {CALC_GROUPS.map((g) => (
          <section key={g.group}>
            <h2 className="mb-1 text-xs font-semibold uppercase tracking-widest text-[#c2a15a]">
              {g.group}
            </h2>
            <div className="border-t border-black/10">
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
