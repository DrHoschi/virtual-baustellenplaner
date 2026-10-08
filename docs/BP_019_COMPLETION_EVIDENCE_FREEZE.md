# BP-019 – Practical Cable Tray Support Planning – Completion / Evidence / Freeze

## Status

**FROZEN WITH KNOWN BASELINE LIMITATION**

Functional Freeze Head:

`e09f0542865eb3719343ce31d096b75a0a30035b`

Authorized base:

`4e0135778c91e5fbd56b28fc20df3bbc8cc879d1`

Feature branch:

`feature/BP-019-practical-cable-tray-support-planning`

## Purpose

BP-019 adds the first minimal practical support-quantity planning for new cable-tray routes without introducing a second route/material authority or pretending to know project-specific mounting hardware.

## Authority contract

Existing authorities remain unchanged:

- `cable-tray.route.points[]` remains the sole route geometry authority.
- Route length remains derived from `points[]`.
- `tray.widthMm`, `tray.trayType`, and `tray.routeClass` remain route-owned authorities.
- Only `routeClass === "new"` participates in BP-019 support planning.

BP-019 adds exactly one persistent manual route-owned planning input:

- `tray.supportSpacingM`

A valid value is finite and greater than zero. Missing, zero, negative, or otherwise invalid input is normalized to `null` / undetermined. BP-019 does not infer a technical support spacing.

## Derived-state contract

Support quantities are runtime-derived only. BP-019 introduces no persistent `supportCount`, support positions, or second geometry authority.

For each new route with route length `L > 0` and valid `supportSpacingM > 0`:

`supportCount = max(2, ceil(L / supportSpacingM) + 1)`

This is a V1 planning-quantity rule. It counts start and end support in the quantity model and therefore yields at least two supports for a non-zero route. It does not assert physical support coordinates.

Routes without a valid support spacing are kept as undetermined and do not receive an invented support quantity.

## Aggregation

Derived support requirements are grouped by:

- `widthMm`
- `trayType`
- `supportSpacingM`

For each group BP-019 derives route count, accumulated planned route length, and accumulated support count.

## UI / persistence

The existing selected cable-tray context receives one numeric input:

- **Stützabstand in Metern**

Changes persist through the existing scene persistence path with reason `cable-tray-support-spacing`.

The existing cable-tray evaluation receives a **Unterstützungsplanung (Neu)** section and explicitly reports new routes whose support spacing is undetermined.

New cable-tray routes initialize `tray.supportSpacingM` to `null`.

## Functional implementation evidence

Functional implementation changed only:

- `ui/panels/WorkareaPanel.base.js`
- `tests/bp-019-cable-tray-support-planning.spec.js`
- `.github/workflows/ci-checks.yml` for focused-test inclusion

The focused BP-019 contract test protects:

- route-owned persistence of `supportSpacingM`
- `null` default / undetermined semantics
- reuse of existing cable-tray evaluation rows
- new-route-only planning
- exact V1 support-count formula
- grouping by width, tray type, and support spacing
- absence of mounting-hardware/article/manufacturer logic
- presence of the existing-context support-planning UI/evaluation

## Exact-head CI evidence

Product CI #1407

Run ID:

`36383151836`

Exact head:

`e09f0542865eb3719343ce31d096b75a0a30035b`

Result:

- JS Syntax Check: PASS
- Import Graph Check: PASS
- Navigation Foundation Check: PASS
- Manifest Integrity Check: PASS
- PROJECT-SETUP-01E.1 Hall Config Regression: PASS
- BP-HI01B.1 Semantic Hall Generator Regression: PASS
- BP-HI01B.2 Grid Structure Projection Regression: PASS
- BP-HI01B.3 Rapid Hall Edit Binding Regression: PASS
- BP-HI01B.3R Product Reachability Regression: PASS
- BP-HI01B.3R-R5 Three Readonly Transform Regression: PASS
- UI-REC-01A CSS Shell Authority Regression: PASS
- UI-REC-01B Global Shell Icon Layout Regression: PASS
- BP-002 Hall Structural Configuration Regression: PASS
- BP-019 Cable Tray Support Planning Regression: **PASS**
- BP-018 Cable Tray Material Output Regression: PASS
- BP-017 Cable Tray Accessory Planning Regression: PASS
- PROJECT-SETUP-01E.1 Wizard Reopen Happy Path: PASS
- UI-MIG IM02 Shell Acceptance: PASS
- UI-MIG IM03 Context Return Acceptance: PASS
- UI Wiring E2E: PASS
- Smoke Tests: **FAIL – known baseline limitation**

The only failing Product CI step is the pre-existing Smoke Tests baseline. No BP-019-specific regression blocker was observed.

## Known baseline limitation

Product CI remains red because of the already documented existing Smoke-Test 404 console-error baseline. BP-019 neither introduces nor resolves that baseline issue.

## Explicit non-scope

BP-019 does not add:

- automatic/default technical support spacing by tray width, type, load, or manufacturer
- support positions or automatic 2D/3D placement
- C-rail quantities or lengths
- consoles/brackets
- threaded rods
- clamps
- screws, anchors, or dowels
- wall/ceiling/floor mounting classification
- load or weight calculation
- special support rules near bends, T-pieces, fittings, starts, or endpoints
- manufacturer or article-number assignment
- Hilti/Niedax mapping
- prices, suppliers, inventory, or BOM merge
- cable-fill-derived spacing rules
- fittings/form-part planning

These require separate future authority/contracts.

## Freeze decision

BP-019 is **FROZEN WITH KNOWN BASELINE LIMITATION**.

The functional freeze is `e09f0542865eb3719343ce31d096b75a0a30035b`.

The known Product CI Smoke-Test baseline remains non-blocking for BP-019 because the focused BP-019 regression and all preceding product/regression gates pass on the exact functional head.

This completion document is metadata/evidence only and does not change the functional product scope.
