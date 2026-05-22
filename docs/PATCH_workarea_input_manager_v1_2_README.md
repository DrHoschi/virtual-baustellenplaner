# PATCH_workarea_input_manager_v1_2

## Befund

Der Log nach v1.1 zeigt:

```text
workarea:input-manager:mount:v1.1
workarea:input:move-throttled:v1.1
workarea:save-manager:autosave-scheduled:v1.1
workarea:mobile-drag:final-render
workarea:input:final-render:v1.1
app:crash-recorder:init
```

Damit ist klar:

- Die Move-Drosselung funktioniert.
- Der SaveManager funktioniert.
- Der Reload entsteht jetzt sehr wahrscheinlich in der Nachlaufphase nach Drag-Ende.
- Der alte direkte `v2.2.0-direct-workarea-lowpower` im `WorkareaPanel` erzeugt zusätzlich einen `final-render`.

## Änderung in v1.2

`core/workarea-input-manager.v1.js` wird ersetzt.

v1.2:

- neutralisiert den internen WorkareaPanel-MobileDrag-LowPower-Block:
  - `_enterMobileDragLowPower` wird blockiert,
  - `_leaveMobileDragLowPower` wird blockiert,
  - der alte `mobile-drag:final-render` soll nicht mehr laufen.
- Touch-Drag wird noch stärker gedrosselt:
  - ca. 6 Move-Verarbeitungen pro Sekunde,
  - Render während Drag ca. 4–5 FPS.
- FinalRender und RightPanel-Flush werden nach Touch-Drag deutlich verzögert, damit Autosave und UI nicht gleichzeitig Last erzeugen.

## Erwartete neue Events

```text
workarea:input-manager:mount:v1.2
workarea:input:internal-mobile-drag-disabled:v1.2
workarea:input:internal-mobile-drag-enter-blocked:v1.2
workarea:input:pointerup:v1.2
workarea:input:final-render:v1.2
```

Nicht mehr erwartet:

```text
workarea:mobile-drag:low-power-enter
workarea:mobile-drag:low-power-leave
workarea:mobile-drag:final-render
```

## Test

1. Hart neu laden.
2. Workarea öffnen.
3. Objekt langsam und länger ziehen.
4. Loslassen.
5. Warten, ob Button grün wird.
6. Reload.
7. Position prüfen.
