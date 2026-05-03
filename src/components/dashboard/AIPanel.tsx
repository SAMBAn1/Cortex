import { useEffect, useMemo, useState } from "react";
import { Brain, RefreshCw, Sparkles, Send, Loader2, AlertCircle, CalendarDays, Lightbulb } from "lucide-react";
import { useNotes } from "../../store/notes";
import { useSettings } from "../../store/settings";
import { useNavigate } from "react-router-dom";
import { computeDailyBrief } from "../../lib/brief";
import type { DailyBrief, LLMSuggestion } from "../../lib/llm/service";

export default function AIPanel() {
  const notes = useNotes(s => s.notes);
  const { llm } = useSettings();
  const navigate = useNavigate();
  const [briefSummary, setBriefSummary] = useState<string>("");
  const [briefLoading, setBriefLoading] = useState(false);
  const [ideas, setIdeas] = useState<LLMSuggestion[]>([]);
  const [ideasLoading, setIdeasLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [answer, setAnswer] = useState<string>("");
  const [askLoading, setAskLoading] = useState(false);

  const brief: DailyBrief = useMemo(
    () => computeDailyBrief(Object.values(notes)),
    [notes]
  );

  async function loadBriefSummary() {
    if (!llm.available()) return;
    setBriefLoading(true);
    try {
      const list = Object.values(notes).sort((a, b) => b.updatedAt - a.updatedAt);
      const s = await llm.briefSummary(brief, list);
      setBriefSummary(s);
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setBriefLoading(false);
    }
  }

  async function loadIdeas() {
    if (!llm.available()) return;
    setIdeasLoading(true);
    setError(null);
    try {
      const list = Object.values(notes).sort((a, b) => b.updatedAt - a.updatedAt);
      const s = await llm.ideas(list);
      setIdeas(s);
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setIdeasLoading(false);
    }
  }

  async function ask() {
    if (!q.trim() || !llm.available()) return;
    setAskLoading(true);
    setAnswer("");
    try {
      const list = Object.values(notes).sort((a, b) => b.updatedAt - a.updatedAt);
      const a = await llm.ask(q, list);
      setAnswer(a);
    } catch (e: any) {
      setAnswer(`Error: ${e.message}`);
    } finally {
      setAskLoading(false);
    }
  }

  // Auto-load is OFF by default to conserve quota. The user clicks Refresh to populate.
  // We only auto-load if the user has previously loaded in this session AND the data is empty —
  // i.e. they navigated away and back. Otherwise they explicitly refresh.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { /* no auto-fire */ }, []);

  function findNoteId(title: string): string | undefined {
    const t = title.toLowerCase();
    return Object.values(notes).find(n => n.title.toLowerCase() === t)?.id;
  }

  return (
    <div className="panel p-3 h-full flex flex-col min-h-0">
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-fg-subtle">
          <Brain size={12} className="text-accent" /> Assistant PM
        </div>
        <button
          onClick={() => { loadBriefSummary(); loadIdeas(); }}
          disabled={ideasLoading || briefLoading || !llm.available()}
          className="icon-btn h-7 w-7"
          title="Refresh"
        >
          {(ideasLoading || briefLoading) ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
        </button>
      </div>

      {!llm.available() && (
        <div className="text-xs text-fg-muted p-3 bg-bg-panel rounded-lg leading-relaxed">
          Add an API key in{" "}
          <button onClick={() => navigate("/settings")} className="text-accent underline">Settings</button>{" "}
          to unlock the daily brief, idea connections, and Q&A.
          <div className="mt-2 text-[11px] text-fg-subtle">
            Free option: get a Google Gemini API key (no credit card) at{" "}
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
              Free Gemini tier allows 250 requests/day on <code className="text-fg">gemini-2.5-flash</code>.
              Try again in a minute (per-minute cap) or switch model in{" "}
              <button onClick={() => navigate("/settings")} className="underline text-accent">Settings</button>{" "}
              to <code className="text-fg">gemini-2.5-flash-lite</code> (1,000 req/day).
              <button onClick={() => setError(null)} className="ml-2 underline text-fg-muted">dismiss</button>
            </>
          ) : (
            <>
              {error}{" "}
              <button onClick={() => setError(null)} className="ml-2 underline text-fg-muted">dismiss</button>
            </>
          )}
        </div>
      )}

      <div className="flex-1 overflow-auto space-y-3 mt-1">
        {/* Today's commitments — deterministic, always shown */}
        {(brief.overdue.length > 0 || brief.today.length > 0 || brief.upcoming.length > 0) && (
          <Section icon={<CalendarDays size={11} className="text-accent" />} title="Today's brief">
            {brief.overdue.length > 0 && (
              <Row label={`${brief.overdue.length} overdue`} kind="danger">
                {brief.overdue.slice(0, 3).map((it, i) => (
                  <BriefItem key={i} label={it.title} sub={it.raw} onClick={() => it.noteId && navigate(`/notes/${it.noteId}`)} />
                ))}
              </Row>
            )}
            {brief.today.length > 0 && (
              <Row label="Today" kind="accent">
                {brief.today.slice(0, 5).map((it, i) => (
                  <BriefItem key={i} label={it.title} sub={it.raw} onClick={() => it.noteId && navigate(`/notes/${it.noteId}`)} />
                ))}
              </Row>
            )}
            {brief.upcoming.length > 0 && (
              <Row label="Upcoming" kind="muted">
                {brief.upcoming.slice(0, 4).map((it, i) => (
                  <BriefItem
                    key={i}
                    label={it.title}
                    sub={`${it.raw} · in ${it.days}d`}
                    onClick={() => it.noteId && navigate(`/notes/${it.noteId}`)}
                  />
                ))}
              </Row>
            )}
            {briefSummary && (
              <div className="text-xs text-fg-muted leading-relaxed mt-2 p-2 rounded bg-accent-muted/20 border border-accent/20">
                {briefSummary}
              </div>
            )}
            {briefLoading && (
              <div className="text-[11px] text-fg-subtle flex items-center gap-1.5 mt-1">
                <Loader2 size={11} className="animate-spin" /> Drafting your morning brief…
              </div>
            )}
            {!briefSummary && !briefLoading && llm.available() && (
              <button
                onClick={loadBriefSummary}
                className="text-[11px] text-accent hover:underline mt-1 flex items-center gap-1"
              >
                <Sparkles size={11} /> Generate AI brief
              </button>
            )}
          </Section>
        )}

        {/* AI-generated ideas / connections — explicit button to avoid burning quota on auto-load */}
        {ideas.length === 0 && !ideasLoading && llm.available() && (
          <div className="text-[11px] text-fg-muted p-2 rounded bg-bg-panel/60 border border-border flex items-center justify-between">
            <span>Connect scattered notes into ideas?</span>
            <button onClick={loadIdeas} className="text-accent hover:underline flex items-center gap-1">
              <Lightbulb size={11} /> Find ideas
            </button>
          </div>
        )}
        {ideasLoading && (
          <div className="text-[11px] text-fg-subtle flex items-center gap-1.5 p-2">
            <Loader2 size={11} className="animate-spin" /> Scanning your vault…
          </div>
        )}
        {ideas.length > 0 && (
          <Section icon={<Lightbulb size={11} className="text-warn" />} title="Idea connections">
            {ideas.map((s, i) => (
              <div key={i} className="p-2.5 rounded-lg bg-bg-panel/60 border border-border hover:border-accent/40 transition-colors">
                <div className="text-sm font-medium flex items-center gap-1.5">
                  <Sparkles size={11} className="text-accent" /> {s.title}
                </div>
                <div className="text-xs text-fg-muted mt-1 leading-relaxed">{s.body}</div>
                {s.noteIds && s.noteIds.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {s.noteIds.map((title, j) => {
                      const id = findNoteId(title);
                      return (
                        <button
                          key={j}
                          onClick={() => id && navigate(`/notes/${id}`)}
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
          </Section>
        )}

        {answer && (
          <div className="p-3 rounded-lg bg-accent-muted/30 border border-accent/30">
            <div className="text-[11px] uppercase tracking-wider text-accent mb-1">Answer</div>
            <div className="text-sm whitespace-pre-wrap text-fg">{answer}</div>
          </div>
        )}
      </div>

      <div className="mt-3 pt-2 border-t border-border">
        <div className="flex items-center gap-1.5 bg-bg-panel rounded-lg px-2 py-1.5">
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            onKeyDown={e => e.key === "Enter" && ask()}
            placeholder={llm.available() ? "Ask your notes…" : "Configure API key first"}
            disabled={!llm.available()}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-fg-subtle"
          />
          <button onClick={ask} disabled={askLoading || !q.trim() || !llm.available()} className="icon-btn h-7 w-7">
            {askLoading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-fg-subtle px-1">
        {icon} {title}
      </div>
      {children}
    </div>
  );
}

function Row({ label, kind, children }: { label: string; kind: "danger" | "accent" | "muted"; children: React.ReactNode }) {
  const bg =
    kind === "danger" ? "bg-danger/5 border-danger/20" :
    kind === "accent" ? "bg-accent-muted/20 border-accent/20" :
    "bg-bg-panel border-border";
  const labelColor =
    kind === "danger" ? "text-danger" :
    kind === "accent" ? "text-accent" :
    "text-fg-muted";
  return (
    <div className={`rounded-md border ${bg} p-2`}>
      <div className={`text-[10px] uppercase tracking-wider ${labelColor} mb-1`}>{label}</div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function BriefItem({ label, sub, onClick }: { label: string; sub: string; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="w-full text-left text-xs hover:bg-bg-panel rounded p-1 -m-1">
      <div className="truncate text-fg">{label}</div>
      <div className="text-[10px] text-fg-subtle">{sub}</div>
    </button>
  );
}
