# BP-009 – Practical Cable Length Planning

## Definition / Authority / Minimal Implementation Scope

Baseline: `340e68eb257979021a9763981aecd8aba732581f`

Status: **DEFINED / SCOPED / NOT IMPLEMENTED**

## Purpose

BP-009 provides a conservative practical cable-length comparison from already assigned cable-tray routes without inventing geometric certainty that the current model does not provide.

## Existing authorities

- Cable authority remains `assembly.instance.cableLines[]`.
- Manual cable length remains `cableLine.lengthM`.
- Ordered tray assignment remains `cableLine.routeRefs[]`.
- Cable-tray identity remains `cable-tray.route.id`.
- Cable-tray geometry remains solely `cable-tray.route.points[]`.
- Geometric tray length remains derived from `points[]` through the existing tray-length calculation.
- BP-006 `startRef` / `endRef` remain route endpoint/equipment bindings and are not cable-length geometry authority.

## BP-009 calculation contract

For a CableLine, resolve its ordered `routeRefs[]` against existing `cable-tray.route` scene objects.

The only currently reliable automatic length is:

`knownMinimumTrayPathM = sum(geometric length of every valid referenced cable-tray.route)`

This is a **known minimum tray-path length**, not a complete predicted cable length.

The following are explicitly **undetermined** in BP-009:

- source CablePoint/port to first tray segment,
- target CablePoint/port from last tray segment,
- gaps/transitions between referenced tray segments,
- vertical drops or height changes not represented by tray `points[]`,
- connection/termination reserve,
- installation reserve or percentage allowance.

No default reserve (for example +10% or +1 m per end) may be invented.

## Coordinate authority limitation

Current CablePoint `x/y/z` values originate from assembly component coordinates. The reconciled code does not establish them as transformed Workarea world coordinates including assembly placement/rotation and physical port offset. Therefore BP-009 must not use CablePoint/port coordinates to calculate source/target distances.

## Route order and direction

`routeRefs[]` order remains meaningful as the intended sequence of tray segments.

BP-009 does not establish traversal direction within an individual route. Direction is irrelevant for summing each route's geometric length. It must not be used to infer inter-route gaps or source/target connection distances.

## Manual length comparison

`cableLine.lengthM` remains manually editable and must never be overwritten by BP-009.

The UI may display the manual cable length and the derived known minimum tray-path length together. Any difference is informational only and must not be persisted as a second length authority.

If the manual value is numeric, a derived comparison/difference may be shown at runtime. No automatic correction, reserve, warning threshold, or write-back is authorized.

## Missing references

A missing `routeRefs[]` target contributes no invented length and remains diagnostically visible. The derived value must not imply that missing references or unmodelled connection portions are included.

## Minimal implementation scope

Production change is limited to:

- `ui/panels/WorkareaPanel.base.js`

The existing BP-008 route-assignment derivation and CableLine properties UI are the implementation seam. BP-009 may refine the runtime-derived assignment summary so it clearly exposes:

- known minimum tray-path length,
- undetermined connection/transition portions,
- manual `lengthM`,
- optional runtime-only numeric difference when manual `lengthM` is valid.

Focused verification may add exactly one test:

- `tests/bp-009-cable-length-planning.spec.js`

No other production file is required by the reconciled minimal scope.

## Persistence contract

BP-009 adds **no persistent field**.

In particular it must not persist:

- `knownMinimumTrayPathM`,
- predicted/automatic cable length,
- connection distance,
- transition distance,
- reserve,
- difference/comparison totals.

Existing `cableLine.lengthM`, `routeRefs[]`, route `points[]`, and BP-006 endpoint refs retain their current authorities.

## Explicitly out of scope

- world-space CablePoint/port transformation,
- automatic source-to-tray or tray-to-target distance,
- automatic gap routing between tray segments,
- automatic route direction/orientation,
- 3D cable routing,
- vertical drop calculation,
- reserve/percentage rules,
- automatic overwrite of `cableLine.lengthM`,
- cable fill/capacity,
- BOM/material merge,
- EPLAN coupling changes.

## Gate result

**BP-009 Definition Documentation / Implementation Scope Reconciliation: PASS**

This document defines scope only. No BP-009 product implementation or feature branch is authorized by this gate.
