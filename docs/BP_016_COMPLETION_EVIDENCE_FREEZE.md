# BP-016 – Practical Cable Tray Material Preparation – Completion / Evidence / Freeze

## Status

**FROZEN WITH KNOWN BASELINE LIMITATIONS**

Functional Freeze Head:

`18f058373c14e1c9c36b094e40b25fef622a42ec`

Authorized base / current main at freeze time:

`9429ba02270f93abb0d9ba1bdea0d3a37dce6898`

Feature branch:

`feature/BP-016-practical-cable-tray-material-preparation`

This document records completion evidence only. It does not integrate BP-016 into `main`.

## Purpose

BP-016 adds the first project-wide practical cable-tray basic-material preparation projection. It refines the existing BP-007 new-route material requirement by preserving the already persistent tray type dimension while keeping route geometry, route length and material output as existing/derived authorities.

## Authority and data flow

The authoritative flow remains:

`cable-tray.route.points[]`
→ BP-004 geometric route length / `_getCableTrayEvaluation().routes`
→ existing persistent `tray.widthMm`, `tray.trayType`, `tray.routeClass`
→ BP-016 runtime grouping for `routeClass = "new"`
→ BP-007-compatible 3 m material calculation
→ existing cable-tray evaluation UI

BP-016 adds `trayType` to the existing BP-004-derived route row. It does not rescan route geometry or establish another route-length authority.

The BP-007 helper `_getCableTrayMaterialRequirement()` remains present and unchanged.

## Practical material preparation contract

`_getCableTrayMaterialPreparationV1()` consumes only:

`_getCableTrayEvaluation().routes`

Only routes with:

`routeClass === "new"`

contribute to purchasing material.

Rows are grouped by the already existing route dimensions:

`widthMm + trayType`

Each runtime row contains:

- `widthMm`
- `trayType`
- `plannedLengthM`
- `stickLengthM`
- `requiredStickCount`
- `purchaseLengthM`
- `offcutM`

The BP-007 purchasing semantics remain:

- standard stick length = 3 m
- required stick count = `ceil(plannedLengthM / 3)`
- purchase length = required stick count × 3 m
- offcut = purchase length − planned length

Existing / bridge routes contribute no purchasing requirement.

## trayType boundary

`tray.trayType` was already persistent before BP-016. BP-016 only carries that existing value into the BP-004-derived route row and uses it as a grouping dimension.

The existing fallback remains `"cable-tray"`.

BP-016 does not define new tray types, reinterpret tray-type semantics, or introduce a tray-type catalog.

## UI contract

The existing cable-tray evaluation path is reused.

`_showCableTrayEvaluation()` continues to display the existing route details and width/class totals. Its existing `Materialbedarf (Neu)` section now renders the BP-016 preparation rows and includes `trayType`.

No new workspace, mode or panel is introduced.

## Persistence and BOM boundary

BP-016 material rows are runtime-derived only.

It does not introduce or mutate:

- route material persistence
- material-preparation collections
- Assembly / AssemblyLab BOM
- asset catalog material records
- manufacturer mappings
- article-number mappings

The Assembly BOM remains a separate component/assembly authority and is not reused as cable-tray material authority.

## Exact implementation diff

Comparison:

`9429ba02270f93abb0d9ba1bdea0d3a37dce6898`
→
`18f058373c14e1c9c36b094e40b25fef622a42ec`

Result:

- status: ahead
- ahead: 2 commits
- behind: 0
- merge base: exactly the authorized base
- `ui/panels/WorkareaPanel.base.js`: +27 / -2
- `tests/bp-016-cable-tray-material-preparation.spec.js`: +45 / -0
- no other files changed

## Focused BP-016 contract test

`tests/bp-016-cable-tray-material-preparation.spec.js` protects:

- propagation of existing `trayType` into BP-004-derived route rows
- use of `_getCableTrayEvaluation().routes`
- exclusion of routes other than `routeClass = "new"`
- grouping by `widthMm + trayType`
- accumulation from the existing derived `route.lengthM`
- BP-007-compatible 3 m / ceil / purchase-length / offcut semantics
- reuse of the existing `Materialbedarf (Neu)` UI
- absence of a new persistent material-preparation authority
- absence of tray article/manufacturer authority
- absence of Assembly-BOM reuse

## Exact-Head CI evidence

Exact head:

`18f058373c14e1c9c36b094e40b25fef622a42ec`

All 16 push workflows completed:

- 10 successful
- 6 failed

Syntax Check completed successfully. The six failures match the known repository baseline limitations.

### Known baseline limitations

1. **CI Checks (Syntax + Imports + Manifest + UI Wiring)**  
   Existing smoke test fails on a 404 console error. Syntax, import graph, navigation, manifest and preceding regression checks pass.

2. **UI-MIG-05B Planning Left Area Gate**  
   Existing visibility assertion times out waiting for the legacy `tab.assemblylab` button to satisfy `toBeHidden()`.

3. **UI-MIG-05C Insert Sources Gate**  
   Fails at the prerequisite UI-MIG-05B regression before its own acceptance step.

4. **TECH-WA-FREEZE-01B.2 Heartbeat Gate**  
   Existing 60-second canvas click timeout because the Planning topbar `Auswahl` button intercepts pointer events.

5. **TECH-WA-FREEZE-01B.3 RAF Abort Gate**  
   Reaches the same existing TECH-WA-FREEZE-01B.2 pointer-event failure before its own acceptance step.

6. **TECH-WA-FREEZE-01C Mobile Viewer Stability Gate**  
   Reaches the same existing TECH-WA-FREEZE-01B.2 pointer-event failure before its own acceptance step.

No Exact-Head CI failure was identified as newly introduced by BP-016.

## Explicit non-scope

BP-016 does not add or derive:

- covers
- dividers
- connectors
- bends, T-pieces or other fittings
- C-rails, supports or fastening material
- fastening intervals
- manufacturer assignment
- article-number assignment
- suppliers or prices
- warehouse stock
- reserve percentages or automatic uplift
- manual material overrides
- EPLAN coupling
- cable fill
- automatic 3D materialization
- Assembly-BOM merge
- CSV/XLSX/PDF material export

These require separate future authority/contracts and must not be inferred from `points[] + widthMm + trayType + routeClass`.

## Freeze decision

The BP-016 implementation at
`18f058373c14e1c9c36b094e40b25fef622a42ec`
satisfies the authorized minimal scope and the defined authority/output contract.

Functional status:

**FROZEN WITH KNOWN BASELINE LIMITATIONS**

The functional Freeze Head remains exactly
`18f058373c14e1c9c36b094e40b25fef622a42ec`.

This documentation commit is completion/evidence metadata only and must not be treated as a change to BP-016 functional behavior.
