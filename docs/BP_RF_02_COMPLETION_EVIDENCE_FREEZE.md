# BP-RF-02 – Workarea Layout Diagnostics Modularization

## Status

**FROZEN**

Functional freeze head:

`b681aaad8d810433fa09089f9eea0950091dfa7e`

Authorized base:

`a00a0fcf1c1ca6bf9083ecca48b742ecadc9cdf1`

Branch:

`refactor/BP-RF-02-workarea-layout-diagnostics`

## Purpose

BP-RF-02 continues the structural reduction of `ui/panels/WorkareaPanel.base.js` by extracting the existing passive Workarea layout-diagnostics domain into a dedicated module. The change preserves product behavior, state ownership, listener lifecycle, persistence, schemas, and existing data authorities.

## Frozen Structural Scope

The functional refactoring changes exactly three files against the authorized base:

- `ui/panels/WorkareaPanel.base.js`
- `ui/workarea/workarea-layout-diagnostics.v1.js`
- `tests/bp-rf-02-workarea-layout-diagnostics.spec.js`

Exactly seven existing methods were moved to the dedicated module:

- `_wireLayoutDiagnostics()`
- `_detectWorkareaLayoutMode()`
- `_rectFor()`
- `_getWorkareaLayoutDebug()`
- `_layoutDebugSig()`
- `_refreshWorkareaLayoutDiagnostics()`
- `_copyWorkareaLayoutDebug()`

The module is connected to `WorkareaPanel` through `installWorkareaLayoutDiagnosticsModule`. The base import, installer call, and module export each occur exactly once.

## State and Listener Authority

The extraction does not move or duplicate Workarea state authority. The existing constructor-owned state remains in `WorkareaPanel.base.js`:

- `this._layoutDiag`
- `this._onWindowResizeForLayoutDiag`

The existing listener cleanup remains in `unmount()`. The `resize` and `orientationchange` listener registration was moved only as part of the byte-identical method block. No second listener path, store, service, state model, or lifecycle authority was introduced.

## Byte-Identity Evidence

The original seven-method block and the extracted module block are byte-identical:

- original block: 276 lines, 10,377 bytes
- extracted block: 276 lines, 10,377 bytes
- SHA-256 for both blocks: `883ebbf04aef92517847ea3d7e1f18f132bfab5604600a4b0df98cf88c5425fc`

All seven method definitions exist only in `ui/workarea/workarea-layout-diagnostics.v1.js` at the functional freeze head.

## Scope Evidence

The functional freeze head is exactly one linear commit after the authorized base and contains no merge commit.

The complete diff contains only the three authorized files. Product persistence, project and scene schemas, data authorities, CI/workflows, configuration, and pre-existing documentation remain unchanged.

## Verification Evidence

Implementation Verification / Scope / Regression Gate: **PASS**

Exact verified functional head:

`b681aaad8d810433fa09089f9eea0950091dfa7e`

Focused and designated regression matrix:

- BP-RF-02 structural contract: **3/3 PASS**
- UI-MIG-05E topbar grouping: **5/5 PASS**
- UI-MIG-05G planning status: **4/4 PASS**
- TECH-WA-FREEZE-01A responsiveness: **1/1 PASS**
- total: **13/13 PASS**

Exact-head checks were reproduced locally with Node.js 20 and Playwright/Chromium 1.50.1 against the repository's complete `Product CI` workflow contract:

- JavaScript syntax check: **PASS**, 210 JavaScript files
- import-graph check: **PASS**, 155 relative imports
- global material catalog and BP-029 validation: **PASS**
- navigation foundation and manifest checks: **PASS**
- Hall configuration and Hall3D regressions: **PASS**
- UI-REC-01A CSS/shell authority: **PASS**
- BP-002 hall structural configuration: **PASS**
- Product-CI browser and smoke gates: **20/20 PASS**

No stored GitHub Actions run or commit status existed for this exact head at verification time. The evidence above is the local exact-head execution of the complete workflow contract, not a claimed remote Actions run.

## Non-Scope Preserved

This freeze contains no:

- functional product change
- persistence or schema change
- data-authority change
- CI/workflow or configuration change
- BP-031 functionality
- `tray.dutyClass`
- additional cleanup or modernization
- target-document update
- integration into `main`

## Freeze Decision

BP-RF-02 Workarea Layout Diagnostics Modularization is **FROZEN** at functional head:

`b681aaad8d810433fa09089f9eea0950091dfa7e`

This document adds completion/evidence/freeze documentation only. It does not alter the verified product or test state. Integration into `main` and updating the target document are separate, explicitly authorized steps.
