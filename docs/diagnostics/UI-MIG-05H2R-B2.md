# UI-MIG-05H.2R-B2 – Legacy Menu Cache Verification

Zweck: Geräteprüfung der bereits isolierten R-B-Änderung ohne weitere funktionale UI-/Workarea-Änderung.

Änderung gegenüber R-B:
- ausschließlich eindeutige ESM-Cache-Keys für index.html -> shell-bootstrap.js -> AppShell.js -> GlobalCommandBar.js.
- keine Workarea-Geometrie, kein CSS, kein Resize, kein Canvas, kein Storage.

PASS-Kriterium:
- Alt-Menü-/Drei-Punkte-Button ist sichtbar entfernt.
- KP62 bleibt vorhanden.
- kein Freeze nach Bedienung und Hoch-/Querformatwechsel.
