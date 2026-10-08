# PATCH_workarea_mobile_properties_light_v1

## Warum dieser Patch?

Der Crash passiert laut Log nicht nur im echten Mobile-Layout, sondern auch in der iPad-Desktop-Ansicht. Deshalb reicht ein reiner Mobile-CSS-/Resize-Patch nicht aus.

Auffällig im Crashlog:

- Safari lädt neu, oft ohne `window:error`.
- `pagehide persisted:false` und danach `app:crash-recorder:init`.
- Die Workarea hat inzwischen große Store-Pakete um ca. 230 KB.
- Der rechte Property-Manager rendert gleichzeitig:
  - EPLAN-Basisfelder
  - Bauteile
  - EPLAN-Bauteile
  - Ports
  - Kabelpunkte
  - Kabelliste
  - editierbare Kabelliste-Felder

Das ist auf iOS/Safari auch im iPad-Desktopmodus kritisch.

## Was ändert der Patch?

Die Baugruppen-Properties werden standardmäßig in einen Light-Modus versetzt.

Standard sichtbar:

- Name
- Fördergruppe
- Ortbereich
- BMK / Tag
- kurze Zählerübersicht
- Button „Details öffnen“
- Button „Kabel/BOM aktualisieren“

Nicht mehr live sichtbar, außer nach aktivem Klick auf „Details öffnen“:

- EPLAN-Basisfelder
- Master/Variante
- Bauteile-Liste
- EPLAN-Bauteile
- Ports
- Kabelpunkte
- Kabelliste
- editierbare Kabelliste-Felder

## Anwendung

Im Repository-Root:

```bash
node scripts/patch_workarea_mobile_properties_light_v1.mjs
node --check ui/panels/WorkareaPanel.js
```

Danach deployen.

## Test auf iPhone/iPad

1. App öffnen.
2. Workarea öffnen.
3. Baugruppe auswählen.
4. Properties anzeigen.
5. Prüfen: Es erscheinen nur die Basisfelder + zwei Buttons.
6. Pan/Select/Zoom testen.
7. Mehrfach zwischen Tabs wechseln.
8. Erst danach „Details öffnen“ testen.
9. Wenn Details stabil sind, später können wir die Detailbereiche in einzelne Accordion-Blöcke zerlegen.

## Erwartetes Ergebnis

- Weniger DOM-Last im Property-Manager.
- Weniger Risiko für Safari-Neuladen.
- Funktion bleibt erhalten, aber schwere Details werden nur bei Bedarf gerendert.
