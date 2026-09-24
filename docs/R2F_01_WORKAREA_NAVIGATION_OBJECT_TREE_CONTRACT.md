# R2F-01 – Workarea Navigation & Object Tree

Status: `DEFINED / DOCUMENTED / NOT IMPLEMENTED`

Date: 2026-09-24

## Purpose

This document records the read-only Current-State & Contract Reconciliation for R2F-01 against the current authoritative product line. It authorizes documentation only. It does not authorize an implementation branch or product-code changes.

R1 – Practical Planning Core remains frozen and must be preserved.

## Current-state matrix

| Area | Classification | Reconciliation result |
| --- | --- | --- |
| Planning left area: Object Tree / Insert | EXISTS / PRESERVE | PlanningWorkspaceAdapter already defines the two functional states Object Tree and Insert. |
| Lightweight object tree | EXISTS / PRESERVE | A Workarea structure-tree model already exists. Do not rebuild a second tree from scratch. |
| Project root | EXISTS / PRESERVE | Project root exists. |
| Location/area grouping | EXISTS / PRESERVE | Grouping is derived from current scene-object fields. |
| Conveyor-group grouping | EXISTS / PRESERVE | Conveyor-group level exists. |
| Planning object nodes | EXISTS / PRESERVE | Object nodes bind to scene objects through objectId. |
| Assembly/component structure | PARTIAL / LEGACY-OVERLAP | Component/role behavior exists historically through additional patch modules and requires consolidation before any implementation. |
| Electrical/BOM/parameter child contexts | EXISTS / PRESERVE | Lightweight action/detail contexts exist conceptually; heavy data must not be rendered into the tree. |
| Object Tree → Planning selection | EXISTS / PRESERVE | Existing selection route is used; no second selection authority is required. |
| Planning selection → Object Tree | PARTIAL / LEGACY-OVERLAP | Historical sync/selected-state patches overlap. |
| Selected-state visualization | EXISTS / LEGACY-OVERLAP | Selection marking exists in multiple generations and must be consolidated rather than duplicated. |
| Expand/collapse | EXISTS / PRESERVE | Existing UI behavior is valid. |
| Open required parent nodes for selection | PARTIAL / LEGACY-OVERLAP | Historical behavior exists but is not a clean single current authority. |
| Automatic scroll-to-selection | LEGACY-OVERLAP / DO NOT RESTORE BLINDLY | Historical NoScroll fixes show that forced scrolling caused usability problems. |
| Object Tree → Properties/detail context | EXISTS / PARTIAL | Existing object and component detail routes exist but ownership is historically layered. |
| Explicit viewport “focus object” navigation | MISSING | No clean current contract was identified. This is not implicitly authorized for implementation by this definition. |
| Tree drag & drop | MISSING / NOT REQUIRED | Not part of the lightweight-tree contract. |
| One consolidated current tree implementation | MISSING | This is the main structural gap identified by R2F-01 reconciliation. |
| Second selection authority | MUST NOT EXIST | Existing Workarea selection remains authoritative. |

## Binding Object Tree / Selection Contract

### 1. Single selection authority

The existing Workarea selection state and existing `_setSelectionToObject(...)` route remain the single functional selection authority.

The Object Tree must not own or persist a competing object selection.

### 2. Bidirectional synchronization

The binding direction is:

`Canvas → Workarea Selection Authority → Object Tree / Properties`

and:

`Object Tree → Workarea Selection Authority → Canvas / Properties`

Selecting the same Planning object from either surface must resolve to the same authoritative object identity.

### 3. Stable object identity

A Planning object node binds to exactly one real scene object through its stable `objectId`.

Display name, BMK/equipment tag, location and conveyor group are mutable metadata and must never replace object identity.

Changing those fields may regroup or relabel a node but must not create a new object identity.

### 4. Structural grouping nodes are not Planning-object selections

Project, location/area and conveyor-group nodes are navigation/grouping nodes.

Selecting or expanding them must not manufacture a Planning-object selection.

### 5. Components are subordinate object context

Motor, MOVIFIT, sensor, port, BOM entry or similar component/detail nodes may establish a subordinate detail/Properties context.

They must not silently become a second class of independently selected Planning scene objects unless a later separately reconciled contract explicitly introduces that capability.

The owning Planning object remains the authoritative scene selection.

### 6. Selection must not cause uncontrolled tree movement

When a Canvas selection belongs to a collapsed path, required parent nodes may be opened so the selected object can be represented.

Selection synchronization must not aggressively force `scrollIntoView()` or otherwise destroy the user's current tree navigation position. Historical NoScroll corrections are preservation evidence for this rule.

### 7. Expand/collapse is UI state

Tree expansion state is presentation/navigation state.

Changing it must not mutate project data, dirty the project or trigger functional project persistence.

### 8. Keep the tree lightweight

The Object Tree represents hierarchy, navigation and lightweight detail entry points.

Complete cable tables, BOM tables, parameter datasets or other heavy editors do not belong in the tree. They remain in the appropriate detail/Inspector/dialog context.

### 9. Responsive contract is functionally identical

Desktop, iPad and iPhone must use the same object identities, same selection authority and same functional Object Tree contract.

Dock, drawer, width and presentation may differ responsively; the functional selection model must not.

### 10. Preserve frozen R1 behavior

R2F-01 must not redefine or regress:

- Asset/assembly insertion
- Canvas selection semantics
- Object move/drag
- Object rotation
- Save/autosave
- Reload persistence
- Hall/Hall3D ownership
- Planning scene ownership

## Legacy-overlap rule

Historical structure-tree modules remain evidence of prior behavior and defects, especially live grouping, component nodes, selected-state synchronization, NoScroll behavior and detail-editor patches.

They must not be re-enabled wholesale merely because they exist in the repository.

A future implementation scope must first determine the smallest current-authority integration points and may carry forward only the still-valid contracts defined here.

## Scope boundary

R2F-01 Definition does **not** authorize:

- an implementation branch,
- product-code mutation,
- activation of historical patch modules,
- a second Object Tree,
- a second selection state,
- tree drag & drop,
- new viewport focus behavior,
- changes to R1 movement/rotation/persistence,
- Hall3D changes,
- Planning persistence changes.

## Definition result

`R2F-01 CURRENT-STATE & CONTRACT RECONCILIATION = COMPLETE`

`R2F-01 DEFINITION = DOCUMENTED / NOT IMPLEMENTED`

The next permitted step after verification of this documentation is exclusively a separate **R2F-01 Implementation Scope Reconciliation**. That step may identify exact files, ownership boundaries and tests, but still does not itself authorize implementation.
