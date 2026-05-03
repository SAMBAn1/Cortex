import type { Note } from "../storage/types";

export interface LLMSuggestion {
  title: string;
  body: string;
  noteIds?: string[];
}

export interface DailyBrief {
  overdue: { title: string; raw: string; noteId?: string }[];
  today: { title: string; raw: string; noteId?: string }[];
  upcoming: { title: string; raw: string; noteId?: string; days: number }[];
  summary: string;
}

export interface LLMService {
  available(): boolean;
  /** Find connections between scattered notes — PM "second brain" mode. */
  ideas(notes: Note[]): Promise<LLMSuggestion[]>;
  /** Q&A across the vault. */
  ask(prompt: string, notes: Note[]): Promise<string>;
  /** Narrative summary of the day's commitments. The deterministic data is built locally. */
  briefSummary(brief: DailyBrief, notes: Note[]): Promise<string>;
}

export async function fetchUrlText(url: string, max = 4000): Promise<string | null> {
  try {
    const res = await fetch(url, { method: "GET" });
    if (!res.ok) return null;
    const text = await res.text();
    const stripped = text
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return stripped.slice(0, max);
  } catch {
    return null;
  }
}

class NullLLM implements LLMService {
  available() { return false; }
  async ideas() { return []; }
  async ask() { return "Configure an LLM provider in Settings to get AI suggestions."; }
  async briefSummary() { return ""; }
}

class AnthropicLLM implements LLMService {
  apiKey: string;
  model: string;
  constructor(apiKey: string, model: string) { this.apiKey = apiKey; this.model = model; }
  available() { return !!this.apiKey; }

  private async call(messages: { role: "user" | "assistant"; content: string }[], system?: string, maxTokens = 1024): Promise<string> {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({ model: this.model, max_tokens: maxTokens, system, messages }),
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`Anthropic ${res.status}: ${t.slice(0, 300)}`);
    }
    const data = await res.json();
    return data.content?.[0]?.text ?? "";
  }

  async ideas(notes: Note[]): Promise<LLMSuggestion[]> {
    if (!notes.length) return [];
    // Sample broadly: take a mix of recent + older notes, not just the latest 30.
    const sorted = [...notes].sort((a, b) => b.updatedAt - a.updatedAt);
    const sample = sorted.length <= 40 ? sorted : [
      ...sorted.slice(0, 20),
      ...sorted.slice(20).sort(() => Math.random() - 0.5).slice(0, 20),
    ];
    const ctx = sample.map(n =>
      `## ${n.title}\nTags: ${n.tags.join(", ") || "—"}\nUpdated: ${new Date(n.updatedAt).toISOString().slice(0, 10)}\n---\n${n.body.slice(0, 700)}`
    ).join("\n\n");

    const system = `You are an "assistant PM" reviewing a product manager's second-brain notes. Your job is to find SIGNAL IN THE NOISE — connect scattered notes, surface forgotten threads, propose feature ideas that emerge from combining 2+ notes.

Rules:
- Each suggestion MUST reference 2+ notes by exact title (in noteIds).
- Be specific. "Look into X" is bad. "Notes A + B both mention dropoff at signup; consider running an experiment that ..." is good.
- Skip obvious next-actions (those are tasks, not insights). Surface what the PM may have FORGOTTEN or hasn't yet connected.
- 3 ideas max. Quality over quantity.
- Return strict JSON only, no prose: [{"title":"...","body":"...","noteIds":["Note A","Note B"]}]`;

    const out = await this.call(
      [{ role: "user", content: `NOTES:\n\n${ctx}\n\nReturn JSON.` }],
      system,
      1500,
    );
    try {
      const json = JSON.parse(out.match(/\[[\s\S]*\]/)?.[0] ?? "[]");
      return Array.isArray(json) ? json.slice(0, 5) : [];
    } catch {
      return [{ title: "Suggestion", body: out.slice(0, 600) }];
    }
  }

  async ask(prompt: string, notes: Note[]): Promise<string> {
    const ctx = notes.slice(0, 25).map(n => `## ${n.title}\n${n.body.slice(0, 700)}`).join("\n\n");
    return this.call(
      [{ role: "user", content: prompt }],
      `You are the user's second-brain assistant. Answer concisely. Cite notes by title when you reference them.\n\nVAULT NOTES:\n${ctx}`,
      800,
    );
  }

  async briefSummary(brief: DailyBrief, notes: Note[]): Promise<string> {
    if (!brief.overdue.length && !brief.today.length && !brief.upcoming.length) {
      return "Nothing scheduled. Use the time to catch up on long-running threads or archive stale notes.";
    }
    const briefStr = JSON.stringify(brief, null, 2);
    const ctx = notes.slice(0, 15).map(n => `## ${n.title}\n${n.body.slice(0, 400)}`).join("\n\n");
    return this.call(
      [{
        role: "user",
        content: `Today's structured commitments:\n${briefStr}\n\nRecent notes for context:\n${ctx}\n\nWrite a 3-4 sentence morning brief, in first person ("you"). Lead with anything overdue. Highlight any decisions or risks the PM should think about today. No bullet lists — flowing prose.`,
      }],
      `You are an assistant PM writing a daily standup brief for the product manager.`,
      400,
    );
  }
}

export function makeLLM(provider: string, apiKey: string, model: string): LLMService {
  if (provider === "anthropic" && apiKey) return new AnthropicLLM(apiKey, model);
  return new NullLLM();
}
