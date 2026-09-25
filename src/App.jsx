import { useState, useEffect } from "react";
import {
  Wallet,
  CreditCard,
  TrendingUp,
  Calculator,
  Target,
  CalendarDays,
  Shield,
  Receipt,
  FileText,
  KeyRound,
  Users,
  ChevronDown,
} from "lucide-react";
import Investing from "./Investing.jsx";
import Opportunities from "./Opportunities.jsx";
import Planning from "./Planning.jsx";
import SiteRunningCosts from "./SiteRunningCosts.jsx";
import Logins from "./Logins.jsx";
import LegalDocuments from "./LegalDocuments.jsx";
import Costs from "./Costs.jsx";
import Auth from "./Auth.jsx";
import { supabase, supabaseReady } from "./lib/supabaseClient.js";
import infinityImg from "../Website Images/Infinity.webp";
import { ALL_PAGE_IDS } from "./pages.js";

// Sidebar sections. A section with `children` is an accordion; without, a direct page.
const NAV = [
  // Planning stands on its own at the top; its route keeps the old id so access lists still match.
  { id: "admin/planning", name: "Planning", icon: CalendarDays },
  {
    id: "admin",
    name: "Admin",
    icon: Shield,
    children: [
      { id: "admin/legal-documents", name: "Legal documents", icon: FileText },
      { id: "admin/logins", name: "Logins", icon: KeyRound },
      { id: "admin/site-running-costs", name: "Site running costs", icon: Receipt },
      { id: "admin/users", name: "Users", icon: Users },
    ],
  },
  {
    id: "costs",
    name: "Income+Costs",
    icon: CreditCard,
    children: [{ id: "costs/monthly", name: "Monthly" }],
  },
  {
    id: "assets",
    name: "Assets",
    icon: Wallet,
    children: [
      { id: "assets/snapshot", name: "Snapshot" },
      { id: "assets/investing", name: "Investing" },
      { id: "assets/estate", name: "Estate" },
    ],
  },
];

const VIEW_AS_KEY = "finestate.viewAs";

const LEAF_IDS = [
  "home",
  ...NAV.flatMap((s) => (s.children ? s.children.map((c) => c.id) : [s.id])),
];

function readRoute() {
  const h = decodeURIComponent(
    (typeof window !== "undefined" ? window.location.hash : "").replace(/^#\/?/, "")
  ).toLowerCase();
  if (h === "planning") return "admin/planning"; // old bookmark
  return LEAF_IDS.includes(h) ? h : "home";
}

function Sidebar({ route, onGo, allowed }) {
  const isHome = route === "home";
  const [openId, setOpenId] = useState(() => {
    const parent = NAV.find((s) => s.children?.some((c) => c.id === route));
    return parent ? parent.id : null;
  });
  // Opening a section also lands on its first page, so you never sit on the old screen.
  const toggle = (sec) => {
    setOpenId((o) => (o === sec.id ? null : sec.id));
    if (openId !== sec.id) {
      const first = sec.children.find((c) => allowed.includes(c.id));
      if (first) onGo(first.id);
    }
  };
  const can = (id) => allowed.includes(id);

  const sectionCls = (active) =>
    "w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] font-semibold uppercase tracking-wide cursor-pointer transition-colors " +
    (active
      ? "text-neutral-900"
      : "text-neutral-500 hover:text-neutral-900 hover:bg-black/[0.04]");

  const subCls = (active, locked) =>
    "w-full flex items-center gap-2 pl-9 pr-3 py-1.5 rounded-md text-[11px] uppercase tracking-wide transition-colors " +
    (locked
      ? "text-neutral-300 cursor-not-allowed"
      : active
      ? "text-[#9c7c33] font-semibold bg-[#c2a15a]/10 cursor-pointer"
      : "text-neutral-500 hover:text-neutral-900 hover:bg-black/[0.04] cursor-pointer");

  return (
    <aside
      className={
        // Sits under the top strip, marked off by one slightly stronger rule.
        "fixed top-7 left-0 z-20 flex h-full w-60 flex-col " +
        "border-r border-black/15 " + (isHome ? "bg-transparent" : "bg-[#FBF3E4]")
      }
    >
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-4 pt-2">
        {NAV.map((sec) => {
          const Icon = sec.icon;
          if (!sec.children) {
            const locked = !can(sec.id);
            return (
              <button
                key={sec.id}
                disabled={locked}
                onClick={() => { setOpenId(null); onGo(sec.id); }}
                className={
                  locked
                    ? "w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] font-semibold uppercase tracking-wide text-neutral-300 cursor-not-allowed"
                    : sectionCls(route === sec.id)
                }
              >
                <Icon size={16} className="shrink-0" />
                <span className="flex-1 text-left">{sec.name}</span>
              </button>
            );
          }
          const isOpen = openId === sec.id;
          const parentActive = sec.children.some((c) => c.id === route);
          return (
            <div key={sec.id}>
              <button onClick={() => toggle(sec)} className={sectionCls(parentActive)}>
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
                    const locked = !can(ch.id);
                    return (
                      <button
                        key={ch.id}
                        disabled={locked}
                        title={locked ? "No access" : undefined}
                        onClick={() => { setOpenId(sec.id); onGo(ch.id); }}
                        className={subCls(route === ch.id, locked)}
                      >
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

// Top-right: who is signed in, plus the admin's "view as" preview picker.
function TopBar({ email, isRealAdmin, users, viewAs, onViewAs, onSignOut, onGo }) {
  const viewing = viewAs ? users.find((u) => u.id === viewAs) : null;
  const others = users.filter((u) => !u.isMe);

  return (
    // Secondary top strip: its own region above the page, for the account chip,
    // the admin preview picker and later things like alerts.
    <div className="fixed top-0 left-0 right-0 z-30 flex h-7 items-center gap-3 border-b border-black/15 bg-[#FBF3E4] pl-3 pr-6">
      {/* The mark lives far left up here, and it jumps to Planning. */}
      <button onClick={() => onGo("admin/planning")} title="Planning" aria-label="Planning" className="cursor-pointer">
        <img src={infinityImg} alt="FI" className="h-5 w-auto" />
      </button>
      <div className="flex-1" />
      <div className="group relative flex items-center">
        <button className="inline-flex items-center gap-1 text-[11px] text-neutral-500 transition-colors group-hover:text-neutral-800">
          {email}
          <ChevronDown size={12} />
        </button>
        <div className="absolute right-0 top-full z-30 hidden pt-1 group-hover:block">
          {/* No panel, just the words, right aligned under the title. */}
          <div className="flex flex-col items-end py-1 text-right">
            <button
              onClick={onSignOut}
              className="px-3 py-0.5 text-right text-[11px] text-neutral-600 transition-colors hover:text-neutral-900"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>

      {isRealAdmin && (
        <div className="group relative flex items-center">
          {/* Same plain chip as the email: no frame, same size and level. */}
          <button
            className={
              "inline-flex items-center gap-1 text-[11px] transition-colors " +
              (viewing ? "text-[#C1440E]" : "text-neutral-500 group-hover:text-neutral-800")
            }
          >
            {viewing ? `Viewing as ${viewing.email}` : "View as"}
            <ChevronDown size={12} />
          </button>
          <div className="absolute right-0 top-full z-30 hidden pt-1 group-hover:block">
            {/* Exactly the Sign out styling: same size, no underline, nothing else. */}
            <div className="flex max-h-72 flex-col items-end overflow-y-auto whitespace-nowrap py-1 text-right">
              <button
                onClick={() => onViewAs(null)}
                className="px-3 py-0.5 text-right text-[11px] text-neutral-600 no-underline transition-colors hover:text-neutral-900"
              >
                Me
              </button>
              {others.map((u) => (
                <button
                  key={u.id}
                  onClick={() => onViewAs(u.id)}
                  className="px-3 py-0.5 text-right text-[11px] text-neutral-600 no-underline transition-colors hover:text-neutral-900"
                >
                  {u.email}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Notice({ title, body, onSignOut }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FBF3E4] px-4">
      <div className="w-full max-w-sm rounded-xl border border-black/10 bg-white p-6 text-center shadow-sm">
        <div className="mb-3 text-[13px] font-black uppercase tracking-[0.15em] text-[#9c7c33]">Finestate</div>
        <p className="text-sm font-semibold text-neutral-800">{title}</p>
        <p className="mt-1 text-[12px] text-neutral-500">{body}</p>
        {onSignOut && (
          <button onClick={onSignOut} className="mt-4 text-[11px] font-semibold uppercase tracking-wide text-[#9c7c33] underline underline-offset-2 hover:opacity-70">
            Sign out
          </button>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [route, setRoute] = useState(readRoute);
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [profile, setProfile] = useState(null);
  const [profileReady, setProfileReady] = useState(false);
  const [allUsers, setAllUsers] = useState([]);
  // Admin preview: null means "me", otherwise the id of the person whose view to show.
  const [viewAs, setViewAs] = useState(() => { try { return localStorage.getItem(VIEW_AS_KEY) || null; } catch { return null; } });

  useEffect(() => {
    try { if (viewAs) localStorage.setItem(VIEW_AS_KEY, viewAs); else localStorage.removeItem(VIEW_AS_KEY); } catch {}
  }, [viewAs]);

  useEffect(() => {
    const onHash = () => setRoute(readRoute());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    if (!supabaseReady) { setAuthReady(true); return; }
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setAuthReady(true); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  // The signed-in person's own row: role, status and the pages they may open.
  useEffect(() => {
    if (!supabaseReady || !session) { setProfile(null); setProfileReady(!session); return; }
    setProfileReady(false);
    supabase
      .from("profiles")
      .select("id, email, full_name, role, status, access")
      .eq("id", session.user.id)
      .single()
      .then(({ data }) => { setProfile(data || null); setProfileReady(true); });
  }, [session]);

  // Everyone else, for the admin's "view as" list. RLS returns only this row for members.
  useEffect(() => {
    if (!profile || profile.role !== "admin") { setAllUsers([]); return; }
    supabase
      .from("profiles")
      .select("id, email, full_name, role, status, access")
      .order("created_at", { ascending: true })
      .then(({ data }) => setAllUsers(data || []));
  }, [profile]);

  const go = (r) => {
    setRoute(r);
    if (r === "home") history.replaceState(null, "", window.location.pathname);
    else window.location.hash = r;
  };

  const signOut = () => supabase.auth.signOut();

  if (!supabaseReady) {
    return <Notice title="Not configured yet" body="VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY are missing." />;
  }
  if (!authReady) return <div className="min-h-screen bg-[#FBF3E4]" />;
  if (!session) return <Auth />;
  if (!profileReady) return <div className="min-h-screen bg-[#FBF3E4]" />;
  if (!profile) {
    return <Notice title="No profile found" body="Your account exists but has no profile row yet." onSignOut={signOut} />;
  }
  if (profile.status !== "active") {
    return (
      <Notice
        title={profile.status === "blocked" ? "Access blocked" : "Waiting for approval"}
        body={profile.status === "blocked" ? "Ask the admin to restore your access." : "An admin has to approve your account before you can sign in."}
        onSignOut={signOut}
      />
    );
  }

  const realIsAdmin = profile.role === "admin";
  // While previewing, every access decision uses the other person's row instead of mine.
  const viewed = realIsAdmin && viewAs ? allUsers.find((u) => u.id === viewAs) : null;
  const eff = viewed || profile;
  const isAdmin = eff.role === "admin";
  const allowed = isAdmin ? ALL_PAGE_IDS : eff.access || [];
  const canSee = (id) => id === "home" || allowed.includes(id);

  return (
    <div className="relative min-h-screen bg-[#FBF3E4]">
      <Sidebar route={route} onGo={go} allowed={allowed} />
      <TopBar
        onGo={go}
        email={eff.email}
        isRealAdmin={realIsAdmin}
        users={allUsers.map((u) => ({ ...u, isMe: u.id === profile.id }))}
        viewAs={viewAs}
        onViewAs={setViewAs}
        onSignOut={signOut}
      />

      <main className="relative z-10 min-h-screen pl-[17rem] pr-8 pb-8 pt-10">
        {!canSee(route) ? (
          <p className="text-[12px] font-semibold uppercase tracking-wide text-neutral-400">
            You do not have access to this page.
          </p>
        ) : (
          <>
            {route === "admin/planning" && <Planning />}
            {route === "admin/legal-documents" && <LegalDocuments />}
            {route === "costs/monthly" && <Costs />}
            {route === "admin/site-running-costs" && <SiteRunningCosts />}
            {route === "admin/users" && isAdmin && <Logins myId={profile.id} />}
            {route === "investing/opportunities" && <Opportunities />}
            {route === "investing/ratios-calcs" && <Investing />}
          </>
        )}
      </main>
    </div>
  );
}
