# PATCH_workarea_mode_based_properties_v1

## Ziel

Dieser Patch reduziert die DOM-Last im Property Manager deutlich, besonders auf iPhone/iPad.

Bisher wurden beim Auswählen einer Baugruppe auch im normalen `Select`-Modus sofort alle schweren Bereiche aufgebaut:

- Bauteile
- BOM
- Ports
- Kabelpunkte
- Kabelliste
- Kabelliste-Felder
- EPLAN-Felder

Das erzeugt auf Safari/iOS viel Layout-Arbeit und kann bei größeren Baugruppen zu Reloads/Speicherdruck führen.

## Änderung

Der Property Manager rendert nun mode-basiert:

### Select

Zeigt nur eine leichte Übersicht:

- Auswahl
- Typ
- Name
- Position
- Rotation
- Baugruppen-Kurzüberblick
- Zähler für Bauteile/BOM/Ports/Kabelpunkte/Kabelverbindungen
- Button `Edit-Modus öffnen`

Die schweren technischen Listen werden im Select-Modus nicht mehr in den DOM gerendert.

### Pan

Zeigt nur eine schlanke Navigations-Info. Objekt-Details werden nicht geladen.

### Place

Zeigt nur einen schlanken Place-/Asset-Kontext.

### Measure

Zeigt nur eine leichte Messmodus-Info.

### Sim

Zeigt nur eine leichte Simulations-/Status-Info.

### Edit

Nur im Edit-Modus wird der bestehende vollständige Baugruppen-Property-Renderer geladen.
Dort bleiben alle bisherigen technischen Bereiche verfügbar:

- EPLAN-Basisfelder
- Master/Variante
- Bauteile
- BOM
- Ports
- Kabelpunkte
- Kabelliste
- Kabellisten-Felder

## Wichtig

Das ist kein reines CSS-Einklappen. In Select/Pan/Place/Measure/Sim wird der schwere Assembly-Renderer gar nicht aufgerufen.

Dadurch sollten Mobile-Performance und Stabilität spürbar besser werden.

## Testvorschlag

1. App öffnen
2. Workarea öffnen
3. Modus `Select`
4. Baugruppe antippen
5. Prüfen: nur Kurzüberblick sichtbar
6. `Edit-Modus öffnen` drücken
7. Prüfen: vollständige Baugruppen-Properties erscheinen
8. Zurück auf `Select`
9. Prüfen: Property Manager ist wieder schlank
10. Verschieben/Zoomen/Pan testen

## Checks

Ausgeführt:

```bash
node --check ui/panels/WorkareaPanel.js
node scripts/syntax-check.mjs
node scripts/import-graph-check.mjs
node scripts/check-assembly-templates.mjs
```

Ergebnis: grün.
