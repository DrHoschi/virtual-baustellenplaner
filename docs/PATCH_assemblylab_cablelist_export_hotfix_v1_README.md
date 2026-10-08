# PATCH_assemblylab_cablelist_export_hotfix_v1

## Ziel

Hotfix fuer den Button **Export Kabelliste JSON** im Properties-Panel einer Baugruppe.

Vorher wurde die Kabelliste nur in die Zwischenablage kopiert. Auf iOS/Safari sieht das so aus, als ob gar nichts passiert, weil kein Download-Fenster erscheint.

## Änderung

- Der Export erzeugt jetzt zusätzlich eine JSON-Datei per Blob-Download.
- Gleichzeitig wird der JSON-Inhalt weiterhin in die Zwischenablage kopiert.
- Die Statusmeldung unterscheidet jetzt:
  - Export gestartet + Clipboard
  - nur Export gestartet
  - nur Clipboard, falls Download blockiert wurde
  - Fehler mit kurzer Meldung

## Hinweis iOS/Safari

Safari zeigt Downloads auf iPhone/iPad nicht immer als großes Fenster. Manchmal landet die Datei direkt im Downloadbereich/Dateien-App. Falls kein sichtbarer Download erscheint, ist der JSON-Inhalt trotzdem in der Zwischenablage.

## Datei

- `ui/panels/WorkareaPanel.js`

## Einspielreihenfolge

1. PATCH_assemblylab_v1
2. PATCH_assemblylab_mobile_polish_v1
3. PATCH_assemblylab_properties_v1
4. PATCH_assemblylab_properties_hotfix_v1
5. PATCH_assemblylab_component_roles_v1
6. PATCH_assemblylab_bom_v1
7. PATCH_assemblylab_ports_v1
8. PATCH_assemblylab_cablepoints_v1
9. PATCH_assemblylab_cablelist_v1
10. PATCH_assemblylab_cablelist_export_hotfix_v1
