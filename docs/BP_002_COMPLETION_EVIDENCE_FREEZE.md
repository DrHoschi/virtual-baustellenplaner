# BP-002 – Completion / Evidence / Freeze

Status: FROZEN  
Frozen functional head: `add79f241a50928413852c727012215025908065`  
Base: `main = b854551762a8810a955a9b6d0bc7185eb160f441`  
Branch: `feature/BP-002-practical-cable-tray-planning`

## Scope

BP-002 delivers the minimal practical 2D cable-tray planning capability on the existing Workarea scene authority:

- manual `cable-tray.route` authoring in Measure mode,
- polyline geometry via authoritative `points[]`,
- tray width/type metadata,
- derived geometric route length,
- grouped totals by tray width,
- persistence through the existing scene/project save path,
- rehydration from the persisted Workarea scene.

The implementation remains deliberately separate from `cableLines` / EPLAN data.

Explicitly excluded: 3D routing, automatic routing, cable occupancy/fill logic, ports, 3D splines, Pencil routing, connection reserves, BOM automation, R2F changes and R2F-05 work.

## Data authority

Canonical route state remains inside:

`app.project.workspace.scene.objects[]`

A route uses `type = "cable-tray.route"` with persistent `tray.widthMm`, `tray.trayType` and `points[]`. Length and grouped totals are derived state and are not a second persistent authority.

## Implementation evidence

Functional implementation chain:

- `13bdd4dedea9e6dfb37e89b5635925a1966d5068` – practical 2D cable-tray routes
- `a2a73c8c1d9957136ba02275169fa33a953058a8` – BP-002 contract regression tests
- `246561c4c66049c75cbf2cfbd26b1abd70929c0d` – persist incomplete-route discard
- `add79f241a50928413852c727012215025908065` – strengthen save/reload regression coverage

Compared with the frozen base, the functional head is linear: 4 commits ahead, 0 behind. Only these product/test files are changed:

- `ui/panels/WorkareaPanel.base.js`
- `tests/bp-002-practical-cable-tray.spec.js`

The correction closes the identified one-point-route persistence defect: finishing an incomplete route removes it from the scene and persists that removal through the existing scene persistence path.

## Exact-head CI evidence

Draft PR #4 was created only to trigger CI for exact functional head `add79f24…`. It is not merge authorization.

Exact-head CI completed with 12 workflows passing and 7 failing.

Known/pre-existing baseline failure groups retained as limitations:

1. CI Checks (Syntax + Imports + Manifest + UI Wiring)
2. UI-MIG-05B Planning Left Area Gate
3. UI-MIG-05C Insert Sources Gate
4. TECH-WA-FREEZE-01B.2 Heartbeat Gate
5. TECH-WA-FREEZE-01B.3 RAF Abort Gate
6. TECH-WA-FREEZE-01C Mobile Viewer Stability Gate

Additional failing workflow:

7. PROJECT-UI-04A Existing Project Hall Creation Entry

PROJECT-UI-04A times out waiting for the historical hall-create field `[data-bp-hall-create-field="length"]`. It does not reach BP-002 route authoring or BP-002 persistence code and is therefore classified as a non-BP-002 regression/baseline limitation for this freeze.

No failing Exact-Head CI evidence identified a BP-002-specific product blocker.

## Verification limitation

The BP-002 Playwright coverage verifies the save-side and rehydrate-side contract structurally and verifies the persisted removal of an incomplete route. There is no complete browser E2E test that performs:

`draw route → save project → browser reload → verify identical route`

This is recorded as an explicit verification limitation, not hidden or represented as executed evidence.

## Freeze decision

`PASS WITH BASELINE LIMITATIONS / 0 BP-002 BLOCKER / FROZEN`

BP-002 is frozen at functional head `add79f241a50928413852c727012215025908065`.

This documentation commit is freeze evidence only. It must not be treated as a new functional implementation head.

No integration into `main` is authorized by this freeze. Integration requires a separate read-only integration reconciliation followed by separately authorized integration.
