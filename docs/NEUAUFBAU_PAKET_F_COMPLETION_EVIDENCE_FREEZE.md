# Neuaufbau Paket F - Completion / Evidence / Freeze

Stand: 11.10.2026
Branch: `dev/planner-neuaufbau`
Freeze-Head: `79a47b18505a9b3eb3a017129ba488a1c297114a`
Ausgangs-Head Gate 2: `824b896e6ffae82d59d8c4376ed5989ad8b40db4`
`main`: bleibt unveraendert.

## Zweck

Diese Datei friert Paket F als abgeschlossenen Entwicklungsstand auf dem Neuaufbau-Branch ein. Paket F verbindet den praktischen Baustellenablauf Kamera -> Kabel -> Messung -> Nachweis:

- Kabel behalten ihre Messhistorie.
- Kameras referenzieren vorhandene Kabel-IDs.
- Messungen koennen mit Geraet, Datum, Ergebnis, gemessener Laenge und Notiz dokumentiert werden.
- Der wirksame Kabelstatus wird aus der letzten Messung nachvollziehbar abgeleitet.
- Offene, gemessene, bestandene und fehlerhafte Kabel sind in der Uebersicht sichtbar.

Paket F Gate 3 ist keine Integration nach `main` und keine Freigabe fuer weitere Funktionspakete.

## Eingefrorener Umfang

Der eingefrorene Stand enthaelt:

1. **Messdatensatz am Kabel**
   - `id`
   - `measuredAt`
   - `device`
   - `measuredLengthM`
   - `result`
   - `note`

2. **Messergebnisse**
   - `pass`
   - `fail`
   - `open`

3. **Kabelstatuswerte**
   - `planned`
   - `installed`
   - `measured`
   - `passed`
   - `failed`

4. **Statusableitung**
   - letzte Messung `pass` -> `passed`
   - letzte Messung `fail` -> `failed`
   - letzte Messung `open` bzw. unbewertet -> `measured`
   - ohne Messung bleibt der gespeicherte bzw. offene Status sichtbar

5. **UI-Ergaenzungen**
   - Messformular im Kabelkontext;
   - wirksamer Kabelstatus und letzte Messung in den Eigenschaften;
   - Kabeluebersicht fuer offen, gemessen, bestanden und Fehler;
   - Kameraeigenschaften zeigen den Mess-/Statusstand des verknuepften Kabels.

6. **Persistenz / Transfer**
   - Save/Reload erhaelt Messungen und abgeleiteten Status;
   - Projektdatei-Export/-Import erhaelt Messungen;
   - bestehende Kabel ohne Trasse bleiben messbar.

## Evidence

### Lokale Vorpruefung

Vor dem Remote-Freeze wurden ausgefuehrt:

- `node scripts/syntax-check.mjs` -> PASS
- `node scripts/import-graph-check.mjs` -> PASS
- Paket-F-Modell-Smoke fuer Statusableitung, Summary und Validierung -> PASS

Der lokale Browserlauf war in der Sandbox nicht belastbar ausfuehrbar, weil Server/Playwright in dieser Umgebung blockierten bzw. haengen blieben. Die abschliessende Browser-Evidence stammt deshalb aus GitHub Actions.

### Remote-CI

Autoritativer Freeze-Head:

`79a47b18505a9b3eb3a017129ba488a1c297114a`

Remote-Ergebnis fuer diesen Head:

- `build` -> success
- `checks` -> success
- `paket-a` -> success
- `paket-b` -> success
- `paket-c` -> success
- `paket-d` -> success
- `paket-e` -> success
- `paket-f` -> success
- `deploy` -> success
- `report-build-status` -> success

Der vorherige Gate-2-Head `ad66e14accf12b12a38ab4fa83d6a676463fab47` zeigte in der Paket-F-Suite zwei Playwright-Strict-Mode-Fehler. Ursache war keine Produktlogik, sondern eine zu breite Textsuche: dieselbe Messungszusammenfassung erschien korrekt im Status und im Messprotokoll. Die Tests wurden auf `#measurement-list` eingegrenzt und auf `79a47b18505a9b3eb3a017129ba488a1c297114a` erfolgreich erneut geprueft.

## Abnahmekriterien

| Kriterium | Ergebnis |
| --- | --- |
| Messung an bestehendem Kabel erfassen | PASS |
| Messgeraet, Datum, Laenge, Ergebnis und Notiz speichern | PASS |
| Save/Reload erhaelt Messhistorie | PASS |
| Projektdatei-Export/-Import erhaelt Messungen | PASS |
| Kamera mit Kabel-ID zeigt Kabelstatus | PASS |
| Kabel ohne Kamera bleibt messbar | PASS |
| Kabel ohne Trasse bleibt messbar | PASS |
| Status wird aus Messergebnis abgeleitet | PASS |
| Uebersicht zeigt offen/gemessen/bestanden/Fehler | PASS |
| Paket-A/B/C/D/E bleiben gruen | PASS |

## Grenzen des Freeze

- Keine Integration nach `main`.
- Kein vollstaendiger Abnahme-PDF-/Excel-/Word-Export.
- Keine automatische Messgeraeteanbindung.
- Keine digitale Unterschrift.
- Keine Mehrfachkabel-pro-Kamera-Logik.
- Keine Migration alter Main-Projekte.
- Keine Aussage zu manueller iPhone-/iPad-Baustellenabnahme, sofern sie nicht separat vom Nutzer dokumentiert wird.

## Freeze-Entscheidung

Paket F ist auf `dev/planner-neuaufbau` bei Head `79a47b18505a9b3eb3a017129ba488a1c297114a` abgeschlossen und eingefroren.

Der naechste separate Schritt ist ein neuer Scope-Block. Sinnvolle Kandidaten sind:

- manueller Deploy-/Geraetetest fuer Paket F, falls noch nicht erfolgt;
- UX-/Menuestruktur/Mockup fuer die voller werdende Oberflaeche;
- Nachweis-/Exportpaket fuer Abnahmeunterlagen;
- Asset-/Instanzzuordnung fuer platzierte Objekte.
