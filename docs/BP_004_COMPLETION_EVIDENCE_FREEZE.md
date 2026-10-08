# BP-004 – Completion / Evidence / Freeze

Status: FROZEN  
Frozen functional head: `719ab65b95a86ad2cc2e8bd7899062135ad7b82b`  
Base: `main = 47e95d86ae258951abac4e0c4bc75e3beb745863`  
Branch: `feature/BP-004-practical-cable-tray-evaluation`

## Scope

BP-004 adds a practical cable-tray evaluation on top of the existing BP-002/BP-003 `cable-tray.route` authority.

Delivered:
- derived per-route evaluation from existing scene routes,
- route rows with name, route class, width and geometrically derived length,
- derived totals for Neu/Bestand × 100/200 mm,
- an Auswertung action inside the existing Measure/cable-tray context,
- BP-004 contract coverage,
- minimal BP-003 regression-test compatibility correction after the totals helper was refactored without changing semantics.

Explicitly excluded: new planning mode, new route model, persisted length/totals/material sums, BOM/article numbers, cable assignment, fill percentage, bend radius, automatic sizing/routing, EPLAN coupling, 3D routing, and changes to BP-002 geometry or BP-003 classification semantics.

## Data authority and BP-002/BP-003 compatibility

Canonical route state remains exclusively inside:

`app.project.workspace.scene.objects[]`

BP-004 introduces no second route, length, totals, or material authority. Existing fields remain authoritative:
- `points[]` for geometry,
- `tray.widthMm` for width,
- `tray.trayType` for tray type,
- `tray.routeClass = "new" | "existing"` for BP-003 classification.

`lengthM`, route rows and all four class/width totals are derived at runtime and are not persisted.

`_getCableTrayGroupedTotals()` delegates to the same BP-004 evaluation result, avoiding duplicate totals authority.

## Functional implementation evidence

Functional head `719ab65b95a86ad2cc2e8bd7899062135ad7b82b` is linear from the frozen BP-003 main base and is 3 commits ahead / 0 behind.

Compared with `47e95d86ae258951abac4e0c4bc75e3beb745863`, changed files are limited to:
- `ui/panels/WorkareaPanel.base.js`
- `tests/bp-004-cable-tray-evaluation.spec.js`
- `tests/bp-003-cable-tray-classification.spec.js` (one authorized compatibility expectation only)

No persistence/store, registry, Planning adapter, new mode, EPLAN, cableLines, 3D, or R2F implementation was introduced.

## Exact-head CI evidence

Exact-head GitHub Actions for `719ab65b95a86ad2cc2e8bd7899062135ad7b82b` completed with 17 workflow runs:
- 11 PASS
- 6 FAIL

Passing workflows include Syntax Check (JS), UI-MIG-04A/04B, UI-MIG-05A/05D/05E/05F/05G, TECH-WA-FREEZE-01A, TECH-WA-FREEZE-01B.1, and Pages build/deployment.

The six failing workflows are:
1. UI-MIG-05B Planning Left Area Gate
2. UI-MIG-05C Insert Sources Gate
3. CI Checks (Syntax + Imports + Manifest + UI Wiring)
4. TECH-WA-FREEZE-01C Mobile Viewer Stability Gate
5. TECH-WA-FREEZE-01B.2 Heartbeat Gate
6. TECH-WA-FREEZE-01B.3 RAF Abort Gate

These failures are within the previously documented baseline limitation set. No additional BP-004-specific workflow failure appeared.

## Verification decision

Read-only implementation verification confirmed:
- definition and implementation agree,
- scope remains within the authorized practical evaluation extension,
- BP-002 route geometry/persistence authority is preserved,
- BP-003 new/existing classification semantics are preserved,
- the initially stale BP-003 source-contract expectation was corrected without product-code change,
- individual route lengths and grouped totals remain derived,
- no new persisted evaluation authority was introduced,
- no BP-004-specific CI blocker was identified.

## Freeze decision

`PASS WITH BASELINE LIMITATIONS / 0 BP-004 BLOCKER / FROZEN`

BP-004 is frozen at functional head `719ab65b95a86ad2cc2e8bd7899062135ad7b82b`.

This completion document is freeze evidence only and must not be treated as a new functional implementation head.

No integration into `main` is authorized by this freeze. Integration requires a separate read-only integration reconciliation followed by separately authorized integration.
