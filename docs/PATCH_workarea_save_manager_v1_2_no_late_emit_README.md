# PATCH_workarea_save_manager_v1_2_no_late_emit

## Befund

Der InputManager v1.2 funktioniert. Im aktuellen Log ist der alte `mobile-drag:final-render` im neuen Abschnitt weg.

Der nächste kritische Ablauf ist:

```text
workarea:save-manager:saved:v1.1
workarea:save-manager:emit:v1.1
workarea:input:final-render:v1.2
workarea:save-manager:saved:v1.1
app:crash-recorder:init
```

Damit ist der nächste Kandidat der alte SaveManager-Nachlauf: Nach bereits erfolgreichem Save wird noch ein spätes `emit` ausgelöst.

## Änderung

Diese Datei ersetzt:

```text
core/workarea-save-manager.v1.js
```

v1.2 macht:

- Workarea-Autosave nach Drag/Insert/AssemblyProps ohne spätes zentrales `emit`.
- Save-Button weiterhin möglich, aber entprellt.
- Alte Timer aus früheren Hotfixes werden defensiv gelöscht.
- Button wird nach erfolgreichem Autosave grün.

## Erwartete Logs

```text
workarea:save-manager:mount:v1.2
workarea:save-manager:dirty:v1.2
workarea:save-manager:autosave-scheduled:v1.2
workarea:save-manager:saving:v1.2
workarea:save-manager:saved:v1.2
```

Bei Drag-Autosave nicht mehr erwartet:

```text
workarea:save-manager:emit:v1.1
```

## Test

1. Hart neu laden.
2. Workarea öffnen.
3. Objekt verschieben.
4. Loslassen.
5. Warten bis Button grün wird.
6. Nicht manuell speichern.
7. 20–30 Sekunden warten.
8. Prüfen, ob kein Reload passiert.
9. Neu laden und prüfen, ob Position erhalten blieb.
