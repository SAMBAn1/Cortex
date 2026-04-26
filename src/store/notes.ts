import { create } from "zustand";
import { getStorage } from "../lib/storage";
import type { Note, NoteEdit, NoteVersion } from "../lib/storage/types";
import { extractDates } from "../lib/parse/dates";
import { extractTags, extractWikilinks, deriveTitle, lineDiff } from "../lib/parse/markdown";
import { uid } from "../lib/cn";

interface NotesState {
  notes: Record<string, Note>;
  loaded: boolean;
  load: () => Promise<void>;
  create: (init?: Partial<Note>) => Promise<Note>;
  update: (id: string, patch: { body?: string; folder?: string; completed?: boolean; title?: string }) => Promise<void>;
  remove: (id: string) => Promise<void>;
  edits: Record<string, NoteEdit[]>;
  loadEdits: (id: string) => Promise<NoteEdit[]>;
  loadVersions: (id: string) => Promise<NoteVersion[]>;
}

const storage = getStorage();

export const useNotes = create<NotesState>((set, get) => ({
  notes: {},
  edits: {},
  loaded: false,

  async load() {
    await storage.ready();
    const all = await storage.listNotes();
    const map: Record<string, Note> = {};
    for (const n of all) map[n.id] = n;
    set({ notes: map, loaded: true });
  },

  async create(init = {}) {
    const now = Date.now();
    const body = init.body ?? "";
    const note: Note = {
      id: init.id ?? uid("n"),
      title: init.title ?? deriveTitle(body, "Untitled"),
      body,
      folder: init.folder ?? "",
      tags: extractTags(body),
      createdAt: now,
      updatedAt: now,
      dates: extractDates(body),
      links: extractWikilinks(body),
      completed: false,
    };
    await storage.saveNote(note);
    await storage.saveVersion({ id: uid("v"), noteId: note.id, ts: now, body });
    set(s => ({ notes: { ...s.notes, [note.id]: note } }));
    return note;
  },

  async update(id, patch) {
    const prev = get().notes[id];
    if (!prev) return;
    const body = patch.body ?? prev.body;
    const next: Note = {
      ...prev,
      ...patch,
      body,
      title: patch.title ?? (patch.body !== undefined ? deriveTitle(body, prev.title) : prev.title),
      tags: patch.body !== undefined ? extractTags(body) : prev.tags,
      dates: patch.body !== undefined ? extractDates(body) : prev.dates,
      links: patch.body !== undefined ? extractWikilinks(body) : prev.links,
      updatedAt: Date.now(),
    };
    await storage.saveNote(next);
    if (patch.body !== undefined && patch.body !== prev.body) {
      const diff = lineDiff(prev.body, body);
      if (diff.added.length || diff.removed.length) {
        const edit: NoteEdit = {
          id: uid("e"),
          noteId: id,
          ts: next.updatedAt,
          added: diff.added,
          removed: diff.removed,
        };
        await storage.appendEdit(edit);
        set(s => ({ edits: { ...s.edits, [id]: [...(s.edits[id] ?? []), edit] } }));
      }
    }
    set(s => ({ notes: { ...s.notes, [id]: next } }));
  },

  async remove(id) {
    await storage.deleteNote(id);
    set(s => {
      const { [id]: _, ...rest } = s.notes;
      const { [id]: __, ...restE } = s.edits;
      return { notes: rest, edits: restE };
    });
  },

  async loadEdits(id) {
    const edits = await storage.listEdits(id);
    set(s => ({ edits: { ...s.edits, [id]: edits } }));
    return edits;
  },

  async loadVersions(id) {
    return storage.listVersions(id);
  },
}));
