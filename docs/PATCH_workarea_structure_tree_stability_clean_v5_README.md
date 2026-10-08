# PATCH workarea_structure_tree_stability_clean_v5

## Zweck

Dieser Patch ist ein Stabilitäts-Clean-Patch für den Strukturbaum-Detail-Editor.

Im aktuellen Backup waren diese Dateien gleichzeitig geladen:

- `workarea-structure-tree-detail-editor.v1.js`
- `workarea-structure-tree-detail-editor-live-save.v2.js`
- `workarea-structure-tree-detail-editor-mirror-persist.v3.js`
- `workarea-structure-tree-detail-editor-safe-memory-save.v4.js`

Dadurch liefen mehrere `input`/`change`/`blur`-Listener parallel. Außerdem wurde trotz v4 noch ein Workarea-Autosave ausgelöst, weil `_persistSceneToStore()` den Grund zu `scene:structure-detail-safe:memory-only` erweitert hat. v4 prüfte aber nur `startsWith("structure-detail...")`.

## Änderung

`index.html` lädt jetzt nur noch:

```html
<script type="module" src="./core/workarea-structure-tree-detail-editor.v1.js?v=1"></script>
<script type="module" src="./core/workarea-structure-tree-detail-editor-stability-clean.v5.js?v=5"></script>
```

Die alten Zusatzpatches v2/v3/v4 bleiben als Dateien im Projekt, werden aber nicht mehr geladen.

## Wirkung

- Eingaben im Detail-Editor bleiben im laufenden Scene-State.
- Bauteilname wird in `components`, `componentRefs`, `ports`, `cablePoints` und `bom` gespiegelt.
- Automatischer schwerer Projekt-Save wird für `structure-detail`-Änderungen unterdrückt.
- Normale Workarea-Saves außerhalb des Detail-Editors bleiben erhalten.

## Test

1. App auf iPhone/Safari öffnen.
2. Workarea öffnen.
3. Baugruppe im Strukturbaum öffnen.
4. MOVIFIT/Motor anklicken.
5. Name von `Dummy Asset` zu `MOVIFIT` ändern.
6. 5–10 Sekunden warten.
7. Die Seite darf nicht neu laden.
8. Anderes Bauteil anklicken und zurückgehen.
9. Der Name muss im laufenden Projekt stehen bleiben.

Erst wenn dieser Test stabil ist, sollte wieder ein kontrollierter Save-Button/Commit-Pfad für Detail-Editor-Daten ergänzt werden.
