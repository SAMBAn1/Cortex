import * as chrono from "chrono-node";
import type { ExtractedDate } from "../storage/types";

const TASK_DONE_RE = /^\s*[-*]\s*\[x\]/i;

export function extractDates(body: string, ref: Date = new Date()): ExtractedDate[] {
  const lines = body.split("\n");
  const out: ExtractedDate[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const results = chrono.parse(line, ref, { forwardDate: true });
    for (const r of results) {
      const date = r.start.date();
      out.push({
        iso: date.toISOString(),
        raw: r.text,
        line: i + 1,
        context: line.trim().slice(0, 200),
        done: TASK_DONE_RE.test(line),
      });
    }
  }
  return out;
}

/** Strip HH:MM:SS so we can group by day. */
export function dayKey(d: Date | string): string {
  const x = typeof d === "string" ? new Date(d) : d;
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, "0");
  const day = String(x.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function startOfDay(d = new Date()): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function diffDays(a: Date | string, b: Date | string): number {
  const aa = typeof a === "string" ? new Date(a) : a;
  const bb = typeof b === "string" ? new Date(b) : b;
  return Math.round((startOfDay(aa).getTime() - startOfDay(bb).getTime()) / 86400000);
}
