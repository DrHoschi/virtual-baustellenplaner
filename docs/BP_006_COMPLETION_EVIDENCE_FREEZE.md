# BP-006 – Completion / Evidence / Freeze

## Status
**FROZEN**

Functional freeze head:

`fee70f3e953165ad0a0fd57037423b196eb40b52`

Authorized base:

`a15e12304e806643e039f84ebec05cc76b1ab581`

Branch:

`feature/BP-006-cable-tray-endpoint-binding`

## Frozen contract
BP-006 adds minimal semantic endpoint/equipment binding to existing `cable-tray.route` objects.

A route may persist optional:
- `startRef: { objectId, portId? }`
- `endRef: { objectId, portId? }`

`objectId` reuses the existing scene-object identity. `portId` is optional and only reuses an already existing port identity. Legacy/object-level binding therefore does not require a port.

Display labels and equipment metadata remain derived from the referenced scene object. They are not copied into the route.

## Geometry and authority preservation
`cable-tray.route.points[]` remains the sole persistent route-geometry authority.

Endpoint binding does not:
- move route points;
- add/remove route points;
- geometrically snap endpoints;
- change route length;
- introduce a second geometry authority.

The existing scene persistence path remains authority. No new store root, adapter, schema authority or general port system was introduced.

## Implemented files
Relative to the authorized base, the functional head is linear:

- ahead: 2
- behind: 0

Only:
- `ui/panels/WorkareaPanel.base.js`
- `tests/bp-006-cable-tray-endpoint-binding.spec.js`

were changed.

## Functional evidence
The implementation provides:
- sanitize/persistence of optional `startRef/endRef`;
- object-level binding without `portId`;
- optional reuse of an existing `portId`;
- safe resolution of missing object/port references;
- derived Start/End labels;
- assign and clear controls in the existing Measure/cable-tray context;
- persistence only after an actual binding change;
- transient selected-route UI state only.

The focused BP-006 contract test covers persistence, optional ports, derived metadata, clearing, change-only persistence, geometry non-mutation and preservation of BP-002 through BP-005 authorities.

## Regression compatibility
Verification against the exact functional head confirmed:
- BP-002 route geometry/persistence remains based on `points[]`;
- BP-003 `tray.routeClass` remains unchanged;
- BP-004 route length and grouped totals remain derived;
- BP-005 route-point hit/edit authority remains present;
- normal route exclusion from legacy object drag remains unchanged.

## Exact-head CI evidence
Exact head:

`fee70f3e953165ad0a0fd57037423b196eb40b52`

GitHub Actions completed 17 workflow runs:
- 11 SUCCESS
- 6 FAILURE

The six failing workflow runs are the already-known baseline set:
- CI Checks (Syntax + Imports + Manifest + UI Wiring) — failure occurs at Smoke Tests after preceding checks pass;
- UI-MIG-05B Planning Left Area Gate;
- UI-MIG-05C Insert Sources Gate — fails on its UI-MIG-05B regression prerequisite;
- TECH-WA-FREEZE-01B.2 Heartbeat Gate;
- TECH-WA-FREEZE-01B.3 RAF Abort Gate — fails on its 01B.2 regression prerequisite;
- TECH-WA-FREEZE-01C Mobile Viewer Stability Gate — fails on its 01B.2 regression prerequisite.

No new BP-006-specific CI blocker was identified.

Verification decision:

**PASS WITH KNOWN BASELINE LIMITATIONS — 0 new blockers.**

## Explicit non-goals retained
BP-006 does not implement:
- automatic routing;
- geometric endpoint/port snapping;
- new/general port creation or editing;
- cable assignment;
- cabinet/terminal/EPLAN logic;
- 3D cable/tray routing;
- physical tray materialization;
- BOM/material calculation.

## Freeze decision
BP-006 is **FROZEN** at functional head `fee70f3e953165ad0a0fd57037423b196eb40b52`.

This completion/evidence document is documentation-only. Its commit becomes the full completion/freeze head but does not change the functional freeze SHA.

This freeze does **not** authorize integration into `main`. Integration requires a separate read-only reconciliation and a separately authorized fast-forward step.
