# BP-RF-04 – Workarea Assembly Components / Ports Modularization

## Status

**FROZEN**

Functional head:

`c3f2de3790ff85ce587406d2bad77ee8eeaec424`

Authorized base:

`6d83fb2c14155a78a0b42d2c12e0dacebf218672`

Branch:

`refactor/BP-RF-04-workarea-assembly-components-ports`

## Purpose

BP-RF-04 structurally reduces `ui/panels/WorkareaPanel.base.js` by extracting the existing Assembly component-role and port helper domain into a dedicated Workarea module. The extraction preserves product behavior, AssemblyLab and scene authorities, persistence paths, schemas, CablePoint and CableLine derivation, EPLAN and BOM boundaries.

No functional Assembly, cable, EPLAN, BOM or material feature is added.

## Frozen Functional Scope

The functional implementation changes exactly three files against the authorized base:

- `ui/panels/WorkareaPanel.base.js`
- `ui/workarea/workarea-assembly-components-ports.v1.js`
- `tests/bp-rf-04-workarea-assembly-components-ports.spec.js`

Exactly nine existing methods were moved:

- `_getAssemblyComponentRolesV1()`
- `_getAssemblyRoleLabelV1()`
- `_inferAssemblyComponentRoleV1()`
- `_getAssemblyPortTemplatesV1()`
- `_makeAssemblyComponentPortsV1()`
- `_normalizeAssemblyComponentPortsV1()`
- `_normalizeAssemblyComponentsWithPortsV1()`
- `_flattenAssemblyPortsV1()`
- `_formatAssemblyPortSummaryV1()`

The module is connected through `installWorkareaAssemblyComponentsPortsModule`. The base import and installer call each occur exactly once. The installer copies the module prototype descriptors to `WorkareaPanel.prototype` through `Object.getOwnPropertyDescriptors` and `Object.defineProperties`.

## Byte-Identity and Publication Evidence

The complete moved method block is byte-identical to its original definition at the authorized base:

- method-block size: 11,961 bytes;
- all nine definitions occur exactly once in the dedicated module;
- no extracted definition remains in `WorkareaPanel.base.js`.

The original local functional commit was:

`64e0d2633c10c0db361597d85a5b86173d7ffb9d`

Because the local Git transport had no push credentials, the already verified content was republished through the connected GitHub Git-data interface. The resulting authoritative remote functional head is:

`c3f2de3790ff85ce587406d2bad77ee8eeaec424`

Both commits point to the identical Git tree:

`b4d9440dd466dba0c3a693a4b845d3b531f8c476`

The three individual blob identities were also preserved:

- `ui/panels/WorkareaPanel.base.js`: `884dd75d141da918c97660d7d180bfce5deebc0d`
- `ui/workarea/workarea-assembly-components-ports.v1.js`: `83bf0e2c2c538cfb5da1571c9c5dfee8cf25a112`
- `tests/bp-rf-04-workarea-assembly-components-ports.spec.js`: `0215abdb93e72e471f12a6d18ab5a71c3d1b8d81`

Publication therefore changed commit metadata only, not repository content.

## Authority and Persistence Boundaries

BP-RF-04 introduces no new data authority, store, service or parallel model.

The existing authorities remain unchanged:

- AssemblyLab catalog data remains under `app.project.assemblyLab`, mirrored to `project.assemblyLab`;
- Assembly instances remain authoritative in `project.workspace.scene.objects`;
- `assembly.instance.components[]` remains the component source;
- component and instance ports retain their existing schemas and responsibilities;
- CablePoints remain derived through the existing CablePoint methods;
- CableLines remain owned by `assembly.instance.cableLines`;
- cable-tray routing remains independently authoritative as `cable-tray.route`;
- EPLAN fields remain in their existing Assembly, component and CableLine structures;
- BOM computation and project-bound BOM metadata remain in the previously extracted BOM module;
- all existing project-save, store-mirroring and scene-persistence paths remain unchanged.

The extracted module contains no direct AssemblyLab-store write, scene write, project save, EPLAN persistence, CablePoint derivation, CableLine derivation, BOM computation or Cable-Tray mutation.

## Verification Evidence

Gate 2 result: **PASS**

Exact verified functional remote head:

`c3f2de3790ff85ce587406d2bad77ee8eeaec424`

Structural and designated regression evidence:

- JavaScript syntax check: **PASS**, 213 JavaScript files;
- import-graph check: **PASS**, 157 relative imports;
- BP-RF-04 focused structural contract: **3/3 PASS**;
- BP-RF-03 BOM regression: **3/3 PASS**;
- UI-MIG-05C insert-source regression: **4/4 PASS**;
- Assembly Template/BOM smoke regression: **1/1 PASS**;
- designated focused matrix: **11/11 PASS**.

The initial local Playwright blocker was environmental: Playwright 1.50.1 registered its TypeScript/ESM loader under local Node 24 and stalled before test discovery. Running with the supported runtime opt-out `PW_DISABLE_TS_ESM=1`, an allowed loopback port and the Playwright Chromium runtime completed all designated tests without repository changes.

## Exact-Head Product CI

- workflow: **Product CI**;
- run: **37044814771**;
- run number: **1532**;
- head SHA: `c3f2de3790ff85ce587406d2bad77ee8eeaec424`;
- event: `push`;
- conclusion: **SUCCESS**;
- all workflow jobs and steps completed successfully.

## Lineage and Scope Evidence

The functional head is one commit ahead and zero commits behind the authorized base. Its only parent is:

`6d83fb2c14155a78a0b42d2c12e0dacebf218672`

There is no merge commit. The complete functional diff contains exactly the three authorized product/test files and no foreign change.

The unrelated local working-copy modification to `modules/assetlab3d/vendor/threejs-editor/examples/models/gltf/IridescenceLamp.glb` was present outside the BP-RF-04 diff and was never included, changed, published or integrated by this work.

## Explicit Non-Scope Preserved

BP-RF-04 contains no:

- functional product change;
- AssemblyLab catalog or editor change;
- scene-binding or insert-lifecycle change;
- CablePoint or CableLine change;
- EPLAN or BOM change;
- persistence or schema change;
- store- or data-authority change;
- CI/workflow or configuration change;
- documentation change outside this freeze record;
- BP-031 functionality;
- `tray.dutyClass`;
- unrelated cleanup or modernization.

## Freeze Decision

BP-RF-04 Workarea Assembly Components / Ports Modularization is **FROZEN** at functional head:

`c3f2de3790ff85ce587406d2bad77ee8eeaec424`

This document adds completion, evidence and freeze documentation only. It does not alter the verified product or test state.
