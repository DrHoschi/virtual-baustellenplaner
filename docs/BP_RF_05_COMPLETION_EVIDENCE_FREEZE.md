# BP-RF-05 – Workarea Assembly CablePoints Modularization

## Status

**FROZEN**

Functional remote head:

`388fd9b4e7acf034739b8b4a837e33acab7897af`

Authorized base:

`472709ef3000f47e77c9a74a3b2d999826efdf6f`

Branch:

`refactor/BP-RF-05-workarea-assembly-cable-points`

## Purpose

BP-RF-05 structurally reduces `ui/panels/WorkareaPanel.base.js` by extracting the existing Assembly CablePoint helper domain into a dedicated Workarea module. The extraction preserves product behavior and all existing AssemblyLab, scene, CableLine, world-coordinate, store, persistence, schema, EPLAN and BOM authorities.

No functional CablePoint, cable, routing, EPLAN, BOM or material feature is added.

## Frozen Functional Scope

The original functional implementation changes exactly three files against the authorized base:

- `ui/panels/WorkareaPanel.base.js`
- `ui/workarea/workarea-assembly-cable-points.v1.js`
- `tests/bp-rf-05-workarea-assembly-cable-points.spec.js`

Exactly seven existing methods were moved structurally and byte-identically:

- `_getAssemblyCablePointTypesV1()`
- `_getAssemblyCablePointTypeLabelV1()`
- `_inferAssemblyCablePointTypeFromPortV1()`
- `_makeAssemblyCablePointIdV1()`
- `_makeAssemblyCablePointFromPortV1()`
- `_deriveAssemblyCablePointsV1()`
- `_formatAssemblyCablePointSummaryV1()`

The module is connected through `installWorkareaAssemblyCablePointsModule`. Its base import and installer call each occur exactly once. The installer is invoked after `installWorkareaAssemblyComponentsPortsModule(WorkareaPanel)`, preserving the existing component/port dependency order.

The installer copies the module prototype descriptors to `WorkareaPanel.prototype` through `Object.getOwnPropertyDescriptors` and `Object.defineProperties`.

## Verification Blocker and Test-Contract Fix

The first Gate 2 verification found two pre-existing, structurally outdated test boundaries in:

- `tests/bp-012-cable-required-length-reserve.spec.js`
- `tests/bp-013-cable-cut-length-preparation.spec.js`

Both tests still used `_makeAssemblyCableLineIdV1` as the end marker for `_getCableLineRouteAssignmentV1`, although the actual following method boundary at the authorized parent was already `_setCableLineRouteRefsV1`. Their broad negative regex windows therefore reached the later BP-011 diagnostic values and misinterpreted those diagnostics as formula inputs.

The authorized test-only fix changes the end marker in both files and restricts each existing negative assertion to its actual formula block:

- BP-012: `plannedRequiredLengthM` through immediately before `plannedCutLengthM`;
- BP-013: `plannedCutLengthM` through immediately before `sourceWorld`.

The existing positive formula assertions remain unchanged. No product calculation was changed.

The complete functional and test-contract scope therefore contains exactly five product/test files: the original three implementation files plus BP-012 and BP-013. No other product or test file is part of BP-RF-05.

## Byte-Identity and Remote Publication Evidence

The seven extracted method definitions remain byte-identical to their definitions at the authorized base. Every extracted definition occurs exactly once in the dedicated module and no extracted definition remains in `WorkareaPanel.base.js`.

The original local commits were:

- implementation: `1dc39743c083bfe723c89c2e9e9c3a62d4162151`;
- test-contract fix and complete local head: `aeb2d04c65704dbd1f593035ee5bc76254b51d8e`.

Because direct local Git transport had no push credentials, the already verified contents were republished through the connected GitHub Git-data interface as the same two-commit content sequence:

- remote implementation: `6be6d31465e35e7aac5c1ba25b50f32d505e9e12`;
- remote test-contract fix and functional head: `388fd9b4e7acf034739b8b4a837e33acab7897af`.

The corresponding local and remote Git trees are identical:

- local `1dc39743c083bfe723c89c2e9e9c3a62d4162151` and remote `6be6d31465e35e7aac5c1ba25b50f32d505e9e12`: `c3c298774e7ca35edfabc887b649b54400b583fe`;
- local `aeb2d04c65704dbd1f593035ee5bc76254b51d8e` and remote `388fd9b4e7acf034739b8b4a837e33acab7897af`: `7528bd6158a3d77f843a3f0e7e5fe92a2e307000`.

Publication therefore changed commit metadata only, not repository content.

## Authority and Persistence Boundaries

BP-RF-05 introduces no new data authority, store, service or parallel model.

The existing authorities and boundaries remain unchanged:

- AssemblyLab catalog, variants and insert behavior remain in their existing code paths;
- Assembly instances remain authoritative in the existing scene structures;
- component roles and ports remain provided by the previously extracted Assembly components/ports module;
- CablePoints retain their existing types, ID formation, normalization, derivation and summary behavior;
- CableLines remain owned and calculated by their existing Workarea methods;
- CablePoint world-coordinate resolution remains in `WorkareaPanel.base.js`;
- store mirroring, scene rebuild and project persistence remain unchanged;
- all existing scene and project schemas remain unchanged;
- EPLAN and BOM authorities remain in their existing structures and modules;
- cable-tray routing remains independently authoritative as `cable-tray.route`.

`plannedRequiredLengthM` continues to be formed exclusively from the known minimum tray path plus explicit source and target reserves. `sourceDirectDistanceM` and `targetDirectDistanceM` remain diagnostic values only.

`plannedCutLengthM` continues to be formed exclusively from `plannedRequiredLengthM` plus explicit cut allowance. No automatic rounding, percentage allowance or diagnostic direct distance was added.

## Verification Evidence

Gate 2 result: **PASS**

Exact verified functional remote head:

`388fd9b4e7acf034739b8b4a837e33acab7897af`

Structural and designated regression evidence:

- JavaScript syntax check: **PASS**;
- import-graph check: **PASS**;
- BP-RF-05 focused structural contract: **3/3 PASS**;
- BP-RF-04 structural regression: **3/3 PASS**;
- BP-RF-03 BOM regression: **3/3 PASS**;
- Assembly Template/BOM smoke regression: **1/1 PASS**;
- BP-006 through BP-015 regression matrix: **19/19 PASS**;
- UI-MIG-05C insert-source regression: **4/4 PASS**;
- complete designated focused/regression matrix: **33/33 PASS**.

## Exact-Head Product CI

- workflow: **Product CI**;
- run: **37181992380**;
- run number: **1536**;
- head SHA: `388fd9b4e7acf034739b8b4a837e33acab7897af`;
- event: `push`;
- job `checks`: **SUCCESS**;
- JavaScript syntax step: **SUCCESS**;
- import-graph step: **SUCCESS**;
- all workflow jobs and steps completed successfully.

## Lineage and Scope Evidence

The functional remote head is two commits ahead and zero commits behind the authorized base. Its linear parent chain is:

`472709ef3000f47e77c9a74a3b2d999826efdf6f` → `6be6d31465e35e7aac5c1ba25b50f32d505e9e12` → `388fd9b4e7acf034739b8b4a837e33acab7897af`

Neither functional commit is a merge commit. The complete diff contains exactly the five authorized product/test files and no foreign change.

## Explicit Non-Scope Preserved

BP-RF-05 contains no:

- functional product change;
- new CablePoint, cable, routing, EPLAN, BOM or material function;
- CableLine or world-coordinate implementation change;
- AssemblyLab insert, variant or rebuild change;
- Properties renderer change;
- persistence or schema change;
- store- or data-authority change;
- CI/workflow or configuration change;
- documentation change outside this freeze record;
- BP-031 functionality;
- `tray.dutyClass`;
- unrelated cleanup or modernization.

## Freeze Decision

BP-RF-05 Workarea Assembly CablePoints Modularization is **FROZEN** at functional remote head:

`388fd9b4e7acf034739b8b4a837e33acab7897af`

This document adds completion, evidence and freeze documentation only. It does not alter the verified product or test state.
