import { keymap } from "@codemirror/view";
import { EditorSelection } from "@codemirror/state";

function wrap(prefix: string, suffix = prefix) {
  return (view: any) => {
    const { state, dispatch } = view;
    const changes = state.changeByRange((range: any) => {
      const sel = state.doc.sliceString(range.from, range.to);
      const insert = `${prefix}${sel || ""}${suffix}`;
      const cursor = sel ? range.to + prefix.length + suffix.length : range.from + prefix.length;
      return {
        changes: { from: range.from, to: range.to, insert },
        range: EditorSelection.cursor(cursor),
      };
    });
    dispatch(state.update(changes, { scrollIntoView: true, userEvent: "input.format" }));
    return true;
  };
}

function linePrefix(prefix: string) {
  return (view: any) => {
    const { state, dispatch } = view;
    const changes = state.changeByRange((range: any) => {
      const line = state.doc.lineAt(range.from);
      const already = line.text.startsWith(prefix);
      if (already) {
        return {
          changes: { from: line.from, to: line.from + prefix.length, insert: "" },
          range: EditorSelection.cursor(Math.max(line.from, range.from - prefix.length)),
        };
      }
      return {
        changes: { from: line.from, insert: prefix },
        range: EditorSelection.cursor(range.from + prefix.length),
      };
    });
    dispatch(state.update(changes, { scrollIntoView: true, userEvent: "input.format" }));
    return true;
  };
}

export const formatKeymap = keymap.of([
  { key: "Mod-b", run: wrap("**") },
  { key: "Mod-i", run: wrap("*") },
  { key: "Mod-`", run: wrap("`") },
  { key: "Mod-k", run: wrap("[", "](url)") },
  { key: "Mod-Shift-x", run: linePrefix("- [ ] ") },
  { key: "Mod-Shift-7", run: linePrefix("1. ") },
  { key: "Mod-Shift-8", run: linePrefix("- ") },
  { key: "Mod-Shift-.", run: linePrefix("> ") },
  { key: "Mod-Alt-1", run: linePrefix("# ") },
  { key: "Mod-Alt-2", run: linePrefix("## ") },
  { key: "Mod-Alt-3", run: linePrefix("### ") },
]);
