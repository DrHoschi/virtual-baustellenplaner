# BP-009 – Completion / Evidence / Freeze

Functional freeze head: `6606e9017bc1ddbca6bedbaf2a6b5263a60ca7d1`

Baseline / authorization head: `dd31174bfac70044f938308fc27eeb48f93c54fc`

Status: **FROZEN WITH KNOWN BASELINE LIMITATIONS**

## Completed scope

BP-009 implements only the authorized practical cable-length planning minimum:

- derive the known minimum tray-path length from valid ordered `cableLine.routeRefs[]`,
- use the existing geometric length of referenced `cable-tray.route.points[]`,
- keep `cableLine.lengthM` as the independent manual cable-length authority,
- mark source/target connection and inter-route transition portions as undetermined,
- show a runtime-only difference between manual cable length and known minimum when the manual value is numeric,
- add no persistent BP-009 length, reserve, connection, transition, or comparison field.

Production scope remained limited to:

- `ui/panels/WorkareaPanel.base.js`

Focused test scope:

- `tests/bp-009-cable-length-planning.spec.js`

## Authority contract preserved

BP-009 does not establish CablePoint/port coordinates as Workarea world-space authority.

It does not calculate or invent:

- source-to-first-tray distance,
- last-tray-to-target distance,
- gaps between tray segments,
- route traversal direction,
- vertical drops,
- connection reserve,
- installation reserve or percentage allowance.

`cableLine.lengthM` is not overwritten.

No schema/store/export/EPLAN authority was changed.

## Exact-head diff evidence

Against authorization baseline `dd31174bfac70044f938308fc27eeb48f93c54fc`, functional head `6606e9017bc1ddbca6bedbaf2a6b5263a60ca7d1` is:

- ahead: 2 commits,
- behind: 0,
- merge base: exact authorization baseline,
- changed production files: exactly one,
- added focused tests: exactly one.

Diff files:

- `ui/panels/WorkareaPanel.base.js`: +23 / -3
- `tests/bp-009-cable-length-planning.spec.js`: +46 / -0

## Exact-head CI evidence

GitHub Actions for exact `head_sha=6606e9017bc1ddbca6bedbaf2a6b5263a60ca7d1` completed 17/17 workflow runs.

Result:

- 11 successful,
- 6 failed,
- 0 newly identified BP-009-specific workflow blockers.

The six failures are the known repository baseline limitations:

1. CI Checks (Syntax + Imports + Manifest + UI Wiring) → Smoke Tests
   - existing smoke failure reports a 404 resource / console.error.
2. UI-MIG-05B Planning Left Area Gate
3. UI-MIG-05C Insert Sources Gate
4. TECH-WA-FREEZE-01C Mobile Viewer Stability Gate
5. TECH-WA-FREEZE-01B.2 Heartbeat Gate
6. TECH-WA-FREEZE-01B.3 RAF Abort Gate

These are carried as known baseline limitations and are not attributed to BP-009 by this gate.

## Focused BP-009 test evidence limitation

`tests/bp-009-cable-length-planning.spec.js` exists at the exact functional head and statically covers the BP-009 authority boundaries, including:

- tray-derived minimum length,
- manual `lengthM` authority,
- runtime-only difference,
- undetermined connection/transition indication,
- no BP-009 derived persistence.

However, the current CI evidence does **not independently demonstrate that this new focused test file was executed as its own test step**.

Therefore this gate does not claim an executed focused-test PASS. The test's presence and assertions are evidence; its independent execution remains unevidenced by the current workflow output.

## Freeze decision

**BP-009 functional state `6606e9017bc1ddbca6bedbaf2a6b5263a60ca7d1` is FROZEN WITH KNOWN BASELINE LIMITATIONS.**

The functional freeze is exactly `6606e9017bc1ddbca6bedbaf2a6b5263a60ca7d1`.

This completion document may create a later documentation-only freeze head. That documentation head does not replace the functional freeze identity.

No integration to `main` is authorized by this gate.
