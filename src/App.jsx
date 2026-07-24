import { useState } from "react";
import bgImage from "../Website Images/Home.webp";

// Single scrolling page. The pool image is a cover that slides away when FI is
// clicked, revealing the plain "no-nonsense" page (Says Media's #FAFAF9) below.
export default function App() {
  const [revealed, setRevealed] = useState(false);

  return (
    <div className="relative min-h-screen bg-[#FBF3E4]">
      {/* Top nav – FI on the right, always visible and clickable */}
      <header className="fixed top-0 inset-x-0 z-30">
        <nav className="max-w-7xl mx-auto flex items-center justify-end px-8 py-6">
          <button
            onClick={() => setRevealed((r) => !r)}
            aria-label="FI – home"
            className={
              "font-serif text-2xl tracking-tight cursor-pointer transition-colors duration-300 " +
              (revealed
                ? "text-neutral-900"
                : "text-[#dccba9] [text-shadow:0_1px_3px_rgba(0,0,0,0.45)]")
            }
          >
            FI
          </button>
        </nav>
      </header>

      {/* No-nonsense page (revealed underneath) – to be built out */}
      <main className="relative z-10 min-h-screen" />

      {/* Cover image – slides up and away when FI is clicked */}
      <div
        className={
          "fixed inset-0 z-20 bg-cover bg-center transition-transform duration-700 ease-in-out " +
          (revealed ? "-translate-y-full" : "translate-y-0")
        }
        style={{ backgroundImage: "url('" + bgImage + "')" }}
        aria-hidden={revealed}
      />
    </div>
  );
}
