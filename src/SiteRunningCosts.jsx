const GOLD = "#9c7c33";

// Monthly running-cost line items for finestate.xyz. 0 = not yet filled in.
const COST_ITEMS = [
  { item: "Vercel", provider: "Vercel", purpose: "Website hosting & serverless functions", monthly: 0 },
  { item: "GitHub", provider: "GitHub", purpose: "Code hosting & deploy trigger", monthly: 0 },
  { item: "Domain name", provider: "Registrar", purpose: "finestate.xyz domain registration", monthly: 0 },
  { item: "Anthropic (Claude API)", provider: "Anthropic", purpose: "AI analysis (planned)", monthly: 0 },
  { item: "Stock data API", provider: "TBD", purpose: "Market data feed (planned)", monthly: 0 },
];

export default function SiteRunningCosts() {
  const total = COST_ITEMS.reduce((sum, c) => sum + c.monthly, 0);
  return (
    <div>
      <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-neutral-700">
        Monthly Running Costs
      </h2>
      <div className="overflow-hidden rounded-xl border border-black/10 bg-white shadow-sm">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-[#FBF3E4] text-[11px] uppercase tracking-wide text-neutral-700">
              <th className="border-b border-black/10 px-4 py-2.5 text-left font-bold">
                Cost Item
              </th>
              <th className="border-b border-black/10 px-4 py-2.5 text-left font-bold">
                Provider
              </th>
              <th className="border-b border-black/10 px-4 py-2.5 text-left font-bold">
                What it's for
              </th>
              <th className="whitespace-nowrap border-b border-black/10 px-4 py-2.5 text-right font-bold">
                Cost / Month (USD)
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200">
            {COST_ITEMS.map((c) => (
              <tr key={c.item} className="transition-colors hover:bg-[#FBF3E4]/50">
                <td className="px-4 py-2.5 font-semibold text-neutral-800">{c.item}</td>
                <td className="px-4 py-2.5 text-neutral-600">{c.provider}</td>
                <td className="px-4 py-2.5 text-neutral-500">{c.purpose}</td>
                <td className="whitespace-nowrap px-4 py-2.5 text-right font-semibold tabular-nums text-neutral-800">
                  ${c.monthly.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-black/10 bg-[#FBF3E4]">
              <td
                colSpan={3}
                className="px-4 py-2.5 text-right text-[11px] font-bold uppercase tracking-wide text-neutral-600"
              >
                Total / month
              </td>
              <td
                className="whitespace-nowrap px-4 py-2.5 text-right font-extrabold tabular-nums"
                style={{ color: GOLD }}
              >
                ${total.toFixed(2)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
