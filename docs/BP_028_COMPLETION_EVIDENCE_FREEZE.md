# BP-028 – Practical Article-Aware Material Output

## Status

**FROZEN**

Functional freeze head:

`23a83725cff094a97fb57712044a25d74310a1d8`

Authorized base:

`41647599cba288bfd452a84b72f658d4258e836f`

Feature branch:

`feature/BP-028-article-aware-material-output`

## Purpose

BP-028 extends the existing combined cable-tray material output with material/article identity already established by BP-026/BP-027. It does not create material demand, calculate quantities, select articles, or introduce a second material-output authority.

The existing planning and quantity chain remains authoritative. BP-028 only projects resolved identity into the existing combined material rows and the existing Gesamtmaterial CSV.

## Frozen Scope

The existing `_getCombinedCableTrayMaterialOutputRowsV1()` remains the single combined material-output path.

Each existing output row is enriched only with:

- `materialId`
- `manufacturer`
- `articleNumber`

The existing neutral material name remains unchanged.

The existing Gesamtmaterial CSV keeps its previous twelve columns in their existing order and appends exactly:

`Material_ID;Hersteller;Artikelnummer`

The simple BP-018 Material CSV remains unchanged and article-unaware.

## Deterministic Identity Resolution

### Tray

Resolution uses only the BP-026 mapping key:

`sourceKind=tray + trayType + widthMm`

### Accessory

Resolution uses only:

`sourceKind=accessory + accessoryKind + trayType + widthMm`

The accessory `kind` is resolved before projection to the neutral display category.

### Support material

Support material does not use project material mappings. The existing BP-021/BP-026 `materialId` on the prepared support row is resolved directly through the global material catalog.

No matching by support name, unit, or support type is introduced.

### Fitting

Resolution uses only:

`sourceKind=fitting + fittingKind`

The fitting `kind` is resolved before projection to the neutral display row.

## Unresolved Contract

Unresolved identity never removes or changes a material row.

For unresolved rows:

- `materialId = null`
- `manufacturer = ""`
- `articleNumber = ""`

The existing neutral material position and its full quantity remain present exactly once.

No resolution-based filtering is permitted.

## Quantity Authority Boundary

BP-028 introduces no quantity calculation.

The combined output continues to consume the existing authoritative quantities:

- tray/accessory purchase length from existing material preparation/output,
- support `derivedQuantity` from BP-021,
- fitting `quantity` from BP-024.

BP-028 does not recompute route length, stick count, purchase length, offcut, accessory need, support count, support composition, or fitting count.

## No Consolidation / No Guessing

BP-028 does not consolidate rows by name, name+unit, or materialId.

Names are not material identity.

BP-028 does not infer or select manufacturer articles and does not invent missing technical variants.

## BP-018 Regression-Test Boundary Fix

The first Exact-Head Product CI exposed a pre-existing BP-018 regression-test boundary that extended from `_getCableTrayMaterialOutputRowsV1()` through `_showCableTrayEvaluation()`.

That slice incorrectly included the later combined material-output functions and therefore rejected BP-028's legitimate `manufacturer` and `articleNumber` fields.

The separately reconciled and authorized fix changed only the BP-018 test end boundary to:

`_getCombinedCableTrayMaterialOutputRowsV1()`

The BP-018 protection itself remains unchanged, including the negative assertion against manufacturer/article/supplier/price/inventory/BOM authority inside the actual BP-018 output boundary.

No product code was changed by this regression-test boundary fix.

Boundary-fix commit:

`23a83725cff094a97fb57712044a25d74310a1d8`

## Files in Functional Diff

Against authorized base `41647599cba288bfd452a84b72f658d4258e836f`, the functional freeze contains only:

- `ui/panels/WorkareaPanel.base.js`
- `tests/bp-028-article-aware-material-output.spec.js`
- `tests/bp-018-cable-tray-material-output.spec.js`

No CSS, project schema, persistence, global material catalog, asset catalog, BP-027 UI, or additional export file was changed.

## Verification Evidence

Implementation Verification / Scope / Regression Gate: **PASS**

Exact functional head:

`23a83725cff094a97fb57712044a25d74310a1d8`

Git relation to authorized base:

- ahead: 3 commits
- behind: 0
- merge base: exact authorized base

Exact-Head GitHub Actions evidence:

- Workflow: **Product CI**
- Run number: **#1474**
- Run ID: `36564891052`
- Event: `push`
- Head SHA: `23a83725cff094a97fb57712044a25d74310a1d8`
- Status: `completed`
- Conclusion: **success**

The successful run includes the BP-018, BP-017, BP-019, BP-024 and BP-025 regression checks as well as UI/E2E and smoke tests.

## Non-Scope Preserved

BP-028 does not add:

- material master-data editing or import,
- Niedax/Hilti online integration,
- suppliers, prices, discounts, or inventory,
- supplier order numbers,
- packaging/order optimization,
- automatic article selection,
- technical variant derivation,
- substitutions,
- EPLAN coupling,
- Assembly BOM merging,
- XLSX/PDF output,
- 3D materialization,
- new persistence,
- quantity changes,
- assignment changes.

## Freeze Decision

BP-028 is **FROZEN** at functional head:

`23a83725cff094a97fb57712044a25d74310a1d8`

This document adds completion/evidence/freeze documentation only. The functional freeze head remains the SHA above.

Integration into `main` is explicitly not part of this gate and requires a separate Integration Reconciliation followed by separate Fast-Forward authorization.
