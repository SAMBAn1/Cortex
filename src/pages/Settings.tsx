import { useState } from "react";
import { useSettings } from "../store/settings";
import { useNotes } from "../store/notes";
import { Eye, EyeOff, Sun, Moon, Download, Upload, Trash2, Sparkles, PanelLeft, PanelRight, LogOut, User } from "lucide-react";
import { cn } from "../lib/cn";
import { getStorage, isCloudMode } from "../lib/storage";
import { signOut, getUserEmail } from "../components/AuthGate";

export default function SettingsPage() {
  const { settings, save } = useSettings();
  const notes = useNotes(s => s.notes);
  const load = useNotes(s => s.load);
  const [showKey, setShowKey] = useState(false);

  function exportAll() {
    const blob = new Blob([JSON.stringify({ notes: Object.values(notes), settings }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cortex-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importAll(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const data = JSON.parse(text);
    const storage = getStorage();
    if (data.notes) for (const n of data.notes) await storage.saveNote(n);
    if (data.settings) await save(data.settings);
    await load();
    alert("Imported.");
  }

  async function nuke() {
    if (!confirm("Delete ALL notes and settings? This cannot be undone.")) return;
    const storage = getStorage();
    for (const id of Object.keys(notes)) await storage.deleteNote(id);
    await load();
  }

  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-xl font-medium">Settings</h1>
          <p className="text-sm text-fg-muted">Configure your second brain.</p>
        </div>

        {isCloudMode() && (
          <Section title="Account" icon={<User size={14} className="text-accent" />}>
            <Row label="Signed in as">
              <span className="text-sm text-fg font-medium">{getUserEmail() || "—"}</span>
            </Row>
            <Row label="Session">
              <button
                onClick={async () => {
                  if (confirm("Sign out of Cortex?")) await signOut();
                }}
                className="text-sm flex items-center gap-1.5 px-3 py-1.5 rounded-md text-danger hover:bg-danger/10"
              >
                <LogOut size={14} /> Sign out
              </button>
            </Row>
          </Section>
        )}

        <Section title="Appearance">
          <Row label="Theme">
            <div className="flex gap-1">
              <ToggleBtn active={settings.theme === "light"} onClick={() => save({ theme: "light" })}><Sun size={14}/> Light</ToggleBtn>
              <ToggleBtn active={settings.theme === "dark"} onClick={() => save({ theme: "dark" })}><Moon size={14}/> Dark</ToggleBtn>
            </div>
          </Row>
          <Row label="AI panel">
            <div className="flex gap-1">
              <ToggleBtn active={settings.aiPanelSide === "left"} onClick={() => save({ aiPanelSide: "left" })}><PanelLeft size={14}/> Left</ToggleBtn>
              <ToggleBtn active={settings.aiPanelSide === "right"} onClick={() => save({ aiPanelSide: "right" })}><PanelRight size={14}/> Right</ToggleBtn>
            </div>
          </Row>
        </Section>

        <Section title="AI / LLM" icon={<Sparkles size={14} className="text-accent" />}>
          <Row label="Provider">
            <select
              value={settings.llmProvider}
              onChange={e => save({ llmProvider: e.target.value as any })}
              className="bg-bg-panel border border-border rounded-md px-2 py-1.5 text-sm"
            >
              <option value="anthropic">Anthropic (Claude)</option>
              <option value="none">None</option>
            </select>
          </Row>
          <Row label="Model">
            <input
              value={settings.llmModel}
              onChange={e => save({ llmModel: e.target.value })}
              placeholder="claude-sonnet-4-6"
              className="bg-bg-panel border border-border rounded-md px-2 py-1.5 text-sm flex-1 max-w-xs"
            />
          </Row>
          <Row label="API key">
            <div className="flex items-center gap-1 flex-1 max-w-md">
              <input
                value={settings.llmApiKey}
                onChange={e => save({ llmApiKey: e.target.value })}
                type={showKey ? "text" : "password"}
                placeholder="sk-ant-…"
                className="bg-bg-panel border border-border rounded-md px-2 py-1.5 text-sm flex-1 font-mono"
              />
              <button onClick={() => setShowKey(s => !s)} className="icon-btn h-9 w-9">
                {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </Row>
          <p className="text-[11px] text-fg-subtle px-1">
            Stored locally in this browser. Calls go directly from your browser to the provider.
          </p>
        </Section>

        <Section title="Data">
          <Row label="Total notes"><span className="text-sm">{Object.keys(notes).length}</span></Row>
          <Row label="Backup">
            <div className="flex gap-1">
              <button onClick={exportAll} className="text-sm flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-bg-panel hover:bg-border">
                <Download size={14} /> Export JSON
              </button>
              <label className="text-sm flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-bg-panel hover:bg-border cursor-pointer">
                <Upload size={14} /> Import
                <input type="file" accept="application/json" onChange={importAll} className="hidden" />
              </label>
            </div>
          </Row>
          <Row label="Danger">
            <button onClick={nuke} className="text-sm flex items-center gap-1.5 px-3 py-1.5 rounded-md text-danger hover:bg-danger/10">
              <Trash2 size={14} /> Delete all data
            </button>
          </Row>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="panel p-4">
      <div className="flex items-center gap-2 mb-3 text-xs uppercase tracking-wider text-fg-subtle">
        {icon} {title}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="text-sm text-fg-muted w-32 shrink-0">{label}</div>
      <div className="flex-1 flex justify-end">{children}</div>
    </div>
  );
}

function ToggleBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "text-sm px-3 py-1.5 rounded-md flex items-center gap-1.5",
        active ? "bg-accent-muted text-accent" : "bg-bg-panel hover:bg-border text-fg-muted",
      )}
    >{children}</button>
  );
}
