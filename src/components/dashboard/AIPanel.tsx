import { useEffect, useMemo, useRef, useState } from "react";
import {
  Brain, RefreshCw, Sparkles, Send, Loader2, AlertCircle, CalendarDays, Lightbulb,
  MessageSquare, Clock, FileText, User2,
} from "lucide-react";
import { useNotes } from "../../store/notes";
import { useSettings } from "../../store/settings";
import { useNavigate } from "react-router-dom";
import { computeDailyBrief } from "../../lib/brief";
import type { DailyBrief, LLMSuggestion } from "../../lib/llm/service";
import { formatDistanceToNow } from "date-fns";
import { cn } from "../../lib/cn";

type Tab = "summary" | "ideas" | "ask" | "recents";

interface ChatMsg { role: "user" | "assistant"; content: string; }

export default function AIPanel() {
  const notes = useNotes(s => s.notes);
  const { llm } = useSettings();
  const navigate = useNavigate();

  // Persisted across the session so navigation back to dashboard remembers state.
  const [tab, setTab] = useState<Tab>("summary");

  // Summary tab
  const [briefSummary, setBriefSummary] = useState<string>("");
  const [briefLoading, setBriefLoading] = useState(false);

  // Ideas tab
  const [ideas, setIdeas] = useState<LLMSuggestion[]>([]);
  const [ideasLoading, setIdeasLoading] = useState(false);

  // Ask tab — multi-turn chat
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [q, setQ] = useState("");
  const [askLoading, setAskLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const brief: DailyBrief = useMemo(
    () => computeDailyBrief(Object.values(notes)),
    [notes]
  );

  const recent = useMemo(
    () => Object.values(notes).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 24),
    [notes]
  );

  async function loadBriefSummary() {
    if (!llm.available()) return;
    setBriefLoading(true);
    setError(null);
    try {
      const list = Object.values(notes).sort((a, b) => b.updatedAt - a.updatedAt);
      setBriefSummary(await llm.briefSummary(brief, list));
    } catch (e: any) { setError(e.message ?? String(e)); }
    finally { setBriefLoading(false); }
  }

  async function loadIdeas() {
    if (!llm.available()) return;
    setIdeasLoading(true);
    setError(null);
    try {
      const list = Object.values(notes).sort((a, b) => b.updatedAt - a.updatedAt);
      setIdeas(await llm.ideas(list));
    } catch (e: any) { setError(e.message ?? String(e)); }
    finally { setIdeasLoading(false); }
  }

  async function ask() {
    if (!q.trim() || !llm.available()) return;
    const userMsg = q.trim();
    setQ("");
    setChat(c => [...c, { role: "user", content: userMsg }]);
    setAskLoading(true);
    setError(null);
    try {
      const list = Object.values(notes).sort((a, b) => b.updatedAt - a.updatedAt);
      // Build prompt that includes prior conversation context.
      const history = chat.map(m => `${m.role === "user" ? "Q" : "A"}: ${m.content}`).join("\n\n");
      const fullPrompt = history ? `${history}\n\nQ: ${userMsg}` : userMsg;
      const a = await llm.ask(fullPrompt, list);
      setChat(c => [...c, { role: "assistant", content: a }]);
    } catch (e: any) {
      setChat(c => [...c, { role: "assistant", content: `Error: ${e.message}` }]);
    } finally { setAskLoading(false); }
  }

  // Auto-fire is off — user clicks to load.
  useEffect(() => { /* noop */ }, []);

  function findNoteId(title: string): string | undefined {
    const t = title.toLowerCase();
    return Object.values(notes).find(n => n.title.toLowerCase() === t)?.id;
  }

  function refreshActive() {
    if (tab === "summary") loadBriefSummary();
    else if (tab === "ideas") loadIdeas();
  }

  const refreshDisabled = tab === "ask" || tab === "recents" || briefLoading || ideasLoading || !llm.available();

  return (
    <div className="panel p-3 h-full flex flex-col min-h-0">
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-fg-subtle">
          <Brain size={12} className="text-accent" /> Assistant PM
        </div>
        <div className="flex items-center gap-0.5">
          {/* Tab switcher */}
          <TabBtn active={tab === "summary"} onClick={() => setTab("summary")} icon={<CalendarDays size={13} />} label="Summary" />
          <TabBtn active={tab === "ideas"} onClick={() => setTab("ideas")} icon={<Lightbulb size={13} />} label="Ideas" />
          <TabBtn active={tab === "ask"} onClick={() => setTab("ask")} icon={<MessageSquare size={13} />} label="Ask" />
          <TabBtn active={tab === "recents"} onClick={() => setTab("recents")} icon={<Clock size={13} />} label="Recents" />
          <div className="w-px h-4 bg-border mx-1" />
          <button
            onClick={refreshActive}
            disabled={refreshDisabled}
            className="icon-btn h-7 w-7"
            title="Refresh this view"
          >
            {(briefLoading || ideasLoading) ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          </button>
        </div>
      </div>

      {!llm.available() && tab !== "recents" && (
        <div className="text-xs text-fg-muted p-3 bg-bg-panel rounded-lg leading-relaxed mb-2">
          Add an API key in{" "}
          <button onClick={() => navigate("/settings")} className="text-accent underline">Settings</button>{" "}
          to unlock summaries, ideas, and Q&A.
          <div className="mt-2 text-[11px] text-fg-subtle">
            Free option: get a Google Gemini key at{" "}
            <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="underline text-accent">aistudio.google.com/apikey</a>.
          </div>
        </div>
      )}

      {error && (
        <div className="text-[11px] text-danger p-2 bg-danger/5 border border-danger/20 rounded mb-2 leading-relaxed">
          <AlertCircle size={11} className="inline mr-1" />
          {error.includes("429") || error.toLowerCase().includes("quota") ? (
            <>
              <span className="font-medium">Rate-limited / quota exceeded.</span>{" "}
              Try again in a minute, or switch model in{" "}
              <button onClick={() => navigate("/settings")} className="underline text-accent">Settings</button>{" "}
              to <code className="text-fg">gemini-2.5-flash-lite</code> (1,000 req/day).
              <button onClick={() => setError(null)} className="ml-2 underline text-fg-muted">dismiss</button>
            </>
          ) : (
            <>{error}{" "}<button onClick={() => setError(null)} className="ml-2 underline text-fg-muted">dismiss</button></>
          )}
        </div>
      )}

      {/* Tab content — single scroll area */}
      <div className="flex-1 min-h-0 overflow-auto" key={tab}>
        {tab === "summary" && (
          <SummaryTab
            brief={brief}
            briefSummary={briefSummary}
            briefLoading={briefLoading}
            onGenerate={loadBriefSummary}
            llmAvailable={llm.available()}
            onOpenNote={(id) => navigate(`/notes/${id}`)}
          />
        )}
        {tab === "ideas" && (
          <IdeasTab
            ideas={ideas}
            ideasLoading={ideasLoading}
            onGenerate={loadIdeas}
            llmAvailable={llm.available()}
            onOpenNote={(id) => navigate(`/notes/${id}`)}
            findNoteId={findNoteId}
          />
        )}
        {tab === "ask" && (
          <AskTab
            chat={chat}
            askLoading={askLoading}
            onClear={() => setChat([])}
          />
        )}
        {tab === "recents" && (
          <RecentsTab notes={recent} onOpen={(id) => navigate(`/notes/${id}`)} />
        )}
      </div>

      {/* Persistent input row — only shown for the Ask tab */}
      {tab === "ask" && (
        <div className="mt-3 pt-2 border-t border-border">
          <div className="flex items-center gap-1.5 bg-bg-panel rounded-lg px-2 py-1.5">
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              onKeyDown={e => e.key === "Enter" && ask()}
              placeholder={llm.available() ? "Ask anything about your notes…" : "Configure API key first"}
              disabled={!llm.available() || askLoading}
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-fg-subtle"
            />
            <button onClick={ask} disabled={askLoading || !q.trim() || !llm.available()} className="icon-btn h-7 w-7">
              {askLoading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* -------- TabBtn -------- */
function TabBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs transition-colors",
        active ? "bg-accent-muted text-accent font-medium" : "text-fg-muted hover:bg-bg-panel hover:text-fg",
      )}
      title={label}
    >
      {icon} <span className="hidden md:inline">{label}</span>
    </button>
  );
}

/* -------- Summary tab -------- */
function SummaryTab({ brief, briefSummary, briefLoading, onGenerate, llmAvailable, onOpenNote }: {
  brief: DailyBrief; briefSummary: string; briefLoading: boolean;
  onGenerate: () => void; llmAvailable: boolean;
  onOpenNote: (id: string) => void;
}) {
  const hasItems = brief.overdue.length + brief.today.length + brief.upcoming.length > 0;
  return (
    <div className="space-y-3">
      {/* AI summary FIRST so it sits at the top */}
      {briefSummary && (
        <div className="text-sm text-fg leading-relaxed p-3 rounded-lg bg-accent-muted/20 border border-accent/20">
          {briefSummary}
        </div>
      )}
      {briefLoading && (
        <div className="text-[11px] text-fg-subtle flex items-center gap-1.5 p-2">
          <Loader2 size={11} className="animate-spin" /> Drafting your morning brief…
        </div>
      )}
      {!briefSummary && !briefLoading && llmAvailable && hasItems && (
        <button
          onClick={onGenerate}
          className="w-full text-sm text-accent hover:bg-accent-muted/20 border border-accent/30 rounded-lg p-3 flex items-center justify-center gap-2"
        >
          <Sparkles size={14} /> Generate AI summary for today
        </button>
      )}

      {/* Then the deterministic tiles */}
      {!hasItems ? (
        <div className="text-sm text-fg-muted p-4 text-center rounded-lg bg-bg-panel/50">
          Nothing scheduled in the next 7 days.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <Tile label={`${brief.overdue.length} overdue`} kind="danger" empty={brief.overdue.length === 0}>
            {brief.overdue.slice(0, 8).map((it, i) => (
              <BriefItem key={i} label={it.title} sub={it.raw} onClick={() => it.noteId && onOpenNote(it.noteId)} />
            ))}
          </Tile>
          <Tile label="Today" kind="accent" empty={brief.today.length === 0}>
            {brief.today.slice(0, 10).map((it, i) => (
              <BriefItem key={i} label={it.title} sub={it.raw} onClick={() => it.noteId && onOpenNote(it.noteId)} />
            ))}
          </Tile>
          <Tile label="Upcoming" kind="muted" empty={brief.upcoming.length === 0}>
            {brief.upcoming.slice(0, 10).map((it, i) => (
              <BriefItem key={i} label={it.title} sub={`${it.raw} · in ${it.days}d`} onClick={() => it.noteId && onOpenNote(it.noteId)} />
            ))}
          </Tile>
        </div>
      )}
    </div>
  );
}

/* -------- Ideas tab -------- */
function IdeasTab({ ideas, ideasLoading, onGenerate, llmAvailable, onOpenNote, findNoteId }: {
  ideas: LLMSuggestion[]; ideasLoading: boolean;
  onGenerate: () => void; llmAvailable: boolean;
  onOpenNote: (id: string) => void;
  findNoteId: (title: string) => string | undefined;
}) {
  if (!llmAvailable) return null;
  return (
    <div className="space-y-3">
      {ideas.length === 0 && !ideasLoading && (
        <div className="text-sm text-fg-muted p-6 text-center rounded-lg bg-bg-panel/50 space-y-3">
          <Lightbulb size={28} className="text-warn mx-auto opacity-60" />
          <div>Surface forgotten threads and find ideas hiding across your notes.</div>
          <button onClick={onGenerate} className="text-sm bg-accent text-white px-3 py-1.5 rounded-md hover:opacity-90">
            Find ideas
          </button>
        </div>
      )}
      {ideasLoading && (
        <div className="text-sm text-fg-muted flex items-center gap-2 p-4 rounded-lg bg-bg-panel/50">
          <Loader2 size={14} className="animate-spin" /> Scanning your vault for connections…
        </div>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {ideas.map((s, i) => (
          <div key={i} className="p-3 rounded-lg bg-bg-panel/60 border border-border hover:border-accent/40 transition-colors">
            <div className="text-sm font-medium flex items-center gap-1.5">
              <Sparkles size={12} className="text-accent" /> {s.title}
            </div>
            <div className="text-xs text-fg-muted mt-1.5 leading-relaxed">{s.body}</div>
            {s.noteIds && s.noteIds.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {s.noteIds.map((title, j) => {
                  const id = findNoteId(title);
                  return (
                    <button
                      key={j}
                      onClick={() => id && onOpenNote(id)}
                      className="pill bg-accent-muted text-accent text-[10px] hover:opacity-80"
                      disabled={!id}
                    >
                      {title}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* -------- Ask tab — chat thread -------- */
function AskTab({ chat, askLoading, onClear }: { chat: ChatMsg[]; askLoading: boolean; onClear: () => void }) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chat.length, askLoading]);

  return (
    <div className="space-y-2">
      {chat.length === 0 && (
        <div className="text-sm text-fg-muted p-6 text-center rounded-lg bg-bg-panel/50 space-y-1">
          <MessageSquare size={28} className="text-accent mx-auto opacity-60 mb-2" />
          <div className="font-medium text-fg">Chat with your notes</div>
          <div className="text-xs">Ask anything — the assistant has read your vault.</div>
          <div className="text-[11px] text-fg-subtle mt-2">Try: "What did I commit to last week?" · "Summarize my Pepsi notes."</div>
        </div>
      )}
      {chat.length > 0 && (
        <div className="flex justify-end mb-1">
          <button onClick={onClear} className="text-[11px] text-fg-subtle hover:text-fg-muted underline">clear chat</button>
        </div>
      )}
      {chat.map((m, i) => (
        <div key={i} className={cn("flex gap-2", m.role === "user" ? "justify-end" : "justify-start")}>
          {m.role === "assistant" && (
            <div className="w-7 h-7 shrink-0 rounded-full bg-accent-muted text-accent flex items-center justify-center">
              <Brain size={14} />
            </div>
          )}
          <div
            className={cn(
              "max-w-[80%] rounded-lg px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap",
              m.role === "user" ? "bg-accent text-white" : "bg-bg-panel/70 border border-border text-fg",
            )}
          >
            {m.content}
          </div>
          {m.role === "user" && (
            <div className="w-7 h-7 shrink-0 rounded-full bg-bg-panel border border-border text-fg-muted flex items-center justify-center">
              <User2 size={14} />
            </div>
          )}
        </div>
      ))}
      {askLoading && (
        <div className="flex gap-2 justify-start">
          <div className="w-7 h-7 shrink-0 rounded-full bg-accent-muted text-accent flex items-center justify-center">
            <Brain size={14} />
          </div>
          <div className="bg-bg-panel/70 border border-border rounded-lg px-3 py-2 text-sm text-fg-muted">
            <Loader2 size={12} className="inline animate-spin mr-1" /> Thinking…
          </div>
        </div>
      )}
      <div ref={endRef} />
    </div>
  );
}

/* -------- Recents tab -------- */
function RecentsTab({ notes, onOpen }: { notes: { id: string; title: string; updatedAt: number; folder: string }[]; onOpen: (id: string) => void }) {
  if (!notes.length) {
    return <div className="text-sm text-fg-muted p-4 text-center rounded-lg bg-bg-panel/50">No notes yet. Use the search bar above to capture one.</div>;
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
      {notes.map(n => (
        <button
          key={n.id}
          onClick={() => onOpen(n.id)}
          className="text-left p-3 rounded-lg bg-bg-panel/60 border border-border hover:border-accent/40 transition-colors flex items-start gap-2 min-w-0"
        >
          <FileText size={14} className="text-fg-subtle mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="text-sm truncate text-fg">{n.title || "Untitled"}</div>
            <div className="text-[11px] text-fg-subtle">
              {n.folder && <span className="mr-1">{n.folder} ·</span>}
              {formatDistanceToNow(n.updatedAt, { addSuffix: true })}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

/* -------- Tile + BriefItem -------- */
function Tile({ label, kind, empty, children }: { label: string; kind: "danger" | "accent" | "muted"; empty?: boolean; children: React.ReactNode }) {
  const bg =
    kind === "danger" ? "bg-danger/5 border-danger/30" :
    kind === "accent" ? "bg-accent-muted/20 border-accent/30" :
    "bg-bg-panel border-border";
  const labelColor =
    kind === "danger" ? "text-danger" :
    kind === "accent" ? "text-accent" :
    "text-fg-muted";
  return (
    <div className={`rounded-lg border ${bg} p-3 min-h-[100px]`}>
      <div className={`text-[10px] uppercase tracking-wider ${labelColor} mb-2 font-medium`}>{label}</div>
      {empty ? (
        <div className="text-xs text-fg-subtle">—</div>
      ) : (
        <div className="space-y-1.5">{children}</div>
      )}
    </div>
  );
}

function BriefItem({ label, sub, onClick }: { label: string; sub: string; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="w-full text-left text-xs hover:bg-bg-panel/50 rounded p-1 -m-1 transition-colors">
      <div className="truncate text-fg">{label}</div>
      <div className="text-[10px] text-fg-subtle">{sub}</div>
    </button>
  );
}
