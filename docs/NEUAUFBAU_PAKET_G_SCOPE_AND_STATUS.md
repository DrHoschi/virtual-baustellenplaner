# Neuaufbau Paket G - Nachweis / Abnahmeexport / Baustellendoku

Stand: 11.10.2026
Branch: `dev/planner-neuaufbau`
Gate 1: Definition / Scope abgeschlossen
Gate 2: Implementation / Verification abgeschlossen
Gate 3: Completion / Evidence / Freeze abgeschlossen
Ausgangs-Head: `6ae8fb143a5aeb5228dd1bbbcd9ef7ac2abe8105`
Funktionaler Paket-F-Freeze: `79a47b18505a9b3eb3a017129ba488a1c297114a`
`main`: bleibt unveraendert.

## Ziel

Paket G definiert den naechsten Baustellen-Nutzen nach Paket F: aus gespeicherten Kameras, Kabeln und Messungen entsteht eine uebergabefaehige Nachweis- und Abnahmedokumentation.

Der Nutzer soll nicht nur vor Ort messen und speichern koennen, sondern danach schnell erkennen:

- welche Kabel/Kameras fertig dokumentiert sind;
- welche Kabel noch offen sind;
- welche Kabel fehlerhaft sind;
- welche Messdaten fuer eine Uebergabe oder Abnahme exportiert werden koennen.

Diese Datei autorisiert noch keine Implementation. Sie legt Scope, Datenvertrag, Ausgabegrenzen, UX-Regeln und Abnahmekriterien fuer das spaetere Gate 2 fest.

## Ausgangslage

Der aktuelle Neuaufbau kann:

- Projekte anlegen, speichern, neu laden und exportieren/importieren;
- Hallenbereiche und Arbeitsbereiche nutzen;
- Trassen und Kabel dokumentieren;
- Kameras platzieren, drehen, verschieben und mit Kabel-IDs verknuepfen;
- Messungen am Kabel speichern;
- Kabelstatus aus Messungen ableiten;
- offene, gemessene, bestandene und fehlerhafte Kabel in der Anwendung anzeigen.

Was noch fehlt, ist eine klare Nachweis-/Abnahmeebene:

1. Baustellenuebersicht fuer offene, fehlerhafte und abnahmebereite Punkte.
2. Messprotokoll pro Kabel und Kamera in einer lesbaren Nachweisform.
3. Exportfaehiges Minimalformat fuer Weitergabe, Archiv oder spaetere PDF-/Excel-Erzeugung.
4. Trennung zwischen interner Projektdaten-Speicherung und abgeleitetem Nachweis.

## Fachlicher Umfang fuer Gate 2

Gate 2 soll spaeter genau diesen Minimalumfang umsetzen:

1. **Abnahmeuebersicht**
   - Gesamtzaehler fuer Kabel: offen, installiert, gemessen, bestanden, fehlerhaft.
   - Liste offener Kabel ohne gueltige Messung.
   - Liste fehlerhafter Kabel mit letzter Messnotiz.
   - Liste bestandener Kabel als abnahmebereite Positionen.
   - Verknuepfte Kamera, falls vorhanden, wird je Kabel angezeigt.

2. **Messprotokoll je Kabel/Kamera**
   - Kabel-ID und Kabelbezeichnung;
   - Quelle/Ziel und Ports;
   - zugeordnete Trasse und geplante Trassenlaenge, falls vorhanden;
   - verknuepfte Kamera-ID bzw. Kameraname, falls vorhanden;
   - letzter wirksamer Kabelstatus;
   - Messhistorie mit Datum, Geraet, gemessener Laenge, Ergebnis und Notiz.

3. **Exportformat V1**
   - V1 exportiert zuerst maschinenlesbar und einfach weiterverwendbar.
   - Minimalformat: JSON fuer vollstaendige Nachweisstruktur.
   - Optional zusaetzlich CSV fuer tabellarische Kabel-/Messliste, sofern ohne groesseren UI-/Formatballast moeglich.
   - Export ist abgeleitet aus Projektdaten; er wird nicht als zweite Autoritaet gespeichert.
   - Import des Nachweisexports zurueck ins Projekt ist nicht Bestandteil von Paket G.

4. **Baustellendoku-Struktur**
   - Projektname und Exportzeitpunkt;
   - optionale Baustellen-/Abschnittskennung aus vorhandenen Projektdaten, falls verfuegbar;
   - Kabel-/Kamera-/Messungsabschnitte;
   - Statuszusammenfassung;
   - Warnhinweise fuer offene oder fehlerhafte Positionen.

5. **iPhone/iPad-UX**
   - Vor Ort bleibt die Eingabe in Paket F unveraendert schnell.
   - Paket G darf die mobile Eingabe nicht ueberladen.
   - Auf iPhone/iPad reicht eine kompakte Nachweisliste mit Statusfiltern.
   - Desktop/Tablet quer darf eine breitere Uebersicht mit Exportaktion anbieten.

6. **Desktop-UX**
   - Uebersicht fuer Baustellenleiter/Abnahme;
   - klare Filter: offen, Fehler, bestanden, alle;
   - Exportaktion gut auffindbar, aber nicht mitten im Messformular.

## Datenvertrag V1

Paket G erzeugt einen abgeleiteten Nachweis aus dem vorhandenen Projektvertrag. Der Export darf keine neue Speicherautoritaet werden.

Vorgesehene Struktur:

```json
{
  "schema": "baustellenplaner.acceptance.v1",
  "exportedAt": "2026-10-11T12:00:00.000Z",
  "project": {
    "id": "project-...",
    "name": "Musterhalle"
  },
  "summary": {
    "totalCables": 12,
    "open": 3,
    "measured": 1,
    "passed": 7,
    "failed": 1
  },
  "items": [
    {
      "cableId": "CAM-001",
      "cableName": "Netzwerkkabel Kamera 1",
      "source": "Patchfeld P01",
      "target": "Kamera 1 LAN",
      "status": "passed",
      "cameraId": "camera-...",
      "cameraName": "Kamera Tor",
      "trayIds": ["tray-..."],
      "plannedLengthM": 31.2,
      "latestMeasurement": {
        "measuredAt": "2026-10-11T09:30:00.000Z",
        "device": "Netzwerktester",
        "measuredLengthM": 31.4,
        "result": "pass",
        "note": "Kamera am Ziel bereits angeschlossen, PoE aus."
      },
      "measurements": []
    }
  ],
  "warnings": []
}
```

Vertragsregeln:

- `schema` ist fest auf `baustellenplaner.acceptance.v1`.
- `exportedAt` ist der Exportzeitpunkt.
- `summary` wird aus Kabeln und Messungen abgeleitet.
- `items` enthalten je Kabel eine Nachweisposition.
- Kameraangaben sind optional und werden nur gesetzt, wenn eine Kamera diese Kabel-ID referenziert.
- Trassenangaben sind optional; fehlende Trasse erzeugt einen Hinweis, blockiert den Export aber nicht.
- Messhistorie bleibt in zeitlicher Reihenfolge erhalten.
- Der Export darf vorhandene Projektdateien nicht veraendern.

## Bedienregeln

- Der Nutzer darf auch bei offenen oder fehlerhaften Kabeln exportieren.
- Der Export muss dann sichtbar Warnungen enthalten.
- Die Anwendung soll nicht suggerieren, dass ein Projekt vollstaendig abgenommen ist, wenn offene oder fehlerhafte Kabel existieren.
- Die Nachweisansicht ist lesend/abgeleitet; Korrekturen erfolgen weiter an Kabeln, Kameras und Messungen.
- Der mobile Ablauf bleibt: Kabel/Kamera auswaehlen -> Messung eintragen -> speichern.
- Der Nachweisablauf ist: Abnahmeliste pruefen -> Filter setzen -> Export erzeugen.

## Grenzen / Nicht Bestandteil von Paket G

- Kein gestaltetes PDF mit Firmenlogo.
- Kein Excel-Layout mit Formeln, Farben oder Unterschriftenfeldern.
- Keine digitale Unterschrift.
- Keine automatische Normbewertung.
- Keine automatische Messgeraete-Datei-Auswertung.
- Kein Import von externen Messgeraeteprotokollen.
- Keine Cloud-Synchronisation.
- Keine Kundendaten-/Adressverwaltung.
- Keine Integration nach `main`.
- Keine Migration alter Main-Projekte.

## Vorgesehene Dateien fuer Gate 2

Der Gate-2-Scope soll klein bleiben. Voraussichtliche Maximaldateien:

- `planner-v2/src/electrical/electrical-model.v1.js` - Nachweisableitung aus Kabeln, Kameras und Messungen.
- `planner-v2/src/domain/project-validation.v1.js` - falls zusaetzliche Nachweisvertragspruefung noetig wird.
- `planner-v2/src/ui/workarea-editor.v1.js` - Nachweis-/Abnahmeliste und Exportaktion.
- `planner-v2/src/ui/planner.css` - kompakte Nachweis- und Filterdarstellung.
- `planner-v2/src/main.js` - sichtbare Testbuild-Kennung fuer Paket G.
- `tests/planner-v2-acceptance-export.spec.mjs` - Browserfaelle fuer Nachweisliste, Filter, Export, Reload-Basis und offene/fehlerhafte Kabel.
- optional `.github/workflows/planner-v2-paket-g.yml` - separater Paket-G-Lauf mit Paket-A/B/C/D/E/F/G-Suite.

## Abnahmekriterien fuer Gate 2

Paket G Gate 2 gilt nur dann als bestanden, wenn mindestens folgende Faelle automatisiert geprueft sind:

- Nachweisuebersicht zeigt offene, gemessene, bestandene und fehlerhafte Kabel.
- Kabel mit Kamera-Verknuepfung zeigt Kamera-ID oder Kameraname in der Nachweisliste.
- Kabel ohne Kamera bleibt als Kabelnachweis enthalten.
- Kabel ohne Trasse bleibt exportierbar und erzeugt einen Hinweis.
- Fehlende Messung wird als offen sichtbar.
- Fehlerhafte letzte Messung wird als Fehler sichtbar.
- Bestandene letzte Messung wird als bestanden sichtbar.
- JSON-Export enthaelt Projekt, Summary, Items, Messhistorie und Warnungen.
- Export veraendert das Projekt nicht.
- Save/Reload vor Export bleibt stabil.
- Paket-A/B/C/D/E/F-Tests bleiben gruen.

## Gate-1-Ergebnis

Paket G ist fachlich und technisch als naechster Block nach Paket F definiert. Diese Datei autorisiert noch keine Implementation.

Der naechste separate Schritt ist:

`Paket G - Gate 2 Implementation / Verification gegen exakt 6ae8fb143a5aeb5228dd1bbbcd9ef7ac2abe8105 auf dev/planner-neuaufbau.`

## Gate-2-Ergebnis

Paket G wurde auf `dev/planner-neuaufbau` umgesetzt:

- abgeleitete Nachweisstruktur `baustellenplaner.acceptance.v1`;
- Summary fuer offene, installierte, gemessene, bestandene und fehlerhafte Kabel;
- Nachweispositionen je Kabel mit Quelle/Ziel, Kamera, Trassen, geplanter Laenge und Messhistorie;
- Warnungen fuer fehlende Messung, fehlende Trasse und fehlerhafte letzte Messung;
- Nachweisbox in der Workarea mit Filter fuer alle/offen/installiert/gemessen/bestanden/Fehler;
- JSON-Export als erster uebergabefaehiger Abnahmenachweis;
- Browser- und Modelltests fuer Nachweisliste, Filter, Export, Warnungen und Nicht-Mutation des Projekts;
- eigener Paket-G-CI-Lauf.

## Gate-3-Ergebnis

Paket G wurde bei Head `b51b20e0b69b4ea40264b646e96c44c376f956af` auf `dev/planner-neuaufbau` abgeschlossen und in [`NEUAUFBAU_PAKET_G_COMPLETION_EVIDENCE_FREEZE.md`](./NEUAUFBAU_PAKET_G_COMPLETION_EVIDENCE_FREEZE.md) frozen.

Remote-CI fuer diesen Head:

- `build` -> success
- `checks` -> success
- `paket-a` -> success
- `paket-b` -> success
- `paket-c` -> success
- `paket-d` -> success
- `paket-e` -> success
- `paket-f` -> success
- `paket-g` -> success
- `deploy` -> success
- `report-build-status` -> success

Gate 3 ist keine `main`-Integration. Weitere Produktarbeit braucht wieder einen eigenen Scope.
