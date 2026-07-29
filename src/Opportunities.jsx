import { useState } from "react";

const COLUMNS = [
  "General Knowledge",
  "Industry Summary",
  "Daily News",
  "ETFs: Common Popular",
  "ETFs: Leveraged",
  "ETFs: Top Performers",
  "Individual Stocks",
];

// Each "lens" shows a different set of industries. Placeholder sets for now –
// the real ranking will come from the market-data feed next session.
const LENSES = [
  {
    id: "next5",
    title: "Best potential – next 5 years",
    industries: [
      "Semiconductors",
      "AI+Robotics",
      "Cloud+Enterprise software",
      "Cybersecurity",
      "Broad technology",
      "Biotech+Genomics",
      "EV+Autonomous mobility",
      "Batteries+Energy storage",
      "Clean energy",
      "Uranium+Nuclear",
      "Digital platforms+E-commerce",
      "Aerospace+Defense",
      "Space+Aerospace",
      "Quantum+Frontier computing",
    ],
  },
  {
    id: "best10",
    title: "Best performers – last 10 years",
    industries: [
      "Semiconductors",
      "Broad technology",
      "Cloud+Enterprise software",
      "Cybersecurity",
      "Digital platforms+E-commerce",
      "AI+Robotics",
      "Aerospace+Defense",
      "Pharmaceuticals (GLP-1/obesity)",
      "Gold+Precious metals",
      "Bitcoin+Crypto",
      "Uranium+Nuclear",
    ],
  },
  {
    id: "laggards10",
    title: "Laggards – last 10 years (should have done better)",
    industries: [
      "Clean energy",
      "EV+Autonomous mobility",
      "Batteries+Energy storage",
      "Hydrogen",
      "Space+Aerospace",
      "Biotech+Genomics",
      "Solar",
      "Cannabis",
    ],
  },
];

export default function Opportunities() {
  const [lensId, setLensId] = useState("next5");
  const lens = LENSES.find((l) => l.id === lensId) || LENSES[0];

  return (
    <div>
      {/* Lens selector – acts as the table title (placeholder sets for now) */}
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <select
          value={lensId}
          onChange={(e) => setLensId(e.target.value)}
          className="cursor-pointer border-b-2 border-[#c2a15a]/50 bg-transparent pb-1 text-base font-semibold uppercase tracking-wide text-neutral-800 outline-none focus:border-[#c2a15a]"
        >
          {LENSES.map((l) => (
            <option key={l.id} value={l.id}>
              {l.title}
            </option>
          ))}
        </select>
        <span className="text-xs italic text-neutral-400">
          placeholder – data feed + AI research coming next
        </span>
      </div>

      <div className="overflow-hidden rounded-xl border border-black/10 bg-white shadow-sm">
        <table className="w-full table-fixed border-collapse text-sm">
          <colgroup>
            <col style={{ width: "20%" }} />
            {COLUMNS.map((c) => (
              <col key={c} />
            ))}
          </colgroup>
          <thead>
            <tr className="border-b-2 border-[#c2a15a]/40 bg-[#c2a15a]/10">
              <th className="px-3 py-2.5 text-left align-bottom text-[10px] font-semibold uppercase tracking-wide leading-tight text-[#8a6d2c]">
                Industry
              </th>
              {COLUMNS.map((c) => (
                <th
                  key={c}
                  className="px-2 py-2.5 text-center align-bottom text-[10px] font-semibold uppercase tracking-wide leading-tight text-[#8a6d2c]"
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lens.industries.map((ind, i) => (
              <tr
                key={ind}
                className={
                  "border-b border-black/[0.06] transition-colors last:border-b-0 hover:bg-[#c2a15a]/[0.06] " +
                  (i % 2 ? "bg-[#faf7ef]" : "bg-white")
                }
              >
                <th
                  scope="row"
                  className="border-r border-black/[0.06] px-3 py-2 text-left align-middle text-[12px] font-medium leading-tight text-neutral-800"
                >
                  {ind}
                </th>
                {COLUMNS.map((c) => (
                  <td
                    key={c}
                    className="border-r border-black/[0.04] px-2 py-2 align-middle last:border-r-0"
                  />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
