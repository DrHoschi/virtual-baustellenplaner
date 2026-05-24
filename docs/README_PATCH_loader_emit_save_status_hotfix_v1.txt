PATCH_loader_emit_save_status_hotfix_v1

Fehler:
- core/loader.js ruft __bpEmitSaveStatus("saved", { reason:"loader:init" }) auf.
- Die Funktion __bpEmitSaveStatus war im aktuellen Loader aber nicht definiert.
- Dadurch bricht startApp bereits in init() ab:
  ReferenceError: __bpEmitSaveStatus is not defined

Fix:
- __bpEmitSaveStatus() im CLEAN WORKAREA SAVE BRIDGE Block ergänzt.
- Status wird über bus.emit("app:save:status", payload) UND window CustomEvent gesendet.
- window.__BP_LAST_SAVE_STATUS__ wird gesetzt, damit ui/status/save-status.js den letzten Status beim Boot nachlesen kann.
- __doManualSave() meldet saving/saved/error.
- __scheduleProjectSave() meldet dirty.

Geändert:
- core/loader.js

Prüfung:
- node --check core/loader.js: OK

Nächster Test:
- npx playwright test tests/ui-wiring.spec.js
