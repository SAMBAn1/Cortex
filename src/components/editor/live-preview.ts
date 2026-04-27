import { Decoration, ViewPlugin, EditorView, WidgetType, type DecorationSet, type ViewUpdate } from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";
import { syntaxTree } from "@codemirror/language";

/**
 * Obsidian-style "Live Preview":
 *  - Hide markdown markers (**, *, `, #) on lines that don't contain the cursor.
 *  - Render heading sizes, bold/italic/code styles inline.
 *  - Render task list `[ ]` / `[x]` as actual clickable checkboxes.
 *  - Render `[[wikilinks]]` as clickable chips (dispatches "cortex:open-wikilink" event).
 *  - Render `#tag` as colored chips when off-line.
 */

class TaskWidget extends WidgetType {
  checked: boolean; from: number; to: number;
  constructor(checked: boolean, from: number, to: number) { super(); this.checked = checked; this.from = from; this.to = to; }
  toDOM(view: EditorView) {
    const wrap = document.createElement("span");
    wrap.className = "cm-task-widget";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = this.checked;
    input.className = "cm-task-checkbox";
    input.addEventListener("mousedown", (e) => e.preventDefault());
    input.addEventListener("click", (e) => {
      e.stopPropagation();
      const insert = this.checked ? "[ ]" : "[x]";
      view.dispatch({ changes: { from: this.from, to: this.to, insert } });
    });
    wrap.appendChild(input);
    return wrap;
  }
  ignoreEvent() { return false; }
  eq(other: TaskWidget) { return other.checked === this.checked && other.from === this.from; }
}

class WikilinkWidget extends WidgetType {
  target: string;
  constructor(target: string) { super(); this.target = target; }
  toDOM() {
    const a = document.createElement("a");
    a.className = "cm-wikilink-chip";
    a.textContent = this.target;
    a.href = "#";
    a.title = `Open "${this.target}"`;
    a.addEventListener("mousedown", (e) => e.preventDefault());
    a.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      window.dispatchEvent(new CustomEvent("cortex:open-wikilink", { detail: this.target }));
    });
    return a;
  }
  ignoreEvent() { return false; }
  eq(other: WikilinkWidget) { return other.target === this.target; }
}

class TagWidget extends WidgetType {
  tag: string;
  constructor(tag: string) { super(); this.tag = tag; }
  toDOM() {
    const s = document.createElement("span");
    s.className = "cm-tag-chip";
    s.textContent = "#" + this.tag;
    return s;
  }
  eq(other: TagWidget) { return other.tag === this.tag; }
}

class HrWidget extends WidgetType {
  toDOM() {
    const d = document.createElement("span");
    d.className = "cm-hr-widget";
    return d;
  }
  eq(other: HrWidget) { return other instanceof HrWidget; }
}

function buildDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const cursorPos = view.state.selection.main.head;
  const cursorLineNum = view.state.doc.lineAt(cursorPos).number;
  const sel = view.state.selection.main;
  const hasSelection = sel.from !== sel.to;

  type Item = { from: number; to: number; deco: Decoration };
  const items: Item[] = [];

  const cursorOnRange = (from: number, to: number) => {
    if (hasSelection && sel.from <= to && sel.to >= from) return true;
    const lineFrom = view.state.doc.lineAt(from).number;
    const lineTo = view.state.doc.lineAt(to).number;
    return cursorLineNum >= lineFrom && cursorLineNum <= lineTo;
  };

  // Walk markdown syntax tree
  for (const { from, to } of view.visibleRanges) {
    syntaxTree(view.state).iterate({
      from, to,
      enter(node) {
        const name = node.type.name;

        // Headings
        const headingMatch = /^ATXHeading([1-6])$/.exec(name);
        if (headingMatch) {
          const level = +headingMatch[1];
          items.push({ from: node.from, to: node.to, deco: Decoration.mark({ class: `cm-h${level}` }) });
          if (!cursorOnRange(node.from, node.to)) {
            // hide "# " (level + space)
            const markEnd = Math.min(node.to, node.from + level + 1);
            items.push({ from: node.from, to: markEnd, deco: Decoration.replace({}) });
          }
          return;
        }

        // Bold (**text**)
        if (name === "StrongEmphasis") {
          items.push({ from: node.from, to: node.to, deco: Decoration.mark({ class: "cm-strong" }) });
          if (!cursorOnRange(node.from, node.to) && node.to - node.from >= 4) {
            items.push({ from: node.from, to: node.from + 2, deco: Decoration.replace({}) });
            items.push({ from: node.to - 2, to: node.to, deco: Decoration.replace({}) });
          }
          return;
        }

        // Italic (*text* or _text_)
        if (name === "Emphasis") {
          items.push({ from: node.from, to: node.to, deco: Decoration.mark({ class: "cm-em" }) });
          if (!cursorOnRange(node.from, node.to) && node.to - node.from >= 2) {
            items.push({ from: node.from, to: node.from + 1, deco: Decoration.replace({}) });
            items.push({ from: node.to - 1, to: node.to, deco: Decoration.replace({}) });
          }
          return;
        }

        // Inline code (`text`)
        if (name === "InlineCode") {
          items.push({ from: node.from, to: node.to, deco: Decoration.mark({ class: "cm-inline-code" }) });
          if (!cursorOnRange(node.from, node.to) && node.to - node.from >= 2) {
            items.push({ from: node.from, to: node.from + 1, deco: Decoration.replace({}) });
            items.push({ from: node.to - 1, to: node.to, deco: Decoration.replace({}) });
          }
          return;
        }

        // Strikethrough (~~text~~ — GFM)
        if (name === "Strikethrough") {
          items.push({ from: node.from, to: node.to, deco: Decoration.mark({ class: "cm-strike" }) });
          if (!cursorOnRange(node.from, node.to) && node.to - node.from >= 4) {
            items.push({ from: node.from, to: node.from + 2, deco: Decoration.replace({}) });
            items.push({ from: node.to - 2, to: node.to, deco: Decoration.replace({}) });
          }
          return;
        }

        // Block quote
        if (name === "Blockquote") {
          items.push({ from: node.from, to: node.to, deco: Decoration.mark({ class: "cm-blockquote" }) });
        }
        if (name === "QuoteMark" && !cursorOnRange(node.from, node.to)) {
          items.push({ from: node.from, to: Math.min(node.to + 1, view.state.doc.length), deco: Decoration.replace({}) });
        }

        // Task marker
        if (name === "TaskMarker") {
          const text = view.state.doc.sliceString(node.from, node.to);
          const checked = /\[[xX]\]/.test(text);
          items.push({
            from: node.from,
            to: node.to,
            deco: Decoration.replace({ widget: new TaskWidget(checked, node.from, node.to) }),
          });
          return;
        }

        // Code blocks (fenced) — apply class for monospace styling, hide fences when cursor not in
        if (name === "FencedCode") {
          items.push({ from: node.from, to: node.to, deco: Decoration.mark({ class: "cm-fenced-code" }) });
          if (!cursorOnRange(node.from, node.to)) {
            // Hide opening fence line and closing fence line
            const openLine = view.state.doc.lineAt(node.from);
            items.push({ from: openLine.from, to: Math.min(openLine.to + 1, view.state.doc.length), deco: Decoration.replace({}) });
            const closeLine = view.state.doc.lineAt(node.to);
            // Only hide closing if it's a fence line (starts with ```)
            if (/^\s*```/.test(closeLine.text)) {
              items.push({ from: closeLine.from, to: closeLine.to, deco: Decoration.replace({}) });
            }
          }
          return;
        }
      },
    });
  }

  // Custom: wikilinks [[Note Title]]
  const docText = view.state.doc.toString();
  const wikiRe = /\[\[([^\[\]\n]+?)\]\]/g;
  let m: RegExpExecArray | null;
  while ((m = wikiRe.exec(docText))) {
    const from = m.index;
    const to = from + m[0].length;
    if (!cursorOnRange(from, to)) {
      items.push({ from, to, deco: Decoration.replace({ widget: new WikilinkWidget(m[1].trim()) }) });
    } else {
      items.push({ from, to, deco: Decoration.mark({ class: "cm-wikilink-raw" }) });
    }
  }

  // Custom: tags #word — only outside code, only when off line
  const tagRe = /(?:^|[\s])(#[\w/-]+)/g;
  let tm: RegExpExecArray | null;
  while ((tm = tagRe.exec(docText))) {
    const tagText = tm[1];
    const from = tm.index + tm[0].length - tagText.length;
    const to = from + tagText.length;
    if (!cursorOnRange(from, to)) {
      items.push({ from, to, deco: Decoration.replace({ widget: new TagWidget(tagText.slice(1)) }) });
    } else {
      items.push({ from, to, deco: Decoration.mark({ class: "cm-tag-raw" }) });
    }
  }

  // Custom: horizontal rule (--- on its own line)
  for (let i = 1; i <= view.state.doc.lines; i++) {
    const line = view.state.doc.line(i);
    if (/^\s*-{3,}\s*$/.test(line.text)) {
      if (!cursorOnRange(line.from, line.to)) {
        items.push({ from: line.from, to: line.to, deco: Decoration.replace({ widget: new HrWidget() }) });
      }
    }
  }

  // Sort by from, then by to (longer ranges first to avoid overlap issues with mark vs replace)
  items.sort((a, b) => a.from - b.from || b.to - a.to);
  for (const it of items) builder.add(it.from, it.to, it.deco);
  return builder.finish();
}

export const livePreview = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = buildDecorations(view);
    }
    update(update: ViewUpdate) {
      if (update.docChanged || update.selectionSet || update.viewportChanged) {
        this.decorations = buildDecorations(update.view);
      }
    }
  },
  {
    decorations: (v) => v.decorations,
    provide: (plugin) =>
      EditorView.atomicRanges.of((view) => {
        const inst = view.plugin(plugin);
        return inst ? inst.decorations : Decoration.none;
      }),
  },
);
