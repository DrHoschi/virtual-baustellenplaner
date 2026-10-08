# PATCH_mobile_save_hardcut_v11

Dieses Patch-ZIP behebt das mobile Speichern/Dirty-Verhalten in der Workarea.

Geändert:
- `index.html`
  - lädt nicht mehr v9 und v10 getrennt,
  - lädt stattdessen `core/workarea-mobile-save-hardcut.v11.js`.
- `core/workarea-mobile-save-hardcut.v11.js`
  - ein einziger Mobile-Save-Guard,
  - keine delayed Mehrfachinstallation,
  - Dirty-Anzeige sofort nach Workarea-Änderung,
  - Auto-/Debounce-Save auf Mobile blockiert,
  - manueller Save mit `preventDefault()` und direktem `ui:project:save`.
- `core/workarea-structure-tree-detail-editor-save-quarantine.v7.js`
  - delayed Mehrfachinstallation entfernt.

Wichtig:
- Die alten Dateien v9/v10 können im Repo bleiben, werden aber durch die neue `index.html` nicht mehr geladen.
- Nach Upload auf GitHub Pages bitte Cache hart aktualisieren.

Tests:
```bash
node scripts/syntax-check.mjs
node scripts/import-graph-check.mjs
npx playwright test tests/ui-wiring.spec.js
```
