import { useState } from "react";
import { Lightbulb, X } from "lucide-react";
import { CALC_GROUPS, RATIO_FORMULAS } from "./investingData.js";
import { RATIO_ABOUT } from "./ratioDefinitions.js";

function parseVal(type, raw) {
  if (type === "date") return raw;
  const n = parseFloat(String(raw).replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : NaN;
}

// Add thousand separators for display in money/num inputs (kept editable).
function withCommas(s) {
  const str = String(s ?? "");
  const neg = str.trim().startsWith("-");
  const cleaned = str.replace(/[^0-9.]/g, "");
  if (cleaned === "") return neg ? "-" : "";
  const [intPart, ...rest] = cleaned.split(".");
  const intFmt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const hasDot = cleaned.includes(".");
  return (neg ? "-" : "") + intFmt + (hasDot ? "." + rest.join("") : "");
}

function Calc({ calc }) {
  const [raw, setRaw] = useState(() => {
    const o = {};
    for (const f of calc.fields) o[f.key] = String(calc.defaults[f.key] ?? "");
    return o;
  });
  const [aboutOpen, setAboutOpen] = useState(false);

  const formula = RATIO_FORMULAS[calc.id];
  const about = RATIO_ABOUT[calc.id];

  const v = {};
  for (const f of calc.fields) v[f.key] = parseVal(f.type, raw[f.key]);
  let outputs = [];
  try {
    outputs = calc.compute(v) || [];
  } catch {
    outputs = [];
  }

  return (
    <div className="px-4 py-2.5">
      {/* Title line + icons */}
      <div className="mb-1.5 flex items-center gap-2">
        <span className="text-[12px] font-semibold uppercase tracking-wide text-neutral-800">
          {calc.title}
        </span>
        {about && (
          <button
            onClick={() => setAboutOpen(true)}
            title="What it's for"
            className="shrink-0 cursor-pointer text-neutral-400 hover:text-amber-500"
            aria-label="What it's for"
          >
            <Lightbulb className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Inputs + outputs */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {calc.fields.map((f) => (
          <div key={f.key} className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-wide text-neutral-400">
              {f.label}
            </span>
            <input
              type={f.type === "date" ? "date" : "text"}
              inputMode={f.type === "date" ? undefined : "decimal"}
              value={
                f.type === "money" || f.type === "num"
                  ? withCommas(raw[f.key])
                  : raw[f.key]
              }
              onChange={(e) =>
                setRaw((s) => ({
                  ...s,
                  [f.key]:
                    f.type === "money" || f.type === "num"
                      ? e.target.value.replace(/,/g, "")
                      : e.target.value,
                }))
              }
              className={
                "rounded-none border-0 border-b border-black/15 bg-transparent px-1 py-0.5 text-sm text-neutral-800 outline-none transition-colors focus:border-[#c2a15a] " +
                (f.type === "date" ? "w-32" : "w-20")
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

      {/* Definition popup (lightbulb) */}
      {aboutOpen && about && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setAboutOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-h-[82vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-2xl"
          >
            <div className="mb-3 flex items-start justify-between gap-4">
              <div className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-amber-500" />
                <h3 className="text-base font-semibold uppercase tracking-wide text-neutral-900">
                  {calc.title}
                </h3>
              </div>
              <button
                onClick={() => setAboutOpen(false)}
                className="shrink-0 cursor-pointer text-neutral-400 hover:text-neutral-700"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {formula && (
              <p className="mb-4 rounded-md bg-black/[0.04] px-3 py-2 text-sm font-medium tabular-nums text-neutral-700">
                {formula}
              </p>
            )}
            <p className="whitespace-pre-line text-sm leading-relaxed text-neutral-700">
              {about}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Investing() {
  return (
    <div>
      <div className="space-y-5">
        {CALC_GROUPS.map((g) => (
          <section
            key={g.group}
            className="overflow-hidden rounded-xl border border-black/10 bg-white/60 shadow-sm"
          >
            <div className="border-b border-black/10 bg-black/[0.03] px-4 py-2">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-[#c2a15a]">
                {g.group}
              </h2>
            </div>
            <div className="divide-y divide-black/10">
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
