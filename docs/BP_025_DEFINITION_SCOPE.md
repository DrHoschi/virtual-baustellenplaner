# BP-025 – Fitting Material Output Integration – Definition / Scope

## Status

**DEFINED / SCOPED / NOT IMPLEMENTED**

Authoritative definition base:

`main = 3e3532780c80ba2a83755370e780e0e3252a8be3`

This gate defines BP-025 only. It does not authorize implementation, test-code changes, feature-branch creation, persistence changes, new material authority or new fitting recognition.

## Purpose

BP-024 already derives neutral fitting-material preparation from the explicit BP-023 fitting authority.

BP-022 already provides a combined practical cable-tray material output and CSV for cable-tray/basic-accessory material plus support material.

BP-025 closes only the remaining output gap:

**existing BP-024 fitting-material rows → existing BP-022 combined material-output projection**

BP-025 is an output integration capability only.

## Central authority rule

The binding BP-025 rule is:

**consume BP-024 rows only – never recount BP-023 or infer from geometry**

BP-025 must not read BP-023 fitting records in order to calculate fitting quantities.

BP-025 must not scan cable-tray route geometry.

BP-025 must not independently validate fitting topology.

The only fitting-material quantity input for BP-025 is the already-derived:

`_getCableTrayFittingMaterialPreparationV1().rows`

BP-024 remains authoritative for deciding which explicit BP-023 fittings contribute material and for grouping their quantities.

## Existing authorities retained

The following authorities remain unchanged:

- `app.project.workspace.scene.cableTrayFittings[]` remains the BP-023 fitting-planning authority.
- `cable-tray.route.points[]` remains the sole cable-tray geometry authority.
- BP-023 remains authoritative for explicit fitting identity/topology and fitting validation.
- BP-024 remains authoritative for runtime-derived fitting-material rows and unresolved fitting diagnostics.
- BP-016/BP-017 remain authoritative for cable-tray/basic-accessory preparation.
- BP-018 remains authoritative for its existing Material CSV.
- BP-019/BP-020/BP-021 remain authoritative for support planning and support-material preparation.
- BP-022 remains the combined material-output/CSV projection being extended by BP-025.
- Assembly/AssemblyLab BOM remains separate.

BP-025 creates none of these authorities again.

## Input contract

BP-025 consumes only the `rows` member of:

`_getCableTrayFittingMaterialPreparationV1()`

The current BP-024 row contract supplies:

- `kind`
- `name`
- `unit`
- `quantity`

Current neutral BP-024 names are:

- `bend` → `Bogen`
- `tee` → `T-Stück`
- `reducer` → `Reduzierung`
- `connector` → `Verbinder`

Current unit is `Stk`.

BP-025 copies these already-derived semantics into the combined output. It must not independently recreate the kind-to-name mapping as a second fitting-material authority when the BP-024 row already provides the display name and unit.

## Combined output mapping

BP-025 extends the existing BP-022 neutral combined-output row shape without adding columns.

For each BP-024 fitting-material row:

- `Kategorie = Formteil`
- `Bezeichnung = BP-024 row.name`
- `Einheit = BP-024 row.unit`
- `Menge = BP-024 row.quantity`
- `Stützart = empty / null`
- `Trassentyp = empty / null`
- `Breite_mm = empty / null`
- `Planlaenge_m = empty / null`
- `Stangenlaenge_m = empty / null`
- `Anzahl_Stangen = empty / null`
- `Einkaufslaenge_m = empty / null`
- `Verschnitt_m = empty / null`

No fitting-specific CSV column is required for BP-025 V1.

The fitting kind remains upstream BP-024 provenance and does not require a new exported column because the current neutral fitting name identifies the V1 group.

## Minimal integration point

The intended minimal integration surface is the existing:

`_getCombinedCableTrayMaterialOutputRowsV1()`

Today that projection combines existing tray/basic-accessory rows and support-material rows.

BP-025 may add a third source:

`const fittingRows = this._getCableTrayFittingMaterialPreparationV1().rows;`

and project those rows into the existing neutral combined-output shape.

The exact local variable names are implementation scope.

BP-025 must not modify upstream BP-024 counting semantics.

## No recount / no double counting

BP-025 performs no fitting count of its own.

It must not calculate quantity by:

- iterating `scene.cableTrayFittings[]`;
- counting BP-023 records;
- calling BP-023 validation per fitting;
- counting fitting connections;
- counting route points;
- counting corners;
- counting route intersections;
- counting coincident endpoints;
- counting width/type transitions.

For fitting rows:

`Menge = BP-024 row.quantity`

must be a direct projection.

BP-025 must not increment, multiply, merge with an independently calculated fitting count or add a second geometry-derived quantity.

This guarantees that a valid explicit fitting counted once by BP-024 is represented once in the combined output.

## Geometry boundary

Geometry never creates BP-025 material.

BP-025 must not use:

- route angles;
- 90-degree corners;
- route intersections;
- route meetings;
- route length;
- endpoint coincidence;
- distance/tolerance;
- `widthMm`;
- `trayType`;
- cable assignments;
- equipment bindings

to create, classify, validate or count a fitting row.

A geometric condition without a BP-024 material row contributes no BP-025 fitting material.

## Unresolved / invalid fitting boundary

BP-024 owns unresolved fitting handling.

Its `unresolvedCount` is diagnostic state, not material.

BP-025 consumes only BP-024 `rows`, therefore unresolved/invalid BP-023 fittings are already absent from the fitting-material input.

BP-025 must not turn `unresolvedCount` into:

- a material row;
- a zero-quantity row;
- a guessed fitting;
- an extra quantity;
- an exported pseudo-item.

The existing BP-024 UI may continue to expose unresolved fitting diagnostics separately.

## BP-022 output extension boundary

BP-025 extends only the existing BP-022 combined material projection and its existing Gesamtmaterial CSV delivery path.

The existing combined CSV headers remain:

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

BP-025 adds no header and creates no new export/download mechanism.

The existing `_makeCombinedCableTrayMaterialCSVV1(...)` may consume the extended combined rows without fitting-specific calculation.

## BP-018 compatibility boundary

BP-018 remains frozen and unchanged.

BP-025 must not modify:

- `_getCableTrayMaterialOutputRowsV1()`;
- `_makeCableTrayMaterialCSVV1(...)`;
- the existing **Material CSV** semantics.

Formteile are added only to the BP-022 **Gesamtmaterial CSV** path.

This preserves the distinction between the older cable-tray material CSV and the later combined practical material output.

## Non-applicable field semantics

For BP-024 fitting rows, fields not supplied by BP-024 remain empty/null.

BP-025 must not backfill them from connected routes.

In particular it must not infer or copy:

- `Stützart`;
- `Trassentyp`;
- `Breite_mm`;
- planned route length;
- stick length;
- stick count;
- purchase length;
- offcut.

Empty means not applicable / not supplied by the authoritative BP-024 source, not numeric zero.

## Material identity boundary

`Kategorie = Formteil` and `Bezeichnung = Bogen/T-Stück/Reduzierung/Verbinder` are neutral output semantics only.

They are not manufacturer/article identity.

BP-025 does not establish that all rows or pieces with the same neutral name are necessarily the same purchasable article.

BP-025 does not add or infer:

- manufacturer;
- article number;
- catalogue/material ID;
- supplier;
- price;
- inventory;
- package quantity;
- order unit;
- dimensions;
- bend angle/radius;
- width-specific fitting variant;
- tray-type-specific fitting variant;
- reducer dimensions;
- connector subtype.

## Persistence boundary

BP-025 adds no persistent project state.

It must not persist:

- combined fitting-output rows;
- fitting quantities;
- CSV content;
- copied BP-024 rows;
- output totals;
- output categories;
- derived material identity.

The combined output remains runtime-derived/output state.

## Existing support/basic material isolation

BP-025 must not alter the existing calculations or authorities for:

- Kabelrinne;
- Deckel;
- Trennsteg;
- Unterstützungsmaterial.

It only appends/projects BP-024 fitting rows into the combined output.

No cross-source consolidation is authorized.

Equal names or units across sources are not sufficient material identity for merging.

## Focused regression requirements

A future BP-025 implementation must have focused regression protection proving at minimum:

1. the combined output consumes `_getCableTrayFittingMaterialPreparationV1().rows`;
2. it does not independently scan `scene.cableTrayFittings`;
3. it does not independently call BP-023 fitting validation to count output material;
4. a BP-024 row maps directly to `Kategorie=Formteil`, its existing name/unit/quantity, and empty non-applicable fields;
5. BP-024 `unresolvedCount` does not create a material row;
6. BP-018 Material CSV remains unchanged;
7. the existing Gesamtmaterial CSV includes the projected fitting rows through the existing combined-output path;
8. no geometry-based fitting recognition or quantity calculation is introduced.

The exact test file and CI wiring are implementation-scope decisions.

## Explicit non-scope

BP-025 does not implement:

- fitting recognition;
- fitting suggestions;
- fitting creation/editing;
- BP-023 topology changes;
- BP-024 counting changes;
- geometry-derived fittings;
- independent fitting validation;
- new fitting material preparation;
- BP-018 Material CSV integration;
- new CSV/export format;
- new CSV columns;
- XLSX/PDF output;
- manufacturer/article/catalogue identity;
- fitting BOM;
- prices/suppliers/inventory;
- package/order optimization;
- fitting dimensions;
- width/type-specific article selection;
- support changes near fittings;
- fitting mounting hardware;
- route point IDs/migration;
- route splitting/merging;
- cable-routing changes;
- 3D fittings;
- EPLAN coupling;
- Assembly BOM merge.

## Required implementation-scope reconciliation

Before implementation authorization, a separate read-only reconciliation must verify against the then-current exact `main`:

1. the smallest change inside `_getCombinedCableTrayMaterialOutputRowsV1()`;
2. that `_makeCombinedCableTrayMaterialCSVV1(...)` requires no fitting-specific change;
3. the exact null/empty projection for non-applicable fields;
4. the focused BP-025 regression-test surface;
5. whether Product CI needs explicit BP-025 test wiring;
6. that no product surface outside the combined-output path needs modification.

## Definition decision

**BP-025 – Fitting Material Output Integration: DEFINED**

The binding V1 contract is:

**BP-025 consumes only the already-derived BP-024 fitting-material rows and projects them into the existing BP-022 Gesamtmaterial output. It never recounts BP-023 fittings and never infers fittings from geometry.**

The existing BP-022 columns are sufficient. Formteil rows use `Kategorie=Formteil`, preserve BP-024 `name`, `unit` and `quantity`, and leave all non-applicable tray/support fields empty.

BP-018 Material CSV remains unchanged.

**Definition / Scope Gate: PASS**

No implementation, test-code change or feature-branch creation is authorized by this document.
