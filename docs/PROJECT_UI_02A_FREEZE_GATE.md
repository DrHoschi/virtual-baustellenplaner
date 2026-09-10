# PROJECT-UI-02A – Completion / Regression / Freeze Gate

Status: GATE PENDING
Baseline: `91c144092e831d6dd4bd8bafa17d0e4e66bb8abb`
Branch: `feature/project-ui-02a-project-workspace-state-shell`

## Scope

PROJECT-UI-02A establishes only the visible Project Workspace state shell:

- `PROJECT_STATE_NONE`
- `PROJECT_STATE_OPEN`
- the navigation carriers permitted for those states

It does not implement storage migration, lifecycle migration, Workarea save changes, autosave changes, or Hall3D changes.

## Hall3D preservation invariant

`hall3d` is an existing Baustellenplaner capability and is explicitly preserved.

For PROJECT-UI-02A the currently missing visible Hall3D entry is classified only as a temporary navigation visibility limitation caused by the new workspace navigation cut.

The following are explicitly prohibited by PROJECT-UI-02A and its follow-up work unless separately and deliberately authorized:

- removal of `hall3d`
- deletion of Hall3D code, data, models, assets, parameter packs, or project data
- conversion of Hall3D into deprecated/legacy functionality merely because no visible button is currently exposed
- silent disconnection of Hall3D from existing project/module data

A later, separate architecture step must decide the correct visible owner/entry point for Hall3D. Candidate placement may be a hall-/planning-related tool context, but PROJECT-UI-02A does not make that placement decision.

## Freeze condition

PROJECT-UI-02A may be frozen only when all of the following are true:

1. Full diff against baseline is scope-clean.
2. Static CI passes.
3. Browser regression/acceptance CI passes.
4. Real-device evidence has no PROJECT-UI-02A blocker.
5. Hall3D remains technically present and untouched by the PROJECT-UI-02A implementation.
6. The temporary lack of a visible Hall3D entry is documented as a navigation limitation, not a capability removal.

Until all conditions pass, PROJECT-UI-02A remains `NOT FROZEN`.
