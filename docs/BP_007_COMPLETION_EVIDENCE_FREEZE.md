# BP-007 – Completion / Evidence / Freeze

## Status
**FROZEN – PASS WITH KNOWN BASELINE LIMITATIONS**

## Authoritative commits
- Definition / scope base: `441fa5d0f3e8c259f8378e23a7930c9bebf47007`
- Functional freeze head: `a1eafd56f2d336fafce15fff625499b0d13cd44a`
- Feature branch: `feature/BP-007-cable-tray-material-requirement`

This completion record does not integrate BP-007 into `main`.

## Completed contract
BP-007 adds a runtime-derived purchasing requirement for new cable-tray routes.

For each supported new width group (100 mm and 200 mm):
- standard stick length = 3 m;
- required stick count = `ceil(planned new-route length / 3 m)`;
- purchase length = required stick count × 3 m;
- offcut = purchase length − planned new-route length.

`routeClass = "existing"` / “Bestand/Brücke” remains part of the existing BP-004 route evaluation but contributes zero to BP-007 purchasing requirement.

## Authority / persistence
BP-007 introduces no new persistent material authority.

Existing authorities remain:
- `cable-tray.route.points[]` for geometry;
- `tray.widthMm`;
- `tray.trayType`;
- `tray.routeClass`;
- BP-006 `startRef/endRef` for semantic endpoint references.

BP-007 does not persist:
- route length;
- stick length;
- required stick count;
- purchase length;
- offcut;
- material totals;
- tray BOM rows.

The existing Assembly/AssemblyLab BOM authority is not reused or modified by BP-007.

## Exact implementation scope
Exact compare from `441fa5d0f3e8c259f8378e23a7930c9bebf47007` to `a1eafd56f2d336fafce15fff625499b0d13cd44a`:

- ahead: 2
- behind: 0
- merge base: exact definition/scope base
- `ui/panels/WorkareaPanel.base.js`: +21 / -1
- `tests/bp-007-cable-tray-material-requirement.spec.js`: +55 / -0

No other file is part of the functional diff.

## Regression compatibility
Verification confirmed the existing BP-002 through BP-006 authorities remain present:
- BP-002 route geometry / `points[]` and tray width/type;
- BP-003 `routeClass`;
- BP-004 derived route length and grouped totals;
- BP-005 existing-point editing;
- BP-006 `startRef/endRef` binding.

No store root, schema, adapter, asset catalog, save manager or Assembly BOM module was changed.

## Exact-head CI evidence
Exact SHA checked:

`a1eafd56f2d336fafce15fff625499b0d13cd44a`

GitHub Actions returned 17 completed runs:
- 11 SUCCESS
- 6 FAILURE

The six failures match the previously known repository baseline set:
1. `CI Checks (Syntax + Imports + Manifest + UI Wiring)` – preceding syntax/import/navigation/manifest/project/UI checks pass; failure occurs at Smoke Tests.
2. `UI-MIG-05B Planning Left Area Gate` – known 05B acceptance failure.
3. `UI-MIG-05C Insert Sources Gate` – blocked by preceding 05B regression.
4. `TECH-WA-FREEZE-01B.2 Heartbeat Gate` – known Heartbeat acceptance failure.
5. `TECH-WA-FREEZE-01B.3 RAF Abort Gate` – blocked by preceding 01B.2 regression.
6. `TECH-WA-FREEZE-01C Mobile Viewer Stability Gate` – blocked by preceding 01B.2 regression.

No new BP-007-specific CI blocker was identified.

## Explicit non-goals retained
BP-007 still does not add covers, dividers, fittings, connectors, supports/C-rails, manufacturer/article-number assignment, prices/suppliers, reserve percentages, manual material overrides, EPLAN coupling, cable fill, automatic 3D materialization or merging into Assembly BOM.

## Freeze decision
**BP-007 functional freeze = `a1eafd56f2d336fafce15fff625499b0d13cd44a`**

**Completion / Evidence / Freeze Gate: PASS WITH KNOWN BASELINE LIMITATIONS — 0 new blockers.**

Any later change to BP-007 behavior requires a separate authorized follow-up block.
