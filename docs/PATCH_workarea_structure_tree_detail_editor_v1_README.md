# PATCH_workarea_structure_tree_detail_editor_v1

Stand: 2026-05-21

## Ziel

Dieser Patch baut auf dem Strukturbaum mit Baugruppen-Unterknoten auf.
Wenn im Strukturbaum ein Unterknoten angeklickt wird, z. B. Motor, MOVIFIT,
Sensor, Wartungsschalter, Port oder BOM-Position, zeigt das rechte
Properties-Dock eine kleine direkte Bearbeitungsmaske.

## Neue Datei

```text
core/workarea-structure-tree-detail-editor.v1.js
```

## Änderung in index.html

Die Datei wird nach dem NoScroll-Guard geladen:

```html
<script type="module" src="./core/workarea-structure-tree-hard-noscroll-guard.v2.js?v=1"></script>
<script type="module" src="./core/workarea-structure-tree-detail-editor.v1.js?v=1"></script>
```

## Bearbeitbare Felder

### Gemeinsame Bauteilfelder

- Name
- Rolle
- BMK / Gerät
- Funktion
- Anschluss
- Klemme
- Seite/Pfad
- Hersteller
- Typ / Name
- Artikelnummer
- Kommentar

### Motor / Antrieb

- Leistung kW
- Spannung
- Strom A
- Drehzahl
- Baugröße
- Versorgt von
- Antriebsseite

### Steuerung / MOVIFIT / MOVIPRO

- 400V Einspeisung
- 24V Versorgung
- Safety / STO
- Netzwerk
- Quelle / Schrank
- IP / Adresse

### Sensorik

- Sensorfunktion
- Signal
- Stecker
- Ziel Eingang
- Position

### Wartung / Sicherheit

- Typ
- Nennstrom
- Versorgt
- Zuleitung von
- Abschließbar

### Ports

- Label
- Key
- Art
- Richtung
- Spannung
- Signal
- Stecker/Klemme
- Kabelhinweis
- Erforderlich
- Aktiv

### BOM / Material

- Bezeichnung
- Code
- Menge
- Einheit
- Hersteller
- Artikelnummer
- Kommentar

## Speicherlogik

- Bauteil-EPLAN-Felder werden über `_setAssemblyComponentEplanFieldV1(...)` gespeichert, falls vorhanden.
- Zusatzfelder werden unter `component.config` gespeichert.
- Portänderungen werden am Komponenten-Port gespeichert, damit abgeleitete Ports beim nächsten Rendern nicht verloren gehen.
- Persistenz läuft über `_assemblyPropsPersistScene(...)`, falls vorhanden.

## Bewusste Begrenzung

Der Patch ersetzt nicht den Voll-Editor. Er ist eine schnelle, mobile taugliche
Konfigurationsmaske direkt aus dem Strukturbaum heraus.
