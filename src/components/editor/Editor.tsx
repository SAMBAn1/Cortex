import { useEffect, useMemo, useRef, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { EditorView } from "@codemirror/view";
import { useNotes } from "../../store/notes";
import { Trash2, History, Tag, Calendar, Link2, Folder, CheckCircle2, Circle } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";
import { cn } from "../../lib/cn";

export default function Editor({ noteId }: { noteId: string }) {
  const note = useNotes(s => s.notes[noteId]);
  const update = useNotes(s => s.update);
  const remove = useNotes(s => s.remove);
  const loadEdits = useNotes(s => s.loadEdits);
  const edits = useNotes(s => s.edits[noteId] ?? []);
  const navigate = useNavigate();
  const [historyOpen, setHistoryOpen] = useState(false);
  const debounceRef = useRef<number | null>(null);
  const [local, setLocal] = useState(note?.body ?? "");
  const [savedAt, setSavedAt] = useState<number>(note?.updatedAt ?? 0);

  useEffect(() => {
    if (note) {
      setLocal(note.body);
      setSavedAt(note.updatedAt);
      loadEdits(note.id);
    }
  }, [noteId]);

  function onChange(v: string) {
    setLocal(v);
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(async () => {
      await update(noteId, { body: v });
      setSavedAt(Date.now());
    }, 500);
  }

  const extensions = useMemo(() => [
    markdown({ base: markdownLanguage, codeLanguages: [] }),
    EditorView.lineWrapping,
    EditorView.theme({
      "&": { color: "rgb(var(--fg))" },
      ".cm-line": { lineHeight: "1.7" },
    }),
  ], []);

  if (!note) return <div className="p-6 text-fg-muted">Note not found.</div>;

  async function onDelete() {
    if (!confirm("Delete this note? This cannot be undone.")) return;
    await remove(noteId);
    navigate("/notes");
  }

  async function toggleComplete() {
    await update(noteId, { completed: !note.completed });
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
              <span>· Saved {formatDistanceToNow(savedAt, { addSuffix: true })}</span>
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

        <div className="flex-1 overflow-auto px-6 py-2">
          <div className="max-w-3xl mx-auto">
            <CodeMirror
              value={local}
              onChange={onChange}
              extensions={extensions}
              basicSetup={{
                lineNumbers: false,
                foldGutter: false,
                highlightActiveLineGutter: false,
                highlightActiveLine: false,
              }}
              theme="none"
              placeholder="Start writing… # for headings, [[wikilinks]], #tags, dates like 'tomorrow at 3pm'"
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
