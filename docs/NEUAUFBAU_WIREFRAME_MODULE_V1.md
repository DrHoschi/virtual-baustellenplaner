# Neuaufbau – Modulweiter Wireframe V1

Stand: 07.10.2026  
Zielbranch: `dev/planner-neuaufbau`  
Status: vollständiger Menü-/Bereichsentwurf; die V1-Entscheidungen stehen in NEUAUFBAU_GATE1_DECISION_RECORD.md. Noch keine Produktcode-Implementation.

## Warum modulweise

Der Wireframe V0 zeigte nur den Projekteinstieg, die Bereichswahl und einen Ausschnitt der Workarea. Das reicht nicht für die vollständige Planung. Dieser Wireframe V1 zeichnet jetzt die gemeinsame Anwendungshülle und jeden vorgesehenen Modulbereich durch. Die SVG-Bildtafeln zeigen je Modul eine repräsentative Hauptansicht; die Menüs und Arbeitsabläufe stehen vollständig in diesem Dokument.

Der Entwurf unterscheidet zwischen:
- **Basis:** muss für den Einstieg und die allgemeine 2D-Planung funktionieren.
- **Fachpaket:** eigener Arbeitsbereich, hängt am gemeinsamen Projekt und kann separat freigeschaltet werden.
- **Erweiterung:** sichtbar als spätere Möglichkeit, wird nur bei bestätigtem Bedarf umgesetzt.
- **Verwaltung:** Paket-/Benutzerrechte sind eine eigene administrative Ebene, nicht ein zusätzlicher Workarea-Modus.

Die Liste erfindet keine verbindliche Lizenz-/Verkaufsstruktur. Ein sichtbarer Bereich im Wireframe bedeutet nicht automatisch, dass jedes Modul zum ersten Release gehören muss.

## Gemeinsame Navigation

### Globale Hauptebene

1. **Projekte**
   - Projektliste / zuletzt verwendet
   - Projekt suchen und öffnen
   - Neues Projekt
   - Projekt umbenennen, duplizieren oder archivieren (Status: Entscheidung für V1)
2. **Planung**
   - aktuelles Projekt und Baustellenbereich öffnen
   - Workarea-Ansicht: 2D zuerst; spätere Ansichten über denselben Ansichtsumschalter
3. **Module**
   - verfügbare Fachmodule anzeigen
   - Modul öffnen/wechseln
   - nicht freigeschaltete Bereiche klar kennzeichnen, ohne sie als aktiv nutzbar auszugeben
4. **Ausgaben**
   - Material-/Mengenübersicht
   - modulbezogene Berichte/Exporte
5. **Projekt-Einstellungen**
   - Projektangaben
   - Halle/Referenz und Baustellenbereich
   - Ebenen und Layer
   - Projektdatei-/Speicherstatus
6. **Konto/Arbeitsplatz** (spätere Produkt-/Betriebsentscheidung)
   - Benutzerrolle und verfügbare Module anzeigen
   - keine Kaufabwicklung im Planer-Wireframe festlegen

### Gemeinsame Workarea-Hülle

| Position | Inhalt | Verhalten |
|---|---|---|
| Kopfzeile | Projekt, Baustellenbereich, Zurückweg, Speicherstatus | bleibt in jeder Workarea-Ansicht erkennbar |
| Modulleiste | Kernwerkzeuge und freigeschaltete Fachmodule | Module wechseln ohne zweite Workarea |
| Werkzeugleiste | Auswahl, Platzieren, Zeichnen, Messen; modulabhängige Werkzeuge | nur passende Werkzeuge für aktives Modul anbieten |
| Ansichtssteuerung | 2D-Topansicht zuerst; spätere 3D/Ansicht/Schnitt | Ansicht wechselt, nicht Projektdatenmodell |
| Höhensteuerung | aktive räumliche Ebene | bestimmt Höhe neuer/gezielt bearbeiteter Objekte |
| Sicht-/Fachlayer | Sichtbarkeit fachlicher Gruppen | getrennt von Höhenebene |
| Objektbaum | Projektobjekte suchen und selektieren | Auswahl synchronisiert sich mit Plan/Viewer |
| Eigenschaften | Daten des aktuellen Auswahlobjekts | keine parallele Objektkopie |
| Kontext-/Modulbereich | Katalog, Prüfer, Ausgabe oder Modulaktionen | im Breitlayout Seitenpaneel, hochkant Sheet/Seitenansicht |

## Layoutklassen

| Geräteklasse | Anordnung |
|---|---|
| Breites Layout (Desktop-Zielklasse; reales Abnahmegerät: iPad quer) | gemeinsame Kopfzeile, Modul-/Werkzeugleiste, großer Planbereich, aufrufbare Objekt-/Eigenschaftsseitenpanels |
| Hochkantlayout (iPhone-Abnahme; iPad hochkant als Pflichtprüfung des Hochkantlayouts) | Einspaltennavigation, großer Plan, kompakte feste Status-/Ebenenleiste, Werkzeuge und Objektinformationen als erreichbare Sheets |
| iPhone quer | nicht zugesichert im ersten Wireframe |

Menüstruktur, Daten und Aktionen bleiben gleich. Hochkant ist keine verkleinerte breite Sidebar. Es gibt keinen Rechner als Testgerät: Das iPad quer ist der vereinbarte Praxistest für das breite Desktop-Ziellayout; das iPhone hochkant prüft das mobile Kernlayout. Das iPad hochkant prüft dasselbe Hochkantlayout wie das iPhone.

## Modulmenüs und Arbeitsabläufe

### A. Projekt und Baustellenbereich — Basis

**Menü:** Projekte · Neues Projekt · Projektangaben · Hallenbezug · Baustellenbereich · Projekt-Einstellungen.

**Hauptansichten:**
- Projektübersicht mit Suche, zuletzt verwendeten Projekten und „Neues Projekt“;
- Neues Projekt mit nur notwendigen Angaben;
- Hallenbezug optional festlegen;
- Bereichstyp wählen: ganze Halle oder Hallenausschnitt;
- Grundfläche/Begrenzung maßstäblich festlegen, später ändern;
- Projekt-Einstellungen mit Ebenen, Layern und Speichern.

**Ablauf:** Projekt anlegen → Halle optional referenzieren → ganze Fläche/Ausschnitt festlegen → 2D-Plan öffnen.

**Wichtig:** Hallenmodell ist keine Pflicht. Bereich und Halle sind getrennte, änderbare Konzepte.

[Bildtafel](wireframes/module-projekt-bereich.svg)

### B. Workarea / gemeinsame Planung — Basis

**Menü:** Auswahl · Platzieren · Zeichnen · Messen · Objektbaum · Höhenebene · Sicht-/Fachlayer · Eigenschaften.

**Hauptansichten:**
- maßstäbliche 2D-Topansicht;
- Objekt auswählen/verschieben/rotieren;
- generisches Objekt platzieren;
- zeichnerische Geometrie und Messung;
- Objektbaum und synchronisierte Selektion;
- Höhenebene auswählen/verwalten;
- Sicht-/Fachlayer sichtbar/unsichtbar schalten;
- Eigenschaften des ausgewählten Objekts bearbeiten.

**Ablauf:** Werkzeug wählen → platzieren/bearbeiten → Höhe und Layer prüfen → speichern → neu öffnen und denselben Zustand sehen.

**Grenze:** Die Basis-Workarea enthält keine Mechanik-, Elektrik- oder AssetLab-spezifische Fachlogik.

[Bildtafel](wireframes/module-workarea.svg)

### C. Mechanik — Fachpaket

**Menü:** Überblick · Objektkatalog · Baugruppen · Platzieren · Komponenten/Anschlüsse · Eigenschaften · Mechanik-Ausgabe.

**Hauptansichten:**
- mechanischen Katalog filtern und Objekt/Asset auswählen;
- Baugruppe auswählen und im Plan platzieren;
- Komponenten im Objektbaum selektieren;
- mechanische Anschlüsse/Ports prüfen und bearbeiten, sofern für den gewählten Typ relevant;
- Maße und mechanische Eigenschaften bearbeiten;
- mechanische Ausgabe/Materialbedarf ansehen.

**Ablauf:** Katalog → Objekt/Baugruppe → Vorschau/Platzierung in der gemeinsamen Workarea → Eigenschaften/Ports → speichern → Ausgabe.

**Grenze:** Mechanik braucht keine Elektrikwerkzeuge. Ein gemeinsamer Kataloghost ist möglich, fachliche Daten bleiben Mechanik-owned.

[Bildtafel](wireframes/module-mechanik.svg)

### D. Elektrik — Fachpaket

**Menü:** Überblick · Kabelwege/Trassen · Kabel · Routen/Zuordnung · EPLAN-Bezug · Prüfungen · Elektrik-Ausgabe.

**Hauptansichten:**
- Trasse oder Kabelweg maßstäblich zeichnen/bearbeiten;
- Typ/Breite und erforderliche Parameter einstellen;
- Endpunkte und Routenbezug verbinden;
- Kabelquelle, Ziel und Weglängen nachvollziehen;
- EPLAN-Daten zuordnen, falls im Release-Scope;
- Prüf-/Diagnoseansicht für offene, widersprüchliche oder unvollständige Zuordnungen;
- Längen/Mengen/Ausgabe nach nachvollziehbarer Herkunft.

**Ablauf:** Trasse/Kabelweg zeichnen → Kabel-ID und Endpunkte zuordnen → Diagnose prüfen → vor Ort verlegen und anschließen → Ist-Länge/Prüfergebnis mit Messgerät erfassen → speichern/reloaden und gegen den Plan kontrollieren.

**Grenze:** EPLAN-Import ist optional und darf die manuelle Kernplanung nicht blockieren. Der Elektrikbereich ist ein Modul in derselben Workarea, keine zweite Szene.

[Bildtafel](wireframes/module-elektrik.svg)

### E. Kamera/Sicherheit — Fachpaket/Erweiterung

**Menü:** Überblick · Kamera platzieren · Kabelweg · Montage · Messprotokoll · Sichtabdeckung · Ausgabe.

**Hauptansichten:**
- markierte Kamera aus dem Plan wählen und Position bei Bedarf verschieben;
- Blickrichtung um die Hochachse drehen sowie Planwinkel/FOV kontrollieren;
- Netzwerkverteiler/Port und Kabel-ID zuordnen;
- maßstäblichen Kabelweg in der gemeinsamen Workarea zeichnen;
- Verlegung und Anschlusspunkte vor Ort dokumentieren;
- Montageort, Höhe, Halterung und Ausrichtung protokollieren;
- nach dem Einziehen ein Messgerät auswählen und tatsächliche Kabellänge sowie Prüfergebnis zur Kabel-ID speichern;
- Kameralayer getrennt von Höhenebene ein-/ausblenden.

**Ablauf:** Kamera wählen → Winkel/Sichtbereich prüfen → Netzwerkpunkt und Kabel-ID zuordnen → Route zeichnen → Kabel verlegen und anschließen → Kamera montieren/ausrichten → Leitung messen → Ergebnis speichern.

**Prüfdatensatz:** Kamera-ID, Kabel-ID, Start-/Zielpunkt bzw. Port, Messgerät/Inventarnummer, tatsächlich gemessene Länge, Prüfergebnis, Zeitstempel und Notiz. Messwerte werden nicht aus der Planroute abgeleitet.

**Grenze:** Der Plan zeigt keine verlässliche Maßstabs- oder Kabelweginformation. Diese muss im neuen Projekt kalibriert/gezeichnet bzw. vor Ort erfasst werden. Zusätzliche 3D-Kameraeffekte oder Sicherheitsanalysen kommen nur mit bestätigtem Fachbedarf hinzu.

[Bildtafel](wireframes/module-kamera.svg)

### F. Material und Auswertung — gemeinsame Ausgabe/Fachmodul

**Menü:** Zusammenfassung · Nach Modul · Materialgruppen · Mengen/Einheiten · Prüfhinweise · Export.

**Hauptansichten:**
- projektweite Material-/Mengenübersicht;
- Filter nach Mechanik/Elektrik/Kamera;
- neutrale Materialbeschreibung und technische Größe;
- Herkunftslink zum Planobjekt;
- fehlende oder nicht bestätigte Eigenschaften markieren;
- Ausgabe exportieren, wenn Exportformat festgelegt ist.

**Ablauf:** Ausgabe öffnen → Fachbereich/Gruppe filtern → Position bis zum Planobjekt zurückverfolgen → prüfen → Export.

**Grenze:** Keine erfundenen Hersteller-/Artikelnummern. Für die Planung reicht zunächst eine eindeutige generische technische Beschreibung; Herstellerzuordnung ist eine spätere Materialentscheidung.

[Bildtafel](wireframes/module-material.svg)

### G. AssetLab und Modellverwaltung — Werkzeugbereich

**Menü:** Projektassets · Modell importieren · Modell prüfen/vorschauen · Transformation · Materialien/Texturen · Geometrie/CMO (falls freigegeben) · Speichern/Export.

**Hauptansichten:**
- Projektasset auswählen und Modellstatus sehen;
- GLB/GLTF laden und Fehler/Decoderstatus anzeigen;
- großes Modellviewport mit dauerhaft erreichbaren Hauptaktionen;
- Modellstruktur/Komponenten untersuchen;
- Position/Rotation/Skalierung prüfen und gezielt bearbeiten;
- Textur-/Materialzuordnung kontrollieren;
- Änderungen bewusst speichern/exportieren;
- Asset anschließend aus dem Mechanik-/Projektkatalog platzieren.

**Ablauf:** Asset wählen/importieren → Vorschau prüfen → optional transformieren/bearbeiten → explizit speichern/exportieren → zurück zur Platzierung.

**Grenze:** AssetLab ist kein eigener Projekt- oder Szenenspeicher. Gemeinsame Modell-I/O, Asset-Identität und Persistenzvertrag; Editoroberfläche, CMO/Geometrie und Host-Kommunikation bleiben intern getrennte Verantwortungen.

[Bildtafel](wireframes/module-assetlab.svg)

### H. Gemeinsame räumliche Ansichten — Ansichtsmodus

**Menü:** 2D Top · 3D · Front/Seite · Schnitt (spätere Ansichten nach Bedarf).

**Hauptansichten:**
- 2D Top ist der erste produktive Ansichtsmodus;
- 3D zeigt denselben Baustellenbereich, dieselben Objekte und gespeicherten Höhen;
- Front/Seite/Schnitt werden nur für tatsächliche Arbeitsfälle ergänzt;
- Auswahl und Objektbaum bleiben über Ansichten konsistent.

**Ablauf:** Ansicht wechseln → dieselbe Auswahl/Position sehen → Höhe bearbeiten → zurück in 2D prüfen.

**Grenze:** 3D-Viewer ist gemeinsame Ansichtsinfrastruktur und nicht automatisch ein separat zu kaufendes Fachmodul. Detaillierte Hallenmodellierung ist davon getrennt.

[Bildtafel](wireframes/module-ansichten.svg)

### I. Module, Pakete und Einstellungen — Verwaltung

**Menü:** Verfügbare Module · Paketübersicht · Modulabhängigkeiten · Nutzerrolle/Rechte (falls Nutzerkonten im Produkt) · Anzeigeeinstellungen.

**Hauptansichten:**
- installierte/verfügbare Module;
- freigeschaltete und nicht freigeschaltete Bereiche;
- Modulabhängigkeiten verständlich anzeigen;
- persönliche Sichtbarkeit separat von Kundenentitlement und Berechtigung;
- keine Aktion, die Daten eines deaktivierten Moduls entfernt.

**Ablauf:** Verfügbarkeit anzeigen → Modul öffnen oder lokalen Menüpunkt verbergen → Projektdaten bleiben erhalten.

**Grenze:** Kein Kaufprozess und kein Lizenzserver in diesem Wireframe. Technische Freischaltung ist nicht gleich Produkt-/Abrechnungsentscheidung.

[Bildtafel](wireframes/module-module.svg)

## Gesamtwege, die später getestet werden

1. Projekt neu → ganze Halle ohne Hallenmodell → 2D-Workarea → Objekt platzieren → speichern → neu öffnen.
2. Projekt neu → Hallenausschnitt wählen → Trasse/Kabelweg anlegen → Diagnose/Ausgabe → reload.
3. Mechanikpaket ohne Elektrik → Baugruppe platzieren und speichern; deaktiviertes Elektrikmodul erzeugt keine Fehler und seine etwaigen Daten bleiben unangetastet.
4. Kamera wählen/platzieren → FOV justieren → Kabelweg und Port zuordnen → Leitung verlegen/anschließen → Kamera montieren → Messgerät, Ist-Länge und Prüfergebnis zur Kabel-ID erfassen → nach Reload vollständig wiederfinden.
5. AssetLab → Modell prüfen/transformieren → bewusst speichern → in Workarea platzieren → räumliche Darstellung nach Reload vergleichen.
6. Breites Layout und Hochkantlayout führen durch dieselben fachlichen Zustände; kein Zustand darf nur auf Desktop erreichbar sein.

## Priorisierung, damit es nicht überladen wird

| Priorität | Enthalten |
|---|---|
| Erster Kern | Projekte, Halle/Planungsbereich, 2D-Workarea, Ebenen/Layer, generische Objekte, Speichern/Wiederöffnen |
| Danach Fachnutzen | Mechanik und Elektrik als getrennte, jeweils vollständige Arbeitsabläufe; Materialausgabe nur mit belastbarer Herkunft |
| Separate Erweiterungen | Kamera/FOV, AssetLab-Geometrie/CMO, 3D-Viewer-Erweiterungen, 3D-Hallengenerator, weitere Analysen |
| Betrieb/Vertrieb | echte Kundenpakete, Rollenverwaltung, Lizenzbackend und Kaufabwicklung erst nach Produktentscheidung |

„Alle Bereiche wireframen“ bedeutet, dass wir ihre Grenzen, Menüs und Hauptabläufe vorab sehen. Es bedeutet nicht, alle Erweiterungen gleichzeitig in V1 zu programmieren.

## Paketentscheidungen vor jeweiligem Gate

Die verbindlichen V1- und Geräteentscheidungen stehen in `NEUAUFBAU_GATE1_DECISION_RECORD.md`. Die folgenden Punkte sind paketbezogene Fragen und blockieren nicht rückwirkend die Wireframe-Architektur.

- Projekt duplizieren/archivieren in V1 oder später?
- Freie Polygon-/Zonengrenzen erst nach V1; V1 nutzt einen rechteckigen Arbeits-/Ansichtsrahmen, der keine Objekte abschneidet.
- Welche mechanischen Objekttypen und Baugruppen braucht der erste echte Einsatz?
- Welche konkreten Elektrikfälle sind Must-have: Trasse, Kabelweg, EPLAN-Zuordnung, Stückliste?
- Ist Materialausgabe bereits Teil des ersten einsatzfähigen Standes?
- (Entschieden) Kamera/FOV ist zusammen mit Elektrik Bestandteil des ersten einsatzfähigen Gesamtstands.
- AssetLab im Planer für alle Nutzer sichtbar oder nur für Rollen/Pakete, die Assets erstellen?
- Welche Prüf-/Exportformate werden für die ersten Berichte tatsächlich benötigt?

Die verbleibenden Fragen betreffen spätere Fachpakete, nicht mehr den V1-Kamerainstallationsablauf. Sie werden vor dem jeweiligen Paket-Gate entschieden. Noch kein Code wird durch diese Wireframe-Datei freigegeben.

## Bildtafeln

- [Projekt und Baustellenbereich](wireframes/module-projekt-bereich.svg)
- [Workarea-Basis](wireframes/module-workarea.svg)
- [Mechanik](wireframes/module-mechanik.svg)
- [Elektrik](wireframes/module-elektrik.svg)
- [Kamera/Sicherheit](wireframes/module-kamera.svg)
- [Material/Auswertung](wireframes/module-material.svg)
- [AssetLab](wireframes/module-assetlab.svg)
- [Räumliche Ansichten](wireframes/module-ansichten.svg)
- [Modulverwaltung](wireframes/module-module.svg)


### J. Fördertechnik und Anlagen — späteres Fachpaket

**Menü:** Anlagenübersicht · Baugruppen · Komponenten · Anschlüsse · Eigenschaften · Zeichnungs-/Materialausgabe.

**Hauptansichten:** Fördertechnik-Baugruppen und Komponenten aus der Asset-Bibliothek auswählen, im gemeinsamen 2D-Plan platzieren, Höhen-/Sichtlayer prüfen, Komponenten/Anschlüsse nachvollziehen und mechanische Eigenschaften bearbeiten. Spätere 3D-Ansichten verwenden dieselben gespeicherten Koordinaten.

**Grenze:** Mechanische Fördertechnik muss ohne Elektrikmodul nutzbar sein. Elektrische Anschlüsse und Kabelwege kommen aus dem Elektrikmodul und werden über IDs/Ports referenziert. Kein automatischer Import alter Anlagenprojekte.

### K. Projektinterne und globale Asset-Bibliothek

Projektassets bleiben dem Projekt zugeordnet und halten die tatsächlich verwendete Asset-Version nachvollziehbar. Die globale Bibliothek bietet projektübergreifende, versionierte Assets. Änderungen im globalen Katalog aktualisieren platzierte Projektobjekte nicht stillschweigend. Quelle, Version und Lizenzherkunft sind sichtbar. AssetLab ist das Import-/Prüf-/Bearbeitungswerkzeug, kein eigener Speicher oder dritter Katalog. In V1 lokal; ein austauschbarer Quellenadapter kann später Cloud-Hosting ergänzen.

### L. Ausgabe und Exportvarianten

Ausgaben lesen projektierte Fachobjekte und erzeugen getrennte Ansichten für Stücklisten, Materiallisten und Zeichnungsansichten. Jede Position führt zur Quelle zurück und bewahrt Einheiten, Mengen und bekannte Artikel-/Assetdaten. Exportformat und Vorlage werden vor dem jeweiligen Paket-Gate festgelegt; die Wireframe-Varianten legen die fachliche Form fest, nicht schon XLSX/PDF/andere Formate.

**Geräteabnahme für alle Modulabläufe:** breit auf iPad quer; gemeinsames Hochkantlayout jeweils auf iPad hochkant und iPhone hochkant. iPhone quer bleibt vorerst ausgeschlossen.


### M. Simulation — späterer Arbeitsbereich

**Menü:** Simulation wählen · Start/Pause/Zurücksetzen · Geschwindigkeit · Signal-/Sensorübersicht · Laufmeldungen. Analyse bleibt als eigener Menü-/Arbeitsbereich getrennt.

**Arbeitsablauf:** Projekt/Anlage planen → Simulationsbereich öffnen → freigegebene Verhaltensdefinition auswählen/prüfen → Lauf starten und Bewegungen, Signale, Sensor-/Aktorzustände beobachten → Lauf gezielt stoppen/zurücksetzen → definierte Ergebnisse in der Analyse ansehen.

**Datenhoheit:** dieselbe Anlage und dieselben Objekte wie in der Workarea. Dauerhafte Simulationsdefinitionen (Ein-/Ausgänge, Verhalten, Parameter) sind von flüchtigem Laufzeitzustand strikt getrennt. Simulationsstatus schreibt keine zufälligen Zwischenwerte in Planungsobjekte.

**Grenze:** späteres Fachpaket nach stabiler Fördertechnik-/Baugruppenbasis; nicht Bestandteil von Kamera-V1. Virtuelle Inbetriebnahme, SPS-Anbindung und detaillierte 3D-Physik werden separat abgegrenzt und sind keine TIA-Ersatz-Zusage.


### N. Zeichnungen — späteres Fachmodul

**Menü:** Zeichnungsübersicht · Blatt/Ansicht anlegen · Grundriss · Wand-/Seitenansicht · Schnitt (später) · Bemaßung · Beschriftungen · Layer/Höhen · Blattlayout · Ausgabe.

**Arbeitsablauf:** Zeichnungsblatt anlegen → Modellbereich und Ansichtsrichtung wählen → Maßstab und sichtbare Ebenen/Layer einstellen → Bemaßungen und Hinweise ergänzen → Aktualität gegen Projektmodell prüfen → Ausgabe erzeugen.

**Datenhoheit:** Zeichnung speichert Ansichtsdefinition, Blattlayout, Maße und Annotationen; Bauteilgeometrie bleibt im Projekt-/Szenenmodell. Änderungen an Quellobjekten markieren betroffene Ansichten als prüfbedürftig, statt eine veraltete Zeichnung als aktuell erscheinen zu lassen.

**Grenze:** anderes Fachziel als die Workarea und anderes Ergebnis als Stückliste/Materialliste. PDF/CAD-Formate, Vorlagen und Revisionen benötigen eigenes Paket-Gate. Kein zweiter Geometrieeditor.
