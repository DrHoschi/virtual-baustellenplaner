# PATCH_workarea_hardcut_save_input_v1

Stand: 2026-05-22

## Ziel

Dieser Patch ist der erste echte Hardcut für Workarea-Speichern und Workarea-Input.

Er ersetzt die historisch gewachsenen Mobile-/Manual-Save-/Drag-Schichten durch zwei zentrale Dateien:

```text
core/workarea-input-manager.v1.js
core/workarea-save-manager.v1.js
```

## Wichtigste Änderung

Es wird nicht mehr nach Mobile/Desktop/Tablet unterschieden.

Die neue Logik entscheidet nach Änderungstyp:

```text
Objekt verschoben / platziert / gelöscht -> Autosave nach stabilem Workarea-Event
UI-Tab / Mode gewechselt                 -> kein schwerer Projekt-Autosave
Struktur-/Detailfelder                   -> noch nicht über diesen Manager
```

## Verhalten nach Drag

```text
Pointerdown
→ laufenden Save abbrechen
→ Drag/Render/Resize stabilisieren

Pointermove
→ per requestAnimationFrame bündeln
→ Viewport-Render während Drag drosseln
→ RightPanel-Render verzögern
→ Resize während Geste nicht ausführen

Pointerup / Drag-End
→ finaler Move wird verarbeitet
→ Szene wird in Store geschrieben
→ Status wird orange
→ kurzer Autosave
→ Status blau
→ Persistor erhält ui:project:save
→ Status grün
```

## Entfernte/neutralisierte Alt-Schichten

Folgende Dateien werden als Kompatibilitäts-Shim ersetzt:

```text
core/workarea-mobile-save-hardcut.v11.js
core/workarea-mobile-drag-stability.v2.js
core/workarea-ui-tab-stability.v8.js
```

Sie bleiben als Datei vorhanden, damit alte Imports oder Browser-Cache-Pfade nicht sofort brechen, enthalten aber keine eigene alte Logik mehr.

## Geänderte Dateien

```text
index.html
core/workarea-input-manager.v1.js
core/workarea-save-manager.v1.js
core/workarea-mobile-save-hardcut.v11.js
core/workarea-mobile-drag-stability.v2.js
core/workarea-ui-tab-stability.v8.js
docs/PATCH_workarea_hardcut_save_input_v1_README.md
```

## Testplan

1. CI:
   ```bash
   node scripts/import-graph-check.mjs
   npx playwright test tests/ui-wiring.spec.js
   ```

2. App hart neu laden.

3. Workarea öffnen.

4. Objekt verschieben:
   - keine Reloads während Drag,
   - Button wird nach Drag orange/blau/grün,
   - Crashlog zeigt `workarea:input-manager:*` und `workarea:save-manager:*`.

5. Nicht manuell speichern, sondern warten.

6. Seite neu laden:
   - Position muss erhalten bleiben.

## Erwartete neue Crashlog-Events

```text
workarea:input-manager:v1-installed
workarea:save-manager:v1-installed
workarea:input:pointerdown:v1
workarea:input:pointerup:v1
workarea:save-manager:dirty:v1
workarea:save-manager:autosave-scheduled:v1
workarea:save-manager:saving:v1
workarea:save-manager:emit:v1
workarea:save-manager:saved:v1
```

## Nicht mehr erwartet

```text
workarea:mobile-manual-save:v9-installed
workarea:manual-save-dirty:v10-installed
workarea:mobile-save:v12-installed
workarea:ui-tab-stability:v8-installed
workarea:unmount:trace:v8
```

Wenn diese alten Events trotzdem auftauchen, kommt noch etwas aus Cache oder eine alte Datei ist weiterhin aktiv eingebunden.
