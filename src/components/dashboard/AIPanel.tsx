import { useEffect, useState } from "react";
import { Brain, RefreshCw, Sparkles, Send, Loader2 } from "lucide-react";
import { useNotes } from "../../store/notes";
import { useSettings } from "../../store/settings";
import { fetchUrlText } from "../../lib/llm/service";
import { extractUrls } from "../../lib/parse/markdown";
import type { LLMSuggestion } from "../../lib/llm/service";

export default function AIPanel() {
  const notes = useNotes(s => s.notes);
  const { llm, settings } = useSettings();
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<LLMSuggestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [answer, setAnswer] = useState<string>("");
  const [askLoading, setAskLoading] = useState(false);

  async function refresh() {
    if (!llm.available()) return;
    setLoading(true);
    setError(null);
    try {
      const recent = Object.values(notes)
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, 30);
      // Best-effort enrich a few notes with URL contents
      const enriched = await Promise.all(recent.slice(0, 5).map(async n => {
        const urls = extractUrls(n.body).slice(0, 2);
        if (!urls.length) return n;
        const fetched = await Promise.all(urls.map(u => fetchUrlText(u, 800).then(t => t ? `\n[${u}]\n${t}` : "")));
        return { ...n, body: n.body + "\n\n[linked]\n" + fetched.join("\n") };
      }));
      const rest = recent.slice(5);
      const s = await llm.suggest([...enriched, ...rest]);
      setSuggestions(s);
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  async function ask() {
    if (!q.trim() || !llm.available()) return;
    setAskLoading(true);
    setAnswer("");
    try {
      const recent = Object.values(notes).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 20);
      const a = await llm.ask(q, recent);
      setAnswer(a);
    } catch (e: any) {
      setAnswer(`Error: ${e.message}`);
    } finally {
      setAskLoading(false);
    }
  }

  useEffect(() => {
    if (llm.available() && Object.keys(notes).length > 0 && suggestions.length === 0 && !loading) {
      refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.llmApiKey]);

  return (
    <div className="panel p-3 h-full flex flex-col min-h-0">
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-fg-subtle">
          <Brain size={12} className="text-accent" /> Second brain
        </div>
        <button onClick={refresh} disabled={loading || !llm.available()} className="icon-btn h-7 w-7" title="Refresh suggestions">
          {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
        </button>
      </div>

      {!llm.available() && (
        <div className="text-xs text-fg-muted p-3 bg-bg-panel rounded-lg">
          Add your Anthropic API key in <span className="text-accent">Settings</span> to unlock AI suggestions, follow-ups, and Q&A across your notes.
        </div>
      )}

      {error && <div className="text-xs text-danger p-2">{error}</div>}

      <div className="flex-1 overflow-auto space-y-2 mt-1">
        {suggestions.map((s, i) => (
          <div key={i} className="p-3 rounded-lg bg-bg-panel/60 border border-border hover:border-accent/40 transition-colors">
            <div className="text-sm font-medium flex items-center gap-1.5">
              <Sparkles size={12} className="text-accent" /> {s.title}
            </div>
            <div className="text-xs text-fg-muted mt-1 leading-relaxed">{s.body}</div>
            {s.noteIds && s.noteIds.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {s.noteIds.map((nid, j) => (
                  <span key={j} className="pill bg-accent-muted text-accent text-[10px]">{nid}</span>
                ))}
              </div>
            )}
          </div>
        ))}
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
