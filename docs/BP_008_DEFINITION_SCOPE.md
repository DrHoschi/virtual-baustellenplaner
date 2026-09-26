# BP-008 – Practical Cable Assignment / Definition & Scope

Status: **DEFINED / SCOPED / NOT IMPLEMENTED**

Authoritative reconciliation base:

`afb77a6e2c9ded8c7297250ffd1c1800f1846ccf`

## Purpose

BP-008 connects the already persisted practical cable list to the already persisted practical cable-tray routes without creating another cable model, route geometry authority, or endpoint authority.

## Existing authorities

### Cable authority

Existing `assembly.instance.cableLines[]` remains the cable authority.

A CableLine already owns its stable `id` and existing cable data, including source/target CablePoint references, cable number/type, wires, cross section, manual `lengthM`, free-text `route`, status, comments and EPLAN/BMK fields.

`cableList` remains legacy/fallback only. BP-008 does not introduce a new cable collection.

### Cable-tray route authority

Existing `cable-tray.route` scene objects remain the route authority.

- `route.id` is the stable route identity.
- `route.points[]` remains the sole route geometry authority.
- route length remains derived from `points[]`.
- `tray.widthMm`, `tray.trayType` and `tray.routeClass` remain route-owned.
- BP-006 `startRef` / `endRef` remain route-owned endpoint/equipment bindings.

BP-008 must not copy any of those route-owned values into a CableLine.

## BP-008 persistent contract

An existing CableLine may optionally persist:

```js
routeRefs: ["tray-...", "tray-...", ...]
```

Rules:

1. Each entry is only an existing `cable-tray.route.id`.
2. Order is significant and represents the intended sequence of tray-route sections used by the cable.
3. Duplicate route IDs are not meaningful and should be removed during normalization.
4. Missing/deleted route IDs may be retained as references for diagnostic display, but they do not create replacement route data.
5. Multiple CableLines may reference the same route ID.
6. No route geometry, length, width, class, name, endpoint or copied equipment metadata is stored in `routeRefs`.

## Existing free-text route field

Existing `cableLine.route` remains unchanged as legacy/manual free text.

BP-008 must not automatically overwrite, derive or delete it when `routeRefs` changes.

`routeRefs[]` is the structured route assignment. `route` remains independent manual text for backward compatibility.

## Cable length authority

Existing `cableLine.lengthM` remains independent/manual cable data.

BP-008 must not overwrite `lengthM` from route geometry.

Any later displayed tray-path length must be derived at runtime from the currently referenced routes and must be clearly separate from the persisted manual cable length.

BP-008 does not define cable reserve, vertical drops, connection allowance, or automatic cable-length calculation.

## Endpoint authority

BP-006 `cable-tray.route.startRef/endRef` remain route endpoint/equipment bindings.

CableLine source/target fields and CablePoint references remain CableLine/AssemblyLab authority.

BP-008 does not synchronize or duplicate those authorities.

## Minimal implementation scope reconciliation

The existing code shows that the smallest productive implementation can remain in:

- `ui/panels/WorkareaPanel.base.js`

Required responsibilities:

1. **CableLine preservation / normalization**
   - extend `_makeAssemblyCableLineCandidateV1(...)` so an existing CableLine's optional `routeRefs[]` survives CableLine regeneration;
   - normalize it to an ordered array of non-empty unique route IDs;
   - do not change existing CableLine ID/signature logic.

2. **Persistence**
   - no new scene/store root or schema authority is required;
   - `assembly.instance.cableLines` is already included in the Workarea scene persistence `keepKeys` and cloned as JSON;
   - therefore the nested `routeRefs[]` travels through the existing CableLine persistence path.
   - no cable-tray sanitizer change is required because the reference is CableLine-owned, not route-owned.

3. **Route resolution**
   - resolve `routeRefs[]` against existing scene objects where `type === "cable-tray.route"`;
   - route identity comes from existing scene-object `id`;
   - labels/width/class/derived length must be read from the current route at render/evaluation time, never copied into the CableLine.

4. **Minimal assignment UI**
   - extend the existing Assembly CableLine properties area near the current manual `Trasse / Bereich` field;
   - allow assigning/removing existing cable-tray routes to/from the current CableLine;
   - preserve assignment order;
   - keep the existing manual `route` input visible and independent;
   - keep the existing manual `lengthM` input unchanged;
   - persist only after an actual `routeRefs[]` change through the existing scene persistence path.

5. **Derived display**
   - a compact derived tray-path summary may show referenced route sections and their current total geometric length;
   - such a value is runtime-derived only and must not be written to `cableLine.lengthM`.

## Explicitly out of scope

BP-008 does **not** implement:

- a new cable entity or global cable registry;
- replacement of `cableLines[]`;
- migration of `cableList`;
- automatic source/target wiring;
- synchronization with BP-006 start/end bindings;
- automatic route finding;
- automatic cable length;
- reserve/drop/connection allowances;
- cable occupancy or fill percentage;
- route capacity;
- tray width recommendations;
- cable bundles;
- EPLAN routing logic;
- 3D cable routing;
- physical tray/cable materialization;
- BOM changes;
- modification of `cable-tray.route.points[]`;
- modification of BP-002 through BP-007 authority contracts.

## Expected focused verification scope

A later implementation should add exactly one focused BP-008 contract test, expected as:

`tests/bp-008-cable-route-assignment.spec.js`

It should verify at minimum:

- existing CableLine is still the cable authority;
- ordered unique `routeRefs[]` survives CableLine regeneration and scene Save → Reload;
- references resolve only to existing `cable-tray.route` objects;
- multiple cables may share a route;
- route `points[]`, BP-006 `startRef/endRef`, route classification and BP-007 material derivation remain untouched;
- manual `cableLine.route` remains independent;
- manual `cableLine.lengthM` is not overwritten;
- no second cable collection or route geometry authority is introduced.

## Reconciliation result

**PASS**

The existing Workarea persistence already carries nested CableLine data through `assembly.instance.cableLines`. No store-root, adapter, route-schema, Assembly connection module, BOM module, EPLAN module or global registry change is required for the minimal BP-008 implementation.
