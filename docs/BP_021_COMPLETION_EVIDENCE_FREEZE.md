# BP-021 – Completion / Evidence / Freeze

## Status

**FROZEN**

Functional freeze head:

`ced5162594184cde47e9716058932c6958ec8554`

Feature branch:

`feature/BP-021-manual-support-material-composition`

This document records completion evidence only. It does not extend BP-021 scope and does not authorize integration to `main`.

## Definition authority

BP-021 was defined in:

`docs/BP_021_DEFINITION_SCOPE.md`

Definition/documentation commit on the authorized base:

`d5ba318e20b8bf669d13e8121db54869d9f8a227`

BP-021 closes one practical gap only: a project may manually define which neutral material components compose one BP-020 support type.

The definition explicitly preserves:

- cable-tray route geometry authority in `cable-tray.route.points[]`;
- BP-019 support spacing and derived support-count authority;
- BP-020 route-owned `tray.supportType` authority;
- BP-018 cable-tray material CSV semantics;
- Assembly/AssemblyLab BOM as a separate authority.

## Storage / persistence reconciliation

Before implementation, the existing project persistence path was reconciled read-only.

Decision:

`app.project.supportMaterialCompositions[]`

is the single new persistent BP-021 authority.

It is project-owned because a support-type composition is shared project configuration, not route geometry or a per-route copied BOM.

BP-021 does not create a mirror under legacy `project.*`, does not copy compositions onto individual cable-tray routes, and does not store them in `assembly.instance.bom`.

Changes use the existing project-save request path through:

`_requestProjectSaveDebounced("support-material-composition")`

No new persistor or project-file format was introduced.

## Implementation evidence

Product implementation commit:

`8e3b2f216d079669b55d6eb53ef4ded0ed41fe48`

Focused BP-021 contract-test commit / functional head:

`ced5162594184cde47e9716058932c6958ec8554`

Compared with the authorized implementation base `d5ba318e20b8bf669d13e8121db54869d9f8a227`, the functional head is exactly:

- 2 commits ahead;
- 0 commits behind;
- changes limited to `ui/panels/WorkareaPanel.base.js`;
- plus `tests/bp-021-support-material-composition.spec.js`.

## Persistent data contract

BP-021 persists only manually entered project-owned composition definitions.

Conceptual shape:

```text
app.project.supportMaterialCompositions[]
  supportType
  components[]
    name
    quantityPerSupport
    unit
```

Normalization implemented for newly entered data:

- `supportType`: trimmed non-empty string;
- `name`: trimmed non-empty string;
- `quantityPerSupport`: finite number greater than zero;
- `unit`: trimmed non-empty string;
- no default support type;
- no default material name;
- no default quantity;
- no default unit.

A normalized support type resolves to the matching project composition; the implementation does not create a second route-owned material-composition authority.

## BP-019 / BP-020 reuse

BP-021 derives material preparation from:

`_getCableTraySupportPreparationV1().rows`

Therefore BP-019 remains the support-count authority.

BP-020 remains the support-type authority through the support rows' normalized `supportType`.

BP-021 does not independently derive route geometry, route length, support spacing, support positions, or support count.

## Derived-state boundary

For each valid composition component, BP-021 derives at runtime:

`derivedQuantity = supportCount * quantityPerSupport`

The following are not persisted by BP-021:

- `supportCount`;
- `derivedQuantity`;
- aggregate support-material totals;
- generated support-material output rows;
- route-local copies of the composition.

A missing/undetermined support type remains unresolved.

A determined support type without a valid composition remains unresolved.

BP-021 does not silently replace either state with guessed hardware or default values.

## BP-018 boundary

BP-018 remains unchanged.

`_getCableTrayMaterialOutputRowsV1()` continues to project only its existing cable-tray/basic-accessory material preparation:

- Kabelrinne;
- Deckel;
- Trennsteg.

BP-021 support material is not silently added to BP-018 CSV output.

Any combined CSV/XLSX/PDF/material export remains a separately authorized future capability.

## Assembly BOM boundary

BP-021 does not use `assembly.instance.bom` as support-material authority.

It does not copy Assembly BOM rows to cable-tray routes and does not merge support material into Assembly BOM.

Existing Assembly/AssemblyLab manufacturer/article/quantity/unit semantics remain separate from BP-021.

## Focused regression protection

`tests/bp-021-support-material-composition.spec.js` protects the V1 contract, including:

- project-owned `supportMaterialCompositions`;
- existing project-save request;
- reuse of BP-019 support preparation;
- runtime-only derived quantity;
- explicit unresolved states;
- no route-local support-material copy;
- no Assembly BOM authority;
- no manufacturer/article/Hilti/Niedax mapping;
- no BP-018 support-material output.

## Exact-head Product CI evidence

Exact functional head:

`ced5162594184cde47e9716058932c6958ec8554`

GitHub Actions evidence:

- Workflow: **Product CI**
- Run: **#1425**
- Run ID: `36421820523`
- Event: `push`
- Branch: `feature/BP-021-manual-support-material-composition`
- Head SHA: `ced5162594184cde47e9716058932c6958ec8554`
- Attempt: `1`
- Status: `completed`
- Conclusion: **success**

The Exact-Head Product CI is therefore fully green for the frozen functional state.

## Explicit retained non-scope

The freeze does not add or infer:

- predefined C-rail lengths or quantities;
- consoles/brackets;
- threaded rods;
- clamps or beam/Keddy clamps;
- wall clips;
- screws, anchors, or dowels;
- manufacturer/article mapping;
- Hilti/Niedax catalogues;
- prices, suppliers, inventory, or purchasing optimization;
- waste/offcut or packaging calculations for support components;
- automatic unit conversion;
- Assembly BOM merge;
- BP-018 support-material CSV rows;
- XLSX/PDF output;
- automatic/default support types or material compositions;
- support positions or 2D/3D placement;
- mounting-plane classification;
- load/weight/structural calculations;
- special support rules near fittings/endpoints;
- fittings/connectors/bends/T-pieces/reducers/form parts;
- automatic 3D materialization.

## Freeze decision

BP-021 – Manual Support Material Composition is **FROZEN** at functional head:

`ced5162594184cde47e9716058932c6958ec8554`

The implementation satisfies the authorized minimal contract and has a fully green Exact-Head Product CI #1425.

This completion document may create a documentation-only branch head after the functional freeze head. That documentation-only head does not alter the verified BP-021 product/test state.

No integration to `main` is authorized by this gate.
