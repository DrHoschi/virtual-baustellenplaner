# Neuaufbau Paket G - Completion / Evidence / Freeze

Stand: 11.10.2026
Branch: `dev/planner-neuaufbau`
Freeze-Head: `b51b20e0b69b4ea40264b646e96c44c376f956af`
Ausgangs-Head Gate 2: `6cdfa5dd84d336005866b41dbb160b1c33199b55`
Funktionaler Paket-F-Freeze: `79a47b18505a9b3eb3a017129ba488a1c297114a`
`main`: bleibt unveraendert.

## Zweck

Diese Datei friert Paket G als abgeschlossenen Entwicklungsstand auf dem Neuaufbau-Branch ein. Paket G ergaenzt den Paket-F-Ablauf Kamera -> Kabel -> Messung um eine abgeleitete Nachweis- und Abnahmeebene.

Der Nutzer kann aus den vorhandenen Projektdaten eine erste uebergabefaehige JSON-Dokumentation erzeugen, ohne dass eine zweite Speicherautoritaet entsteht.

Paket G Gate 3 ist keine Integration nach `main` und keine Freigabe fuer weitere Funktionspakete.

## Eingefrorener Umfang

Der eingefrorene Stand enthaelt:

1. **Nachweisvertrag**
   - `schema: baustellenplaner.acceptance.v1`
   - `exportedAt`
   - Projekt-ID und Projektname
   - Summary fuer Kabelstatus
   - Nachweispositionen je Kabel
   - Warnhinweise

2. **Statuszusammenfassung**
   - totalCables
   - open
   - installed
   - measured
   - passed
   - failed

3. **Nachweisposition je Kabel**
   - Kabel-ID und Kabelname;
   - Quelle und Ziel;
   - wirksamer Status;
   - optionale Kamera-ID und Kameraname;
   - zugeordnete Trassen;
   - geplante Laenge in Metern, falls ableitbar;
   - letzte Messung;
   - vollstaendige Messhistorie.

4. **Warnhinweise**
   - fehlende Messung;
   - fehlende Trassenzuordnung;
   - fehlerhafte letzte Messung.

5. **UI-Ergaenzungen**
   - Nachweisbereich in der Workarea-Sidebar;
   - Filter fuer alle, offen, installiert, gemessen, bestanden und Fehler;
   - Klick auf Nachweisposition oeffnet das zugehoerige Kabel;
   - JSON-Exportaktion fuer `*-abnahmenachweis.json`.

6. **Grenzen**
   - kein gestaltetes PDF;
   - kein Excel-Layout;
   - keine digitale Unterschrift;
   - kein Messgeraete-Dateiimport;
   - keine Cloud-Synchronisation;
   - keine Integration nach `main`.

## Evidence

### Lokale Vorpruefung

Vor dem Remote-Freeze wurden ausgefuehrt:

- `node scripts/syntax-check.mjs` -> PASS
- `node scripts/import-graph-check.mjs` -> PASS
- Paket-G-Modell-Smoke fuer `buildAcceptanceReport` -> PASS

Der lokale Playwright-Lauf war in der Sandbox nicht belastbar ausfuehrbar, weil der Runner ohne Testausgabe haengen blieb. Die abschliessende Browser-Evidence stammt deshalb aus GitHub Actions.

### Remote-CI

Autoritativer Freeze-Head:

`b51b20e0b69b4ea40264b646e96c44c376f956af`

Remote-Ergebnis fuer diesen Head:

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

Der vorherige Paket-G-Head `15469b74d7a671995f32b5a177009857648a7e3e` zeigte drei Playwright-Strict-Mode-Fehler. Ursache war keine Produktlogik, sondern eine zu breite Kabelauswahl in aelteren Paket-C/F-Tests: Die neue Nachweisliste enthaelt ebenfalls Buttons mit Kabel-IDs. Die Klicks wurden auf `#cable-list` eingegrenzt und auf `b51b20e0b69b4ea40264b646e96c44c376f956af` erfolgreich erneut geprueft.

## Abnahmekriterien

| Kriterium | Ergebnis |
| --- | --- |
| Nachweisuebersicht zeigt offene/gemessene/bestandene/fehlerhafte Kabel | PASS |
| Kabel mit Kamera-Verknuepfung zeigt Kamera in der Nachweisliste | PASS |
| Kabel ohne Kamera bleibt im Nachweis enthalten | PASS |
| Kabel ohne Trasse bleibt exportierbar und erzeugt Hinweis | PASS |
| Fehlende Messung wird offen sichtbar | PASS |
| Fehlerhafte letzte Messung wird als Fehler sichtbar | PASS |
| Bestandene letzte Messung wird als bestanden sichtbar | PASS |
| JSON-Export enthaelt Projekt, Summary, Items, Messhistorie und Warnungen | PASS |
| Export veraendert das Projekt nicht | PASS |
| Save/Reload-Grundlage bleibt stabil | PASS |
| Paket-A/B/C/D/E/F-Regressionen bleiben gruen | PASS |

## Freeze-Entscheidung

Paket G ist auf `dev/planner-neuaufbau` bei Head `b51b20e0b69b4ea40264b646e96c44c376f956af` abgeschlossen und eingefroren.

Der naechste separate Schritt ist ein neuer Scope-Block. Sinnvolle Kandidaten sind:

- manueller Deploy-/Geraetetest fuer Paket G auf iPhone/iPad;
- UX-/Menuestruktur/Mockup fuer die voller werdende Oberflaeche;
- Ausgabe-Paket fuer PDF-/Excel-Abnahmeunterlagen;
- Asset-/Instanzzuordnung fuer platzierte Objekte.
