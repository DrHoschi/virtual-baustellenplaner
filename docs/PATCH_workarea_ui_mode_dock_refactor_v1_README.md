# PATCH_workarea_ui_mode_dock_refactor_v1

Stand: 2026-05-20

## Ziel

Dieser Patch reduziert die Last in der Workarea, besonders auf iPhone/iPad/Safari:

- Property Manager rendert nur noch eine leichte Kurzkarte.
- BOM, Parameter, Elektrik/EPLAN und Voll-Editor werden erst per Dialog geöffnet.
- Mode-Wechsel steuern Tabs und Docks zentral.
- Linkes Dock bekommt eine klarere Struktur: Struktur, Einfügen, Baugruppen, Assets, Tools.
- Pan-Modus klappt die Docks automatisch ein, damit der Viewer mehr Fläche und weniger DOM-Last hat.

## Geänderte Dateien

- `ui/panels/WorkareaPanel.js`
- `ui/css/ui-workarea.css`
- `docs/PATCH_workarea_ui_mode_dock_refactor_v1_README.md`

## Wichtige technische Änderung

Vorher wurden im rechten Dock viele schwere Inhalte direkt aufgebaut, sobald ein Objekt selektiert war. Jetzt gilt:

```txt
Nicht sichtbar = nicht rendern.
Dialog geschlossen = schwere Tabellen/Editoren werden nicht aufgebaut.
```

Die neue zentrale Mode-Konfiguration sitzt in `WORKAREA_MODE_UI_V1`.

## Neue linke Tabs

```txt
Struktur  → leichter Projekt-/Objektbaum
Einfügen  → Launcher für Baugruppen/Assets/Place-Modus
Baugruppen → bestehender AssemblyLab-Tab
Assets    → bestehender Asset-Tab
Tools     → Layout JSON, CrashLog, Diagnose
```

## Neue rechte Properties-Kurzkarte

Die rechte Karte zeigt nur noch:

- Name / Typ / ID
- Ort
- Fördergruppe
- Objektanzahl
- Buttons: Transform, Voll-Editor, Elektrik, BOM, Params

## Hinweise

- Bestehende Debug-/Crash-/Inspector-Funktionen wurden nicht entfernt.
- Die alten schweren Renderer bleiben erhalten, wurden aber in `...Full()` umbenannt.
- BOM und Params sind weiterhin verfügbar, aber nur noch als Dialog.
- Der Strukturbaum ist in v1 bewusst leicht und ohne Drag & Drop. Drag & Drop sollte erst in einem späteren Patch kommen.

## Test

Ausgeführt:

```bash
node --check ui/panels/WorkareaPanel.js
```
