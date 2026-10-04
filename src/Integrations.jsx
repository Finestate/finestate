import { ExternalLink } from "lucide-react";

// Pages outside services ask us to have, such as the bank connection's privacy and
// terms pages. They are public pages of their own; this just keeps them in one place.
const BAR_BG = "#F2C46D";
const head = "text-[11px] font-bold uppercase leading-none tracking-[0.06em] text-neutral-900";

const PAGES = [
  { name: "Privacy page", href: "/privacy", note: "Required by Enable Banking (bank connection)." },
  { name: "Terms page", href: "/terms", note: "Required by Enable Banking (bank connection)." },
];

export default function Integrations() {
  return (
    <div className="w-full overflow-x-auto">
      <div className="w-full min-w-[560px] border border-black bg-white shadow-sm">
        <div className="flex h-[22px] items-center px-2" style={{ backgroundColor: BAR_BG }}>
          <span className={head}>Required site pages</span>
        </div>
        {PAGES.map((p) => (
          <div key={p.href} className="flex h-[22px] items-stretch border-t border-black">
            <a
              href={p.href}
              target="_blank"
              rel="noreferrer"
              className="flex w-28 shrink-0 items-center gap-1 px-2 text-[11px] text-[#0f766e] underline underline-offset-2 hover:text-[#0c5e57]"
            >
              {p.name} <ExternalLink size={10} />
            </a>
            <span className="flex flex-1 items-center border-l border-black px-2 text-[11px] text-neutral-900">{p.note}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
