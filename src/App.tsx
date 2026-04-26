import { useEffect } from "react";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import NotesPage from "./pages/Notes";
import CalendarPage from "./pages/Calendar";
import GraphPage from "./pages/Graph";
import SettingsPage from "./pages/Settings";
import Toaster from "./components/Toaster";
import { useNotes } from "./store/notes";
import { useSettings } from "./store/settings";
import { seedIfEmpty } from "./lib/seed";

export default function App() {
  const loadNotes = useNotes(s => s.load);
  const loadedNotes = useNotes(s => s.loaded);
  const notesObj = useNotes(s => s.notes);
  const loadSettings = useSettings(s => s.load);
  const loadedSettings = useSettings(s => s.loaded);

  useEffect(() => {
    (async () => {
      await loadSettings();
      await loadNotes();
      await seedIfEmpty();
      await loadNotes();
    })();
  }, []);

  if (!loadedNotes || !loadedSettings) {
    return <div className="h-full flex items-center justify-center text-fg-subtle text-sm">Loading…</div>;
  }

  // suppress unused
  void notesObj;

  return (
    <HashRouter>
      <Toaster />
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/notes" element={<NotesPage />} />
          <Route path="/notes/:id" element={<NotesPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/graph" element={<GraphPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
