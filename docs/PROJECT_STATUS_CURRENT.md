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

Status: `DEFINED / BRANCH CREATED / IMPLEMENTATION SCOPE RECONCILED / NOT IMPLEMENTED`

Branch:

`feature/BP-001-authoritative-hall-context-in-planning`

Branch base:

`main@99d69aceb87ad0e736ba506686dbe30ac4e52766`

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
- Authoritative hall context inside Planning/Workarea: `GAP`

### BP-001 Implementation Scope Reconciliation

Status: `PASS / READ-ONLY COMPLETE / SCOPE LOCKED / 0 CODE CHANGES`

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

#### Authorized test scope

A new regression test may be added as:

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

## Development safety rules

1. Read this file first and verify the active BP-001 branch HEAD before any BP-001 development action.
2. `main` remains the authoritative product baseline until BP-001 is completed and explicitly integrated.
3. BP-001 implementation may occur only on `feature/BP-001-authoritative-hall-context-in-planning`.
4. No branch movement, merge, deletion, cleanup or unrelated code modification is authorized by BP-001.
5. Reconcile/define first; implementation requires explicit separate authorization.
6. Freeze only after completion, regression, device and applicable CI gates pass.
7. Preserve all existing capabilities unless the locked BP-001 scope explicitly permits a change.
8. Device validation must include iPhone and iPad for Planning behavior.

## Exact next permitted step

The next permitted step is exclusively the separate authorization of the BP-001 implementation against the locked scope above.

Once explicitly authorized, implementation is limited to:

- `ui/panels/WorkareaPanel.js`
- `ui/shell/PlanningWorkspaceAdapter.js`
- optional new regression test `tests/bp-001-authoritative-hall-context-in-planning.spec.js`

No additional capability or scope expansion is authorized in the same step.
