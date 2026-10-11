# Neuaufbau Paket F - Mess- und Nachweisworkflow

Stand: 11.10.2026
Branch: `dev/planner-neuaufbau`
Gate 1: Definition / Scope abgeschlossen
Gate 2: Implementation / Verification abgeschlossen
Gate 3: Completion / Evidence / Freeze abgeschlossen
Ausgangs-Head: `504817ff10618e29b82e0e0c23616c529303fd46`
`main`: bleibt unveraendert.

## Ziel

Paket F definiert den naechsten echten Baustellen-Nutzen nach Paket E: Kamera -> Kabel -> Messung -> Nachweis als zusammenhaengender Ablauf.

Der Nutzer soll ein vorhandenes Kabel einer Kamera bzw. Anschlussstelle zuordnen, die reale Messung direkt am Kabel dokumentieren, daraus den fachlichen Kabelstatus sehen und spaeter einen nachvollziehbaren Nachweis fuer Baustelle oder Abnahme erzeugen koennen.

Diese Datei autorisiert noch keine Implementation. Sie legt nur Scope, Datenvertrag, Bedienregeln, Grenzen und Abnahmekriterien fuer das spaetere Gate 2 fest.

## Ausgangslage

Der aktuelle Neuaufbau kann:

- Projekte anlegen, speichern, neu laden und exportieren/importieren;
- grosse Hallen mit Arbeitsbereichen/Ausschnitten und Praezisionszoom bearbeiten;
- Trassen zeichnen und Kabel mit Trassen verbinden;
- Kameras platzieren, drehen, verschieben, FOV darstellen und optional mit einer vorhandenen Kabel-ID verbinden;
- einfache Messwerte an Kabeln speichern.

Was noch fehlt, ist der wirklich geschlossene Vor-Ort-Ablauf:

1. Kamera oder Anschlussstelle auswaehlen.
2. Zugehoeriges Kabel eindeutig sehen.
3. Messung mit Geraet, Datum, Laenge, Ergebnis und Notiz erfassen.
4. Kabelstatus daraus nachvollziehbar ableiten.
5. Offene, gemessene und fehlerhafte Kabel in einer Uebersicht erkennen.
6. Den dokumentierten Stand speichern, neu laden und fuer eine spaetere Abnahme weitergeben.

## Fachlicher Umfang fuer Gate 2

Gate 2 soll spaeter genau diesen Minimalumfang umsetzen:

1. **Messprotokoll pro Kabel**
   - Messungen bleiben fachlich am Kabeldatensatz.
   - Ein Kabel darf mehrere Messungen besitzen, z. B. Nachmessung nach Fehlerbehebung.
   - Die neueste gueltige Messung kann den abgeleiteten Kabelstatus bestimmen.
   - Messwerte werden nicht an Kameraobjekten dupliziert.

2. **Messdaten**
   - Messgeraet / Testername oder Geraetetyp;
   - Messdatum / Messzeit;
   - gemessene Laenge in Metern;
   - Ergebnis: bestanden, Fehler, offen bzw. nicht bewertet;
   - Notiz fuer Besonderheiten wie Kamera bereits angesteckt, Dose offen, Patchfeld noch nicht fertig;
   - optionale Referenz auf Pruefer oder Monteur bleibt spaeter moeglich, ist aber in V1 kein Pflichtfeld.

3. **Kamera-/Anschluss-Verknuepfung**
   - Bestehende Kameraobjekte koennen weiterhin eine Kabel-ID referenzieren.
   - Paket F definiert zusaetzlich die fachliche Lesart: Kamera und Kabel bilden zusammen den dokumentierbaren Anschluss.
   - Falls mehrere Kabel spaeter zu einer Kamera gehoeren, braucht das ein separates Scope. V1 behandelt einen primaeren Kabelbezug pro Kamera.
   - Anschlussstellen ohne Kameraobjekt bleiben ueber Kabelquelle/-ziel dokumentierbar.

4. **Statuslogik**
   - Kabelstatus bleibt speicherbar, darf aber aus Messungen unterstuetzt werden.
   - Vorgesehene Statuswerte fuer den Vor-Ort-Ablauf:
     - `planned` - geplant;
     - `installed` - gezogen / montiert;
     - `measured` - gemessen, aber ohne klare PASS/FAIL-Wertung;
     - `passed` - Messung bestanden;
     - `failed` - Messung fehlerhaft.
   - Eine fehlende Messung ist kein Validierungsfehler, muss aber in der Uebersicht sichtbar sein.
   - Eine fehlerhafte Messung darf nicht stillschweigend von einem manuell besseren Status verdeckt werden.

5. **Uebersichten**
   - Liste oder Gruppierung fuer offene, gemessene, bestandene und fehlerhafte Kabel.
   - Kameras mit fehlender Kabelzuordnung bleiben als Hinweis sichtbar.
   - Kabel ohne Trasse bleiben weiterhin erlaubt, aber mit klarer Meldung zur offenen geplanten Trassenlaenge.
   - Die Uebersicht muss auf iPhone/iPad fuer schnelles Vor-Ort-Eintragen nutzbar bleiben.

6. **Nachweis / Exportgrenze**
   - Gate 2 soll den Datenvertrag so vorbereiten, dass ein spaeterer Abnahmeexport moeglich ist.
   - Minimal in Paket F ist ein internes, gespeichertes Nachweisformat im Projekt.
   - Ein schoener PDF-/Excel-/Word-Export ist noch nicht Bestandteil von Paket F, ausser Gate 2 entscheidet sich fuer einen sehr kleinen text-/jsonbasierten Export.
   - Drucklayout, Firmenlogo, Unterschriftenfelder und vollstaendige Abnahmevorlagen sind eigene spaetere Ausgabe-Pakete.

## Datenvertrag V1

Paket C fuehrte bereits Kabel und Messungen unter `modules.electrical` ein. Paket F soll diesen Vertrag nicht ersetzen, sondern praezisieren und fuer den zusammenhaengenden Workflow absichern.

Vorgesehener Messdatensatz am Kabel:

```json
{
  "id": "measurement-...",
  "measuredAt": "2026-10-11T09:30:00.000Z",
  "device": "Netzwerktester",
  "measuredLengthM": 42.6,
  "result": "pass",
  "note": "Kamera am Ziel bereits angeschlossen, PoE noch aus."
}
```

Vorgesehene Kabelstatuswerte:

```json
{
  "status": "planned"
}
```

Erlaubte Statuswerte:

- `planned`
- `installed`
- `measured`
- `passed`
- `failed`

Erlaubte Messergebnisse:

- `pass`
- `fail`
- `open`

Vertragsregeln:

- Messungs-IDs muessen innerhalb eines Kabels eindeutig sein.
- `measuredAt` muss, wenn gesetzt, als ISO-Zeitstempel speicherbar sein.
- `device` ist ein freier kurzer Text und darf leer sein.
- `measuredLengthM` darf leer sein; wenn gesetzt, muss der Wert groesser oder gleich 0 sein.
- `result` muss einer der erlaubten Ergebniswerte sein.
- `note` ist freier Text.
- Kameras referenzieren weiter Kabel per `cableId`; das Kabel bleibt die Autoritaet fuer Messungen.
- Projektdatei-Export/-Import muss Messungen unveraendert erhalten.
- Bestehende Projekte ohne Messungen bleiben gueltig.

## Bedienregeln

- Der Nutzer soll eine Messung direkt aus dem Kabel- oder Kamera-Kontext hinzufuegen koennen.
- Die wichtigste mobile Aktion ist: Kabel/Kamera auswaehlen -> Messdaten eintragen -> speichern.
- Es darf keine Pflicht geben, zuerst alle Trassen sauber zuzuordnen, bevor eine reale Messung eingetragen werden kann.
- Ein Kabel ohne Trasse zeigt weiterhin "geplante Trassenlaenge offen", blockiert aber die Messdokumentation nicht.
- Die letzte Messung muss in der Kabel-/Kameraansicht schnell sichtbar sein.
- Die Historie der Messungen soll erhalten bleiben, damit Nachmessungen nachvollziehbar sind.
- Statushinweise muessen knapp sein und duerfen die Arbeitsflaeche nicht mit langen Erklaertexten fuellen.

## Grenzen / Nicht Bestandteil von Paket F

- Kein automatisches Auslesen echter Messgeraete.
- Keine Bluetooth-/USB-/Cloud-Anbindung fuer Tester.
- Kein vollstaendiges Abnahme-PDF mit Firmenlayout.
- Keine digitale Unterschrift.
- Keine automatische Normbewertung nach Messgeraeteprotokoll.
- Keine Mehrfachkabel-pro-Kamera-Logik, ausser sie ist bereits ohne Zusatzmodell abbildbar.
- Keine Materialliste oder Bestellliste.
- Keine Integration nach `main`.
- Keine Migration alter Main-Projekte.

## Vorgesehene Dateien fuer Gate 2

Der Gate-2-Scope soll klein bleiben. Voraussichtliche Maximaldateien:

- `planner-v2/src/electrical/electrical-model.v1.js` - Messdatensatz, Statusableitung und Validierung.
- `planner-v2/src/domain/project-validation.v1.js` - Validierung der Messdaten und Statuswerte.
- `planner-v2/src/ui/workarea-editor.v1.js` - Messung hinzufuegen, Kabel-/Kamera-Kontext, Uebersichten.
- `planner-v2/src/ui/planner.css` - mobile Mess- und Statusdarstellung.
- `planner-v2/src/main.js` - sichtbare Testbuild-Kennung fuer Paket F.
- `tests/planner-v2-measurements.spec.mjs` - Browserfaelle fuer Messung, Status, Kamera-/Kabelbezug, Reload und Import/Export.
- optional `.github/workflows/planner-v2-paket-f.yml` - separater Paket-F-Lauf mit Paket-A/B/C/D/E/F-Suite.

## Abnahmekriterien fuer Gate 2

Paket F Gate 2 gilt nur dann als bestanden, wenn mindestens folgende Faelle automatisiert geprueft sind:

- Messung an bestehendem Kabel erfassen.
- Messung mit Geraet, Datum, gemessener Laenge, Ergebnis und Notiz speichern.
- Save/Reload erhaelt Messhistorie und letzte Messung.
- Projektdatei-Export/-Import erhaelt Messungen und Status.
- Kamera mit Kabel-ID zeigt den zugehoerigen Mess-/Statusstand.
- Kabel ohne Kamera bleibt messbar.
- Kabel ohne Trasse bleibt messbar und zeigt weiter die offene geplante Trassenlaenge.
- Status wird aus Messergebnis nachvollziehbar abgeleitet oder sichtbar aktualisiert.
- Uebersicht zeigt offene, gemessene, bestandene und fehlerhafte Kabel.
- iPhone/iPad-Hochkantbedienung fuer das schnelle Eintragen bleibt erreichbar.
- Paket-A/B/C/D/E-Tests bleiben gruen.

## Gate-1-Ergebnis

Paket F ist fachlich und technisch als naechster Block nach Paket E definiert. Diese Datei autorisiert noch keine Implementation. Der naechste separate Schritt ist:

`Paket F - Gate 2 Implementation / Verification gegen exakt 504817ff10618e29b82e0e0c23616c529303fd46 auf dev/planner-neuaufbau.`

## Gate-2-Ergebnis

Paket F wurde auf `dev/planner-neuaufbau` umgesetzt:

- normierter Messdatensatz am Kabel mit `measuredAt`, `device`, `measuredLengthM`, `result` und `note`;
- erlaubte Messergebnisse `pass`, `fail`, `open`;
- Kabelstatuswerte `planned`, `installed`, `measured`, `passed`, `failed`;
- Statusableitung aus der letzten Messung;
- Messuebersicht fuer offene, gemessene, bestandene und fehlerhafte Kabel;
- Anzeige des Kabel-/Messstatus im Kamera-Kontext bei verknuepfter Kabel-ID;
- Save/Reload- und Import/Export-Abdeckung ueber die Paket-F-Browser-Suite;
- eigener Paket-F-CI-Lauf.

## Gate-3-Ergebnis

Paket F wurde bei Head `79a47b18505a9b3eb3a017129ba488a1c297114a` auf `dev/planner-neuaufbau` abgeschlossen und in [`NEUAUFBAU_PAKET_F_COMPLETION_EVIDENCE_FREEZE.md`](./NEUAUFBAU_PAKET_F_COMPLETION_EVIDENCE_FREEZE.md) frozen.

Remote-CI fuer diesen Head:

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

Gate 3 ist keine `main`-Integration. Weitere Produktarbeit braucht wieder einen eigenen Scope.
