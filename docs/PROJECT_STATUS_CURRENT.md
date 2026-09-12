# PROJECT STATUS CURRENT

Status authority for the Baustellenplaner repository.

## NEW CHAT RULE

Before any development decision, branch action, code change, cleanup, merge, freeze, deployment change, or roadmap continuation, read this file first and verify its referenced branch/SHA against GitHub.

Do not infer the current product state from an older chat summary, an older feature branch, or an older deployment.

## Current authority

- Reconciliation block: `MAIN-REC-01 – Authoritative Product Main Reconciliation`
- MAIN-REC-01A: `PASS / READ-ONLY COMPLETE`
- MAIN-REC-01B preservation integration baseline: `6bd7de6b1e4fb14b91a00a04bba64ce0910b27ac`
- MAIN-REC-01C: `PASS / MAIN REALIGNED`
- Authoritative product branch: `main`
- Authoritative main baseline for BP-001 branch creation: `99d69aceb87ad0e736ba506686dbe30ac4e52766`
- Active BP-001 development branch: `feature/BP-001-authoritative-hall-context-in-planning`
- Authority rule: `main` remains the authoritative product baseline until BP-001 is completed, gated and explicitly integrated. The BP-001 branch is the only authorized development line for this block.

The former continuation branch `feature/project-ui-03c-library-ownership-separation-recovery` is historical after MAIN-REC-01. It must not be used as a new development base.

## Frozen / completed product and tooling blocks

### PROJECT-UI-03C – Library Ownership Separation & Surface Consolidation

Status: `FROZEN / COMPLETION PASS / REGRESSION PASS / DEVICE PASS / 0 BLOCKER`

- Functional SHA: `b68096e83524fc87d73492d49dc113c670a31d2b`
- Freeze documentation SHA: `b192246a6e0444e865eaeeca6ef1fcc59a4f6432`
- Exactly one authoritative Global Library Catalog.
- Project → Bibliotheken contains only project-owned library references/selections.
- Project Assets, Planning/Workarea, Hall3D, AssetLab and open-project state are preserved.

### TEST-DEPLOY-01 – Deterministic Device Deployment

Status: `FROZEN / COMPLETION PASS / INTEGRATION PASS / CONTROLLED DEPLOYMENT 1 PASS / CONTROLLED DEPLOYMENT 2 PASS / TRIPLE MATCH PASS / 0 BLOCKER`

The deterministic Pages workflow is integrated into the product line and supports exact-SHA deployment with visible `BLOCK-ID · TESTBUILD n · shortSHA` identity.

### NAV-BACK-01 – Contextual Back Visibility & Validity

Status: `FROZEN / COMPLETION PASS / REGRESSION PASS / DEVICE PASS / CONTEXTUAL RETURN PASS / VISIBILITY PASS / 0 BLOCKER`

The Global Shell owns contextual return. Stale/non-functional Back visibility is not allowed.

## Preserved Hall / Planning contract

Hall3D remains an existing product capability owned by Planning → Hall Context.

Hard preservation rules:

- Do not delete Hall3D, its data or assets.
- Do not classify Hall3D as legacy merely because navigation changes.
- `app.project.hall` remains the single authoritative hall state.
- Existing hall creation, hall editing, live rebuild and persistence must not regress.
- Planning/Workarea remains an existing capability and must not be replaced by a second competing implementation.

## MAIN-REC-01 preservation result

The former `main`-only history was reconciled before realignment.

- Future hall-installation / Digital Twin concept from `e2c09ae1...`: `PRESERVE` and integrated.
- Deterministic TEST-DEPLOY workflow: `ALREADY PRESENT` in the product line.
- Historical PROJECT-UI-02A / 02B exact-head CI runners: `SUPERSEDED / DROP` and not carried forward as active product requirements.

Preserved concept document:

- `docs/FUTURE_HALL_INSTALLATION_DIGITAL_TWIN_IDEAS.md`

## Capability recovery / cleanup state

- `CAP-REC-01A = PASS / READ-ONLY COMPLETE / 0 confirmed missing historical capability blocks`
- `CAP-REC-01B = PASS / READ-ONLY cleanup classification complete`
- `AUTH-REPAIR-01 = PASS`
- `CLEANUP-01A = PARTIAL / STOPPED BY USER`

Remaining old `ui-mig`, `tech-*`, `project-ui-*`, `test-r1*` and similar branches are historical. They may remain for now, but must not be used as future development bases.

No branch deletion, PR closure or additional cleanup is implicitly authorized by this document.

## New development line

All new controlled Baustellenplaner feature branches use the forward-only numbering pattern:

`feature/BP-001-...` → `feature/BP-002-...` → `feature/BP-003-...`

`BP` means Baustellenplaner. Old naming families remain historical.

## BP-001 – Authoritative Hall Context in Planning

Status: `DEFINED / BRANCH CREATED / IMPLEMENTATION WRITTEN / COMPLETION GATE BLOCKED / AUTHORITY CORRECTION AUTHORIZED / CI TEST CONTRACT SCOPE AUTHORIZED / TECHNICAL WRITE-UNBLOCK SCOPE AUTHORIZED / NOT FROZEN`

Branch:

`feature/BP-001-authoritative-hall-context-in-planning`

Branch base:

`main@99d69aceb87ad0e736ba506686dbe30ac4e52766`

First implementation SHA:

`95c0c60e67686fdd854406222e4103644b013ef1`

### BP-001A – Hall Planning Workflow Gap Definition

Status: `PASS / READ-ONLY COMPLETE`

Verified workflow:

`Projekt öffnen/neu → Halle definieren/ändern → Planung öffnen → zurück ohne Zustandsverlust`

Current classification:

- Project creation/opening: `COMPLETE`
- Hall initial creation: `COMPLETE`
- Hall editing/live rebuild/persistence: `COMPLETE`
- Project → Hall3D entry: `COMPLETE`
- Project → Planning entry: `COMPLETE`
- Project state preservation across Hall3D / Planning / Project: `COMPLETE`
- Authoritative hall context inside Planning/Workarea: `GAP / FIRST IMPLEMENTATION REQUIRES AUTHORITY CORRECTION`

### BP-001 Implementation Scope Reconciliation

Status: `PASS / READ-ONLY COMPLETE / SCOPE LOCKED / IMPLEMENTATION AUTHORIZED`

Authority path:

`app.project.hall → WorkareaPanel → read-only Planning Hall Context → PlanningWorkspaceAdapter/UI`

Forbidden competing path:

`app.project.hall → copied hall state under workspace / scene / hall3d / independent Planning state`

`app.project.hall` remains the only hall authority. The existing Workarea scene remains separately authoritative for placed planning objects under `app.project.workspace.scene.objects`.

#### Authorized product-file scope

1. `ui/panels/WorkareaPanel.js`
   - may read `app.project.hall`;
   - may derive a small non-persisted Planning Hall Context;
   - may expose hall identity and existing planning-relevant hall parameters to Planning;
   - must not write, mirror or duplicate hall authority.

2. `ui/shell/PlanningWorkspaceAdapter.js`
   - may project the Workarea-provided Hall Context into the existing Planning surface;
   - remains a UI/ownership adapter;
   - must not become a hall-domain authority or own a second hall state.

#### Original authorized test scope

A BP-001 regression test may be added as:

`tests/bp-001-authoritative-hall-context-in-planning.spec.js`

It must verify at minimum:

- project with hall → Planning exposes the matching Hall Context;
- Hall Context values come from `app.project.hall`;
- Hall3D commit/change → subsequent Planning context reflects the committed hall values;
- no second hall copy is created under Workarea/scene/independent Planning state;
- project state remains open/preserved across Project ↔ Hall3D ↔ Planning;
- existing Workarea scene data remains unchanged by Hall Context projection.

#### Explicit DO NOT TOUCH for the implementation block

- `ui/shell/AppShell.js`
- `ui/css/ui-planning-ownership.css`
- `core/hall/*`
- `modules/hall3d/*`
- project wizard / project creation flow
- project persistor / storage format
- panel registry / module registry
- Project Assets / AssetLab / Library code
- NAV-BACK behavior

Any need to touch these files or boundaries is a new scope finding and requires a separate reconciliation before modification.

#### Explicit out of scope

- profiles / beams / standardized profile libraries
- cable or route planning
- mounting-plane expansion
- Digital Twin
- camera / thermal camera / alarm integration
- PLC / TIA simulation
- new asset capabilities
- Hall3D redesign
- general UI redesign

#### Mandatory regressions

- project creation/opening unchanged;
- hall creation unchanged;
- hall edit/live rebuild/persistence unchanged;
- Hall3D preserved and reachable;
- Workarea Pan/Zoom/Selection/Drag/Place/Persistence preserved;
- Project Assets / AssetLab / Library separation preserved;
- contextual navigation/back behavior preserved;
- responsive Planning behavior on iPhone and iPad preserved.

### BP-001 First Implementation

Status: `WRITTEN / SHA 95c0c60e67686fdd854406222e4103644b013ef1 / COMPLETION GATE BLOCKED / NOT FROZEN`

The first implementation changed only `ui/shell/PlanningWorkspaceAdapter.js`. Completion-gate reconciliation found that this implementation reads the app/store authority from the Planning adapter itself and therefore does not follow the locked ownership path through WorkareaPanel.

This first implementation must be corrected; it is not the final BP-001 implementation authority.

### BP-001 – Authority Path & CI Failure Reconciliation

Status: `PASS / READ-ONLY COMPLETE / 0 CORRECTION CHANGES`

Authority finding:

- `WorkareaPanel` already owns the legitimate `store` boundary and may read `this.store.get("app")`.
- The corrected read boundary is `WorkareaPanel.getPlanningHallContext()`.
- `getPlanningHallContext()` may read only `app.project.hall` and return a small non-persisted read-only projection.
- The projection may contain only existing planning-relevant hall information such as hall identity, length, width, eave height, roof type and `authority: "app.project.hall"`.
- It must not call `store.update()`, persist a Planning hall object, or create any hall copy under workspace/scene/Planning state.
- `PlanningWorkspaceAdapter` must consume only the Workarea-provided `getPlanningHallContext()` boundary and must not independently read the app/store hall authority.

Corrected authority path:

`app.project.hall → WorkareaPanel.getPlanningHallContext() → PlanningWorkspaceAdapter → visible Planning Hall Context`

CI finding:

- Applicable CI for first implementation SHA `95c0c60e...` failed at `tests/bp-hi01b3r-product-reachability.spec.mjs`.
- The failing test still requires a historical static `const BUILD_ID = "..."` contract.
- TEST-DEPLOY-01 has already replaced that contract with dynamic `build-info.json` identity, validated full SHA/short SHA and visible `BLOCK-ID · TESTBUILD n · shortSHA`.
- The stale expectation already exists on the direct parent `be9be382...`; therefore it is a pre-existing CI test-contract conflict and is not caused by the BP-001 product delta.
- `ui/shell/GlobalCommandBar.js` must not be reverted to the historical static build-ID mechanism.

Classification:

`BP-HI01B.3R CI FAILURE = PRE-EXISTING STALE TEST CONTRACT / TEST-DEPLOY-01 INCOMPATIBILITY / NOT CAUSED BY BP-001 PRODUCT CHANGE`

### BP-001 – Authority Path Correction + CI Test Contract Scope Authorization

Status: `AUTHORIZED / EXACT CORRECTION SCOPE / EXACT TEST SCOPE EXTENSION / NO ADDITIONAL CAPABILITY`

The correction is explicitly authorized on `feature/BP-001-authoritative-hall-context-in-planning` against the reconciliation above.

For the next correction implementation step, changes are authorized in the files listed below, subject to the Technical Write-Unblock Scope Extension that follows:

1. `ui/panels/WorkareaPanel.js`
   - add/provide the read-only `getPlanningHallContext()` boundary;
   - source values exclusively from `app.project.hall` through the existing Workarea store;
   - no hall writes, persistence changes or duplicate state.

2. `ui/shell/PlanningWorkspaceAdapter.js`
   - remove the adapter-owned direct app/store hall read introduced by the first implementation;
   - consume only the Workarea-provided Planning Hall Context;
   - retain UI-projection responsibility only.

3. `tests/bp-hi01b3r-product-reachability.spec.mjs`
   - this is the sole CI-test-contract scope extension;
   - update only the obsolete static build-ID assertions to the already frozen TEST-DEPLOY-01 dynamic build-identity contract;
   - preserve the Hall3D manifest, registration, navigation, hidden bridge and product-reachability assertions;
   - do not change product code merely to satisfy the historical static build-ID expectation.

The original optional BP-001 test authorization does not expand the next correction step.

### BP-001 – Technical Write-Unblock Scope Extension

Status: `AUTHORIZED / MINIMAL TECHNICAL SCOPE EXTENSION / EXACTLY ONE ADDITIONAL FILE / NO ADDITIONAL CAPABILITY`

A connector/write-size limitation prevents safely replacing the current monolithic `ui/panels/WorkareaPanel.js` as a single transported text payload. To unblock the already authorized BP-001 correction without functionally refactoring Workarea, exactly one additional file is authorized:

4. `ui/panels/WorkareaPanel.base.js`
   - may contain the byte-identical pre-correction WorkareaPanel implementation already present at the verified BP-001 branch state;
   - exists only as a technical extraction target so `ui/panels/WorkareaPanel.js` can become a small wrapper/subclass that adds the authorized read-only `getPlanningHallContext()` boundary;
   - must not introduce behavior changes, new Workarea capability, independent Hall state, persistence changes or general modularization beyond this transport/write unblock;
   - the extracted base implementation must remain behaviorally identical to the pre-correction WorkareaPanel code.

The resulting correction implementation is therefore locked to exactly these four files:

- `ui/panels/WorkareaPanel.js`
- `ui/panels/WorkareaPanel.base.js`
- `ui/shell/PlanningWorkspaceAdapter.js`
- `tests/bp-hi01b3r-product-reachability.spec.mjs`

No fifth file, workflow, documentation file, product surface or capability is authorized for the correction implementation itself. If any additional file proves necessary, stop and reconcile again before modification.

This extension does not authorize the optional `tests/bp-001-authoritative-hall-context-in-planning.spec.js` during the correction implementation step.

## Development safety rules

1. Read this file first and verify the active BP-001 branch HEAD before any BP-001 development action.
2. `main` remains the authoritative product baseline until BP-001 is completed and explicitly integrated.
3. BP-001 correction may occur only on `feature/BP-001-authoritative-hall-context-in-planning`.
4. No branch movement, merge, deletion, cleanup or unrelated code modification is authorized by BP-001.
5. The next correction implementation is limited to exactly the four files listed in `BP-001 – Technical Write-Unblock Scope Extension`.
6. Freeze only after completion, regression, device and applicable CI gates pass.
7. Preserve all existing capabilities unless the locked BP-001 scope explicitly permits a change.
8. Device validation must include iPhone and iPad for Planning behavior.

## Exact next permitted step

The next permitted step is exclusively the BP-001 Authority Path Correction + CI Test Contract Correction implementation against the authorization above.

That implementation is limited to exactly:

- `ui/panels/WorkareaPanel.js`
- `ui/panels/WorkareaPanel.base.js`
- `ui/shell/PlanningWorkspaceAdapter.js`
- `tests/bp-hi01b3r-product-reachability.spec.mjs`

No additional file, capability or scope expansion is authorized. After that correction is written, BP-001 must return to the separate completion / regression / device / applicable CI gate before any freeze or integration decision.
