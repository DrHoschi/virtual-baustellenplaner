# BP-023 – Cable-Tray Fitting / Junction Authority – Definition & Scope

## Status

**DEFINED / SCOPED / NOT IMPLEMENTED**

Authoritative definition base:

`main = 4d1e6bff1c79b2ae7ff88d8d9ad8a057929d644f`

This document defines the minimal BP-023 authority and implementation boundary only.

It does not authorize implementation, does not create a feature branch, and does not modify existing product behavior.

## Practical problem

A real cable-tray route does not require a purchased fitting at every geometric corner, branch or transition.

In practical installation, tray may be cut, formed or otherwise constructed on site so that:

- a geometric corner may use no separate bend fitting;
- a branch may use no separate T-fitting;
- a transition may be constructed without a separate reducer fitting;
- coincident or touching route geometry does not by itself prove that a purchased connector is installed.

Therefore cable-tray geometry and cable-tray fitting/material intent must remain separate authorities.

BP-023 introduces the first explicit authority for manually planned cable-tray fittings/junctions without changing the existing route geometry authority.

## Existing authorities retained

### Route geometry

`cable-tray.route.points[]`

remains the sole cable-tray geometry authority.

BP-023 must not duplicate or replace route coordinates.

### Route identity

Existing `cable-tray.route.id` remains the stable route identity.

### Endpoint/equipment binding

BP-006 `startRef` / `endRef` remain semantic route-to-equipment/port bindings.

BP-023 must not reinterpret them as route-to-route junctions.

### Route material and support authorities

BP-016 through BP-022 retain their existing basic-material, accessory, support, support-material and output authority boundaries.

BP-023 does not silently extend those projections.

## Core rule: geometry never creates a fitting

**No geometric condition automatically means that a fitting exists.**

In particular:

- an inner route point is not automatically a bend fitting;
- a 90-degree corner is not automatically a bend fitting;
- two route endpoints at the same coordinate are not automatically connected by a connector;
- three routes meeting at one coordinate are not automatically a T-fitting;
- a width change or nearby routes are not automatically a reducer;
- crossing routes are not automatically connected.

A fitting exists only after explicit user planning.

The valid default state for every corner, branch, transition or route meeting is therefore:

**no separately planned fitting**

BP-023 must never require the user to add a fitting merely because the geometry contains a corner or branch.

## Minimal persistent authority

BP-023 requires a small project/scene-owned fitting/junction collection whose records reference existing cable-tray geometry instead of copying it.

Conceptual V1 record:

```js
{
  id: "tray-fitting-...",
  kind: "bend" | "tee" | "reducer" | "connector",
  connections: [
    {
      routeId: "tray-...",
      pointIndex: 1
    }
  ]
}
```

The exact implementation storage location must use the existing Workarea scene/project persistence path and must be reconciled before implementation.

BP-023 must not create a second route collection, point collection, geometry store or material catalogue.

## Fitting identity

Each planned fitting/junction has its own stable `id`.

That identity represents the user's explicit planning decision that a separate fitting exists.

Deleting that fitting record means:

**no separate fitting is planned at that location/relationship**

Deleting a fitting must not delete or reshape the referenced route geometry.

## V1 kind semantics

BP-023 V1 permits exactly these semantic kinds:

### `bend`

A separately planned bend fitting.

Expected topology:

- one existing route;
- one existing inner route point;
- that point normally has a predecessor and successor.

The route point remains geometry authority.

The fitting record states only that the user plans a separate bend fitting there.

### `tee`

A separately planned T-junction fitting.

Expected topology:

- three route arms/connections participating in one explicit junction.

BP-023 must not infer a tee merely from coincident geometry.

### `reducer`

A separately planned reducer/transition fitting.

Expected topology:

- two participating route sides/connections.

Existing route-owned width/type values remain authoritative for the routes.

BP-023 must not copy width/type merely to create another authority and must not automatically infer a reducer from differing widths.

### `connector`

A separately planned connector between two route sides/connections.

Expected topology:

- two participating route sides/connections.

Coincident endpoints alone do not create a connector.

## Connection references

A BP-023 connection references existing route geometry by identity.

Minimum V1 reference:

- `routeId`: existing `cable-tray.route.id`;
- `pointIndex`: index into the current authoritative `route.points[]`.

No `x` / `y` coordinate is persisted in the fitting connection.

The displayed fitting position is derived from the referenced current route point.

### Endpoint versus inner-point semantics

A point reference may resolve as:

- route start: `pointIndex === 0`;
- route end: `pointIndex === points.length - 1`;
- inner point: any valid point between them.

V1 does not need a second persistent `endpoint` flag if endpoint/inner-point status can be derived unambiguously from `pointIndex` and current `points[]`.

## Point-index stability limitation

The current route model has stable route IDs but does not have stable IDs for individual route points.

Therefore V1 `pointIndex` references have an explicit limitation:

- moving an existing point preserves its index and can remain valid;
- future insertion/deletion/reordering of route points could change the semantic target of an index.

BP-023 implementation must not pretend that point indexes are permanent point identities.

Adding stable point IDs or automatic reference migration is outside this definition and requires separate authorization if later needed.

## Topology validation

A fitting record must be validated from its explicit connections.

Minimum V1 expectations:

- `bend`: one route/inner-point connection;
- `tee`: three explicit connections;
- `reducer`: two explicit connections;
- `connector`: two explicit connections.

Invalid/incomplete topology must remain visibly unresolved/incomplete.

It must not be repaired by inventing routes, points or coordinates.

V1 topology validation is structural only. It does not certify manufacturer compatibility, mechanical fit, angle, load, bend radius or installation correctness.

## Manual UX contract

BP-023 is explicitly manual.

The user must be able to:

1. choose that a separate fitting is wanted;
2. choose its `kind`;
3. select the existing route point(s)/route sides participating in it;
4. save the explicit fitting;
5. edit or remove the fitting later.

The UI must also allow the normal and common state:

**corner/branch/transition exists geometrically, but no fitting is planned**

No warning should imply that every corner or branch is incomplete merely because it has no fitting.

## No automatic detection

BP-023 must not automatically create, require or silently persist fittings based on:

- angle;
- 90-degree geometry;
- route intersection;
- endpoint coincidence;
- distance/tolerance;
- width difference;
- tray type difference;
- number of nearby routes;
- cable assignment;
- start/end equipment binding.

A future optional suggestion/assistant feature may inspect geometry, but it would require a separate contract and must distinguish a suggestion from authoritative fitting state.

## Broken-reference behavior

A persisted fitting may become unresolved if:

- its referenced route no longer exists;
- `pointIndex` is no longer valid;
- its required connection count is incomplete;
- its referenced geometry changes such that the user's intended relationship can no longer be established safely.

Required behavior:

- preserve the fitting record when possible for diagnosis/recovery;
- show the broken/unresolved state explicitly;
- do not invent replacement route IDs;
- do not clamp an invalid point index to another point;
- do not silently move the fitting to the nearest coordinate;
- do not automatically delete the fitting merely because a reference is temporarily unresolved;
- exclude unresolved fittings from any later authoritative material quantity unless a separate future contract explicitly defines otherwise.

## Persistence boundary

BP-023 fitting records are persistent planning intent.

They must travel through the existing project Save → Reload path.

The implementation must not introduce a new file format, independent persistor, second project authority or duplicated geometry store.

The exact canonical storage location and sanitizer changes must be established in a separate implementation-scope reconciliation before code is authorized.

## Presentation boundary

A fitting marker/symbol may be rendered at a position derived from its referenced route point(s).

Such rendering is presentation only.

The marker must not become a second geometry authority.

For multi-route junctions, a display position may only be derived when the referenced geometry provides an unambiguous common position under the implementation contract. Otherwise the fitting must remain unresolved rather than inventing a coordinate.

## Material boundary

BP-023 V1 establishes **fitting planning identity and topology only**.

It does not yet add fitting quantities to BP-016/BP-017/BP-018/BP-022 material output.

It does not define:

- manufacturer;
- article number;
- catalogue ID;
- price;
- supplier;
- inventory;
- package quantity;
- fitting dimensions;
- fitting-specific purchase quantity;
- automatic aggregation.

A later material-projection block may count valid explicitly planned BP-023 fittings.

That later projection must consume BP-023 records; it must not rediscover fittings from route geometry.

## Existing material-output compatibility

BP-016, BP-017, BP-018 and BP-022 remain unchanged by this definition.

In particular, BP-022 **Gesamtmaterial CSV** must not gain fitting rows merely because BP-023 fitting records exist until a separate material-output extension is authorized.

## Support-system boundary

BP-019, BP-020 and BP-021 support spacing, support type and support-material composition remain independent.

A fitting does not automatically create, remove or alter supports.

Any future support rule near bends, tees, reducers or connectors requires a separate technical contract.

## Cable-routing boundary

BP-008 and later cable-to-route traversal remain independent.

A fitting/junction may later become useful for route-network traversal, but BP-023 V1 does not:

- auto-route cables through junctions;
- alter `cableLine.routeRefs[]`;
- alter route traversal direction;
- infer cable continuity;
- calculate cable length through fittings.

## Explicit non-scope

BP-023 V1 does not implement:

- automatic fitting recognition;
- automatic fitting suggestions;
- automatic creation at every corner;
- mandatory fitting at every branch;
- automatic bend-angle classification;
- bend radius;
- physical fitting dimensions;
- manufacturer/article catalogue;
- material output/counting;
- prices/suppliers/inventory;
- fitting BOM;
- automatic support changes;
- support positions near fittings;
- load/structural calculation;
- route point insertion/deletion;
- stable route-point IDs;
- automatic migration of point references;
- route splitting;
- route merging;
- automatic route-to-route snapping;
- geometric endpoint snapping;
- general graph/network routing;
- cable auto-routing;
- 3D fitting geometry/materialization;
- EPLAN coupling.

## Required implementation-scope reconciliation before implementation

Before any BP-023 implementation is authorized, a separate read-only reconciliation must determine:

1. the smallest canonical persistence location for fitting records within the existing project/scene authority;
2. the exact sanitizer/rehydration surface required for Save → Reload;
3. how the existing Measure/tray interaction can select route points for fitting connections without conflicting with BP-005 point dragging;
4. how incomplete/broken references are represented in UI;
5. how multi-route connections are selected manually without introducing automatic geometric inference;
6. whether V1 can safely use `pointIndex` under the current editing capabilities or needs a narrower interaction restriction;
7. the focused regression-test surface required to protect BP-002 through BP-022 authority boundaries.

## Gate result

**BP-023 – Fitting / Junction Definition & Scope: DEFINED**

The central contract is:

**Geometry describes where the tray runs. A BP-023 fitting record exists only when the user explicitly decides that a separate fitting is used.**

No implementation or feature branch is authorized by this document.
