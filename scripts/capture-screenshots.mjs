// One-shot Playwright script: seeds PM-flavored notes into the local dev app
// and captures screenshots of every marketing-relevant view into docs/screenshots/.
//
// Usage:
//   Terminal A: npm run dev:test      # test mode -> port 5174, no auth, no seed
//   Terminal B: node scripts/capture-screenshots.mjs

import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "..", "docs", "screenshots");
const BASE = "http://localhost:5174";

// PM-flavored notes. Dates are relative to "today" (July 19, 2026) but the app
// uses chrono-node so natural language like "next Tuesday" works from any date.
const NOTES = [
  {
    folder: "planning",
    body: `# Roadmap Q3

Big themes for the quarter:
- Ship onboarding revamp by **end of next month**
- Customer interviews — schedule 5 by **Friday**
- Review pricing experiment results in **3 weeks**
- Kill the legacy dashboard endpoint by **August 30**

Linked: [[Onboarding Revamp]] · [[Pricing Experiment]] · [[Customer Interviews]]

#planning #q3`,
  },
  {
    folder: "planning",
    body: `# Onboarding Revamp

Goal: cut time-to-first-value from 8 min to under 3.

## Open questions
- Do we ship the guided tour behind a feature flag or force it for new signups?
- Product marketing wants to A/B the welcome email — talk to Priya **tomorrow**
- Engineering estimate: 2 sprints. Kickoff **next Monday at 10am**.

## Decisions
- ✅ Skip the video walkthrough — data shows <4% completion
- ✅ Default folders: Inbox, Planning, Meetings, Ideas

Linked: [[Roadmap Q3]] · [[Customer Interviews]]

#onboarding #design`,
  },
  {
    folder: "meetings",
    body: `# Weekly 1:1 with Maya

**Date:** review with Maya **next Tuesday at 4pm**

## Agenda
- Retention numbers for the free tier
- Should we pull forward the mobile beta?
- Her feedback on the pricing memo

## Notes
- [ ] Share the [[Pricing Experiment]] doc before the meeting
- [ ] Ask about hiring bandwidth for Q4
- She flagged the churn spike in cohort week 3 — dig into support tickets

#1on1 #maya`,
  },
  {
    folder: "ideas",
    body: `# Idea: In-app "why did we ship this?" tooltip

Every shipped feature carries silent context that gets lost in six months.

What if each feature card in Settings had a small ⓘ icon that opened a modal with:
- Original problem statement
- Who requested it
- Success metric + current value

Cost: small. Storytelling value for new hires: high.

Follow-up **in 2 weeks** once onboarding lands.

#ideas #internal-tooling`,
  },
  {
    folder: "meetings",
    body: `# Customer Interviews

Batch of 5 to schedule by **Friday**. Targeting Series B PMs on our free plan who upgraded within 90 days.

## Confirmed
- ✅ Lena (Acme) — **this Thursday 2pm**
- ✅ Rohan (Northwind) — **next Wednesday 11am**

## Reaching out
- [ ] Sophia (Contoso) — sent invite yesterday
- [ ] Ken (Fabrikam) — waiting on Slack reply
- [ ] TBD — ask Maya for a warm intro

Prep doc: [[Interview Script v2]]

Linked: [[Roadmap Q3]] · [[Onboarding Revamp]]

#research #customers`,
  },
  {
    folder: "planning",
    body: `# Pricing Experiment

3-cell test running since **June 15**. Results due **in 3 weeks**.

## Cells
- Control — $12/mo
- B — $19/mo with 14-day trial
- C — $19/mo, no trial, 60-day money-back

## What we're watching
- Trial-to-paid conversion
- 30-day retention post-conversion
- ARPU × retention

Suspicion: Cell B wins on volume, C wins on ARPU. Bet on C if the gap is <15%.

Linked: [[Roadmap Q3]] · [[Weekly 1:1 with Maya]]

#pricing #experiment`,
  },
  {
    folder: "inbox",
    body: `# Interview Script v2

Warm up (5 min) → jobs-to-be-done (15 min) → walk through their current workflow (15 min) → show low-fi mock (10 min) → open feedback (5 min).

Cardinal rule: don't ask if they like it — ask what they *do*.

#research`,
  },
];

async function waitForServer(page, tries = 30) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 2000 });
      if (res && res.ok()) return;
    } catch {}
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error(`Dev server never came up at ${BASE}`);
}

async function seed(page) {
  await page.waitForFunction(() => (window).__cortex?.notes?.getState, null, { timeout: 10000 });
  await page.evaluate(async (notes) => {
    const store = (window).__cortex.notes.getState();
    for (const n of notes) {
      await store.create(n);
    }
  }, NOTES);
  // Give the store & UI a beat to settle.
  await page.waitForTimeout(500);
}

async function shot(page, name) {
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
  console.log(`  ✓ ${name}.png`);
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2, // retina-crisp screenshots
  });
  const page = await context.newPage();

  console.log("→ Waiting for dev server...");
  await waitForServer(page);

  console.log("→ Seeding PM notes...");
  await seed(page);

  console.log("→ Capturing screenshots...");
  await page.goto(`${BASE}/#/`);
  await page.waitForLoadState("networkidle").catch(() => {});
  await shot(page, "01-dashboard");

  await page.goto(`${BASE}/#/notes`);
  await page.waitForLoadState("networkidle").catch(() => {});
  await shot(page, "02-notes");

  // Open a specific note (Roadmap Q3) — assumes it's in the list.
  const roadmap = page.getByText("Roadmap Q3").first();
  if (await roadmap.isVisible().catch(() => false)) {
    await roadmap.click();
    await shot(page, "03-note-editor");
  }

  await page.goto(`${BASE}/#/calendar`);
  await page.waitForLoadState("networkidle").catch(() => {});
  await shot(page, "04-calendar");

  await page.goto(`${BASE}/#/graph`);
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(1500); // force-graph settle
  await shot(page, "05-graph");

  await browser.close();
  console.log(`\nDone. Screenshots in ${OUT}`);
}

main().catch(e => { console.error(e); process.exit(1); });
