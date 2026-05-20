# PATCH_assemblylab_cablelist_v1

## Ziel

Dieser Patch ergänzt die nächste technische Ebene im AssemblyLab:

```text
Baugruppe → Variante → Bauteile → Rollen → BOM → Ports → Kabelpunkte → Kabelliste
```

Aus vorhandenen Kabelpunkten (`cablePoints`) werden erste automatische Kabellisten-/Verbindungs-Kandidaten (`cableLines`) erzeugt.

## Wichtig

Das ist noch keine finale EPLAN- oder Klemmenlogik. Die Kabelliste ist bewusst ein Startmodell, damit Quelle/Ziel-Beziehungen sichtbar und später manuell/automatisch verfeinert werden können.

## Neu

Im Properties-Panel einer `assembly.instance` erscheint zusätzlich:

```text
Kabelliste / Verbindungen (...)
```

Die Verbindungen werden gruppiert nach:

- 400V Einspeisung
- Motorleitung
- 24V DC
- Sensorleitung
- Safety / STO
- Profinet / Netzwerk
- PE / Potentialausgleich
- Allgemein

## Beispiel-Ableitungen

- MOVIFIT/MOVIPRO Motorabgang → Motor Leistung
- Wartungsschalter/Schaltschrank 400V → MOVIFIT 400V Einspeisung
- 24V DC Netzteil/Schaltschrank → MOVIFIT 24V DC Versorgung
- MOVIFIT/MOVIPRO 24V DC → Sensor 24V
- Sensor Signal → MOVIFIT/MOVIPRO DI / Steuerung
- Bedienpult / Safety-Kreis → MOVIFIT STO / Safety Eingang
- MOVIFIT Profinet OUT → nächstes Profinet Gerät
- PE/PA-Schiene → PE-/PA-Punkte

## Neue Buttons

```text
↻ Kabelliste neu
Export Kabelliste JSON
```

`↻ Kabelpunkte neu` erzeugt ebenfalls die Kabelliste neu, damit Ports → Kabelpunkte → Kabelliste synchron bleiben.

## Datenfelder

Neue Datenstruktur an der Workarea-Instanz:

```text
sceneObj.cableLines[]
```

Jede Verbindung enthält u. a.:

```text
id
assemblyId
assemblyName
templateId
variantId
conveyorGroup
location
equipmentTag
type
typeLabel
sourceCablePointId
targetCablePointId
sourceLabel
targetLabel
cableTypeHint
cableType
cableNo
lengthM
wires
status
comment
```

## Prüfungen

Geprüft mit:

```bash
node --check ui/panels/WorkareaPanel.js
node scripts/syntax-check.mjs
node scripts/import-graph-check.mjs
node scripts/check-assembly-templates.mjs
```

Ergebnis: grün.
