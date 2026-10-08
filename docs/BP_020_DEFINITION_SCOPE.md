# BP-020 – Practical Cable Tray Support Type Classification – Definition / Scope

## Status

**DEFINITION / DOCUMENTATION ONLY – NO IMPLEMENTATION AUTHORIZED**

Authorized base:

`32f02a5d46ac5c2069f8a277703cf188bafa077b`

Feature branch:

`feature/BP-020-practical-cable-tray-support-type-classification`

## Purpose

BP-020 defines the minimal next practical capability after BP-019: a cable-tray route may manually classify the support / mounting type associated with the support quantity already derived by BP-019.

BP-020 does not define physical mounting hardware. It adds semantic meaning to the already planned supports without pretending that the repository knows the project-specific hardware composition.

## Existing authority retained

The following existing authorities remain unchanged:

- `cable-tray.route.points[]` remains the sole cable-tray route geometry authority.
- Route length remains derived from `points[]`.
- `tray.widthMm`, `tray.trayType`, and `tray.routeClass` remain route-owned authorities.
- BP-019 `tray.supportSpacingM` remains the sole manual route-owned support-spacing input.
- BP-019 remains the sole authority for the V1 derived support quantity.
- Only `routeClass === "new"` participates in practical support preparation.

BP-020 must not introduce a second route, support-spacing, support-count, or material authority.

## Persistent route-owned contract

BP-020 defines exactly one new persistent manual route-owned planning input:

`tray.supportType`

The field classifies the support / mounting type for the selected cable-tray route.

V1 deliberately does not define a hard-coded technical catalogue or enum. The repository currently contains no authoritative cable-tray support-type catalogue that BP-020 can safely reuse.

The value is therefore a manually supplied neutral classification string.

Normalization contract:

- trim surrounding whitespace;
- a non-empty string is the route-owned support-type classification;
- missing, null, non-string, or empty-after-trim input normalizes to `null`;
- `null` means **undetermined / unbestimmt**;
- no default support type is inferred.

New cable-tray routes initialize:

`tray.supportType = null`

## BP-019 derived-state reuse

BP-020 does not change BP-019 support quantity semantics.

For each new route with route length `L > 0` and valid `supportSpacingM > 0`, BP-019 remains authoritative:

`supportCount = max(2, ceil(L / supportSpacingM) + 1)`

BP-020 consumes that already-derived support planning state and adds only the route-owned support-type classification.

It must not persist `supportCount`, derive physical support coordinates, or independently recalculate route geometry.

A support type does not alter `supportSpacingM` or `supportCount` in BP-020.

## Derived grouping boundary

The BP-020 support preparation may refine the existing BP-019 aggregation boundary to:

- `widthMm`
- `trayType`
- `supportSpacingM`
- `supportType`

For a determined support type, the already-derived support quantity can therefore be reported against that classification.

Routes whose `supportType` is `null` remain explicitly **support type undetermined**. BP-020 must not silently map them to another group or invent a default mounting method.

The grouping remains runtime-derived only. No aggregate support group or support quantity is persisted.

## Semantic limit

A statement such as “12 supports of support type X” means only that BP-019 derived twelve supports and the route owner classified those supports as type X.

It does **not** mean that BP-020 knows which hardware parts compose one support.

In particular, BP-020 cannot infer from that classification:

- C-rail length or quantity;
- console / bracket quantity;
- threaded-rod length or quantity;
- clamp quantity;
- screw, anchor, or dowel quantity.

Those require a separate future material-composition authority.

## Relationship to existing material output

BP-018 remains unchanged.

BP-020 does not add support rows to the BP-018 material CSV and does not convert support classifications into purchasing material.

A later separately authorized capability may map a defined support classification plus BP-019 support quantity to concrete material preparation/output. That future capability must establish its own explicit material-composition contract.

## Explicit non-scope

BP-020 does not add:

- a hard-coded support-type catalogue or invented enum;
- manufacturer or article-number assignment;
- Hilti, Niedax, or other manufacturer mapping;
- C-rail quantities or lengths;
- consoles or brackets;
- threaded rods;
- clamps or beam/Keddy clamps;
- wall clips;
- screws, anchors, or dowels;
- hardware composition per support;
- prices or suppliers;
- inventory or stock;
- BOM merge;
- BP-018 CSV support-material rows;
- XLSX or PDF material output;
- automatic/default support-type selection;
- automatic/default technical support spacing;
- support positions or automatic 2D/3D placement;
- wall / ceiling / floor mounting-plane classification;
- load, weight, or structural calculation;
- special support rules near bends, T-pieces, fittings, starts, or endpoints;
- fittings, connectors, bends, T-pieces, reducers, or other form-part planning;
- route-geometry semantic changes;
- cable-fill-derived mounting rules;
- automatic 3D materialization.

## Definition decision

BP-020 is defined narrowly as **Practical Cable Tray Support Type Classification**.

Its only new persistent authority is `tray.supportType`.

BP-019 remains authoritative for support spacing and derived support quantity. BP-020 may use `supportType` only to classify and group that existing derived support state.

This document authorizes no product-code implementation, no test implementation, no CSV/material-output extension, and no further scope.
