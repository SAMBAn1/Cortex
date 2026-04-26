import { useMemo, useState } from "react";
import { useNotes } from "../store/notes";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { cn } from "../lib/cn";
import { dayKey, startOfDay } from "../lib/parse/dates";
import { useNavigate } from "react-router-dom";

export default function CalendarPage() {
  const notes = useNotes(s => s.notes);
  const navigate = useNavigate();
  const [cursor, setCursor] = useState(() => {
    const t = new Date();
    return new Date(t.getFullYear(), t.getMonth(), 1);
  });

  const dueByDay = useMemo(() => {
    const map = new Map<string, { noteId: string; title: string; raw: string; done: boolean }[]>();
    for (const n of Object.values(notes)) {
      for (const d of n.dates) {
        const k = dayKey(d.iso);
        if (!map.has(k)) map.set(k, []);
        map.get(k)!.push({ noteId: n.id, title: n.title, raw: d.raw, done: !!d.done });
      }
    }
    return map;
  }, [notes]);

  const today = startOfDay();
  const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const startDay = monthStart.getDay();
  const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(cursor.getFullYear(), cursor.getMonth(), d));
  while (cells.length % 7 !== 0) cells.push(null);

  const [selected, setSelected] = useState<Date>(today);
  const selectedItems = dueByDay.get(dayKey(selected)) ?? [];

  return (
    <div className="h-full p-4 flex gap-4 overflow-hidden">
      <div className="panel flex-1 p-4 flex flex-col min-h-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <CalendarDays size={16} className="text-accent" />
            <div className="text-base font-medium">{cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setCursor(c => new Date(c.getFullYear(), c.getMonth() - 1, 1))} className="icon-btn h-8 w-8"><ChevronLeft size={16} /></button>
            <button onClick={() => { const t = new Date(); setCursor(new Date(t.getFullYear(), t.getMonth(), 1)); setSelected(today); }} className="text-xs px-3 py-1.5 rounded-md hover:bg-bg-panel">Today</button>
            <button onClick={() => setCursor(c => new Date(c.getFullYear(), c.getMonth() + 1, 1))} className="icon-btn h-8 w-8"><ChevronRight size={16} /></button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1 text-[10px] uppercase text-fg-subtle mb-1 px-1">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => <div key={d} className="text-center">{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1 flex-1 min-h-0">
          {cells.map((d, i) => {
            if (!d) return <div key={i} />;
            const items = dueByDay.get(dayKey(d)) ?? [];
            const isToday = dayKey(d) === dayKey(today);
            const isSelected = dayKey(d) === dayKey(selected);
            const overdue = items.some(x => !x.done && d < today);
            return (
              <button
                key={i}
                onClick={() => setSelected(d)}
                className={cn(
                  "rounded-lg p-1.5 text-left flex flex-col gap-1 border transition-colors min-h-[64px]",
                  isSelected ? "border-accent bg-accent-muted/30" : "border-transparent hover:border-border bg-bg-panel/40",
                )}
              >
                <div className={cn("text-xs", isToday ? "text-accent font-medium" : "text-fg-muted")}>{d.getDate()}</div>
                <div className="flex flex-wrap gap-0.5">
                  {items.slice(0, 3).map((it, j) => (
                    <span key={j} className={cn("h-1.5 w-1.5 rounded-full", it.done ? "bg-success" : overdue ? "bg-danger" : "bg-accent")} />
                  ))}
                  {items.length > 3 && <span className="text-[10px] text-fg-subtle">+{items.length - 3}</span>}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <aside className="w-80 panel p-3 overflow-auto">
        <div className="text-xs uppercase tracking-wider text-fg-subtle mb-2">
          {selected.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}
        </div>
        {selectedItems.length === 0 && <div className="text-sm text-fg-muted p-2">Nothing scheduled.</div>}
        <div className="space-y-1">
          {selectedItems.map((it, i) => (
            <button
              key={i}
              onClick={() => navigate(`/notes/${it.noteId}`)}
              className="w-full text-left p-2 rounded-md hover:bg-bg-panel text-sm"
            >
              <div className={cn("text-fg", it.done && "line-through opacity-60")}>{it.title}</div>
              <div className="text-[11px] text-fg-subtle">{it.raw}</div>
            </button>
          ))}
        </div>
      </aside>
    </div>
  );
}
