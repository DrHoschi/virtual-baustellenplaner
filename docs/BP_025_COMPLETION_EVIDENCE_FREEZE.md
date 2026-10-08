# BP-025 – Fitting Material Output Integration – Completion / Evidence / Freeze

## Status

**FROZEN – FUNCTIONAL HEAD VERIFIED**

Definition / Scope base:

`6dbadf6057dc6fd783e92857460850ec21c9e9e7`

Feature branch:

`feature/BP-025-fitting-material-output-integration`

Functional freeze head:

`e524fca0b4e381529732b7313467e83ac818f833`

Definition:

`docs/BP_025_DEFINITION_SCOPE.md`

This document freezes the verified BP-025 functional state only. It does not authorize integration to `main`.

## Capability completed

BP-025 closes the output gap between BP-024 fitting-material preparation and the existing BP-022 combined material output.

The implemented data flow is:

`_getCableTrayFittingMaterialPreparationV1().rows`
→ `_getCombinedCableTrayMaterialOutputRowsV1()`
→ existing combined material CSV path.

No new fitting-planning authority, fitting-material authority, persistence model or export format was introduced.

## Binding authority boundary

The frozen BP-025 rule is:

**consume BP-024 rows only – never recount BP-023 or infer from geometry**

BP-025 does not read `scene.cableTrayFittings[]` to calculate output quantities.

BP-025 does not independently invoke BP-023 fitting validation to calculate output quantities.

BP-025 does not scan route points, angles, intersections, endpoint coincidence, distances, widths or tray types to discover fittings.

BP-024 remains authoritative for deciding which explicit BP-023 fitting records contribute material and for deriving their grouped quantities.

## Combined-output projection

The verified implementation extends only `_getCombinedCableTrayMaterialOutputRowsV1()`.

It now consumes:

- existing tray/basic-accessory rows;
- existing support-material rows;
- BP-024 fitting-material rows.

Each BP-024 fitting-material row is projected as:

- `category: "Formteil"`
- `name: row.name`
- `unit: row.unit`
- `quantity: row.quantity`
- `supportType: null`
- `trayType: null`
- `widthMm: null`
- `plannedLengthM: null`
- `stickLengthM: null`
- `requiredStickCount: null`
- `purchaseLengthM: null`
- `offcutM: null`

The output does not invent values for fields BP-024 does not supply.

## No double counting

BP-025 performs no independent fitting count.

The material quantity is copied directly from `row.quantity`.

The combined-output method does not contain:

- direct `cableTrayFittings` access;
- `_validateCableTrayFittingV1()`;
- `unresolvedCount`;
- route-point fitting recognition;
- angle/distance fitting recognition.

Therefore fitting quantity remains single-sourced from BP-024.

## Unresolved fitting boundary

BP-024 continues to own unresolved fitting diagnostics.

BP-025 consumes only `.rows`.

`unresolvedCount` is not converted into a material row, zero-quantity row, guessed fitting or additional quantity.

The existing BP-024 UI diagnostic remains separate from material output.

## BP-022 combined-output / CSV boundary

The existing combined CSV implementation remains unchanged.

`_makeCombinedCableTrayMaterialCSVV1(rows = [])` was not given fitting-specific calculation or fitting-specific authority.

The existing twelve-column Gesamtmaterial CSV shape remains unchanged.

BP-025 fitting rows reach the CSV exclusively through the already-existing combined-output row pipeline.

No new export/download mechanism was added.

## BP-018 boundary

The BP-018 Material CSV remains separate and unchanged.

BP-025 did not modify the BP-018 material-output calculation or its CSV generation.

Formteile are integrated only into the later combined **Gesamtmaterial CSV** path.

## Existing material capabilities preserved

BP-025 does not alter the existing calculations or authorities for:

- Kabelrinne;
- Deckel;
- Trennsteg;
- Unterstützungsmaterial.

There is no cross-source material identity merge.

## Persistence boundary

BP-025 adds no persistent state.

It does not persist:

- fitting output rows;
- fitting quantities;
- combined rows;
- CSV content;
- copied BP-024 material state;
- derived totals.

The capability remains runtime-derived output projection.

## Implementation scope / exact diff

Against Definition / Scope base:

`6dbadf6057dc6fd783e92857460850ec21c9e9e7`

the functional head:

`e524fca0b4e381529732b7313467e83ac818f833`

is:

- **4 commits ahead**
- **0 commits behind**
- merge base = Definition / Scope base.

Only the four authorized files changed:

1. `.github/workflows/ci-checks.yml`
   - explicit BP-025 Product CI regression step;
2. `tests/bp-024-fitting-material-preparation.spec.js`
   - minimal compatibility update for the separately authorized BP-025 downstream integration;
   - BP-024 unresolved diagnostic remains excluded from material rows;
3. `tests/bp-025-fitting-material-output-integration.spec.js`
   - focused BP-025 regression contract;
4. `ui/panels/WorkareaPanel.base.js`
   - minimal combined-output fitting-row projection.

No unrelated product surface was changed.

## Focused BP-025 regression protection

`tests/bp-025-fitting-material-output-integration.spec.js` protects that:

- combined output consumes `_getCableTrayFittingMaterialPreparationV1().rows`;
- fitting rows use `category: "Formteil"`;
- `name`, `unit` and `quantity` are projected directly from BP-024 rows;
- non-applicable support/tray/length fields remain null;
- combined output does not directly access `cableTrayFittings`;
- combined output does not call `_validateCableTrayFittingV1()`;
- `unresolvedCount` is not projected;
- no route-point/angle/distance fitting inference is introduced;
- existing Gesamtmaterial CSV is reused;
- BP-018 Material CSV remains a separate path.

## BP-024 regression compatibility

The BP-024 regression was changed only where its previous test intentionally prohibited any combined-output fitting integration.

After BP-025 authorization it now verifies the new capability boundary:

- BP-024 still returns `{ rows, unresolvedCount }`;
- combined output consumes only `_getCableTrayFittingMaterialPreparationV1().rows`;
- combined output does not consume `unresolvedCount`.

BP-024 fitting-material preparation semantics themselves were not changed.

## Product CI evidence

Exact-head Product CI evidence for:

`e524fca0b4e381529732b7313467e83ac818f833`

is:

- workflow: **Product CI**
- run: **#1455**
- run ID: `36448801454`
- branch: `feature/BP-025-fitting-material-output-integration`
- event: `push`
- attempt: `1`
- status: `completed`
- conclusion: **success**

The explicit step:

**BP-025 Fitting Material Output Integration Regression**

completed successfully.

The same exact-head run also completed the existing BP-024, BP-019, BP-018 and BP-017 regressions successfully, followed by the existing UI and smoke gates successfully.

## Verification result

The BP-025 Implementation Verification / Scope / Regression Gate for exact functional head `e524fca0b4e381529732b7313467e83ac818f833` is:

**PASS**

Verified properties:

- authorized four-file scope only;
- BP-024 rows are the sole fitting-material input;
- no BP-023 recount;
- no geometry-derived fitting recognition;
- no fitting-specific persistence;
- no new CSV schema;
- BP-018 remains separate;
- existing combined CSV path is reused;
- focused BP-025 regression is explicitly wired into Product CI;
- exact-head Product CI #1455 is fully green.

## Explicit non-scope retained

BP-025 still does not implement:

- fitting recognition/suggestions/creation;
- BP-023 topology changes;
- BP-024 counting changes;
- independent fitting validation;
- BP-018 fitting integration;
- new CSV columns or export format;
- XLSX/PDF output;
- manufacturer/article/catalogue identity;
- fitting BOM;
- prices/suppliers/inventory;
- package/order optimization;
- fitting dimensions;
- width/type-specific article selection;
- support changes near fittings;
- fitting mounting hardware;
- route splitting/merging;
- cable-routing changes;
- 3D fittings;
- EPLAN coupling;
- Assembly BOM merge.

## Freeze decision

**BP-025 is FROZEN at functional head `e524fca0b4e381529732b7313467e83ac818f833`.**

This functional head is the verified product/test/CI authority for BP-025.

The completion/freeze documentation commit that contains this file may become the full freeze branch head, but it does not replace the functional freeze head above.

No integration to `main` is authorized by this gate.
