import { useState } from "react";
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

// Candidate backgrounds. Look at each and pick by eye – names are not reliable.
const BACKGROUNDS = [
  "photo-1600585154340-be6161a56a0c",
  "photo-1512917774080-9991f1c4c750",
  "photo-1580587771525-78b9dba3b914",
  "photo-1613490493576-7fde63acd811",
  "photo-1583608205776-bfd35f0d9f83",
  "photo-1568605114967-8130f3a36994",
  "photo-1449844908441-8829872d2607",
  "photo-1600596542815-ffad4c1539a9",
  "photo-1512915922686-57c11dde9b6b",
  "photo-1600607687939-ce8a6c25118c",
  "photo-1601760561441-16420502c7e0",
  "photo-1523217582562-09d0def993a6",
];

const imgUrl = (id, w) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=80`;

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
  const [bgIndex, setBgIndex] = useState(0);
  const [open, setOpen] = useState(true);
  const bg = BACKGROUNDS[bgIndex];

  return (
    <div
      className="min-h-screen bg-slate-900 bg-cover bg-center relative transition-[background-image] duration-500"
      style={{
        backgroundImage:
          "linear-gradient(to bottom, rgba(10,15,25,0.5), rgba(10,15,25,0.82)), url('" +
          imgUrl(bg, 2000) +
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

      {/* Background picker – temporary. Look at each image and click the one you like. */}
      {open && (
        <div className="fixed bottom-0 inset-x-0 z-30 bg-black/80 backdrop-blur-md border-t border-white/10 px-4 py-3">
          <div className="flex items-center justify-between mb-2 max-w-6xl mx-auto">
            <p className="text-white/80 text-xs tracking-wide">
              Look at each picture and click the one you like. You're on option{" "}
              <span className="text-white font-semibold">#{bgIndex + 1}</span>.
              Then tell me the number.
            </p>
            <button
              onClick={() => setOpen(false)}
              className="text-white/60 hover:text-white text-xs underline"
            >
              hide
            </button>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 max-w-6xl mx-auto">
            {BACKGROUNDS.map((id, i) => (
              <button
                key={id}
                onClick={() => setBgIndex(i)}
                className={
                  "relative shrink-0 w-40 h-24 rounded-lg overflow-hidden border-2 transition-all " +
                  (bgIndex === i
                    ? "border-white scale-105"
                    : "border-transparent opacity-70 hover:opacity-100")
                }
              >
                <img
                  src={imgUrl(id, 320)}
                  alt={"Option " + (i + 1)}
                  className="w-full h-full object-cover"
                />
                <span className="absolute top-1 left-1 bg-black/70 text-white text-xs font-semibold rounded px-1.5">
                  {i + 1}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
