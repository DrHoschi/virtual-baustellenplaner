# PROJECT STATUS CURRENT

Status authority for the Baustellenplaner repository.

## NEW CHAT RULE
Before any development decision, branch action, code change, cleanup, merge, freeze, deployment change, CI-authority change, or roadmap continuation, read this file together with `ROADMAP_CURRENT.md` and `CI_AUTHORITY_CURRENT.md` and verify the referenced branch/SHA against GitHub.

Do not infer current product state from an older chat, historical feature branch, historical CI gate, or older deployment.

## Current development authority
- Integrated product baseline: `main@0c119fb137556c1245834b0320b146fb3eb5d21f` (BP-001 integrated)
- Current active development branch: `feature/BP-002-hall-structural-configuration`
- Current reconciled functional head before this documentation update: `3f2c034175167ff016cd085726080a1fdf457e56`
- BP-002 is the active product development line. Do not start future work from older `ui-mig`, `tech-*`, `project-ui-*`, `test-r1*`, BP-001, or recovery branches.
- This documentation update does not merge BP-002 to `main` and does not authorize BP-003.

## Preserved product authorities
### Hall
`app.project.hall` is the single authoritative hall state.

Hall3D remains an existing product capability owned by Planning / Hall Context. Do not delete Hall3D, its data, or its assets, and do not classify it as legacy merely because navigation changes.

### Planning / Workarea
Planning/Workarea remains the existing productive planning engine and must not be replaced by a competing implementation.

Hall projection path:
`app.project.hall -> WorkareaPanel.getPlanningHallContext() -> PlanningWorkspaceAdapter -> visible Planning Hall Context`

Placed planning objects remain authoritative under:
`app.project.workspace.scene.objects`

Existing canvas/render/pan/zoom/selection/drag/place/persistence behavior is preservation scope unless a later explicitly authorized capability changes it.

### Project / navigation
The current product flow established by BP-001 remains valid:
`Neu -> Projekt – Neu -> Projekt anlegen -> Projektliste -> Projekt -> Assets -> In AssetLab öffnen -> AssetLab 3D`

Project state must survive transitions between Project, Hall3D, Planning/Workarea and AssetLab where contextual return is valid.

## Completed / preserved foundations
- PROJECT-UI-03C: frozen library ownership separation / surface consolidation.
- TEST-DEPLOY-01: frozen deterministic device deployment with visible exact-build identity.
- NAV-BACK-01: frozen contextual Back validity/visibility.
- BP-001: integrated authoritative hall context in Planning; final integrated SHA `0c119fb137556c1245834b0320b146fb3eb5d21f`.
- UI-CUT-01: Workarea CSS geometry authority and responsive regression foundation preserved.

## BP-002 current state
BP-002 started as Hall Structural Configuration and now contains the current post-BP-001 product-development line used to restore practical Planning workability and resolve the discovered persistence/storage blocker.

### Hall structural configuration
Status: functional development state reached. Current-product hall tests and BP-HI regressions have passed on the current line. Legacy hall behavior is not allowed to replace the current hall authority.

### Planning workability
Implementation commit: `47e514f8af7c414a0e79f88fb2b392eba6c66ee6`

Result:
- Planning opens the real Workarea.
- iPhone manual evidence confirmed usable Planning dock scrolling.
- Assets and Assemblies/Baugruppen remain reachable.
- Workarea engine semantics were not rewritten by the workability correction.

### Planning persistence / storage quota correction
Root cause of the observed `move -> reload -> old position` defect was runtime LocalStorage quota exhaustion, not Workarea drag/scene logic.

Project persistence correction commit:
`b1016d4df2acd40fc948aa495c7a1754b2a9e6fe`

Current functional head:
`3f2c034175167ff016cd085726080a1fdf457e56`

Storage contract:
- Project state / small durable metadata may use LocalStorage according to existing persistence authority.
- New large AssetLab model buffers are written to IndexedDB, not LocalStorage.
- Existing historical `modelbuf:v1:*` LocalStorage buffers remain readable as recovery data.
- No automatic deletion or migration of existing user storage was authorized.
- Project persistence reports quota failures explicitly instead of silently presenting a successful save.

Manual iPad product evidence on this line:
`open project -> move Rollenbahn in Workarea -> reload -> reopen Workarea -> moved position remains`
Result: PASS.

AssetLab full-file integrity reconciliation against the direct predecessor found no lost AssetLab capability; the large textual diff is predominantly compaction plus the authorized storage-boundary change.

## Current CI interpretation
Exact-head CI for `3f2c034...` completed with 17 runs: 11 success, 6 failure.

The failures were reconciled as follows:
- historical TECH-WA implementation-specific workflows: historical / non-authoritative for current product acceptance;
- UI-MIG-05B / 05C: historical/transitional Planning UI expectations; 05C is chained behind 05B;
- central CI generic smoke failure: a known 404 console error while the current-product meaningful syntax/import/navigation/hall/BP-HI/UI-REC/BP-002/IM02/IM03/UI-Wiring/boot steps passed. The missing resource was not identified by that test and must not be silently reclassified as a product regression.

Current CI authority is defined separately in `docs/CI_AUTHORITY_CURRENT.md`. Historical workflows may remain as evidence, but their existence does not make them current product authority.

## Known debt / boundaries
- The repository contains many historical workflows and documents from UI-MIG, TECH-WA, PROJECT-UI and recovery phases. `RETIRE AS AUTHORITY` does not mean delete.
- Generic smoke 404 remains technical CI debt until separately diagnosed or the smoke contract is replaced by the current product contract.
- `AssetLab3DPanel.js` and `WorkareaPanel.base.js` are large files. Future modularization is desirable but is a separate refactoring capability and is not implicitly authorized by this status.
- Existing user LocalStorage must not be cleaned automatically merely to solve quota pressure.

## Forward development rule
Product work follows the current product roadmap in `docs/ROADMAP_CURRENT.md`. Each future BP block should deliver a visible product capability or a necessary product reliability correction. Reconciliation is used only when it resolves a real authority/scope ambiguity; historical gates must not create endless development loops.

## Exact next permitted step
This documentation update establishes the current authority set only. After `PROJECT_STATUS_CURRENT.md`, `ROADMAP_CURRENT.md` and `CI_AUTHORITY_CURRENT.md` are present and verified on the same BP-002 branch, the next development decision must be taken directly from `ROADMAP_CURRENT.md`.

No additional code correction, CI cleanup, branch cleanup, merge, freeze, or BP-003 capability is authorized by this document.