# PATCH_assemblylab_cablelist_fields_v1

## Zweck

Dieser Patch erweitert die bisher automatisch erzeugte Kabelliste um editierbare Baustellen-/EPLAN-Felder pro Verbindung.

Die automatische Kabelliste bleibt weiterhin ein Vorschlag, aber jede Zeile kann jetzt projektgebunden bearbeitet werden.

## Geänderte Datei

- `ui/panels/WorkareaPanel.js`

## Neue Felder je Kabelverbindung

- Kabelnummer
- Quelle
- Ziel
- Kabeltyp
- Adern
- Querschnitt
- Länge in Meter
- Trasse / Bereich
- Status
- Bemerkung

## Statuswerte

- geplant
- ziehen
- gezogen
- gemessen
- angeschlossen
- geprüft
- offen
- ignorieren

## Speicherung

Die Felder werden direkt an der jeweiligen `assembly.instance` gespeichert, unter:

- `sceneObj.cableLines[].cableNo`
- `sceneObj.cableLines[].sourceLabel`
- `sceneObj.cableLines[].targetLabel`
- `sceneObj.cableLines[].cableType`
- `sceneObj.cableLines[].wires`
- `sceneObj.cableLines[].crossSection`
- `sceneObj.cableLines[].lengthM`
- `sceneObj.cableLines[].route`
- `sceneObj.cableLines[].status`
- `sceneObj.cableLines[].comment`

## Export

Der vorhandene Kabellisten-JSON-Export enthält die erweiterten Felder automatisch, weil weiterhin `sceneObj.cableLines` exportiert wird.

## Testempfehlung

1. Baugruppe auswählen.
2. Im Properties-Panel eine Kabelverbindung suchen.
3. Kabelnummer, Kabeltyp, Querschnitt, Länge und Status ändern.
4. Seite neu laden.
5. Gleiche Baugruppe auswählen.
6. Prüfen, ob die geänderten Werte noch da sind.
7. Kabelliste JSON exportieren und prüfen, ob die Felder enthalten sind.

## Checks

Geprüft mit:

```bash
node --check ui/panels/WorkareaPanel.js
node scripts/syntax-check.mjs
node scripts/import-graph-check.mjs
node scripts/check-assembly-templates.mjs
```

Ergebnis: grün.
