# BP-005 – Completion / Evidence / Freeze

## Status
**FROZEN**

Functional freeze head:

`13ab2812e5612618cb02199c174951657d119443`

Authorized base:

`c2efb2d2afb21cdcecd15c86eb2fcea661aade7f`

Branch:

`feature/BP-005-existing-cable-tray-route-point-editing`

## Completed capability
BP-005 adds correction of existing 2D cable-tray geometry by moving an existing point of an existing `cable-tray.route` in the Measure / cable-tray context.

The implementation preserves `cable-tray.route.points[]` as the sole persistent geometry authority.

Implemented behavior:
- existing route points can be hit in Measure mode;
- dragging edits only the selected existing point;
- existing world-coordinate conversion and snap behavior are reused;
- moving point 0 synchronizes `route.x/y`;
- edit state remains transient;
- an actual dirty point drag persists through the existing scene persistence path;
- drag completion does not append a new route point;
- Measure mode renders editable point handles derived directly from `points[]`.

## Scope evidence
Diff from authorized base to functional freeze head is linear:
- ahead: 2 commits
- behind: 0

Changed files only:
- `ui/panels/WorkareaPanel.base.js`
- `tests/bp-005-cable-tray-point-editing.spec.js`

No persistence/store/schema, Planning adapter, asset, 3D, BOM or EPLAN implementation was added.

Legacy Select/object drag remains separate; `cable-tray.route` remains excluded from the normal object hit-test path.

BP-002 route geometry authority, BP-003 classification and BP-004 derived evaluation remain compatible. No second geometry authority and no persistent derived length/totals were introduced.

## Verification evidence
Implementation Verification / Scope / Regression Gate for exact head `13ab2812e5612618cb02199c174951657d119443`:

**PASS WITH KNOWN BASELINE LIMITATIONS**

Exact-head GitHub Actions:
- total runs: 16
- success: 10
- failure: 6
- new BP-005-specific blocker: 0

Successful gates include the standalone JavaScript Syntax Check and the unaffected planning/project gates.

Known baseline failures:
1. UI-MIG-05B Planning Left Area Gate
2. UI-MIG-05C Insert Sources Gate
3. CI Checks (Syntax + Imports + Manifest + UI Wiring)
4. TECH-WA-FREEZE-01B.2 Heartbeat Gate
5. TECH-WA-FREEZE-01B.3 RAF Abort Gate
6. TECH-WA-FREEZE-01C Mobile Viewer Stability Gate

These six failures match the previously documented baseline limitations and do not constitute a new BP-005 regression.

## Regression contract
The following remain required after freeze:
- BP-002: route geometry and Save/Reload authority remain `points[]`;
- BP-003: `tray.routeClass` semantics remain unchanged;
- BP-004: lengths and grouped totals remain Derived State from route geometry;
- normal asset/assembly Select drag remains unchanged;
- pan, pinch and stabilized mobile interaction paths remain outside BP-005 scope.

## Explicit non-goals retained
BP-005 does not include whole-route movement, adding/deleting completed-route points, completed-route width/class editing, equipment/start-target binding, ports, cable assignment, 3D routing, physical tray materialization, 3 m segmentation/BOM, article numbers or EPLAN integration.

## Freeze decision
BP-005 is complete within its authorized Minimal Scope.

Functional implementation is frozen at:

`13ab2812e5612618cb02199c174951657d119443`

This completion document may create a later documentation-only freeze head. It does not change the functional freeze SHA.

No integration to `main` is authorized by this freeze.
