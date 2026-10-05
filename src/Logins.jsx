import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { supabase } from "./lib/supabaseClient.js";
import { PAGES } from "./pages.js";

// Admin-only console: who can sign in, what role they hold and which pages they may open.
const BAR_BG = "#F2C46D"; // same ramp as the Costs table: darkest gold on the title bar

// One size, one line height across the whole table – same as the Planning page.
const cell = "px-2 py-0 text-[11px] leading-[15px] text-neutral-900";
const head = "text-[11px] font-bold uppercase leading-[15px] tracking-[0.06em] text-neutral-900";
// Five columns of equal width, so the table reads as a grid.
// Five equal columns on one grid, headings and rows alike, so every value starts exactly
// under its heading. The dropdowns carry no frame, so their words line up too.
const grid = "grid grid-cols-5 items-center gap-2 px-2";
const col = "min-w-0";
const select =
  "w-full cursor-pointer appearance-none bg-transparent p-0 pr-4 text-[11px] leading-[15px] text-neutral-900 outline-none disabled:cursor-default disabled:opacity-40";

// A plain dropdown with a small chevron at its right, so it still reads as one.
function Pick({ children, ...props }) {
  return (
    <span className="relative min-w-0">
      <select {...props} className={select}>{children}</select>
      <ChevronDown size={11} className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-neutral-900" />
    </span>
  );
}

export default function Logins({ myId }) {
  const [users, setUsers] = useState([]);
  // Whose page list is open, and where it drops from on screen.
  const [open, setOpen] = useState(null); // { id, left, top, width }
  const [err, setErr] = useState("");

  const load = () =>
    supabase
      .from("profiles")
      .select("id, email, full_name, role, status, access, created_at")
      .order("created_at", { ascending: true })
      .then(({ data, error }) => {
        if (error) setErr(error.message);
        else setUsers(data || []);
      });

  useEffect(() => { load(); }, []);

  // A click anywhere else, or a scroll, closes the page list.
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(null);
    window.addEventListener("mousedown", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [open]);

  const patch = (id, fields) => {
    setUsers((list) => list.map((u) => (u.id === id ? { ...u, ...fields } : u)));
    supabase.from("profiles").update(fields).eq("id", id).then(({ error }) => {
      if (error) setErr(error.message);
    });
  };

  const toggleAccess = (u, pageId) => {
    const has = (u.access || []).includes(pageId);
    const next = has ? u.access.filter((p) => p !== pageId) : [...(u.access || []), pageId];
    patch(u.id, { access: next });
  };

  const openUser = open && users.find((u) => u.id === open.id);
  const hasPage = (u, id) => u.role === "admin" || (u.access || []).includes(id);

  return (
    // Narrow windows scroll the table sideways rather than squashing the columns.
    <div className="w-full overflow-x-auto">
      <div className="w-full min-w-[640px] border border-black shadow-sm overflow-hidden bg-white">
        <div className={`${grid} h-[18px] border-b border-black`} style={{ backgroundColor: BAR_BG }}>
          <span className={`${col} ${head}`}>Name</span>
          <span className={`${col} ${head}`}>Email</span>
          <span className={`${col} ${head}`}>Role</span>
          <span className={`${col} ${head}`}>Status</span>
          <span className={`${col} ${head}`}>Pages</span>
        </div>

        {err && <p className="px-2 py-0.5 text-[11px] font-semibold leading-[15px] text-[#b91c1c]">{err}</p>}

        {users.map((u, i) => {
          const count = PAGES.filter((p) => hasPage(u, p.id)).length;
          return (
            <div key={u.id} className={`${grid} h-[21px] ${i === 0 ? "" : "border-t border-black"}`}>
              <span className={`${col} truncate text-[11px] leading-[15px] text-neutral-900`}>{u.full_name || "–"}</span>
              <span className={`${col} truncate text-[11px] leading-[15px] text-neutral-900`}>{u.email}</span>

              <Pick
                value={u.role}
                disabled={u.id === myId}
                title={u.id === myId ? "You cannot change your own role" : "Set role"}
                onChange={(e) => patch(u.id, { role: e.target.value })}
              >
                <option value="admin">Admin</option>
                <option value="member">Member</option>
              </Pick>

              <Pick
                value={u.status}
                disabled={u.id === myId}
                onChange={(e) => patch(u.id, { status: e.target.value })}
              >
                <option value="active">Active</option>
                <option value="blocked">Blocked</option>
                <option value="pending">Pending</option>
              </Pick>

              {/* A small list drops from here, not the whole row. */}
              <button
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  if (open?.id === u.id) { setOpen(null); return; }
                  const b = e.currentTarget.getBoundingClientRect();
                  setOpen({ id: u.id, left: b.left, top: b.bottom + 2, width: b.width });
                }}
                className="flex min-w-0 cursor-pointer items-center justify-between bg-transparent p-0 text-left text-[11px] leading-[15px] text-neutral-900 outline-none"
              >
                <span>{count === PAGES.length ? "All pages" : `${count} of ${PAGES.length}`}</span>
                <ChevronDown size={11} />
              </button>
            </div>
          );
        })}

        {users.length === 0 && !err && (
          <p className={`${cell} italic text-neutral-400`}>Nobody has signed up yet.</p>
        )}
      </div>

      {/* Every page in the sidebar, ticked where this person has access. Admins open
          every page, so theirs are all ticked and fixed. */}
      {openUser && (
        <div
          onMouseDown={(e) => e.stopPropagation()}
          className="fixed z-50 border border-black bg-white px-2 py-1 shadow-md"
          style={{ left: open.left, top: open.top, minWidth: Math.max(open.width, 200) }}
        >
          {PAGES.map((p) => (
            <label key={p.id} className="flex h-[17px] cursor-pointer items-center gap-2 whitespace-nowrap text-[11px] leading-[15px] text-neutral-900">
              <input
                type="checkbox"
                checked={hasPage(openUser, p.id)}
                disabled={openUser.role === "admin"}
                onChange={() => toggleAccess(openUser, p.id)}
                className="h-3 w-3 accent-[#9c7c33]"
              />
              {p.label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
