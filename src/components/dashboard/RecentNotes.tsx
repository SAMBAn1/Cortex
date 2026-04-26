import { useNavigate } from "react-router-dom";
import { useNotes } from "../../store/notes";
import { FileText, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function RecentNotes() {
  const notes = useNotes(s => s.notes);
  const navigate = useNavigate();
  const recent = Object.values(notes).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 8);

  if (recent.length === 0) return null;

  return (
    <div className="panel p-3 mt-3">
      <div className="flex items-center gap-2 mb-2 px-1 text-xs uppercase tracking-wider text-fg-subtle">
        <Clock size={12} /> Recent
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {recent.map(n => (
          <button
            key={n.id}
            onClick={() => navigate(`/notes/${n.id}`)}
            className="text-left p-2 rounded-md hover:bg-bg-panel transition-colors flex items-start gap-2 min-w-0"
          >
            <FileText size={14} className="text-fg-subtle mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-sm truncate text-fg">{n.title}</div>
              <div className="text-[11px] text-fg-subtle">{formatDistanceToNow(n.updatedAt, { addSuffix: true })}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
