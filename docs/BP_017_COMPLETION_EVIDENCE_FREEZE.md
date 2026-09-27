# BP-017 – Practical Cable Tray Accessory Planning – Completion / Evidence / Freeze

## Status

**FROZEN WITH KNOWN BASELINE LIMITATION**

Functional Freeze Head:

`72f75cb9229eb4dfa08768e218969faff74bc394`

Authorized base / main at implementation start:

`d3778f0f226b557050b6d09a485d0134fa461a58`

Feature branch:

`feature/BP-017-practical-cable-tray-accessory-planning`

This document records completion evidence only. It does not integrate BP-017 into `main`.

## Purpose and authority

BP-017 extends the existing practical cable-tray route planning with the first route-owned accessory planning for covers and dividers.

Existing `cable-tray.route` remains authoritative. Geometry remains in `points[]`; existing `tray.widthMm`, `tray.trayType` and `tray.routeClass` remain unchanged authorities.

BP-017 adds exactly two persistent manual route-owned fields:

- `tray.coverRequired` – boolean
- `tray.dividerCount` – non-negative integer

No second geometry or route-length authority is introduced.

## Derived accessory preparation contract

`_getCableTrayAccessoryPreparationV1()` consumes the existing `_getCableTrayEvaluation().routes`.

Only `routeClass === "new"` contributes to purchasing requirements.

The standard stick length is 3 m.

Cover requirement:
- planned length = route length
- required sticks = ceil(planned length / 3)
- purchase length = sticks × 3 m
- offcut = purchase length − planned length

Divider requirement:
- planned divider length = route length × divider count
- required sticks = ceil(planned divider length / 3)
- purchase length = sticks × 3 m
- offcut = purchase length − planned divider length

Accessory rows remain separated by accessory kind plus the existing `widthMm + trayType` dimensions.

Existing / bridge routes create no purchasing requirement.

## UI and persistence

The existing cable-tray properties/evaluation context is reused.

Selected routes expose:
- Deckel: Ja/Nein
- Trennstege: Anzahl

Changes persist through the existing scene/store persistence path.

The existing `Materialbedarf (Neu)` from BP-016 remains present. BP-017 adds `Zubehörbedarf (Neu)`; it does not replace or reinterpret BP-016 material preparation.

## Exact implementation diff

Comparison:

`d3778f0f226b557050b6d09a485d0134fa461a58`
→
`72f75cb9229eb4dfa08768e218969faff74bc394`

Result:
- status: ahead
- ahead: 4 commits
- behind: 0
- merge base: exactly the authorized base
- `ui/panels/WorkareaPanel.base.js`: +82 / -2
- `tests/bp-017-cable-tray-accessory-planning.spec.js`: +40 / -0
- `.github/workflows/ci-checks.yml`: +3 / -0
- no other files changed

The CI-only commits add the focused BP-017 test to Product CI and place it after the existing minimal Playwright-test installation. They do not change product behavior or test assertions.

## Focused BP-017 evidence

Exact head:

`72f75cb9229eb4dfa08768e218969faff74bc394`

Product CI #1395 / run `36347029884` executed the focused step:

`BP-017 Cable Tray Accessory Planning Regression`

Result:

**PASS**

The focused contract test protects the route-owned defaults/persistence, use of existing route evaluation, new-route-only purchasing, cover/divider calculations, grouping dimensions, 3 m purchasing semantics, accessory evaluation UI and the explicit absence of invented manufacturer/article authority.

## Exact-Head Product CI evidence

Product CI #1395 ran against exactly `72f75cb9229eb4dfa08768e218969faff74bc394`.

All checks through the focused BP-017 regression and subsequent browser/regression gates passed:
- syntax/import/navigation/manifest checks: PASS
- existing product regression checks: PASS
- BP-002 regression: PASS
- minimal Playwright installation: PASS
- BP-017 focused regression: PASS
- Playwright browser installation: PASS
- Wizard Reopen: PASS
- UI-MIG IM02: PASS
- UI-MIG IM03: PASS
- UI Wiring E2E: PASS

Only `Smoke Tests` failed.

### Known baseline limitation

The remaining Product CI smoke failure is the already documented repository baseline 404 console-error limitation. It predates BP-017 and was already retained by BP-CI-01 as a known baseline limitation.

No BP-017-specific Exact-Head regression blocker remains.

## Explicit non-scope

BP-017 does not add or derive:
- manufacturer or article numbers
- Niedax/product catalog mapping
- light/heavy accessory variants
- anti-slip cover variants
- divider height variants
- connectors, bends, T-pieces or other fittings
- C-rails, supports or fastening material
- support spacing
- suppliers, prices or inventory
- reserve factors
- manual material overrides
- BOM merge
- CSV/XLSX/PDF material export
- automatic 3D derivation

## Freeze decision

The BP-017 implementation at
`72f75cb9229eb4dfa08768e218969faff74bc394`
satisfies the authorized minimal scope and the defined persistence, derivation and compatibility contract.

Functional status:

**FROZEN WITH KNOWN BASELINE LIMITATION**

The functional Freeze Head remains exactly
`72f75cb9229eb4dfa08768e218969faff74bc394`.

This documentation commit is completion/evidence metadata only and must not be treated as a change to BP-017 functional behavior.
