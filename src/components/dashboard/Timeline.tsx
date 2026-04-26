import { useMemo, useRef, useEffect, useState, useCallback } from "react";
import { addDays, startOfDay, dayKey, diffDays } from "../../lib/parse/dates";
import { useNotes } from "../../store/notes";
import { CalendarDays, Check, AlertCircle, Circle, ZoomIn, ZoomOut, LocateFixed } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "../../lib/cn";

interface DayBucket {
  date: Date;
  offset: number;
  due: { noteId: string; title: string; raw: string; done: boolean; overdue: boolean }[];
  completed: number;
  pending: number;
  overdue: number;
}

const ZOOM_LEVELS = [32, 44, 56, 72, 96];
const RANGE = 61;     // ~2 months centered on today
const PAST = 30;

export default function Timeline({ onOpenCalendar }: { onOpenCalendar: () => void }) {
  const notes = useNotes(s => s.notes);
  const today = startOfDay();
  const start = addDays(today, -PAST);
  const [zoom, setZoom] = useState(2);
  const cellW = ZOOM_LEVELS[zoom];

  const buckets: DayBucket[] = useMemo(() => {
    const map = new Map<string, DayBucket>();
    for (let i = 0; i < RANGE; i++) {
      const d = addDays(start, i);
      map.set(dayKey(d), { date: d, offset: diffDays(d, today), due: [], completed: 0, pending: 0, overdue: 0 });
    }
    for (const n of Object.values(notes)) {
      for (const dt of n.dates) {
        const k = dayKey(dt.iso);
        const target = map.get(k);
        const overdue = !dt.done && new Date(dt.iso) < today;
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

  const centerToday = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const todayEl = el.querySelector<HTMLElement>('[data-today="1"]');
    if (todayEl) {
      el.scrollTo({ left: todayEl.offsetLeft - el.clientWidth / 2 + todayEl.clientWidth / 2, behavior: "smooth" });
    }
  }, []);

  useEffect(() => { centerToday(); }, [zoom, centerToday]);

  // Wheel: convert vertical scroll to horizontal
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (e.deltaY !== 0 && Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        el.scrollLeft += e.deltaY;
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  return (
    <div className="panel p-3">
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="text-xs uppercase tracking-wider text-fg-subtle">Timeline</div>
        <div className="flex items-center gap-0.5">
          <button onClick={() => setZoom(z => Math.max(0, z - 1))} disabled={zoom === 0} className="icon-btn h-7 w-7" title="Zoom out"><ZoomOut size={13} /></button>
          <button onClick={() => setZoom(z => Math.min(ZOOM_LEVELS.length - 1, z + 1))} disabled={zoom === ZOOM_LEVELS.length - 1} className="icon-btn h-7 w-7" title="Zoom in"><ZoomIn size={13} /></button>
          <button onClick={centerToday} className="icon-btn h-7 w-7" title="Center on today"><LocateFixed size={13} /></button>
          <button onClick={onOpenCalendar} className="icon-btn h-7 w-7" title="Open calendar"><CalendarDays size={13} /></button>
        </div>
      </div>
      <div
        ref={scrollerRef}
        className="overflow-x-auto pb-1 select-none cursor-grab active:cursor-grabbing"
        style={{ scrollbarWidth: "thin" }}
      >
        <div className="relative h-24 min-w-max">
          <div className="absolute left-0 right-0 top-1/2 h-px bg-border" />
          <div className="flex items-center h-full">
            {buckets.map(b => (
              <DayDot key={b.offset} bucket={b} cellW={cellW} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function DayDot({ bucket, cellW }: { bucket: DayBucket; cellW: number }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const isToday = bucket.offset === 0;
  const isPast = bucket.offset < 0;
  const total = bucket.due.length;
  const dotSize = total === 0 ? Math.max(4, Math.round(cellW * 0.13)) : Math.min(28, Math.round(cellW * 0.18) + total * 2);
  const color = bucket.overdue > 0
    ? "bg-danger"
    : bucket.completed === total && total > 0
      ? "bg-success"
      : total > 0
        ? "bg-accent"
        : "bg-border";

  const showLabel = cellW >= 44 || isToday || bucket.date.getDate() === 1;
  const showCount = cellW >= 56;

  return (
    <div
      className="relative flex flex-col items-center justify-center h-full"
      style={{ width: cellW, minWidth: cellW }}
      data-today={isToday ? "1" : undefined}
      onMouseEnter={() => total > 0 && setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <div className={cn("text-[10px] mb-1 h-3", isToday ? "text-accent font-medium" : "text-fg-subtle", !showLabel && "opacity-0")}>
        {isToday ? "TODAY" : bucket.date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
      </div>
      <button
        className={cn("rounded-full transition-transform", color, isPast && total === 0 && "opacity-30", "hover:scale-125")}
        style={{ width: dotSize, height: dotSize }}
        onClick={() => total > 0 && navigate(`/notes/${bucket.due[0].noteId}`)}
      />
      <div className={cn("text-[10px] mt-1 h-3", total > 0 && showCount ? "text-fg-muted" : "text-transparent")}>
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
