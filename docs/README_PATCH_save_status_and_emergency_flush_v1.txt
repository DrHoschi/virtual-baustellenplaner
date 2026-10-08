PATCH_save_status_and_emergency_flush_v1

Geänderte / neue Dateien:
- index.html
- core/loader.js
- ui/status/save-status.js

Ziel:
1. Save-Status-Anzeige oben im Debug-Bereich:
   Gespeichert / Ungespeichert / Speichert… / Fehler
2. Notfall-Flush bei:
   - visibilitychange -> hidden
   - pagehide
   - beforeunload
3. Keine zweite Speicherlogik:
   - Save-Status-UI hört nur auf app:save:status.
   - Speichern bleibt zentral in core/loader.js.

Test:
1. Seite laden, Workarea öffnen.
2. Objekt verschieben.
3. Status muss kurz Ungespeichert/Speichert… und dann Gespeichert zeigen.
4. Objekt verschieben und sofort Safari/App wegschieben.
5. Wieder öffnen und prüfen, ob die letzte gespeicherte Position erhalten bleibt.

Hinweis:
Wenn Safari während eines aktiven Drags komplett neu lädt, bevor workarea:drag:end kommt,
kann die finale Drag-Position noch verloren gehen. Das ist der nächste separate Workarea-Punkt:
Zwischenstand/Drag-Abbruch sauber behandeln.
