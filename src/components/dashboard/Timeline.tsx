import { useMemo, useRef, useEffect, useState, useCallback } from "react";
import { flushSync } from "react-dom";
import { addDays, startOfDay, dayKey } from "../../lib/parse/dates";
import { useNotes } from "../../store/notes";
import { CalendarDays, Check, AlertCircle, Circle, ZoomIn, ZoomOut, LocateFixed } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "../../lib/cn";

/** Wrap a state update in a View Transition for an automatic crossfade animation. */
function withTransition(update: () => void) {
  const doc = document as any;
  if (typeof doc.startViewTransition === "function") {
    doc.startViewTransition(() => flushSync(update));
  } else {
    update();
  }
}

/**
 * Multi-level timeline. Zoom levels switch the time scale (not just cell size):
 *   0: days (1 cell = 1 day)
 *   1: weeks (1 cell = 7 days)
 *   2: months (1 cell = 1 month)
 *   3: quarters (1 cell = 3 months)
 *   4: years (1 cell = 1 year)
 *
 * At every level we still show counts on each cell — aggregated from the underlying days.
 */

type Scale = "day" | "week" | "month" | "quarter" | "year";

interface ScaleSpec {
  scale: Scale;
  cellW: number;
  pastCells: number;     // how many cells before "today" / "this period"
  futureCells: number;
  formatLabel: (d: Date, isCurrent: boolean) => string;
  /** Get the canonical start of the period containing d. */
  periodStart: (d: Date) => Date;
  /** Step back/forward N periods. */
  step: (d: Date, n: number) => Date;
}

const SCALES: ScaleSpec[] = [
  {
    // Day: small initial range; expands infinitely as user scrolls toward either edge.
    scale: "day", cellW: 56, pastCells: 60, futureCells: 60,
    formatLabel: (d, cur) => cur ? "TODAY" : d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    periodStart: (d) => startOfDay(d),
    step: (d, n) => addDays(d, n),
  },
  {
    // Week: ±5 years
    scale: "week", cellW: 64, pastCells: 260, futureCells: 260,
    formatLabel: (d, cur) => cur ? "THIS WK" : d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    periodStart: (d) => {
      const x = startOfDay(d); x.setDate(x.getDate() - x.getDay()); return x;
    },
    step: (d, n) => addDays(d, n * 7),
  },
  {
    // Month: ±5 years
    scale: "month", cellW: 72, pastCells: 60, futureCells: 60,
    formatLabel: (d, cur) => cur ? "THIS MO" : d.toLocaleDateString(undefined, { month: "short", year: "2-digit" }),
    periodStart: (d) => new Date(d.getFullYear(), d.getMonth(), 1),
    step: (d, n) => new Date(d.getFullYear(), d.getMonth() + n, 1),
  },
  {
    // Quarter: ±5 years
    scale: "quarter", cellW: 80, pastCells: 20, futureCells: 20,
    formatLabel: (d, cur) => {
      const q = Math.floor(d.getMonth() / 3) + 1;
      const yr = String(d.getFullYear()).slice(-2);
      return cur ? `THIS Q` : `Q${q} '${yr}`;
    },
    periodStart: (d) => new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1),
    step: (d, n) => new Date(d.getFullYear(), d.getMonth() + n * 3, 1),
  },
  {
    // Year: ±25 years (so the line fills out comfortably; covers a working career)
    scale: "year", cellW: 80, pastCells: 25, futureCells: 25,
    formatLabel: (d, cur) => cur ? "THIS YR" : String(d.getFullYear()),
    periodStart: (d) => new Date(d.getFullYear(), 0, 1),
    step: (d, n) => new Date(d.getFullYear() + n, 0, 1),
  },
];

interface DueItem { noteId: string; title: string; raw: string; done: boolean; overdue: boolean; date: Date; }
interface Bucket {
  start: Date; end: Date;
  isCurrent: boolean;
  due: DueItem[];
  completed: number; pending: number; overdue: number;
}

const EXTEND_BY = 60;       // cells to add when reaching an edge (day mode only)
const EDGE_THRESHOLD = 400; // px from edge that triggers an extend

export default function Timeline({ onOpenCalendar }: { onOpenCalendar: () => void }) {
  const notes = useNotes(s => s.notes);
  const today = startOfDay();
  const [zoom, setZoom] = useState(0); // 0 = day
  const spec = SCALES[zoom];
  // Per-scale extension counters for infinite scroll. Reset when zoom changes.
  const [extPast, setExtPast] = useState(0);
  const [extFuture, setExtFuture] = useState(0);
  useEffect(() => { setExtPast(0); setExtFuture(0); }, [zoom]);

  const totalPast = spec.pastCells + (spec.scale === "day" ? extPast : 0);
  const totalFuture = spec.futureCells + (spec.scale === "day" ? extFuture : 0);

  // Pre-compute every dated item once; we'll group into buckets per scale.
  const allItems = useMemo<DueItem[]>(() => {
    const out: DueItem[] = [];
    for (const n of Object.values(notes)) {
      for (const dt of n.dates) {
        const date = new Date(dt.iso);
        out.push({
          noteId: n.id, title: n.title, raw: dt.raw,
          done: !!dt.done, overdue: !dt.done && date < today, date,
        });
      }
    }
    return out;
  }, [notes]);

  const buckets: Bucket[] = useMemo(() => {
    const currentStart = spec.periodStart(today);
    const result: Bucket[] = [];
    for (let i = -totalPast; i <= totalFuture; i++) {
      const start = spec.step(currentStart, i);
      const end = spec.step(start, 1);
      result.push({
        start, end,
        isCurrent: i === 0,
        due: [], completed: 0, pending: 0, overdue: 0,
      });
    }
    // Bucketing pass: O(items + buckets) via period-start key lookup.
    const keyByStart = new Map<number, Bucket>();
    for (const b of result) keyByStart.set(b.start.getTime(), b);
    for (const it of allItems) {
      const bucketStart = spec.periodStart(it.date).getTime();
      const bucket = keyByStart.get(bucketStart);
      if (!bucket) continue;
      bucket.due.push(it);
      if (it.done) bucket.completed++;
      else if (it.overdue) bucket.overdue++;
      else bucket.pending++;
    }
    return result;
  }, [allItems, spec, today, totalPast, totalFuture]);

  const scrollerRef = useRef<HTMLDivElement>(null);

  const centerCurrent = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const cur = el.querySelector<HTMLElement>('[data-current="1"]');
    if (cur) el.scrollTo({ left: cur.offsetLeft - el.clientWidth / 2 + cur.clientWidth / 2, behavior: "smooth" });
  }, []);

  useEffect(() => { centerCurrent(); }, [zoom, centerCurrent]);

  // Wheel: vertical scroll → horizontal
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

  // Day-mode infinite scroll: when the user nears either edge, extend the range.
  // We compensate scrollLeft when prepending so the visible content doesn't jump.
  useEffect(() => {
    if (spec.scale !== "day") return;
    const el = scrollerRef.current;
    if (!el) return;
    const onScroll = () => {
      const fromLeft = el.scrollLeft;
      const fromRight = el.scrollWidth - el.clientWidth - el.scrollLeft;
      if (fromLeft < EDGE_THRESHOLD) {
        const prevWidth = el.scrollWidth;
        setExtPast(p => p + EXTEND_BY);
        // After React commits more cells on the left, restore visual position.
        requestAnimationFrame(() => {
          if (!scrollerRef.current) return;
          const delta = scrollerRef.current.scrollWidth - prevWidth;
          scrollerRef.current.scrollLeft += delta;
        });
      } else if (fromRight < EDGE_THRESHOLD) {
        setExtFuture(f => f + EXTEND_BY);
      }
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [spec.scale]);

  return (
    <div className="panel p-3">
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="flex items-center gap-2">
          <div className="text-xs uppercase tracking-wider text-fg-subtle">Timeline</div>
          <div className="text-[10px] uppercase tracking-wider text-accent bg-accent-muted/40 px-1.5 py-0.5 rounded">
            {spec.scale}
          </div>
        </div>
        <div className="flex items-center gap-0.5">
          <button onClick={() => withTransition(() => setZoom(Math.max(0, zoom - 1)))} disabled={zoom === 0} className="icon-btn h-7 w-7" title="Zoom in (smaller scale)"><ZoomIn size={13} /></button>
          <button onClick={() => withTransition(() => setZoom(Math.min(SCALES.length - 1, zoom + 1)))} disabled={zoom === SCALES.length - 1} className="icon-btn h-7 w-7" title="Zoom out (larger scale)"><ZoomOut size={13} /></button>
          <button onClick={centerCurrent} className="icon-btn h-7 w-7" title="Center on today"><LocateFixed size={13} /></button>
          <button onClick={onOpenCalendar} className="icon-btn h-7 w-7" title="Open calendar"><CalendarDays size={13} /></button>
        </div>
      </div>
      <div ref={scrollerRef} className="overflow-x-auto pb-1 select-none cursor-grab active:cursor-grabbing">
        <div className="relative h-24 min-w-max" style={{ viewTransitionName: "timeline-rail" } as React.CSSProperties}>
          <div className="absolute left-0 right-0 top-1/2 h-px bg-border" />
          <div key={spec.scale} className="flex items-center h-full timeline-rail-fade">
            {buckets.map((b) => (
              <BucketDot key={`${spec.scale}-${b.start.getTime()}`} bucket={b} cellW={spec.cellW} formatLabel={spec.formatLabel} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function BucketDot({ bucket, cellW, formatLabel }: {
  bucket: Bucket; cellW: number; formatLabel: ScaleSpec["formatLabel"];
}) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const total = bucket.due.length;
  const isPast = bucket.end <= startOfDay();
  const dotSize = total === 0 ? 6 : Math.min(28, 8 + Math.sqrt(total) * 4);
  const color = bucket.overdue > 0
    ? "bg-danger"
    : bucket.completed === total && total > 0
      ? "bg-success"
      : total > 0
        ? "bg-accent"
        : "bg-border";

  return (
    <div
      className="relative flex flex-col items-center justify-center h-full"
      style={{ width: cellW, minWidth: cellW }}
      data-current={bucket.isCurrent ? "1" : undefined}
      onMouseEnter={() => total > 0 && setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <div className={cn("text-[10px] mb-1 h-3", bucket.isCurrent ? "text-accent font-medium" : "text-fg-subtle")}>
        {formatLabel(bucket.start, bucket.isCurrent)}
      </div>
      <button
        className={cn("rounded-full transition-transform relative flex items-center justify-center", color, isPast && total === 0 && "opacity-30", "hover:scale-125")}
        style={{ width: dotSize, height: dotSize }}
        onClick={() => total > 0 && navigate(`/notes/${bucket.due[0].noteId}`)}
      >
        {/* Always show the count INSIDE/under the dot when ≥1 item — no hover required */}
      </button>
      <div className={cn("text-[10px] mt-1 h-3 font-medium", total > 0 ? "text-fg-muted" : "text-transparent")}>
        {total > 0 ? `${total}` : "."}
      </div>
      {open && total > 0 && (
        <div className="absolute z-30 top-full mt-1 w-64 panel p-2 shadow-soft animate-fade-in">
          <div className="text-xs text-fg-subtle mb-1">
            {bucket.start.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}
            {bucket.isCurrent && " · now"}
          </div>
          <div className="flex gap-2 text-xs mb-2">
            {bucket.overdue > 0 && <span className="pill bg-danger/10 text-danger"><AlertCircle size={10} /> {bucket.overdue}</span>}
            {bucket.pending > 0 && <span className="pill bg-accent-muted text-accent"><Circle size={10} /> {bucket.pending}</span>}
            {bucket.completed > 0 && <span className="pill bg-success/10 text-success"><Check size={10} /> {bucket.completed}</span>}
          </div>
          <div className="space-y-1 max-h-44 overflow-auto">
            {bucket.due.slice(0, 8).map((d, i) => (
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
            {bucket.due.length > 8 && (
              <div className="text-[10px] text-fg-subtle p-1">+{bucket.due.length - 8} more</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// dayKey re-export not needed but keep imports clean
void dayKey;
