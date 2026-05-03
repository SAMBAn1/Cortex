import { keymap } from "@codemirror/view";
import { EditorSelection } from "@codemirror/state";

/**
 * On Enter, if the current line starts with a markdown line marker (>, -, *, 1.,  - [ ]),
 * continue it on the next line. If the line is JUST the marker (empty content), exit by
 * removing the marker instead.
 */
const continueOnEnter = (view: any) => {
  const { state, dispatch } = view;
  const sel = state.selection.main;
  if (sel.from !== sel.to) return false; // ignore when text is selected
  const line = state.doc.lineAt(sel.from);
  const text = line.text;

  // Match the leading marker. Order matters — task before bullet.
  const match =
    /^(\s*)([-*+]\s+\[[ xX]\]\s+)/.exec(text) ||      // - [ ] task
    /^(\s*)([-*+]\s+)/.exec(text) ||                  // - bullet
    /^(\s*)(\d+\.\s+)/.exec(text) ||                  // 1. numbered
    /^(\s*)(>\s*)/.exec(text);                        // > quote

  if (!match) return false;
  const indent = match[1];
  let marker = match[2];
  const markerEnd = line.from + match[0].length;
  const contentAfterMarker = text.slice(match[0].length);

  // If cursor is after the marker but content is empty, exit the construct (delete marker).
  if (sel.from >= markerEnd && contentAfterMarker.trim() === "") {
    dispatch({
      changes: { from: line.from, to: line.to, insert: indent },
      selection: EditorSelection.cursor(line.from + indent.length),
      userEvent: "input.delete",
    });
    return true;
  }

  // Continue: insert newline + indent + marker. For numbered lists, increment the number.
  const numMatch = /^(\d+)\.\s+/.exec(marker);
  if (numMatch) {
    const next = parseInt(numMatch[1], 10) + 1;
    marker = `${next}. `;
  } else if (/\[[xX]\]/.test(marker)) {
    // Continuing a checked task as an unchecked one feels nicer than another `[x]`.
    marker = marker.replace(/\[[xX]\]/, "[ ]");
  }

  const insert = `\n${indent}${marker}`;
  dispatch({
    changes: { from: sel.from, to: sel.from, insert },
    selection: EditorSelection.cursor(sel.from + insert.length),
    userEvent: "input.insert",
  });
  return true;
};

export const continueMarkupKeymap = keymap.of([
  { key: "Enter", run: continueOnEnter },
]);
