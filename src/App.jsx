import { ChevronDown } from "lucide-react";

const NAV = [
  { label: "Home", href: "#" },
  {
    label: "Planning",
    items: ["Retirement", "Investments", "Tax Strategy", "Cash Flow"],
  },
  {
    label: "Wealth",
    items: ["Portfolio", "Estate Planning", "Insurance", "Trusts"],
  },
  { label: "Insights", items: ["Market Notes", "Guides", "FAQ"] },
  { label: "About", href: "#" },
];

// Homepage background: Lake Como (European luxury).
const BACKGROUND_URL =
  "https://images.unsplash.com/photo-1534430480872-3498386e7856?auto=format&fit=crop&w=2000&q=80";

function NavItem({ item }) {
  if (!item.items) {
    return (
      <a
        href={item.href}
        className="px-4 py-2 text-sm tracking-wide text-white/90 hover:text-white transition-colors"
      >
        {item.label}
      </a>
    );
  }
  return (
    <div className="relative group">
      <button className="flex items-center gap-1 px-4 py-2 text-sm tracking-wide text-white/90 hover:text-white transition-colors">
        {item.label}
        <ChevronDown className="w-3.5 h-3.5 opacity-70 group-hover:rotate-180 transition-transform duration-300" />
      </button>
      <div className="absolute left-0 top-full pt-3 opacity-0 invisible translate-y-1 group-hover:opacity-100 group-hover:visible group-hover:translate-y-0 transition-all duration-200">
        <div className="min-w-52 rounded-xl border border-white/10 bg-black/80 backdrop-blur-xl shadow-2xl overflow-hidden py-2">
          {item.items.map((sub) => (
            <a
              key={sub}
              href="#"
              className="block px-5 py-2.5 text-sm text-white/80 hover:text-white hover:bg-white/10 transition-colors"
            >
              {sub}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

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
          <div className="text-white font-serif text-xl tracking-widest uppercase">
            Heie&nbsp;Wealth
          </div>
          <div className="hidden md:flex items-center gap-1">
            {NAV.map((item) => (
              <NavItem key={item.label} item={item} />
            ))}
          </div>
          <a
            href="#"
            className="hidden md:inline-block px-5 py-2 text-sm tracking-wide text-white border border-white/30 rounded-full hover:bg-white hover:text-slate-900 transition-colors"
          >
            Client Login
          </a>
        </nav>
      </header>

      {/* Hero */}
      <main className="relative z-10 min-h-screen flex flex-col items-center justify-center text-center px-6">
        <p className="text-white/70 tracking-[0.3em] uppercase text-xs mb-6">
          Private Financial Planning
        </p>
        <h1 className="font-serif text-white text-5xl md:text-7xl leading-tight max-w-4xl">
          Wealth, planned with intention.
        </h1>
        <p className="text-white/70 max-w-xl mt-6 text-lg font-light">
          Considered strategies for the long term – retirement, investments and
          estate, guided by clarity and discretion.
        </p>
        <div className="mt-10 flex gap-4">
          <a
            href="#"
            className="px-8 py-3 rounded-full bg-white text-slate-900 text-sm tracking-wide hover:bg-white/90 transition-colors"
          >
            Book a Consultation
          </a>
          <a
            href="#"
            className="px-8 py-3 rounded-full border border-white/40 text-white text-sm tracking-wide hover:bg-white/10 transition-colors"
          >
            Explore Services
          </a>
        </div>
      </main>
    </div>
  );
}
