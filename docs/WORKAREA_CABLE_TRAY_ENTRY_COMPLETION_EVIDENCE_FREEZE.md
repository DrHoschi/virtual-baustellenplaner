# Workarea Cable Tray Entry – Completion / Evidence / Freeze

## Status

**FROZEN WITH KNOWN VERIFICATION LIMITATION**

Functional freeze head:

`9f2e5e8c6f1380845678d21511b992d73da8dc30`

Authorized base and current `main` at Gate 3 start:

`40609e3f1afd650f66c4493b623237034b7bb197`

Branch:

`fix/workarea-cable-tray-entry`

## Purpose

This block makes cable-tray route authoring reachable in the Planning Workarea. The topbar exposes a named `Kabeltrasse` action through the existing `measure` mode. A compact Workarea-local panel exposes width, route class, duty class, point undo and route completion, using the existing cable-tray route behavior.

No new route model, persistence authority, material catalog, manufacturer/article selection, or automatic product selection is introduced.

## Frozen Functional Scope

The complete functional diff against the authorized base contains exactly these four files:

- `tests/ui-mig-05e-topbar-grouping.spec.js`
- `ui/css/ui-planning-topbar.css`
- `ui/panels/WorkareaPanel.base.js`
- `ui/shell/PlanningTopbarAdapter.js`

The diff adds the visible Planning entry point and responsive drawing controls, routes the button to the existing measure mode, and adds regression assertions plus a phone-sized route-drawing Playwright scenario.

No other functional files changed.

## Lineage and Tree Evidence

At Gate 3 start:

- Remote branch head: `9f2e5e8c6f1380845678d21511b992d73da8dc30`;
- Remote `main`: `40609e3f1afd650f66c4493b623237034b7bb197`;
- compare result: **ahead by 1, behind by 0**;
- merge base: exactly the authorized base;
- the functional head has one parent, the authorized base, and is not a merge commit;
- functional tree: `dd92d71dc32c2485b85f6b5d7c69e8a960a5b617`.

The original local implementation commit was `b3f8c4a4e50f5a5195ef7d963f186369c103b883`. The authenticated GitHub Git-data publication produced the remote functional commit above with the **identical tree** and same parent; only commit metadata and therefore the commit ID differ.

The functional diff is limited to the four files listed above.

## Verification Evidence

Repository-local checks recorded for the exact functional content:

- JavaScript syntax check: **PASS**, 220 JavaScript files;
- relative import graph check: **PASS**, 160 imports;
- `git diff --check`: **PASS**;
- changed JavaScript and test syntax checks: **PASS**.

The focused Playwright runner did not complete local discovery, and no local Chromium binary was available. Therefore the added phone-sized `Planning exposes cable-tray drawing` scenario is **not claimed as locally executed**.

## Exact-Head Product CI

- Workflow: **Product CI**;
- Run: **#1550** (ID `37496500726`);
- Event: `push`;
- Branch: `fix/workarea-cable-tray-entry`;
- Head SHA: `9f2e5e8c6f1380845678d21511b992d73da8dc30`;
- Job `checks`: **completed / success**.

All 29 substantive workflow steps completed successfully, including JavaScript syntax, import graph, catalog and manifest checks, existing regression steps, UI Wiring E2E and Smoke Tests. The workflow invokes `tests/ui-wiring.spec.js` and the listed existing suites; it does **not** invoke the newly added `tests/ui-mig-05e-topbar-grouping.spec.js`. The green Product CI is valid exact-head repository evidence, but it does not close the focused test execution limitation stated above.

Run: https://github.com/DrHoschi/virtual-baustellenplaner/actions/runs/37496500726

## Known Verification Limitation

The new targeted phone-sized Playwright scenario has been added but was not executed in the local environment, and Product CI #1550 does not include that test file. The behavior still requires direct focused E2E or manual device verification. This limitation is retained explicitly; no claim is made that the new interaction itself passed an automated browser run.

## Explicit Non-Scope Preserved

This block does not add:

- an automatic cable-tray placement or manufacturer/article selection;
- manufacturer, product number, or technical article variant data;
- new cable-tray route or persistence authority;
- a new material/BOM rule or CSV contract;
- schema, migration, or unrelated UI changes;
- integration into `main`.

## Freeze Decision

The implementation content is frozen at functional head:

`9f2e5e8c6f1380845678d21511b992d73da8dc30`

The freeze is **with the known focused E2E execution limitation above**. This document adds completion/evidence metadata only. Its documentation commit does not change the functional freeze head or authorize integration into `main`.

Main integration remains a subsequent separate step.
