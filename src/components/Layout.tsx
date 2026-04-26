import { NavLink, Outlet } from "react-router-dom";
import { LayoutDashboard, FileText, CalendarDays, Network, Settings, Plus } from "lucide-react";
import { cn } from "../lib/cn";
import { useNotes } from "../store/notes";
import { useNavigate } from "react-router-dom";

const NAV = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard", end: true },
  { to: "/notes", icon: FileText, label: "Notes" },
  { to: "/calendar", icon: CalendarDays, label: "Calendar" },
  { to: "/graph", icon: Network, label: "Graph" },
];

export default function Layout() {
  const create = useNotes(s => s.create);
  const navigate = useNavigate();

  async function quickNew() {
    const n = await create({ body: "" });
    navigate(`/notes/${n.id}`);
  }

  return (
    <div className="flex h-full w-full">
      <aside className="w-14 shrink-0 border-r border-border bg-bg-panel flex flex-col items-center py-3 gap-1">
        <div className="w-9 h-9 rounded-lg bg-accent text-white flex items-center justify-center font-bold mb-2 shadow-soft">C</div>
        {NAV.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            title={item.label}
            className={({ isActive }) => cn("icon-btn", isActive && "icon-btn-active")}
          >
            <item.icon size={18} />
          </NavLink>
        ))}
        <div className="flex-1" />
        <button onClick={quickNew} title="New note" className="icon-btn text-accent hover:bg-accent-muted">
          <Plus size={18} />
        </button>
        <NavLink to="/settings" title="Settings" className={({ isActive }) => cn("icon-btn", isActive && "icon-btn-active")}>
          <Settings size={18} />
        </NavLink>
      </aside>
      <main className="flex-1 min-w-0 overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}
