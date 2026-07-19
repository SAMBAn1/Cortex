import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { useNotes } from './store/notes'

if (import.meta.env.DEV) {
  (window as any).__cortex = { notes: useNotes };
}

// We intentionally do NOT wrap App in StrictMode. CodeMirror's view plugins (autocomplete,
// live-preview) hold imperative state on the EditorView instance; StrictMode's intentional
// double-mount in development creates duplicate view plugin instances, leaving one orphaned
// and breaking tooltips. The trade-off is small; production behavior is unaffected.
createRoot(document.getElementById('root')!).render(<App />);
