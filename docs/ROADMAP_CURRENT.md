# ROADMAP CURRENT

Current product roadmap for Baustellenplaner.

This document answers one question: what do we build next to make the program practically useful? It is product authority together with `PROJECT_STATUS_CURRENT.md` and `CI_AUTHORITY_CURRENT.md`.

## Product objective
A fast practical hall/construction planning workflow:

`Project -> define hall -> Planning/Workarea -> place equipment/assets/assemblies -> edit -> save/reload -> connect routes/cables -> calculate lengths/material -> present/export in 2D/3D`

The roadmap extends the existing product. It must not replace Hall3D, Workarea, AssetLab, project persistence, or their established authorities with parallel implementations.

## R0 – Authority reset / current baseline
Status: CURRENT DOCUMENTATION STEP.

Goal:
- one current product-status authority;
- one current product roadmap;
- one current CI authority;
- historical UI-MIG / TECH-WA / PROJECT-UI gates no longer decide current product acceptance merely because they still exist.

Exit: the three current authority documents exist together on the BP-002 branch and reference the same product line.

## R1 – Practical Planning Core
Priority: NEXT PRODUCT CAPABILITY.

Goal: Planning must be reliably usable for real work, not merely reachable.

Required product contract:
- open/create project and define/edit hall;
- open Planning/Workarea with the current hall context;
- insert an Asset or Assembly/Baugruppe;
- select it;
- move and rotate it;
- save;
- reload/reopen project;
- geometry and object state remain;
- iPhone and iPad remain separately testable where UI differs.

Already available and to preserve: Workarea canvas engine, scene persistence, Asset/Assembly access, Hall Context, pan/zoom/selection/drag, current quota correction.

R1 is complete only when the complete user path above passes as one current-product E2E contract.

## R2 – Planning Object Library / Profiles / Equipment
Goal: make Planning useful with real reusable planning objects.

Scope direction:
- standardized profiles and parameterized objects;
- equipment/device library with article/technical metadata;
- reusable Assemblies/Baugruppen;
- clear footprint/origin/ports where required;
- models/assets remain linked to project/library ownership rather than copied into competing stores.

Examples include conveyor equipment, cameras, switches, cable-tray components, supports/profiles and later project-specific devices.

## R3 – Routes / Cable Trays / Connections
Goal: plan physical routes between equipment.

Scope direction:
- ports/connection points;
- route/cable-tray geometry;
- 2D/3D spline/path editing;
- path snapping/assistance without removing manual fine adjustment;
- path lengths based on actual geometry;
- configurable endpoint/service allowances.

## R4 – Quantities / Lengths / BOM
Goal: turn the drawing into useful material information.

Scope direction:
- cable and route lengths;
- profile/tray/component quantities;
- assembly BOM integration;
- configurable waste/reserve percentages;
- exportable material/quantity view suitable for preparation and quotation.

## R5 – Hall3D / Presentation / Digital-Twin Expansion
Goal: use the preserved Hall3D capability as the 3D presentation and later digital-twin context.

Scope direction:
- synchronized hall and placed equipment representation;
- camera/viewer perspectives;
- installation visualization;
- customer presentation/export;
- later operational overlays.

Hall3D is preserved product capability throughout R1-R4; R5 is an expansion, not its resurrection.

## R6 – Domain Modules / Later Extensions
Examples, not current implementation authorization:
- thermal camera / Brandwächter planning;
- fire-service viewer;
- fire-source and access-route visualization;
- fill-level/environmental context;
- maintenance/service documentation;
- TIA/PLC or other simulation/data interfaces where useful.

These remain later modules and must not block the practical planning core.

## Technical debt lane
Technical work may run before a roadmap capability only when it blocks that capability or threatens data integrity.

Known debt:
- current generic smoke 404;
- historical workflow sprawl;
- large `WorkareaPanel.base.js` / `AssetLab3DPanel.js` files;
- future storage migration/cleanup policy if required.

Debt is not automatically the next product block. Refactoring must have an explicit reason and regression contract.

## Development cadence
For each roadmap capability:
1. confirm current branch/SHA and authority documents;
2. define the smallest product-visible scope;
3. implement on the authorized BP line;
4. run the current CI authority plus capability-specific test;
5. perform required iPhone/iPad manual evidence when UI/device behavior matters;
6. record completion and continue to the next roadmap item.

Do not create nested reconciliation/freeze loops for historical tests that are not current authority.

## Next product decision
After the R0 authority-document update is verified, continue with **R1 – Practical Planning Core** and determine only the remaining gaps in its complete E2E path. Do not re-audit the whole repository first.