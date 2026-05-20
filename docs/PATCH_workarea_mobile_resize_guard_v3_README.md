# PATCH_workarea_mobile_resize_guard_v3

Stand: 2026-05-20

## Ziel

Dieser Patch stabilisiert die Workarea auf iPhone/iPad weiter gegen Safari-Reloads durch Resize-Kaskaden.

## Hintergrund aus Crashlog

Nach v2 wurde deutlich weniger wirklich resized, aber Safari lieferte weiterhin sehr viele reine Höhenwechsel:

- `h: 425 -> 378 -> 425 -> 377 ...`
- Breite blieb gleich (`w: 356`)
- DPR blieb gleich (`dpr: 2`)
- mehrere neue `app:crash-recorder:init` ohne vorherigen `window:error`

Das spricht nicht für einen klassischen JavaScript-Fehler, sondern für Safari/iOS, das die Seite wegen Layout-/Canvas-/Speicherdruck neu lädt.

## Änderung v3

- Version im Log: `v3.0.0-mobile-resize-lock`
- Reine Mobile-Höhenwechsel werden nach dem Start gelockt.
- Ein einmaliges Hochwachsen nach Mount ist erlaubt, damit der Canvas nicht auf der kleinen Start-Höhe bleibt.
- `finalSync` erzwingt auf Mobile keine reinen Höhenwechsel mehr mit `force:true`.
- Reine Höhenwechsel während Pointer/Pan/Drag werden komplett ignoriert.
- Breitenwechsel, DPR-Wechsel und echte Orientierung/Viewport-Änderungen bleiben möglich.

## Erwartete Log-Signale

Gut:

```text
workarea:viewport:resize:ignored-height-lock
workarea:viewport:resize:ignored-during-gesture
```

Die Anzahl `workarea:viewport:resize` sollte deutlich kleiner bleiben und nicht mehr zwischen 377/425 px pendeln.

## Geänderte Datei

```text
ui/panels/WorkareaPanel.js
```

## Syntaxcheck

```text
node --check ui/panels/WorkareaPanel.js
```
