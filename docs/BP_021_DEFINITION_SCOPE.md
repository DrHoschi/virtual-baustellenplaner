# BP-021 – Manual Support Material Composition – Definition / Scope

## Status

**DEFINITION / DOCUMENTATION ONLY – NO IMPLEMENTATION AUTHORIZED**

Authoritative definition base:

`main = b851b4f733a22f77586a3b5575af2493682d9a0e`

This gate defines the minimal BP-021 contract only. It does not authorize product-code changes, test implementation, CSV changes, or creation of a feature branch.

## Purpose

BP-019 can derive how many supports a new cable-tray route requires.

BP-020 can manually classify those supports through the route-owned `tray.supportType`.

The remaining practical gap is the explicit user-defined meaning of a support type in material terms: which manually defined material positions compose one support of that type.

BP-021 must close only that gap. It must not invent mounting hardware, infer technical construction rules, or create a second cable-tray geometry/support-count authority.

## Existing authorities retained

The following authorities remain unchanged:

- `cable-tray.route.points[]` remains the sole cable-tray route geometry authority.
- Route length remains derived from `points[]`.
- `tray.widthMm`, `tray.trayType`, and `tray.routeClass` remain route-owned authorities.
- BP-019 `tray.supportSpacingM` remains the sole manual route-owned support-spacing input.
- BP-019 remains the sole authority for V1 derived `supportCount`.
- BP-020 `tray.supportType` remains the sole route-owned support-type classification.
- Only `routeClass === "new"` participates in practical support preparation.

BP-021 consumes these authorities. It must not persist route length, support count, support positions, or derived material totals.

## New minimal persistent authority

BP-021 requires one new **project-owned support-material composition authority**.

Conceptual contract:

`supportMaterialCompositions[]`

Each composition represents the manually defined material composition for one normalized `supportType`.

Minimal conceptual shape:

```text
supportMaterialComposition
  supportType
  components[]
    name
    quantityPerSupport
    unit
```

The exact storage location/schema path is not authorized by this definition gate and must be reconciled before implementation. The implementation must place this authority in project-owned state and must not place it on individual cable-tray routes or inside `assembly.instance.bom`.

A composition defines only what the user says one support of a given type consists of.

## Composition identity and normalization

`supportType` is the join key between BP-020 route classification and BP-021 composition.

Normalization must follow BP-020 semantics:

- input must be a string;
- trim surrounding whitespace;
- empty-after-trim, missing, null, or non-string values are undetermined and cannot identify a material composition;
- no default support type may be inferred.

For each material component:

### `name`

- manually supplied string;
- trim surrounding whitespace;
- empty-after-trim, missing, null, or non-string names are invalid component rows;
- BP-021 does not infer a material name from `supportType`.

### `quantityPerSupport`

- manually supplied finite number;
- must be greater than zero;
- zero, negative, non-finite, missing, or non-numeric values are invalid;
- no default quantity is inferred.

### `unit`

- manually supplied non-empty string;
- trim surrounding whitespace;
- missing/empty/non-string unit is invalid;
- no default such as `Stk`, `m`, or `Satz` is inferred.

BP-021 V1 does not require manufacturer or article-number identity.

## Uniqueness boundary

A normalized `supportType` may resolve to at most one active BP-021 material composition within the project.

BP-021 must not silently combine multiple competing composition definitions for the same normalized support type.

The exact editing/conflict UX is implementation scope and is not authorized here.

## Derived-state contract

BP-021 must reuse the existing BP-019/BP-020 support preparation.

For an eligible new route/support group with:

- determined `supportType`;
- BP-019-derived `supportCount`;
- matching valid BP-021 composition;

each valid component is projected as:

`derivedQuantity = supportCount * quantityPerSupport`

This value is runtime-derived only.

BP-021 must not persist:

- `supportCount`;
- `derivedQuantity`;
- aggregate material totals;
- generated material-output rows;
- a copied composition on each route.

If multiple eligible support groups resolve to the same normalized material identity, later presentation may aggregate compatible derived rows only when their normalized material name and unit are compatible. Such aggregation remains derived and must not create a new persistent BOM.

## Undetermined / incomplete states

BP-021 must remain explicit when the material composition cannot be derived.

Examples include:

- route/support group has `supportType = null`;
- support type has no project composition;
- composition has no valid component rows;
- component quantity/unit/name is invalid.

These states must not be silently replaced by guessed hardware or defaults.

BP-021 may report them as unresolved/undetermined preparation state.

## Semantic limit

A BP-021 result such as:

`12 supports × 2 units of component X = 24 units of component X`

means only:

1. BP-019 derived twelve supports;
2. BP-020 classified them with a support type;
3. the project-owned BP-021 composition manually defines two units of component X per support.

BP-021 does not independently validate whether that composition is structurally, electrically, mechanically, or manufacturer-technically correct.

## Assembly BOM boundary

The repository already has Assembly/AssemblyLab BOM capabilities including component `articleNo`, `manufacturer`, `qty`, `unit`, and `assembly.instance.bom`.

Those remain Assembly/Component authority.

BP-021 must not:

- store support compositions in `assembly.instance.bom`;
- copy Assembly BOM rows onto cable-tray routes;
- reinterpret mechanical component role `support` as cable-tray support material;
- merge support material into Assembly BOM;
- make Assembly BOM the source of cable-tray support composition.

Existing BOM field patterns may inform UI/data-shape consistency, but they do not become BP-021 authority.

## BP-018 material-output boundary

BP-018 remains unchanged and authoritative for its existing cable-tray material CSV projection.

BP-021 must not silently extend or redefine BP-018 output.

In BP-021 V1, support material is first a separate derived support-material preparation projection.

Any later inclusion of support material in a combined CSV/XLSX/PDF/material export requires a separate explicitly authorized output contract.

## Explicit non-scope

BP-021 does not add or infer:

- predefined C-rail lengths or quantities;
- console/bracket types or quantities;
- threaded-rod lengths or quantities;
- clamp types or quantities;
- beam/Keddy clamp rules;
- wall clips;
- screws, anchors, or dowels;
- manufacturer assignment;
- article-number assignment;
- Hilti, Niedax, or other manufacturer catalogues;
- prices or suppliers;
- inventory/stock;
- purchasing optimization;
- waste/offcut calculations for support components;
- packaging quantities;
- automatic unit conversion;
- Assembly BOM merge;
- BP-018 CSV support rows;
- XLSX/PDF output;
- automatic/default support type;
- automatic/default material composition;
- automatic/default quantities or units;
- support positions or 2D/3D placement;
- wall/ceiling/floor mounting-plane classification;
- load, weight, span, or structural calculations;
- special support rules near bends, T-pieces, fittings, starts, or endpoints;
- fittings/connectors/bends/T-pieces/reducers/form parts;
- cable-fill-derived support/material rules;
- automatic 3D materialization;
- manufacturer-specific technical validation.

## Implementation boundary

Before any implementation, a separate authorization must establish a feature branch from the then-authorized exact base and reconcile the exact project-state storage path for `supportMaterialCompositions[]`.

The implementation must remain minimal:

1. persist only the project-owned manual composition definitions;
2. consume BP-019-derived support count;
3. consume BP-020 route-owned support type;
4. derive support-material preparation at runtime;
5. expose unresolved states without guesses;
6. preserve BP-018 and Assembly BOM boundaries.

No implementation is authorized by this document.

## Definition decision

BP-021 is defined as **Manual Support Material Composition**.

Its new authority is limited to a project-owned mapping from normalized BP-020 `supportType` to manually entered component rows containing:

- material `name`;
- `quantityPerSupport`;
- `unit`.

BP-019 remains authoritative for support quantity. BP-020 remains authoritative for route support classification. BP-021 only defines the manual material composition per support type and derives resulting material quantities at runtime.

**Definition / Documentation Gate: PASS**

**0 product-code changes, 0 test-code changes, and 0 feature-branch creation are authorized by this document.**
