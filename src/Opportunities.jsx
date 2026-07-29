const COLUMNS = [
  "General Knowledge",
  "Mapping: Industry Summary",
  "Mapping: Daily News",
  "ETFs: Common Popular",
  "ETFs: Leveraged",
  "ETFs: Top Performers",
  "Individual Stocks",
];

const INDUSTRIES = [
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
];

export default function Opportunities() {
  return (
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
          {INDUSTRIES.map((ind, i) => (
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
  );
}
