# BP-020 – Completion / Evidence / Freeze

## Status

**FROZEN**

BP-020 – Practical Cable Tray Support Type Classification is complete on the feature branch.

Authorized main base:

`32f02a5d46ac5c2069f8a277703cf188bafa077b`

Definition head:

`85ac1e9d859b62cb82e0e7fb02584f4e5e5594b1`

Functional implementation head before regression-test compatibility fix:

`9fdc5a6273995877f10cc31cb3c687912f1ba40b`

Verified completion input head:

`a4dbfd5d0b2f26007a41dc5a8f49fc950b10a96c`

Feature branch:

`feature/BP-020-practical-cable-tray-support-type-classification`

## Completed scope

BP-020 adds exactly one new persistent manual route-owned planning input:

`tray.supportType`

The value is a neutral manually supplied classification string. Surrounding whitespace is trimmed; missing, null, non-string, or empty-after-trim values are treated as `null` / undetermined. New cable-tray routes initialize `supportType: null`.

The existing BP-019 support preparation may group its already-derived support state by:

- `widthMm`
- `trayType`
- `supportSpacingM`
- `supportType`

No support-type catalogue, enum, manufacturer mapping, article mapping, or physical mounting-hardware composition was introduced.

## Retained authorities

BP-019 remains authoritative for support spacing and V1 support quantity.

The support-count formula remains unchanged:

`supportCount = max(2, ceil(L / supportSpacingM) + 1)`

Only new routes participate in practical support preparation. BP-020 does not persist support count, create support coordinates, or create a second route/material authority.

BP-018 remains unchanged. BP-020 does not add support rows to the BP-018 material CSV and does not convert support classifications or support counts into purchasing material.

## Implementation evidence

Implementation commit:

`e42ae84f2c1463aec1fa8c23db579ee396233cd0`

Focused BP-020 regression-test commit:

`9fdc5a6273995877f10cc31cb3c687912f1ba40b`

The implementation adds the route-owned `supportType` input, persistence through the existing scene-store path, normalized evaluation projection, BP-020 grouping refinement, and visible `Stützart` / `unbestimmt` evaluation output.

The BP-018 material-output implementation was not extended with support material.

## Product CI #1418 – failure and root cause

Exact-head Product CI #1418 ran against:

`9fdc5a6273995877f10cc31cb3c687912f1ba40b`

Result: **FAILURE**.

The first failing regression was the existing BP-019 static source-contract test. It still required the pre-BP-020 grouping key:

`widthMm | trayType | supportSpacingM`

The authorized BP-020 definition explicitly permits refinement of that derived grouping boundary by `supportType`. Product behavior retained the BP-019 support-spacing authority and unchanged support-count formula. Therefore the failure was identified as an obsolete BP-019 regression-test assertion, not a BP-019 product-authority regression.

## Regression Test Compatibility Fix

Compatibility-fix commit:

`a4dbfd5d0b2f26007a41dc5a8f49fc950b10a96c`

This commit changes only:

`tests/bp-019-cable-tray-support-planning.spec.js`

Diff size: one assertion line replaced (1 addition / 1 deletion).

The assertion now accepts the authorized BP-020 grouping key including `supportType`. No product code was changed by this compatibility fix.

## Exact-head CI evidence

Product CI #1419 ran against exact head:

`a4dbfd5d0b2f26007a41dc5a8f49fc950b10a96c`

Trigger: push on the BP-020 feature branch.

Result: **PASS / GREEN**.

Observed total duration: **1m 7s**.

This green exact-head run is the final regression evidence for the BP-020 completion gate.

## Freeze decision

BP-020 is **FROZEN** at:

`a4dbfd5d0b2f26007a41dc5a8f49fc950b10a96c`

The feature branch is four commits ahead of the authorized main base and zero commits behind at the completion input:

1. BP-020 definition/documentation.
2. BP-020 product implementation.
3. Focused BP-020 regression protection.
4. BP-019 regression-test compatibility fix.

The frozen scope is limited to support-type classification. Concrete C-rail, console/bracket, threaded-rod, clamp, screw/anchor/dowel quantities, manufacturer/article mapping, support-material CSV output, BOM composition, support positions, mounting planes, load calculations, fittings/form parts, and automatic hardware inference remain outside BP-020.

## Integration boundary

This freeze does **not** authorize integration to `main`.

The next step, if separately authorized, is a read-only BP-020 → main Integration Reconciliation against the then-current main head. Only after that reconciliation may a separate fast-forward integration be authorized.
