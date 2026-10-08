# PROJECT STATUS CURRENT

Status authority for the Baustellenplaner repository.

## NEW CHAT RULE

Before any development decision, branch action, code change, cleanup, merge, freeze, deployment change, or roadmap continuation, read this file first and verify its referenced branch/SHA against GitHub.

Do not infer the current product state from an older chat summary, an older feature branch, or an older deployment.

## Current authority

- Authoritative product branch: `main`
- R1 frozen product baseline: `706710a711cf9e83a6b1b76b8ad6610311046ca5`
- R1 status: `PRACTICAL PLANNING CORE / PASS / 0 BLOCKER / FROZEN`
- Historical integrated BP-001 product SHA: `0c119fb137556c1245834b0320b146fb3eb5d21f`
- BP-001 branch-creation baseline: `99d69aceb87ad0e736ba506686dbe30ac4e52766`
- BP-001 development branch: `feature/BP-001-authoritative-hall-context-in-planning` — `COMPLETED / HISTORICAL DEVELOPMENT LINE`
- BP-001 integration: `FAST-FORWARD PASS / main 99d69ace... → 0c119fb... / NO FORCE / NO MERGE COMMIT`
- Authority rule: `main` is the current product authority. Completed historical feature branches must not be used as new development bases.

`MAIN-REC-01 – Authoritative Product Main Reconciliation` remains the historical reconciliation that established the pre-BP-001 authoritative main line:

- MAIN-REC-01A: `PASS / READ-ONLY COMPLETE`
- MAIN-REC-01B preservation integration baseline: `6bd7de6b1e4fb14b91a00a04bba64ce0910b27ac`
- MAIN-REC-01C: `PASS / MAIN REALIGNED`

The former continuation branch `feature/project-ui-03c-library-ownership-separation-recovery` is historical after MAIN-REC-01 and must not be used as a new development base.

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


### R1 – Practical Planning Core

Status: `PASS / COMPLETION EVIDENCE CONFIRMED / 0 BLOCKER / FROZEN`

Frozen product baseline: `706710a711cf9e83a6b1b76b8ad6610311046ca5`

Verified practical workflow:

`Projekt/Halle → Planning → Asset/Baugruppe einfügen → auswählen → verschieben → drehen → speichern → Reload → Zustand erhalten`

Completion evidence:

- Project/Hall → Planning: `PASS`
- Asset insertion: `PASS`
- Assembly insertion: `PASS`
- Object selection: `PASS`
- Object move: `PASS`
- Move → Save/Autosave → Reload → moved X/Y retained: `PASS / iPad + iPhone device evidence`
- Object rotation: `PASS`
- Rotation → Save/Autosave → Reload → rotation retained: `PASS / real product reload evidence`
- Scene persistence / reload: `PASS`
- Remaining R1 blocker: `0`

Move-persistence correction record:

- Correction commit: `706710a711cf9e83a6b1b76b8ad6610311046ca5` — `fix: persist planning object move after drag end`
- Correction scope: only `ui/panels/WorkareaPanel.base.js`
- The post-drag persistence transition now ends drag state before calling `_persistSceneToStore("drag-end")`.
- No rotation, Canvas geometry, movement semantics, Hall3D or unrelated Planning capability was changed by this correction.

Rotation required no correction: existing rotation behavior and persistence were confirmed by real reload testing.

R1 is closed. Future work must preserve this frozen practical workflow. Functional defects discovered during normal use may be handled as separately reconciled corrections; they do not reopen R1 automatically.

### BP-001 – Authoritative Hall Context in Planning

Status: `PRODUCT WORK COMPLETE / REMAINING CAPABILITY GAP NONE IDENTIFIED / MAIN INTEGRATION PASS`

- Development branch: `feature/BP-001-authoritative-hall-context-in-planning`
- Branch base: `main@99d69aceb87ad0e736ba506686dbe30ac4e52766`
- First implementation SHA: `95c0c60e67686fdd854406222e4103644b013ef1` — historical intermediate implementation, not final authority.
- Final integrated product SHA: `0c119fb137556c1245834b0320b146fb3eb5d21f`
- Main integration: `FAST-FORWARD VERIFIED / main == 0c119fb137556c1245834b0320b146fb3eb5d21f`
- Product-code mutation during final UI-Wiring correction: `0`

#### Final BP-001 authority contract

`app.project.hall → WorkareaPanel.getPlanningHallContext() → PlanningWorkspaceAdapter → visible Planning Hall Context`

`app.project.hall` remains the single authoritative hall state. Planning receives only a small non-persisted read-only projection. No competing hall copy may exist under Workarea scene, workspace or independent Planning state.

The Workarea scene remains separately authoritative for placed planning objects under `app.project.workspace.scene.objects`.

#### BP-001 completed workflow

`Projekt öffnen/neu → Halle definieren/ändern → Planung öffnen → zurück ohne Zustandsverlust`

Final classification:

- Project creation/opening: `COMPLETE`
- Hall initial creation: `COMPLETE`
- Hall editing/live rebuild/persistence: `COMPLETE`
- Project → Hall3D entry: `COMPLETE`
- Project → Planning entry: `COMPLETE`
- Project state preservation across Hall3D / Planning / Project: `COMPLETE`
- Authoritative hall context inside Planning/Workarea: `COMPLETE`
- Remaining product capability gap inside original BP-001 objective: `NONE IDENTIFIED`

#### Historical correction record

The first implementation at `95c0c60e...` read hall authority from the Planning adapter and therefore did not satisfy the locked ownership path. Reconciliation established `WorkareaPanel.getPlanningHallContext()` as the legitimate read boundary.

The authorized correction was limited to:

- `ui/panels/WorkareaPanel.js`
- `ui/panels/WorkareaPanel.base.js`
- `ui/shell/PlanningWorkspaceAdapter.js`
- `tests/bp-hi01b3r-product-reachability.spec.mjs`

`WorkareaPanel.base.js` was authorized only as a technical extraction/write-unblock boundary and did not authorize a new Workarea capability.

The stale historical static build-ID test contract was reconciled to the already frozen TEST-DEPLOY-01 dynamic `build-info.json` identity contract. Product code was not reverted to a static build-ID mechanism.

#### Final UI-Wiring contract correction

The final BP-001 correction commit is:

`0c119fb137556c1245834b0320b146fb3eb5d21f` — `BP-001 align full UI Wiring test contract`

Only `tests/ui-wiring.spec.js` was changed in that correction. The current visible product contract is:

`Neu → Projekt – Neu → Projekt anlegen → Projektliste → Projekt → Assets → In AssetLab öffnen → AssetLab 3D`

Exact completion evidence on `0c119fb...`:

- command: `npx playwright test tests/ui-wiring.spec.js`
- result: `1/1 PASS`
- relevant preceding BP-001/UI contract regression steps in the same checks job: `PASS`

Known CI failures that were separately proven to pre-exist on the authoritative pre-BP-001 main baseline remain project CI debt and are not reclassified as BP-001 regressions. A later generic Smoke Tests failure observed after the UI-Wiring step was not historically reconciled against the baseline and therefore is not classified here as baseline debt or as a BP-001 product gap.

#### BP-001 integration record

Pre-integration reconciliation established:

- `main@99d69ace...`
- BP-001 head `0c119fb...`
- branch relation before integration: `15 ahead / 0 behind`
- clean linear fast-forward path

Integration was explicitly authorized and then performed as a non-forced fast-forward. Post-write verification confirmed:

`main == 0c119fb137556c1245834b0320b146fb3eb5d21f`

No squash, merge commit, product modification or additional capability was introduced by integration.

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

## Forward development numbering

Controlled Baustellenplaner feature branches use the forward-only numbering pattern:

`feature/BP-001-...` → `feature/BP-002-...` → `feature/BP-003-...`

`BP` means Baustellenplaner. BP-001 is completed and integrated. This numbering rule does not itself authorize BP-002 or define its capability.

## Development safety rules

1. Read this file first and verify the referenced `main` SHA against GitHub before a new development action.
2. `main` is the current authoritative product line.
3. Completed BP-001 and older historical feature branches must not be used as new development bases.
4. Preserve all existing capabilities unless a separately reconciled and explicitly authorized future scope permits a change.
5. No branch deletion, cleanup, new feature branch, product mutation or roadmap capability is implicitly authorized by this status document.
6. Responsive behavior must continue to be considered separately for iPhone and iPad where future UI work is scoped.

## Exact next permitted step

R1 – Practical Planning Core is complete and frozen at product baseline `706710a711cf9e83a6b1b76b8ad6610311046ca5`. No further R1 implementation is currently authorized.

The next permitted development step is exclusively a read-only reconciliation of the existing Planning Workarea UI / responsive workspace against the frozen R1 product baseline. The reconciliation must inventory and preserve existing functionality, with particular attention to Object Tree, Inspector/Properties, insertion/assembly access, toolbar layout and usable Planning canvas space on desktop, iPad and iPhone.

No UI implementation, feature branch, R1 mutation, Hall3D change, Planning-function rewrite or new capability is authorized by this status entry.
