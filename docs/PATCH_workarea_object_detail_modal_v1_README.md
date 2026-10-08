# PATCH_workarea_object_detail_modal_v1

Stand: 2026-05-20

## Ziel

Der rechte Property Manager der Workarea wird wieder deutlich leichter. Schwere Bereiche wie Elektrik, Kabel, EPLAN, BOM und Debug werden nicht mehr automatisch im rechten Dock als großer DOM-Baum aufgebaut, sondern erst bei Bedarf in einem zentralen Detailfenster geöffnet.

## Geänderte Dateien

- `ui/panels/WorkareaPanel.js`
- `ui/css/ui-workarea.css`
- `docs/PATCH_workarea_object_detail_modal_v1_README.md`

## Verhalten nach dem Patch

### Property Manager

Bei einer ausgewählten Baugruppe zeigt der Property Manager nur noch eine Kurzansicht:

- Objektname
- Typ
- Fördergruppe
- Ort
- BMK
- Zählwerte für Bauteile/BOM/Ports/Kabel
- Buttons: Details, Elektrik, BOM, Debug

### Detailfenster

Das Detailfenster hat Tabs:

- Übersicht
- Parameter
- Elektrik / Kabel
- Stückliste / BOM
- Debug

Die Inhalte werden lazy gerendert: nur der aktive Tab erzeugt seinen DOM-Inhalt.

### BOM-Tab rechts

Der rechte BOM-Tab rendert nicht mehr sofort die vollständige Liste, sondern nur noch eine leichte Kurzansicht mit Button „Stückliste öffnen“.

## Technische Hinweise

- Keine Datenstruktur wurde geändert.
- Bestehende Methoden für BOM, Kabel, EPLAN und Assembly-Felder bleiben erhalten.
- `_renderAssemblyInstancePropertiesFullV1()` bleibt als schwerer Detailrenderer bestehen, wird aber nur noch im Detailfenster im Tab „Elektrik / Kabel“ geladen.
- Syntaxcheck erfolgreich mit `node --check ui/panels/WorkareaPanel.js`.

## Erwarteter Effekt

Weniger DOM-Aufbau im rechten Dock, weniger Scroll-/Resize-Druck auf iOS/Safari und bessere Übersicht auf iPhone/iPad/Desktop.
