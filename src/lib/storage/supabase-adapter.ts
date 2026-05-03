import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  type AppSettings,
  type Note,
  type NoteEdit,
  type NoteVersion,
  type StorageAdapter,
  DEFAULT_SETTINGS,
} from "./types";

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

export function getSupabaseConfig(): SupabaseConfig | null {
  // Test mode forces local-only IDB so E2E tests don't need to authenticate.
  if (import.meta.env.VITE_TEST_MODE === "1") return null;
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

export class SupabaseAdapter implements StorageAdapter {
  client: SupabaseClient;
  private userIdPromise: Promise<string | null>;

  constructor(cfg: SupabaseConfig) {
    this.client = createClient(cfg.url, cfg.anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
    this.userIdPromise = this.client.auth.getUser().then(r => r.data.user?.id ?? null);
    this.client.auth.onAuthStateChange(() => {
      this.userIdPromise = this.client.auth.getUser().then(r => r.data.user?.id ?? null);
    });
  }

  private async uid(): Promise<string> {
    const id = await this.userIdPromise;
    if (!id) throw new Error("Not signed in");
    return id;
  }

  async ready() {
    await this.userIdPromise;
  }

  async listNotes(): Promise<Note[]> {
    const uid = await this.uid();
    const { data, error } = await this.client.from("notes").select("*").eq("user_id", uid);
    if (error) throw error;
    return (data ?? []).map(rowToNote);
  }

  async getNote(id: string): Promise<Note | null> {
    await this.uid();
    const { data, error } = await this.client.from("notes").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data ? rowToNote(data) : null;
  }

  async saveNote(note: Note) {
    const uid = await this.uid();
    const row = noteToRow(note, uid);
    const { error } = await this.client.from("notes").upsert(row);
    if (error) throw error;
  }

  async deleteNote(id: string) {
    await this.uid();
    const { error } = await this.client.from("notes").delete().eq("id", id);
    if (error) throw error;
  }

  async appendEdit(edit: NoteEdit) {
    const uid = await this.uid();
    const { error } = await this.client.from("edits").insert({
      id: edit.id,
      user_id: uid,
      note_id: edit.noteId,
      ts: new Date(edit.ts).toISOString(),
      added: edit.added,
      removed: edit.removed,
    });
    if (error) throw error;
  }

  async listEdits(noteId: string): Promise<NoteEdit[]> {
    await this.uid();
    const { data, error } = await this.client.from("edits").select("*").eq("note_id", noteId).order("ts");
    if (error) throw error;
    return (data ?? []).map(r => ({
      id: r.id,
      noteId: r.note_id,
      ts: new Date(r.ts).getTime(),
      added: r.added ?? [],
      removed: r.removed ?? [],
    }));
  }

  async saveVersion(v: NoteVersion) {
    const uid = await this.uid();
    const { error } = await this.client.from("versions").insert({
      id: v.id, user_id: uid, note_id: v.noteId, ts: new Date(v.ts).toISOString(), body: v.body,
    });
    if (error) throw error;
  }

  async listVersions(noteId: string): Promise<NoteVersion[]> {
    await this.uid();
    const { data, error } = await this.client.from("versions").select("*").eq("note_id", noteId).order("ts");
    if (error) throw error;
    return (data ?? []).map(r => ({ id: r.id, noteId: r.note_id, ts: new Date(r.ts).getTime(), body: r.body }));
  }

  async getSettings(): Promise<AppSettings> {
    const uid = await this.uid();
    const { data, error } = await this.client.from("settings").select("data").eq("user_id", uid).maybeSingle();
    if (error) throw error;
    return data?.data ? { ...DEFAULT_SETTINGS, ...data.data } : DEFAULT_SETTINGS;
  }

  async saveSettings(s: AppSettings) {
    const uid = await this.uid();
    const { error } = await this.client.from("settings").upsert({ user_id: uid, data: s, updated_at: new Date().toISOString() });
    if (error) throw error;
  }
}

function noteToRow(n: Note, uid: string) {
  return {
    id: n.id,
    user_id: uid,
    title: n.title,
    body: n.body,
    folder: n.folder,
    tags: n.tags,
    dates: n.dates,
    links: n.links,
    completed: !!n.completed,
    created_at: new Date(n.createdAt).toISOString(),
    updated_at: new Date(n.updatedAt).toISOString(),
  };
}

function rowToNote(r: any): Note {
  return {
    id: r.id,
    title: r.title ?? "Untitled",
    body: r.body ?? "",
    folder: r.folder ?? "",
    tags: r.tags ?? [],
    dates: r.dates ?? [],
    links: r.links ?? [],
    completed: !!r.completed,
    createdAt: new Date(r.created_at).getTime(),
    updatedAt: new Date(r.updated_at).getTime(),
  };
}
