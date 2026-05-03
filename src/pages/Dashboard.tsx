import { useNavigate } from "react-router-dom";
import Timeline from "../components/dashboard/Timeline";
import CaptureSearch from "../components/dashboard/CaptureSearch";
import AIPanel from "../components/dashboard/AIPanel";

export default function Dashboard() {
  const navigate = useNavigate();
  return (
    <div className="h-full flex flex-col p-4 gap-3 overflow-hidden">
      <Timeline onOpenCalendar={() => navigate("/calendar")} />
      <CaptureSearch />
      <div className="flex-1 min-h-0">
        <AIPanel />
      </div>
    </div>
  );
}
