# BP-024 – Fitting Material Preparation – Definition / Scope

## Status

**DEFINED / SCOPED / NOT IMPLEMENTED**

Authoritative definition base:

`main = be145b778c364994aab47f14558fb88b3076a2e9`

This gate defines BP-024 only. It does not authorize implementation, feature-branch creation, BP-022 modification or any new persistent material authority.

## Purpose

BP-023 provides explicit persistent user intent for separately planned cable-tray fittings.

BP-024 adds the smallest practical runtime-derived material preparation from that existing authority:

**one valid explicit BP-023 fitting record → one fitting piece**

BP-024 must never rediscover or infer fittings from cable-tray geometry.

## Existing authority retained

The sole fitting-planning authority remains:

`app.project.workspace.scene.cableTrayFittings[]`

BP-024 does not create another fitting collection and does not persist derived quantities.

Existing `cable-tray.route.points[]` remains the sole route geometry authority.

Existing BP-023 fitting `id`, `kind` and `connections[]` remain the fitting identity/topology authority.

## Core counting contract

A BP-023 fitting contributes exactly one material piece when and only when the existing BP-023 validation resolves it as valid.

Conceptually:

`valid explicit BP-023 fitting record = 1 piece`

The quantity is not derived from:

- angle;
- number of geometric corners;
- route length;
- route intersections;
- coincident endpoints;
- route width;
- tray type;
- distance/tolerance;
- cable assignment;
- equipment binding.

A geometric corner/branch/transition without an explicit valid BP-023 fitting contributes **zero fitting pieces**.

## V1 grouping

BP-024 groups valid fitting records only by the existing BP-023 `kind`:

- `bend` → Bogen
- `tee` → T-Stück
- `reducer` → Reduzierung
- `connector` → Verbinder

For each group:

`quantity = count(valid BP-023 fitting records of that kind)`

No additional material identity is implied by a group.

In particular, two records with the same `kind` are counted together for this neutral V1 preparation even though a future catalogue may distinguish physical variants.

## Runtime-derived state only

BP-024 fitting-material preparation is derived state.

It must not persist:

- fitting material rows;
- fitting quantities;
- aggregate totals;
- copied fitting records;
- copied route data;
- manufacturer;
- article number;
- catalogue/material ID;
- fitting dimensions;
- purchase quantities.

A suitable implementation may expose a runtime helper such as:

`_getCableTrayFittingMaterialPreparationV1()`

The exact function name is implementation scope, not a new authority.

## Validation dependency

BP-024 must consume the existing BP-023 fitting records and existing BP-023 validation semantics.

It must not create an independent topology validator that can disagree with BP-023.

At the current frozen BP-023 contract:

- `bend` requires one valid connection to an inner point of a completed route;
- `tee` requires three explicit valid connections;
- `reducer` requires two explicit valid connections;
- `connector` requires two explicit valid connections.

BP-024 does not reinterpret these rules.

## Unresolved / invalid fittings

A BP-023 fitting that does not pass BP-023 validation is **not purchasing material** in BP-024 V1.

Therefore unresolved/invalid fittings:

- are excluded from fitting material quantities;
- must not create a zero-quantity material row;
- must not be repaired by BP-024;
- must not be replaced with guessed route/point references;
- must not be deleted by BP-024;
- must not be silently counted.

The preparation may expose an `unresolvedCount` and/or equivalent diagnostic status separately from material rows.

That diagnostic value is derived state only.

## Broken-reference boundary

BP-023 remains responsible for preserving structurally valid but unresolved fitting references where possible.

BP-024 only observes the BP-023 validation result.

It must not:

- clamp `pointIndex`;
- move a fitting to a nearby point;
- substitute another route;
- rewrite `connections[]`;
- mutate fitting records.

## pointIndex boundary

BP-024 inherits BP-023's explicit V1 `{ routeId, pointIndex }` limitation.

It does not introduce stable point IDs or migration.

Any future completed-route point insertion/deletion/reordering capability that reopens BP-023 reference stability also reopens BP-024 material validity indirectly through BP-023 validation.

## Geometry-never-creates-material rule

BP-024 preserves the central BP-023 rule:

**Geometry describes where the tray runs. Explicit BP-023 records state whether a separate fitting is planned.**

Therefore BP-024 must not scan geometry to find:

- corners;
- 90-degree bends;
- T intersections;
- route meetings;
- reducers;
- connectors;
- crossings.

No geometry-based fallback is allowed when BP-023 contains no valid fitting record.

## BP-022 boundary

BP-022 remains frozen and unchanged by BP-024 V1.

BP-024 does **not** add fitting rows to:

- `_getCombinedCableTrayMaterialOutputRowsV1()`;
- BP-022 Gesamtmaterial CSV;
- BP-018 Material CSV.

BP-024 first establishes an independent derived fitting-material preparation.

A later separately authorized output-integration capability may consume BP-024 preparation and extend a combined material output.

That later output must consume BP-024 derived rows rather than independently recounting BP-023 fittings.

## BP-016 / BP-017 / BP-018 boundary

Existing cable-tray base/accessory preparation and output remain unchanged.

BP-024 does not alter:

- cable-tray stick calculations;
- cover quantities;
- divider quantities;
- purchase lengths;
- offcut;
- existing CSV semantics.

## BP-019 / BP-020 / BP-021 boundary

Support planning and support-material composition remain independent.

A fitting does not automatically:

- add a support;
- remove a support;
- alter support spacing;
- choose a support type;
- add fitting-specific mounting hardware.

Any such rule requires a separate technical contract.

## Manufacturer / article / catalogue boundary

BP-024 V1 has no technical material identity beyond the neutral BP-023 fitting kind.

It does not define or infer:

- manufacturer;
- article number;
- catalogue ID;
- supplier;
- price;
- inventory;
- package quantity;
- order unit;
- product family;
- dimensions;
- width-specific fitting variant;
- height-specific fitting variant;
- bend angle;
- bend radius;
- reducer dimensions;
- connector subtype.

Therefore a BP-024 row such as `Bogen = 4 Stück` means only:

**four valid explicit BP-023 bend fitting records are currently planned.**

It does not mean that all four are necessarily the same purchasable article.

## Width / tray-type boundary

Existing route `widthMm` and `trayType` are not promoted into BP-024 V1 material identity.

BP-024 must not copy those values into a new persistent fitting record.

A future capability may derive fitting variants from explicit route/fitting context, but that requires a separate contract because multi-route fittings can involve different route widths/types and because technical catalogue identity does not currently exist.

## Output shape

The minimal runtime preparation should be able to represent:

- fitting `kind`;
- neutral display name;
- unit `Stk`;
- derived quantity;
- unresolved diagnostic count/status separately from valid material rows.

No purchase/order semantics beyond the derived piece count are authorized.

## Explicit non-scope

BP-024 V1 does not implement:

- automatic fitting recognition;
- automatic fitting suggestions;
- geometry-derived fitting creation;
- BP-022 Gesamtmaterial integration;
- BP-018 CSV integration;
- a new CSV/export;
- manufacturer/article/catalogue identity;
- fitting BOM;
- price/supplier/inventory;
- package/order optimization;
- width/type-specific article selection;
- bend-angle/radius classification;
- physical fitting dimensions;
- support changes near fittings;
- mounting hardware for fittings;
- stable route-point IDs;
- route point migration;
- route splitting/merging;
- cable-routing changes;
- 3D fittings;
- EPLAN coupling.

## Required implementation-scope reconciliation before implementation

Before BP-024 implementation is authorized, a separate read-only reconciliation must determine:

1. the smallest runtime helper surface for consuming BP-023 fittings and validation;
2. the exact derived row shape;
3. how `unresolvedCount` or equivalent diagnostic state is exposed without becoming material;
4. where the preparation is presented in the existing UI without changing BP-022 output;
5. the focused regression-test surface proving that geometry alone never creates fitting material and unresolved fittings are excluded;
6. that no new persistence/sanitizer/project authority is required.

## Definition decision

**BP-024 – Fitting Material Preparation: DEFINED**

The frozen definition contract for the next implementation stage is:

**Each valid explicit BP-023 fitting record contributes exactly one piece, grouped only by its existing BP-023 kind. Unresolved fittings contribute no material quantity. Geometry contributes nothing without an explicit valid BP-023 fitting.**

BP-022, manufacturer/article identity and all purchasing/catalogue semantics remain outside BP-024 V1.

**Definition / Scope Gate: PASS**

No implementation, test-code change or feature-branch creation is authorized by this document.
