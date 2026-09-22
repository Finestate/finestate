// Every page a person can be granted. `id` is the route and the value stored in
// profiles.access, `label` is what the sidebar and the Logins page show.
export const PAGES = [
  { id: "admin/planning", label: "Ops – Planning" },
  { id: "admin/legal-documents", label: "Ops – Legal documents" },
  { id: "admin/site-running-costs", label: "Ops – Site running costs" },
  { id: "admin/users", label: "Ops – Users" },
  { id: "assets", label: "Assets" },
  { id: "costs", label: "Costs" },
  { id: "income", label: "Income" },
  { id: "investing", label: "Investing" },
];

export const ALL_PAGE_IDS = PAGES.map((p) => p.id);
