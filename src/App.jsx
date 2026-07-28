import { useState, useEffect } from "react";
import {
  LayoutDashboard,
  Wallet,
  Banknote,
  TrendingUp,
  Calculator,
  ChevronDown,
} from "lucide-react";
import bgImage from "../Website Images/Home.webp";
import Investing from "./Investing.jsx";

// Sidebar sections. A section with `children` is an accordion; without, a direct page.
const NAV = [
  { id: "snapshot", name: "Snapshot", icon: LayoutDashboard },
  { id: "assets", name: "Assets", icon: Wallet },
  { id: "income", name: "Income", icon: Banknote },
  {
    id: "investing",
    name: "Investing",
    icon: TrendingUp,
    children: [
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
  const [open, setOpen] = useState(() => {
    const parent = NAV.find((s) => s.children?.some((c) => c.id === route));
    return [parent ? parent.id : "investing"];
  });
  const toggle = (id) =>
    setOpen((o) => (o.includes(id) ? o.filter((x) => x !== id) : [...o, id]));

  const sectionCls = (active) =>
    "w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-semibold tracking-wide cursor-pointer transition-colors " +
    (isHome
      ? "[text-shadow:0_1px_3px_rgba(0,0,0,0.45)] " +
        (active ? "text-white" : "text-white/85 hover:text-white")
      : active
      ? "text-neutral-900"
      : "text-neutral-500 hover:text-neutral-900 hover:bg-black/[0.04]");

  const subCls = (active) =>
    "w-full flex items-center gap-2 pl-9 pr-3 py-1.5 rounded-md text-[13px] cursor-pointer transition-colors " +
    (isHome
      ? "[text-shadow:0_1px_3px_rgba(0,0,0,0.45)] " +
        (active ? "text-white font-medium" : "text-white/75 hover:text-white")
      : active
      ? "text-[#9c7c33] font-semibold bg-[#c2a15a]/10"
      : "text-neutral-500 hover:text-neutral-900 hover:bg-black/[0.04]");

  return (
    <aside
      className={
        "fixed top-0 left-0 z-20 flex h-full w-60 flex-col " +
        (isHome ? "" : "border-r border-black/10 bg-white/80 backdrop-blur-md")
      }
    >
      <button
        onClick={() => onGo("home")}
        aria-label="FI – home"
        className={
          "mb-8 mt-6 self-start pl-6 font-serif text-2xl tracking-tight cursor-pointer transition-colors " +
          (isHome
            ? "text-[#dccba9] [text-shadow:0_1px_3px_rgba(0,0,0,0.45)]"
            : "text-neutral-900")
        }
      >
        FI
      </button>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-6">
        {NAV.map((sec) => {
          const Icon = sec.icon;
          if (!sec.children) {
            return (
              <button
                key={sec.id}
                onClick={() => onGo(sec.id)}
                className={sectionCls(route === sec.id)}
              >
                <Icon size={16} className="shrink-0" />
                <span className="flex-1 text-left">{sec.name}</span>
              </button>
            );
          }
          const isOpen = open.includes(sec.id);
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
                        onClick={() => onGo(ch.id)}
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
  const isHome = route === "home";

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
      {/* Cover image – shown only on Home */}
      <div
        className={
          "fixed inset-0 z-0 bg-cover bg-center transition-opacity duration-500 " +
          (isHome ? "" : "pointer-events-none")
        }
        style={{
          backgroundImage: "url('" + bgImage + "')",
          opacity: isHome ? 1 : 0,
        }}
        aria-hidden={!isHome}
      />

      <Sidebar route={route} onGo={go} />

      <main className="relative z-10 min-h-screen pl-60 pr-8 py-8">
        {route === "investing/ratios-calcs" && <Investing />}
      </main>
    </div>
  );
}
