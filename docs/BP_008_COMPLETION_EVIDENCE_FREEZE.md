# BP-008 – Completion / Evidence / Freeze

Status: **FROZEN WITH KNOWN BASELINE LIMITATIONS**

## Authoritative commits

- Definition / scope base: `a3c3d8d348b69fc2d84b51d7b8bcd6bc04bb9404`
- Product implementation: `da41f39fc58cfb3e46dc8669d1079b88637c1903`
- Functional / verified freeze target: `5ce5047fc650c6919a17f2897f7b52fbe83a19e7`
- Feature branch: `feature/BP-008-cable-route-assignment`

This document is evidence-only. It does not change the verified BP-008 product or test implementation.

## Completed scope

BP-008 adds a minimal structured relationship from an existing AssemblyLab CableLine to existing practical cable-tray routes.

Persistent CableLine addition:

```js
routeRefs: ["tray-...", "tray-...", ...]
```

The references are normalized as an ordered set of non-empty route IDs.

The existing CableLine properties UI can assign and remove existing `cable-tray.route` objects. Multiple CableLines may reference the same tray route.

A tray-path length may be displayed as runtime-derived information from the currently referenced route geometry.

## Frozen authority contract

The following authority boundaries are part of the BP-008 freeze:

1. `assembly.instance.cableLines[]` remains the cable authority.
2. `cableLine.routeRefs[]` stores only ordered `cable-tray.route.id` references.
3. `cable-tray.route.points[]` remains the sole tray geometry authority.
4. BP-006 `cable-tray.route.startRef/endRef` remain route-owned endpoint/equipment bindings.
5. `cableLine.sourceCablePointId/targetCablePointId` and related CableLine source/target data remain CableLine/AssemblyLab authority.
6. Existing `cableLine.route` remains independent manual/legacy free text.
7. Existing `cableLine.lengthM` remains independent manual cable length and is never overwritten from tray geometry.
8. Tray-path length is derived state only.
9. BP-007 material requirement remains based on the existing tray-route authority and is not changed by cable assignment.
10. No second cable collection, route geometry authority, endpoint authority, BOM authority or global cable registry is introduced.

## Exact-head diff evidence

Verification compared definition/scope base

`a3c3d8d348b69fc2d84b51d7b8bcd6bc04bb9404`

against exact functional head

`5ce5047fc650c6919a17f2897f7b52fbe83a19e7`.

Result:

- comparison: ahead
- ahead: 2
- behind: 0
- merge base: exactly `a3c3d8d348b69fc2d84b51d7b8bcd6bc04bb9404`
- changed files: exactly 2

Files:

- `ui/panels/WorkareaPanel.base.js`: modified, +101 / -0
- `tests/bp-008-cable-route-assignment.spec.js`: added, +59 / -0

No other production, persistence-root, assembly connection, BOM, EPLAN, asset, CSS or configuration file is part of the BP-008 functional diff.

## Focused verification contract

The single focused BP-008 test file is:

`tests/bp-008-cable-route-assignment.spec.js`

It covers the frozen contract that:

- CableLines remain cable authority;
- ordered unique `routeRefs[]` survive CableLine regeneration/persistence structure;
- references resolve against existing `cable-tray.route` objects;
- tray-path length remains derived;
- manual `lengthM` remains independent;
- manual free-text `route` remains independent;
- BP-006 endpoint refs and tray `points[]` remain separate authorities;
- existing BP-007 material derivation remains present;
- missing references are diagnostic rather than replacement route data;
- shared tray-route use by multiple CableLines is permitted.

## Exact-head CI evidence

Exact SHA:

`5ce5047fc650c6919a17f2897f7b52fbe83a19e7`

GitHub Actions returned **16 completed runs**:

- **10 SUCCESS**
- **6 FAILURE**
- **0 incomplete**

Successful gates included Syntax Check and the currently green UI/Workarea migration gates.

The six failures are the already known repository baseline group:

1. **CI Checks (Syntax + Imports + Manifest + UI Wiring)**
   - failing step: `Smoke Tests`
2. **UI-MIG-05B Planning Left Area Gate**
   - failing step: `UI-MIG-05B Planning Left Area Acceptance`
3. **UI-MIG-05C Insert Sources Gate**
   - failing step: `UI-MIG-05B Regression`
4. **TECH-WA-FREEZE-01C Mobile Viewer Stability Gate**
   - failing step: `TECH-WA-FREEZE-01B.2 Regression`
5. **TECH-WA-FREEZE-01B.3 RAF Abort Gate**
   - failing step: `TECH-WA-FREEZE-01B.2 Regression`
6. **TECH-WA-FREEZE-01B.2 Heartbeat Gate**
   - failing step: `TECH-WA-FREEZE-01B.2 Heartbeat Acceptance`

No new BP-008-specific CI blocker was identified during the Implementation Verification / Scope / Regression Gate.

## Known limitations

The six baseline CI failures above remain repository limitations and are not reclassified or repaired by BP-008.

BP-008 intentionally does not provide:

- automatic cable routing;
- automatic cable-length calculation;
- cable reserve/drop/connection allowances;
- fill percentage or tray capacity;
- cable bundle calculations;
- automatic synchronization between CableLine source/target and BP-006 route endpoints;
- EPLAN routing;
- 3D cable paths;
- cable/tray materialization;
- BOM integration.

## Freeze decision

The functional implementation at

`5ce5047fc650c6919a17f2897f7b52fbe83a19e7`

is accepted as the **BP-008 functional freeze**.

Gate result:

**PASS WITH KNOWN BASELINE LIMITATIONS**

The commit containing this evidence document is the **full BP-008 freeze head**. Integration to `main` is explicitly not part of this gate.
