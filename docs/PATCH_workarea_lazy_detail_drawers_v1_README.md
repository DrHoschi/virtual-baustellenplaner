# PATCH_workarea_lazy_detail_drawers_v1

## Ziel

Dieser Patch reduziert die DOM-/Renderlast im Workarea-Property-Manager, besonders auf iPhone/iPad.

Der vorherige Patch hat die Properties bereits mode-basiert getrennt. Dieser Patch ergänzt im Edit-Modus eine Lazy-Struktur: schwere Baugruppen-Details werden nicht mehr sofort komplett gerendert.

## Änderung

Die bisherige vollständige Baugruppen-Property-Ansicht bleibt erhalten, wird aber intern als Full-Renderer verwendet.

Der normale Edit-Renderer zeigt zuerst nur:

- Baugruppen-Kopf
- ID, Fördergruppe, Ort, BMK
- kurze Summen: Bauteile, BOM, Ports, Kabelpunkte, Kabel
- Detailbuttons

Detailbereiche:

- Bauteile
- Ports
- Kabel
- Volldetails laden

Nur der geöffnete Bereich wird gerendert.

## Wichtig

Die schweren Felder für BOM, Ports, Kabelpunkte, Kabelliste-Felder und EPLAN-Felder werden erst über **Volldetails laden** in den DOM gesetzt.

Damit bleibt normales Auswählen, Verschieben und kurzes Prüfen deutlich leichter.

## Test

Empfohlener Test auf iPhone/iPad:

1. Workarea öffnen
2. Select-Modus prüfen: kurze Übersicht
3. Edit-Modus öffnen
4. Baugruppe auswählen
5. Prüfen: zuerst nur Lazy-Übersicht
6. Bauteile öffnen
7. Ports öffnen
8. Kabel öffnen
9. Volldetails laden öffnen
10. Volldetails wieder schließen
11. Mehrfach auswählen/verschieben/zoomen

## Checks

Geprüft:

```text
node --check ui/panels/WorkareaPanel.js
node scripts/syntax-check.mjs
node scripts/import-graph-check.mjs
node scripts/check-assembly-templates.mjs
```

Ergebnis: grün.
