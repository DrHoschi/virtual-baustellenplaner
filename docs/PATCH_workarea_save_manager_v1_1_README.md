# PATCH_workarea_save_manager_v1_1

## Ursache im Crashlog

Der Hardcut v1 ist aktiv, aber der Autosave nach Drag blieb hängen:

```text
workarea:save-manager:dirty:v1
workarea:scene:persist
workarea:save-manager:dirty:v1 reason="pending-while-drag:drag-end"
```

Das bedeutet:
- `_persistSceneToStore("drag-end")` läuft noch während `dragActive=true`.
- v1 hat den Save deshalb nur vorgemerkt.
- Nach `pointerup` wurde dieser vorgemerkte Save nicht nachgestartet.

## Fix in v1.1

- `pendingSaveReason` wird während Drag gemerkt.
- Nach `pointerup` wird `flushPendingAfterDrag()` ausgeführt.
- Danach wird der Autosave sauber geplant.
- Gründe wie `assemblyprops:*`, `variant`, `template` werden ebenfalls als speicherrelevant erkannt.
- Doppelte Button-Saves werden gedrosselt.

## Erwartete neue Events

```text
workarea:save-manager:dirty:v1.1
workarea:save-manager:pending-during-drag:v1.1
workarea:save-manager:flush-pending-after-drag:v1.1
workarea:save-manager:autosave-scheduled:v1.1
workarea:save-manager:saving:v1.1
workarea:save-manager:emit:v1.1
workarea:save-manager:saved:v1.1
```

## Test

1. Objekt verschieben.
2. Nicht manuell speichern.
3. Warten, bis Button grün wird.
4. Seite neu laden.
5. Position muss erhalten bleiben.
