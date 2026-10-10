# Neuaufbau Paket C – Kabel- und Trassenplanung

Stand: 10.10.2026  
Branch: `dev/planner-neuaufbau`  
Paket-B-Praxisergebnis dokumentiert in Commit: `9044b7d5d54c0f99acf8b1efba98b3b0ad76a3be`  
Produktcode-Basis: `a974918135642ad2a0650bd00d61ce1add07f4f1`  
`main`: `be0061f6cca67c30adee8b476e8ea0265707ab18` (unverändert)  
Status: Gate 1 – Scope- und Datenvertragsvorschlag; keine Implementation.

## Ziel

Das Elektromodul ergänzt die bestehende 2D-Workarea um praktisch planbare Kabelwege und Trassen. Ein Projekt soll den geplanten baulichen Trassenverlauf, einzelne Kabelverbindungen und später tatsächlich gemessene Kabeldaten getrennt und nachvollziehbar speichern.

Das Modul nutzt dieselbe Workarea, den gemeinsamen Objektbaum, die Eigenschaften, die Ebenen sowie den vorhandenen Projekt-Speicher. Es führt weder einen zweiten Plan-Editor noch einen separaten Szenenspeicher ein.

## Fachliche Trennung

### Trasse

Eine Trasse beschreibt einen physischen Kabelweg, zum Beispiel eine Kabelrinne. Sie besteht aus einer bearbeitbaren 2D-Polyline mit mindestens Start- und Endpunkt und gegebenenfalls Zwischenpunkten. Die Punkte liegen im gemeinsamen Projektkoordinatensystem in Millimetern.

Vorgesehene Eigenschaften:

- stabile Trassen-ID und Bezeichnung;
- Trassenart als generische Projektangabe, ohne Herstellerbindung;
- editierbare Breite in Millimetern;
- Zuordnung zur gemeinsamen Höhenebene;
- Verlauf als geordnete Punktliste;
- geplante Länge als abgeleiteter Wert aus der maßstäblichen Geometrie.

Unkalibrierte Pläne dürfen keine verlässliche Länge vortäuschen. Die Trasse selbst wird nicht aus dem Hallenplan oder den Beispiel-Kameramarkierungen abgeleitet; der Nutzer zeichnet den tatsächlich vorgesehenen Verlauf ein.

### Kabelverbindung

Ein Kabel ist eine einzelne elektrische beziehungsweise Netzwerkverbindung. Es erhält eine stabile Kabel-ID und verbindet zwei benannte Endpunkte. Endpunkte können ein Gerät, ein Anschluss oder ein Port sein. Ein Kabel kann einer oder mehreren Trassen zugeordnet sein.

Vorgesehene Angaben:

- Kabel-ID und Bezeichnung;
- Quell- und Zielendpunkt mit Anschluss-/Portbezeichnung;
- zugeordnete Trassen;
- Status des Arbeitsablaufs;
- geplante Route beziehungsweise geplante Länge, getrennt von der vor Ort gemessenen Länge.

Die Verbindung zu konkreten Kameraobjekten wird durch Paket D ergänzt. Paket C darf generische Endpunkte speichern, ohne Kameratypen oder Kamerafunktionen vorwegzunehmen.

### Tatsächliche Messung

Eine Messung dokumentiert einen tatsächlich mit dem Netzwerktester ermittelten Zustand. Sie überschreibt weder die geplante Trassenlänge noch stillschweigend die geplante Kabellänge.

Vorgesehene Messfelder:

- Messgerät/Typ als freie Angabe;
- gemessene Kabellänge;
- Ergebnis;
- Messzeitpunkt;
- Notiz.

Mehrere Messungen eines Kabels müssen nachvollziehbar bleiben; ein späteres Messergebnis darf ein früheres nicht unbemerkt löschen.

## Datenvertrag

Das bestehende Projektformat `baustellenplaner.rebuild.project`, Version 1, Millimeter und Koordinatensystem `x-right-y-up-z-up` bleiben erhalten. Paket C ergänzt einen intern versionierten Bereich unter `modules.electrical`. Darin liegen Trassen, Kabelverbindungen und Messungen mit stabilen IDs und eindeutigen Referenzen.

Die Umsetzung muss:

- alte Paket-A/B-Projekte ohne `modules.electrical` weiterhin öffnen;
- unbekannte Modulbereiche beim Speichern und Dateiübertragen erhalten;
- den elektrischen Modulbereich strukturiert validieren;
- Projektdatei-Export und -Import sowie lokales Save/Reload für alle Elektrodatensätze unterstützen;
- die Projektformatversion nur dann erhöhen, wenn eine additive, rückwärtskompatible Modulerweiterung nicht ausreicht.

## Gemeinsame Bedienung

- Trassen über die vorhandene Workarea zeichnen und Zwischenpunkte auf Touch-Geräten präzise bearbeiten;
- Trassen/Kabel in Objektbaum und Workarea synchron auswählen;
- Eigenschaften bearbeiten, Verlauf beziehungsweise Endpunkte ergänzen und Objekte löschen;
- Layer/Höhe und Sichtbarkeit aus der gemeinsamen Workarea übernehmen;
- Undo/Redo für Zeichnen, Verschieben, Punktbearbeitung und Löschen;
- Länge nachvollziehbar aus kalibrierter Geometrie ableiten;
- mehrere Trassen müssen gleichzeitig sichtbar bleiben und nach Save/Reload an ihrer gespeicherten Position erscheinen.

Es gibt keine erfundenen Bestandswege, automatische Leitungsführung, Herstellerbibliothek, Cloud-Synchronisierung oder 3D-Kollisionsprüfung in diesem Paket.

## Diagnostik

Das Modul meldet mindestens:

- nicht kalibrierte Geometrie, wenn eine verlässliche Länge verlangt wird;
- fehlende oder nicht erreichbare Kabelendpunkte;
- Kabel ohne zugeordneten Trassenverlauf, wenn eine solche Zuordnung für den Status erforderlich ist;
- ungültige oder doppelte IDs sowie defekte Trassen-/Kabelreferenzen;
- unvollständige oder ungültige Messdatensätze.

Geplante geometrische Länge und tatsächliche Messlänge werden in Anzeige und Export klar unterschieden.

## Paketgrenze und Reihenfolge

Paket C umfasst als zusammenhängende Elektrogrundlage:

1. Trassen-Polyline mit Breite, Ebene/Höhe, Auswahl, Bearbeitung und abgeleiteter Länge;
2. Kabel-ID, Endpunkte/Ports, Trassenzuordnung und Arbeitsstatus;
3. Messdatensätze mit realen Testergebnissen;
4. Diagnostik, gemeinsame Undo/Redo-Bedienung, lokales Save/Reload und Projektdatei-Übertragung.

Kameraobjekte, FOV, Montageangaben und die direkte Zuordnung einer Kamera zu einem Kabel gehören zu Paket D. Die Datenstruktur in Paket C muss diese spätere Referenz über stabile IDs ermöglichen.

## Verifikation für eine spätere Umsetzung

Automatisierte Prüfungen müssen mindestens abdecken:

- eine Trasse mit mehreren Segmenten zeichnen, auswählen, editieren, verschieben und löschen;
- ihre abgeleitete Länge anhand kalibrierter Koordinaten prüfen;
- mehrere Trassen gleichzeitig darstellen;
- Kabel-ID, Endpunkte, Portnamen, Status und Trassenreferenzen anlegen und validieren;
- geplante und gemessene Längen getrennt speichern;
- Messungen samt Gerät, Ergebnis, Zeit und Notiz erhalten;
- Undo/Redo, Save/Reload sowie Projektdatei-Export/-Import;
- Fehlerzustände für fehlende Kalibrierung, Endpunkte, Referenzen oder Messfelder;
- bestehende Paket-A/B-Projekte ohne Elektrobereich weiterhin öffnen.

Die manuelle Paket-B-Abnahme auf iPhone hochkant und iPad quer ist bereits in `NEUAUFBAU_PAKET_B_SCOPE_AND_STATUS.md` dokumentiert. Paket C braucht keine erneute Wiederholung dieser Paket-B-Prüfung. Für die neue Zeichenfunktion ist später eine zusammenhängende Prüfung des fertigen Pakets vorgesehen; zusätzliche einzelne Zwischen-Deploys sind nicht Teil dieses Scopes.

## Nächster Gate-Schritt

Gate 1 hält den vorgeschlagenen Umfang, Datenvertrag und die Abgrenzung fest. Eine Implementation auf `dev/planner-neuaufbau` beginnt erst nach separater Freigabe für Gate 2. `main` bleibt bis zu einer späteren, ausdrücklich freigegebenen Integration unverändert.
