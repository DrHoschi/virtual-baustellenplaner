# BP-006 – Practical Cable Tray Endpoint / Equipment Binding

## Status
**DEFINED / SCOPED / NOT IMPLEMENTED**

Baseline:

`main = cd49b1850148f3e668ae68b6d901b89c65861b6e`

## Purpose
BP-006 gives an existing `cable-tray.route` a minimal semantic start and end relation to existing planning objects without changing route geometry or introducing a second object/port authority.

## Existing authority
Planning objects already live in:

`app.project.workspace.scene.objects[]`

Stable scene-object identity is `object.id`.

Existing `asset.instance` objects may additionally carry `projectAssetId`, `slotId`, `catalogId`, `assetType` and related asset metadata.

Existing `assembly.instance` objects can already carry `ports[]` and derived `cablePoints[]`. AssemblyLab already defines technical connection types. BP-006 MUST reuse those identities when available and MUST NOT introduce another general port system.

Route geometry remains exclusively:

`cable-tray.route.points[]`

BP-002/BP-005 geometry semantics remain unchanged.

## Minimal persistent contract
A `cable-tray.route` may optionally persist:

```js
startRef: { objectId: "...", portId: "..." } // portId optional
endRef:   { objectId: "...", portId: "..." } // portId optional
```

Rules:
- `objectId` references an existing `scene.objects[].id`.
- `portId` is optional and only references an already existing port identity on that object.
- Missing/legacy ports do not prevent object-level binding.
- Object names, BMK, conveyor group, area, cabinet labels or other display metadata are not copied into the route.
- Display labels are derived from the referenced current scene object.
- Broken/missing references must degrade safely to an unbound/missing-reference display; they must not invent replacement IDs.

## Geometry boundary
Binding is semantic only.

BP-006 MUST NOT:
- move `points[]`;
- snap a route endpoint geometrically to an object/port;
- create a new route point;
- change route length as a side effect of binding.

A later geometric port-snap feature requires a separate block.

## Minimal UX contract
Binding belongs to the existing Measure / cable-tray workflow.

For an existing route, the user must be able to assign or clear:
- Start object;
- End object;
- optionally an existing port where available.

The selection source must be existing scene objects/ports. No duplicated equipment catalog is introduced.

The UI must show the currently resolved Start/End labels from the referenced objects and must remain usable on compact/mobile layouts.

## Persistence boundary
The existing scene persistence path remains authority.

The scene sanitization/rehydration path must preserve valid optional `startRef` and `endRef` fields for `cable-tray.route`.

No new store root, schema authority, adapter or persistence manager is introduced.

## Implementation scope reconciliation

### Productive code
Expected minimal productive file:

- `ui/panels/WorkareaPanel.base.js`

Required areas inside that file:
1. route scene sanitize/rehydrate: preserve validated optional `startRef/endRef`;
2. route helper logic: resolve an object reference by existing scene-object ID and optionally resolve an existing port;
3. Measure/tray UI: assign/clear Start and End from existing objects/ports and display derived labels;
4. use existing `_persistSceneToStore(...)` after an actual binding change only.

No change is authorized to route `points[]`, length calculation, BP-004 grouped totals, normal object drag or global selection authority.

### Tests
Add exactly one focused contract/regression file:

- `tests/bp-006-cable-tray-endpoint-binding.spec.js`

It must cover at minimum:
- optional `startRef/endRef` survive scene sanitize/persistence;
- object-level binding works without `portId`;
- existing port ID may be retained when supplied;
- labels/metadata are derived, not copied into route refs;
- clear Start/End works;
- binding persists only on actual change;
- route `points[]` are unchanged by binding;
- BP-002 geometry/persistence remains intact;
- BP-003 `routeClass` remains intact;
- BP-004 derived lengths/totals remain intact;
- BP-005 route-point editing remains intact.

Existing BP-002/003/004/005 regression tests remain mandatory evidence.

## Explicitly out of scope
- automatic route creation or auto-routing;
- geometric endpoint snapping;
- creating/editing a general port architecture;
- mandatory ports for legacy objects;
- cable assignment or cable-list authority;
- cabinet/terminal/EPLAN logic;
- 3D cable/tray routing;
- physical tray materialization;
- 3 m segmentation;
- BOM/material calculation;
- copied equipment metadata on routes.

## Gate result
**BP-006 Definition Documentation / Implementation Scope Reconciliation: PASS**

This document defines scope only. No implementation branch or production/test implementation is authorized by this gate.
