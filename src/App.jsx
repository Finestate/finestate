import bgImage from "../Website Images/Home.png";

const NAV = ["Section 1", "Section 2", "Section 3", "Section 4", "Section 5"];

// Homepage background (your own photo in "Website Images/Home.webp").
const BACKGROUND_URL = bgImage;

export default function App() {
  return (
    <div
      className="min-h-screen bg-slate-900 bg-cover bg-center relative"
      style={{
        backgroundImage:
          "linear-gradient(to bottom, rgba(10,15,25,0.5), rgba(10,15,25,0.82)), url('" +
          BACKGROUND_URL +
          "')",
      }}
    >
      {/* Navigation */}
      <header className="absolute top-0 inset-x-0 z-20">
        <nav className="max-w-7xl mx-auto flex items-center justify-between px-8 py-6">
          <div className="flex flex-col items-start leading-none">
            <span className="font-serif text-2xl tracking-[0.3em] text-[#dccba9] pl-[0.3em]">
              FI
            </span>
            <span className="mt-1 h-px w-full bg-gradient-to-r from-[#d9c8a6]/70 to-transparent" />
          </div>
          <div className="hidden md:flex items-center gap-1">
            {NAV.map((label) => (
              <a
                key={label}
                href="#"
                className="px-4 py-2 text-sm tracking-wide text-white/90 hover:text-white transition-colors"
              >
                {label}
              </a>
            ))}
          </div>
        </nav>
      </header>

      {/* Body (intentionally empty for now) */}
      <main className="relative z-10 min-h-screen" />
    </div>
  );
}
