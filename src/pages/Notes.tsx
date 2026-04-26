import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useNotes } from "../store/notes";
import type { Note } from "../lib/storage/types";
import { Search, FolderPlus, FileText, ChevronRight, ChevronDown, Folder, Plus } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "../lib/cn";
import Editor from "../components/editor/Editor";

interface TreeNode {
  name: string;
  path: string;
  children: Record<string, TreeNode>;
  notes: { id: string; title: string; updatedAt: number }[];
}

function buildTree(notes: Record<string, Note>): TreeNode {
  const root: TreeNode = { name: "", path: "", children: {}, notes: [] };
  for (const n of Object.values(notes)) {
    const parts = n.folder ? n.folder.split("/").filter(Boolean) : [];
    let cur = root;
    for (const p of parts) {
      cur.children[p] ??= { name: p, path: cur.path ? `${cur.path}/${p}` : p, children: {}, notes: [] };
      cur = cur.children[p];
    }
    cur.notes.push({ id: n.id, title: n.title, updatedAt: n.updatedAt });
  }
  return root;
}

export default function NotesPage() {
  const { id } = useParams();
  const notes = useNotes(s => s.notes);
  const create = useNotes(s => s.create);
  const update = useNotes(s => s.update);
  const navigate = useNavigate();
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    if (!q.trim()) return notes;
    const needle = q.toLowerCase();
    const out: typeof notes = {};
    for (const n of Object.values(notes)) {
      if (n.title.toLowerCase().includes(needle) || n.body.toLowerCase().includes(needle) || n.tags.some(t => t.toLowerCase().includes(needle))) {
        out[n.id] = n;
      }
    }
    return out;
  }, [notes, q]);

  const tree = useMemo(() => buildTree(filtered), [filtered]);

  async function newInFolder(folder: string) {
    const n = await create({ folder });
    navigate(`/notes/${n.id}`);
  }

  return (
    <div className="h-full flex">
      <aside className="w-72 border-r border-border bg-bg-panel/40 flex flex-col">
        <div className="p-2 border-b border-border flex items-center gap-1">
          <div className="flex-1 flex items-center gap-2 bg-bg-elev rounded-lg px-2 py-1.5">
            <Search size={14} className="text-fg-subtle" />
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Search notes…"
              className="flex-1 bg-transparent outline-none text-sm placeholder:text-fg-subtle"
            />
          </div>
          <button onClick={() => newInFolder("")} title="New note" className="icon-btn h-9 w-9 text-accent"><Plus size={16} /></button>
          <button
            onClick={() => {
              const name = prompt("New folder name (e.g. work/projects)");
              if (!name) return;
              newInFolder(name);
            }}
            title="New folder"
            className="icon-btn h-9 w-9"
          ><FolderPlus size={16} /></button>
        </div>
        <div className="flex-1 overflow-auto p-1">
          <TreeView node={tree} depth={0} activeId={id} onPick={(nid) => navigate(`/notes/${nid}`)} onMove={async (nid, folder) => update(nid, { folder })} />
        </div>
      </aside>
      <div className="flex-1 min-w-0">
        {id ? <Editor key={id} noteId={id} /> : <Empty />}
      </div>
    </div>
  );
}

function TreeView({ node, depth, activeId, onPick, onMove }: {
  node: TreeNode; depth: number; activeId?: string;
  onPick: (id: string) => void;
  onMove: (id: string, folder: string) => Promise<void>;
}) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const childKeys = Object.keys(node.children).sort();

  return (
    <div>
      {childKeys.map(k => {
        const child = node.children[k];
        const isOpen = open[child.path] ?? true;
        return (
          <div key={child.path}>
            <button
              onClick={() => setOpen(o => ({ ...o, [child.path]: !isOpen }))}
              className="w-full flex items-center gap-1 px-1.5 py-1 rounded-md hover:bg-bg-panel text-xs text-fg-muted"
              style={{ paddingLeft: depth * 10 + 6 }}
              onDragOver={e => e.preventDefault()}
              onDrop={e => {
                const id = e.dataTransfer.getData("text/note-id");
                if (id) onMove(id, child.path);
              }}
            >
              {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              <Folder size={12} className="text-fg-subtle" />
              <span className="truncate">{child.name}</span>
              <span className="ml-auto text-fg-subtle">{Object.keys(child.children).length + child.notes.length}</span>
            </button>
            {isOpen && <TreeView node={child} depth={depth + 1} activeId={activeId} onPick={onPick} onMove={onMove} />}
          </div>
        );
      })}
      {node.notes.sort((a, b) => b.updatedAt - a.updatedAt).map(n => (
        <div
          key={n.id}
          role="button"
          tabIndex={0}
          draggable
          onDragStart={e => e.dataTransfer.setData("text/note-id", n.id)}
          onClick={() => onPick(n.id)}
          onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onPick(n.id); } }}
          className={cn(
            "w-full flex items-center gap-2 px-1.5 py-1.5 rounded-md text-left text-sm group cursor-pointer select-none",
            n.id === activeId ? "bg-accent-muted text-accent" : "hover:bg-bg-panel text-fg",
          )}
          style={{ paddingLeft: depth * 10 + 22 }}
          title={n.title}
        >
          <FileText size={13} className="shrink-0 text-fg-subtle group-hover:text-fg" />
          <span className="truncate flex-1">{n.title || "Untitled"}</span>
          <span className="text-[10px] text-fg-subtle">{formatDistanceToNow(n.updatedAt).split(" ")[0]}</span>
        </div>
      ))}
    </div>
  );
}

function Empty() {
  return (
    <div className="h-full flex items-center justify-center text-fg-muted text-sm">
      Pick a note from the sidebar — or create one.
    </div>
  );
}
