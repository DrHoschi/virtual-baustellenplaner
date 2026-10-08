# BP-RF-06 – Workarea Assembly CableLines Core Modularization

## Status

**FROZEN**

Functional remote head:

`d2242e785179e09b60adb7eddb1341d4f8d44c2b`

Authorized base:

`f27ad3285bd007660eb126cbcd9f0a76f2be4a61`

Branch:

`refactor/BP-RF-06-workarea-assembly-cable-lines`

## Purpose

BP-RF-06 structurally reduces `ui/panels/WorkareaPanel.base.js` by extracting the existing Assembly CableLine core helper domain into a dedicated Workarea module. The extraction preserves product behavior and all existing CableLine, routing, world-coordinate, length, scene, store, persistence, schema, EPLAN, BOM and Cable-Tray authorities.

No functional CableLine, routing, length, reserve, EPLAN, BOM or material feature is added.

## Frozen Functional and Test-Contract Scope

The complete functional and test-contract diff against the authorized base contains exactly ten files:

- `ui/panels/WorkareaPanel.base.js`
- `ui/workarea/workarea-assembly-cable-lines.v1.js`
- `tests/bp-rf-06-workarea-assembly-cable-lines.spec.js`
- `tests/bp-008-cable-route-assignment.spec.js`
- `tests/bp-009-cable-length-planning.spec.js`
- `tests/bp-010-cable-route-continuity.spec.js`
- `tests/bp-011-cable-source-target-world-space.spec.js`
- `tests/bp-012-cable-required-length-reserve.spec.js`
- `tests/bp-013-cable-cut-length-preparation.spec.js`
- `tests/bp-rf-05-workarea-assembly-cable-points.spec.js`

Exactly ten existing methods were moved structurally and byte-identically:

- `_getAssemblyCableLineTypesV1()`
- `_getAssemblyCableLineTypeLabelV1()`
- `_getAssemblyCableLineTypeHintV1()`
- `_labelAssemblyCablePointV1()`
- `_makeAssemblyCableLineIdV1()`
- `_makeAssemblyCableLineCandidateV1()`
- `_deriveAssemblyCableListV1()`
- `_formatAssemblyCableListSummaryV1()`
- `_getAssemblyCableLineStatusOptionsV1()`
- `_getAssemblyCableLineStatusLabelV1()`

The complete byte-identical method block contains 13,041 bytes. Every extracted definition occurs exactly once in `ui/workarea/workarea-assembly-cable-lines.v1.js`; none remains defined in `ui/panels/WorkareaPanel.base.js`.

The module is connected through `installWorkareaAssemblyCableLinesModule`. Its import and installer call each occur exactly once. The installer is invoked immediately after `installWorkareaAssemblyCablePointsModule(WorkareaPanel)`, preserving the existing Assembly component/port and CablePoint dependency order.

The installer copies the module prototype descriptors to `WorkareaPanel.prototype` through `Object.getOwnPropertyDescriptors` and `Object.defineProperties`.

## Test-Contract Adaptation

The following seven existing tests previously read Candidate, derivation, type, status or identity logic from the former `WorkareaPanel.base.js` file boundary:

- `tests/bp-008-cable-route-assignment.spec.js`
- `tests/bp-009-cable-length-planning.spec.js`
- `tests/bp-010-cable-route-continuity.spec.js`
- `tests/bp-011-cable-source-target-world-space.spec.js`
- `tests/bp-012-cable-required-length-reserve.spec.js`
- `tests/bp-013-cable-cut-length-preparation.spec.js`
- `tests/bp-rf-05-workarea-assembly-cable-points.spec.js`

Their source contracts were minimally redirected only for logic moved into the dedicated CableLine module. Existing routing, formula, world-coordinate, UI and persistence assertions continue to read their actual unchanged source file. All existing positive and negative business assertions remain semantically unchanged.

No BP-006, BP-007, BP-014 or BP-015 test contract required adaptation.

## Preserved Authority and Persistence Boundaries

BP-RF-06 introduces no new store, service, schema or parallel data model.

The existing authorities and responsibilities remain unchanged:

- `assembly.instance.cableLines` remains the existing CableLine authority;
- `cable-tray.route` remains the existing Cable-Tray route authority;
- `lengthM`, `routeRefs`, `routeDirections`, `sourceReserveM`, `targetReserveM` and `cutAllowanceM` retain their existing persisted responsibilities;
- `plannedRequiredLengthM`, `plannedCutLengthM`, `sourceDirectDistanceM` and `targetDirectDistanceM` remain derived runtime values only;
- CableLine normalization, route assignment, route direction and mutation remain in their existing base methods;
- CablePoint and endpoint world-coordinate resolution remain unchanged;
- route minimum-path and direction diagnostics remain unchanged;
- source and target reserve calculations remain unchanged;
- cut-allowance and cut-length preparation remain unchanged;
- CableLine preparation and CSV output remain unchanged;
- Assembly Properties rendering remains unchanged;
- scene rebuild and Assembly variant callers remain unchanged;
- store mirroring and project persistence remain unchanged;
- all existing scene and project schemas remain unchanged;
- EPLAN, BOM and Cable-Tray product authorities remain in their existing code paths and modules.

`plannedRequiredLengthM` continues to be derived exclusively from the known Cable-Tray minimum path plus the explicit source and target reserves. `sourceDirectDistanceM` and `targetDirectDistanceM` remain diagnostic values and are not formula inputs.

`plannedCutLengthM` continues to be derived exclusively from `plannedRequiredLengthM` plus the explicit cut allowance. No automatic rounding, percentage allowance or diagnostic distance was added.

## Byte-Identity and Remote Publication Evidence

The original local functional commit is:

`0ba0e64c64493a5c8f7c26bec20b27417fb2c83b`

Because direct local Git transport had no push credentials, the already verified contents were republished through the connected GitHub Git-data interface as:

`d2242e785179e09b60adb7eddb1341d4f8d44c2b`

The local and remote commits point to the identical Git tree:

`6e77699410f034a8b3978ff10da292124c33ff8d`

Publication therefore changed commit metadata only, not repository content.

## Verification Evidence

Gate 2 result: **PASS**

Exact verified functional remote head:

`d2242e785179e09b60adb7eddb1341d4f8d44c2b`

Structural and designated regression evidence:

- JavaScript syntax check: **PASS**, 217 JavaScript files;
- import-graph check: **PASS**, 159 relative imports;
- BP-RF-06 focused structural contract: **3/3 PASS**;
- seven adapted source contracts including BP-RF-05: **12/12 PASS**;
- BP-006 through BP-015 regression matrix: **19/19 PASS**;
- BP-RF-03 through BP-RF-06 structural regressions: **12/12 PASS**;
- Assembly Template/BOM smoke regression: **1/1 PASS**;
- UI-MIG-05C insert-source regression: **4/4 PASS**;
- complete designated focused/regression matrix: **36/36 PASS**.

The browser-dependent matrix was executed with Playwright 1.50.1 and Node 20, matching the Product CI Node major version. The temporary execution environment did not modify repository content.

## Exact-Head Product CI

- workflow: **Product CI**;
- run: **37211257801**;
- run number: **1540**;
- head SHA: `d2242e785179e09b60adb7eddb1341d4f8d44c2b`;
- event: `push`;
- job `checks`: **SUCCESS**;
- JavaScript syntax step: **SUCCESS**;
- import-graph step: **SUCCESS**;
- all workflow jobs and steps completed successfully.

## Lineage and Scope Evidence

The functional remote head is one commit ahead and zero commits behind the authorized base. Its linear parent chain is:

`f27ad3285bd007660eb126cbcd9f0a76f2be4a61` → `d2242e785179e09b60adb7eddb1341d4f8d44c2b`

The functional commit has exactly one parent and is not a merge commit. Its complete diff contains exactly the ten authorized product/test files and no foreign change.

At the start of Gate 3, Remote `main` remained exactly on the authorized base:

`f27ad3285bd007660eb126cbcd9f0a76f2be4a61`

## Explicit Non-Scope Preserved

BP-RF-06 contains no:

- functional product change;
- new CableLine, routing, length, reserve, EPLAN, BOM or material function;
- routing, world-coordinate or length-diagnostics extraction;
- change to CableLine persisted authorities;
- Assembly Properties renderer change;
- persistence or schema change;
- store- or data-authority change;
- CI/workflow or configuration change;
- documentation change outside this freeze record;
- BP-031 functionality;
- `tray.dutyClass`;
- unrelated cleanup or modernization.

## Freeze Decision

BP-RF-06 Workarea Assembly CableLines Core Modularization is **FROZEN** at functional remote head:

`d2242e785179e09b60adb7eddb1341d4f8d44c2b`

This document adds completion, evidence and freeze documentation only. It does not alter the verified product or test state.
