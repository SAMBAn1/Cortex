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
  ideas(notes: Note[]): Promise<LLMSuggestion[]>;
  ask(prompt: string, notes: Note[]): Promise<string>;
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

/** Shared prompt logic across providers. Subclasses only implement the network `call`. */
abstract class BaseLLM implements LLMService {
  abstract available(): boolean;
  protected abstract call(userMessage: string, system: string, maxTokens: number): Promise<string>;

  async ideas(notes: Note[]): Promise<LLMSuggestion[]> {
    if (!notes.length) return [];
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

    const out = await this.call(`NOTES:\n\n${ctx}\n\nReturn JSON.`, system, 1500);
    try {
      const json = JSON.parse(out.match(/\[[\s\S]*\]/)?.[0] ?? "[]");
      return Array.isArray(json) ? json.slice(0, 5) : [];
    } catch {
      return [{ title: "Suggestion", body: out.slice(0, 600) }];
    }
  }

  async ask(prompt: string, notes: Note[]): Promise<string> {
    const ctx = notes.slice(0, 25).map(n => `## ${n.title}\n${n.body.slice(0, 700)}`).join("\n\n");
    const system = `You are the user's second-brain assistant. Answer concisely. Cite notes by title when you reference them.\n\nVAULT NOTES:\n${ctx}`;
    return this.call(prompt, system, 800);
  }

  async briefSummary(brief: DailyBrief, notes: Note[]): Promise<string> {
    if (!brief.overdue.length && !brief.today.length && !brief.upcoming.length) {
      return "Nothing scheduled. Use the time to catch up on long-running threads or archive stale notes.";
    }
    const briefStr = JSON.stringify(brief, null, 2);
    const ctx = notes.slice(0, 15).map(n => `## ${n.title}\n${n.body.slice(0, 400)}`).join("\n\n");
    const user = `Today's structured commitments:\n${briefStr}\n\nRecent notes for context:\n${ctx}\n\nWrite a 3-4 sentence morning brief, in first person ("you"). Lead with anything overdue. Highlight any decisions or risks the PM should think about today. No bullet lists — flowing prose.`;
    return this.call(user, `You are an assistant PM writing a daily standup brief for the product manager.`, 400);
  }
}

class AnthropicLLM extends BaseLLM {
  apiKey: string;
  model: string;
  constructor(apiKey: string, model: string) { super(); this.apiKey = apiKey; this.model = model; }
  available() { return !!this.apiKey; }

  protected async call(userMessage: string, system: string, maxTokens: number): Promise<string> {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: maxTokens,
        system,
        messages: [{ role: "user", content: userMessage }],
      }),
    });
    if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const data = await res.json();
    return data.content?.[0]?.text ?? "";
  }
}

class GeminiLLM extends BaseLLM {
  apiKey: string;
  model: string;
  constructor(apiKey: string, model: string) { super(); this.apiKey = apiKey; this.model = model; }
  available() { return !!this.apiKey; }

  protected async call(userMessage: string, system: string, maxTokens: number): Promise<string> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.model)}:generateContent?key=${encodeURIComponent(this.apiKey)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: userMessage }] }],
        systemInstruction: { parts: [{ text: system }] },
        generationConfig: { maxOutputTokens: maxTokens, temperature: 0.7 },
      }),
    });
    if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const data = await res.json();
    const parts = data.candidates?.[0]?.content?.parts ?? [];
    return parts.map((p: any) => p.text ?? "").join("");
  }
}

/** Default model for each provider. */
export function defaultModel(provider: string): string {
  if (provider === "gemini") return "gemini-2.5-flash";
  if (provider === "anthropic") return "claude-sonnet-4-6";
  return "";
}

export function makeLLM(provider: string, apiKey: string, model: string): LLMService {
  if (!apiKey) return new NullLLM();
  const m = model || defaultModel(provider);
  if (provider === "anthropic") return new AnthropicLLM(apiKey, m);
  if (provider === "gemini") return new GeminiLLM(apiKey, m);
  return new NullLLM();
}
