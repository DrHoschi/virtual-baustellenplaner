# NAV-BACK-01 – Completion / Freeze

Status: **FROZEN**

## Authoritative baseline

- Product continuation branch: `feature/project-ui-03c-library-ownership-separation-recovery`
- Frozen functional SHA: `4b867450712354454d011da746db7fa277c0ca4b`
- TEST-DEPLOY device identity: `NAV-BACK-01 · TESTBUILD 3 · 4b867450`

This document freezes only NAV-BACK-01. It does not authorize cleanup, branch deletion, `main` reconciliation, or any new product block.

## Frozen contract

NAV-BACK-01 defines the upper Back control as a **Global Shell-owned contextual return control**.

The frozen behavior is:

- the Back control is not browser history and not a generic previous-screen action,
- it is visible only while a valid contextual return session exists,
- Project → Bibliotheken → Globaler Bibliothekskatalog establishes such a contextual return session,
- Back returns exactly to `projectPanel:libraries`,
- normal module/project navigation clears contextual return state,
- direct/non-contextual surfaces do not show a stale non-functional Back control,
- existing project context is preserved during the contextual return.

## Implemented scope

### 1. Contextual Library → Catalog transition

`ui/panels/ProjectLibrariesPanel.js`

The existing `library:catalog` navigation is preserved. Immediately before that navigation, the panel emits the existing shell contract:

`bp:navigation:contextual-open`

with target `library:catalog`.

This reuses the existing `AppShell` return-session implementation instead of adding browser-history or a second navigation mechanism.

### 2. Back visibility fix

`ui/css/ui-shell-im02.css`

Device testing revealed that `.bp-commandbar__button { display: inline-flex; }` overrode the native `[hidden]` behavior of the shell Back button. The frozen fix explicitly restores hidden-state authority:

`.bp-commandbar__button[hidden] { display: none; }`

No Back-state JavaScript redesign was required.

### 3. Back label visual cleanup

`ui/shell/AppShell.js`

The existing Back button already renders its own Chevron icon. The contextual label was therefore changed from `← Projekt` to `Projekt`, removing the duplicate arrow without changing geometry, position, or navigation semantics.

## Device / regression evidence

### TESTBUILD 1 – `75cbe815...`

- exact deployed SHA identity: PASS
- contextual return from global catalog: PASS
- contextual Back activation: PASS
- stale Back visibility on normal/source surfaces: FAIL
- blocker isolated to CSS overriding `[hidden]`

Result: **NOT FREEZABLE / 1 VISIBILITY BLOCKER**

### TESTBUILD 2 – `6b022211...`

- visibility fix deployed on exact SHA: PASS
- normal/source surfaces no longer show stale Back: PASS
- global catalog shows contextual Back only when appropriate: PASS
- Back returns to Project → Bibliotheken: PASS
- functional NAV-BACK contract: PASS
- visual duplicate-arrow cleanup remained open only as presentation polish

### TESTBUILD 3 – `4b867450...`

- visible build identity `NAV-BACK-01 · TESTBUILD 3 · 4b867450`: PASS
- normal surfaces without contextual session: Back hidden
- global catalog with contextual session: Back visible
- Back presentation: one Chevron + `Projekt`
- contextual return behavior: PASS
- no geometry or position change introduced by the label cleanup

## Completion / Freeze Gate

- definition/implementation gate: PASS
- contextual transition implementation: PASS
- stale Back visibility root cause reconciliation: PASS
- visibility fix: PASS
- label visual cleanup: PASS
- controlled deployment/device verification: PASS
- contextual return: PASS
- normal-navigation stale-state behavior: PASS
- scope preservation: PASS
- functional blocker count: 0

`NAV-BACK-01 = FROZEN / COMPLETION PASS / REGRESSION PASS / DEVICE PASS / CONTEXTUAL RETURN PASS / VISIBILITY PASS / 0 BLOCKER`

## Explicit exclusions

- No Capability-Recovery-Audit is performed by this freeze.
- No cleanup is performed by this freeze.
- No branch is deleted, moved, merged, or renamed.
- `main` remains outside this freeze scope.
- No Hall3D, Planning, ProjectAssets, Library data model, AssetLab, or generic navigation behavior is changed by this freeze documentation.
