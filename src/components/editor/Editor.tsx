import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { EditorView } from "@codemirror/view";
import { useNotes } from "../../store/notes";
import { Trash2, History, Tag, Calendar, Link2, Folder, CheckCircle2, Circle, Bold, Italic, List, ListChecks, Quote, Code, Heading1, Heading2 } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";
import { cn } from "../../lib/cn";
import { makeCompletions } from "./completions";
import { formatKeymap } from "./format-keymap";

// Build extensions ONCE per component lifetime. Component is keyed by noteId in parent
// so it remounts on note change — extensions never need to "reconfigure" mid-life.
function buildExtensions(noteId: string) {
  return [
    markdown({ base: markdownLanguage, codeLanguages: [] }),
    EditorView.lineWrapping,
    formatKeymap,
    makeCompletions({
      getNotes: () => Object.values(useNotes.getState().notes),
      currentNoteId: noteId,
    }),
    EditorView.theme({
      "&": { color: "rgb(var(--fg))" },
      ".cm-line": { lineHeight: "1.7" },
      ".cm-tooltip-autocomplete": {
        background: "rgb(var(--bg-elev)) !important",
        border: "1px solid rgb(var(--border)) !important",
        borderRadius: "8px !important",
        boxShadow: "0 8px 24px rgba(0,0,0,0.2) !important",
        overflow: "hidden",
      },
      ".cm-tooltip-autocomplete > ul > li": {
        padding: "4px 8px !important",
        fontSize: "13px !important",
        color: "rgb(var(--fg))",
      },
      ".cm-tooltip-autocomplete > ul > li[aria-selected]": {
        background: "rgb(var(--accent-muted)) !important",
        color: "rgb(var(--accent)) !important",
      },
    }),
  ];
}

export default function Editor({ noteId }: { noteId: string }) {
  const note = useNotes(useCallback((s) => s.notes[noteId], [noteId]));
  const update = useNotes(s => s.update);
  const remove = useNotes(s => s.remove);
  const loadEdits = useNotes(s => s.loadEdits);
  const editsForId = useNotes(useCallback((s) => s.edits[noteId], [noteId]));
  const edits = editsForId ?? EMPTY_EDITS;
  const navigate = useNavigate();
  const [historyOpen, setHistoryOpen] = useState(false);
  const debounceRef = useRef<number | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const [local, setLocal] = useState(note?.body ?? "");
  const [savedAt, setSavedAt] = useState<number>(note?.updatedAt ?? 0);

  // Initialize local state on first mount only (component is keyed by noteId)
  useEffect(() => {
    if (note) {
      setLocal(note.body);
      setSavedAt(note.updatedAt);
      loadEdits(note.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const extensions = useMemo(() => buildExtensions(noteId), [noteId]);

  const onChange = useCallback((v: string) => {
    setLocal(v);
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(async () => {
      await update(noteId, { body: v });
      setSavedAt(Date.now());
    }, 500);
  }, [noteId, update]);

  const onCreate = useCallback((view: EditorView) => {
    viewRef.current = view;
  }, []);

  if (!note) {
    return <div className="p-6 text-fg-muted">Note not loaded yet — try refreshing.</div>;
  }

  async function onDelete() {
    if (!confirm("Delete this note? This cannot be undone.")) return;
    await remove(noteId);
    navigate("/notes");
  }

  async function toggleComplete() {
    await update(noteId, { completed: !note!.completed });
  }

  function applyToEditor(fn: (view: EditorView) => void) {
    const v = viewRef.current;
    if (v) { fn(v); v.focus(); }
  }
  function wrapSel(prefix: string, suffix = prefix) {
    applyToEditor(view => {
      const { from, to } = view.state.selection.main;
      const sel = view.state.doc.sliceString(from, to);
      view.dispatch({
        changes: { from, to, insert: `${prefix}${sel}${suffix}` },
        selection: { anchor: sel ? to + prefix.length + suffix.length : from + prefix.length },
      });
    });
  }
  function lineWrap(prefix: string) {
    applyToEditor(view => {
      const { from } = view.state.selection.main;
      const line = view.state.doc.lineAt(from);
      view.dispatch({
        changes: { from: line.from, insert: prefix },
        selection: { anchor: from + prefix.length },
      });
    });
  }

  return (
    <div className="h-full flex">
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center gap-2 px-6 py-3 border-b border-border">
          <button onClick={toggleComplete} title={note.completed ? "Mark active" : "Mark complete"} className="icon-btn h-8 w-8">
            {note.completed ? <CheckCircle2 size={16} className="text-success" /> : <Circle size={16} />}
          </button>
          <div className="flex-1 min-w-0">
            <div className={cn("text-base font-medium truncate", note.completed && "line-through opacity-70")}>{note.title || "Untitled"}</div>
            <div className="text-[11px] text-fg-subtle flex items-center gap-3">
              <span>Created {format(note.createdAt, "MMM d, yyyy · HH:mm")}</span>
              <span>· Saved {formatDistanceToNow(savedAt || note.updatedAt, { addSuffix: true })}</span>
              {note.folder && <span className="flex items-center gap-1"><Folder size={10} /> {note.folder}</span>}
            </div>
          </div>
          <button onClick={() => setHistoryOpen(o => !o)} title="History" className={cn("icon-btn h-8 w-8", historyOpen && "icon-btn-active")}>
            <History size={16} />
          </button>
          <button onClick={onDelete} title="Delete" className="icon-btn h-8 w-8 hover:text-danger">
            <Trash2 size={16} />
          </button>
        </div>

        <div className="border-b border-border px-6 py-1.5 flex items-center gap-0.5 text-fg-muted overflow-x-auto">
          <ToolBtn onClick={() => lineWrap("# ")} title="Heading 1 (Ctrl+Alt+1)"><Heading1 size={14} /></ToolBtn>
          <ToolBtn onClick={() => lineWrap("## ")} title="Heading 2 (Ctrl+Alt+2)"><Heading2 size={14} /></ToolBtn>
          <Sep />
          <ToolBtn onClick={() => wrapSel("**")} title="Bold (Ctrl+B)"><Bold size={14} /></ToolBtn>
          <ToolBtn onClick={() => wrapSel("*")} title="Italic (Ctrl+I)"><Italic size={14} /></ToolBtn>
          <ToolBtn onClick={() => wrapSel("`")} title="Inline code (Ctrl+`)"><Code size={14} /></ToolBtn>
          <Sep />
          <ToolBtn onClick={() => lineWrap("- ")} title="Bullet list"><List size={14} /></ToolBtn>
          <ToolBtn onClick={() => lineWrap("- [ ] ")} title="Task"><ListChecks size={14} /></ToolBtn>
          <ToolBtn onClick={() => lineWrap("> ")} title="Quote"><Quote size={14} /></ToolBtn>
          <Sep />
          <ToolBtn onClick={() => wrapSel("[[", "]]")} title="Wikilink"><Link2 size={14} /></ToolBtn>
          <ToolBtn onClick={() => wrapSel("#", "")} title="Tag"><Tag size={14} /></ToolBtn>
          <div className="ml-auto text-[10px] text-fg-subtle pl-2 hidden md:block">Type <kbd className="px-1 py-0.5 bg-bg-panel rounded">[[</kbd> for notes, <kbd className="px-1 py-0.5 bg-bg-panel rounded">#</kbd> for tags, <kbd className="px-1 py-0.5 bg-bg-panel rounded">/</kbd> for menu</div>
        </div>

        <div className="flex-1 overflow-auto px-6 py-2">
          <div className="max-w-3xl mx-auto">
            <CodeMirror
              value={local}
              onChange={onChange}
              extensions={extensions}
              onCreateEditor={onCreate}
              basicSetup={BASIC_SETUP}
              theme="none"
              placeholder="Start writing… use # for headings, [[ for note links, # for tags, / for menu"
            />
          </div>
        </div>

        {(note.tags.length > 0 || note.links.length > 0 || note.dates.length > 0) && (
          <div className="border-t border-border px-6 py-2 flex flex-wrap gap-1.5 text-xs items-center">
            {note.tags.map(t => (
              <span key={t} className="pill bg-accent-muted text-accent"><Tag size={10} /> {t}</span>
            ))}
            {note.dates.map((d, i) => (
              <span key={i} className="pill bg-bg-panel text-fg-muted">
                <Calendar size={10} /> {d.raw} <span className="opacity-60">→ {format(new Date(d.iso), "MMM d")}</span>
              </span>
            ))}
            {note.links.map(l => (
              <span key={l} className="pill bg-bg-panel text-fg-muted"><Link2 size={10} /> {l}</span>
            ))}
          </div>
        )}
      </div>

      {historyOpen && (
        <aside className="w-72 border-l border-border bg-bg-panel/40 flex flex-col">
          <div className="px-3 py-2 border-b border-border text-xs uppercase tracking-wider text-fg-subtle">History · {edits.length}</div>
          <div className="flex-1 overflow-auto p-2 space-y-2">
            {edits.length === 0 && <div className="text-xs text-fg-subtle p-2">No edits yet.</div>}
            {[...edits].reverse().map(e => (
              <div key={e.id} className="text-[11px] panel p-2">
                <div className="text-fg-subtle">{format(e.ts, "MMM d, HH:mm:ss")}</div>
                {e.added.map((a, i) => (
                  <div key={`a${i}`} className="text-success truncate">+ L{a.line}: {a.text || "—"}</div>
                ))}
                {e.removed.map((r, i) => (
                  <div key={`r${i}`} className="text-danger truncate">− L{r.line}: {r.text || "—"}</div>
                ))}
              </div>
            ))}
          </div>
        </aside>
      )}
    </div>
  );
}

const BASIC_SETUP = {
  lineNumbers: false,
  foldGutter: false,
  highlightActiveLineGutter: false,
  highlightActiveLine: false,
};

const EMPTY_EDITS: never[] = [];

function ToolBtn({ children, onClick, title }: { children: React.ReactNode; onClick: () => void; title: string }) {
  return <button onClick={onClick} title={title} className="icon-btn h-7 w-7">{children}</button>;
}

function Sep() {
  return <div className="w-px h-4 bg-border mx-1" />;
}
