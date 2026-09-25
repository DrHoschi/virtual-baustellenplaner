# BP-003 – Completion / Evidence / Freeze

Status: FROZEN  
Frozen functional head: `22610ad4c393e567f3ba8f28bd420d7b8cdc4d6e`  
Base: `main = 2ebefde8e81c69dee0eab8c9c583f04b1c280762`  
Branch: `feature/BP-003-cable-tray-classification`

## Scope

BP-003 extends the existing BP-002 `cable-tray.route` contract with practical route classification while preserving the same Workarea scene authority.

Delivered:
- `tray.routeClass = "new" | "existing"`,
- Measure-mode choice between Neu and Bestand/Brücke,
- legacy/default normalization to `new`,
- persistence and rehydration of `routeClass`,
- derived presentation: new routes red, existing routes green,
- derived totals for new/existing × 100/200 mm,
- BP-003 contract regression coverage.

Explicitly excluded: EPLAN/cableLines coupling, cable occupancy, chamber/separator modelling, bend radii, fill percentage, optimization, automatic routing, 3D routing, and post-creation route editing.

## Data authority and BP-002 compatibility

Canonical route state remains exclusively inside:

`app.project.workspace.scene.objects[]`

BP-003 does not introduce a second scene, route, length, or totals authority. Existing BP-002 fields remain authoritative and unchanged:
- `points[]` for geometry,
- `tray.widthMm` for width,
- `tray.trayType` for tray type.

BP-003 adds only `tray.routeClass`. Missing or unknown legacy values normalize to `new`, preserving BP-002 routes created before BP-003.

Lengths and all class/width totals remain derived state and are not persisted as a second authority.

## Functional implementation evidence

Functional head `22610ad4c393e567f3ba8f28bd420d7b8cdc4d6e` is linear from the frozen BP-002 main base and is 2 commits ahead / 0 behind.

Changed files are limited to:
- `ui/panels/WorkareaPanel.base.js`
- `tests/bp-003-cable-tray-classification.spec.js`

No EPLAN, cableLines, 3D, R2F, or R2F-05 implementation was introduced.

## Exact-head CI evidence

Draft PR #5 was created only to trigger Exact-Head CI for `22610ad4…`. It is not merge authorization.

Exact-head result:
- 12 workflows PASS
- 7 workflows FAIL

The seven failures match the known baseline limitation set already present at the BP-002 freeze:
1. CI Checks (Syntax + Imports + Manifest + UI Wiring)
2. UI-MIG-05B Planning Left Area Gate
3. UI-MIG-05C Insert Sources Gate
4. TECH-WA-FREEZE-01B.2 Heartbeat Gate
5. TECH-WA-FREEZE-01B.3 RAF Abort Gate
6. TECH-WA-FREEZE-01C Mobile Viewer Stability Gate
7. PROJECT-UI-04A Existing Project Hall Creation Entry

No additional BP-003-specific workflow failure appeared.

## Verification decision

Read-only implementation verification confirmed:
- definition and implementation agree,
- scope is limited to the authorized classification extension,
- BP-002 route persistence and existing route compatibility are preserved,
- routeClass persists and rehydrates within the existing route object,
- legacy BP-002 routes default safely to `new`,
- class/width totals remain derived,
- presentation is derived from routeClass,
- no new data authority was introduced,
- no BP-003-specific CI blocker was identified.

## Freeze decision

`PASS WITH BASELINE LIMITATIONS / 0 BP-003 BLOCKER / FROZEN`

BP-003 is frozen at functional head `22610ad4c393e567f3ba8f28bd420d7b8cdc4d6e`.

This completion document is freeze evidence only and must not be treated as a new functional implementation head.

No integration into `main` is authorized by this freeze. Integration requires a separate read-only integration reconciliation followed by separately authorized integration.
