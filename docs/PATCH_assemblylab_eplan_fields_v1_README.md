# PATCH_assemblylab_eplan_fields_v1

## Ziel

Dieser Patch ergänzt EPLAN-nahe Basisfelder für die AssemblyLab-/Workarea-Baugruppenlogik.

Die Felder sind bewusst noch neutral gehalten und dienen als Grundlage für spätere:

- BMK-/Gerätekennzeichen-Logik
- Quellen-/Zielbezeichnungen
- Klemmenbezüge
- EPLAN-/Montage-Kabellisten
- automatische Beschriftungen aus Baugruppe, Bauteil und Kabel

## Geänderte Datei

- `ui/panels/WorkareaPanel.js`

## Neue Baugruppen-Felder

In der Baugruppen-Properties-Ansicht gibt es jetzt den Bereich:

**EPLAN-Basisfelder**

Mit Feldern:

- Anlage
- Ort
- Funktion
- BMK
- Quelle/Schrank
- Klemmenleiste
- Safety-Bereich
- Seite/Pfad

Gespeichert wird an:

```js
sceneObj.eplan
sceneObj.config
```

## Neue Bauteil-Felder

Im Bereich **EPLAN Bauteile** können je Komponente gesetzt werden:

- Gerät/BMK
- Anschluss
- Klemme
- Funktion

Gespeichert wird an:

```js
sceneObj.components[].eplan
```

## Neue Kabellisten-Felder

Die Kabellisten-Zeilen haben zusätzlich EPLAN-nahe Felder:

- Quelle BMK
- Quelle Anschluss
- Ziel BMK
- Ziel Anschluss
- Klemme
- Seite/Pfad

Gespeichert wird an:

```js
sceneObj.cableLines[].eplan
sceneObj.cableLines[].sourceDeviceTag
sceneObj.cableLines[].sourceConnection
sceneObj.cableLines[].targetDeviceTag
sceneObj.cableLines[].targetConnection
sceneObj.cableLines[].terminalRef
sceneObj.cableLines[].eplanPage
```

## Export

Der Kabellisten-JSON-Export enthält jetzt zusätzlich:

- `assembly.eplan`
- `components[].eplan`
- `cableLines[].eplan`

## Testvorschlag

1. Baugruppe auswählen.
2. EPLAN-Basisfelder ausfüllen, z. B. Anlage, Ort, Quelle/Schrank, Klemmenleiste.
3. Bei einem Bauteil Gerät/BMK und Anschluss eintragen.
4. Bei einer Kabellisten-Zeile Quelle BMK, Quelle Anschluss, Ziel BMK, Ziel Anschluss setzen.
5. Seite neu laden.
6. Prüfen, ob Werte erhalten bleiben.
7. Kabelliste JSON exportieren und prüfen, ob `assembly.eplan`, `components[].eplan` und `cableLines[].eplan` enthalten sind.

## Checks

Ausgeführt:

```bash
node --check ui/panels/WorkareaPanel.js
node scripts/syntax-check.mjs
node scripts/import-graph-check.mjs
node scripts/check-assembly-templates.mjs
```

Ergebnis: grün.
