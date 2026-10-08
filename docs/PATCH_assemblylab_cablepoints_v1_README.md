# PATCH_assemblylab_cablepoints_v1

## Ziel

Dieser Patch ergänzt den nächsten technischen Zwischenschritt nach Ports:

**Baugruppe → Variante → Bauteile → Rollen → BOM → Ports → CablePoints/Kabelpunkte**

CablePoints sind noch keine vollständige Quelle/Ziel-Kabelliste. Sie sind die stabile technische Zwischenebene, aus der später Kabelverbindungen und Kabellisten erzeugt werden.

## Neu

Für jede `assembly.instance` werden aus den vorhandenen Ports erste Kabelpunkte erzeugt:

- Power 400V
- 24V DC
- Safety / STO
- Motorleitung
- Profinet / Netzwerk
- Sensor / Signal
- PE / Potentialausgleich
- Klemme / Verteiler
- Allgemein

MOVIFIT/MOVIPRO-Ports werden dadurch getrennt sichtbar für:

- 400V Einspeisung
- 24V DC Versorgung
- STO / Safety Eingang
- Bedienpult / Safety Ausgang
- Motorabgang
- Profinet IN
- Profinet OUT

## Sichtbar in Properties

Bei ausgewählter Baugruppe erscheint zusätzlich:

- Anzahl Kabelpunkte in der Kopfzeile
- Bereich `Kabelpunkte (...)`
- Gruppierung nach Kabelpunkt-Typ
- Quelle/Ziel/Knoten-Hinweis je nach Port-Richtung
- Kabeltyp-Hinweis je Punkt

Außerdem gibt es den Button:

`↻ Kabelpunkte neu`

Damit werden Kabelpunkte aus den aktuellen Ports neu abgeleitet.

## Persistenz

Neue Felder an `assembly.instance`:

```js
cablePoints: [
  {
    schema: "baustellenplaner.assemblylab.cablepoint.v1",
    type: "motor",
    typeLabel: "Motorleitung",
    componentName: "Dummy Asset",
    portLabel: "Motor Leistung",
    sourceHint: "noch zuordnen",
    targetHint: "Dummy Asset · Motor Leistung",
    cableTypeHint: "Motorleitung U/V/W/PE, Bremse optional",
    status: "planned"
  }
]
```

Die Persistenz-Whitelist für `assembly.instance` wurde erweitert, damit `cablePoints` bei Reload/Export erhalten bleiben.

## Checks

Ausgeführt:

```bash
node --check ui/panels/WorkareaPanel.js
node scripts/syntax-check.mjs
node scripts/import-graph-check.mjs
node scripts/check-assembly-templates.mjs
```

Ergebnis: grün.
