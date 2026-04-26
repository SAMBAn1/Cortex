export interface Note {
  id: string;
  title: string;
  body: string;
  folder: string;            // e.g. "" or "work/projects"
  tags: string[];
  createdAt: number;         // epoch ms
  updatedAt: number;
  /** Parsed dates / ETAs found inside the note (auto-extracted on save). */
  dates: ExtractedDate[];
  /** Backlinks computed from [[wikilinks]] in body. */
  links: string[];
  /** True if the user marked the note's "task" complete. */
  completed?: boolean;
}

export interface ExtractedDate {
  /** ISO date or datetime string. */
  iso: string;
  /** Original text matched in the note. */
  raw: string;
  /** Line number where it was found (1-indexed). */
  line: number;
  /** Optional context: characters around the match. */
  context: string;
  /** True if user-marked as done (via [x] in same line, etc). */
  done?: boolean;
}

export interface NoteEdit {
  id: string;
  noteId: string;
  ts: number;
  /** Concise per-line diff: lines added & removed. */
  added: { line: number; text: string }[];
  removed: { line: number; text: string }[];
}

export interface NoteVersion {
  id: string;
  noteId: string;
  ts: number;
  body: string;
}

export interface AppSettings {
  theme: "light" | "dark";
  llmProvider: "anthropic" | "openai" | "none";
  llmApiKey: string;
  llmModel: string;
  aiPanelSide: "left" | "right";
  vaultMode: "indexeddb" | "filesystem";
  /** When using fs adapter, the directory handle id stored. */
  vaultName?: string;
}

export interface StorageAdapter {
  ready(): Promise<void>;

  listNotes(): Promise<Note[]>;
  getNote(id: string): Promise<Note | null>;
  saveNote(note: Note): Promise<void>;
  deleteNote(id: string): Promise<void>;

  appendEdit(edit: NoteEdit): Promise<void>;
  listEdits(noteId: string): Promise<NoteEdit[]>;

  saveVersion(version: NoteVersion): Promise<void>;
  listVersions(noteId: string): Promise<NoteVersion[]>;

  getSettings(): Promise<AppSettings>;
  saveSettings(s: AppSettings): Promise<void>;
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: "dark",
  llmProvider: "anthropic",
  llmApiKey: "",
  llmModel: "claude-sonnet-4-6",
  aiPanelSide: "right",
  vaultMode: "indexeddb",
};
