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
- Authority rule: after this status-document synchronization commit, the current `main` HEAD containing this file is the authoritative product baseline until a later explicitly reconciled status update supersedes it.

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

No `feature/BP-001-*` branch exists merely because this convention is documented.

## BP-001 reconciliation state

### BP-001A – Hall Planning Workflow Gap Definition

Status: `PASS / READ-ONLY COMPLETE / NO IMPLEMENTATION / NO BRANCH`

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

Candidate BP-001 capability identified by reconciliation:

`Authoritative Hall Context in Planning`

Boundary for the candidate block:

- use existing `app.project.hall` as the only hall authority;
- do not create a second Hall3D/workarea hall state;
- do not redesign Hall3D;
- do not introduce profiles, cable planning, Digital Twin, camera/alarm integration or unrelated asset functionality;
- iPhone/iPad responsive behavior and existing Planning/Hall3D behavior remain mandatory regressions.

## Development safety rules

1. Read this file first and verify the current `main` HEAD before any development action.
2. `main` is the authoritative product baseline after MAIN-REC-01.
3. New feature branches must be created only from the verified current `main` baseline unless a later explicit reconciliation changes authority.
4. No branch creation, movement, merge, deletion, cleanup or code modification unless the currently authorized step requires it.
5. Reconcile/define first; implementation only after explicit authorization.
6. Freeze only after the applicable completion/regression/device/CI gates pass.
7. Preserve existing capabilities unless an explicit approved scope says otherwise.
8. Device validation must keep iPhone/iPad behavior in scope where UI or Planning behavior is affected.

## Exact next permitted step

The next permitted development step is exclusively the final BP-001 definition against the verified current `main` baseline:

- confirm the exact title and scope for `BP-001 – Authoritative Hall Context in Planning`;
- define its acceptance / regression boundaries;
- define the exact `feature/BP-001-...` branch name.

No BP-001 implementation is authorized by this status synchronization itself. The BP-001 branch is created only after the final definition is explicitly accepted.
