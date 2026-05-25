PATCH_loader_immediate_drag_save_v1

Ziel:
- Fix fuer iOS/Safari Reload direkt nach Workarea-Drag.
- scene:drag-end und scene:assembly-insert werden sofort synchron gespeichert, nicht erst nach Timer.
- Save-Status bleibt aktiv: dirty / saving / saved / error.
- pagehide/visibilitychange Flush bleibt bestehen.

Datei:
- core/loader.js

Test:
node --check core/loader.js
npx playwright test tests/ui-wiring.spec.js

Erwartung im Crash-Log:
Nach workarea:scene:persist reason=drag-end muss jetzt sehr schnell kommen:
- workarea:save:immediate:v1
- app:save:status saving
- workarea:save:executed:v4
- app:save:status saved

Wenn danach trotzdem ein Reload kommt, ist die letzte Scene-Aenderung bereits persistiert.
