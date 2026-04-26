import * as chrono from "chrono-node";
import type { ExtractedDate } from "../storage/types";

const TASK_DONE_RE = /^\s*[-*]\s*\[x\]/i;

/**
 * Numeric date patterns we look for. Order matters — longer/more specific first.
 * We keep things heuristic but predictable:
 *   - Default to MM/DD/YYYY when ambiguous
 *   - If a number > 12 appears in the day-or-month slot, infer it must be the day
 *   - 4-digit blob (e.g. 0505) → MMDD
 *   - 8-digit blob (e.g. 05052025) → MMDDYYYY
 *   - Year defaults to current year when missing
 *   - Year-first ISO (2025-05-09) is always Y-M-D
 */
const NUMERIC_PATTERNS: { re: RegExp; build: (m: RegExpExecArray, today: Date) => Date | null }[] = [
  // YYYY-MM-DD or YYYY/MM/DD or YYYY.MM.DD
  {
    re: /\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/g,
    build: (m) => {
      const y = +m[1], mo = +m[2], d = +m[3];
      return validate(y, mo, d);
    },
  },
  // 8-digit blob: MMDDYYYY (e.g. 05052025)
  {
    re: /\b(\d{2})(\d{2})(\d{4})\b/g,
    build: (m) => {
      const mm = +m[1], dd = +m[2], y = +m[3];
      // If mm > 12 and dd <= 12, swap to DDMMYYYY
      if (mm > 12 && dd <= 12) return validate(y, dd, mm);
      return validate(y, mm, dd);
    },
  },
  // DD-MM-YYYY or DD/MM/YYYY (only when first number > 12, otherwise next pattern wins)
  // — handled inline by the M/D/YYYY rule via the > 12 swap.
  // M/D/YYYY or M-D-YYYY or M.D.YYYY (year present, 2-or-4 digit)
  {
    re: /\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\b/g,
    build: (m, today) => {
      let a = +m[1], b = +m[2];
      let yRaw = +m[3];
      // Normalize 2-digit year: assume 20xx if <= today's last-two + 10, else 19xx — keep simple: 00-79 → 2000s, 80-99 → 1900s
      const y = yRaw < 100 ? (yRaw <= 79 ? 2000 + yRaw : 1900 + yRaw) : yRaw;
      // Smart swap if a > 12 (must be day)
      if (a > 12 && b <= 12) return validate(y, b, a);
      // If b > 12 and a <= 12, normal MM/DD
      if (b > 12 && a <= 12) return validate(y, a, b);
      // Both ≤ 12 → ambiguous, default MM/DD/YYYY
      return validate(y, a, b);
      void today;
    },
  },
  // M/D or M-D or M.D (no year)
  {
    re: /\b(\d{1,2})[-/.](\d{1,2})\b(?!\s*[-/.])/g,
    build: (m, today) => {
      let a = +m[1], b = +m[2];
      const y = today.getFullYear();
      if (a > 12 && b <= 12) return validate(y, b, a);
      if (b > 12 && a <= 12) return validate(y, a, b);
      return validate(y, a, b); // default MM/DD
    },
  },
  // 4-digit blob (e.g. 0505) → MMDD, current year. Avoid matching obvious years like 2025, 1999.
  {
    re: /(?<!\d)(\d{4})(?!\d)/g,
    build: (m, today) => {
      const blob = m[1];
      const num = +blob;
      // Skip plausible standalone years (1900-2099)
      if (num >= 1900 && num <= 2099) return null;
      const a = +blob.slice(0, 2);
      const b = +blob.slice(2, 4);
      const y = today.getFullYear();
      if (a > 12 && b <= 12) return validate(y, b, a);
      if (b > 12 && a <= 12) return validate(y, a, b);
      return validate(y, a, b);
    },
  },
];

function validate(y: number, m: number, d: number): Date | null {
  if (!y || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
  return dt;
}

export function extractDates(body: string, ref: Date = new Date()): ExtractedDate[] {
  const lines = body.split("\n");
  const out: ExtractedDate[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const done = TASK_DONE_RE.test(line);
    const seen = new Set<string>();

    // 1) chrono natural language ("next Friday", "tomorrow", "May 5", "in 3 weeks")
    const chronoResults = chrono.parse(line, ref, { forwardDate: true });
    for (const r of chronoResults) {
      const date = r.start.date();
      const key = `${r.index}:${date.toISOString().slice(0, 10)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        iso: date.toISOString(),
        raw: r.text,
        line: i + 1,
        context: line.trim().slice(0, 200),
        done,
      });
    }

    // 2) numeric patterns — but skip ranges already covered by chrono matches
    const taken: [number, number][] = chronoResults.map(r => [r.index, r.index + r.text.length]);
    for (const { re, build } of NUMERIC_PATTERNS) {
      re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(line))) {
        const start = m.index;
        const end = start + m[0].length;
        if (taken.some(([a, b]) => start < b && end > a)) continue;
        const date = build(m, ref);
        if (!date) continue;
        const key = `${start}:${date.toISOString().slice(0, 10)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        taken.push([start, end]);
        out.push({
          iso: date.toISOString(),
          raw: m[0],
          line: i + 1,
          context: line.trim().slice(0, 200),
          done,
        });
      }
    }
  }

  // de-dup by iso+line+raw
  const keyed = new Map<string, ExtractedDate>();
  for (const d of out) keyed.set(`${d.line}:${d.raw}:${d.iso.slice(0, 10)}`, d);
  return [...keyed.values()];
}

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
