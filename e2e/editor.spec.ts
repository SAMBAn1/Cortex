import { test, expect } from "@playwright/test";
import { openFreshNote, typeIn, press, getDocText, moveCursor, acceptCompletion } from "./helpers";

test.describe("Editor — markdown syntaxes", () => {
  test.beforeEach(async ({ page }) => {
    // Each test runs in a fresh browser context (Playwright default), so IDB is empty.
    await openFreshNote(page);
  });

  test("heading via /h1", async ({ page }) => {
    await typeIn(page, "/h1");
    await acceptCompletion(page);
    await typeIn(page, "Title");
    expect(await getDocText(page)).toBe("# Title");
    // Move cursor away — the # should hide via cm-h1 mark
    await press(page, "ArrowDown");
    await expect(page.locator(".cm-h1")).toBeVisible();
  });

  test("bold via Ctrl+B and live preview", async ({ page }) => {
    await typeIn(page, "hello world");
    // Select "world" — Shift+Ctrl+Left selects word
    await press(page, "Control+Shift+ArrowLeft");
    await press(page, "Control+b");
    expect(await getDocText(page)).toBe("hello **world**");
    // Move cursor to a different line so markers should hide
    await press(page, "End");
    await press(page, "Enter");
    await press(page, "Enter");
    await expect(page.locator(".cm-strong").filter({ hasText: "world" })).toBeVisible();
  });

  test("italic via Ctrl+I", async ({ page }) => {
    await typeIn(page, "hello");
    await press(page, "Control+a");
    await press(page, "Control+i");
    expect(await getDocText(page)).toBe("*hello*");
  });

  test("inline code via Ctrl+`", async ({ page }) => {
    await typeIn(page, "code");
    await press(page, "Control+a");
    await press(page, "Control+`");
    expect(await getDocText(page)).toBe("`code`");
  });

  test("task list via /todo with clickable checkbox", async ({ page }) => {
    await typeIn(page, "/todo");
    await acceptCompletion(page);
    await typeIn(page, "buy milk");
    expect(await getDocText(page)).toBe("- [ ] buy milk");
    // Move cursor away so the task widget renders
    await press(page, "End");
    await press(page, "Enter");
    await press(page, "Enter");
    const checkbox = page.locator(".cm-task-checkbox").first();
    await expect(checkbox).toBeVisible();
    await expect(checkbox).not.toBeChecked();
    await checkbox.click();
    await expect(checkbox).toBeChecked();
    expect(await getDocText(page)).toContain("- [x] buy milk");
  });

  test("quote via /quote", async ({ page }) => {
    await typeIn(page, "/quote");
    await acceptCompletion(page);
    await typeIn(page, "to be or not to be");
    expect(await getDocText(page)).toBe("> to be or not to be");
  });

  test("horizontal rule via /hr", async ({ page }) => {
    await typeIn(page, "above\n");
    await typeIn(page, "/hr");
    await acceptCompletion(page);
    expect(await getDocText(page)).toContain("---");
  });

  test("bullet list via /list", async ({ page }) => {
    await typeIn(page, "/list");
    await acceptCompletion(page);
    await typeIn(page, "first");
    expect(await getDocText(page)).toBe("- first");
  });

  test("link via /link", async ({ page }) => {
    await typeIn(page, "/link");
    await acceptCompletion(page);
    expect(await getDocText(page)).toBe("[text](url)");
  });

  test("today via /today", async ({ page }) => {
    await typeIn(page, "/today");
    await acceptCompletion(page);
    const today = new Date().toISOString().slice(0, 10);
    expect(await getDocText(page)).toBe(today);
  });

  test("wikilink autocomplete (no extra brackets)", async ({ page }) => {
    // First create a note with title "Other Note" so it shows up in autocomplete
    await typeIn(page, "Other Note");
    await page.waitForTimeout(700); // wait for autosave to set title
    // Open a new note
    await page.click('[title="New note"]');
    await page.waitForTimeout(300);
    await page.click(".cm-content");
    // Type [[ — auto-closes to [[]]
    await typeIn(page, "[[Othe");
    await acceptCompletion(page);
    expect(await getDocText(page)).toBe("[[Other Note]]");
  });

  test("tag autocomplete", async ({ page }) => {
    // Type a tag in first note so it exists
    await typeIn(page, "task #urgent done");
    await page.waitForTimeout(700);
    // New note
    await page.click('[title="New note"]');
    await page.waitForTimeout(300);
    await page.click(".cm-content");
    await typeIn(page, "another #urg");
    await acceptCompletion(page);
    expect(await getDocText(page)).toBe("another #urgent");
  });

  test("slash menu does not leave the / behind", async ({ page }) => {
    await typeIn(page, "/h1");
    await acceptCompletion(page);
    expect(await getDocText(page)).toBe("# ");
  });

  test("live preview hides ** when cursor leaves the bold node", async ({ page }) => {
    await typeIn(page, "before **bold** after");
    await expect(page.locator(".cm-strong").filter({ hasText: "bold" })).toBeVisible();
    const visible = await page.locator(".cm-line").first().innerText();
    expect(visible).not.toContain("**");
    await moveCursor(page, 1, 10); // somewhere inside **bold**
    const visibleInside = await page.locator(".cm-line").first().innerText();
    expect(visibleInside).toContain("**");
  });

  test("live preview renders wikilink as chip when cursor outside", async ({ page }) => {
    // Create a note "Target" first
    await typeIn(page, "Target");
    await page.waitForTimeout(700);
    await page.click('[title="New note"]');
    await page.waitForTimeout(300);
    await page.click(".cm-content");
    await typeIn(page, "see [[Target]] for details");
    await press(page, "Home");
    await expect(page.locator(".cm-wikilink-chip")).toBeVisible();
    await page.locator(".cm-wikilink-chip").click();
    await page.waitForTimeout(300);
    expect(page.url()).toMatch(/#\/notes\//);
  });

  test("heading + bold + italic together", async ({ page }) => {
    await typeIn(page, "# Hello *world* and **bold**");
    expect(await getDocText(page)).toBe("# Hello *world* and **bold**");
    await press(page, "Enter");
    await press(page, "Enter");
    await expect(page.locator(".cm-h1")).toBeVisible();
  });
});
