# PATCH_workarea_structure_tree_detail_editor_live_save_v2

## Zweck

Hotfix für den Strukturbaum-Detail-Editor.

Vorheriges Verhalten:

- Im rechten Properties-Dock konnte z. B. `Dummy Asset` in `MOVIFIT` geändert werden.
- Nach ca. 1–2 Sekunden sprang der Wert wieder zurück.
- Ursache: Der alte Editor speicherte die Eingabe erst bei `change`/Blur. Wenn in der Zwischenzeit ein automatischer Re-Render kam, wurde der alte Wert erneut aus den Scene-Daten gelesen und das Eingabefeld neu aufgebaut.

Neues Verhalten:

- Eingaben werden bereits während des Tippens live in `sceneObj.components`, `eplan`, `config`, `ports` oder `bom` geschrieben.
- Persist wird debounced ausgelöst.
- Die alten `change`-Handler des Detail-Editors werden im Editorbereich abgefangen, damit sie nicht sofort das rechte Dock neu rendern und den Fokus verlieren.

## Enthaltene Dateien

```text
index.html
core/workarea-structure-tree-detail-editor-live-save.v2.js
docs/PATCH_workarea_structure_tree_detail_editor_live_save_v2_README.md
```

## Einbindung

Die neue Datei muss nach dem bestehenden Detail-Editor geladen werden:

```html
<script type="module" src="./core/workarea-structure-tree-detail-editor.v1.js?v=1"></script>
<script type="module" src="./core/workarea-structure-tree-detail-editor-live-save.v2.js?v=2"></script>
```

## Test

1. Workarea öffnen.
2. Im Strukturbaum ein Bauteil anklicken, z. B. MOVIFIT.
3. Rechts im Properties-Dock das Feld `Name` ändern, z. B. von `Dummy Asset` auf `MOVIFIT`.
4. 2–3 Sekunden warten.
5. Der Name darf nicht zurückspringen.
6. Optional anderes Feld ändern: BMK, Hersteller, Artikelnummer.
7. Baum/Objekt erneut anklicken: Der geänderte Wert muss erhalten bleiben.

## Syntax-Check

```bash
node --check core/workarea-structure-tree-detail-editor-live-save.v2.js
```
