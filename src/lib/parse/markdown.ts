/** Pull [[wikilinks]] from a markdown body. Returns lowercase titles for matching. */
export function extractWikilinks(body: string): string[] {
  const re = /\[\[([^\]\|]+?)(?:\|[^\]]+)?\]\]/g;
  const out = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) out.add(m[1].trim());
  return [...out];
}

/** Pull http(s) URLs from a markdown body. */
export function extractUrls(body: string): string[] {
  const re = /(https?:\/\/[^\s)\]]+)/g;
  const out = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) out.add(m[1]);
  return [...out];
}

/** Pull #tags from body. */
export function extractTags(body: string): string[] {
  const re = /(?:^|\s)#([a-zA-Z][\w/-]*)/g;
  const out = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) out.add(m[1]);
  return [...out];
}

/** Compute a tiny per-line diff between two strings. */
export function lineDiff(prev: string, next: string) {
  const a = prev.split("\n");
  const b = next.split("\n");
  const aSet = new Map<string, number>();
  a.forEach((l, i) => aSet.set(`${i}:${l}`, i));
  const added: { line: number; text: string }[] = [];
  const removed: { line: number; text: string }[] = [];
  // Naive set diff by index+content. Good enough for activity log.
  const aLines = new Set(a);
  const bLines = new Set(b);
  b.forEach((l, i) => {
    if (!aLines.has(l)) added.push({ line: i + 1, text: l });
  });
  a.forEach((l, i) => {
    if (!bLines.has(l)) removed.push({ line: i + 1, text: l });
  });
  return { added, removed };
}

/** Derive a title from body: first heading or first non-empty line. */
export function deriveTitle(body: string, fallback = "Untitled"): string {
  const lines = body.split("\n");
  for (const l of lines) {
    const h = l.match(/^\s*#{1,6}\s+(.+)$/);
    if (h) return h[1].trim().slice(0, 120);
  }
  for (const l of lines) {
    const t = l.trim();
    if (t) return t.replace(/^[-*]\s*\[[ xX]\]\s*/, "").slice(0, 120);
  }
  return fallback;
}
