# PATCH_workarea_structure_tree_detail_editor_mirror_persist_v3

## Problem
Im Strukturbaum-Detaileditor konnte ein Bauteilname kurz geändert werden, sprang aber beim Verlassen/erneuten Öffnen wieder auf den alten Wert zurück.

## Ursache
Eine platzierte Baugruppe speichert Bauteilinformationen mehrfach:

- `components[]`
- `componentRefs[]`
- `bom[]`
- `ports[]`
- `cablePoints[]`
- optional im AssemblyLab-Template/Variant

Der vorherige Live-Save schrieb primär in `components[]`. Andere UI-Stellen konnten danach noch alte Spiegelwerte wie `Dummy Asset` anzeigen.

## Lösung
Der neue Patch synchronisiert beim Editieren und direkt vor dem Persistieren alle relevanten Spiegel. Besonders wichtig:

- Name in `components[]`
- Name in `componentRefs[]`
- Label in `bom[]`
- `componentName` in Ports und Kabelpunkten
- optional gleicher Bauteilname in der zugrunde liegenden AssemblyLab-Variante

## Script-Reihenfolge
Die Datei muss nach dem Live-Save-Patch geladen werden:

```html
<script type="module" src="./core/workarea-structure-tree-detail-editor-live-save.v2.js?v=2"></script>
<script type="module" src="./core/workarea-structure-tree-detail-editor-mirror-persist.v3.js?v=3"></script>
```

## Test
1. Strukturbaum öffnen.
2. MOVIFIT-Bauteil anklicken.
3. Name von `Dummy Asset` auf `MOVIFIT` ändern.
4. 2–3 Sekunden warten.
5. Anderes Objekt/Bauteil anklicken.
6. Zurück zum MOVIFIT-Bauteil gehen.
7. Der Name muss weiterhin `MOVIFIT` sein.
