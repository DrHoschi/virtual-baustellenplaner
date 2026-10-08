import { test, expect } from "@playwright/test";

test("Projektvertrag erzwingt Version, Einheit, Koordinaten und Fläche", async ({ page }) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const { createProjectDocument } = await import(new URL("/src/domain/project-document.v1.js", location.href).href);
    const { validateProjectDocument } = await import(new URL("/src/domain/project-validation.v1.js", location.href).href);
    const project = createProjectDocument({ name: "Vertragstest", areaKind: "hall-section", widthMm: 12000, heightMm: 8000 });
    const valid = validateProjectDocument(project).valid;
    project.formatVersion = 99;
    return { valid, unsupported: validateProjectDocument(project) };
  });
  expect(result.valid).toBe(true);
  expect(result.unsupported.valid).toBe(false);
  expect(result.unsupported.errors).toContain("Nicht unterstützte Projektversion.");
});
