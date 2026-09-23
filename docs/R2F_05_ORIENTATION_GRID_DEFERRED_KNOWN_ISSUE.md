# R2F-05 – Orientation / Grid Geometry Regression – Deferred Known Issue

Status: **DEFERRED / KNOWN ISSUE / NON-BLOCKING FOR CURRENT PRODUCT PRIORITY**  
Date: 2026-09-23  
Branch used for investigation: `feature/R2F-05-grid-orientation-sync`

## Decision

R2F-05 is deliberately deferred so current product work can continue. This is **not PASS** and **not FROZEN**. The remaining device regression is known and reproducible, but is currently non-blocking compared with preparing the Baustellenplaner for practical use.

Do not treat this document as evidence that the defect is fixed.

## User-visible defect

On iPhone/mobile Safari, the Planning/Workarea grid can become visually distorted after an orientation change without reloading the page.

Observed contract:
- reload in Portrait: geometry/grid correct;
- Portrait -> Landscape without reload: distortion can still occur;
- reload in Landscape: geometry/grid correct;
- the problem is therefore tied to the live orientation/viewport transition rather than the persisted world/object geometry;
- the latest manual TESTBUILD 3 recording still reproduced the defect.

The defect should be resumed later from the evidence and hypotheses below rather than re-diagnosed from zero.

## Investigation lineage

### Frozen R2 product baseline
`54310303e424e8b14c80fdb2e992ae7da89e45d3`

Initial read-only diagnosis found that the canvas CSS size follows its host while its backing store is synchronized from the measured host rectangle and DPR. The existing mobile Safari resize guard intentionally suppresses ordinary pure-height viewport noise. The likely failure mode is a stale/intermediate backing-store size being retained while the CSS canvas reaches a different final rectangle, producing visual non-uniform stretching.

The existing Safari/mobile resize guard is intentional behavior and must not simply be removed.

### V1
Commit: `2420b5f2fa518444a9e46137b58fc6cc8df5716f`

Purpose:
- distinguish orientation/material aspect changes from ordinary Safari height noise;
- permit an orientation-related canvas backing-store synchronization while delegating normal cases to the existing base guard.

Result:
- static scope/guard checks passed;
- device regression failed;
- Portrait -> Landscape without reload could still produce distorted grid geometry.

### V2
Commit: `0b7db9fe51121fecbff2295ba0c0c79e6b83dd93`

Purpose:
- keep a short-lived orientation transition;
- allow one later same-width/same-DPR height synchronization after the first orientation/intermediate synchronization.

Failed-device reconciliation:
- V2 treated the first matching pure-height change as the final settling state;
- that one-shot could be consumed by an intermediate Safari host geometry;
- a later stable host state could then fall back under `mobilePureHeightLock`;
- current telemetry was insufficient to prove the exact millisecond/event ordering, so no invented runtime sequence should be treated as evidence.

Result:
- static scope/guard checks passed;
- device regression still failed.

### V3
Commit: `8212180225da13ade2eb5286ecc521403f8c3e4d`

Purpose:
- replace the V2 "first height change is final" assumption;
- an actual `orientationchange` opens a bounded transition;
- resize activity resets a quiet-period timer;
- after a 360 ms quiet period, the then-current host geometry is measured and allowed through once as `orientationchange:stabilized-final`;
- the transition then closes and ordinary Safari height noise returns to the existing base guard.

Implementation scope:
- only `ui/panels/WorkareaPanel.js`;
- no general mobile `force:true`;
- no changes to `WorkareaPanel.base.js`, CSS, grid renderer, zoom/pan, world/object geometry, persistence, or R2F-01 through R2F-04.

Static verification:
- V3 was exactly one commit ahead of V2;
- wrapper-only diff;
- scope PASS;
- guard contract PASS;
- static regression PASS.

Device result:
- TESTBUILD 3 still reproduced the orientation distortion;
- therefore V3 is **not** accepted as a fix.

## Preserved technical constraints

Any future correction must preserve these constraints unless a new explicit reconciliation proves they are wrong:
- ordinary Safari pure-height viewport noise must remain guarded;
- do not globally force mobile canvas resize;
- do not alter persisted world/object geometry to compensate for a display-only distortion;
- do not reopen unrelated R2F-01 through R2F-04 work as part of this defect;
- distinguish reload correctness from live orientation-transition correctness.

## Suggested future re-entry point

When time permits, resume with a read-only runtime/evidence pass rather than V4 by guesswork. Capture the complete sequence around a failing orientation change:
- `orientationchange`;
- `window.resize`;
- ResizeObserver callbacks;
- host `getBoundingClientRect()` width/height;
- DPR;
- canvas CSS width/height;
- canvas backing-store width/height;
- base guard decision/reason;
- transition state and timer completion.

The key unanswered question is which geometry is finally visible after Safari has fully settled and why the canvas backing store still does not match it despite V3's quiet-period sync. Older mobile/Safari resize/layout behavior may be interacting with the current wrapper.

## Product-priority decision

On 2026-09-23 the remaining defect was explicitly deferred because near-term practical product preparation has higher priority.

Final state:

**R2F-05 = DEFERRED / KNOWN ISSUE / NON-BLOCKING FOR CURRENT PRODUCT PRIORITY / NOT PASS / NOT FROZEN**

R2F-01 and subsequent product work may proceed without representing R2F-05 as completed.
