import { useEffect, useState } from "react";
import { supabase } from "./lib/supabaseClient.js";
import { PAGES } from "./pages.js";

// Admin-only console: who can sign in, what role they hold and which pages they may open.
const BAR_BG = "#F2C46D"; // same ramp as the Costs table: darkest gold on the title bar
const HEADER_BG = "#FCEFCF";

// One size, one line height across the whole table – same as the Planning page.
const cell = "px-2 py-0 text-[11px] leading-[15px] text-neutral-900";
const head = "text-[11px] font-bold uppercase leading-[15px] tracking-[0.06em] text-neutral-900";
// Four columns of equal width, so the table reads as a grid.
const col = "min-w-0 flex-1 basis-0";
const select =
  "rounded border border-neutral-300 bg-white px-1.5 py-0 text-[11px] leading-[15px] text-neutral-900 outline-none focus:border-neutral-500 disabled:opacity-40";

export default function Logins({ myId }) {
  const [users, setUsers] = useState([]);
  const [openId, setOpenId] = useState(null); // whose access list is expanded
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

  return (
    <div className="w-full">
      <div className="w-full border border-black shadow-sm overflow-hidden bg-white">
        <div className="flex h-[18px] items-center gap-2 border-b border-black px-2" style={{ backgroundColor: BAR_BG }}>
          <span className={`${col} ${head}`}>Name</span>
          <span className={`${col} ${head}`}>Role</span>
          <span className={`${col} ${head}`}>Status</span>
          <span className={`${col} ${head}`}>Pages</span>
        </div>

        {err && <p className="px-2 py-0.5 text-[11px] font-semibold leading-[15px] text-[#b91c1c]">{err}</p>}

        {users.map((u, i) => (
          <div key={u.id} className={i === 0 ? "" : "border-t border-black"}>
            <div className="flex h-[21px] items-center gap-2 px-2">
              <span className={`${col} truncate text-[11px] leading-[15px] text-neutral-900`}>
                {u.full_name || "—"} <span className="text-neutral-500">{u.email}</span>
              </span>

              <select
                value={u.role}
                disabled={u.id === myId}
                title={u.id === myId ? "You cannot change your own role" : "Set role"}
                onChange={(e) => patch(u.id, { role: e.target.value })}
                className={`${col} ${select}`}
              >
                <option value="admin">Admin</option>
                <option value="member">Member</option>
              </select>

              <select
                value={u.status}
                disabled={u.id === myId}
                onChange={(e) => patch(u.id, { status: e.target.value })}
                className={`${col} ${select}`}
              >
                <option value="active">Active</option>
                <option value="blocked">Blocked</option>
                <option value="pending">Pending</option>
              </select>

              <button
                onClick={() => setOpenId(openId === u.id ? null : u.id)}
                className={`${col} text-left text-[11px] font-bold uppercase leading-[15px] tracking-wide text-[#9c7c33] underline underline-offset-2 hover:opacity-70`}
              >
                {u.role === "admin" ? "All" : "Edit"}
              </button>
            </div>

            {openId === u.id && (
              <div className="border-t border-black bg-neutral-50 px-2 py-1">
                {u.role === "admin" ? (
                  <p className="text-[11px] leading-[15px] text-neutral-600">Admins can open every page.</p>
                ) : (
                  <div className="flex flex-col gap-0">
                    {PAGES.map((p) => (
                      <label key={p.id} className="flex h-[17px] cursor-pointer items-center gap-2 text-[11px] leading-[15px] text-neutral-900">
                        <input
                          type="checkbox"
                          checked={(u.access || []).includes(p.id)}
                          onChange={() => toggleAccess(u, p.id)}
                          className="h-3 w-3 accent-[#9c7c33]"
                        />
                        {p.label}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {users.length === 0 && !err && (
          <p className={`${cell} italic text-neutral-400`}>Nobody has signed up yet.</p>
        )}
      </div>
    </div>
  );
}
