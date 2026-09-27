# BP-014 – Practical Cable Cut List / Preparation Workflow

## Completion / Evidence / Freeze

**Status:** FROZEN WITH KNOWN BASELINE LIMITATIONS  
**Functional freeze head:** `26f703a970d0219f7c65551486c51031a4ccca28`  
**Authorized base:** `038f1da82e5fb21948a083b7e28934a17d603fe9`  
**Feature branch:** `feature/BP-014-practical-cable-cut-list-preparation`

## 1. Scope completed

BP-014 adds a project-wide, runtime-only cable preparation view over the existing cable authority.

Authority remains:

`assembly.instance.cableLines[]`

BP-014 does not create a second cable collection, cut-list store, preparation-line store, or new persistence model.

The project-wide view:
- reads current scene objects through the existing Workarea scene access,
- includes `assembly.instance` objects and their existing active `cableLines[]`,
- preserves owning assembly/project context per row,
- reuses `_getCableLineRouteAssignmentV1(cableLine, sceneObj)`,
- exposes the existing BP-009–013 derived planning results for practical preparation,
- opens on demand in the existing Workarea wide-modal mechanism.

The existing assembly-specific electrical/cable editor remains separate and unchanged.

## 2. Authority / behavior contract

Persistent CableLine data remains owned by the existing CableLine model. BP-014 may display existing fields such as cable number, source, target, cable type, assembly/location context, reserves and cut allowance without redefining their semantics.

Derived values including:
- `knownMinimumTrayPathM`
- `plannedRequiredLengthM`
- `plannedCutLengthM`

remain runtime-only and are obtained from the existing BP-009–013 derivation path.

BP-014 does not persist `plannedRequiredLengthM` or `plannedCutLengthM`.

When `plannedCutLengthM` is unavailable, the preparation view reports the cut length as undetermined rather than inventing a value.

## 3. Existing export protected

The existing assembly cable-list JSON export remains unchanged:

`baustellenplaner.assemblylab.cablelist.export.v1`

Its existing CableLine payload remains based on:

`cableLines: sceneObj.cableLines || []`

BP-014 does not introduce a new export format and does not reinterpret the existing assembly JSON export as a project preparation export.

## 4. Explicit non-scope

BP-014 does not implement:
- CSV / Excel / PDF export decisions,
- new cable or cut-list persistence,
- drum/spool assignment,
- remaining-length management,
- waste optimization,
- warehouse/order quantities,
- BOM mutation,
- automatic percentage uplift,
- automatic rounding,
- 3D routing,
- route geometry editing.

## 5. Implementation evidence

Production commit:

`5331059b534c6c5903119db05e93bed7584edfeb`

Focused contract-test commit / functional head:

`26f703a970d0219f7c65551486c51031a4ccca28`

Exact diff from authorized base `038f1da82e5fb21948a083b7e28934a17d603fe9`:
- `ui/panels/WorkareaPanel.base.js`: +102 / -0
- `tests/bp-014-cable-cut-list-preparation.spec.js`: +33 / -0
- 2 commits ahead / 0 behind
- merge base remains the authorized base exactly.

No other file is part of the functional diff.

## 6. Focused BP-014 contract test

`tests/bp-014-cable-cut-list-preparation.spec.js` protects:
- project preparation collector existence,
- collection from existing `assembly.instance.cableLines[]`,
- exclusion of disabled CableLines,
- direct reuse of `_getCableLineRouteAssignmentV1(...)`,
- project preparation UI presence,
- explicit undetermined cut-length behavior,
- absence of a second `cutList` / `preparationLines` authority,
- absence of persisted `plannedCutLengthM` / `plannedRequiredLengthM`,
- preservation of the existing assembly cable-list JSON schema and payload,
- preservation of the BP-013 planned-cut derivation authority.

## 7. Exact-head CI evidence

Exact head:

`26f703a970d0219f7c65551486c51031a4ccca28`

16 push workflow runs completed:
- 10 SUCCESS
- 6 FAILURE

Successful evidence includes Syntax Check, Import Graph and the unaffected Planning/Workarea gates.

The six failures match the already-known baseline limitation pattern:

1. **CI Checks (Syntax + Imports + Manifest + UI Wiring)**  
   Failure remains in the historical Smoke Tests step. Earlier syntax/import/manifest/regression steps pass.

2. **UI-MIG-05B Planning Left Area Gate**  
   Existing Planning Left Area acceptance limitation.

3. **UI-MIG-05C Insert Sources Gate**  
   Fails on the UI-MIG-05B prerequisite; its own acceptance step is skipped.

4. **TECH-WA-FREEZE-01B.2 Heartbeat Gate**  
   Existing 60-second Playwright canvas-click timeout. The `Auswahl` topbar button intercepts pointer events on the canvas, matching the previously documented baseline behavior.

5. **TECH-WA-FREEZE-01B.3 RAF Abort Gate**  
   Fails on the TECH-WA-FREEZE-01B.2 prerequisite; its own acceptance step is skipped.

6. **TECH-WA-FREEZE-01C Mobile Viewer Stability Gate**  
   Fails on the TECH-WA-FREEZE-01B.2 prerequisite; downstream acceptance steps are skipped.

No Exact-Head CI evidence identifies a new BP-014 regression.

## 8. Freeze decision

BP-014 functional scope is complete and frozen at:

`26f703a970d0219f7c65551486c51031a4ccca28`

Decision:

**FROZEN WITH KNOWN BASELINE LIMITATIONS**

The six CI failures are retained as known baseline limitations and are not reclassified as BP-014 regressions.

This document records completion/freeze evidence only. Integration into `main` is explicitly not part of this gate.
