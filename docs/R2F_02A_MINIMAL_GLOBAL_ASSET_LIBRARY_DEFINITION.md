# R2F-02A – Minimal Global Asset Library Definition

Status: `DEFINED / DOCUMENTED / NOT IMPLEMENTED`

Date: 2026-09-24

## Purpose

R2F-02A defines the smallest global asset-library contract required for the practical Planning insert workflow.

Target user flow:

`Global Asset Library → take asset into current project → ProjectAssets → Planning / + Einfügen / Assets → existing Place Mode → asset.instance`

This definition does not authorize implementation.

## Existing authorities that must be preserved

### Global library ownership

PROJECT-UI-03C remains binding:

- The global library/catalog surface is application-level and project-independent.
- Project-owned data must not contain a mirrored copy of the complete global catalog.
- `ProjectLibrariesPanel` remains the project-specific library-reference surface.
- No historical library settings path becomes a new authority implicitly.

### ProjectAsset ownership

`app.project.projectAssets` remains the canonical ProjectAsset authority.

A ProjectAsset remains the unit consumed by the existing Planning asset placement path.

### Planning placement ownership

The existing Planning/Workarea placement contract remains unchanged:

`ProjectAsset.id + slot.id → asset.instance.projectAssetId + asset.instance.slotId`

R2F-02A must not introduce `library.instance` or a second placement engine.

### Technical asset catalog

`data/assets.catalog.v1.json` remains the technical type/parameter catalog.

Its existing role is:

`ProjectAsset slot.catalogId → technical catalog item → type / propertiesType / paramPackUrl`

It is not redefined as the global reusable asset library.

## Minimal global library schema

R2F-02A may introduce one new project-independent JSON source with this minimum logical contract:

```json
{
  "schema": "baustellenplaner.globalAssetLibrary.v1",
  "version": "1.0.0",
  "libraries": [
    {
      "libraryId": "stable-library-id",
      "title": "Library title",
      "entries": [
        {
          "entryId": "stable-entry-id",
          "title": "Asset title",
          "projectAsset": {
            "name": "Asset title",
            "slots": []
          }
        }
      ]
    }
  ]
}
```

Binding rules:

1. `libraryId` is stable and identifies the global library.
2. `entryId` is stable within that library and identifies the reusable asset entry.
3. The entry contains or can losslessly project the ProjectAsset-compatible data required by the existing placement path.
4. Global entries do not use a project-owned `ProjectAsset.id` as their global identity.
5. On import into a project, a project-owned ProjectAsset ID is created.
6. Slot IDs used by the imported ProjectAsset must be valid and stable inside that ProjectAsset.
7. A placeable imported slot must satisfy the existing model-presence contract used by ProjectAssets/Workarea (for example existing model/export reference/import metadata as applicable).
8. Existing optional `slot.catalogId` continues to refer to `data/assets.catalog.v1.json`; it is independent of `libraryId` and `entryId`.

## Project import provenance

An asset taken from the global library becomes a normal project-owned ProjectAsset.

It records provenance without changing ProjectAsset identity:

```json
{
  "id": "project-owned-id",
  "name": "Asset title",
  "source": {
    "kind": "library",
    "libraryId": "stable-library-id",
    "entryId": "stable-entry-id"
  },
  "slots": []
}
```

The provenance reference does not make the global library project-owned and does not replace the ProjectAsset ID.

## First implementation behavior

The first R2F-02A implementation is intentionally narrow:

1. Show entries from the minimal global asset-library source in the existing global `AssetLibraryPanel`.
2. Allow one entry to be taken into the currently open project.
3. Materialize it as a normal `app.project.projectAssets[]` item with a new project-owned ID and the provenance fields above.
4. Persist through the existing project save authority; no separate library-to-project persistence mechanism.
5. After import, the existing ProjectAssets and Planning asset insertion/placement path remains authoritative.
6. No direct Library → Scene placement is introduced.

Duplicate-import policy is deliberately not expanded into library synchronization. A later implementation scope must define the smallest deterministic behavior for an already-imported `libraryId + entryId` without creating a synchronization engine.

## Explicitly out of scope

- Full project `libraryRefs[]` management
- Library version locking or synchronization
- Remote libraries
- Library package import/export
- Favorites/recents database
- Direct Library → Workarea scene placement
- New `library.instance` scene-object type
- Replacement of ProjectAssets
- Replacement/redefinition of `data/assets.catalog.v1.json`
- Hall3D library/model ownership changes
- Workarea placement-engine changes
- R1 move/rotate/persistence changes
- R2F-01 selection-contract changes

## Implementation-scope boundary

The definition establishes these expected boundaries for a later separately authorized implementation-scope reconciliation:

### Candidate mutation

- one new global asset-library JSON data file
- `ui/panels/AssetLibraryPanel.js`
- a targeted R2F-02A test/workflow if required by the verification plan

### Preserve unless a later read-only scope reconciliation proves mutation necessary

- `ui/panels/ProjectAssetsPanel.js`
- `ui/panels/ProjectLibrariesPanel.js`
- `ui/shell/PlanningWorkspaceAdapter.js`
- `ui/panels/WorkareaPanel.base.js`
- `data/assets.catalog.v1.json`
- existing project persistence authority

No candidate file is implementation-authorized by this definition gate.

## Definition decision

`R2F-02A = MINIMAL GLOBAL ASSET LIBRARY CONTRACT DEFINED / PROJECTASSET IMPORT BOUNDARY DEFINED / EXISTING PLACEMENT CONTRACT PRESERVED / NOT IMPLEMENTED`
