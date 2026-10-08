# BP-018 – Practical Cable Tray Material Output – Completion / Evidence / Freeze

## Status

**FROZEN WITH KNOWN BASELINE LIMITATION**

- Authorized base: `af9a2e784f7c724659cc0c918d4b1073717639da`
- Functional Freeze Head: `9977dbdd7bb3c194a3a3bce411d12e307bf73b9a`
- Feature branch: `feature/BP-018-practical-cable-tray-material-output`
- Product CI: **#1401**
- Exact-head workflow run: **36381670686**

## Purpose

BP-018 adds the first practical CSV output for the already derived cable-tray material preparation. It is an output projection only and introduces no second material authority.

## Input authorities

BP-018 consumes exclusively the existing derived rows from:

- `_getCableTrayMaterialPreparationV1().rows` (BP-016)
- `_getCableTrayAccessoryPreparationV1().rows` (BP-017)

BP-018 does not rescan `cable-tray.route.points[]`, does not recalculate route lengths, and does not independently derive 3 m stick quantities, purchase lengths, or offcut.

## CSV contract

One CSV row represents one already aggregated BP-016/BP-017 preparation row.

Columns:

1. `Kategorie`
2. `Trassentyp`
3. `Breite_mm`
4. `Planlaenge_m`
5. `Stangenlaenge_m`
6. `Anzahl_Stangen`
7. `Einkaufslaenge_m`
8. `Verschnitt_m`

Category projection:

- BP-016 base material → `Kabelrinne`
- BP-017 `cover` → `Deckel`
- BP-017 `divider` → `Trennsteg`

All numeric material values are copied from the upstream preparation rows into the output projection.

## Null / empty semantics

Missing material/accessory groups produce no artificial CSV row. BP-018 does not create zero rows or an additional “unbestimmt” material state.

Existing upstream semantics remain authoritative, including the existing `trayType` fallback and exclusion of non-new routes from purchasing preparation.

## Delivery

The output is reachable from the existing cable-tray context through **Material CSV**.

BP-018 reuses the established BP-015 delivery helpers:

- `_downloadTextFileV1(...)`
- `_copyToClipboard(...)`

No new download or filesystem mechanism was introduced.

## Exact implementation diff

Compared with authorized base `af9a2e784f7c724659cc0c918d4b1073717639da`, functional head `9977dbdd7bb3c194a3a3bce411d12e307bf73b9a` is linear and contains three commits with zero commits behind.

Changed files at the verified functional head:

- `.github/workflows/ci-checks.yml`: +3 / -0
- `tests/bp-018-cable-tray-material-output.spec.js`: +35 / -0
- `ui/panels/WorkareaPanel.base.js`: +68 / -0

No unrelated product files are part of BP-018.

## Focused regression evidence

The focused test is:

`tests/bp-018-cable-tray-material-output.spec.js`

Product CI contains the dedicated step:

`BP-018 Cable Tray Material Output Regression`

Result on exact functional head `9977dbdd7bb3c194a3a3bce411d12e307bf73b9a`:

**PASS**

The test verifies that BP-018:

- consumes BP-016/BP-017 preparation rows,
- maps Kabelrinne / Deckel / Trennsteg,
- exposes the defined CSV columns,
- reuses download and clipboard helpers,
- does not call `_getCableTrayEvaluation()` as a second route authority inside the BP-018 output block,
- does not recalculate `Math.ceil` or establish a new `stickLengthM = 3` authority there,
- does not introduce manufacturer/article/supplier/price/inventory/BOM fields.

## Exact-head Product CI evidence

Product CI **#1401**, run **36381670686**, executed against exact head `9977dbdd7bb3c194a3a3bce411d12e307bf73b9a`.

Successful checks include:

- JS Syntax Check
- Import Graph Check
- Navigation Foundation Check
- Manifest Integrity Check
- existing hall/planning regression checks
- BP-002 Hall Structural Configuration Regression
- Playwright Test installation
- **BP-018 Cable Tray Material Output Regression**
- BP-017 Cable Tray Accessory Planning Regression
- Wizard Reopen Happy Path
- UI-MIG IM02 Shell Acceptance
- UI-MIG IM03 Context Return Acceptance
- UI Wiring E2E

Only **Smoke Tests** failed.

## Known baseline limitation

The remaining Product CI failure is the already known Smoke-Test 404 console-error baseline limitation. It existed before BP-018 and is not a BP-018-specific regression.

BP-018 therefore completes as:

**FROZEN WITH KNOWN BASELINE LIMITATION**

## Explicit non-scope

BP-018 does not add:

- manufacturer or article numbers
- Niedax/catalog mapping
- light/heavy product variants
- anti-slip cover variants
- divider-height variants
- connectors, bends, T-pieces, or other form parts
- C-rails, supports, or fastening material
- support spacing
- prices or suppliers
- inventory/stock
- reserve/uplift factors
- manual material corrections/overrides
- BOM merge
- XLSX or PDF output
- automatic 3D materialization

Those remain future product capabilities and must not be inferred from this freeze.

## Freeze decision

The verified BP-018 functional behavior is frozen at:

`9977dbdd7bb3c194a3a3bce411d12e307bf73b9a`

This completion document is metadata/evidence only. Its commit becomes the full BP-018 Freeze Head and does not alter the functional freeze.
