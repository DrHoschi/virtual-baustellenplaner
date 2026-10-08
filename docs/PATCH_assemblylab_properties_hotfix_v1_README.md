# PATCH_assemblylab_properties_hotfix_v1

## Zweck

Hotfix für `PATCH_assemblylab_properties_v1`.

Beim Antippen/Auswählen einer `assembly.instance` wurde im Properties-Renderer die Methode `_escapeHtml()` verwendet, die im aktuellen `WorkareaPanel.js`-Stand noch nicht vorhanden war.

Fehler im Crash Recorder:

```text
TypeError: this._escapeHtml is not a function
_renderAssemblyInstancePropertiesV1
```

Dadurch konnte der Right/Properties-Render abbrechen. Auf iOS konnte danach der Pointer-/Pinch-Zustand hängen bleiben, wodurch Gesten wie Pan/Select komisch wirkten und teilweise wie Zoom/Pinch interpretiert wurden.

## Änderung

- Ergänzt `_escapeHtml(value)` in `ui/panels/WorkareaPanel.js`.
- Keine Änderung an Datenstruktur, Scene, AssemblyLab, Autosave oder Persistenz.

## Einspielreihenfolge

1. PATCH_assemblylab_v1
2. PATCH_assemblylab_mobile_polish_v1
3. PATCH_assemblylab_properties_v1
4. PATCH_assemblylab_properties_hotfix_v1

## Checks

Geprüft:

```bash
node --check ui/panels/WorkareaPanel.js
node scripts/syntax-check.mjs
node scripts/import-graph-check.mjs
node scripts/check-assembly-templates.mjs
```

Ergebnis: grün.
