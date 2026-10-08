PATCH_clean_save_autosave_v1

Dateien:
- ui/panels/WorkareaPanel.js
- core/loader.js
- index.html

Ziel:
- Workarea speichert nicht mehr direkt bei jeder Scene-Änderung.
- Workarea meldet echte Datenänderungen als Dirty-Event.
- loader.js ist die einzige echte Projekt-Speicherstelle.
- SaveQueue debounced, fasst zusammen und flushed bei pagehide/visibility-hidden.
- Reine UI-Aktionen im Strukturbaum werden ignoriert.
- app:save:status Events sind vorbereitet: dirty/saving/saved/error.

Checks lokal:
- node --check ui/panels/WorkareaPanel.js
- node --check core/loader.js

Hinweis:
Externe Dateien workarea-input-manager.v1.js und workarea-save-manager.v1.js werden weiterhin nicht geladen.
