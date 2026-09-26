# BP-007 – Practical Cable Tray Material Requirement

## Status
**DEFINED / SCOPED / NOT IMPLEMENTED**

Authoritative reconciliation base:

`main = 10ab1fad5d7a8bc45faaecef2998b90e4cc6bd24`

This document records the BP-007 definition and minimal implementation scope only. It does not authorize implementation or creation of a feature branch.

## Practical problem
BP-002 through BP-006 provide practical 2D cable-tray routes, route classification, derived length evaluation, point correction and endpoint/equipment binding.

The planner can therefore tell how many metres of new 100 mm and 200 mm tray are planned, but it does not yet translate that planned route length into a simple purchasing quantity for standard 3 m tray sticks.

## Existing authorities reused
BP-007 must reuse the existing Workarea scene authority:

`app.project.workspace.scene.objects[]`

For `type = "cable-tray.route"`:
- `points[]` remains the sole persistent geometry authority;
- `tray.widthMm` remains width authority;
- `tray.trayType` remains tray-type authority;
- `tray.routeClass = "new" | "existing"` remains classification authority;
- `startRef/endRef` from BP-006 remain unrelated semantic endpoint references.

Existing derived helpers remain authoritative for route length:
- `_getCableTrayLengthWorld(route)`
- `_getCableTrayLengthM(route)`
- `_getCableTrayEvaluation()`
- `_getCableTrayGroupedTotals()`

No second route, length or material persistence authority is introduced.

## Existing BOM/material capabilities
The repository already contains Assembly/AssemblyLab BOM capabilities such as:
- `core/assemblies/assembly-bom.js`;
- component `articleNo`, `manufacturer`, `qty`, `unit` and BOM participation;
- `assembly.instance.bom`;
- Workarea structure-tree BOM/material presentation and editing.

These capabilities belong to the assembly/component authority. BP-007 must not repurpose `assembly.instance.bom`, copy assembly BOM rows onto cable-tray routes, or create a competing persistent tray BOM.

## BP-007 minimal material contract
BP-007 is a derived material-requirement view for **new** cable-tray routes.

Standard tray stick length for this block:

`stickLengthM = 3`

For each supported width group:

`requiredStickCount = ceil(newRouteLengthM / stickLengthM)`

`purchaseLengthM = requiredStickCount * stickLengthM`

`offcutM = purchaseLengthM - newRouteLengthM`

Supported groups remain exactly:
- new 100 mm;
- new 200 mm.

`routeClass = "existing"` / UI “Bestand/Brücke” remains visible in the existing route evaluation but contributes **zero** to the BP-007 purchasing requirement.

The material requirement is derived at runtime from the current scene. It is recalculated whenever the existing evaluation is requested/rendered.

## Display contract
The existing Measure / cable-tray evaluation remains the user entry point.

BP-007 may extend the existing evaluation with a compact material section showing, for each supported new width:
- planned route length in metres;
- required number of 3 m sticks;
- resulting purchase length in metres;
- resulting offcut in metres.

Example:

`Neu 100 · 7.40 m → 3 × 3 m = 9.00 m · Verschnitt 1.60 m`

No new Planning mode or global material workspace is required by BP-007.

## Persistence contract
BP-007 persists **none** of the following:
- `lengthM`;
- `stickLengthM`;
- `stickCount` / `requiredStickCount`;
- `purchaseLengthM`;
- `offcutM`;
- material totals;
- tray BOM rows.

All values are derived from existing route authority.

## Compatibility requirements
BP-007 must preserve:
- BP-002 route authoring, `points[]`, `tray.widthMm` and `tray.trayType`;
- BP-003 `tray.routeClass` semantics;
- BP-004 route evaluation and all four class/width length totals;
- BP-005 existing-point editing and derived length updates;
- BP-006 `startRef/endRef` binding and geometry independence;
- existing assembly/component BOM behavior unchanged.

## Explicit non-goals
BP-007 does not add:
- covers;
- dividers;
- bends, tees, reducers or other fittings;
- connectors/joiners;
- brackets, supports or C-rails;
- manufacturer/article-number assignment;
- prices or suppliers;
- safety/reserve percentage;
- manual material overrides;
- EPLAN coupling;
- cable assignment or fill calculation;
- automatic 3D tray placement/materialization;
- merging tray material into `assembly.instance.bom`;
- a new persistent BOM/material authority.

Those remain separate future blocks.

## Minimal implementation scope
### Productive code
Expected productive change is limited to:

`ui/panels/WorkareaPanel.base.js`

Minimal responsibilities:
1. derive BP-007 material requirement from the existing BP-004 evaluation/totals;
2. use only `totals.new[100]` and `totals.new[200]` as purchasing-length inputs;
3. apply the fixed 3 m stick calculation;
4. extend the existing Measure/tray evaluation presentation with the derived material rows;
5. optionally expose the same compact derived requirement in the existing tray topbar area only if it remains readable without creating a new panel.

No scene sanitizer, save manager, store root, Planning adapter, asset catalog, Assembly BOM module or schema change is required.

### Test scope
Exactly one focused new contract/regression test is expected:

`tests/bp-007-cable-tray-material-requirement.spec.js`

It must verify at minimum:
- 3 m stick length is fixed for BP-007;
- stick count uses ceiling behavior;
- purchase length equals stick count × 3 m;
- offcut equals purchase length minus planned new-route length;
- 100 mm and 200 mm new routes are evaluated separately;
- existing/bridge length is not counted as purchasing requirement;
- no BP-007 material result is persisted;
- BP-002 through BP-006 authorities remain intact;
- existing Assembly BOM authority is not used or modified.

Existing BP-002 through BP-006 tests remain regression evidence.

## Scope decision
BP-007 can be implemented without a new material/BOM architecture.

The smallest safe implementation is an extension of the existing cable-tray derived evaluation in `WorkareaPanel.base.js` plus one focused BP-007 test.

**Definition / Implementation Scope: PASS**

**0 implementation changes are authorized by this document.**
