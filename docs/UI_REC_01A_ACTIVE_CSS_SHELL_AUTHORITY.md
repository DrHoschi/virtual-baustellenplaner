# UI-REC-01A – Active CSS / Shell Authority Cut

Basis: frozen `BP-HI01B.3R` at `b0717b1b58572bb35402478524913a8fc08f4aea`.

Ziel dieses Blocks ist ausschließlich die aktive CSS-/Shell-Authority zu bereinigen. Kein optischer Navigationsumbau, keine Workarea-Funktionsänderung, keine Canvas-/Resize-/RAF-/Pointer-/Persistenzänderung.

## Direkt aus `index.html` geladene CSS-Dateien

| Datei | Entscheidung | Autorität / Begründung |
| --- | --- | --- |
| `ui/css/ui-core.css` | FUNCTIONAL DO NOT TOUCH | Basisregeln für Panels, Buttons und Formulare. |
| `ui/css/ui-shell.css` | FUNCTIONAL DO NOT TOUCH | Bestehende Basisshell bleibt bis zum separaten Shell-Redesign kompatibel. |
| `ui/css/ui-shell-im02.css` | KEEP | Aktuelle äußere Produktshell-Autorität. Optische Ablösung folgt separat. |
| `ui/css/ui-projectassets.css` | FUNCTIONAL DO NOT TOUCH | Projekt-Asset-Inhalt, nicht Planning-Geometrie. |
| `ui/css/ui-workarea.css` | KEEP | Nur Workarea-Content/Visuals; Kerngeometrie ist bereits abgetrennt. |
| `ui/css/ui-planning-ownership.css` | UNLOAD | Veraltete Hard-Disable-Schicht konkurriert u. a. mit der aktuellen sichtbaren Topbar. Die einzige noch benötigte Restwirkung (`.wa-console-drawer` aus Produkt-Planning ausblenden) wird in `ui-planning-controls-cleanup.css` übernommen. |
| `ui/css/ui-planning-geometry.css` | KEEP | Einzige CSS-Autorität für Planning-Kerngeometrie: panel-root → shell → center → topbar → viewport-host → bottom-bar sowie Desktop/Tablet/Phone-Regionen. |
| `ui/css/ui-planning-left-content-fit.css` | MERGE THEN UNLOAD | Nur lokale, nicht-geometrische Content-Fit-Regeln werden in `ui-planning-controls-cleanup.css` übernommen. Die alte 2-Spalten-Tab-Geometrie wird bewusst nicht migriert. |
| `ui/css/ui-planning-right-content-fit.css` | KEEP | Lokaler Content-Fit im rechten Kontextbereich; keine Kerngeometrie-Autorität. |
| `ui/css/ui-planning-controls-cleanup.css` | KEEP | Autorität für sichtbare Planning-Chrome und lokale Planning-Content-Präsentation. |

## Dynamisch durch `shell-bootstrap.js` geladene CSS-Dateien

| Datei | Entscheidung | Autorität / Begründung |
| --- | --- | --- |
| `ui/css/ui-project-workspace-nav.css` | KEEP | Projekt-Unterbereiche, außerhalb der Planning-Kerngeometrie. |
| `ui/css/ui-planning-topbar.css` | KEEP | Präsentation der semantischen Planning-Werkzeugleiste. |
| `ui/css/ui-planning-context.css` | KEEP | Präsentation des rechten Kontext-/Properties-Hosts. |
| `ui/css/ui-planning-status.css` | KEEP | Status-/Diagnose-Präsentation; keine Kerngeometrie-Autorität. |

## Aktive Shell-/Planning-Adapter

| Datei | Entscheidung | Rolle |
| --- | --- | --- |
| `ui/shell/shell-bootstrap.js` | KEEP | Erzeugt die aktuelle Shell-Hosts und lädt die semantischen Adapter. |
| `ui/shell/AppShell.js` | KEEP | Orchestriert Navigation, Kontext-Rückkehr und Planning-Aktivierung. |
| `ui/shell/GlobalCommandBar.js` | KEEP | Sichtbare globale Befehlsleiste inkl. Build-Identifier. |
| `ui/shell/ModuleNavigation.js` | KEEP | Aktuelle Modulnavigation; optische Überarbeitung folgt separat. |
| `ui/shell/ProjectWorkspaceNavigation.js` | KEEP | Projekt-Unterbereiche. |
| `ui/shell/PlanningWorkspaceAdapter.js` | FUNCTIONAL DO NOT TOUCH | Ordnet bestehende Workarea-DOM-Struktur semantisch Planning zu; keine zweite Fachlogik. |
| `ui/shell/PlanningTopbarAdapter.js` | FUNCTIONAL DO NOT TOUCH | Brücke auf bestehende Workarea-Modus-/Zoom-Funktion. |
| `ui/shell/PlanningContextAdapter.js` | FUNCTIONAL DO NOT TOUCH | Brücke auf bestehenden Property-/Kontext-Host. |
| `ui/shell/PlanningStatusBarAdapter.js` | FUNCTIONAL DO NOT TOUCH | Brücke auf bestehenden Status-/Diagnosepfad. |
| `ui/workarea/workarea-usability-layout.v1.js` | KEEP | Präsentationsadapter für adaptive Drawer und vorhandene Controls; keine Runtime-Autorität. |
| `ui/panels/WorkareaPanel.js` | FUNCTIONAL DO NOT TOUCH | Autoritative bestehende Workarea-Funktion; dieser Block ändert sie nicht. |

## Verbindliche Authority nach UI-REC-01A

- Planning-Kerngeometrie: ausschließlich `ui-planning-geometry.css`.
- Planning-Chrome + lokaler linker Content-Fit: `ui-planning-controls-cleanup.css`.
- Rechter Content-Fit: `ui-planning-right-content-fit.css`.
- Semantische Werkzeugleiste: `PlanningTopbarAdapter.js` + `ui-planning-topbar.css`, weiterhin auf bestehender Workarea-Funktion.
- `ui-planning-ownership.css` wird nicht mehr geladen.
- `ui-planning-left-content-fit.css` wird nicht mehr geladen.
- Keine Navigation wird in UI-REC-01A optisch neu gestaltet.
