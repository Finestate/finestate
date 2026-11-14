import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Timer, X } from "lucide-react";

// A tiny countdown timer. The end time lives here and in this browser, so it keeps
// running while you move around the site (and through a refresh). TimerWatcher sits
// in the App, always mounted, and chimes when time is up whatever page is open.
const KEY = "finestate.timer.end";
let endAt = (() => { try { return Number(localStorage.getItem(KEY)) || 0; } catch { return 0; } })();
let mins = (() => { try { return Number(localStorage.getItem(KEY + ".mins")) || 0; } catch { return 0; } })();
const subs = new Set();
const emit = () => subs.forEach((f) => f());
const setEnd = (t) => {
  endAt = t;
  try { t ? localStorage.setItem(KEY, String(t)) : localStorage.removeItem(KEY); } catch {}
  emit();
};

// One sound engine, woken by the click that starts the timer, so the browser lets it play later.
let ctx = null;
const wake = () => {
  try {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
  } catch {}
};
// A soft rising three-note chime. The notes playing are kept so Close can cut them off.
let playing = [];
const chime = () => {
  wake();
  if (!ctx) return;
  const t0 = ctx.currentTime + 0.05;
  [0].forEach((rep) =>
    [523.25, 659.25, 783.99].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = f;
      const t = t0 + rep + i * 0.22;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
      o.connect(g).connect(ctx.destination);
      playing.push(o);
      o.onended = () => { playing = playing.filter((x) => x !== o); };
      o.start(t);
      o.stop(t + 1.2);
    })
  );
};

// Once done it rings: the chime repeats for up to 30 seconds, and the clock flashes
// until Close is pressed. The moment it started ringing is kept, so a refresh keeps it.
let ringAt = (() => { try { return Number(localStorage.getItem(KEY + ".ring")) || 0; } catch { return 0; } })();
const setRing = (t) => {
  ringAt = t;
  try { t ? localStorage.setItem(KEY + ".ring", String(t)) : localStorage.removeItem(KEY + ".ring"); } catch {}
  emit();
};
const finish = () => { setEnd(0); setRing(Date.now()); };
export const closeRing = () => {
  setRing(0);
  playing.forEach((o) => { try { o.stop(); } catch {} });
  playing = [];
};

export function TimerWatcher() {
  const [, force] = useState(0);
  useEffect(() => {
    const f = () => force((n) => n + 1);
    subs.add(f);
    return () => subs.delete(f);
  }, []);
  useEffect(() => {
    if (!endAt) return;
    const left = endAt - Date.now();
    if (left <= 0) { finish(); return; }
    const id = setTimeout(finish, left);
    return () => clearTimeout(id);
  });
  // While ringing and under 30 seconds in: a chime every 2 seconds.
  useEffect(() => {
    if (!ringAt) return;
    const ring = () => { if (ringAt && Date.now() - ringAt < 30000) chime(); };
    ring();
    const id = setInterval(ring, 2000);
    return () => clearInterval(id);
  }, [ringAt]);
  return null;
}

export default function MiniTimer() {
  const [, force] = useState(0);
  const [menu, setMenu] = useState(null); // where the minutes menu opens, or null
  const btn = useRef(null);
  useEffect(() => {
    const f = () => force((n) => n + 1);
    subs.add(f);
    const id = setInterval(f, 1000);
    return () => { subs.delete(f); clearInterval(id); };
  }, []);
  // A click anywhere else, or Esc, closes the menu.
  useEffect(() => {
    if (!menu) return;
    const off = (e) => { if (!e.target.closest?.("[data-mini-timer]")) setMenu(null); };
    const esc = (e) => { if (e.key === "Escape") setMenu(null); };
    document.addEventListener("mousedown", off);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", off); document.removeEventListener("keydown", esc); };
  }, [menu]);
  const left = endAt ? Math.max(0, Math.ceil((endAt - Date.now()) / 1000)) : 0;
  const clock = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
  const start = (m) => { wake(); if (ringAt) closeRing(); mins = m; try { localStorage.setItem(KEY + ".mins", String(m)); } catch {} setEnd(m ? Date.now() + m * 60000 : 0); setMenu(null); };
  const open = () => {
    const r = btn.current.getBoundingClientRect();
    setMenu(menu ? null : { top: r.bottom + 3, left: r.left });
  };
  return (
    <span data-mini-timer className="flex shrink-0 items-center gap-1 leading-none" onClick={(e) => e.stopPropagation()}>
      {/* A small stopwatch: a click opens the minutes, picking one starts it straight away. */}
      <button ref={btn} type="button" onClick={open} title={endAt ? "Change or stop the timer" : "Timer"} className="flex h-[15px] items-center text-neutral-900 hover:text-[#9c7c33]">
        <Timer size={12} strokeWidth={2.5} />
      </button>
      {endAt > 0 && !ringAt && <span className="text-[11px] font-bold tabular-nums tracking-[0.02em] text-[#C1440E]">{clock}</span>}
      {/* Done: the clock flashes red until Close is pressed. */}
      {ringAt > 0 && (
        <>
          <span onClick={closeRing} title="Stop" className="mt-blink flex h-[15px] cursor-pointer items-center bg-[#C1440E] px-1 text-[11px] font-bold tabular-nums leading-none tracking-[0.02em] text-white">0:00</span>
          <button type="button" onClick={closeRing} title="Stop" className="flex h-[15px] items-center text-[#C1440E] hover:text-neutral-900">
            <X size={13} strokeWidth={3} />
          </button>
        </>
      )}
      {menu && createPortal(
        <div data-mini-timer className="fixed z-[90] grid grid-cols-4 border border-black bg-white shadow-lg" style={{ top: menu.top, left: menu.left }}>
          {Array.from({ length: 12 }, (_, i) => (i + 1) * 5).map((m, i) => (
            <button
              key={m}
              type="button"
              onClick={() => start(m)}
              className={`h-[21px] w-[28px] text-[11px] font-bold tabular-nums text-neutral-900 hover:bg-[#FBEFEC] ${i % 4 ? "border-l border-neutral-300" : ""} ${i > 3 ? "border-t border-neutral-300" : ""} ${endAt && mins === m ? "bg-[#FFE4B3]" : ""}`}
            >
              {m}
            </button>
          ))}
          {/* TEMP for testing: a 1 second timer. Remove once the timer is right. */}
          <button type="button" onClick={() => start(1 / 60)} className="col-span-4 h-[21px] border-t border-neutral-300 text-[11px] font-bold text-neutral-900 hover:bg-[#FBEFEC]">
            1 sec (test)
          </button>
          {endAt > 0 && (
            <button type="button" onClick={() => start(0)} className="col-span-4 h-[21px] border-t border-black text-[11px] font-bold uppercase tracking-[0.06em] text-[#C1440E] hover:bg-[#FBEFEC]">
              Stop
            </button>
          )}
        </div>,
        document.body
      )}
    </span>
  );
}
