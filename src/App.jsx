import { useState } from "react";
import bgImage from "../Website Images/Home.webp";

// Placeholder sections – rename freely.
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

      {/* Left sidebar – sits over the image on Home, over cream elsewhere */}
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
                  "text-left px-3 py-2.5 text-base font-semibold tracking-wide rounded-md cursor-pointer transition-colors " +
                  (isHome
                    ? "text-white/90 hover:text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.45)]"
                    : activeLink
                    ? "text-neutral-900 bg-black/5"
                    : "text-neutral-500 hover:text-neutral-900")
                }
              >
                {s}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Main work area – blank for now (cream shows through on section pages) */}
      <main className="relative z-10 min-h-screen pl-56 pr-8 py-6">
        {!isHome && (
          <h1 className="text-neutral-400 text-sm tracking-widest uppercase">
            {active}
          </h1>
        )}
      </main>
    </div>
  );
}
