import { useMemo, useRef, useEffect, useState } from "react";
import { addDays, startOfDay, dayKey, diffDays } from "../../lib/parse/dates";
import { useNotes } from "../../store/notes";
import { CalendarDays, Check, AlertCircle, Circle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "../../lib/cn";

interface DayBucket {
  date: Date;
  offset: number;          // days from today (negative = past)
  due: { noteId: string; title: string; raw: string; done: boolean; overdue: boolean }[];
  completed: number;
  pending: number;
  overdue: number;
}

export default function Timeline({ onOpenCalendar }: { onOpenCalendar: () => void }) {
  const notes = useNotes(s => s.notes);
  const today = startOfDay();
  const range = 21; // -7 .. +13
  const start = addDays(today, -7);

  const buckets: DayBucket[] = useMemo(() => {
    const map = new Map<string, DayBucket>();
    for (let i = 0; i < range; i++) {
      const d = addDays(start, i);
      map.set(dayKey(d), { date: d, offset: diffDays(d, today), due: [], completed: 0, pending: 0, overdue: 0 });
    }
    for (const n of Object.values(notes)) {
      for (const dt of n.dates) {
        const k = dayKey(dt.iso);
        const bucket = map.get(k);
        const overdue = !dt.done && new Date(dt.iso) < today;
        const target = bucket;
        if (!target) continue;
        target.due.push({ noteId: n.id, title: n.title, raw: dt.raw, done: !!dt.done, overdue });
        if (dt.done) target.completed++;
        else if (overdue) target.overdue++;
        else target.pending++;
      }
    }
    return [...map.values()].sort((a, b) => a.offset - b.offset);
  }, [notes]);

  const scrollerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const todayEl = el.querySelector<HTMLElement>('[data-today="1"]');
    if (todayEl) {
      el.scrollLeft = todayEl.offsetLeft - el.clientWidth / 2 + todayEl.clientWidth / 2;
    }
  }, []);

  return (
    <div className="panel p-3">
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="text-xs uppercase tracking-wider text-fg-subtle">Timeline</div>
        <button onClick={onOpenCalendar} className="icon-btn h-7 w-7" title="Open calendar">
          <CalendarDays size={14} />
        </button>
      </div>
      <div
        ref={scrollerRef}
        className="overflow-x-auto pb-1 select-none"
        style={{ scrollbarWidth: "thin" }}
      >
        <div className="relative h-24 min-w-max">
          <div className="absolute left-0 right-0 top-1/2 h-px bg-border" />
          <div className="flex items-center h-full">
            {buckets.map(b => (
              <DayDot key={b.offset} bucket={b} today={today} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function DayDot({ bucket }: { bucket: DayBucket; today: Date }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const isToday = bucket.offset === 0;
  const isPast = bucket.offset < 0;
  const total = bucket.due.length;
  const dotSize = total === 0 ? 6 : Math.min(20, 8 + total * 2);
  const color = bucket.overdue > 0
    ? "bg-danger"
    : bucket.completed === total && total > 0
      ? "bg-success"
      : total > 0
        ? "bg-accent"
        : "bg-border";

  return (
    <div
      className="relative flex flex-col items-center justify-center w-14 h-full"
      data-today={isToday ? "1" : undefined}
      onMouseEnter={() => total > 0 && setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <div className={cn("text-[10px] mb-1", isToday ? "text-accent font-medium" : "text-fg-subtle")}>
        {isToday ? "TODAY" : bucket.date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
      </div>
      <button
        className={cn("rounded-full transition-transform", color, isPast && total === 0 && "opacity-40", "hover:scale-125")}
        style={{ width: dotSize, height: dotSize }}
        onClick={() => total > 0 && navigate(`/notes/${bucket.due[0].noteId}`)}
      />
      <div className={cn("text-[10px] mt-1 h-3", total > 0 ? "text-fg-muted" : "text-transparent")}>
        {total > 0 ? `${total}` : "."}
      </div>
      {open && (
        <div className="absolute z-30 top-full mt-1 w-60 panel p-2 shadow-soft animate-fade-in">
          <div className="text-xs text-fg-subtle mb-1">
            {bucket.date.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}
            {isToday && " · today"}
          </div>
          <div className="flex gap-2 text-xs mb-2">
            {bucket.overdue > 0 && <span className="pill bg-danger/10 text-danger"><AlertCircle size={10} /> {bucket.overdue}</span>}
            {bucket.pending > 0 && <span className="pill bg-accent-muted text-accent"><Circle size={10} /> {bucket.pending}</span>}
            {bucket.completed > 0 && <span className="pill bg-success/10 text-success"><Check size={10} /> {bucket.completed}</span>}
          </div>
          <div className="space-y-1 max-h-40 overflow-auto">
            {bucket.due.slice(0, 6).map((d, i) => (
              <button
                key={i}
                onClick={() => navigate(`/notes/${d.noteId}`)}
                className="w-full text-left text-xs hover:bg-bg-panel rounded p-1 truncate"
              >
                <span className={cn(d.done && "line-through opacity-60", d.overdue && "text-danger")}>
                  {d.title} <span className="text-fg-subtle">· {d.raw}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
