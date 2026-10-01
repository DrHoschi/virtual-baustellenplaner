# BP-RF-03 – Workarea BOM Modularization

## Status

**FROZEN**

Functional freeze head:

`a40c9cc2601bdcb9bb213ca93de08ddca4610ca9`

Authorized base:

`575095cd6cb963398a47eec31d2dc8f7fdb4e292`

Branch:

`refactor/BP-RF-03-workarea-bom`

## Purpose

BP-RF-03 structurally reduces `ui/panels/WorkareaPanel.base.js` by extracting the existing Workarea Assembly/BOM, material-row presentation and BOM export domain into a dedicated module. The change preserves product behavior, BOM quantities, store and persistence paths, schemas, output contracts and all existing data authorities.

The Cable-Tray material-output domain remains separate in `ui/workarea/workarea-cable-tray.v1.js` and is not moved, merged or modified by BP-RF-03.

## Frozen Functional Scope

The functional implementation changes exactly three files against the authorized base:

- `ui/panels/WorkareaPanel.base.js`
- `ui/workarea/workarea-bom.v1.js`
- `tests/bp-rf-03-workarea-bom.spec.js`

Exactly seventeen existing methods were moved to the dedicated module:

- `_renderBOMPanelFull()`
- `_groupBOMRowsByAssemblyV1()`
- `_computeBOMRows()`
- `_getBOMCurrency()`
- `_setBOMCurrency()`
- `_getBOMLineMap()`
- `_getBOMUnitPrice()`
- `_getBOMSKU()`
- `_getBOMUOM()`
- `_getBOMManufacturer()`
- `_getBOMSupplier()`
- `_getBOMComment()`
- `_setBOMLineField()`
- `_setBOMPrice()`
- `_makeBOMExportPayload()`
- `_makeBOMCSV()`
- `_renderBOMPanel()`

The module is connected through `installWorkareaBomModule`. The base import and installer call each occur exactly once.

## Byte-Identity Evidence

All seventeen method bodies in `ui/workarea/workarea-bom.v1.js` are byte-identical to their original definitions at the authorized base:

- combined method-block lines: 913
- combined method-block characters: 33,565
- combined SHA-256: `2fc897f52b38021b8624d79d6a7875ed254b77553ce4fc957706c7f60ee3f168`

Every extracted method is defined exactly once in the dedicated module and no extracted definition remains in `WorkareaPanel.base.js`.

## Authority and Persistence Boundaries

BP-RF-03 does not create or move a data authority.

The existing authorities remain unchanged:

- BOM quantities remain derived from `project.workspace.scene.objects`;
- Assembly component rows continue to use `assembly.instance.components[]`;
- the existing legacy `assembly.instance.bom[]` fallback remains intact;
- Project Assets remain the label/reference source used by the existing computation;
- project-bound BOM metadata remains under `project.assets.settings.bom`;
- `bom.lines[key]`, `bom.prices[key]` and `bom.currency` retain their existing responsibilities;
- the existing mirrored `app` / `project` store updates remain unchanged;
- project saving continues through `_requestProjectSaveDebounced(...)`;
- the existing JSON export schema remains `baustellenplaner.bom.assemblylab.v1`;
- CSV and JSON remain derived output only.

No persistence cleanup, schema migration, store redesign, second BOM model or parallel material authority is included.

## Cable-Tray Material Boundary

Cable-Tray route, preparation, combined material-output and CSV responsibilities remain in the previously extracted Cable-Tray module.

BP-RF-03 does not move or modify:

- `_getCableTrayMaterialOutputRowsV1()`;
- `_getCombinedCableTrayMaterialOutputRowsV1()`;
- `_exportCombinedCableTrayMaterialCSVV1()`;
- `cable-tray.route` authority;
- global material-catalog or article-mapping authority.

Assembly/Workarea BOM and Cable-Tray material output therefore remain intentionally separate authorities.

## Verification Blocker and Fix

The first functional head was:

`59a4349e3a429e6d48a386983db56a363cf5c59d`

Its Product CI exposed one test-only Import-Graph false positive: the focused test contained the expected module import as one literal string, which the existing scanner interpreted as a real import relative to `tests/`.

The authorized blocker fix is exactly one later commit:

`a40c9cc2601bdcb9bb213ca93de08ddca4610ca9`

It changes only `tests/bp-rf-03-workarea-bom.spec.js` by splitting that expected text into `'im' + 'port ...'`:

- one file;
- one line added;
- one line removed;
- no product-code or contract change.

## Verification Evidence

Gate 2 result: **PASS**

Exact verified functional head:

`a40c9cc2601bdcb9bb213ca93de08ddca4610ca9`

Structural and designated regression evidence:

- JavaScript syntax check: **PASS**, 211 JavaScript files;
- import-graph check: **PASS**, 156 relative imports;
- BP-RF-03 focused structural contract: **3/3 PASS**;
- Assembly Templates/BOM regression: **1/1 PASS**;
- UI-MIG-05F Planning Context regression: **4/4 PASS**;
- designated Cable-Tray material regressions: **PASS**.

Exact-head GitHub Product CI:

- workflow: `Product CI`;
- run: `36886404590`;
- head SHA: `a40c9cc2601bdcb9bb213ca93de08ddca4610ca9`;
- event: `push`;
- result: **SUCCESS**;
- all workflow steps completed successfully.

## Lineage and Scope Evidence

The functional head is four commits ahead and zero commits behind the authorized base.

The sequence is linear and contains no merge commit:

1. `e99a00dec671fcf995860337bb5790fcefcafff7` – add Workarea BOM module;
2. `93377816ab1337daf0e2f59980253097466c0dc3` – add focused BP-RF-03 structure contract;
3. `59a4349e3a429e6d48a386983db56a363cf5c59d` – install extracted module;
4. `a40c9cc2601bdcb9bb213ca93de08ddca4610ca9` – test-only Import-Graph blocker fix.

No foreign or unrelated file is present in the functional diff.

## Explicit Non-Scope Preserved

BP-RF-03 contains no:

- functional product change;
- BOM quantity or aggregation change;
- persistence or schema change;
- store- or data-authority change;
- Cable-Tray material-output change;
- manufacturer or article-selection logic;
- CI/workflow or configuration change;
- BP-031 functionality;
- `tray.dutyClass`;
- unrelated cleanup or modernization.

## Freeze Decision

BP-RF-03 Workarea BOM Modularization is **FROZEN** at functional head:

`a40c9cc2601bdcb9bb213ca93de08ddca4610ca9`

This document adds completion/evidence/freeze documentation only. It does not alter the verified product or test state.
