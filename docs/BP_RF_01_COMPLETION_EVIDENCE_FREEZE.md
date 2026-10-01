# BP-RF-01 – Cable-Tray Modularization

## Status

**FROZEN**

Verified full freeze head:

`714296b67f4770ec35ed7b26846f3161e37af056`

Functional refactoring head:

`1209d373ed8fb0329057d72f0180e36ab03ca899`

Authorized base:

`55c237be9ee9bc2ccf948a763bc76b7f16b64872`

Branch:

`test/BP-RF-01-regression-contract-adaptation`

## Purpose

BP-RF-01 structurally reduces `ui/panels/WorkareaPanel.base.js` by extracting the existing Cable-Tray domain into a dedicated Workarea module. The change preserves product behavior, persistence, schemas, and existing data authorities.

This freeze covers the structural extraction, the subsequent test-only contract adaptation, the blocker fix, and their complete verification evidence.

## Frozen Structural Scope

The functional refactoring from the authorized base to `1209d373ed8fb0329057d72f0180e36ab03ca899` changes exactly two product files:

- `ui/panels/WorkareaPanel.base.js`
- `ui/workarea/workarea-cable-tray.v1.js`

Exactly 53 existing Cable-Tray methods were moved to the dedicated module and connected to `WorkareaPanel` through `installWorkareaCableTrayModule`. Their domain behavior remains unchanged.

The extraction introduces no new store, service, parallel data model, persistence format, or schema. `cable-tray.route` remains the existing data authority.

## Test-Contract Adaptation

After the structural extraction, 22 existing BP test files still assumed that all Cable-Tray implementation text resided in `WorkareaPanel.base.js`. Their source-boundary assertions were adapted to distinguish base/integration logic from Cable-Tray module logic.

The test-only adaptation changes exactly these files relative to the functional refactoring head:

- `tests/bp-002-practical-cable-tray.spec.js`
- `tests/bp-003-cable-tray-classification.spec.js`
- `tests/bp-004-cable-tray-evaluation.spec.js`
- `tests/bp-005-cable-tray-point-editing.spec.js`
- `tests/bp-006-cable-tray-endpoint-binding.spec.js`
- `tests/bp-007-cable-tray-material-requirement.spec.js`
- `tests/bp-008-cable-route-assignment.spec.js`
- `tests/bp-009-cable-length-planning.spec.js`
- `tests/bp-010-cable-route-continuity.spec.js`
- `tests/bp-016-cable-tray-material-preparation.spec.js`
- `tests/bp-017-cable-tray-accessory-planning.spec.js`
- `tests/bp-018-cable-tray-material-output.spec.js`
- `tests/bp-019-cable-tray-support-planning.spec.js`
- `tests/bp-020-cable-tray-support-type-classification.spec.js`
- `tests/bp-021-support-material-composition.spec.js`
- `tests/bp-022-combined-cable-tray-material-output.spec.js`
- `tests/bp-023-cable-tray-fitting-junction-authority.spec.js`
- `tests/bp-024-fitting-material-preparation.spec.js`
- `tests/bp-025-fitting-material-output-integration.spec.js`
- `tests/bp-026-material-identity-article-mapping.spec.js`
- `tests/bp-027-practical-material-assignment-ui.spec.js`
- `tests/bp-028-article-aware-material-output.spec.js`

`tests/bp-011-cable-tray-lifecycle.spec.js` remains unchanged. The module-installation contract is asserted once in BP-002.

The blocker fix from `c95f764b4caf88dbdc5d5acd61544cf5274c8626` to the verified full freeze head changes only BP-002, BP-004, BP-020, BP-021, and BP-022, as authorized.

## Full-Branch Scope Evidence

The complete branch from the authorized base through the verified full freeze head is linear and contains no merge commit.

- authorized base to functional head: exactly the two product files named above
- functional head to verified full freeze head: exactly the 22 test files named above
- product files at `1209d373ed8fb0329057d72f0180e36ab03ca899` and `714296b67f4770ec35ed7b26846f3161e37af056`: byte-identical
- persistence, schemas, CI/workflows, configuration, and pre-existing documentation: unchanged

Verified product blob identities across the test-only branch:

- `ui/panels/WorkareaPanel.base.js`: `bfaa27d5b1c76c745e5ace1f998b8906e8627cc6`
- `ui/workarea/workarea-cable-tray.v1.js`: `242a66c473a9503ef58555a5a6450468831e64db`

## Verification Evidence

Both the Implementation Verification / Scope / Regression Gate and the repeated Test Contract Adaptation Verification / Scope / Regression Gate concluded **PASS**.

Exact verified head:

`714296b67f4770ec35ed7b26846f3161e37af056`

Exact-head checks were reproduced locally with Node.js 20 and Chromium against the repository's complete `Product CI` workflow contract:

- JavaScript syntax check: **PASS**, 207 JavaScript files
- import-graph check: **PASS**, 154 relative imports
- all remaining 13 static Product-CI checks: **PASS**
- Product-CI browser and smoke gates: **20/20 PASS**

No stored GitHub Actions run or commit status existed for this exact head at verification time. The evidence above is the local exact-head execution of the complete workflow contract, not a claimed remote Actions run.

## Focused Regression Matrix

All 22 adapted BP test files passed at the exact verified head:

- 18 Playwright files: **53/53 PASS**
- BP-006 `node:test`: **5/5 PASS**
- BP-009 and BP-010 standalone acceptance: **2/2 PASS**
- BP-028 Vitest: **6/6 PASS**
- total: **66/66 PASS**

## Non-Scope Preserved

This freeze contains no:

- functional product change
- persistence or schema change
- data-authority change
- BP-031 functionality
- `tray.dutyClass`
- additional cleanup or modernization
- CI/workflow or configuration change
- integration into `main`

## Freeze Decision

BP-RF-01 Cable-Tray Modularization is **FROZEN** at verified full freeze head:

`714296b67f4770ec35ed7b26846f3161e37af056`

The functional refactoring remains identified by:

`1209d373ed8fb0329057d72f0180e36ab03ca899`

This document adds completion/evidence/freeze documentation only. The documentation commit does not alter the verified product or test state. Integration into `main` is not part of this gate and requires separate authorization.
