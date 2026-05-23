# CLEAN TARGET SAVE AND DELETE v1

## Ziel

Der Workarea-Zielzustand ist: keine externen Save-/Input-Patch-Manager mehr.

Speicherweg:

1. WorkareaPanel schreibt Szene nach Store.
2. WorkareaPanel ruft `_requestProjectSaveDebounced(reason)` auf.
3. Diese Funktion feuert `bus.emit("ui:project:save", ...)`.
4. `core/loader.js` ruft den App-Persistor auf.

Der letzte Workarea-Modus bleibt weiterhin in `app.settings.ui.workarea.modeId` gespeichert.
Damit darf ein Reload bewusst wieder in `place` starten, wenn der Nutzer vorher in Place war.

## In diesem Patch geändert

- `index.html`: Script-Tags für `core/workarea-input-manager.v1.js` und `core/workarea-save-manager.v1.js` entfernt.
- `main.js`: optionales Nachladen von `workarea-autosave-drag-guard.v1_3.js` entfernt.

## Danach aus dem GitHub-Ordner löschen/verschieben

Diese Dateien sollten nicht mehr im aktiven Root/Core-Bereich liegen:

- `core/workarea-save-manager.v1.js`
- `core/workarea-input-manager.v1.js`
- `core/workarea-autosave-drag-guard.js`
- `core/workarea-autosave-drag-guard.v1_3.js`
- `core/workarea-mobile-drag-stability.v1.js`
- `core/workarea-mobile-drag-stability.v2.js`
- `core/workarea/workarea-autosave-drag-guard.js`
- `core/workarea/workarea-mobile-drag-stability.js`
- `index_snippet.html`

Optional in einen Archivordner verschieben statt löschen:

- `docs/PATCH_workarea_save_manager_*`
- `docs/PATCH_workarea_input_manager_*`
- `docs/README_MOBILE_AUTOSAVE_*`
- `docs/README_MOBILE_SAVE_*`
- alte BREAK_REPORT-Dateien

## Wichtig

Nicht löschen:

- `core/loader.js`
- `core/persist/app-persist.js`
- `ui/panels/WorkareaPanel.js`
- `core/project-transfer.js` oder `core/project-transfer.v1.js`, bis wir Transfer eindeutig auf eine Datei reduziert haben.
- `core/crash-recorder.js`
