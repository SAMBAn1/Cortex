import { useRef, useState } from "react";
import { useNotes } from "../../store/notes";
import { useToasts } from "../../store/toast";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Sparkles } from "lucide-react";

export default function QuickCapture() {
  const create = useNotes(s => s.create);
  const push = useToasts(s => s.push);
  const navigate = useNavigate();
  const [val, setVal] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  async function submit(open = false) {
    if (!val.trim()) return;
    const n = await create({ body: val });
    setVal("");
    if (open) {
      navigate(`/notes/${n.id}`);
    } else {
      push({
        kind: "success",
        message: `Saved "${n.title}"`,
        actionLabel: "Open",
        onAction: () => navigate(`/notes/${n.id}`),
      });
    }
  }

  function onKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submit(false); }
    if (e.key === "Enter" && e.shiftKey) { /* allow newline */ }
  }

  return (
    <div className="panel p-4 hover:shadow-soft transition-shadow">
      <div className="flex items-center gap-2 mb-2 text-fg-subtle text-xs uppercase tracking-wider">
        <Sparkles size={12} className="text-accent" />
        Capture a thought
      </div>
      <textarea
        ref={ref}
        value={val}
        onChange={e => setVal(e.target.value)}
        onKeyDown={onKey}
        placeholder="What's on your mind? Use #tags, [[wikilinks]], dates like 'next Friday'…"
        className="w-full bg-transparent resize-none outline-none placeholder:text-fg-subtle text-[15px] leading-relaxed min-h-[80px] max-h-[300px]"
        rows={3}
      />
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-border">
        <div className="text-[11px] text-fg-subtle">
          <kbd className="px-1.5 py-0.5 rounded bg-bg-panel border border-border text-[10px]">⌘ ⏎</kbd> save
        </div>
        <div className="flex items-center gap-1">
          <button
            disabled={!val.trim()}
            onClick={() => submit(false)}
            className="text-xs px-3 py-1.5 rounded-md hover:bg-bg-panel disabled:opacity-40"
          >Save</button>
          <button
            disabled={!val.trim()}
            onClick={() => submit(true)}
            className="text-xs px-3 py-1.5 rounded-md bg-accent text-white hover:opacity-90 disabled:opacity-40 flex items-center gap-1"
          >Open <ArrowRight size={12} /></button>
        </div>
      </div>
    </div>
  );
}
