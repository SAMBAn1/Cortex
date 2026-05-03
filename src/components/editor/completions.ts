import {
  autocompletion,
  type CompletionContext,
  type CompletionResult,
  type Completion,
} from "@codemirror/autocomplete";
import type { Note } from "../../lib/storage/types";

/** Build wikilink + tag + slash-command completions for the editor. */
export function makeCompletions(opts: {
  getNotes: () => Note[];
  currentNoteId: string;
}) {
  const { getNotes, currentNoteId } = opts;

  function wikilinkSource(ctx: CompletionContext): CompletionResult | null {
    // Look back for an unclosed [[
    const before = ctx.state.doc.sliceString(Math.max(0, ctx.pos - 200), ctx.pos);
    const m = /\[\[([^\[\]\n]*)$/.exec(before);
    if (!m) return null;
    const query = m[1].toLowerCase();
    const start = ctx.pos - m[1].length;
    // Are there already closing ]] right after the cursor (from auto-bracket-pairing)?
    const after = ctx.state.doc.sliceString(ctx.pos, ctx.pos + 2);
    const hasClosing = after === "]]";

    function makeApply(insert: string) {
      return (view: any, _completion: any, from: number, to: number) => {
        // Replace the query (and the auto-closed ]] if present) with `title]]`.
        view.dispatch({
          changes: { from, to: hasClosing ? to + 2 : to, insert: insert + "]]" },
          selection: { anchor: from + insert.length + 2 },
        });
      };
    }

    const notes = getNotes().filter(n => n.id !== currentNoteId);
    const titles = new Set<string>();
    const matched: Completion[] = [];
    for (const n of notes) {
      const t = n.title || "Untitled";
      if (titles.has(t)) continue;
      titles.add(t);
      if (!query || t.toLowerCase().includes(query)) {
        matched.push({
          label: t,
          type: "variable",
          detail: n.folder || undefined,
          apply: makeApply(t),
          // Boost existing-note matches above the "new note" fallback so the auto-selected
          // first option is always a real match when one exists.
          boost: 99,
        });
      }
    }
    const options: Completion[] = [...matched];
    // Offer "new note" only when NO existing matches (or query exactly equals nothing).
    if (query && matched.length === 0 && !titles.has(m[1])) {
      options.push({ label: m[1], type: "text", detail: "new note", apply: makeApply(m[1]) });
    }
    return { from: start, options, validFor: /^[^\]\n]*$/ };
  }

  function tagSource(ctx: CompletionContext): CompletionResult | null {
    const before = ctx.state.doc.sliceString(Math.max(0, ctx.pos - 100), ctx.pos);
    // Match # at start-of-line or after whitespace
    const m = /(?:^|[\s])#([\w/-]*)$/.exec(before);
    if (!m) return null;
    const query = m[1].toLowerCase();
    const start = ctx.pos - m[1].length;
    const tags = new Set<string>();
    for (const n of getNotes()) for (const t of n.tags) tags.add(t);
    const matched: Completion[] = [...tags]
      .filter(t => !query || t.toLowerCase().includes(query))
      .map(t => ({ label: t, type: "keyword", apply: t, boost: 99 }));
    const options: Completion[] = [...matched];
    if (query && matched.length === 0 && !tags.has(m[1])) {
      options.push({ label: m[1], type: "text", detail: "new tag", apply: m[1] });
    }
    return { from: start, options, validFor: /^[\w/-]*$/ };
  }

  function slashSource(ctx: CompletionContext): CompletionResult | null {
    const line = ctx.state.doc.lineAt(ctx.pos);
    const before = line.text.slice(0, ctx.pos - line.from);
    const m = /^(\s*)\/(\w*)$/.exec(before);
    if (!m) return null;
    const query = m[2].toLowerCase();
    // Anchor the completion AFTER the `/` so CM uses the query (without `/`) for filtering.
    // The apply function reaches back 1 char to also delete the `/`.
    const slashPos = ctx.pos - m[2].length - 1;
    const queryStart = slashPos + 1;

    function applyAt(text: string, cursorOffset: number) {
      return (view: any, _c: any, from: number, to: number) => {
        // `from` is queryStart (after `/`); we extend back by 1 to also remove the `/`.
        const realFrom = from - 1;
        view.dispatch({
          changes: { from: realFrom, to, insert: text },
          selection: { anchor: realFrom + cursorOffset },
        });
      };
    }

    const items: { label: string; detail: string; apply: any }[] = [
      { label: "h1", detail: "Heading 1", apply: applyAt("# ", 2) },
      { label: "h2", detail: "Heading 2", apply: applyAt("## ", 3) },
      { label: "h3", detail: "Heading 3", apply: applyAt("### ", 4) },
      { label: "todo", detail: "Task list item", apply: applyAt("- [ ] ", 6) },
      { label: "list", detail: "Bullet list", apply: applyAt("- ", 2) },
      { label: "numbered", detail: "Numbered list", apply: applyAt("1. ", 3) },
      { label: "quote", detail: "Blockquote", apply: applyAt("> ", 2) },
      { label: "table", detail: "Table", apply: applyAt("| Col | Col |\n| --- | --- |\n|     |     |\n", 2) },
      { label: "hr", detail: "Horizontal rule", apply: applyAt("---\n", 4) },
      { label: "link", detail: "Link", apply: applyAt("[text](url)", 1) },
      { label: "image", detail: "Image", apply: applyAt("![alt](url)", 2) },
      { label: "tag", detail: "Tag", apply: applyAt("#", 1) },
      { label: "wikilink", detail: "Link to a note", apply: applyAt("[[]]", 2) },
      { label: "today", detail: "Today's date", apply: applyAt(new Date().toISOString().slice(0, 10), 10) },
    ];
    const options = items
      .filter(i => !query || i.label.toLowerCase().includes(query) || i.detail.toLowerCase().includes(query))
      .map(i => ({ label: i.label, detail: i.detail, apply: i.apply, type: "function" as const }));
    return { from: queryStart, options, validFor: /^\w*$/ };
  }

  function combined(ctx: CompletionContext): CompletionResult | null {
    try {
      return wikilinkSource(ctx) || tagSource(ctx) || slashSource(ctx);
    } catch {
      return null;
    }
  }

  return autocompletion({
    override: [combined],
    activateOnTyping: true,
    closeOnBlur: true,
    icons: true,
    defaultKeymap: true,
    // Ensure first option is auto-selected so Enter accepts it.
    selectOnOpen: true,
    // Explicitly require Enter to commit (not just Tab) — CM's default has both.
    aboveCursor: false,
  });
}
