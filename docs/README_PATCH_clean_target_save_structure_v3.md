# PATCH_clean_target_save_structure_v3

Stand: 2026-05-23

Dieses ZIP bereinigt den zuletzt fehlerhaften Stand, bei dem `index.html` noch nicht vorhandene Dateien geladen hat:

- `./core/workarea-input-manager.v1.js`
- `./core/workarea-save-manager.v1.js`
- diverse externe `workarea-structure-tree-*.v*.js` Patchketten
- `./core/project-transfer.v1.js` doppelt aus der Shell

## Zielzustand

- `index.html` lädt nur noch die App-Shell, CSS, die zwei noch benötigten Assembly-Brücken und `main.js`.
- `main.js` lädt keinen alten Workarea-Autosave-/Drag-Guard mehr.
- `WorkareaPanel.js` bleibt die offizielle Workarea-Quelle für Strukturbaum, Scene-Persist, AssemblyLab und Save-Trigger.
- `loader.js` bleibt die zentrale Persistenzstelle über `createAppPersistor()` und `ui:project:save`.

## Enthaltene Dateien

- `index.html`
- `main.js`
- `core/loader.js`
- `ui/panels/WorkareaPanel.js`
- `docs/Ziel_Dokument.md`

## Prüfung

Ausgeführt:

```bash
node --check main.js
node --check core/loader.js
node --check ui/panels/WorkareaPanel.js
```

Zusätzlich geprüft: Keine aktiven Script-Imports mehr auf `workarea-input-manager`, `workarea-save-manager` oder externe `workarea-structure-tree-*.v*.js` in der bereinigten `index.html`.
