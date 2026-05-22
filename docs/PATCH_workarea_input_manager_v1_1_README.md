# PATCH_workarea_input_manager_v1_1

## Befund aus dem Crashlog

Der SaveManager v1.1 arbeitet grundsätzlich korrekt:

```text
workarea:save-manager:flush-pending-after-drag:v1.1
workarea:save-manager:autosave-scheduled:v1.1
```

Der neue Absturz passiert aber **während eines längeren Drags**, bevor `pointerup` und Save vollständig durchlaufen können:

```text
17:19:05 drag:start
17:19:07 workarea:input:move-throttled:v1 moveIn=60
17:19:10 app:crash-recorder:init
```

Damit ist der Hauptverdacht nicht mehr Save, sondern zu viele PointerMove-/Render-/Panel-Updates während Drag auf Safari/iPhone.

## Änderung

`core/workarea-input-manager.v1.js` wird ersetzt.

v1.1 verarbeitet PointerMoves während Drag nicht mehr pro requestAnimationFrame, sondern zeitgedrosselt:

- Touch/iPhone: ca. 8–10 FPS
- Desktop: ca. 20 FPS
- letzter Move wird bei PointerUp garantiert verarbeitet
- Resize und RightPanel bleiben während Gesten verzögert
- Render während Touch-Drag wird stärker reduziert

## Test

1. App hart neu laden.
2. Workarea öffnen.
3. Objekt langsam und lang ziehen.
4. Prüfen, ob kein Reload während Drag passiert.
5. Loslassen.
6. Warten, bis Speichern grün ist.
7. Reload, Position prüfen.

## Erwartete neue Events

```text
workarea:input-manager:mount:v1.1
workarea:input:move-throttled:v1.1
workarea:input:pointerup:v1.1
workarea:save-manager:autosave-scheduled:v1.1
```
