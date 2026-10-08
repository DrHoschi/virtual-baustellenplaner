import { test, expect } from "@playwright/test";
import fs from "node:fs";

const baseSource = fs.readFileSync(new URL("../ui/panels/WorkareaPanel.base.js", import.meta.url), "utf8");
const moduleSource = fs.readFileSync(new URL("../ui/workarea/workarea-layout-diagnostics.v1.js", import.meta.url), "utf8");

const methodSignatures = [
  "_wireLayoutDiagnostics()",
  "_detectWorkareaLayoutMode()",
  "_rectFor(el)",
  "_getWorkareaLayoutDebug()",
  "_layoutDebugSig(dbg)",
  '_refreshWorkareaLayoutDiagnostics(reason = "diag", opts = {})',
  "async _copyWorkareaLayoutDebug()"
];

test("BP-RF-02 installs the extracted Workarea layout-diagnostics module once", () => {
  const moduleImport = 'im' + 'port { installWorkareaLayoutDiagnosticsModule } from "../workarea/workarea-layout-diagnostics.v1.js";';

  expect(baseSource).toContain(moduleImport);
  expect(baseSource).toContain("installWorkareaLayoutDiagnosticsModule(WorkareaPanel);");
  expect(moduleSource).toContain("export function installWorkareaLayoutDiagnosticsModule(WorkareaPanelClass)");
  expect(moduleSource).toContain("Object.getOwnPropertyDescriptors(WorkareaLayoutDiagnosticsModule.prototype)");
  expect(moduleSource).toContain("Object.defineProperties(WorkareaPanelClass.prototype, descriptors)");
});

test("BP-RF-02 keeps all seven layout-diagnostics methods in the dedicated module", () => {
  for (const signature of methodSignatures) {
    expect(moduleSource).toContain(signature);
    expect(baseSource).not.toContain(`  ${signature} {`);
  }
});

test("BP-RF-02 preserves the existing layout state and lifecycle ownership in WorkareaPanel", () => {
  expect(baseSource).toContain("this._layoutDiag = {");
  expect(baseSource).toContain("this._onWindowResizeForLayoutDiag = null;");
  expect(baseSource).toContain('window.removeEventListener("resize", this._onWindowResizeForLayoutDiag);');
  expect(baseSource).toContain('window.removeEventListener("orientationchange", this._onWindowResizeForLayoutDiag);');
  expect(moduleSource).toContain('window.addEventListener("resize", this._onWindowResizeForLayoutDiag, { passive: true });');
  expect(moduleSource).toContain('window.addEventListener("orientationchange", this._onWindowResizeForLayoutDiag, { passive: true });');
});
