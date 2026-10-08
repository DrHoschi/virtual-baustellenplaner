# BP-023 – Completion / Evidence / Freeze

Status: **FROZEN – FUNCTIONAL HEAD VERIFIED**

## Authority

- Definition base / current main at authorization: `16b9f44b979a71ce4ca56b791002468f57a3e5cd`
- Feature branch: `feature/BP-023-cable-tray-fitting-junction-authority`
- Functional freeze head: `3d569ed1ed10f6f1b09d58133c972c8307ab324c`
- Definition: `docs/BP_023_DEFINITION_SCOPE.md`

This document records completion evidence only. It does not extend BP-023 scope.

## Frozen capability

BP-023 adds explicit manual cable-tray fitting / junction planning intent without deriving fittings from route geometry.

Persistent authority:

`app.project.workspace.scene.cableTrayFittings[]`

Each fitting has its own stable fitting ID, a V1 kind and explicit route-point references. Route geometry remains solely authoritative in existing `cable-tray.route.points[]`; fitting records do not persist copied x/y coordinates.

V1 kinds:

- `bend`
- `tee`
- `reducer`
- `connector`

The central frozen rule is:

**Geometry describes where tray runs. A BP-023 fitting exists only after an explicit user decision.**

A corner, 90-degree change, coincident endpoint, branch, crossing, width difference or nearby route therefore does not automatically create or require a fitting.

## Persistence / Save → Reload contract

BP-023 uses the existing Workarea project-save path.

- runtime scene authority: `scene.cableTrayFittings[]`
- canonical persisted location: `app.project.workspace.scene.cableTrayFittings[]`
- fitting snapshots are sanitized before persistence
- existing `_requestProjectSaveDebounced(...)` remains the save trigger
- load/rehydration reads the same canonical location
- no new file format, persistor or second geometry authority was introduced
- no `project.*` fitting mirror was introduced

Syntactically valid fitting references are preserved even if their target route or point can no longer be resolved. Runtime validation exposes such records as unresolved instead of clamping, relocating, replacing or silently deleting them.

## Manual selection / BP-005 boundary

Fitting authoring is an explicit transient mode.

- entering fitting authoring finishes an active cable-tray draft first
- fitting selection accepts existing `cable-tray.route` points only
- the active draft route is excluded
- after the verification blocker fix, an accepted route must have at least two points
- while fitting selection is active, BP-005 point drag is not started
- a fitting-selection tap does not append a new route point
- outside fitting authoring, existing BP-005 behavior remains authoritative
- removing a fitting does not modify route geometry

No automatic angle, distance, intersection, width or topology inference was added.

## pointIndex boundary

V1 fitting connections persist:

`{ routeId, pointIndex }`

This is intentionally limited to the current route-editing capability.

At the frozen product state, completed route points may be moved but are not inserted, deleted or reordered by BP-005. Moving a point therefore keeps its index. BP-023 does not claim that `pointIndex` is a permanently stable identity.

Any future capability that inserts, deletes or reorders points of completed routes must reopen this boundary before relying on existing BP-023 references. Stable point IDs and point-reference migration remain outside BP-023.

## Broken references

BP-023 distinguishes persistence from resolution.

- sanitizer preserves structurally valid `routeId + pointIndex`
- runtime resolution checks whether the referenced route and point currently exist
- unresolved references remain visible as unresolved
- no nearest-point relocation
- no index clamping
- no replacement route
- no silent fitting deletion
- unresolved records do not become invented material quantities

## Material / existing-capability boundary

BP-023 establishes fitting identity and topology intent only.

It does not modify BP-016/BP-017/BP-018/BP-022 material projections or CSV output. It does not add manufacturer/article/catalog identity, price, supplier, inventory, fitting dimensions, purchase optimization, support rules, cable auto-routing, 3D fitting geometry or EPLAN coupling.

BP-019/BP-020/BP-021 support planning remains independent. BP-008+ cable routing authorities remain independent.

## Verification blocker and fix

Initial implementation head:

`a2c69ff7c6a222f1f94ddf9b45d3533a2f350221`

The first verification gate identified two blockers:

1. the finished-route requirement was not explicitly protected against an abnormal one-point persisted route;
2. BP-023 had no focused regression test protecting its new contract.

Blocker fix:

- `187ff22d4659ab1dd281f7b08e7e2f156ad65615` — explicitly requires `route.points.length >= 2` before accepting a fitting connection.
- `3d569ed1ed10f6f1b09d58133c972c8307ab324c` — adds `tests/bp-023-cable-tray-fitting-junction-authority.spec.js` protecting the authorized BP-023 contract.

The blocker-fix diff from `a2c69ff…` to the functional freeze head is exactly two commits ahead / zero behind and changes only:

- `ui/panels/WorkareaPanel.base.js`: +2 / -1
- `tests/bp-023-cable-tray-fitting-junction-authority.spec.js`: new focused regression test

## Exact-head CI evidence

Product CI **#1438**

- run ID: `36441924430`
- event: `push`
- attempt: `1`
- exact head SHA: `3d569ed1ed10f6f1b09d58133c972c8307ab324c`
- status: `completed`
- conclusion: **success**

The CI job completed successfully, including syntax/import checks, existing BP-017/BP-018/BP-019 regression steps, Playwright setup and smoke tests.

The focused BP-023 regression test is present at the exact functional freeze head and protects the BP-023 source contract.

## Freeze decision

**BP-023 – Practical Cable-Tray Fitting / Junction Authority: FROZEN**

Functional freeze head:

`3d569ed1ed10f6f1b09d58133c972c8307ab324c`

This freeze records the verified V1 capability only. No integration into `main` is performed by this gate. Any integration requires a separate read-only integration reconciliation followed by separately authorized integration.
