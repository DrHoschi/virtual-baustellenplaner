PATCH_save_queue_dedupe_pointerfix_v1

Ziel:
- Speichern/Autosave stabilisieren.
- Doppelte Save-Timer aus Bus+Window-Doppelmeldung entfernen.
- Drag-End auf iOS nicht mehr als laufende Geste behandeln, wenn pointer.active kurzzeitig noch 1 meldet.

Geänderte Dateien:
- core/loader.js
- ui/panels/WorkareaPanel.js

Wichtig:
- Workarea meldet Dirty jetzt nur noch per Bus cb:workarea:dirty.
- Loader besitzt zusätzlich eine Schedule-Dedupe-Bremse.
- scene:drag-end wird als ruhiger Save mit 1600 ms Delay behandelt.
- Neue Logmarker:
  - workarea:save:dirty:v2
  - workarea:save:scheduled:v6
  - workarea:save:dedup-schedule:v6

Erwartung im Crashlog:
- Kein doppeltes scheduled direkt hintereinander mehr (seq 1 / seq 2 für denselben Grund).
- Bei scene:drag-end: gestureActive false, activePointers 0, rawActivePointers kann noch 1 sein.
