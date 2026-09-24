import { test, expect } from "@playwright/test";

async function openPlanning(page) {
  await page.goto("/index.html", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#globalCommandBar")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("#active")).not.toHaveText(/\(lädt\.\.\.\)/i, { timeout: 30_000 });
  await page.locator('#moduleNav button[data-module-id="module.planning"]').click();
  await expect(page.locator("#active")).toHaveText("tools:workarea", { timeout: 30_000 });
}

test("R2F-01 keeps tree rows bound to real object ids and tree selection uses Workarea authority", async ({ page }) => {
  await openPlanning(page);
  const source = await page.locator("body").evaluate(async () => await (await fetch("/ui/panels/WorkareaPanel.base.js")).text());

  expect(source).toContain('row.dataset.objectId = String(obj?.id || "")');
  expect(source).toContain('this._setSelectionToObject(obj, "structure")');
  expect(source).toContain('row.setAttribute("aria-pressed", obj?.id === this.state?.selection?.id ? "true" : "false")');
});

test("R2F-01 reflects Workarea object selection back into the visible object tree without a second selection state", async ({ page }) => {
  await openPlanning(page);
  const source = await page.locator("body").evaluate(async () => await (await fetch("/ui/panels/WorkareaPanel.base.js")).text());

  const selectionMethod = source.slice(
    source.indexOf("_setSelectionToObject(o, reason"),
    source.indexOf("_setSelectionToPoint(world, reason")
  );

  expect(selectionMethod).toContain("this.state.selection = {");
  expect(selectionMethod).toContain('if (String(this.state?.leftTabId || "") === "tab.structure")');
  expect(selectionMethod).toContain("this._renderLeftPanel()");
  expect(selectionMethod).not.toContain("scrollIntoView");
  expect(selectionMethod).not.toContain("_persistSceneToStore");
});

test("R2F-01 does not activate historical structure-tree patch modules", async ({ page }) => {
  await page.goto("/index.html", { waitUntil: "domcontentloaded" });
  const html = await page.locator("html").evaluate((el) => el.outerHTML);

  for (const legacy of [
    "workarea-structure-tree-live-grouping.v1.js",
    "workarea-structure-tree-component-nodes.v1.js",
    "workarea-structure-tree-selection-sync-noscroll.v1.js",
    "workarea-structure-tree-detail-editor.v1.js"
  ]) {
    expect(html).not.toContain(`<script src="./core/workarea/${legacy}"`);
  }
});
