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
    <div className="overflow-hidden rounded-lg border border-[#c2a15a]/40">
      <table className="w-full table-fixed border-collapse text-sm">
        <colgroup>
          <col style={{ width: "19%" }} />
          {COLUMNS.map((c) => (
            <col key={c} />
          ))}
        </colgroup>
        <thead>
          <tr>
            <th className="border border-[#8a6d2c] bg-[#9c7c33] px-2 py-2 text-left align-middle text-[10px] font-semibold uppercase tracking-wide leading-tight text-white">
              Industry
            </th>
            {COLUMNS.map((c) => (
              <th
                key={c}
                className="border border-[#8a6d2c] bg-[#9c7c33] px-2 py-2 text-center align-middle text-[10px] font-semibold uppercase tracking-wide leading-tight text-white"
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {INDUSTRIES.map((ind) => (
            <tr key={ind}>
              <th
                scope="row"
                className="border border-neutral-200 bg-white px-2 py-1.5 text-left align-middle text-[12px] font-medium leading-tight text-neutral-800"
              >
                {ind}
              </th>
              {COLUMNS.map((c) => (
                <td key={c} className="border border-neutral-200 bg-white px-2 py-1.5" />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
