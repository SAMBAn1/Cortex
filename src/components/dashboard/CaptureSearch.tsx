import { useEffect, useMemo, useRef, useState } from "react";
import { Search, Plus, FileText, ArrowRight } from "lucide-react";
import { useNotes } from "../../store/notes";
import { useToasts } from "../../store/toast";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";

interface SearchHit {
  id: string;
  title: string;
  snippet: string;
  updatedAt: number;
  matchedTitle: boolean;
}

export default function CaptureSearch() {
  const notes = useNotes(s => s.notes);
  const create = useNotes(s => s.create);
  const push = useToasts(s => s.push);
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [focused, setFocused] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const hits: SearchHit[] = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return [];
    const results: SearchHit[] = [];
    for (const n of Object.values(notes)) {
      const title = (n.title || "Untitled").toLowerCase();
      const body = n.body.toLowerCase();
      const inTitle = title.includes(needle);
      const idx = body.indexOf(needle);
      if (!inTitle && idx === -1) continue;
      let snippet = "";
      if (idx !== -1) {
        const start = Math.max(0, idx - 30);
        const end = Math.min(n.body.length, idx + needle.length + 60);
        snippet = (start > 0 ? "…" : "") + n.body.slice(start, end).replace(/\s+/g, " ").trim() + (end < n.body.length ? "…" : "");
      } else {
        snippet = n.body.slice(0, 100).replace(/\s+/g, " ").trim();
      }
      results.push({ id: n.id, title: n.title || "Untitled", snippet, updatedAt: n.updatedAt, matchedTitle: inTitle });
    }
    // Title matches first, then by recency
    results.sort((a, b) => (Number(b.matchedTitle) - Number(a.matchedTitle)) || (b.updatedAt - a.updatedAt));
    return results.slice(0, 8);
  }, [q, notes]);

  // Reset active index when results change
  useEffect(() => { setActiveIdx(0); }, [q]);

  // Close dropdown on outside click
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setFocused(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // Keyboard shortcut: Cmd/Ctrl+K to focus
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setFocused(true);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  function openHit(h: SearchHit) {
    navigate(`/notes/${h.id}`);
    setQ("");
    setFocused(false);
  }

  async function createNew() {
    if (!q.trim()) return;
    const n = await create({ body: q });
    setQ("");
    setFocused(false);
    push({
      kind: "success",
      message: `Created "${n.title}"`,
      actionLabel: "Open",
      onAction: () => navigate(`/notes/${n.id}`),
    });
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx(i => Math.min(hits.length, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx(i => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIdx < hits.length) openHit(hits[activeIdx]);
      else createNew();
    } else if (e.key === "Escape") {
      setFocused(false);
      inputRef.current?.blur();
    }
  }

  const showDropdown = focused && q.trim().length > 0;
  const createOptionActive = activeIdx === hits.length;

  return (
    <div ref={wrapRef} className="relative">
      <div className="panel flex items-center gap-2 px-3 py-2.5 focus-within:border-accent transition-colors">
        <Search size={16} className="text-fg-subtle shrink-0" />
        <input
          ref={inputRef}
          value={q}
          onChange={e => setQ(e.target.value)}
          onFocus={() => setFocused(true)}
          onKeyDown={onKeyDown}
          placeholder="Search notes or capture a thought…"
          className="flex-1 bg-transparent outline-none text-sm placeholder:text-fg-subtle"
        />
        <kbd className="hidden md:inline text-[10px] px-1.5 py-0.5 rounded bg-bg-panel border border-border text-fg-subtle">
          ⌘K
        </kbd>
      </div>

      {showDropdown && (
        <div className="absolute z-30 left-0 right-0 mt-1 panel p-1 shadow-soft animate-fade-in max-h-96 overflow-auto">
          {hits.length === 0 ? (
            <div className="text-xs text-fg-subtle px-3 py-2">No matching notes.</div>
          ) : (
            hits.map((h, i) => (
              <button
                key={h.id}
                onMouseEnter={() => setActiveIdx(i)}
                onClick={() => openHit(h)}
                className={`w-full text-left px-3 py-2 rounded-md flex items-start gap-2 ${i === activeIdx ? "bg-accent-muted/50" : "hover:bg-bg-panel"}`}
              >
                <FileText size={13} className="text-fg-subtle mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-fg truncate">
                    {highlight(h.title, q)}
                  </div>
                  <div className="text-[11px] text-fg-subtle truncate">
                    {highlight(h.snippet, q)}
                  </div>
                </div>
                <div className="text-[10px] text-fg-subtle shrink-0 mt-0.5">
                  {formatDistanceToNow(h.updatedAt).split(" ")[0]}
                </div>
              </button>
            ))
          )}
          {/* Always offer "create new" at the bottom */}
          <button
            onMouseEnter={() => setActiveIdx(hits.length)}
            onClick={createNew}
            className={`w-full text-left px-3 py-2 rounded-md flex items-center gap-2 border-t border-border mt-1 pt-2 ${createOptionActive ? "bg-accent-muted/50" : "hover:bg-bg-panel"}`}
          >
            <Plus size={13} className="text-accent shrink-0" />
            <div className="flex-1 min-w-0 text-sm text-fg">
              Create note: <span className="text-accent">"{truncate(q, 60)}"</span>
            </div>
            <ArrowRight size={12} className="text-fg-subtle" />
          </button>
        </div>
      )}
    </div>
  );
}

function highlight(text: string, q: string) {
  const needle = q.trim();
  if (!needle) return text;
  const lower = text.toLowerCase();
  const idx = lower.indexOf(needle.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <span className="text-accent font-medium">{text.slice(idx, idx + needle.length)}</span>
      {text.slice(idx + needle.length)}
    </>
  );
}

function truncate(s: string, n: number) { return s.length > n ? s.slice(0, n - 1) + "…" : s; }
