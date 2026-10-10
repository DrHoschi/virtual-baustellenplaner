# Neuaufbau Paket D - Kameraobjekte, FOV und Kabelbezug

Stand: 10.10.2026
Branch: `dev/planner-neuaufbau`
Gate 1: Definition / Scope abgeschlossen
Gate 2: Implementation / Verification abgeschlossen
Gate 3: Completion / Evidence / Freeze abgeschlossen
Ausgangs-Head: `d9f6bb49b019488368f91f523c17d2b9bbb812a5`
Functional Freeze Head: `a14a510d64f4df62257d8d06b07f5e15a279b18b`
`main`: bleibt unveraendert.

## Ziel

Paket D ergaenzt den bisherigen Projekt-, Workarea- und Elektrikstand um eine eigenstaendige Kameradomaene. Der Nutzer soll Kameras im 2D-Plan platzieren, ausrichten, ihren Sichtsektor pruefen und die Kamera mit einer vorhandenen Kabel-ID verbinden koennen. Die Kamera fuehrt keine zweite Kabel- oder Messwertquelle ein.

Dieser Scope baut auf Paket C auf:

- Paket A: Projektvertrag, lokaler Speicher, Projektdatei-Export/-Import und Grundriss-/Bereichsbezug.
- Paket B: 2D-Workarea, Ebenen, generische Objekte, Objektbaum, Eigenschaften und Save/Reload.
- Paket C: Kabeltrassen, Kabeldatensaetze, Kabelstatus, manuelle Messwerte und nachtraegliche Trassenzuordnung.

## Fachlicher Umfang fuer Gate 2

- Kameras als stabile Fachobjekte unter `modules.camera`.
- Kamera platzieren, auswaehlen, verschieben und um die Hochachse drehen.
- Sichtsektor/FOV als abgeleitete 2D-Geometrie aus Position, Drehung, horizontalem Oeffnungswinkel und Reichweite.
- Eigenschaften:
  - Kamera-ID;
  - Bezeichnung;
  - Typ: `thermal`, `color`, `bispectral`;
  - Position X/Y in Millimetern;
  - Ebene/Layer und Z-/Montagehoehe in Millimetern;
  - Drehung in Grad;
  - horizontaler FOV in Grad;
  - Reichweite in Millimetern bzw. UI-Anzeige in Metern;
  - Montageort / Montagehinweis;
  - optionale Referenz auf eine vorhandene Kabel-ID.
- Objektbaum-/Listenanzeige fuer Kameraobjekte getrennt von generischen Planobjekten, Kabeltrassen und Kabeln.
- Eigenschaftenpanel fuer bestehende Kameras inklusive Kabelauswahl aus vorhandenen `modules.electrical.cables`.
- Save/Reload, Projektdatei-Export/-Import und Validierung fuer Kameradaten.

## Datenvertrag V1

Die neue Domaene soll optional sein und aeltere Paket-A/B/C-Projekte ohne Kameramodul gueltig lassen.

Vorgesehener Modulblock:

```json
{
  "modules": {
    "camera": {
      "version": 1,
      "cameras": [
        {
          "id": "camera-...",
          "name": "Kamera 7",
          "type": "bispectral",
          "xMm": 12000,
          "yMm": 6000,
          "zMm": 3000,
          "layerId": "layer-ground",
          "rotationDeg": 0,
          "fovDeg": 60,
          "rangeMm": 15000,
          "mounting": {
            "location": "Wand / Stuetze",
            "heightMm": 3000,
            "note": ""
          },
          "cableId": "Z1"
        }
      ]
    }
  }
}
```

Vertragsregeln:

- `id` muss vorhanden und innerhalb `modules.camera.cameras` eindeutig sein.
- `type` ist einer der erlaubten Werte `thermal`, `color`, `bispectral`.
- `xMm`, `yMm`, `zMm`, `rotationDeg`, `fovDeg` und `rangeMm` sind Zahlen.
- `fovDeg` muss groesser 0 und kleiner 180 sein.
- `rangeMm` muss groesser 0 sein.
- `layerId` muss auf eine vorhandene Ebene verweisen.
- `cableId` darf leer sein; wenn gesetzt, muss sie auf eine vorhandene Kabel-ID in `modules.electrical.cables` verweisen.
- Messwerte bleiben am Kabeldatensatz. Kamera zeigt nur die Referenz und darf keine Messwerte duplizieren.

## Darstellung und Bedienung

- Kamera wird in der 2D-Workarea als gut antippbares Symbol dargestellt.
- Der Sichtsektor wird als transparente Flaeche/Keil gezeichnet und ist keine eigene dauerhafte Geometrie.
- Der Sichtsektor darf nicht als riesige Hit-Test-Flaeche wirken; Auswahl erfolgt ueber das Kamerasymbol oder die Kameraliste.
- Der Sichtsektor darf die initialen Viewport-Bounds nicht vergroessern.
- Drehung wird in der Topansicht dargestellt; 0 Grad zeigt in eine dokumentierte Standardrichtung der Workarea.
- FOV-Presets duerfen angeboten werden, z. B. 25, 40, 60 und 90 Grad, aber der manuelle Wert bleibt moeglich.
- Die Kamera-Liste zeigt ID/Name, Typ und optional die verknuepfte Kabel-ID.
- Fehlende Kabelzuordnung ist ein Hinweis, aber kein Speicherfehler.
- Eine gesetzte, aber ungueltige Kabelreferenz ist ein Validierungsfehler.

## Grenzen / Nicht Bestandteil von Paket D

- Keine automatische Kamerapositionierung.
- Keine Sichtbehinderungs-, Wand-, Regal- oder Raum-Clipping-Berechnung.
- Keine vollstaendige vertikale 3D-Abdeckungsberechnung.
- Keine Herstellerbibliothek oder echte Kameradatenblaetter.
- Keine PNG-/GLB-Kameraassets als Pflicht; ein einfaches Workarea-Symbol reicht fuer V1.
- Keine Live-Kamera-Integration, RTSP, Alarmkopplung oder digitale-Zwilling-Funktionen.
- Keine Material-/Bestellliste fuer Kameras.
- Keine automatische Erzeugung von Kabeltrassen aus Kamerapositionen.
- Keine Uebernahme alter Main-Projekte oder alter Scene-Pfade.

## Vorgesehene Dateien fuer Gate 2

Der genaue Gate-2-Scope kann kleiner bleiben, soll aber diese Grenzen nicht ueberschreiten:

- `planner-v2/src/camera/camera-model.v1.js` - Kameradatenvertrag, Defaults, FOV-Geometrie und Validierung.
- `planner-v2/src/domain/project-validation.v1.js` - optionale Validierung von `modules.camera`.
- `planner-v2/src/ui/workarea-editor.v1.js` - Platzieren, Anzeigen, Auswahl und Eigenschaften fuer Kameras.
- `planner-v2/src/ui/planner.css` - Darstellung von Kamera, FOV und Kameraeigenschaften.
- `planner-v2/src/main.js` - sichtbare Testbuild-Kennung fuer Paket D.
- `tests/planner-v2-camera.spec.mjs` - Browserfaelle fuer Platzieren, FOV, Kabelreferenz, Save/Reload und Import/Export.
- `.github/workflows/planner-v2-paket-d.yml` - separater Paket-D-Lauf mit Paket-A/B/C/D-Suite.

## Abnahmekriterien fuer Gate 2

Gate 2 gilt nur dann als bestanden, wenn mindestens folgende Faelle automatisiert geprueft sind:

- Kamera platzieren, auswaehlen, verschieben und drehen.
- FOV-Winkel und Reichweite aendern; Sichtsektor reagiert sichtbar.
- Kamera mit vorhandener Kabel-ID verbinden.
- Kamera ohne Kabel-ID bleibt erlaubt und zeigt einen klaren Hinweis.
- Ungueltige Kabel-ID wird validiert und als Fehler gemeldet.
- Save/Reload erhaelt Kamera, FOV-Werte, Montageangaben und Kabelreferenz.
- Projektdatei-Export/-Import erhaelt Kamera und Kabelreferenz.
- Bestehende Paket-A/B/C-Tests bleiben gruen.

## Geraete- und Praxishinweis

Paket D selbst wird zunaechst ueber Browser-E2E abgesichert. Der vollstaendige reale Geraetetest gehoert zu Paket E. Fuer Paket D sollen iPad quer, iPad hochkant und iPhone hochkant aber als Bedienrisiko im Blick bleiben: Kameraauswahl, Eigenschaftenpanel, FOV-Erkennbarkeit und Kabelauswahl duerfen auf mobilen Layouts nicht unbedienbar werden.

## Gate-1-Ergebnis

Paket D ist fachlich und technisch als naechster Block nach Paket C definiert. Diese Datei autorisiert noch keine Implementation. Der naechste separate Schritt ist:

`Paket D - Gate 2 Implementation / Verification gegen exakt d9f6bb49b019488368f91f523c17d2b9bbb812a5 auf dev/planner-neuaufbau.`

## Gate-2-/Gate-3-Ergebnis

Paket D wurde auf `dev/planner-neuaufbau` umgesetzt, automatisiert verifiziert und nach Nutzerpruefung auf dem Deploy abgeschlossen.

Completion / Evidence / Freeze ist dokumentiert in [`NEUAUFBAU_PAKET_D_COMPLETION_EVIDENCE_FREEZE.md`](./NEUAUFBAU_PAKET_D_COMPLETION_EVIDENCE_FREEZE.md).

Manuelle Praxis-Evidence vom 10.10.2026:

- Kamera platzieren: **PASS**
- Kamera drehen: **PASS**
- Kamera verschieben: **PASS**

Dokumentierte Folgepunkte ausserhalb von Paket D:

- Hallenabschnitte / Arbeitsbereiche / Praezisionszoom fuer sehr grosse Hallen;
- Menuestruktur / Objektbaum / Mockup fuer die wachsende Moduloberflaeche.
