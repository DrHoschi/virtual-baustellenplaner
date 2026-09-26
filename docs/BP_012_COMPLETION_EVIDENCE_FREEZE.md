# BP-012 – Practical Cable Required-Length / Reserve Planning
## Completion / Evidence / Freeze

Status: **FROZEN WITH KNOWN BASELINE LIMITATIONS**

Functional freeze head: `6baadef0638df41f45fe88588a7ef61f2e4beb48`

Authorized baseline: `main = 2c5f409dca595a9b4ea97c2b75e3683fd96ce873`

Feature branch: `feature/BP-012-practical-cable-required-length-reserve`

This document records completion/evidence only. It does not change the BP-012 functional implementation and does not authorize integration to `main`.

## 1. Completed scope

BP-012 adds the minimal practical required-length/reserve planning contract to CableLine planning.

Persistent manual user authority added per CableLine:

- `sourceReserveM`
- `targetReserveM`

Runtime-only derived value added:

- `plannedRequiredLengthM`

Properties UI adds manual source/target planning inputs and displays the derived planned required length when its authority conditions are complete.

No new store, panel, geometry authority, automatic routing, 3D/Z calculation, true port offset, cut-length rule, percentage allowance or automatic overwrite of `cableLine.lengthM` was introduced.

## 2. Authority contract

`cableLine.lengthM` remains the independent manually entered cable length. BP-012 does not reinterpret or overwrite it.

`knownMinimumTrayPathM` remains BP-009's geometry-derived known minimum tray path.

BP-010 route order/direction and transition authority remain unchanged. A closed transition contributes authoritative 0 m; unresolved/open transitions remain undetermined.

BP-011 `sourceDirectDistanceM` and `targetDirectDistanceM` remain Component-Origin diagnostics only. They are explicitly not included in BP-012 required-length calculation.

The two BP-012 values are explicit user authority for the complete planned source-side and target-side portions outside the authoritative tray-path geometry, including any reserve the user intends there. They are not automatically added to BP-011 diagnostic direct distances.

## 3. Value semantics

For `sourceReserveM` and `targetReserveM`:

- empty input => unset / undetermined
- invalid input => unset / undetermined
- negative input => unset / undetermined
- explicit `0` => valid explicit user decision
- positive finite number => valid explicit user decision

Missing values must not silently become zero.

## 4. Derived planned required length

`plannedRequiredLengthM` may be produced only when all of the following are true:

1. at least one tray route is assigned;
2. every referenced route resolves;
3. every referenced route has an explicit `forward` or `reverse` traversal direction;
4. every inter-route transition is continuous;
5. `sourceReserveM` is valid/set;
6. `targetReserveM` is valid/set.

Then, and only then:

```text
plannedRequiredLengthM =
  knownMinimumTrayPathM
  + sourceReserveM
  + targetReserveM
```

Otherwise `plannedRequiredLengthM = null` / undetermined.

BP-011 source/target direct distances are not operands in this formula.

## 5. Persistence / derived-state boundary

Persisted CableLine authority:

- `sourceReserveM`
- `targetReserveM`

Runtime-only / not persisted:

- `plannedRequiredLengthM`
- `knownMinimumTrayPathM`
- `sourceDirectDistanceM`
- `targetDirectDistanceM`
- BP-011 world-position diagnostics

No second persisted calculated cable-length authority was introduced.

## 6. Exact implementation scope

Compared with baseline `2c5f409dca595a9b4ea97c2b75e3683fd96ce873`, functional head `6baadef0638df41f45fe88588a7ef61f2e4beb48` is linear: 4 commits ahead, 0 behind, with merge base exactly the authorized baseline.

Only these implementation/test files changed:

- `ui/panels/WorkareaPanel.base.js`
- `tests/bp-012-cable-required-length-reserve.spec.js` (new)
- `tests/bp-009-cable-length-planning.spec.js` (minimal contract reconciliation)
- `tests/bp-010-cable-route-continuity.spec.js` (minimal contract reconciliation)

`tests/bp-011-cable-source-target-world-space.spec.js` remained unchanged and continues to protect the BP-011 boundary.

The BP-009/BP-010 test edits only remove obsolete blanket reserve prohibitions now superseded by BP-012 explicit manual reserve authority. They do not relax the prohibition on BP-009/BP-010 inventing derived/predicted cable or transition lengths.

## 7. Exact-head CI evidence

For exact functional head `6baadef0638df41f45fe88588a7ef61f2e4beb48`, all 16 push-triggered workflow runs completed.

Result:

- 10 success
- 6 failure

The immediately preceding baseline execution on exact `2c5f409dca595a9b4ea97c2b75e3683fd96ce873` has the same workflow success/failure distribution.

The six failures were checked against the baseline down to failing step/signature:

1. **CI Checks (Syntax + Imports + Manifest + UI Wiring)** – Smoke Tests: same `404 (Not Found)` console-resource failure.
2. **UI-MIG-05B Planning Left Area Gate** – same timeout with `Expected: hidden` / `Received: visible`.
3. **UI-MIG-05C Insert Sources Gate** – same prerequisite failure in UI-MIG-05B Regression; acceptance remains skipped.
4. **TECH-WA-FREEZE-01B.2 Heartbeat Gate** – same 60000 ms `locator.click` timeout.
5. **TECH-WA-FREEZE-01B.3 RAF Abort Gate** – same prerequisite failure in TECH-WA-FREEZE-01B.2 Regression; RAF acceptance remains skipped.
6. **TECH-WA-FREEZE-01C Mobile Viewer Stability Gate** – same prerequisite failure in TECH-WA-FREEZE-01B.2 Regression; later stability steps remain skipped.

No BP-012-specific CI regression is evidenced by these failures.

## 8. Focused BP-012 test evidence limitation

`tests/bp-012-cable-required-length-reserve.spec.js` exists at the exact functional head and statically protects:

- explicit reserve persistence;
- non-negative / zero-vs-unset semantics;
- required route/direction/transition completeness;
- required-length formula;
- exclusion of BP-011 Component-Origin distances;
- non-persistence of derived values;
- continued BP-009/010/011 authority boundaries.

However, the current GitHub Actions workflows do not expose this focused test as an independently executed CI step. Therefore this freeze does **not** claim separate CI execution evidence for the focused BP-012 contract test.

This is an evidence limitation, not evidence of a functional failure.

## 9. Freeze decision

BP-012 is **FROZEN WITH KNOWN BASELINE LIMITATIONS** at functional head:

`6baadef0638df41f45fe88588a7ef61f2e4beb48`

The implementation is within the authorized minimal scope, preserves BP-009/BP-010/BP-011 authority boundaries, and introduces no evidenced BP-012-specific CI regression.

The six failing workflows remain inherited baseline limitations. The missing independent CI execution evidence for the focused BP-012 test is recorded explicitly.

Any later documentation commit containing this completion/evidence record is not a replacement functional freeze; the functional freeze remains the exact commit above.

No integration to `main` is authorized by this freeze.
