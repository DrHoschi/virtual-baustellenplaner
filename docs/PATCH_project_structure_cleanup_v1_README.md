# PATCH_project_structure_cleanup_v1

Stand: 2026-05-24

## Ziel

Der Baustellenplaner wird wieder auf die geplante Zielstruktur ausgerichtet:

```text
core/
  bus, store, registry, loader, persist

ui/
  panels, menu, status, shell

modules/
  assetlab3d
  workarea
  transfer
  debug/crash-recorder
```

## Geändert

- `core/loader.js`
  - Importpfade für `bus.js`, `store.js`, `registry.js` korrigiert.
  - Von `../core/...` auf `./...`, weil `loader.js` bereits in `core/` liegt.

- `main.js`
  - Crash-Recorder wird jetzt aus `modules/debug/crash-recorder/crash-recorder.js` geladen.
  - Projekt-Transfer wird jetzt aus `modules/transfer/project-transfer.js` geladen.
  - Der Transfer wird nicht mehr zusätzlich direkt in `index.html` geladen.

- `index.html`
  - Direkte Workarea-Assembly-Scripts zeigen jetzt auf `modules/workarea/...`.
  - Direkter `core/project-transfer.v1.js`-Script entfernt, damit kein Doppel-Install entsteht.

- Neue Zielpfade:
  - `modules/workarea/workarea-assembly-catalog.v1.js`
  - `modules/workarea/workarea-assembly-scene-binding.v1.js`
  - `modules/workarea/workarea-assembly-insert-and-variant-panel.v1.js`
  - `modules/transfer/project-transfer.js`
  - `modules/debug/crash-recorder/crash-recorder.js`

## Noch nicht löschen, erst nach grünem Test

Diese alten Dateien sind nach diesem Patch Kandidaten für `legacy/` oder Löschung, aber erst wenn CI + iPhone-Test stabil sind:

```text
core/project-transfer.js
core/project-transfer.v1.js
core/crash-recorder.js
core/workarea-assembly-catalog.v1.js
core/workarea-assembly-scene-binding.v1.js
core/workarea-assembly-insert-and-variant-panel.v1.js
core/workarea-structure-tree-*.v1.js
core/workarea-structure-tree-detail-editor-*.js
core/workarea-ui-tab-stability.v8.js
core/workarea/
L#U00f6schen/
```

## Testempfehlung

```bash
node scripts/syntax-check.mjs
node scripts/import-graph-check.mjs
npx playwright test tests/ui-wiring.spec.js
```
