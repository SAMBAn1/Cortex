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
    const notes = getNotes().filter(n => n.id !== currentNoteId);
    const titles = new Set<string>();
    const options: Completion[] = [];
    for (const n of notes) {
      const t = n.title || "Untitled";
      if (titles.has(t)) continue;
      titles.add(t);
      if (!query || t.toLowerCase().includes(query)) {
        options.push({
          label: t,
          type: "variable",
          detail: n.folder || undefined,
          apply: t + "]]",
        });
      }
    }
    // Allow creating a new note title
    if (query && !titles.has(m[1])) {
      options.push({ label: m[1], type: "text", detail: "new note", apply: m[1] + "]]" });
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
    const options: Completion[] = [...tags]
      .filter(t => !query || t.toLowerCase().includes(query))
      .map(t => ({ label: t, type: "keyword", apply: t }));
    if (query && !tags.has(m[1])) options.push({ label: m[1], type: "text", detail: "new tag", apply: m[1] });
    return { from: start, options, validFor: /^[\w/-]*$/ };
  }

  function slashSource(ctx: CompletionContext): CompletionResult | null {
    const line = ctx.state.doc.lineAt(ctx.pos);
    const before = line.text.slice(0, ctx.pos - line.from);
    // Slash menu only at start of line (allowing whitespace)
    const m = /^(\s*)\/(\w*)$/.exec(before);
    if (!m) return null;
    const query = m[2].toLowerCase();
    const start = ctx.pos - m[2].length;
    const items: Completion[] = [
      { label: "h1", detail: "Heading 1", apply: "# " },
      { label: "h2", detail: "Heading 2", apply: "## " },
      { label: "h3", detail: "Heading 3", apply: "### " },
      { label: "todo", detail: "Task list item", apply: "- [ ] " },
      { label: "list", detail: "Bullet list", apply: "- " },
      { label: "numbered", detail: "Numbered list", apply: "1. " },
      { label: "quote", detail: "Blockquote", apply: "> " },
      { label: "code", detail: "Code block", apply: "```\n\n```" },
      { label: "table", detail: "Table", apply: "| Col | Col |\n| --- | --- |\n|     |     |" },
      { label: "hr", detail: "Horizontal rule", apply: "---" },
      { label: "link", detail: "Link", apply: "[text](url)" },
      { label: "image", detail: "Image", apply: "![alt](url)" },
      { label: "tag", detail: "Tag", apply: "#" },
      { label: "wikilink", detail: "Link to a note", apply: "[[" },
      { label: "today", detail: "Today's date", apply: new Date().toISOString().slice(0, 10) },
    ];
    const options = items
      .filter(i => !query || i.label.toLowerCase().includes(query) || (i.detail ?? "").toLowerCase().includes(query))
      .map(i => ({ ...i, type: "function" as const }));
    return { from: start, options, validFor: /^\w*$/ };
  }

  return autocompletion({
    override: [wikilinkSource, tagSource, slashSource],
    activateOnTyping: true,
    closeOnBlur: true,
    icons: true,
    defaultKeymap: true,
  });
}
