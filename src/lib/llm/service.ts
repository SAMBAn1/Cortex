import type { Note } from "../storage/types";

export interface LLMSuggestion {
  title: string;
  body: string;
  noteIds?: string[];
}

export interface LLMService {
  available(): boolean;
  suggest(notes: Note[], context?: string): Promise<LLMSuggestion[]>;
  ask(prompt: string, notes: Note[]): Promise<string>;
}

/** Best-effort fetch and strip-to-text of a URL. CORS may block; gracefully ignore failures. */
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
  async suggest() { return []; }
  async ask() { return "Configure an LLM provider in Settings to get AI suggestions."; }
}

class AnthropicLLM implements LLMService {
  apiKey: string;
  model: string;
  constructor(apiKey: string, model: string) { this.apiKey = apiKey; this.model = model; }
  available() { return !!this.apiKey; }

  private async call(messages: { role: "user" | "assistant"; content: string }[], system?: string): Promise<string> {
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
        max_tokens: 1024,
        system,
        messages,
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`Anthropic ${res.status}: ${t}`);
    }
    const data = await res.json();
    return data.content?.[0]?.text ?? "";
  }

  async suggest(notes: Note[]): Promise<LLMSuggestion[]> {
    if (!notes.length) return [];
    const ctx = notes.slice(0, 30).map(n =>
      `## ${n.title}\nFolder: ${n.folder || "/"}\nUpdated: ${new Date(n.updatedAt).toISOString().slice(0,10)}\nTags: ${n.tags.join(", ") || "—"}\n---\n${n.body.slice(0, 800)}`
    ).join("\n\n");
    const out = await this.call([{
      role: "user",
      content:
`You are a thoughtful second-brain assistant for a product manager. Below are recent notes from their knowledge vault. Surface 3 short, specific suggestions for what they might do next. Each suggestion should reference one or more of these notes by title and propose a concrete next action. Return strict JSON: [{"title":"...","body":"...","noteIds":["title1","title2"]}].

NOTES:
${ctx}`,
    }]);
    try {
      const json = JSON.parse(out.match(/\[[\s\S]*\]/)?.[0] ?? "[]");
      return Array.isArray(json) ? json.slice(0, 5) : [];
    } catch {
      return [{ title: "Suggestion", body: out.slice(0, 600) }];
    }
  }

  async ask(prompt: string, notes: Note[]): Promise<string> {
    const ctx = notes.slice(0, 20).map(n => `## ${n.title}\n${n.body.slice(0, 600)}`).join("\n\n");
    return this.call(
      [{ role: "user", content: prompt }],
      `You are the user's second-brain assistant. Answer concisely. Reference notes when relevant.\n\nVAULT NOTES:\n${ctx}`,
    );
  }
}

export function makeLLM(provider: string, apiKey: string, model: string): LLMService {
  if (provider === "anthropic" && apiKey) return new AnthropicLLM(apiKey, model);
  return new NullLLM();
}
