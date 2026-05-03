import { type Page, expect } from "@playwright/test";

/** Wait for app to load, click + to open a new note, focus the editor. */
export async function openFreshNote(page: Page) {
  await page.goto("/");
  await page.waitForSelector('[title="New note"]', { timeout: 10_000 });
  await page.click('[title="New note"]');
  await page.waitForSelector(".cm-content", { timeout: 5_000 });
  await waitForCM(page);
  await page.click(".cm-content");
}

export async function typeIn(page: Page, text: string) {
  await page.keyboard.type(text, { delay: 5 });
}

export async function press(page: Page, combo: string) {
  await page.keyboard.press(combo);
}

export async function waitForCM(page: Page) {
  await page.waitForFunction(() => !!(window as any).__cm, undefined, { timeout: 5_000 });
}

export async function getDocText(page: Page): Promise<string> {
  return await page.evaluate(() => {
    const cm = (window as any).__cm;
    return cm ? cm.state.doc.toString() : "";
  });
}

export async function getVisibleText(page: Page): Promise<string> {
  return await page.evaluate(() => {
    const lines = Array.from(document.querySelectorAll(".cm-line"));
    return lines.map(l => (l as HTMLElement).innerText).join("\n");
  });
}

export async function moveCursor(page: Page, line: number, ch: number) {
  await page.evaluate(({ line, ch }) => {
    const view = (window as any).__cm;
    if (!view) return;
    const doc = view.state.doc;
    const lineObj = doc.line(line);
    const pos = Math.min(lineObj.from + ch, lineObj.to);
    view.dispatch({ selection: { anchor: pos } });
    view.focus();
  }, { line, ch });
}

export async function waitForAutocomplete(page: Page) {
  await page.waitForSelector(".cm-tooltip-autocomplete", { state: "visible", timeout: 3_000 });
  // Also wait for an aria-selected option to be present so Enter accepts it.
  await page.waitForSelector(".cm-tooltip-autocomplete > ul > li[aria-selected]", { timeout: 1_000 }).catch(() => {});
}

/** Wait for autocomplete to be ACTIVE and past its interactionDelay, then accept via the bundled command. */
export async function acceptCompletion(page: Page) {
  await page.waitForFunction(() => {
    const view = (window as any).__cm;
    const auto = (window as any).__cmAuto;
    if (!view || !auto) return false;
    return auto.completionStatus(view.state) === "active";
  }, undefined, { timeout: 5_000 });
  // CM enforces an interactionDelay (default 75ms) — waiting just past it.
  await page.waitForTimeout(120);
  const ok = await page.evaluate(() => {
    const view = (window as any).__cm;
    const auto = (window as any).__cmAuto;
    return auto.acceptCompletion(view);
  });
  if (!ok) {
    const dump = await page.evaluate(() => {
      const view = (window as any).__cm;
      const auto = (window as any).__cmAuto;
      return {
        status: auto.completionStatus(view.state),
        opts: (auto.currentCompletions(view.state) || []).map((o: any) => o.label),
      };
    });
    throw new Error("acceptCompletion returned false; state: " + JSON.stringify(dump));
  }
  await page.waitForTimeout(50);
}

export async function getAutocompleteOptions(page: Page): Promise<string[]> {
  return await page.$$eval(".cm-tooltip-autocomplete > ul > li", (els) =>
    els.map((e) => (e as HTMLElement).innerText.trim())
  );
}

export async function expectClassOnText(page: Page, className: string, text: string) {
  const el = page.locator(`.cm-line .${className}`).filter({ hasText: text }).first();
  await expect(el).toBeVisible();
}
