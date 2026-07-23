const NAV = ["Section 1", "Section 2", "Section 3", "Section 4", "Section 5"];

// Homepage background.
const BACKGROUND_URL =
  "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=2000&q=80";

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
          <div className="text-white font-serif text-2xl tracking-widest uppercase">
            FI
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
