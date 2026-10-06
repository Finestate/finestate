import { Bookmark, CalendarDays, CreditCard, FileText, KeyRound, Leaf, Receipt, Shield, TrendingUp, Users, Wallet } from "lucide-react";

// Sidebar sections. A section with `children` is an accordion; without, a direct page.
export const NAV = [
  // Planning heads the sidebar. Daily keeps its old route id so access lists still match.
  {
    id: "planning",
    name: "Planning",
    icon: CalendarDays,
    children: [
      { id: "admin/planning", name: "Daily", icon: CalendarDays },
      { id: "hw", name: "HW", icon: Leaf },
    ],
  },
  {
    id: "admin",
    name: "Admin",
    icon: Shield,
    children: [
      // Links that used to live in Chrome; each opens in a new tab.
      { id: "bookmarks", name: "Bookmarks", icon: Bookmark },
      { id: "admin/legal-documents", name: "Legal documents", icon: FileText },
      { id: "admin/logins", name: "Logins", icon: KeyRound },
      { id: "admin/site-running-costs", name: "Site running costs", icon: Receipt },
      { id: "admin/users", name: "Users", icon: Users },
      // Always last: the pages outside services ask us to have, gathered on one page.
      { id: "admin/integrations", name: "(Required)" },
    ],
  },
  // Cash flow is one page now; the route keeps its old id so access lists still match.
  { id: "costs/monthly", name: "Cash flow", icon: CreditCard },
  // Assets opens onto its pages; Overview keeps the old route id so access lists still match.
  {
    id: "assets",
    name: "Assets",
    icon: Wallet,
    children: [
      { id: "assets/snapshot", name: "Overview" },
      { id: "assets/estate", name: "Estate management" },
    ],
  },
  // Investing stands on its own with its own pages; Knowledge is the Intel board.
  {
    id: "investing",
    name: "Investing",
    icon: TrendingUp,
    children: [
      // Portfolio heads the section.
      { id: "investing/portfolio", name: "Portfolio" },
      // The custom calculators from the planning sheet.
      { id: "investing/calculations", name: "Calculations" },
      // How much is planned to go into investments each month, quarter or year.
      { id: "investing/contributions", name: "Contributions" },
      { id: "investing/funnel", name: "Funnel" },
      { id: "assets/investing", name: "Knowledge" },
    ],
  },
];
