# PATCH_workarea_structure_tree_detail_editor_safe_memory_save_v4

## Problem
Nach v2/v3 wurden Detail-Editor-Felder zwar kurzfristig übernommen, aber der automatische Save während der Eingabe konnte auf iPhone/Safari einen harten Reload auslösen.

## Lösung
Der Patch trennt Live-Editor und schweren Projekt-Save:

- Eingaben in Name, BMK, Hersteller usw. werden sofort in den laufenden Scene-State geschrieben.
- Der Strukturbaum-Detail-Editor löst keinen automatischen `ui:project:save` mehr aus.
- Der normale Save für andere Workarea-Aktionen bleibt unverändert.
- Alte v2/v3 Save-Gründe wie `structure-detail-live:*` und `structure-detail-mirror:*` werden unterdrückt.

## Script-Reihenfolge
Nach v3 laden:

```html
<script type="module" src="./core/workarea-structure-tree-detail-editor-mirror-persist.v3.js?v=3"></script>
<script type="module" src="./core/workarea-structure-tree-detail-editor-safe-memory-save.v4.js?v=4"></script>
```

## Test
1. Strukturbaum öffnen.
2. MOVIFIT/Motor-Bauteil anklicken.
3. Name `Dummy Asset` zu `MOVIFIT` ändern.
4. 5 Sekunden warten.
5. Die Seite darf nicht neu laden.
6. Anderes Bauteil anklicken und zurück zum MOVIFIT gehen.
7. Der geänderte Name soll im laufenden Projekt stehen bleiben.

Hinweis: Dieser Hotfix ist bewusst konservativ. Er beseitigt zuerst den Reload. Die finale saubere Lösung sollte später ein zentrales Save-Modell für Property-Editoren bekommen: Änderungen sammeln, visuell als geändert markieren, und erst über einen stabilen Projekt-Save schreiben.
