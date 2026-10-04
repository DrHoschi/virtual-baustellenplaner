# BP-RF-07 - Workarea Assembly CableLines Route / Length / Diagnostics Modularization

## Status

**FROZEN**

Functional remote head:

`903745000c0240966a4ed7858705c46fd46de395`

Authorized base:

`852e954ecc79d54c846132d6a8336c38a09eb0e1`

Branch:

`refactor/BP-RF-07-workarea-assembly-cable-routing`

## Purpose

BP-RF-07 structurally reduces `ui/panels/WorkareaPanel.base.js` by extracting the remaining Assembly CableLine routing, length and diagnostics domain into a dedicated Workarea module.

No functional CableLine, Cable-Tray, route, length, reserve, cut allowance, EPLAN, BOM, material, persistence or UI feature is added.

## Frozen Functional and Test-Contract Scope

The complete functional and test-contract diff against the authorized base contains exactly eleven files:

- `ui/panels/WorkareaPanel.base.js`
- `ui/workarea/workarea-assembly-cable-routing.v1.js`
- `tests/bp-rf-07-workarea-assembly-cable-routing.spec.js`
- `tests/bp-rf-06-workarea-assembly-cable-lines.spec.js`
- `tests/bp-008-cable-route-assignment.spec.js`
- `tests/bp-009-cable-length-planning.spec.js`
- `tests/bp-010-cable-route-continuity.spec.js`
- `tests/bp-011-cable-source-target-world-space.spec.js`
- `tests/bp-012-cable-required-length-reserve.spec.js`
- `tests/bp-013-cable-cut-length-preparation.spec.js`
- `tests/bp-014-cable-cut-list-preparation.spec.js`

Exactly eight existing methods were moved structurally:

- `_normalizeCableLineRouteRefsV1()`
- `_normalizeCableLineRouteDirectionsV1()`
- `_getAssemblyCablePointWorldPositionV1()`
- `_resolveCableLineEndpointWorldPositionV1()`
- `_getDirectDistanceM2dV1()`
- `_getCableLineRouteAssignmentV1()`
- `_setCableLineRouteRefsV1()`
- `_setCableLineRouteDirectionV1()`

Every extracted definition occurs exactly once in `ui/workarea/workarea-assembly-cable-routing.v1.js`; none remains defined in `ui/panels/WorkareaPanel.base.js` or `ui/workarea/workarea-assembly-cable-lines.v1.js`.

The module is connected through `installWorkareaAssemblyCableRoutingModule`. Its import and installer call each occur exactly once. The installer is invoked immediately after `installWorkareaAssemblyCableLinesModule(WorkareaPanel)`, preserving the Assembly component, CablePoint and CableLine dependency order established through BP-RF-04, BP-RF-05 and BP-RF-06.

The installer copies the module prototype descriptors to `WorkareaPanel.prototype` through `Object.getOwnPropertyDescriptors` and `Object.defineProperties`.

## Test-Contract Adaptation

The following existing tests previously read routing, length, reserve, cut allowance or diagnostics logic from the former `WorkareaPanel.base.js` file boundary and were minimally redirected to the dedicated routing module where appropriate:

- `tests/bp-008-cable-route-assignment.spec.js`
- `tests/bp-009-cable-length-planning.spec.js`
- `tests/bp-010-cable-route-continuity.spec.js`
- `tests/bp-011-cable-source-target-world-space.spec.js`
- `tests/bp-012-cable-required-length-reserve.spec.js`
- `tests/bp-013-cable-cut-length-preparation.spec.js`
- `tests/bp-014-cable-cut-list-preparation.spec.js`
- `tests/bp-rf-06-workarea-assembly-cable-lines.spec.js`

Their business assertions remain semantically unchanged. UI rendering and CableLine preparation output assertions continue to read `ui/panels/WorkareaPanel.base.js`. CableLine candidate and persistence-field assertions continue to read `ui/workarea/workarea-assembly-cable-lines.v1.js`.

No BP-015 source-contract adaptation was required.

## Preserved Authority and Persistence Boundaries

BP-RF-07 introduces no new store, service, schema or parallel data model.

The existing authorities and responsibilities remain unchanged:

- `assembly.instance.cableLines` remains the existing CableLine authority;
- `cable-tray.route` remains the existing Cable-Tray route authority;
- `routeRefs` and `routeDirections` retain their existing persisted CableLine responsibilities;
- `lengthM`, `sourceReserveM`, `targetReserveM` and `cutAllowanceM` retain their existing persisted CableLine responsibilities;
- `plannedRequiredLengthM`, `plannedCutLengthM`, `sourceDirectDistanceM` and `targetDirectDistanceM` remain derived runtime values only;
- CableLine route assignment and route direction mutation continue to persist through `_assemblyPropsPersistScene`;
- CablePoint endpoint world-coordinate resolution remains component-origin based;
- route minimum-path and transition diagnostics remain runtime-derived;
- source and target reserve calculations remain explicit user authorities;
- cut allowance and cut length preparation remain explicit user-authority plus runtime-derived output;
- CableLine preparation and CSV output remain in `ui/panels/WorkareaPanel.base.js`;
- Assembly Properties rendering remains in `ui/panels/WorkareaPanel.base.js`;
- scene rebuild and Assembly variant callers remain unchanged;
- store mirroring and project persistence remain unchanged;
- all existing scene and project schemas remain unchanged;
- EPLAN, BOM and Cable-Tray product authorities remain in their existing code paths and modules.

`plannedRequiredLengthM` continues to be derived exclusively from the known Cable-Tray minimum path plus the explicit source and target reserves. `sourceDirectDistanceM` and `targetDirectDistanceM` remain diagnostic values and are not formula inputs.

`plannedCutLengthM` continues to be derived exclusively from `plannedRequiredLengthM` plus the explicit cut allowance. No automatic rounding, percentage allowance or diagnostic distance was added.

## Byte-Identity and Remote Publication Evidence

The original local functional commit is:

`d9729c5a0a9ad30d314af179ebe041f29df24560`

Because direct local Git transport had no push credentials, the already verified contents were republished through the connected GitHub Git-data interface as:

`903745000c0240966a4ed7858705c46fd46de395`

The local and remote commits point to the identical Git tree:

`8d3897864037c1d5a9c4a6bda67ca15cdbf813bd`

Publication therefore changed commit metadata only, not repository content.

## Verification Evidence

Gate 2 result: **PASS**

Exact verified functional remote head:

`903745000c0240966a4ed7858705c46fd46de395`

Structural and designated local evidence:

- JavaScript syntax check for affected files: **PASS**;
- BP-RF-07 focused structural contract: **PASS**;
- BP-009 Cable length planning contract: **PASS**;
- BP-010 Cable route continuity contract: **PASS**;
- BP-011 Source/target world-space contract: **PASS**;
- BP-012 Required length/reserve contract: **PASS**;
- BP-013 Cut length preparation contract: **PASS**;
- repository syntax check: **PASS**, 219 JavaScript files;
- repository import-graph check: **PASS**, 160 relative imports.

## Exact-Head Product CI

- workflow: **Product CI**;
- run: **37217113107**;
- run number: **1544**;
- head SHA: `903745000c0240966a4ed7858705c46fd46de395`;
- event: `push`;
- job `checks`: **SUCCESS**;
- JavaScript syntax step: **SUCCESS**;
- import-graph step: **SUCCESS**;
- BP-029 Global Material Catalog Validation: **SUCCESS**;
- Navigation Foundation Check: **SUCCESS**;
- Manifest Integrity Check: **SUCCESS**;
- BP-017, BP-018, BP-019, BP-024 and BP-025 regression steps: **SUCCESS**;
- UI-MIG, UI Wiring and Smoke Test steps: **SUCCESS**;
- all workflow jobs and steps completed successfully.

## Lineage and Scope Evidence

The functional remote head is one commit ahead and zero commits behind the authorized base. Its linear parent chain is:

`852e954ecc79d54c846132d6a8336c38a09eb0e1` -> `903745000c0240966a4ed7858705c46fd46de395`

The functional commit has exactly one parent and is not a merge commit. Its complete diff contains exactly the eleven authorized product/test files and no foreign change.

At the start of this Completion / Evidence / Freeze step, the BP-RF-07 branch remote head remained exactly:

`903745000c0240966a4ed7858705c46fd46de395`

## Explicit Non-Scope Preserved

BP-RF-07 contains no:

- functional product change;
- new CableLine, routing, length, reserve, EPLAN, BOM or material function;
- change to CableLine persisted authorities;
- change to Cable-Tray route authority;
- Assembly Properties renderer extraction or redesign;
- CableLine preparation or CSV output extraction;
- persistence or schema change;
- store- or data-authority change;
- CI/workflow or configuration change;
- documentation change outside this freeze record;
- BP-031 functionality;
- `tray.dutyClass`;
- unrelated cleanup or modernization.

## Freeze Decision

BP-RF-07 Workarea Assembly CableLines Route / Length / Diagnostics Modularization is **FROZEN** at functional remote head:

`903745000c0240966a4ed7858705c46fd46de395`

This document adds completion, evidence and freeze documentation only. It does not alter the verified product or test state.
