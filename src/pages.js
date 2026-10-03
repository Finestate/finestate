// Every page a person can be granted, in the same order as the sidebar. `id` is the
// route and the value stored in profiles.access, `label` is what the Logins page shows.
export const PAGES = [
  { id: "admin/planning", label: "Planning – Daily" },
  { id: "hw", label: "Planning – HW" },
  { id: "bookmarks", label: "Bookmarks" },
  { id: "admin/legal-documents", label: "Admin – Legal documents" },
  { id: "admin/logins", label: "Admin – Logins" },
  { id: "admin/site-running-costs", label: "Admin – Site running costs" },
  { id: "admin/users", label: "Admin – Users" },
  { id: "admin/integrations", label: "Admin – (Required)" },
  { id: "costs/monthly", label: "Cash flow" },
  { id: "assets/snapshot", label: "Assets" },
  { id: "assets/investing", label: "Investing – Knowledge" },
];

export const ALL_PAGE_IDS = PAGES.map((p) => p.id);
