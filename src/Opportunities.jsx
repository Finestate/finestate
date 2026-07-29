const COLUMNS = [
  "General Knowledge",
  "Mapping: Industry Summary",
  "Mapping: Micro+Macro",
  "Mapping: Geopolitics",
  "Mapping: Daily News",
  "Mapping: Other",
  "Income:",
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
    <div className="overflow-x-auto rounded-lg border border-neutral-300">
      <table className="w-max border-collapse text-sm">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 border border-[#6f6f6f] bg-[#595959] px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-white">
              Industry
            </th>
            {COLUMNS.map((c) => (
              <th
                key={c}
                className="min-w-[150px] whitespace-nowrap border border-[#6f6f6f] bg-[#595959] px-3 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-white"
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
                className="sticky left-0 z-10 whitespace-nowrap border border-neutral-300 bg-white px-3 py-1.5 text-left text-[13px] font-medium text-neutral-800"
              >
                {ind}
              </th>
              {COLUMNS.map((c) => (
                <td
                  key={c}
                  className="min-w-[150px] border border-neutral-200 bg-white px-3 py-1.5"
                />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
