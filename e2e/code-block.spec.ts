import { test, expect } from "@playwright/test";
import { openFreshNote, typeIn, press, getDocText, acceptCompletion } from "./helpers";

test.describe("Code blocks", () => {
  test.beforeEach(async ({ page }) => { await openFreshNote(page); });

  test("code block toolbar button inserts fenced block with cursor inside", async ({ page }) => {
    await page.click('[title="Code block (```)"]');
    await typeIn(page, "hello");
    const doc = await getDocText(page);
    expect(doc).toBe("```\nhello\n```\n");
  });

  test("fenced block dims fence markers when cursor outside", async ({ page }) => {
    await typeIn(page, "before\n```\nhello\n```\nafter");
    // Fence markers should get the dim cm-fence-mark class
    await expect(page.locator(".cm-fence-mark").first()).toBeVisible();
    // The code body should have the cm-fenced-code style
    await expect(page.locator(".cm-fenced-code").first()).toBeVisible();
  });

  test("inline code with single backtick hides ticks", async ({ page }) => {
    await typeIn(page, "look at `code` here");
    await press(page, "End");
    // Move cursor outside the inline code node
    const visible = await page.locator(".cm-line").first().innerText();
    expect(visible).not.toContain("`");
  });

  test("inline code with double backticks hides BOTH ticks on each side", async ({ page }) => {
    await typeIn(page, "look at ``code`` here");
    await press(page, "End");
    const visible = await page.locator(".cm-line").first().innerText();
    expect(visible).not.toContain("`");
  });

  test("inline code with triple backticks (single-line) hides all 3 on each side", async ({ page }) => {
    await typeIn(page, "look at ```code``` here");
    await press(page, "End");
    const visible = await page.locator(".cm-line").first().innerText();
    expect(visible).not.toContain("`");
  });
});
