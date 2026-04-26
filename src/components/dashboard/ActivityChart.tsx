import { useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { useNotes } from "../../store/notes";
import { addDays, dayKey, startOfDay } from "../../lib/parse/dates";
import { cn } from "../../lib/cn";

type Mode = "due" | "written";

export default function ActivityChart() {
  const notes = useNotes(s => s.notes);
  const [mode, setMode] = useState<Mode>("due");

  const data = useMemo(() => {
    const today = startOfDay();
    const days: { label: string; key: string; date: Date; count: number; isToday: boolean; overdue?: number }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = addDays(today, i);
      days.push({
        label: i === 0 ? "Today" : d.toLocaleDateString(undefined, { weekday: "short" }),
        key: dayKey(d),
        date: d,
        count: 0,
        isToday: i === 0,
      });
    }

    if (mode === "due") {
      // overdue gets rolled into today
      let overdueIntoToday = 0;
      for (const n of Object.values(notes)) {
        for (const dt of n.dates) {
          if (dt.done) continue;
          const d = new Date(dt.iso);
          const k = dayKey(d);
          const bucket = days.find(x => x.key === k);
          if (bucket) bucket.count++;
          else if (d < today) overdueIntoToday++;
        }
      }
      days[0].overdue = overdueIntoToday;
      days[0].count += overdueIntoToday;
    } else {
      // notes WRITTEN — show last 7 days INCLUDING today, looking backward
      const last7 = Array.from({ length: 7 }, (_, i) => {
        const d = addDays(today, -i);
        return {
          label: i === 0 ? "Today" : d.toLocaleDateString(undefined, { weekday: "short" }),
          key: dayKey(d),
          date: d,
          count: 0,
          isToday: i === 0,
        };
      }).reverse();
      for (const n of Object.values(notes)) {
        const k = dayKey(new Date(n.createdAt));
        const b = last7.find(x => x.key === k);
        if (b) b.count++;
      }
      return last7;
    }
    return days;
  }, [notes, mode]);

  return (
    <div className="panel p-3 h-full flex flex-col">
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="text-xs uppercase tracking-wider text-fg-subtle">
          {mode === "due" ? "Tasks · next 6 days" : "Notes · last 7 days"}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setMode("due")}
            className={cn("text-[11px] px-2 py-0.5 rounded-md", mode === "due" ? "bg-accent-muted text-accent" : "text-fg-subtle hover:text-fg")}
          >Due</button>
          <button
            onClick={() => setMode("written")}
            className={cn("text-[11px] px-2 py-0.5 rounded-md", mode === "written" ? "bg-accent-muted text-accent" : "text-fg-subtle hover:text-fg")}
          >Written</button>
        </div>
      </div>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: "rgb(var(--fg-subtle))" }} axisLine={false} tickLine={false} />
            <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "rgb(var(--fg-subtle))" }} axisLine={false} tickLine={false} width={28} />
            <Tooltip
              cursor={{ fill: "rgb(var(--bg-panel))" }}
              contentStyle={{ background: "rgb(var(--bg-elev))", border: "1px solid rgb(var(--border))", borderRadius: 8, fontSize: 12 }}
              formatter={(v: any, _: any, p: any) => {
                const ov = p?.payload?.overdue;
                if (mode === "due" && ov && p?.payload?.isToday) return [`${v} (incl. ${ov} overdue)`, "Tasks"];
                return [v, mode === "due" ? "Tasks" : "Notes"];
              }}
              labelFormatter={(l, payload) => {
                const p = payload?.[0]?.payload;
                return p ? p.date.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" }) : l;
              }}
            />
            <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={28}>
              {data.map((d, i) => (
                <Cell key={i} fill={d.isToday ? "rgb(var(--accent))" : "rgb(var(--accent) / 0.45)"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
