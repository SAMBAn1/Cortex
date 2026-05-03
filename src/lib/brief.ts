import type { Note } from "./storage/types";
import type { DailyBrief } from "./llm/service";
import { startOfDay, addDays, dayKey } from "./parse/dates";

/** Compute today's commitments deterministically from notes — no LLM needed. */
export function computeDailyBrief(notes: Note[], now = new Date()): DailyBrief {
  const today = startOfDay(now);
  const todayKey = dayKey(today);
  const upcomingHorizon = addDays(today, 7);

  const brief: DailyBrief = { overdue: [], today: [], upcoming: [], summary: "" };

  for (const n of notes) {
    for (const d of n.dates) {
      if (d.done) continue;
      const dt = new Date(d.iso);
      const key = dayKey(dt);
      if (dt < today) {
        brief.overdue.push({ title: n.title, raw: d.raw, noteId: n.id });
      } else if (key === todayKey) {
        brief.today.push({ title: n.title, raw: d.raw, noteId: n.id });
      } else if (dt <= upcomingHorizon) {
        const days = Math.round((dt.getTime() - today.getTime()) / 86_400_000);
        brief.upcoming.push({ title: n.title, raw: d.raw, noteId: n.id, days });
      }
    }
  }
  // Sort: overdue oldest first, upcoming nearest first
  brief.overdue.sort((a, b) => a.title.localeCompare(b.title));
  brief.upcoming.sort((a, b) => a.days - b.days);
  return brief;
}
