# BREAK_REPORT – hardcut-modular-v3

Version: v1.0.0-hardcut-modular-v3 (2026-02-04)

## Ziel von v3
- Das Plugin-/Manifest-Menü existiert seit v2 bereits „live“.
- In v3 wird daraus ein **echtes Panel-System**:
  - Plugin-MenuEntries können echte Editor-Panels öffnen (statt JSON-Placeholder).
  - Erstes Panel: **Projekt → Allgemein** (Edit + Apply/Reset → Store).

## Enthaltene Änderungen
### Neu
- `ui/components/ui-dom.js`
- `ui/components/FormField.js`
- `ui/components/Section.js`
- `ui/components/Toolbar.js`
- `ui/panels/PanelBase.js`
- `ui/panels/ProjectGeneralPanel.js`
- `ui/panels/panel-registry.js`

### Geändert
- `core/loader.js`
  - importiert `createPanelRegistry()`
  - erstellt `panelRegistry` einmal beim Start
  - `panel:<anchor>:<tabId>` Views nutzen nun Registry:
    - **wenn Panel registriert** → echtes Editor-Panel
    - **sonst** → Fallback: Manifest/JSON-Placeholder (v2 Verhalten)

## Wie testen?
1. App starten
2. Menü → **Projekt → Allgemein**
3. Felder ändern → **Apply**
4. Unten im „Store Snapshot“ muss die Änderung sichtbar sein (unter `app.project.*` bzw. `app.settings.*`)

## Hinweis
- v3 speichert noch **nicht** zurück in `project.json` (keine File-Persistenz).
  Das kommt in einem späteren Patch (v4), inkl. Export/Save-Mechanik.
