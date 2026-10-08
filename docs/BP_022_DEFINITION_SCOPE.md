# BP-022 – Practical Combined Cable-Tray Material Output – Definition / Scope

## Status

**DEFINITION / DOCUMENTATION ONLY – NO IMPLEMENTATION AUTHORIZED**

Authoritative definition base:

`main = e1bd8871379d233cd4579c63abab54c07c940d78`

This gate defines the minimal BP-022 combined-output contract only. It does not authorize product-code changes, test implementation, export implementation, or creation of a feature branch.

## Purpose

BP-016/BP-017 already derive practical cable-tray basic/accessory material preparation.

BP-018 already projects those derived rows into the existing cable-tray material CSV.

BP-021 separately derives support-material quantities from the BP-019 support count, BP-020 support type, and project-owned manual support-material composition.

BP-022 closes only the output gap between these already existing authorities:

**existing BP-016/BP-017 material preparation + existing BP-021 support-material preparation → one combined practical material-output projection and CSV**

BP-022 introduces no new material, geometry, BOM, support, purchasing, or persistence authority.

## Existing authorities retained

The following authorities remain unchanged:

- `cable-tray.route.points[]` remains the sole cable-tray route geometry authority.
- BP-016 remains authoritative for derived basic cable-tray material preparation.
- BP-017 remains authoritative for derived cover/divider accessory preparation.
- BP-018 remains authoritative for its existing Kabelrinne/Deckel/Trennsteg CSV projection and is not redefined by BP-022.
- BP-019 remains authoritative for derived support quantity.
- BP-020 remains authoritative for route-owned `tray.supportType`.
- BP-021 `app.project.supportMaterialCompositions[]` remains the sole persistent support-material-composition authority.
- BP-021 remains authoritative for runtime-derived support-material quantities.
- Assembly/AssemblyLab BOM remains a separate authority.

BP-022 consumes these existing derived states only.

## No new persistent authority

BP-022 adds **no persistent project data**.

The combined output rows and generated CSV are runtime-derived/output state only.

BP-022 must not persist:

- combined output rows;
- exported quantities;
- copied BP-016/BP-017 preparation rows;
- copied BP-021 support-material rows;
- aggregate totals;
- material identities;
- CSV content;
- route-local output state.

## Input projections

BP-022 V1 consumes only:

1. existing BP-016/BP-017-derived material information already used by BP-018; and
2. existing `_getCableTraySupportMaterialPreparationV1().rows` from BP-021.

BP-022 must not rescan route geometry or independently recalculate:

- route length;
- 3 m stick requirements;
- purchase length;
- offcut;
- support spacing;
- support count;
- support-material quantity per support;
- support-material derived quantity.

## Combined output row contract

BP-022 requires one neutral output shape capable of representing both stick-based cable-tray material and freely unitized support material.

Core columns:

1. `Kategorie`
2. `Bezeichnung`
3. `Einheit`
4. `Menge`

Optional provenance/planning-detail columns:

5. `Stützart`
6. `Trassentyp`
7. `Breite_mm`
8. `Planlaenge_m`
9. `Stangenlaenge_m`
10. `Anzahl_Stangen`
11. `Einkaufslaenge_m`
12. `Verschnitt_m`

The exact internal property names are implementation scope. The semantic column contract above is authoritative for V1.

## Category projection

Existing basic/accessory material keeps its existing semantic categories:

- BP-016 base material → `Kabelrinne`
- BP-017 cover → `Deckel`
- BP-017 divider → `Trennsteg`

BP-021-derived support material uses:

- BP-021 component row → `Unterstützungsmaterial`

BP-022 does not create manufacturer-specific or article-specific categories.

## Basic/accessory row semantics

For Kabelrinne/Deckel/Trennsteg rows, BP-022 copies the existing upstream/BP-018-derived planning values.

Where the existing preparation already provides the applicable quantity/purchasing information, BP-022 projects it without recomputation.

For the neutral `Einheit` / `Menge` columns, V1 may represent the existing purchasing quantity using the already derived purchasing semantics. The implementation gate must map this deterministically from existing fields and must not introduce a new stick-length or purchasing calculation.

The detailed BP-018 planning columns remain available so the existing 3 m planning evidence is not lost.

## Support-material row semantics

For BP-021 support material:

- `Kategorie = Unterstützungsmaterial`
- `Bezeichnung = BP-021 component name`
- `Einheit = BP-021 component unit`
- `Menge = BP-021 derivedQuantity`
- `Stützart = BP-021 supportType`

BP-022 copies `derivedQuantity`; it must not recalculate `supportCount * quantityPerSupport` as an independent output authority.

Stick-specific/tray-specific planning fields are not applicable unless already supplied by an authoritative upstream projection.

BP-022 must not derive them from the component name or unit.

## Null / empty semantics

A field that is not applicable to a source row is exported as an empty field.

It must not be replaced with:

- numeric zero;
- `0 m`;
- `0 Stk`;
- guessed width;
- guessed tray type;
- guessed support type;
- guessed stick length;
- guessed purchasing length;
- guessed offcut.

Empty means **not applicable / not supplied by the authoritative source**, not zero.

Missing upstream rows do not create artificial zero rows.

## Unresolved BP-021 state

BP-021 may report unresolved support-material preparation, for example:

- support type undetermined;
- no valid project composition for a determined support type.

BP-022 must not convert unresolved support material into a material row with zero quantity or guessed hardware.

The combined output may surface an unresolved count/status separately from material rows, but unresolved state is not purchasing material.

## Provenance boundary

BP-022 must preserve enough provenance to avoid presenting unlike material as one authoritative item.

In V1:

- BP-016/BP-017 rows retain their existing category/tray planning context.
- BP-021 rows retain `supportType` through `Stützart`.

BP-022 must not discard `supportType` and then claim that equally named support components from different support types are necessarily the same physical material.

## Aggregation boundary

BP-022 V1 must not perform aggressive cross-source or cross-support-type material consolidation.

In particular, equal `Bezeichnung` text alone is not a sufficient material identity.

Without a separately authorized article/material identity, BP-022 must not assume that:

- same name = same article;
- same name + same unit = same technical material;
- same support component name across different support types can safely be merged.

Rows may remain separate by source/provenance.

A future article/material-identity capability may authorize stronger consolidation.

## BP-018 compatibility boundary

BP-018 remains frozen and unchanged.

BP-022 must not silently modify the semantics of:

- `_getCableTrayMaterialOutputRowsV1()`;
- `_makeCableTrayMaterialCSVV1(...)`;
- the existing **Material CSV** output.

BP-022 receives its own combined derived-output projection and its own combined CSV delivery path.

This preserves the existing BP-018 regression contract while adding a new practical output.

## BP-021 compatibility boundary

BP-021 remains frozen and unchanged as the support-material composition/preparation authority.

BP-022 must not:

- persist support-material totals;
- modify `app.project.supportMaterialCompositions[]`;
- add default components;
- infer component quantities;
- infer units;
- reinterpret component names as technical/catalog identities.

## Assembly BOM boundary

BP-022 does not merge with `assembly.instance.bom` and does not make Assembly/AssemblyLab BOM a combined material-output authority.

No Assembly BOM rows are included in BP-022 V1.

## CSV delivery contract

BP-022 V1 provides a separate combined CSV representation of the combined output rows.

It may reuse existing generic text-download/clipboard delivery helpers.

It must not introduce a second filesystem/download authority.

The CSV is an output projection only and does not become persistent project state.

## Explicit non-scope

BP-022 does not add or infer:

- manufacturer;
- article number;
- catalogue/material ID;
- Hilti/Niedax or other manufacturer mapping;
- prices;
- suppliers;
- inventory/stock;
- purchasing orders;
- reserve/uplift factors;
- manual output corrections/overrides;
- automatic material substitution;
- automatic unit conversion;
- packaging quantities;
- new waste/offcut calculations;
- new stick-length calculations;
- support spacing or support-count calculations;
- support-material composition;
- C-rail lengths not manually defined upstream;
- console/bracket rules;
- threaded-rod rules;
- clamp/beam/Keddy clamp rules;
- screw/anchor/dowel rules;
- support positions;
- mounting-plane classification;
- load/weight/structural calculations;
- fittings/connectors/bends/T-pieces/reducers/form parts;
- Assembly BOM merge;
- cross-source article consolidation;
- XLSX output;
- PDF output;
- automatic 3D materialization.

## Implementation boundary

Before implementation, a separate authorization must create a feature branch from the then-authorized exact base.

The minimal implementation must:

1. consume existing BP-016/BP-017 material preparation without recomputation;
2. consume existing BP-021 support-material preparation without recomputation;
3. project both into a neutral combined output row shape;
4. preserve source/provenance semantics;
5. keep non-applicable fields empty;
6. expose a separate combined CSV output;
7. reuse existing generic delivery helpers where applicable;
8. leave BP-018, BP-021, and Assembly BOM authorities unchanged.

No implementation is authorized by this document.

## Definition decision

BP-022 is defined as **Practical Combined Cable-Tray Material Output**.

It is a derived output capability only.

It combines already-authoritative cable-tray/basic-accessory and support-material preparation into a practical CSV without creating a new material authority or inventing technical material.

**Definition / Documentation Gate: PASS**

**0 product-code changes, 0 test-code changes, and 0 feature-branch creation are authorized by this document.**
