import { useState, useEffect } from "react";
import {
  Receipt,
  Wallet,
  Banknote,
  TrendingUp,
  Calculator,
  Target,
  ChevronDown,
} from "lucide-react";
import Investing from "./Investing.jsx";
import Opportunities from "./Opportunities.jsx";
import SiteRunningCosts from "./SiteRunningCosts.jsx";
import infinityImg from "../Website Images/Infinity.webp";

// Sidebar sections. A section with `children` is an accordion; without, a direct page.
const NAV = [
  { id: "site-running-costs", name: "Site running costs", icon: Receipt },
  { id: "assets", name: "Assets", icon: Wallet },
  { id: "income", name: "Income", icon: Banknote },
  {
    id: "investing",
    name: "Investing",
    icon: TrendingUp,
    children: [
      { id: "investing/opportunities", name: "Opportunities", icon: Target },
      { id: "investing/ratios-calcs", name: "Ratios + Calculations", icon: Calculator },
    ],
  },
];

const LEAF_IDS = [
  "home",
  ...NAV.flatMap((s) => (s.children ? s.children.map((c) => c.id) : [s.id])),
];

function readRoute() {
  const h = decodeURIComponent(
    (typeof window !== "undefined" ? window.location.hash : "").replace(/^#\/?/, "")
  ).toLowerCase();
  return LEAF_IDS.includes(h) ? h : "home";
}

function Sidebar({ route, onGo }) {
  const isHome = route === "home";
  const [openId, setOpenId] = useState(() => {
    const parent = NAV.find((s) => s.children?.some((c) => c.id === route));
    return parent ? parent.id : null;
  });
  const toggle = (id) => setOpenId((o) => (o === id ? null : id));

  const sectionCls = (active) =>
    "w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] font-semibold uppercase tracking-wide cursor-pointer transition-colors " +
    (active
      ? "text-neutral-900"
      : "text-neutral-500 hover:text-neutral-900 hover:bg-black/[0.04]");

  const subCls = (active) =>
    "w-full flex items-center gap-2 pl-9 pr-3 py-1.5 rounded-md text-[11px] uppercase tracking-wide cursor-pointer transition-colors " +
    (active
      ? "text-[#9c7c33] font-semibold bg-[#c2a15a]/10"
      : "text-neutral-500 hover:text-neutral-900 hover:bg-black/[0.04]");

  return (
    <aside
      className={
        "fixed top-0 left-0 z-20 flex h-full w-60 flex-col " +
        (isHome ? "bg-transparent" : "border-r border-neutral-200 bg-white")
      }
    >
      <div className="flex items-center px-6 pt-6 pb-2">
        <button onClick={() => onGo("home")} aria-label="Home" className="cursor-pointer">
          <img src={infinityImg} alt="FI" className="h-6 w-auto" />
        </button>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-4 pt-1">
        {NAV.map((sec) => {
          const Icon = sec.icon;
          if (!sec.children) {
            return (
              <button
                key={sec.id}
                onClick={() => {
                  setOpenId(null);
                  onGo(sec.id);
                }}
                className={sectionCls(route === sec.id)}
              >
                <Icon size={16} className="shrink-0" />
                <span className="flex-1 text-left">{sec.name}</span>
              </button>
            );
          }
          const isOpen = openId === sec.id;
          const parentActive = sec.children.some((c) => c.id === route);
          return (
            <div key={sec.id}>
              <button
                onClick={() => toggle(sec.id)}
                className={sectionCls(parentActive)}
              >
                <Icon size={16} className="shrink-0" />
                <span className="flex-1 text-left">{sec.name}</span>
                <ChevronDown
                  size={14}
                  className={"shrink-0 transition-transform " + (isOpen ? "rotate-180" : "")}
                />
              </button>
              {isOpen && (
                <div className="mt-0.5 flex flex-col">
                  {sec.children.map((ch) => {
                    const CI = ch.icon;
                    return (
                      <button
                        key={ch.id}
                        onClick={() => {
                          setOpenId(sec.id);
                          onGo(ch.id);
                        }}
                        className={subCls(route === ch.id)}
                      >
                        {CI && <CI size={14} className="shrink-0" />}
                        <span className="text-left">{ch.name}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}

export default function App() {
  const [route, setRoute] = useState(readRoute);

  useEffect(() => {
    const onHash = () => setRoute(readRoute());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const go = (r) => {
    setRoute(r);
    if (r === "home") history.replaceState(null, "", window.location.pathname);
    else window.location.hash = r;
  };

  return (
    <div className="relative min-h-screen bg-[#FBF3E4]">
      <Sidebar route={route} onGo={go} />

      <main className="relative z-10 min-h-screen pl-[17rem] pr-8 py-8">
        {route === "site-running-costs" && <SiteRunningCosts />}
        {route === "investing/opportunities" && <Opportunities />}
        {route === "investing/ratios-calcs" && <Investing />}
      </main>
    </div>
  );
}
