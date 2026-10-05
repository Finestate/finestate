import { NAV } from "./nav.js";

// Every page a person can be granted, read straight from the sidebar, in its order, so
// a new page appears here the moment it is in the menu. `id` is the route and the value
// stored in profiles.access; `label` is what the Users page shows: "Section – Page", or
// just the page for one that stands on its own.
export const PAGES = NAV.flatMap((s) =>
  s.children ? s.children.map((c) => ({ id: c.id, label: `${s.name} – ${c.name}` })) : [{ id: s.id, label: s.name }]
);

export const ALL_PAGE_IDS = PAGES.map((p) => p.id);
