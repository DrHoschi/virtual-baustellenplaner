# BP-026 – Practical Material Identity / Article Mapping – Completion / Evidence / Freeze

## Status

**FROZEN – FUNCTIONAL HEAD VERIFIED**

Implementation base:

`efbc0062582d2eb94a978344a13594a82bd4339a`

Feature branch:

`feature/BP-026-practical-material-identity-article-mapping`

Functional freeze head:

`b6c7891cdf74aa3ebe7d58a74d02917b22e5b876`

This document freezes the verified BP-026 functional state only. It does not authorize integration to `main`.

## Capability completed

BP-026 introduces a separate global material/article identity authority and resolves existing neutral cable-tray material positions to stable material identities without taking over any planning or quantity authority.

The binding rule is:

**existing planning determines what/how much is needed; BP-026 determines only which real material article corresponds to that existing material position.**

## Global material authority

The new application-level, project-independent authority is:

`data/global-material-catalog.v1.json`

Schema:

`baustellenplaner.globalMaterialCatalog.v1`

The minimal material contract is:

- `materialId`
- `manufacturer`
- `articleNumber`
- `name`
- `unit`

The initial catalog is intentionally empty. BP-026 does not invent manufacturer articles.

The existing `data/assets.catalog.v1.json` remains the technical asset/parameter catalog.

The existing `data/global-asset-library.v1.json` remains the reusable global ProjectAsset library.

Neither existing asset authority is redefined as material master data.

## Project mapping boundary

Project-specific tray/accessory/fitting selections are read from:

`app.project.materialMappings[]`

The project stores stable `materialId` references rather than copies of manufacturer/article master data.

Tray mapping uses the already-authoritative planning tuple:

`sourceKind = tray + trayType + widthMm`

Accessory mapping uses:

`sourceKind = accessory + accessoryKind + trayType + widthMm`

Fitting mapping uses the currently available explicit fitting kind only:

`sourceKind = fitting + fittingKind`

BP-026 does not invent missing width/type/variant dimensions. If the available authoritative context does not identify one valid catalog material, the material identity remains unresolved.

## Support boundary

BP-021 remains the project-owned support-composition authority.

BP-026 extends an existing support component only with optional:

`materialId`

The existing component fields remain authoritative:

- `name`
- `quantityPerSupport`
- `unit`

The derived support quantity remains:

`supportCount * quantityPerSupport`

BP-026 does not modify support count or composition quantity semantics.

## Runtime identity resolution

`_getCableTrayMaterialIdentityResolutionV1()` consumes only existing material-preparation outputs:

- `_getCableTrayMaterialPreparationV1().rows`
- `_getCableTrayAccessoryPreparationV1().rows`
- `_getCableTraySupportMaterialPreparationV1().rows`
- `_getCableTrayFittingMaterialPreparationV1().rows`

Resolved positions carry the stable `materialId` plus the corresponding global catalog material.

Positions without a valid catalog-backed identity are emitted separately as runtime-derived unresolved diagnostics with reason:

`material-identity-unresolved`

No persistent `resolutionStatus` authority is introduced.

Unresolved identity does not delete, zero, replace, guess or recalculate the existing neutral material position or its quantity.

## Quantity-authority boundary

BP-026 introduces no quantity authority.

It does not recalculate:

- route geometry or route length;
- 3 m stick semantics;
- required stick count;
- purchase length;
- offcut;
- cover/divider quantities;
- support count;
- quantity per support;
- derived support quantity;
- fitting count.

Those responsibilities remain with the previously frozen BP capabilities.

## Output boundary

BP-026 does not change the existing BP-018 Material CSV or BP-022/BP-025 Gesamtmaterial CSV schema.

It does not add manufacturer/article/materialId columns to those exports.

Any output enrichment or materialId-based consolidation remains a separate future capability.

Same name or same name + unit is still not treated as stable material identity.

## Implementation scope / exact diff

Against exact implementation base:

`efbc0062582d2eb94a978344a13594a82bd4339a`

the functional head:

`b6c7891cdf74aa3ebe7d58a74d02917b22e5b876`

is:

- **3 commits ahead**
- **0 commits behind**
- merge base = exact implementation base.

Only three authorized files changed:

1. `data/global-material-catalog.v1.json`
   - new independent global material master-data authority;
2. `tests/bp-026-material-identity-article-mapping.spec.js`
   - focused BP-026 authority-boundary regression contract;
3. `ui/panels/WorkareaPanel.base.js`
   - minimal catalog loading, project mapping lookup, support materialId propagation and runtime identity resolution.

No unrelated product surface changed.

## Focused BP-026 regression protection

The BP-026 test protects that:

- the global material catalog is a separate authority;
- Workarea loads that catalog independently;
- project material mappings are read from `app.project.materialMappings`;
- identity resolution consumes existing BP-016/BP-017/BP-021/BP-024 preparation rows;
- BP-026 does not introduce route-length or stick-count calculation;
- support keeps BP-021 quantity semantics while carrying optional `materialId`;
- no persistent `resolutionStatus` is introduced;
- existing technical asset catalog and global asset library are not redefined.

## Product CI evidence

Exact-head Product CI evidence for:

`b6c7891cdf74aa3ebe7d58a74d02917b22e5b876`

is:

- workflow: **Product CI**
- run: **#1460**
- run ID: `36451414338`
- branch: `feature/BP-026-practical-material-identity-article-mapping`
- event: `push`
- attempt: `1`
- status: `completed`
- conclusion: **success**

The exact-head run completed JS Syntax Check, Import Graph Check, BP-025, BP-024, BP-019, BP-018 and BP-017 regressions, UI Wiring E2E and Smoke Tests successfully.

## Verification result

The BP-026 Implementation Verification / Scope / Regression Gate for exact functional head `b6c7891cdf74aa3ebe7d58a74d02917b22e5b876` is:

**PASS**

Verified properties:

- exact authorized three-file scope;
- separate global material authority;
- stable materialId-based resolution;
- project references instead of copied master data;
- support materialId does not replace BP-021 quantity authority;
- no new planning/geometry/material-quantity authority;
- unresolved identity remains runtime-derived;
- no asset-catalog authority collision;
- no output-schema change;
- exact-head Product CI #1460 fully green.

## Explicit non-scope retained

BP-026 does not implement:

- manufacturer online catalog imports;
- Niedax/Hilti online integration;
- suppliers or supplier order numbers;
- prices or discounts;
- inventory;
- packaging units or order optimization;
- substitutions;
- automatic technical product selection;
- automatic fitting variants;
- EPLAN coupling;
- Assembly BOM merge;
- XLSX/PDF output;
- 3D materialization;
- automatic quantity calculations;
- materialId-based output consolidation;
- manufacturer/article columns in existing CSV exports.

## Freeze decision

**BP-026 is FROZEN at functional head `b6c7891cdf74aa3ebe7d58a74d02917b22e5b876`.**

This functional head is the verified product/test/CI authority for BP-026.

The completion/freeze documentation commit containing this file may become the full freeze branch head, but it does not replace the functional freeze head above.

No integration to `main` is authorized by this gate.
