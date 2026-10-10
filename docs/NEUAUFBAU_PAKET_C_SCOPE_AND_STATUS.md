# Neuaufbau Paket C – Kabel- und Trassenplanung

Stand: 10.10.2026  
Branch: `dev/planner-neuaufbau`  
Gate 2: freigegeben  
Ausgangs-Head: `2d0fa428d87f01c32de350900733dab52763ee08`  
`main`: bleibt unverändert.

## Ergebnisumfang

Paket C ergänzt die gemeinsame Paket-B-Workarea um eine eigenständige Elektromodul-Domäne unter `modules.electrical`, ohne Projektformat v1 oder die vorhandene lokale Speicher- und Projektdatei-Logik zu ersetzen.

- Maßstäbliche Kabeltrassen als Polyline in Millimetern; Breite, Ebene und stabile ID.
- Trasse auf dem Plan zeichnen, abschließen, auswählen, einzelne Verlaufspunkte ziehen, Eigenschaften ändern und löschen.
- Kabel mit stabiler ID, Name, Quell-/Zielgerät, Ports, Status und Trassenreferenz.
- Geplante Weglänge wird aus den zugeordneten Trassengeometrien abgeleitet. Tatsächliche Messungen bleiben separate Datensätze mit Messgerät, Länge, Ergebnis, Zeit und Notiz.
- Gemeinsames Save/Reload, Projektdatei-Export/Import und Undo/Redo.
- Validierung der Modulversion, eindeutigen IDs, Geometrie, Layer, Endpunkte, Status, Referenzen und Messdaten.

Kabeltrassen werden nie aus dem Grundriss oder Kameramarkierungen abgeleitet. Eine fehlende Trassenzuordnung lässt die geplante Kabellänge offen. Paket C erstellt noch keine Kameraobjekte oder Kamera-Kabel-Verknüpfung.

## Geänderte und neue Dateien

- `planner-v2/src/electrical/electrical-model.v1.js` – Datenvertrag, Längenberechnung und Modulvalidierung.
- `planner-v2/src/domain/project-validation.v1.js` – Validierung des optionalen Elektromoduls; ältere Paket-A/B-Projekte ohne Modul bleiben gültig.
- `planner-v2/src/ui/workarea-editor.v1.js` – Trassenzeichnung, Sichtbarkeit, Knotenziehen, Kabel- und Messungsbedienung; Projektmodule laufen durch dieselbe Historie.
- `planner-v2/src/ui/planner.css` – Darstellung der Elektrobedienung.
- `planner-v2/src/main.js` – Testbuild-Kennung Paket C.
- `tests/planner-v2-electrical.spec.mjs` – Zeichen-, Save/Reload-, Kabel-/Messungs-, Import/Export- und Validierungsfälle.
- `.github/workflows/planner-v2-paket-c.yml` – unabhängiger Paket-C-Lauf auf dem Entwicklungsbranch mit Syntax-/Importgraph-Prüfung und vollständiger Paket-A/B/C-Browser-Suite.

## Verifikation / Status

- Lokale Syntaxprüfung: bestanden für alle geänderten JavaScript-Dateien.
- Browser-Suite: wird durch den separaten Workflow nach Veröffentlichung dieses Implementierungsstands ausgeführt.
- Geräteprüfung: für Paket C wird eine zusammenhängende Prüfung nach bestandenem CI und Test-Deploy durchgeführt. Keine zusätzlichen Paket-B-Wiederholungen sind eingeplant.
- Test-Deploy und Gate 3: noch offen.

`main` und dessen CI-/Deploy-Konfiguration wurden nicht geändert. Paket C ist mit grünem CI noch nicht als einsatzbereit oder integriert einzustufen.
