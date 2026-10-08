# BP-005 – Existing Cable Tray Route Point Editing

## Status
**DEFINED / SCOPED / NOT IMPLEMENTED**

Base: `main = bea62c569f6772d79628b0bf402291808d0a9d3f`.

This document records the BP-005 definition and implementation scope. It does not authorize implementation.

## Practical problem
Completed `cable-tray.route` geometry can be created, persisted and evaluated, but existing route points cannot be repositioned after authoring. Practical corrections therefore require redrawing the route.

## Minimal contract
The persistent geometry authority remains exclusively `cable-tray.route.points[]`.

Within the existing Measure / cable-tray context an existing route point may be hit and dragged. During that interaction:
- only `route.points[pointIndex].x/y` is geometrically edited;
- existing world-coordinate conversion and grid/snap behavior are reused;
- when `pointIndex === 0`, `route.x/y` is synchronized to `route.points[0]`;
- point-edit state is transient runtime state only;
- after an actual movement, the existing scene persistence path is used once.

Length and BP-004 evaluation remain Derived State from `points[]`. No persistent `lengthM`, `totals` or evaluation authority is added.

## Interaction boundary
Point editing belongs only to the existing Measure / cable-tray interaction.

The legacy Select/object drag remains unchanged. `cable-tray.route` must remain excluded from `_hitTestWorldPoint()`.

A point drag must not fall through to Measure tap authoring and therefore must not append an extra route point on drag end. Existing pan, pinch, asset/assembly drag and mobile gesture behavior must remain unaffected.

## Presentation
In Measure mode, existing `cable-tray.route.points[]` may be rendered as small editable handles. These handles are derived presentation only and do not create another point collection, selection authority or persistent edit model.

## Authorized implementation surface
Primary production file:
- `ui/panels/WorkareaPanel.base.js`

Expected responsibilities:
1. tray-point hit testing in Measure context;
2. transient tray-point drag state;
3. Measure pointer down/move/up handling;
4. first-point `route.x/y` synchronization;
5. existing scene persistence after a dirty point drag;
6. Measure-mode point-handle rendering.

No persistence/store/schema file change is required. CSS is outside the expected scope unless proven strictly necessary.

## Verification scope
Add:
- `tests/bp-005-cable-tray-point-editing.spec.js`

It must establish:
- editing operates on existing `cable-tray.route.points[]`;
- editing is Measure-context behavior, not legacy object drag;
- routes remain excluded from `_hitTestWorldPoint()`;
- existing snap is reused;
- moving point 0 synchronizes `route.x/y`;
- persistence occurs only after an actual point change;
- drag does not append an extra route point;
- edited points survive the existing Save → Reload path;
- length and BP-004 totals remain derived.

Existing BP-002, BP-003 and BP-004 tests remain unchanged and mandatory regression evidence.

## Explicit non-goals
BP-005 does not add whole-route translation, adding/deleting points on completed routes, completed-route width/class editing, plant/start-target binding, ports/sockets, cable assignment, fill percentage, bend radius, 3D routing, physical cable-tray materialization, 3 m segmentation/BOM, article numbers, EPLAN, a new Planning mode/tool, a second route model, persistent edit state, or persistent derived totals/lengths.

## Scope boundary
BP-005 is limited to correcting an already existing 2D cable-tray route by moving one of its existing points. Plant/start-target binding and physical materialization remain separate later blocks.
