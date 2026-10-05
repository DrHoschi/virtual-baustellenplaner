# BP-031 - Cable Tray Duty Class

## Status

**FROZEN**

Functional freeze head:

`ecf872c2c99ba7cf3eb1605fb3bca56a6d705e6e`

Authorized base:

`94e2d38845d59c444bcdd8d5f7ef72e3151e8816`

Feature branch:

`feature/BP-031-cable-tray-duty-requirement`

## Purpose

BP-031 adds an explicit duty class to cable-tray routes so that standard and heavy tray material remain distinct during evaluation, mapping and output. The route remains the authority for this property; legacy routes without a value resolve to `standard`.

## Functional Contract

The route-owned field is:

`tray.dutyClass`

Supported values are:

- `standard`
- `heavy`

New tray drafts default to `standard`. The selected route's duty class can be changed and is persisted through the existing scene persistence path. Invalid or missing legacy values normalize to `standard`.

Tray and accessory material grouping and mapping distinguish duty class in addition to their existing identity fields. The existing CSV outputs include `Ausfuehrungsklasse`. Support and fitting material contracts are unchanged.

## Frozen Functional Scope

The functional diff against authorized base `94e2d38845d59c444bcdd8d5f7ef72e3151e8816` contains exactly these ten files:

- `ui/panels/WorkareaPanel.base.js`
- `ui/workarea/workarea-cable-tray.v1.js`
- `tests/bp-031-cable-tray-duty-requirement.spec.js`
- `tests/bp-016-cable-tray-material-preparation.spec.js`
- `tests/bp-017-cable-tray-accessory-planning.spec.js`
- `tests/bp-018-cable-tray-material-output.spec.js`
- `tests/bp-022-combined-cable-tray-material-output.spec.js`
- `tests/bp-026-material-identity-article-mapping.spec.js`
- `tests/bp-027-practical-material-assignment-ui.spec.js`
- `tests/bp-028-article-aware-material-output.spec.js`

No documentation, workflow, schema, migration, or unrelated product file is included in the functional commit.

## Verification Evidence

Implementation / Verification Gate: **PASS**

Exact functional remote head:

`ecf872c2c99ba7cf3eb1605fb3bca56a6d705e6e`

The functional head has one parent, the exact authorized base, and its tree is `3fbbded86ea23e6b072d2782ffd5d61128040b28`. The local implementation commit `4bbdf4a407ddc3b6d18b4aee4dd5d3c36a94318f` and the remote functional commit have the identical tree; publication changed commit metadata only.

Focused and repository-local evidence recorded for Gate 2:

- JavaScript syntax checks: **PASS**
- project CI baseline checks: **PASS**
- direct BP-031 invariant assertions: **PASS**
- local Playwright execution: unavailable because the worktree had no local `@playwright/test`; transient `npx` execution was an infrastructure blocker

## Exact-Head Product CI

- Workflow: **Product CI**
- Run number: **#1547**
- Run ID: `37349325054`
- Event: `push`
- Branch: `feature/BP-031-cable-tray-duty-requirement`
- Head SHA: `ecf872c2c99ba7cf3eb1605fb3bca56a6d705e6e`
- Status: `completed`
- Conclusion: **success**
- Job `checks`: **success**

The run completed the JavaScript syntax, import graph, BP-029 catalog validation, navigation foundation, manifest integrity, BP-025, BP-019, BP-018, BP-017, BP-024, UI-MIG, UI Wiring E2E and Smoke Test steps successfully.

## Lineage and Reconciliation Evidence

At the start of Gate 3:

- remote feature branch head: exactly `ecf872c2c99ba7cf3eb1605fb3bca56a6d705e6e`;
- remote `main`: exactly `94e2d38845d59c444bcdd8d5f7ef72e3151e8816`;
- compare status: `ahead` by 1, `behind` by 0;
- merge base: exactly the authorized base;
- changed files: exactly the ten functional files listed above.

The feature branch is linear and contains no foreign commits. Main integration is not performed by this completion record and remains a separate, explicitly authorized operation.

## Explicit Non-Scope Preserved

BP-031 does not add:

- manufacturer or article requirements;
- load calculations, wall-thickness rules, or geometry changes;
- walkable or other duty classes;
- quantity-authority changes;
- support or fitting duty-class behavior;
- a schema migration or new persistence authority;
- changes to CI or workflows;
- integration into `main`.

## Freeze Decision

BP-031 Cable Tray Duty Class is **FROZEN** at functional head:

`ecf872c2c99ba7cf3eb1605fb3bca56a6d705e6e`

This document records completion evidence only. It does not alter the verified functional tree. The documentation commit will be the branch's completion/evidence head; it does not change the functional freeze head above or authorize integration into `main`.
