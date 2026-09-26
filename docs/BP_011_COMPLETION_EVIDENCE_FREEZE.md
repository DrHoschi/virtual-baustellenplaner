# BP-011 – Completion / Evidence / Freeze

Functional freeze head: `cc9ee1847677dbea099eacaf35553152dcc783a6`

Baseline / authorization head: `0e35b01ce2a594e82d64c73e87509cbd44a98dfc`

Status: **FROZEN WITH KNOWN BASELINE LIMITATIONS**

## Completed scope

BP-011 implements only the authorized practical source / target world-space minimum:

- resolve CableLine source and target only through their explicit `sourceCablePointId` / `targetCablePointId`,
- require the referenced CablePoint to resolve to an existing component of the same `assembly.instance`,
- derive a runtime-only 2D Workarea position from the existing assembly translation/rotation plus the component-local origin,
- label that derived endpoint authority explicitly as `component-origin`,
- derive source-to-first-tray and last-tray-to-target direct 2D distances only when both endpoint authorities are resolvable,
- terminate the source-side diagnostic at the BP-010 first-route entry and originate the target-side diagnostic at the BP-010 last-route exit,
- expose unresolved source/target geometry as `unbestimmt` rather than inventing geometry,
- expose resolved direct distances explicitly as direct `Component-Origin` geometry.

Production scope remained limited to:

- `ui/panels/WorkareaPanel.base.js`

Focused test scope:

- `tests/bp-011-cable-source-target-world-space.spec.js`

## Authority contract preserved

The authoritative 2D transform used by BP-011 is derived at runtime from:

- Workarea assembly origin: `assembly.instance.x` / `assembly.instance.y`,
- Workarea assembly rotation: `assembly.instance.rotDeg`,
- assembly-local component origin: `component.x` / `component.y`.

For assembly angle θ, the derived Workarea position follows the existing translate/rotate semantics:

```
worldX = assemblyX + localX * cos(θ) - localY * sin(θ)
worldY = assemblyY + localX * sin(θ) + localY * cos(θ)
```

No persistent `worldX` / `worldY` authority is introduced.

BP-011 does not change these existing authorities:

- `cableLine.sourceCablePointId` / `targetCablePointId` remain the semantic CableLine endpoint references.
- `cable-tray.route.points[]` remains the sole tray-route geometry authority.
- BP-008 `cableLine.routeRefs[]` remains the ordered tray-route assignment.
- BP-010 `cableLine.routeDirections` remains the cable-owned route traversal authority.
- BP-010 entry/exit derivation remains the authority for first-route entry and last-route exit.
- `cableLine.lengthM` remains the independent manual cable-length authority.
- BP-006 `startRef` / `endRef` remain unchanged semantic route endpoint/equipment bindings.
- BP-009 known tray-path minimum remains independent of BP-011 source/target diagnostics.

## Component-Origin limitation

Current normalized port/CablePoint geometry does not contain an independent physical connector offset. Existing CablePoints inherit component geometry, so BP-011 can safely derive the component origin in Workarea coordinates, but not the exact physical port/connector position.

Therefore:

- `component-origin` is the explicit BP-011 geometry authority,
- it must not be presented as an exact physical connector point,
- the displayed direct source/target distances are 2D geometric diagnostics,
- those distances are not automatically promoted to physical cable-route length,
- they do not modify `cableLine.lengthM`,
- they do not modify BP-009 `knownMinimumTrayPathM`.

BP-011 does not calculate or invent:

- physical port offsets,
- 3D/Z connection geometry,
- vertical drops,
- routed bends between component and tray,
- nearest-tray snapping,
- automatic routing,
- connection reserve,
- installation reserve,
- automatic CableLine length.

## Runtime-only derived state

BP-011 adds runtime-derived assignment information only:

- `sourceWorld`,
- `targetWorld`,
- `sourceDirectDistanceM`,
- `targetDirectDistanceM`,
- `sourceTargetAuthority`.

These values are not persisted onto CableLine.

The direct distance is Euclidean 2D Workarea distance converted from millimetres to metres. Missing endpoint authority, missing route endpoint authority, invalid transforms or unresolved CablePoints remain unresolved rather than receiving a fallback coordinate or distance.

## Exact-head diff evidence

Against baseline / authorization head `0e35b01ce2a594e82d64c73e87509cbd44a98dfc`, functional head `cc9ee1847677dbea099eacaf35553152dcc783a6` is:

- ahead: 2 commits,
- behind: 0,
- merge base: exact baseline,
- changed production files: exactly one,
- added focused tests: exactly one.

Diff files:

- `ui/panels/WorkareaPanel.base.js`: +76 / -6
- `tests/bp-011-cable-source-target-world-space.spec.js`: +63 / -0

Functional implementation commit:

- `d08d8ee5bcfc88aef5a3b3ba733aee1b686cb85c` — BP-011 implement source target world-space derivation

Focused contract-test commit:

- `cc9ee1847677dbea099eacaf35553152dcc783a6` — BP-011 add source target world-space contract test

## Exact-head CI evidence

GitHub Actions for exact `head_sha=cc9ee1847677dbea099eacaf35553152dcc783a6` completed 16/16 workflow runs.

Result:

- 10 successful,
- 6 failed,
- 0 newly identified BP-011-specific workflow blockers.

The six failures were compared directly with workflow runs and job logs for exact baseline `0e35b01ce2a594e82d64c73e87509cbd44a98dfc`. The same workflows fail there with the same failure signatures:

1. CI Checks (Syntax + Imports + Manifest + UI Wiring) → Smoke Tests
   - `Failed to load resource: the server responded with a status of 404 (Not Found)`.
2. UI-MIG-05B Planning Left Area Gate
   - timeout waiting for hidden; expected hidden, received visible.
3. UI-MIG-05C Insert Sources Gate
   - same UI-MIG-05B regression signature.
4. TECH-WA-FREEZE-01B.2 Heartbeat Gate
   - `locator.click` 60000 ms timeout.
5. TECH-WA-FREEZE-01B.3 RAF Abort Gate
   - same TECH-WA-FREEZE-01B.2 regression signature.
6. TECH-WA-FREEZE-01C Mobile Viewer Stability Gate
   - same TECH-WA-FREEZE-01B.2 regression signature.

Successful exact-head evidence includes Syntax Check, Import Graph, Navigation Foundation, Manifest Integrity, UI Wiring and the other successful repository gates.

These six failures are therefore carried as known baseline limitations and are not attributed to BP-011 by this gate.

## Focused BP-011 test evidence limitation

`tests/bp-011-cable-source-target-world-space.spec.js` exists at the exact functional head and statically covers the BP-011 authority boundaries, including:

- runtime-only CablePoint world-position derivation,
- required `assembly.instance` authority,
- CablePoint-to-component resolution,
- translation/rotation world transform,
- explicit `component-origin` authority,
- explicit CablePoint-ID source/target resolution,
- unresolved endpoints remaining unresolved,
- direct 2D distance conversion from millimetres to metres,
- source distance terminating at BP-010 first-route entry,
- target distance originating at BP-010 last-route exit,
- no persistence of BP-011 derived world-space data,
- manual `cableLine.lengthM` authority preservation,
- BP-006 / BP-008 / BP-010 authority preservation.

The current CI workflow does **not independently demonstrate execution of this new focused BP-011 test file as its own test step**.

Therefore this gate does not claim an executed focused-test PASS. Its presence and assertions are evidence; independent execution remains unevidenced by the current workflow output.

## Freeze decision

**BP-011 functional state `cc9ee1847677dbea099eacaf35553152dcc783a6` is FROZEN WITH KNOWN BASELINE LIMITATIONS.**

The functional freeze is exactly `cc9ee1847677dbea099eacaf35553152dcc783a6`.

This completion document creates a later documentation-only freeze head. That documentation head does not replace the functional freeze identity.

No integration to `main` is authorized by this gate.
