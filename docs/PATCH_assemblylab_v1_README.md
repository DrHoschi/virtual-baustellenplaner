# PATCH_assemblylab_v1

Stand: 2026-05-19

## Ziel

Dieser Patch ergänzt die Workarea um einen ersten **AssemblyLab-v1-Tab**:

- Projekt-Assets als Bauteile in eine Master-Baugruppe übernehmen
- Bauteile innerhalb einer Variante mit X/Y/Rotation positionieren
- Varianten projektgebunden speichern
- die aktive Variante als `assembly.instance` in die Workarea einfügen
- Komponenten, BOM-Grunddaten und AssemblyLab-Referenzen persistieren

## Geänderte Datei

- `ui/panels/WorkareaPanel.js`

## Neuer Bedienablauf

1. Workarea öffnen.
2. Links den neuen Tab **Baugruppen** öffnen.
3. Master-Baugruppe wählen, standardmäßig `Rollenbahn Master`.
4. Projekt-Assets per `+` oder Drag/Drop in die Drop-Zone als Bauteile übernehmen.
5. X/Y/Rot pro Bauteil setzen.
6. Bei Bedarf `+ Variante kopieren` nutzen.
7. `✓ Variante in Workarea einfügen` drücken.
8. Die Baugruppe erscheint als `assembly.instance` in der Workarea und kann verschoben/gedreht werden.

## Speicherort im Projekt

Der Patch speichert die editierbaren Baugruppen unter:

- `app.project.assemblyLab`
- Spiegelung nach `project.assemblyLab`

Dadurch bleiben die Daten für Export/Import und Reload stabil.

## Bewusst noch nicht enthalten

- echter GLB-Composite-Export
- echter 3D-Gizmo-Editor
- Constraints wie SolidWorks-Mates
- EPLAN-Export

Diese Funktionen sollen später auf der jetzt gespeicherten AssemblyLab-JSON-Struktur aufbauen.

## Prüfungen

Ausgeführt im Backup:

```bash
node --check ui/panels/WorkareaPanel.js
node scripts/syntax-check.mjs
node scripts/import-graph-check.mjs
node scripts/check-assembly-templates.mjs
```

Ergebnis: alle Checks grün.
