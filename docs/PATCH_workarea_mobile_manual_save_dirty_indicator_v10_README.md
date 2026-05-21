# PATCH_workarea_mobile_manual_save_dirty_indicator_v10

## Zweck

v9 hat den iPhone/Safari-Modus auf manuelles Speichern umgestellt. Der Crashlog zeigt aber:
Der v9-Speichern-Button lief noch über den alten debounced Save-Pfad. Dadurch entstanden wieder `workarea:save:scheduled`-Timer.

v10 ergänzt deshalb:

- sichtbarer Dirty-State am Speichern-Button
- orange/roter Zustand: `● Speichern nötig`
- grüner Zustand: `✓ Gespeichert`
- blauer Zustand: `Speichere …`
- manueller Save läuft direkt über `ui:project:save`
- der alte v9-Click-Handler wird durch Button-Ersetzung entfernt
- `_requestProjectSaveDebounced(...)` wird mobil auch für `manual-save` blockiert

## Erwartete Crashlog-Meldungen

Gut:

```text
workarea:manual-save:dirty:v10
workarea:manual-save:debounced-request-blocked:v10
workarea:manual-save:direct-emit:v10
workarea:manual-save:saved-state:v10
```

Nicht mehr gut nach Klick auf Speichern:

```text
workarea:save:scheduled reason:"manual-save:v9"
workarea:save:scheduled reason:"manual-save:v10"
workarea:save:emit reason:"manual-save:v9"
```

## Test

1. Safari hart neu laden.
2. Workarea öffnen.
3. Objekt platzieren oder Eigenschaft ändern.
4. Button muss orange/rot werden: `● Speichern nötig`.
5. Button drücken.
6. Button muss auf `Speichere …` und danach `✓ Gespeichert` wechseln.
7. Crashlog prüfen: keine debounced Manual-Save-Timer mehr.
