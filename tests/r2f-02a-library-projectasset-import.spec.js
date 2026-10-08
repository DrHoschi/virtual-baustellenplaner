import { test, expect } from "@playwright/test";

async function boot(page) {
  await page.goto("/index.html", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#globalCommandBar")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("#active")).not.toHaveText(/\(lädt\.\.\.\)/i, { timeout: 30_000 });
}

test("R2F-02A global library contract and ProjectAsset import boundary stay explicit", async ({ page }) => {
  await boot(page);
  const data = await page.evaluate(async () => (await fetch("/data/global-asset-library.v1.json")).json());
  expect(data.schema).toBe("baustellenplaner.globalAssetLibrary.v1");
  expect(data.libraries[0].libraryId).toBeTruthy();
  expect(data.libraries[0].entries[0].entryId).toBeTruthy();
  expect(data.libraries[0].entries[0].projectAsset.slots[0].hasModel).toBe(true);

  const source = await page.evaluate(async () => await (await fetch("/ui/panels/AssetLibraryPanel.js")).text());
  expect(source).toContain('source = { kind: "library", libraryId, entryId }');
  expect(source).toContain('app.project.projectAssets = [...current, projectAsset]');
  expect(source).toContain('"ui:project:save"');
  expect(source).not.toContain("library.instance");
  expect(source).not.toContain("_persistSceneToStore");
});

test("R2F-02A duplicate import is idempotent by libraryId + entryId", async ({ page }) => {
  await boot(page);
  const source = await page.evaluate(async () => await (await fetch("/ui/panels/AssetLibraryPanel.js")).text());
  expect(source).toContain('asset?.source?.kind === "library"');
  expect(source).toContain('asset?.source?.libraryId');
  expect(source).toContain('asset?.source?.entryId');
  expect(source).toContain("this._isImported(libraryId, entryId)");
  expect(source).toContain('imported ? "Bereits im Projekt" : "Ins Projekt übernehmen"');
  expect(source).toContain("disabled: imported");
});
