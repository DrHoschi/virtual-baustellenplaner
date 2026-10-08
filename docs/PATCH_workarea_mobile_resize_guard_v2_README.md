# PATCH_workarea_mobile_resize_guard_v2

## Ziel
Dieser Patch reduziert iOS/Safari-Resize-Kaskaden in der Workarea.

Er verhindert, dass `ResizeObserver` und `window.resize` direkt den Canvas neu dimensionieren. Stattdessen werden Resize-Events gebündelt, gedrosselt und kleine Mobile-Safari-Höhenänderungen ignoriert.

## Geänderte Datei
- `ui/panels/WorkareaPanel.js`

## Wichtigste Änderungen
- Neuer interner Guard: `this._mobileResizeGuard`
- Neue Helfer:
  - `_isMobileResizeGuardEnvironment()`
  - `_getViewportHostSizeSnapshot()`
  - `_requestViewportCanvasResize(reason, opts)`
  - `_shouldDeferOrIgnoreViewportResize(nextSize, reason, opts)`
- `_resizeViewportCanvas(reason, opts)` nimmt jetzt `reason` und `opts` entgegen.
- `ResizeObserver` ruft nicht mehr direkt `_resizeViewportCanvas()` auf.
- Layout-Diagnose ruft den Canvas-Resize nur noch über den Guard an.
- Timer werden in `unmount()` sauber abgeräumt.

## Erwartete CrashLog-Marker
Bei Mobile-Safari-Höhenflattern sollte gelegentlich erscheinen:

```text
workarea:viewport:resize:ignored-height-noise
```

Die Zahl bei `workarea:viewport:resize ... count` sollte deutlich langsamer steigen als vorher.

## Syntax-Check
Ausgeführt:

```bash
node --check ui/panels/WorkareaPanel.js
```
