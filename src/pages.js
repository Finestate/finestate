// Every page a person can be granted. `id` is the route and the value stored in
// profiles.access, `label` is what the sidebar and the Logins page show.
export const PAGES = [
  { id: "admin/planning", label: "Admin – Planning" },
  { id: "admin/legal-documents", label: "Admin – Legal documents" },
  { id: "admin/site-running-costs", label: "Admin – Site running costs" },
  { id: "admin/logins", label: "Admin – Logins" },
  { id: "assets", label: "Assets" },
  { id: "income", label: "Income" },
  { id: "investing/opportunities", label: "Investing – Opportunities" },
  { id: "investing/ratios-calcs", label: "Investing – Ratios + Calculations" },
];

export const ALL_PAGE_IDS = PAGES.map((p) => p.id);
