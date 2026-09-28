# BP-024 – Completion / Evidence / Freeze

Status: **FROZEN – FUNCTIONAL HEAD VERIFIED**

## Authority

- Definition / Scope base: `02eafcc0e59680b3faf44d3aa13a821d71121ab9`
- Feature branch: `feature/BP-024-fitting-material-preparation`
- Functional freeze head: `a7d1813bf11f966d3833102c64bf472df794792d`
- Definition: `docs/BP_024_DEFINITION_SCOPE.md`
- This document records completion evidence only. It does not authorize or perform integration to `main`.

## Frozen capability

BP-024 adds a runtime-derived cable-tray fitting material preparation projection over the existing BP-023 fitting authority.

The sole fitting authority remains:

`app.project.workspace.scene.cableTrayFittings[]`

BP-024 introduces no second fitting, geometry, material, quantity, catalog, article or persistence authority.

The implementation derives material rows through `_getCableTrayFittingMaterialPreparationV1()`.

For every explicit BP-023 fitting record, the existing `_validateCableTrayFittingV1()` contract remains authoritative. Only records that validate successfully contribute to material quantity.

The frozen V1 mapping is:

- `bend` → `Bogen`
- `tee` → `T-Stück`
- `reducer` → `Reduzierung`
- `connector` → `Verbinder`

Each valid explicit BP-023 fitting record contributes exactly one piece. Rows use unit `Stk` and group quantity by fitting kind.

Geometry alone never creates fitting material. Angles, corners, intersections, coincident endpoints, route length, tray width, tray type, distance, cable assignment and equipment binding are not used to infer a fitting.

## Unresolved / invalid fittings

Invalid or unresolved BP-023 fitting records are excluded from material quantity.

They contribute only to the runtime-derived diagnostic `unresolvedCount`.

BP-024 does not repair, replace, clamp, relocate, delete or silently count unresolved fitting references. Existing BP-023 broken-reference and point-index limitations remain unchanged.

No derived BP-024 rows, totals or diagnostics are persisted.

## Minimal UI

The existing tray UI receives only a compact derived status display:

`Formteile: <quantity> Stk`

and, when applicable:

`Formteile: <quantity> Stk · <unresolvedCount> ungelöst`

No separate material view, new export button or new fitting-authoring workflow is introduced by BP-024.

## BP-022 isolation

BP-022 remains frozen and unchanged.

`_getCombinedCableTrayMaterialOutputRowsV1()` does not consume `_getCableTrayFittingMaterialPreparationV1()`.

Therefore BP-024 does not add fitting rows to the existing Gesamtmaterial CSV or BP-018 Material CSV. Any future fitting-output integration requires a separate capability and authorization.

BP-016/BP-017/BP-018 and BP-019/BP-020/BP-021 material/support authorities remain unchanged.

## Focused regression protection

`tests/bp-024-fitting-material-preparation.spec.js` protects the BP-024 source contract, including:

- consumption of `this._scene.cableTrayFittings`,
- reuse of `_validateCableTrayFittingV1()`,
- grouping of the four authorized fitting kinds,
- unit `Stk`,
- unresolved exclusion and diagnostic,
- absence of angle/distance/width/tray-type inference,
- absence of BP-024 persistence,
- continued BP-022 combined-output isolation,
- presence of the minimal fitting-material UI status.

The Product CI workflow explicitly runs this focused BP-024 regression.

## Verification blocker and fix

Initial implementation head:

`53e316fc81612a8c78aee0586e6f507f17ca0cd5`

Exact-head Product CI #1445, run ID `36444842669`, completed with failure.

Diagnosis confirmed that the BP-024 assertions had not failed. All three focused tests failed before assertion execution because Chromium was not installed when the BP-024 Playwright step ran.

Root cause: the newly added BP-024 regression step was positioned after `Install Playwright Test (minimal)` but before `Install Playwright Browsers`.

The authorized blocker fix changed only `.github/workflows/ci-checks.yml`, moving the BP-024 regression step behind `Install Playwright Browsers`.

Blocker-fix commit:

`a7d1813bf11f966d3833102c64bf472df794792d`

No product or test content changed in that blocker fix.

## Exact-head verification evidence

Exact functional head:

`a7d1813bf11f966d3833102c64bf472df794792d`

Product CI:

- workflow: `Product CI`
- run: **#1446**
- run ID: `36446366964`
- event: `push`
- attempt: `1`
- exact head SHA: `a7d1813bf11f966d3833102c64bf472df794792d`
- result: **SUCCESS**

The explicitly wired `BP-024 Fitting Material Preparation Regression` step completed successfully after `Install Playwright Browsers`.

The same exact-head run also completed the existing BP-019, BP-018, BP-017, wizard/UI and smoke regressions successfully.

## Scope verification

Against definition base `02eafcc0e59680b3faf44d3aa13a821d71121ab9`, the functional head is linear and contains only the authorized implementation surfaces:

- `ui/panels/WorkareaPanel.base.js`
- `tests/bp-024-fitting-material-preparation.spec.js`
- `.github/workflows/ci-checks.yml`

At functional verification the branch was four commits ahead and zero behind the definition base.

No manufacturer/article/catalog/supplier/price/inventory authority, no package/order optimization, no physical fitting dimensions, no automatic fitting recognition, no route topology rewrite, no stable point IDs, no 3D fitting capability and no BP-022 output integration are introduced.

## Freeze decision

BP-024 is **FROZEN** at functional head:

`a7d1813bf11f966d3833102c64bf472df794792d`

The functional capability, its focused regression protection, the diagnosed CI-ordering blocker and its minimal fix, and the fully green exact-head Product CI #1446 are recorded as completion evidence.

This documentation commit may become the full freeze branch head. The functional freeze head remains `a7d1813bf11f966d3833102c64bf472df794792d`.

No integration to `main` is performed by this gate.
