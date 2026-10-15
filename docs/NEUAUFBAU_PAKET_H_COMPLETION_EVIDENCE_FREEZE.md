# Paket H – Completion / Evidence / Freeze

**Gate:** 3 – Completion / Evidence / Freeze  
**Functional freeze:** `d68affb043024f544cb104666f6f93d2c0e52866`  
**Branch:** `dev/planner-neuaufbau`  
**Date:** 2026-10-15  
**Integration:** not performed; `main` remains unchanged.

## Cause

Paket H filtered the camera viewer layer by the active Fachgruppe and drew an FOV only when its camera was selected and the active activity was `edit` or `camera`. Switching tools or selecting another camera therefore removed the contextual camera/FOV geometry from the plan.

## Fix

Camera symbols and configured FOV polygons now remain rendered across Fachgruppen, activities, and selection changes. Explicitly hidden project layers continue to hide their cameras. Camera selection and edit panels remain activity-scoped; the persistent viewer geometry does not expose extra controls.

Regression coverage verifies camera/FOV persistence after changing activity and Fachgruppe and after Save/Reload, at mobile and desktop viewport sizes.

## Evidence

- **Exact-head Paket H CI:** workflow run [#13](https://github.com/DrHoschi/virtual-baustellenplaner/actions/runs/38781485367) on `d68affb043024f544cb104666f6f93d2c0e52866` completed successfully. Syntax and import checks passed; **32 Playwright tests passed**.
- **Exact-head test deployment:** TEST-DEPLOY-01 run [#43](https://github.com/DrHoschi/virtual-baustellenplaner/actions/runs/38786702588) completed successfully. Embedded identity verified as **Packet-H · TESTBUILD 5 · d68affb0**; Pages deployment succeeded.
- **Manual user check:** on 2026-10-15 the user confirmed in chat that the cameras are visible again. The device and browser were not specified; this record does not claim a complete iPhone/iPad matrix test.
- **Main protection:** at closeout, `main` remained at `be0061f6cca67c30adee8b476e8ea0265707ab18`; no integration was performed.

## Freeze decision

Paket H is functionally frozen at `d68affb043024f544cb104666f6f93d2c0e52866`. This document records Gate 3 evidence on the same development branch. The resulting documentation commit is a closeout record only; it does not change the functional freeze target. Integration reconciliation and any fast-forward to `main` remain separate steps requiring separate authorization.
