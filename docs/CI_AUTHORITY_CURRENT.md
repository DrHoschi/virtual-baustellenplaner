# CI AUTHORITY CURRENT

Current CI/test authority for Baustellenplaner.

Purpose: protect the product we use now. Historical workflows may remain in the repository as evidence, but a historical workflow is not current product authority merely because GitHub Actions still runs it.

Read together with `PROJECT_STATUS_CURRENT.md` and `ROADMAP_CURRENT.md`.

## Authority classes
### REQUIRED CURRENT
Failure blocks completion of the current product capability unless the failure is proven unrelated infrastructure/environment noise.

### CAPABILITY-SPECIFIC
Required only for the BP capability currently being changed.

### HISTORICAL / NON-AUTHORITATIVE
Useful evidence of an older implementation or transition. Failure does not require changing the current product to satisfy an obsolete DOM/layout/instrumentation contract.

### INVESTIGATE
Potentially useful invariant, but the current test contract is not yet reliable enough to be a blocking authority.

## Required current product gates
The authoritative CI target is one coherent current-product suite containing these invariants:

1. **Syntax / Import / Boot**
   - JavaScript syntax valid.
   - import graph/manifest valid.
   - application reaches usable shell/workspace without fatal startup error or blank screen.

2. **Project lifecycle**
   - create/open project;
   - save/reload project;
   - current project identity/state survives expected navigation.

3. **Hall lifecycle**
   - create hall;
   - edit hall;
   - save/reload;
   - `app.project.hall` remains authoritative;
   - Hall3D and Planning receive the current hall rather than independent copies.

4. **Planning practical E2E**
   - open Planning/real Workarea;
   - viewport/canvas remains interactive;
   - insert Asset or Assembly;
   - select/move/rotate;
   - save/reload/reopen;
   - `app.project.workspace.scene.objects` retains placed-object state.

5. **AssetLab lifecycle**
   - Project Assets -> AssetLab entry works;
   - AssetLab context is valid;
   - model-buffer persistence is IndexedDB-first/current write authority;
   - historical LocalStorage model buffers may still restore;
   - failure to persist must not be presented as a successful durable save.

6. **Context/navigation integrity**
   - Project <-> Planning <-> AssetLab contextual transitions do not lose project state;
   - contextual Back appears only with valid return context;
   - direct module switches do not retain stale Back context.

7. **Device evidence where relevant**
   - iPhone and iPad are separate responsive acceptance targets for UI work;
   - device evidence supplements automated CI when Safari/mobile behavior cannot be proven reliably in the runner.

## Capability-specific gate rule
Every active BP block may add one focused acceptance test/suite for its new capability. That test protects the product outcome, not a temporary implementation detail. When the implementation evolves, update the test to preserve the invariant rather than restoring obsolete UI solely to make an old selector pass.

## Current workflow classification
### KEEP / CURRENT FOUNDATION
- `.github/workflows/ci-checks.yml` as the central runner foundation, but its contents must converge on the current-product gates above.
- syntax/import/navigation/manifest checks that validate implementation-independent invariants.
- current Hall Config / BP-HI hall lifecycle regressions while they continue to represent the current hall contract.
- current UI Wiring E2E when aligned with the visible product flow.
- deterministic deployment workflow from TEST-DEPLOY-01 for exact-build device testing.

### UPDATE TO CURRENT CONTRACT
- UI-MIG IM02 shell test: preserve Planning reachability/workspace boot, not historical exact shell IDs.
- UI-MIG IM03 context-return test: preserve contextual return semantics, not historical path details.
- PROJECT-UI-03B planning-entry test: preserve existing-project -> Planning/Hall context -> return without state loss, not historical DOM structure.
- generic smoke test: preserve no-blank-screen/no-fatal-boot invariant, but the current unexplained resource 404 must not remain an opaque blocker.

### HISTORICAL / RETIRE AS AUTHORITY
- `tech-wa-freeze-01a.yml`
- `tech-wa-freeze-01b1.yml`
- `tech-wa-freeze-01b2.yml`
- `tech-wa-freeze-01b3.yml`
- `tech-wa-freeze-01c.yml`
- historical UI-MIG 04/05 workflow chain where it enforces transitional geometry/DOM/instrumentation rather than the current product invariant;
- historical PROJECT-UI workflow wrappers whose capability is now covered by current product tests.

`RETIRE AS AUTHORITY` does not authorize deleting the workflow or test. Cleanup/archival is a separate maintenance action.

## Reconciled exact-head evidence at 3f2c034...
Exact head `3f2c034175167ff016cd085726080a1fdf457e56` produced 17 completed workflow runs: 11 success and 6 failure.

Current-product meaningful checks observed PASS included syntax, imports, navigation, manifest, Hall Config, BP-HI hall regressions, UI-REC, BP-002 Hall, IM02, IM03, current UI Wiring and boot smoke.

The six failures were accounted for as:
- three historical TECH-WA workflows;
- UI-MIG-05B historical/transitional visibility expectation;
- UI-MIG-05C chained/skipped behind 05B;
- central generic smoke resource 404 with the exact missing resource not identified.

This evidence does not prove every future capability. It establishes that historical red workflows must not be treated as six current product regressions.

## Planning hard invariants
- PL-I01 Planning reachable from current product UI and opens real Workarea.
- PL-I02 one functional viewport/canvas remains interactive after mount.
- PL-I03 no main-thread blocking; timers/RAF/user interaction continue.
- PL-I04 rendering remains stable under normal operation.
- PL-I05 viewport/size changes, especially mobile Safari, do not destroy Planning or cause uncontrolled reinitialization.
- PL-I06 Project <-> Planning does not lose open-project or Planning data.
- PL-I07 contextual Back only with valid return context; direct switch has no stale Back.
- PL-I08 boot/loader/import chain has no fatal blank/stuck startup.

Tests may change implementation details while these invariants remain protected.

## CI simplification target
A future separately authorized maintenance change should reduce automatic push CI to:
- one current central product workflow;
- deterministic deployment when requested/appropriate;
- focused capability-specific checks where needed.

Historical workflows can be disabled, archived, or converted to manual evidence only after a separate explicit maintenance authorization. This document changes authority classification, not GitHub Actions files themselves.

## Rule for red CI
Before changing product code because a CI job is red, classify the failing assertion against this document:
- current invariant broken -> fix product/test as appropriate;
- current invariant correct but selector/path stale -> update test in an authorized CI maintenance step;
- historical implementation-specific gate -> do not change current product to satisfy it;
- infrastructure/resource ambiguity -> investigate only if it blocks a required current invariant.

The goal is a small, trustworthy CI signal that tells whether Baustellenplaner still performs its current product workflow.