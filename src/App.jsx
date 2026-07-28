import { useState } from "react";
import bgImage from "../Website Images/Home.webp";
import Investing from "./Investing.jsx";

// Sidebar sections – rename freely.
const SECTIONS = ["Snapshot", "Assets", "Income", "Investing"];

export default function App() {
  const [active, setActive] = useState("Home");
  const isHome = active === "Home";

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

      {/* Left sidebar */}
      <aside className="fixed top-0 left-0 z-20 flex h-full w-56 flex-col px-8 py-6">
        <button
          onClick={() => setActive("Home")}
          aria-label="FI – home"
          className={
            "mb-12 self-start pl-3 font-serif text-2xl tracking-tight cursor-pointer transition-colors duration-300 " +
            (isHome
              ? "text-[#dccba9] [text-shadow:0_1px_3px_rgba(0,0,0,0.45)]"
              : "text-neutral-900")
          }
        >
          FI
        </button>

        <nav className="flex flex-col gap-1">
          {SECTIONS.map((s) => {
            const activeLink = active === s;
            return (
              <button
                key={s}
                onClick={() => setActive(s)}
                className={
                  "relative text-left px-3 py-2.5 text-base font-semibold tracking-wide cursor-pointer transition-colors " +
                  "before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:h-5 before:w-[3px] before:rounded-full before:bg-[#c2a15a] before:transition-opacity " +
                  (isHome
                    ? "text-white/90 hover:text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.45)] before:opacity-0"
                    : activeLink
                    ? "text-neutral-900 before:opacity-100"
                    : "text-neutral-400 hover:text-neutral-700 before:opacity-0")
                }
              >
                {s}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Main work area */}
      <main className="relative z-10 min-h-screen pl-56 pr-8 py-8">
        {active === "Investing" && <Investing />}
      </main>
    </div>
  );
}
