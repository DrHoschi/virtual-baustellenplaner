# BP-022 – Practical Combined Cable-Tray Material Output – Completion / Evidence / Freeze

## Status

**FROZEN**

Functional freeze head:

`2c46bf328a47f57d5a31bc1f20d0ef5686b7fd1f`

Feature branch:

`feature/BP-022-practical-combined-cable-tray-material-output`

This document records completion evidence only. It does not extend BP-022 scope and does not authorize integration to `main`.

## Definition authority

BP-022 is defined by:

`docs/BP_022_DEFINITION_SCOPE.md`

Authorized implementation base:

`b867768987d94d5bcf7cfd4bfee8913b58dc0b64`

BP-022 closes one output gap only:

**existing BP-016/BP-017/BP-018 cable-tray material projection + existing BP-021 support-material preparation → one separate combined practical material-output CSV**

It introduces no new geometry, material, BOM, support, purchasing, or persistence authority.

## Implementation commits

Product implementation:

`d013b675e83c305d1ff68c57c47189a9b7de95d7`

Focused contract-test commit / functional head:

`2c46bf328a47f57d5a31bc1f20d0ef5686b7fd1f`

Compared with authorized base `b867768987d94d5bcf7cfd4bfee8913b58dc0b64`, the functional head is exactly:

- 2 commits ahead;
- 0 commits behind;
- merge base exactly the authorized base;
- `ui/panels/WorkareaPanel.base.js`: +101 / -0;
- `tests/bp-022-combined-cable-tray-material-output.spec.js`: +44 / -0.

No unrelated files are part of the functional BP-022 diff.

## Existing authority reuse

The combined projection consumes:

`_getCableTrayMaterialOutputRowsV1()`

for the existing BP-018 cable-tray/basic-accessory material output, and:

`_getCableTraySupportMaterialPreparationV1().rows`

for BP-021 support material.

BP-022 does not rescan route geometry and does not independently derive:

- route length;
- stick count;
- stick length;
- purchase length;
- offcut;
- support spacing;
- support count;
- quantity per support;
- support-material derived quantity.

For support material, BP-022 copies the existing BP-021 `derivedQuantity`.

## Combined output contract

BP-022 adds:

`_getCombinedCableTrayMaterialOutputRowsV1()`

The neutral combined projection carries:

- category;
- name;
- unit;
- quantity;
- support type provenance;
- existing tray planning details where applicable.

CSV headers are:

1. `Kategorie`
2. `Bezeichnung`
3. `Einheit`
4. `Menge`
5. `Stützart`
6. `Trassentyp`
7. `Breite_mm`
8. `Planlaenge_m`
9. `Stangenlaenge_m`
10. `Anzahl_Stangen`
11. `Einkaufslaenge_m`
12. `Verschnitt_m`

## Cable-tray/basic-accessory semantics

BP-018-derived rows retain their existing category and planning context.

BP-022 maps the already-derived purchasing length to the neutral quantity representation without introducing a new stick or purchasing calculation.

The existing detailed BP-018 planning fields remain present in the combined projection.

## Support-material semantics

BP-021 support material is projected as:

- category: `Unterstützungsmaterial`;
- name: existing BP-021 component name;
- unit: existing BP-021 component unit;
- quantity: existing BP-021 `derivedQuantity`;
- support type: existing BP-021 `supportType`.

BP-022 does not independently calculate `supportCount * quantityPerSupport`.

## Null / empty semantics

For support-material rows, non-applicable tray/stick fields are explicitly represented as `null` in the derived row:

- tray type;
- width;
- planned length;
- stick length;
- required stick count;
- purchase length;
- offcut.

The combined CSV serializes these non-applicable values as empty fields.

BP-022 does not replace them with zero or guessed technical values.

## Provenance / aggregation boundary

BP-021 `supportType` is retained as `Stützart`.

BP-022 performs no cross-source or cross-support-type consolidation.

Equal material/component names are not treated as a technical material identity.

No manufacturer/article identity is inferred.

## BP-018 compatibility

BP-018 remains unchanged.

The existing:

- `_getCableTrayMaterialOutputRowsV1()`;
- `_makeCableTrayMaterialCSVV1(...)`;
- `_exportCableTrayMaterialCSVV1()`;
- **Material CSV** UI path

remain present.

BP-022 adds a separate:

- `_getCombinedCableTrayMaterialOutputRowsV1()`;
- `_makeCombinedCableTrayMaterialCSVV1(...)`;
- `_exportCombinedCableTrayMaterialCSVV1()`;
- **Gesamtmaterial CSV** UI path.

BP-022 therefore does not silently redefine the frozen BP-018 export.

## BP-021 compatibility

BP-021 remains the support-material composition and derived-quantity authority.

BP-022 does not modify or persist `app.project.supportMaterialCompositions[]`, add defaults, infer components, infer units, or persist derived support-material totals.

## Persistence / BOM boundary

BP-022 adds no project persistence.

Combined rows and CSV content are runtime/output state only.

BP-022 does not use or merge `assembly.instance.bom`.

## Delivery

The separate combined CSV reuses the existing generic delivery helpers:

- `_downloadTextFileV1(...)`;
- `_copyToClipboard(...)`.

No new filesystem/download authority was introduced.

## Focused regression evidence

Focused test:

`tests/bp-022-combined-cable-tray-material-output.spec.js`

The test protects that BP-022:

- consumes BP-018 output rows;
- consumes BP-021 support-material preparation rows;
- uses BP-021 `derivedQuantity`;
- retains `supportType`;
- does not call the route evaluation as a second authority;
- does not introduce `Math.ceil` purchasing/support recomputation;
- does not consume `supportMaterialCompositions` directly;
- does not introduce manufacturer/article/supplier/price/inventory/Assembly-BOM authority;
- exposes the defined combined CSV headers;
- keeps non-applicable support tray/stick fields null;
- adds the separate **Gesamtmaterial CSV** path;
- retains the existing **Material CSV** path and BP-018 helpers.

## Exact-head Product CI evidence

Exact functional head:

`2c46bf328a47f57d5a31bc1f20d0ef5686b7fd1f`

GitHub Actions evidence:

- Workflow: **Product CI**
- Run: **#1431**
- Run ID: `36425002296`
- Event: `push`
- Branch: `feature/BP-022-practical-combined-cable-tray-material-output`
- Head SHA: `2c46bf328a47f57d5a31bc1f20d0ef5686b7fd1f`
- Attempt: `1`
- Status: `completed`
- Conclusion: **success**
- Started: `2026-09-28T12:55:36Z`
- Completed/updated: `2026-09-28T12:56:41Z`

The Exact-Head Product CI is therefore fully green for the frozen functional state.

## Retained non-scope

BP-022 does not add or infer:

- manufacturer;
- article number;
- catalogue/material ID;
- Hilti/Niedax mapping;
- prices;
- suppliers;
- inventory/stock;
- purchase orders;
- reserve/uplift factors;
- manual output corrections;
- automatic material substitution;
- automatic unit conversion;
- packaging quantities;
- new waste/offcut calculations;
- new stick-length calculations;
- support spacing/count calculations;
- support-material composition;
- automatically inferred C-rail lengths;
- consoles/brackets;
- threaded rods;
- clamps/Keddy/beam clamps;
- screws/anchors/dowels;
- support positions;
- mounting planes;
- structural/load calculation;
- fittings/form parts;
- Assembly BOM merge;
- cross-source article consolidation;
- XLSX;
- PDF;
- automatic 3D materialization.

## Freeze decision

BP-022 – Practical Combined Cable-Tray Material Output is **FROZEN** at functional head:

`2c46bf328a47f57d5a31bc1f20d0ef5686b7fd1f`

The implementation satisfies the authorized minimal contract and has fully green Exact-Head Product CI #1431.

This completion document is evidence/metadata only. Its commit becomes the full BP-022 branch/freeze head while the functional freeze remains `2c46bf328a47f57d5a31bc1f20d0ef5686b7fd1f`.

No integration to `main` is authorized by this gate.
