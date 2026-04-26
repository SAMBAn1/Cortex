import { create } from "zustand";
import { getStorage } from "../lib/storage";
import { DEFAULT_SETTINGS, type AppSettings } from "../lib/storage/types";
import { makeLLM, type LLMService } from "../lib/llm/service";

interface SettingsState {
  settings: AppSettings;
  llm: LLMService;
  loaded: boolean;
  load: () => Promise<void>;
  save: (patch: Partial<AppSettings>) => Promise<void>;
}

const storage = getStorage();

export const useSettings = create<SettingsState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  llm: makeLLM(DEFAULT_SETTINGS.llmProvider, DEFAULT_SETTINGS.llmApiKey, DEFAULT_SETTINGS.llmModel),
  loaded: false,

  async load() {
    await storage.ready();
    const s = await storage.getSettings();
    set({
      settings: s,
      llm: makeLLM(s.llmProvider, s.llmApiKey, s.llmModel),
      loaded: true,
    });
    applyTheme(s.theme);
  },

  async save(patch) {
    const next = { ...get().settings, ...patch };
    await storage.saveSettings(next);
    set({
      settings: next,
      llm: makeLLM(next.llmProvider, next.llmApiKey, next.llmModel),
    });
    if (patch.theme) applyTheme(patch.theme);
  },
}));

function applyTheme(theme: "light" | "dark") {
  if (theme === "dark") document.documentElement.classList.add("dark");
  else document.documentElement.classList.remove("dark");
}
