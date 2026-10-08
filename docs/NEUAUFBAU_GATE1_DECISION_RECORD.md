# Neuaufbau – Gate 1 Entscheidungsprotokoll

Stand: 08.10.2026  
Status: **Gate 1 abgeschlossen für Architektur und V1-Zielumfang; Gate 2 nicht autorisiert**  
Autoritativer Ausgangsstand: main = be0061f6cca67c30adee8b476e8ea0265707ab18  
Neuaufbau-Branch: dev/planner-neuaufbau  
Branch-Prüfung: Basis exakt be0061f6cca67c30adee8b476e8ea0265707ab18; 29 Dokumentations-Commits voraus, 0 zurück; der Branch enthält gegenüber der Basis Dokumentation/Wireframes, keinen Produktcode.

Dieses Protokoll konkretisiert Architektur, Roadmap und Blueprint für den echten Greenfield-Neuaufbau. Der Produktcode auf main bleibt unverändert. Das ältere hochgeladene Ziel-Dokument mit Mai-2026-Annahmen ist keine aktuelle Produkt- oder Architekturautorität. Maßgeblich für diesen Gate-1-Check ist der oben festgehaltene Main-Stand.

## 1. V1-Ziel: ein echter Baustellenablauf

Der erste einsatzfähige Gesamtstand soll den vom Nutzer beschriebenen Kamera-Installationsablauf abbilden:

1. Projekt anlegen oder ein im neuen Planer gespeichertes Projekt öffnen.
2. Einen Grundriss als Hintergrund laden und den Maßstab anhand einer bekannten realen Strecke kalibrieren.
3. Die ganze Halle oder einen veränderbaren Hallenausschnitt als Baustellenbereich verwenden.
4. In einer maßstäblichen 2D-Topansicht Planobjekte platzieren und bearbeiten; Objektbaum, Auswahl und Eigenschaften zeigen denselben Zustand.
5. Die 19 handmarkierten Kamerapositionen des Beispielplans als einzeln identifizierbare Kameraobjekte erfassen; Kamera 7 ist nur die anfänglich ausgewählte Kamera.
6. Kamerarichtung, horizontalen Sichtwinkel und Reichweite im Grundriss prüfen.
7. Für eine tatsächlich vorgesehene Leitung Kabel-ID, Endpunkte/Netzwerkport und den im Grundriss erfassten Kabelweg dokumentieren. Physische Kabeltrassen erscheinen nur, wenn sie im Bestand bestätigt oder geplant und eingezeichnet wurden.
8. Verlegung und Kameramontage dokumentieren.
9. Messgerät, tatsächlich abgelesene Kabellänge, Prüfergebnis, Zeitpunkt und Notiz der Kabel-ID zuordnen.
10. Speichern, Projekt schließen/neu laden und alle Geometrie- und Prüfdaten vollständig wiederfinden.

Das Beispielbild enthält handmarkierte Kameras, aber keine bestätigten Kabeltrassen, Kabelwege, Netzwerkpunkte oder Maßstabsangabe. Diese Angaben bleiben im Ausgangsprojekt offen. Eine nicht kalibrierte Zeichnung darf keine belastbaren Weglängen vortäuschen. Eine fehlende Trasse wird nicht durch eine Beispielskizze ersetzt.

## 2. Gemeinsame Basis und Fachmodule

### V1-Kern

- Projekte anlegen, öffnen, umbenennen und geordnet ablegen;
- Hallenbezug optional führen; eine vollständige 3D-Halle ist keine Voraussetzung;
- eine ganze Halle oder einen Hallenausschnitt als Planungsbereich festlegen und später ändern;
- Grundrissbild laden und maßstäblich kalibrieren;
- 2D-Planansicht, Zoom/Pan, Auswahl, Platzieren, Verschieben, Drehen und Messen;
- stabile Objektidentitäten, Objektbaum, Eigenschaften, Höhenebenen und Sicht-/Fachlayer;
- Speichern, sichtbarer Speicherzustand, Wiederherstellung nach Reload sowie Projektdatei-Export/-Import.

### V1-Fachpakete für den Beispiel-Einsatz

- **Elektrik:** tatsächliche Trassen-/Kabelweg-Geometrie, Kabel-ID, Start-/Zielpunkt bzw. Port, geplante Länge nur bei kalibriertem Plan, Verlegezustand sowie manuell aus dem Messgerät übernommene Ist-Länge und Prüfergebnis.
- **Kamera:** Kamera-ID, Position, Drehung, horizontaler FOV, Reichweite, Montagehöhe/-ort und Sichtlayer. Das Modul verwendet elektrische Kabel-/Messdatensätze über eine stabile Referenz; es führt keine zweite Kabel- oder Messwertquelle.

Elektrik und Kamera müssen als getrennt freischaltbare Fachmodule funktionieren. Das Kamerabeispiel benötigt beide. Das Mechanikmodul bleibt ein eigenständiges, späteres Fachpaket und darf keine Elektrikabhängigkeit erhalten. Vollständige Material-/Bestelllisten, EPLAN-Import, AssetLab/GLB-Bearbeitung, detaillierter 3D-Hallengenerator und kaufmännische Lizenzverwaltung gehören nicht zum ersten einsatzfähigen Gesamtstand. Ihre Domänengrenzen werden vorbereitet, die Funktionen aber nicht vorgezogen. Die räumlichen Koordinaten sind von Anfang an 3D-fähig; eine 3D-Ansicht ist eine spätere Ansicht desselben Projekts.

Die Entitlement-Matrix trennt technische Modulverfügbarkeit, Kundenfreischaltung, Benutzerrolle/Berechtigung und lokale Sichtbarkeit. V1 benötigt den Modulvertrag und testbare Freischaltzustände, aber weder Kaufabwicklung noch Lizenzserver.

## 3. Räumlicher und Maßstabsvertrag

- Projektrahmen: ein Ursprung und ein gemeinsames rechtshändiges Koordinatensystem; in der 2D-Ansicht zeigt X nach rechts und Y nach oben, Z ist die Höhe. Winkel werden in Grad geführt.
- Persistierte Geometrie: Millimeter als einheitliche Basiseinheit; Eingabe und Beschriftung dürfen Meter anzeigen und werden an der UI-Grenze eindeutig umgerechnet.
- Referenzplan: Bildlage und Maßstab werden mit zwei Punkten und einer bekannten realen Entfernung festgelegt. Bis zur Kalibrierung zeigt die Anwendung „nicht maßstäblich“; daraus werden keine Längen oder Materialmengen berechnet.
- Hallenbezug: eine Halle kann einfache Referenzabmessungen/Geometrie besitzen. Der Baustellenbereich ist separat und kann die ganze Halle oder einen Ausschnitt umfassen.
- Bereichsgrenzen definieren in V1 den rechteckigen Arbeits-/Ansichtsrahmen, nicht automatisch eine harte Clipping-Grenze für Objekte. Eine Ausschnittsverschiebung oder -größe darf vorhandene Planobjekte nicht still verschieben. Freie Polygongrenzen und komplexe Hallengeometrie bleiben Erweiterungen.
- Ein Objekt hat Position X/Y/Z, Ausrichtung und stabile ID. Die aktive Höhenebene setzt die Höhe für neue Platzierungen; vorhandene Objekte behalten ihre Höhe, bis sie ausdrücklich geändert wird.
- Höhenebenen beschreiben reale Z-Bezüge. Sicht-/Fachlayer gruppieren und zeigen Objekte. Die beiden Konzepte werden getrennt gespeichert.
- Routenlängen sind abgeleitete Werte aus kalibrierter Geometrie. Eine Feldmessung ist ein eigener dokumentierter Messwert und ersetzt oder überschreibt die geplante Länge nicht.

## 4. Speichern und Projektdatei

- Eine versionierte Projektdatei ist die fachliche Datenquelle für Projekt, Planungsbereich, räumliche Objekte und modulbezogene Datensätze.
- Ein freigegebener Repository-/Persistenzadapter ist die einzige Schreibgrenze. Viewport, Panels und Fachmodule halten keine konkurrierenden dauerhaften Kopien.
- V1 ist lokal nutzbar und unterstützt explizites Projektdatei-Exportieren und -Importieren als Sicherung/Übertragung. Automatische Cloud-Synchronisierung und Konfliktauflösung zwischen Geräten sind nicht Teil des V1-Vertrags.
- Abgeschlossene Bearbeitungsaktionen werden zuverlässig gesichert; ein expliziter Speichern-Befehl bleibt erreichbar. Ein Fehler lässt den Status sichtbar ungespeichert und darf nicht als Erfolg erscheinen.
- Fachdatensätze eines deaktivierten Moduls werden erhalten und beim erneuten Aktivieren wieder verfügbar.
- Jeder Paketabschluss umfasst Roundtrip-Prüfungen: speichern → neu laden → Geometrie, Ebenen, Kabelreferenzen und Messwerte vergleichen.
- Das genaue Browser-Speicherbackend (z. B. IndexedDB) wird erst im Paket-A-Implementierungsscope anhand von Safari/iOS-Verhalten und Größenbedarf festgelegt. Es ändert nicht den Projektdatei-Vertrag.

## 5. Main-Bestand: erhalten, übertragen oder neu schreiben

Greenfield bedeutet: kein bestehendes Main-Modul wird ungeprüft kopiert oder zur neuen Laufzeitautorität gemacht. Die folgenden fachlichen Regeln und Inventarwerte sind der Lesestand gegen den oben genannten exakten Main-Commit.

| Bestand | Gate-1-Einstufung | Neue Verwendung |
|---|---|---|
| Projekt/Hallenbezug und Halle ändern | **PORT als fachliche Anforderung** | Halle bleibt optionaler Referenzrahmen; Planungsbereich ist eine getrennte, veränderbare Fläche. Bestehende UI-/V1/V2-Migrationspfade werden nicht übernommen. |
| Praktische 2D-Kabeltrasse | **PORT nach Contract-Test** | Polyline-Punkte, Breite/Typ/Ausführungsklasse und geometrisch abgeleitete Länge sind fachlich brauchbar. Im neuen Modell bekommt die Route einen neuen versionierten Vertrag; kein automatischer Altprojekt-Import. |
| Kabel-zu-Routen-Zuordnung und Diagnose | **REVIEW/PORT in Elektrik** | Bestehende Referenzen, Richtungen, Reserven und abgeleitete Planwerte einzeln auf den konkreten Kamera-/Elektroablauf prüfen; keine stillschweigende Übernahme des gesamten CableLine-Modells. |
| Verifizierte Materialidentitäten | **PORT als Stammdaten, falls Materialpaket freigegeben** | Verifizierte Artikel und Herkunft dürfen übernommen werden; unaufgelöste Zuordnungen bleiben unaufgelöst. Herstellerwerte werden nicht geraten. |
| Asset-/GLB-Daten | **REVIEW als Nutzdaten** | Nur tatsächlich benötigte Assets neu registrieren/importieren. IDs, Lizenz und Quelle prüfen; keine doppelten AssetLab-Dateien als neue Laufzeitbasis. |
| Workarea-Objektplatzierung und Save→Reload-Verhalten | **PORT als Akzeptanztests** | Geprüfte Nutzerabläufe sind Anforderungen; die große Workarea-Implementierung wird neu gebaut. |
| WorkareaPanel.base.js (ca. 9.600 Zeilen) | **REWRITE** | Keine Übernahme als Zielmodul. Domänen werden registrierte, testbare Fachmodule. |
| AssetLab-/GLB-Sammeldateien, Host/Iframe und alte Hall3D-Kopplungen | **REWRITE/REVIEW** | Modell-I/O vereinheitlichen; Editor, Vorschau, Persistenz und Geometrie getrennt verantworten. Iframe-Entscheid anhand von iOS, Speicher und Fehlerisolation später testen. |
| Alte Projektdateien, SaveGames und Main-Speicherpfade | **NO MIGRATION in V1** | Neues Format ohne Abwärtskompatibilitätsversprechen. Ein späterer Importer braucht ein eigenes Paket und echte Beispieldateien. |

Konkrete Main-Verträge, die nur als Lesereferenz dienen: Hallenautorität unter app.project.hall; Planobjekte in der Workarea-Szene; Kabeltrasse type = "cable-tray.route" mit points[], tray.widthMm, tray.trayType und tray.dutyClass; Trassenlänge als Geometrieableitung; Materialzuordnung über bestehende Materialidentitäten. Diese Pfade werden **nicht** als vorgeschriebenes V1-Speicherschema übernommen. Das neue Datenformat bekommt eigene Typen und Validierung.

Der Main-Stand enthält außerdem historische Status-/Freeze-Dokumente mit nicht mehr aktuellen Baseline-Referenzen. Sie gelten nicht als Ersatz für die Prüfung des tatsächlichen Main-Heads. Der Neustart basiert exakt auf be0061f6...; alte Branches oder Saves werden nicht als Quelle für den Neuaufbau verwendet.

## 6. Aufbaufolge mit eigener Abnahme pro Paket

1. **Paket A – Projektvertrag und Persistenz:** versioniertes neues Projekt, räumlicher Bezug, Einheiten/Koordinaten, Import/Kalibrierung des Hintergrundplans, Save-/Fehler-/Exportverhalten. Abnahme mit leerem, teilweise gefülltem und ungültigem Projekt.
2. **Paket B – 2D-Workarea:** neue Shell, Planansicht, Werkzeug-/Objektbaum-/Eigenschaftsgrenzen, Ebenen/Layer, generische Objekte. Abnahme: platzieren, verschieben, drehen, speichern, neu laden, Anzeige und Objektbaum vergleichen.
3. **Paket C – Elektrik:** Kabel-/Trassenobjekte und Endpunktbezug, geplante Route nur auf kalibriertem Plan, Kabel-ID, Status Verlegung/Anschluss und Messdatensatz. Abnahme mit fehlender, vollständiger und ungültiger Route.
4. **Paket D – Kamera:** die 19 Beispielpositionen als unabhängige Objekte, Auswahl/Kamera-7-Zustand, Drehung/FOV/Reichweite, Montageangaben, Verknüpfung mit Kabel-ID und Messnachweis. Keine erfundenen Trassen. Abnahme mit Save→Reload.
5. **Paket E – Geräte-Praxistest:** vollständiger Kamera-Installationsablauf auf iPad quer und iPhone hochkant; iPad hochkant ergänzend. Erst nach bestandenem Test dürfen weitere Fachmodule priorisiert werden.
6. **Spätere Pakete:** Mechanik als unabhängiges Fachmodul; danach je nach realem Bedarf Materialausgabe, gemeinsame GLB-Pipeline/AssetLab und zusätzliche 3D-Ansichten. Module haben eigene Gates und Tests.

Jedes Paket wird separat gegen den dann exakten Branch-Head freigegeben, implementiert, verifiziert und eingefroren. Dieses Protokoll autorisiert keine Gate-2-Codearbeit und keine Main-Integration.

## 7. Praxistauglichkeits- und Blockerregeln

**Reale Abnahmegeräte:** iPad quer für das breite Layout, iPhone hochkant für das mobile Layout; iPad hochkant als Zusatzprüfung. Es gibt keinen verfügbaren Rechner und keinen vorausgesetzten physischen Desktop-Test. Automatisierte Browser-/Viewport-Tests ergänzen, ersetzen aber nicht diese Geräteprüfungen.

Ein Einsatz ist blockiert, wenn eines davon auftritt:

- Projekt/Planobjekt/Trasse/Kamera/Messwert geht bei Speichern oder Reload verloren;
- Viewer/2D-Plan, Objektbaum und Eigenschaften widersprechen sich;
- falscher Maßstab, falsche Position oder falsche Höhe wird angezeigt oder gemessen;
- unkalibrierte Längen werden als belastbar ausgegeben;
- fehlende Trassen/Netzwerkpunkte werden erfunden oder als Bestand gezeigt;
- Nutzer kann zentrale Aktion auf iPad quer oder iPhone hochkant nicht ausführen;
- Projektdatei wird teilweise geladen/gespeichert, ohne Fehler und ungespeicherten Zustand sichtbar zu machen;
- deaktiviertes Fachmodul löscht, verändert oder versteckt dauerhaft seine Projektdaten.

## 8. Gate-1-Ergebnis und nächster Freigabepunkt

Gate 1 ist für V1-Ziel, Modulgrenzen, Raum-/Maßstabsregeln, Speichervertrag, Main-Wiederverwendungsklassifizierung und Geräteabnahme **dokumentarisch abgeschlossen**. Unbekannte Baustellendaten des Beispielplans (bekanntes Referenzmaß, Netzwerkpunkte und tatsächliche Trassen) sind Eingabedaten für die spätere Testfixture, keine Erlaubnis, sie zu erfinden.

**Gate 2 bleibt gesperrt, bis der erste Paket-Scope separat freigegeben ist.** Der erste freizugebende Scope ist Paket A; danach folgen Paket B, Elektrik, Kamera. main wird erst nach vollständigem Praxistest, Freeze und separater Integrationsfreigabe geändert.
