import { getStorage } from "./storage";
import { useNotes } from "../store/notes";

const SEED_KEY = "cortex_seeded_v1";

export async function seedIfEmpty() {
  if (localStorage.getItem(SEED_KEY)) return;
  const storage = getStorage();
  const existing = await storage.listNotes();
  if (existing.length > 0) {
    localStorage.setItem(SEED_KEY, "1");
    return;
  }
  const create = useNotes.getState().create;
  await create({
    folder: "welcome",
    body: `# Welcome to Cortex

Cortex is your second brain — a place to capture thoughts, surface what matters, and never lose a commitment.

## Try it out
- Type any thought in the **Quick Capture** box on the dashboard
- Use [[wikilinks]] to connect notes — see the **Graph** view
- Use #tags to organize
- Mention dates naturally — *"review with Maya next Tuesday at 4pm"* — and they'll appear on the **Timeline** and **Calendar**

## Today's commitments
- [ ] Skim the [Settings](/) and add your Anthropic API key for AI suggestions tomorrow
- [ ] Try writing a note that links to [[Roadmap Q3]]

## Why this exists
As a product manager, signal lives in noise. Cortex parses what you write so you can see your week at a glance, and uses an LLM to surface ideas you've left on the table.
`,
  });
  await create({
    folder: "welcome",
    body: `# Roadmap Q3

Big themes for the quarter:
- Ship onboarding revamp by **end of next month**
- Customer interviews — schedule 5 by **Friday**
- Review pricing experiment results in **3 weeks**

Linked: [[Welcome to Cortex]]

#planning #q3
`,
  });
  localStorage.setItem(SEED_KEY, "1");
}
