Ziel‑Dokument – Bereinigtes Projekt

Stand der Dinge (Mai 2026)

Im aktuellen Projekt haben sich zahlreiche experimentelle Versionen angesammelt.  Es existieren mehrere Varianten von Workarea‑Modulen (z. B. diverse Autosave‑Guards, Strukturbaum‑Editoren und Assembly‑Paneele), was die Wartung erschwert.  Die Persistenz‑Logik wird an vielen Stellen dupliziert oder umgangen; manuelles und automatisches Speichern greifen ineinander und erzeugen Instabilität.  Durch verschiedene Patches sind zuletzt auch die Vorschau‑Thumbnails in der Workarea und das Rotieren von GLB‑Modellen im AssetLab defekt.  Zusätzlich wird der Kabeltrassenbau bislang nur durch EPLAN‑Längen und eine Skizze unterstützt, die reale Verlegewege sind im Modell noch nicht verankert.

Zielsetzung

Wir möchten das Projekt zum Stichtag 22. Mai 2026 auf eine saubere, stabile Grundlage stellen.  Die neue Version 1.0.0 soll:

* eine konsolidierte Code‑Basis besitzen, in der pro Funktion nur noch eine „offizielle“ Version existiert,
* klare Regeln für Persistenz und Autosave definieren,
* den Strukturbaum‑Editor vereinheitlichen,
* die Import‑/Export‑Funktion und das GLB‑Handling reparieren (inkl. Rotation im AssetLab),
* die Kabeltrassen nach VASS‑Standard im Layout verorten und deren Längen im Modell ermitteln,
* und eine nachvollziehbare Dokumentation der Architektur und der offenen Aufgaben enthalten.

Maßnahmen im Einzelnen

1. Konsolidierung der Module

* Workarea: Für jede Funktion (Drag‑Guard, Autosave, Strukturbaum‑Detail‑Editor usw.) wird genau eine aktuelle Datei ausgewählt.  Ältere Varianten wandern in ein deprecated/‑Verzeichnis oder werden archiviert.  Ein neues Unterverzeichnis core/workarea/ enthält die stabilen Module; die alten Dateinamen können als Shims erhalten bleiben, sind aber als veraltet gekennzeichnet.
* AssetLab: Die Dateien assetlab-lite.js und assetlab-lite.css werden zur Basis erhoben.  Experimentelle Features wie CMO‑Preview verbleiben im Modulverzeichnis, werden aber nur geladen, wenn sie explizit aktiviert werden.
* Assembly‑Kataloge: Templates und Baugruppen werden in data/assembly-templates.v1.json und core/workarea-assembly-catalog.v1.js konsolidiert.  Varianten mit redundanten Ports oder BOM‑Definitionen werden bereinigt.

2. Einheitliche Persistenz und Autosave

* Zentrale Persistenz: core/persist/app-persist.js bleibt die einzige Stelle zum Laden und Speichern von Projekten.  Autosave‑Mechaniken greifen über diese API; parallele Buffer‑Writes im Workarea‑Panel oder AssetLab entfallen.
* Modus‑abhängiger Autosave: Im Select‑Modus ist Autosave deaktiviert.  Im Edit‑/Place‑Modus wird beim Ablegen oder Verschieben von Objekten automatisch gespeichert.  Im AssetLab erfolgt kein Autosave; der Benutzer muss bewusst speichern oder exportieren.
* Thumbnails: Beim Persistieren wird stets ein aktuelles Vorschau‑Bild erzeugt und im Slot gespeichert, damit Workarea und Listen aktuelle Vorschaubilder anzeigen.

3. Strukturbaum‑Editor vereinfachen

Der Strukturbaum erhält nur noch eine Implementierung (z. B. „safe‑memory‑save“).  Plus‑/Minus‑Logik und EPLAN‑Felder werden integriert; die Anzeige beschränkt sich auf den notwendigen Teilbaum.  Automatische Zooms auf das 3D‑Modell entfallen, der Baum klappt nur bis zum ausgewählten Element auf.

4. AssetLab: Rotation und Export

Aktuell wird beim Persistieren eines importierten GLB‑Modells nur der ursprüngliche Buffer gespeichert.  Änderungen an Position, Skalierung oder Rotation gehen verloren.  Ab Version 1.0.0 soll beim Speichern die aktuelle Transformation berücksichtigt werden:

* Beim Klick auf „Speichern“ wird das aktuell geladene Modell in eine neue GLB‑Datei exportiert (z. B. über GLTFExporter.parse) und dieser Buffer an den Host zur Persistenz übergeben.
* So wird die gedrehte Ausrichtung dauerhaft im Projektasset gespeichert.
* Bis zur Umsetzung kann man das Modell nach dem Drehen über „Export GLB“ herunterladen und anschließend als neues Asset importieren.

5. Kabelkanäle und Rinnen

Die neue Planung orientiert sich an den VASS‑V6‑Installationsrichtlinien:  Es wird eine Dreikammer‑Rinne eingesetzt (Bus/Feldbus/Sensor; 24 V DC + Potenzialausgleich; 230 / 400 V).  Der Kanal darf maximal zu 80 % belegt sein; Leiterschlaufen liegen außerhalb, schwere Motorleitungen unten.  Das verzinnte Leiterseil für den Potenzialausgleich wird in der 24‑V‑Kammer mitgeführt und an Sammelblöcken angeschlossen

.  Das Layout enthält:

* Neue Trassen (rot markiert) mit 200 mm Kanalbreite und kurze 100 mm‑Stücke zu den Bedienpulten;
* Bestehende Brücken (grün), als 200 mm (dick) bzw. 100 mm (dünn) gekennzeichnet;
* Eine Hallengröße von 120 m × 25 m als Maßstab für das 2D‑Layout.

Im Workarea‑Layout werden diese Rinnen in echtem Maßstab platziert; anschließend kann das System die Längen jeder Kanalbreite automatisch berechnen.

6. Dokumentation und Versionierung

* Dieses Ziel‑Dokument wird im Projekt unter docs/Ziel_Dokument.md abgelegt.  Es enthält alle Vorgaben und Schritte zur Bereinigung.
* Das neue Projekt erhält die Versionsnummer 1.0.0 und wird mit dem Datum 2026-05-22 versehen.
* Patches und Changelogs werden fortlaufend in docs/CHANGELOG.md gepflegt.

7. Weitere Aufgaben

* Thumbnail‑Bug fixen: Nach jüngsten Patches zeigen Workarea und AssetLab keine Thumbnails mehr.  Die Thumbnail‑Logik aus assetlab-lite.js muss korrigiert werden (Fallback auf Asset‑Thumbnail, wenn Slot‑Thumbnail fehlt).
* Messfunktion für Kabelwege: Ein Werkzeug in der Workarea soll die Länge gezeichneter Rinnen ermitteln und gruppieren (200 mm vs 100 mm).  Basis ist die Geometrie der Kanäle.
* EPLAN‑Integration: Die importierten EPLAN‑Stücklisten und Kabelschilder werden in eine Datenbank überführt und mit den Modell‑Ports verknüpft.  Die Kabellängen aus EPLAN dienen nur als grobe Basis; echte Längen werden anhand der im Modell gezeichneten Wege berechnet.

Nächste Schritte

1. Neues Projektverzeichnis anlegen: Kopiere die konsolidierten Module, Daten und diese Dokumentation in ein neues Verzeichnis (z. B. projects/P-2026-0002-clean).  Entferne veraltete Dateien.
2. Konfiguration bereinigen: Aktualisiere die projectSettings.*.json, sodass nur noch benötigte Plugins und Bibliotheken aktiviert sind.
3. Rotation‑Fix implementieren: Ergänze im AssetLab die Export‑Logik beim Persistieren und teste die gedrehten Modelle.
4. Kabeltrassen zeichnen und Längen messen: Importiere das Hallenlayout (120 × 25 m) in die Workarea, platziere die Rinnen gemäß VASS‑Standard und miss deren Längen.
5. Test und Freigabe: Prüfe das bereinigte Projekt auf Performance, Speicherverhalten und Benutzerführung.  Nach erfolgreichem Test kann Version 1.0.0 produktiv eingesetzt werden.

⸻

Diese Ziel‑Dokumentation bildet die Grundlage für die Bereinigung und den Neustart des Baustellenplaners.  Sie soll während der Umsetzung ergänzt und aktualisiert werden, um den Fortschritt transparent zu halten.
