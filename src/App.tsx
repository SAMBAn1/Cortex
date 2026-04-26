import { useEffect, useState } from "react";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import NotesPage from "./pages/Notes";
import CalendarPage from "./pages/Calendar";
import GraphPage from "./pages/Graph";
import SettingsPage from "./pages/Settings";
import Toaster from "./components/Toaster";
import AuthGate from "./components/AuthGate";
import ErrorBoundary from "./components/ErrorBoundary";
import { useNotes } from "./store/notes";
import { useSettings } from "./store/settings";
import { seedIfEmpty } from "./lib/seed";
import { isCloudMode, getSupabase } from "./lib/storage";

export default function App() {
  const loadNotes = useNotes(s => s.load);
  const loadedNotes = useNotes(s => s.loaded);
  const loadSettings = useSettings(s => s.load);
  const loadedSettings = useSettings(s => s.loaded);
  const [authedTick, setAuthedTick] = useState(0);

  // In cloud mode, re-load when auth state changes
  useEffect(() => {
    if (!isCloudMode()) return;
    const sb = getSupabase();
    if (!sb) return;
    const { data: sub } = sb.client.auth.onAuthStateChange((_e, _s) => {
      setAuthedTick(t => t + 1);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    (async () => {
      if (isCloudMode()) {
        const sb = getSupabase();
        const { data } = await sb!.client.auth.getSession();
        if (!data.session) return;
      }
      await loadSettings();
      await loadNotes();
      await seedIfEmpty();
      await loadNotes();
    })();
  }, [authedTick]);

  return (
    <ErrorBoundary>
    <AuthGate>
      {(!loadedNotes || !loadedSettings) ? (
        <div className="h-full flex items-center justify-center text-fg-subtle text-sm">Loading…</div>
      ) : (
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
      )}
    </AuthGate>
    </ErrorBoundary>
  );
}
