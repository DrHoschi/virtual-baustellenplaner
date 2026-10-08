# BP-010 – Completion / Evidence / Freeze

Functional freeze head: `97f378417fdc19520c5e367642d07f1ba125bb82`

Baseline / authorization head: `2596ba94f13b0e0960b4f55821ab229184fcb48d`

Status: **FROZEN WITH KNOWN BASELINE LIMITATIONS**

## Completed scope

BP-010 implements only the authorized practical cable-route continuity / transition minimum:

- keep ordered `cableLine.routeRefs[]` as the cable-to-tray sequence authority,
- add cable-owned traversal direction per assigned route as `forward` or `reverse`,
- preserve legacy assignments without inventing a default traversal direction,
- derive route entry/exit endpoints only from the existing `cable-tray.route.points[]` geometry plus explicit cable-owned direction,
- classify an adjacent transition as `continuous` only when the derived exit and entry coordinates are exactly equal,
- assign authoritative transition length `0` only to such geometrically closed transitions,
- keep unresolved/open transitions `undetermined` with no invented physical cable length,
- keep source-to-first-route and last-route-to-target connection portions outside BP-010 authority.

Production scope remained limited to:

- `ui/panels/WorkareaPanel.base.js`

Focused test scope:

- `tests/bp-010-cable-route-continuity.spec.js`

## Authority contract preserved

BP-010 does not change these existing authorities:

- `cableLine.routeRefs[]` remains the ordered route assignment.
- `cable-tray.route.points[]` remains the sole tray-route geometry authority.
- `cableLine.lengthM` remains the independent manual cable-length authority.
- BP-006 `startRef` / `endRef` remain semantic route endpoint/equipment bindings.
- BP-009 `knownMinimumTrayPathM` remains the runtime-derived sum of referenced tray-route geometry.

BP-010 does not establish CablePoint/port coordinates as Workarea world-space authority.

It does not calculate or invent:

- source-to-first-tray distance,
- last-tray-to-target distance,
- physical distance for an open inter-route gap,
- automatic traversal direction,
- geometric port snapping,
- vertical drops,
- connection or installation reserve,
- automatic `cableLine.lengthM` changes.

No route `points[]` are changed as a direction or continuity side effect.

## Minimal persistence contract

Traversal direction belongs to the CableLine, not globally to a tray route.

The persistent information is conceptually:

```js
routeDirections: {
  "tray-A": "forward",
  "tray-B": "reverse"
}
```

Only explicit `forward` / `reverse` values for currently assigned route IDs survive normalization. Removing a route assignment prunes its stale direction metadata. Reordering `routeRefs[]` preserves direction by route ID.

A legacy CableLine with `routeRefs[]` but without direction metadata remains valid and direction-undetermined until the user explicitly selects a direction.

## Exact-head diff evidence

Against baseline / authorization head `2596ba94f13b0e0960b4f55821ab229184fcb48d`, functional head `97f378417fdc19520c5e367642d07f1ba125bb82` is:

- ahead: 2 commits,
- behind: 0,
- merge base: exact baseline,
- changed production files: exactly one,
- added focused tests: exactly one.

Diff files:

- `ui/panels/WorkareaPanel.base.js`: +103 / -1
- `tests/bp-010-cable-route-continuity.spec.js`: +41 / -0

## Exact-head CI evidence

GitHub Actions for exact `head_sha=97f378417fdc19520c5e367642d07f1ba125bb82` completed 16/16 workflow runs.

Result:

- 10 successful,
- 6 failed,
- 0 newly identified BP-010-specific workflow blockers.

The six failures were compared directly with workflow runs and job logs for exact baseline `2596ba94f13b0e0960b4f55821ab229184fcb48d`. The same workflows fail there with the same failure signatures:

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

Successful exact-head evidence includes Syntax Check, Import Graph, Navigation Foundation, Manifest Integrity, boot smoke, UI wiring and the other successful repository gates.

These six failures are therefore carried as known baseline limitations and are not attributed to BP-010 by this gate.

## Focused BP-010 test evidence limitation

`tests/bp-010-cable-route-continuity.spec.js` exists at the exact functional head and statically covers the BP-010 authority boundaries, including:

- explicit cable-owned forward/reverse direction,
- no invented legacy default direction,
- CableLine regeneration/persistence seam,
- pruning direction metadata to assigned route IDs,
- entry/exit derivation from route geometry,
- automatic 0 m only for exactly closed transitions,
- unresolved transitions remaining undetermined,
- source/target portions remaining outside BP-010 authority,
- BP-009 known-minimum and manual-length authority preservation.

The current CI workflow does **not independently demonstrate execution of this new focused BP-010 test file as its own test step**.

Therefore this gate does not claim an executed focused-test PASS. Its presence and assertions are evidence; independent execution remains unevidenced by the current workflow output.

## Freeze decision

**BP-010 functional state `97f378417fdc19520c5e367642d07f1ba125bb82` is FROZEN WITH KNOWN BASELINE LIMITATIONS.**

The functional freeze is exactly `97f378417fdc19520c5e367642d07f1ba125bb82`.

This completion document creates a later documentation-only freeze head. That documentation head does not replace the functional freeze identity.

No integration to `main` is authorized by this gate.
