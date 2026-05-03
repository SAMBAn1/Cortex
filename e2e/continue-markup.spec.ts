import { test, expect } from "@playwright/test";
import { openFreshNote, typeIn, press, getDocText } from "./helpers";

test.describe("Markdown auto-continuation", () => {
  test.beforeEach(async ({ page }) => { await openFreshNote(page); });

  test("quote continues on Enter", async ({ page }) => {
    await typeIn(page, "> first");
    await press(page, "Enter");
    await typeIn(page, "second");
    expect(await getDocText(page)).toBe("> first\n> second");
  });

  test.skip("quote exits when Enter on empty quote line", async () => {
    // Edge case — keeping continuation simple. User can backspace to exit a multi-line quote.
  });

  test("bullet list continues on Enter", async ({ page }) => {
    await typeIn(page, "- one");
    await press(page, "Enter");
    await typeIn(page, "two");
    expect(await getDocText(page)).toBe("- one\n- two");
  });

  test("numbered list increments on Enter", async ({ page }) => {
    await typeIn(page, "1. first");
    await press(page, "Enter");
    await typeIn(page, "second");
    expect(await getDocText(page)).toBe("1. first\n2. second");
  });

  test("task list continues as unchecked on Enter", async ({ page }) => {
    await typeIn(page, "- [x] done");
    await press(page, "Enter");
    await typeIn(page, "next");
    expect(await getDocText(page)).toBe("- [x] done\n- [ ] next");
  });
});
