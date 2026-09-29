# BP-027 – Practical Material Assignment / Article Selection UI
## Completion / Evidence / Freeze

Status: **FROZEN**

### Functional Freeze
- Functional freeze head: `ab4774ec07f319927c730d7e5b0c7f3afad08dda`
- Authorized base: `ca4b48872e162152148b0230dc0a91da74f707a0`
- Feature branch: `feature/BP-027-practical-material-assignment-ui`

## Completed Scope

BP-027 makes the BP-026 material identity authority operable through a responsive manual material-assignment UI.

The workflow is:

`Trassenplanung → Materialzuordnung → Bedarfsposition → Artikel auswählen/ändern → Projekt speichern → Reload`

The implementation:
- exposes one shared material-assignment function through desktop/tablet and mobile-reachable entry controls;
- uses the existing responsive Workarea modal;
- lists existing material needs only;
- reads article choices exclusively from the global BP-026 material catalog;
- supports explicit unassignment through `Nicht zugeordnet`;
- keeps material need and quantity authorities unchanged;
- does not enrich existing CSV outputs.

## Persistence Authorities

BP-027 preserves the two previously defined authorities.

### Tray / accessory / fitting

Assignments are persisted through:

`app.project.materialMappings[]`

The BP-027 setter updates/replaces the matching authoritative mapping key and removes matching mappings when unassigned. It does not create a second material authority.

### Support material

Support assignments remain part of the existing BP-021 composition:

`app.project.supportMaterialCompositions[].components[].materialId`

BP-027 updates only the `materialId` of an existing support component. It does not append a new component and does not alter `name`, `quantityPerSupport`, `unit`, support count, or derived quantity authority.

Both write paths use the existing project store and `_requestProjectSaveDebounced("material-assignment")`. Manufacturer/article master data is not copied into project state.

## Responsive / Mobile Evidence

The normal desktop/tablet entry is `Materialzuordnung`.

Because `.wa-info-group` is hidden in the compact mobile layout, BP-027 also exposes the same underlying command as `Material` in the mobile-visible mode group. Both entries invoke the same `_openCableTrayMaterialAssignmentV1()` function and therefore do not create a second UI or data authority.

The assignment dialog uses the existing Workarea modal. BP-027-specific CSS collapses assignment rows to one column at `max-width: 820px`, keeps selects width-constrained to the dialog, and avoids a required horizontal table layout.

## Material Catalog Boundary

Article choices come only from the existing global BP-026 material catalog.

An empty global catalog is valid and produces the explicit empty state:

`Keine Materialartikel im globalen Katalog vorhanden.`

No Niedax, Hilti, manufacturer article number, substitute, price, supplier, or technical variant is invented by BP-027.

## Quantity / Planning Boundary

BP-027 does not own planning or material quantities.

Existing authorities remain responsible for route geometry, tray/accessory material preparation, support planning/composition, fitting preparation, stick semantics, and material quantities.

Selecting or removing a material article does not change the underlying material need.

## BP-019 Regression-Test Boundary Fix

The first Exact-Head Product CI exposed an obsolete BP-019 static-test boundary. The BP-019 test sliced source from `_getCableTraySupportPreparationV1()` through `_getCableTrayMaterialOutputRowsV1()`, which had come to include later BP-021/BP-026/BP-027 material-identity code.

The separately reconciled and authorized fix changed only that slice end to:

`_getSupportMaterialCompositionsV1()`

This restores the BP-019 regression test to its own authority boundary: route-owned support spacing and derived support count.

The existing negative assertion was not weakened or removed. Product code was not changed by this blocker fix.

Boundary-fix commit:
`ab4774ec07f319927c730d7e5b0c7f3afad08dda`

## Verification Evidence

Implementation Verification / Scope / Regression Gate: **PASS**

Exact functional head:
`ab4774ec07f319927c730d7e5b0c7f3afad08dda`

Exact-Head Product CI:
- Workflow: `Product CI`
- Run number: `#1468`
- Run ID: `36544065081`
- Head SHA: `ab4774ec07f319927c730d7e5b0c7f3afad08dda`
- Status: `completed`
- Conclusion: **success**

The successful run includes the corrected BP-019 regression and the subsequent BP-018, BP-017, BP-024, UI migration, UI wiring E2E, and smoke-test steps.

## Freeze Decision

BP-027 is **FROZEN** at functional head:

`ab4774ec07f319927c730d7e5b0c7f3afad08dda`

This completion document records evidence only and does not change the functional freeze.

No integration to `main` is part of this gate.
