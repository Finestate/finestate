// Every page a person can be granted. `id` is the route and the value stored in
// profiles.access, `label` is what the sidebar and the Logins page show.
export const PAGES = [
  { id: "admin/planning", label: "Planning" },
  { id: "admin/legal-documents", label: "Admin – Legal documents" },
  { id: "admin/logins", label: "Admin – Logins" },
  { id: "admin/site-running-costs", label: "Admin – Site running costs" },
  { id: "admin/users", label: "Admin – Users" },
  { id: "assets/snapshot", label: "Assets – Snapshot" },
  { id: "assets/investing", label: "Assets – Investing" },
  { id: "assets/estate", label: "Assets – Estate" },
  { id: "costs/monthly", label: "Income+Costs – Monthly" },
  { id: "hw", label: "HW" },
];

export const ALL_PAGE_IDS = PAGES.map((p) => p.id);
