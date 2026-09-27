# BP-013 – Practical Cable Cut-Length / Preparation Planning – Completion / Evidence / Freeze

## Status

**FROZEN WITH KNOWN BASELINE LIMITATIONS**

- Authorized baseline / integration base: `f93b8e92fdba611d4f9075b70ff1d3c5dd0c5e16`
- Functional freeze head: `24f3da92d8fcc6191ceacac743b5c0947ff80121`
- Feature branch: `feature/BP-013-practical-cable-cut-length-preparation`
- This document records completion/evidence/freeze only. It does not replace the functional freeze head and does not authorize integration to `main`.

## Completed Scope

BP-013 adds a minimal practical cable cut/preparation planning layer on top of the already authoritative BP-012 required-length result.

Production changes are limited to:

- persistent manual CableLine input `cutAllowanceM`,
- runtime-only derived `plannedCutLengthM`,
- minimal Properties UI for the manual cut allowance and derived planned cut length.

The focused BP-013 contract test is:

- `tests/bp-013-cable-cut-length-preparation.spec.js`

No BP-009, BP-010, BP-011 or BP-012 contract test was modified by BP-013.

## Authority and Persistence Contract

### Existing authorities preserved

BP-013 does not reinterpret or overwrite existing authorities:

- `cableLine.lengthM` remains the independent manually entered cable length.
- BP-009 `knownMinimumTrayPathM` remains the known minimum tray-path authority only.
- BP-010 route direction and transition continuity authority remains unchanged.
- BP-011 `sourceDirectDistanceM` and `targetDirectDistanceM` remain Component-Origin diagnostics and are not used in the BP-013 cut-length formula.
- BP-012 `sourceReserveM`, `targetReserveM` and runtime `plannedRequiredLengthM` retain their existing contract.

### New persistent manual authority

BP-013 introduces exactly one new persistent user input:

- `cutAllowanceM`

It represents an explicit manual additional cut/preparation allowance in metres.

Normalization semantics:

- blank => unset,
- invalid => unset,
- negative => unset,
- explicit `0` => valid,
- positive finite value => valid.

No implicit default is introduced.

### Runtime-only derived state

BP-013 introduces:

- `plannedCutLengthM`

It is runtime derived only and is not persisted into the CableLine candidate.

It is available only when both conditions are satisfied:

1. BP-012 has produced a non-null `plannedRequiredLengthM`.
2. `cutAllowanceM` is explicitly set to a valid non-negative value.

Formula:

`plannedCutLengthM = plannedRequiredLengthM + cutAllowanceM`

If either authority is missing, `plannedCutLengthM = null`.

An explicit `cutAllowanceM = 0` is valid and therefore produces a planned cut length equal to `plannedRequiredLengthM`.

## Derived-State Boundary

BP-013 does not create a second persisted calculated cable-length authority.

The following remain derived/runtime-only:

- `knownMinimumTrayPathM`,
- `sourceDirectDistanceM`,
- `targetDirectDistanceM`,
- `plannedRequiredLengthM`,
- `plannedCutLengthM`.

Only the explicit manual input `cutAllowanceM` is added to CableLine persistence.

## Explicit Non-Scope

BP-013 does not introduce:

- automatic rounding to whole metres or other increments,
- percentage allowance,
- global or project-wide automatic allowance,
- cable-type-specific automatic uplift,
- hidden default reserve,
- reinterpretation or automatic overwrite of `cableLine.lengthM`,
- BP-011 diagnostic distances as physical cable-route authority,
- drum/spool assignment,
- drum or spool remaining length,
- waste calculation,
- drum/rest-length optimization,
- material disposition,
- auto-routing,
- 3D/Z or vertical cable geometry,
- true physical port offsets.

These remain separate future concerns.

## Implementation Evidence

The exact functional head is:

`24f3da92d8fcc6191ceacac743b5c0947ff80121`

Relative to baseline `f93b8e92fdba611d4f9075b70ff1d3c5dd0c5e16`, the functional implementation is exactly two commits and two files:

1. `ui/panels/WorkareaPanel.base.js`
   - persists `cutAllowanceM`,
   - uses the existing non-negative planning-value normalization seam,
   - derives `plannedCutLengthM` only from BP-012 `plannedRequiredLengthM` plus explicit `cutAllowanceM`,
   - exposes the manual allowance and derived result in the existing Properties UI.

2. `tests/bp-013-cable-cut-length-preparation.spec.js`
   - protects persistence,
   - protects zero-vs-unset semantics,
   - protects the BP-013 formula,
   - protects the runtime-only boundary,
   - protects BP-009/010/011/012 authority boundaries,
   - rejects percentage/drum/spool scope creep.

The BP-009, BP-010, BP-011 and BP-012 test files remain unchanged by BP-013.

## Exact-Head CI Evidence

For exact head `24f3da92d8fcc6191ceacac743b5c0947ff80121`:

- 16 push workflow runs completed,
- 10 concluded `success`,
- 6 concluded `failure`.

The six failures match the already known baseline limitation signatures:

1. General CI / Smoke Tests failure with the known smoke-path 404 signature.
2. UI-MIG-05B Planning Left Area acceptance failure with the known hidden/visible prerequisite signature.
3. UI-MIG-05C Insert Sources blocked by the same UI-MIG-05B prerequisite regression.
4. TECH-WA-FREEZE-01B.2 Heartbeat acceptance: 60-second `locator.click` timeout because the Planning topbar intercepts the canvas pointer event.
5. TECH-WA-FREEZE-01B.3 RAF Abort gate blocked by the same Heartbeat prerequisite failure.
6. TECH-WA-FREEZE-01C Mobile Viewer Stability gate blocked by the same Heartbeat prerequisite failure.

Syntax and import-graph checks pass on the exact head.

No BP-013-specific new CI regression is evidenced by these runs.

## Focused BP-013 Test Evidence Limitation

The focused contract test

`tests/bp-013-cable-cut-length-preparation.spec.js`

exists on the exact functional head and was statically reviewed during the Verification / Scope / Regression Gate.

The current workflow set does not expose this test as a separately executed CI step. Therefore no independent CI execution evidence for this focused BP-013 test is claimed.

This limitation is recorded explicitly and does not convert the known baseline failures into BP-013 failures.

## Freeze Decision

BP-013 is complete within its authorized minimal scope.

Functional freeze:

`24f3da92d8fcc6191ceacac743b5c0947ff80121`

Decision:

**FROZEN WITH KNOWN BASELINE LIMITATIONS**

The functional freeze remains the code/test head above. A later documentation commit containing this record is completion/evidence metadata only and must not be treated as a replacement functional implementation head.

No integration to `main` is authorized by this gate.
