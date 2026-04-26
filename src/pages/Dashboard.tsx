import { useNavigate } from "react-router-dom";
import Timeline from "../components/dashboard/Timeline";
import ActivityChart from "../components/dashboard/ActivityChart";
import QuickCapture from "../components/dashboard/QuickCapture";
import AIPanel from "../components/dashboard/AIPanel";
import RecentNotes from "../components/dashboard/RecentNotes";
import { useSettings } from "../store/settings";
import { useNotes } from "../store/notes";
import { cn } from "../lib/cn";

export default function Dashboard() {
  const navigate = useNavigate();
  const side = useSettings(s => s.settings.aiPanelSide);
  const notesCount = useNotes(s => Object.keys(s.notes).length);

  return (
    <div className="h-full flex flex-col p-4 gap-3 overflow-hidden">
      {/* Top: full-width timeline */}
      <Timeline onOpenCalendar={() => navigate("/calendar")} />

      {/* Middle: capture + AI */}
      <div className={cn("grid gap-3 min-h-0", side === "right" ? "grid-cols-[1fr_340px]" : "grid-cols-[340px_1fr]")} style={{ flex: "1 1 0" }}>
        {side === "left" && <AIPanel />}
        <div className="flex flex-col gap-3 min-h-0 overflow-auto">
          <QuickCapture />
          {notesCount > 0 ? <RecentNotes /> : <EmptyState />}
        </div>
        {side === "right" && <AIPanel />}
      </div>

      {/* Bottom: full-width activity chart */}
      <div className="h-44 shrink-0">
        <ActivityChart />
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="panel p-8 text-center">
      <div className="text-sm text-fg-muted max-w-sm mx-auto">
        Your second brain starts empty. Capture a thought above — try writing
        <span className="text-accent"> "review the roadmap by next Friday #planning [[Q3 OKRs]]" </span>
        to see how Cortex parses dates, tags, and links.
      </div>
    </div>
  );
}
