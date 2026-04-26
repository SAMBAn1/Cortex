import { openDB, type IDBPDatabase } from "idb";
import {
  type AppSettings,
  type Note,
  type NoteEdit,
  type NoteVersion,
  type StorageAdapter,
  DEFAULT_SETTINGS,
} from "./types";

const DB_NAME = "cortex";
const DB_VERSION = 1;

interface DB {
  notes: Note;
  edits: NoteEdit;
  versions: NoteVersion;
  settings: { key: string; value: AppSettings };
}

export class IdbAdapter implements StorageAdapter {
  private dbp: Promise<IDBPDatabase<any>>;

  constructor() {
    this.dbp = openDB<any>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("notes")) {
          const notes = db.createObjectStore("notes", { keyPath: "id" });
          notes.createIndex("updatedAt", "updatedAt");
          notes.createIndex("folder", "folder");
        }
        if (!db.objectStoreNames.contains("edits")) {
          const edits = db.createObjectStore("edits", { keyPath: "id" });
          edits.createIndex("noteId", "noteId");
          edits.createIndex("ts", "ts");
        }
        if (!db.objectStoreNames.contains("versions")) {
          const versions = db.createObjectStore("versions", { keyPath: "id" });
          versions.createIndex("noteId", "noteId");
        }
        if (!db.objectStoreNames.contains("settings")) {
          db.createObjectStore("settings", { keyPath: "key" });
        }
      },
    });
  }

  async ready() {
    await this.dbp;
  }

  async listNotes(): Promise<Note[]> {
    const db = await this.dbp;
    return (await db.getAll("notes")) as Note[];
  }

  async getNote(id: string) {
    const db = await this.dbp;
    return ((await db.get("notes", id)) as Note) ?? null;
  }

  async saveNote(note: Note) {
    const db = await this.dbp;
    await db.put("notes", note);
  }

  async deleteNote(id: string) {
    const db = await this.dbp;
    await db.delete("notes", id);
    const tx = db.transaction("edits", "readwrite");
    const idx = tx.store.index("noteId");
    let cur = await idx.openCursor(IDBKeyRange.only(id));
    while (cur) {
      await cur.delete();
      cur = await cur.continue();
    }
    await tx.done;
  }

  async appendEdit(edit: NoteEdit) {
    const db = await this.dbp;
    await db.put("edits", edit);
  }

  async listEdits(noteId: string) {
    const db = await this.dbp;
    return (await db.getAllFromIndex("edits", "noteId", noteId)) as NoteEdit[];
  }

  async saveVersion(v: NoteVersion) {
    const db = await this.dbp;
    await db.put("versions", v);
  }

  async listVersions(noteId: string) {
    const db = await this.dbp;
    return (await db.getAllFromIndex("versions", "noteId", noteId)) as NoteVersion[];
  }

  async getSettings(): Promise<AppSettings> {
    const db = await this.dbp;
    const row = (await db.get("settings", "app")) as { key: string; value: AppSettings } | undefined;
    return row?.value ?? DEFAULT_SETTINGS;
  }

  async saveSettings(s: AppSettings) {
    const db = await this.dbp;
    await db.put("settings", { key: "app", value: s });
  }
}

export type { DB };
