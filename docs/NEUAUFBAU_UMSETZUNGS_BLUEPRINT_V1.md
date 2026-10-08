# Neuaufbau – Umsetzungs-Blueprint V1

Gate-1-Entscheidungsprotokoll: [NEUAUFBAU_GATE1_DECISION_RECORD.md](./NEUAUFBAU_GATE1_DECISION_RECORD.md)

Stand: 08.10.2026  
Branch: `dev/planner-neuaufbau`  
Status: Gate 1 abgeschlossen; Paket A ist für Gate 2 autorisiert und implementiert. Der unabhängige Browserlauf #37810463781 bestand auf Quellstand `e6c323154401bb7e3bb06b83f813f2a58bf2c396` (Syntax, Importgraph, 8/8 Browserfälle). Reale Safari-Gerätetests und Gate 3 stehen noch aus.  
Modulweiter Wireframe: [`NEUAUFBAU_WIREFRAME_MODULE_V1.md`](./NEUAUFBAU_WIREFRAME_MODULE_V1.md)  
Produktentscheidung: echter Greenfield-Neuaufbau; vorhandene Main-Projekte müssen in V1 nicht weitergeführt oder importiert werden.  
Ausgangsbasis Paket A: `dev/planner-neuaufbau@81a73ff9d33310ddda3cfb915adb263a9a5714ce`; Produktstand `main@be0061f6cca67c30adee8b476e8ea0265707ab18` bleibt unangetastet.

## 1. Wozu dieser Blueprint dient

Der Wireframe V0 zeigt nur die grobe Oberfläche. Dieser Blueprint ergänzt die fehlende Bauvorlage: Nutzerablauf, Zustände, Modulgrenzen, Datenhoheit, Umsetzungsreihenfolge und Abnahmekriterien. Danach sollen größere, zusammenhängende Arbeitspakete mit KI-Unterstützung umgesetzt werden können, ohne bei jedem Paket Architektur und Scope neu erraten zu müssen.

„Größere Pakete“ bedeutet hier vollständige, vertikale Funktionen mit Tests und klaren Übergaben. Es bedeutet nicht, die gesamte Anwendung in einem ungeprüften Mega-Schritt zu erzeugen. Jedes Paket endet an einem überprüfbaren Produktzustand und baut auf einem eingefrorenen Stand auf.

## 2. Produktziel des ersten nutzbaren Gesamtstands

Eine berechtigte Person kann:

1. den Planer öffnen und ein neues Projekt anlegen oder ein bereits im neuen Planer angelegtes Projekt fortsetzen;
2. im neuen Planer eine Halle als räumliche Referenz anlegen oder auswählen;
3. einen veränderbaren Baustellenbereich als ganze Halle oder Hallenausschnitt festlegen;
4. den Bereich als maßstäblichen 2D-Plan öffnen;
5. Objekte aus den verfügbaren Fachmodulen auf einer gewählten räumlichen Höhe platzieren und bearbeiten;
6. Sichtbarkeit über getrennte Fach-/Sichtlayer steuern;
7. Projekt und Änderungen speichern, das Projekt schließen, wieder öffnen und denselben fachlichen Stand vorfinden;
8. auf dem iPad im Querformat und iPhone im Hochformat denselben Ablauf zuverlässig durchführen; das iPad im Hochformat wird ergänzend auf dasselbe mobile Layout geprüft.

Ein vollständiges 3D-Hallenmodell, ein 3D-Editor, bestimmte Gewerke oder AssetLab dürfen kein notwendiger Vorlauf sein, damit die Basisplanung funktioniert.

## 3. Geräte- und Layoutvertrag

| Layoutklasse | Zielgeräte | Nutzung |
|---|---|---|
| Breit | iPad quer als reales Abnahmegerät; dieselbe Layoutklasse ist für Desktop vorgesehen | Projektübersicht, Einrichtung und Workarea teilen dasselbe Layoutsystem |
| Hochkant | iPhone hochkant als reales Abnahmegerät; iPad hochkant als Pflichtprüfung des gemeinsamen Hochkantlayouts | Einspaltiger, touch-orientierter Ablauf; Workarea mit aufrufbaren Werkzeug-/Eigenschaftsflächen |
| Außerhalb des ersten Zieles | iPhone quer | Für die erste Produktfassung nicht zugesichert; bei Bedarf später separat aufnehmen |

Es gibt keine getrennten Datenmodelle oder Funktionsvarianten pro Gerät. Navigation, Bedienziele und Anordnung dürfen sich anpassen. Der Nutzer besitzt keinen Rechner; ein separater PC-Test ist daher keine Abnahmevoraussetzung. Das iPad im Querformat ist der vereinbarte reale Praxistest für die breite Layoutklasse, die auch für Desktop vorgesehen ist. Das iPhone im Hochformat prüft die mobile Kernansicht; das iPad im Hochformat ergänzt den Test derselben mobilen Layoutklasse auf größerem Bildschirm. Konkrete Breakpoints, Mindestbreiten, Safari-Verhalten, Touchzielgrößen und Tastaturverhalten werden in einem UI-Technik-Gate festgelegt und mit diesen Geräten geprüft.

## 4. Vollständiger Nutzerablauf und Zustände

| Zustand | Eintritt | Nutzerentscheidung/Aktion | Erfolgszustand |
|---|---|---|---|
| Planer-Einstieg | App ist geladen | Projekt öffnen, neues Projekt, ggf. vorhandene Entwürfe ansehen | Projektkontext eindeutig |
| Projektübersicht | Liste/Arbeitsbereich geöffnet | Suchen, sortieren, öffnen oder neu anlegen | Projekt wird aktiv, ohne Kopie des Projektzustands |
| Projekt anlegen | „Neues Projekt“ | Nur erforderliche Basisangaben eingeben | Gespeicherter Projektentwurf, noch ohne erzwungene Fachmodule |
| Räumlichen Bezug wählen | Projektentwurf vorhanden | Neue/gespeicherte Halle wählen oder ohne detailliertes Hallenmodell fortfahren | Halle/Referenz eindeutig, optional |
| Baustellenbereich festlegen | Räumlicher Bezug geklärt | Ganze Halle oder abgrenzbaren Ausschnitt wählen; Bereich später änderbar | Maßstab, Ursprung und Begrenzung eindeutig |
| Workarea öffnen | Bereich ist gültig | 2D-Topansicht öffnen | Richtiger Bereich und aktive Standardebene sichtbar |
| Planen | Workarea aktiv | Werkzeug wählen, Objekt platzieren/ändern, Ebene und Layer verwalten | Änderung im kanonischen Projektszenenmodell |
| Speichern/Fehler behandeln | Änderungszustand vorhanden | Speichern oder Fehler lösen; Status bleibt sichtbar | Eindeutig gespeicherter oder ungespeicherter Zustand |
| Wieder öffnen | Projekt geschlossen/neugeladen | Projekt erneut öffnen | Bereich, Objekte, Positionen, Höhen, Layer und Modulzuordnung sind erhalten |

### Pflichtfälle für den Ablauf

- neues Projekt ohne Hallenmodell bis in eine leere Workarea;
- vorhandenes Projekt fortsetzen;
- gesamte Halle als Baustellenbereich;
- Hallenausschnitt mit Lagebezug zur übergeordneten Halle;
- Bereich nachträglich anpassen, ohne Planobjekte unbemerkt zu verschieben oder abzuschneiden;
- Modul deaktivieren und später wieder aktivieren, ohne zugehörige Projektdaten zu verlieren;
- Speicherfehler/Reload mit ungespeicherten Änderungen klar anzeigen und sicher behandeln.

## 5. Domänen- und Modulzuschnitt

Die sichtbaren Menübereiche, Hauptansichten und Abläufe sind im [modulweiten Wireframe V1](./NEUAUFBAU_WIREFRAME_MODULE_V1.md) dargestellt. Die Wireframes zeigen geplante Bereiche, aber deren Aufnahme in V1 wird nach dem tatsächlichen Nutzungsbedarf priorisiert.

### Gemeinsame Basis

Besitzt Projektidentität, räumliche Referenz und Baustellenbereich, Koordinaten-/Einheitenregeln, Höhenebenen, Sicht-/Fachlayer, Szenenobjekte, Auswahl-/Befehlssystem, Workarea-Shell und freigegebene Persistenz.

### Räumlicher Bezug und Hallenkonfiguration

Die Halle ist ein möglicher Bezug für die Baustelle, nicht automatisch der Planungsbereich. Es muss möglich sein, die ganze Halle, einen Hallenausschnitt oder später eine freie Baustellenfläche zu planen. Hallenabmessungen/Referenzgeometrie reichen für die Basis; detaillierte Wände, Stützen oder ein Hallengenerator sind optionale Erweiterungen. Die Halle und der Baustellenbereich bleiben änderbar.

### Workarea und Ansichten

Die Workarea ist eine neue Oberfläche und der Host für Fachwerkzeuge. Zuerst entsteht eine maßstäbliche 2D-Topansicht. Von Anfang an nutzt sie aber räumliche Projektdaten. Spätere 3D-, Front-/Seiten- und Schnittansichten sind Ansichten auf denselben Szenenzustand, keine parallelen Modelle.

### Fachmodule

| Modul | Eigene Zuständigkeit | Gemeinsame Abhängigkeit |
|---|---|---|
| Mechanik | mechanische Planobjekte, Werkzeuge, Eigenschaften und mechanische Ausgaben | Projekt, Workarea, Geometrie, Auswahl, Ebenen und Speichern |
| Elektrik | Trassen, Kabelwege, Anschlüsse, elektrische Eigenschaften und Ausgaben | dieselbe Szene und Persistenz; keine eigene Workarea |
| Kamera/Sicherheit | Kameraposition, Blickrichtung, Öffnungswinkel und maßstäblicher Sichtsektor | dieselbe 2D-Geometrie/Koordinatenbasis |
| Material/Auswertung | Stücklisten-, Mengen- und Auswertungsansichten | abgeleitete Daten aus den Fachobjekten, keine zweite Objektquelle |
| AssetLab | Asset-Erstellung/-Prüfung, Modellbearbeitung und Import/Export | versionierter Asset-Vertrag; nicht Voraussetzung für Basisplanung |

Die Tabelle legt fachliche Grenzen fest, nicht alle späteren Produktfunktionen. Ein Modul registriert seine Werkzeuge und Objekttypen über einen dokumentierten Host-Vertrag; es greift nicht direkt in interne Zustände anderer Module ein.

### Modulfreischaltung

Architektur trennt mindestens:

1. technische Verfügbarkeit eines Moduls in der Anwendung;
2. Kundenpaket/Entitlement;
3. Benutzerrolle und Berechtigung;
4. lokale Sichtbarkeit oder persönliche Arbeitspräferenz;
5. Abhängigkeiten zwischen Modulen.

Das Verbergen eines Menüpunkts ist keine Berechtigungsprüfung. Daten eines vorübergehend nicht verfügbaren Moduls bleiben im Projekt erhalten. Welche Pakete verkauft werden, ob es Nutzerkonten/Rollen gibt und wo Entitlements geprüft werden, ist eine Produkt-/Betriebsentscheidung und muss vor einer echten Lizenzumsetzung separat festgelegt werden.

## 6. Räumlicher Projektvertrag – fachliche Mindestregeln

Dies ist zunächst ein fachlicher Mindestvertrag, noch keine verbindliche JSON-Struktur:

- Ein Projekt hat genau eine kanonische räumliche Szenenquelle.
- Eine Halle oder Referenzfläche definiert Lage/Orientierung und kann optional detaillierte Geometrie besitzen.
- Der Baustellenbereich definiert die aktiv geplante Fläche und ihren Bezug zur Referenz. Änderungen daran müssen Auswirkungen auf enthaltene Objekte sichtbar machen.
- Längen-/Winkel-/Koordinateneinheiten und Ursprung werden einmal festgelegt und in UI, Speicherung, Import/Export und Tests konsistent angewandt.
- Jedes platzierte Objekt hat eine stabile Identität, räumliche Position, Ausrichtung, Typ/Fachmodul und fachlich erforderliche Eigenschaften.
- Höhenebenen definieren räumliche Bezugshöhen (z. B. Boden, Wandebene, Bühne, Dach). Objektpositionen behalten ihre Höhe auch dann, wenn die Workarea zunächst von oben auf sie blickt.
- Sicht-/Fachlayer sind eine eigene Gruppierungs- und Sichtbarkeitsebene. Eine Höhenebene ist kein Layer; ein Fachlayer ist keine Geometriehöhe.
- Die aktive Höhenebene beeinflusst die neue Platzierung und klar definierte Editierbefehle. Sie darf vorhandene Objekte nicht stillschweigend auf eine andere Höhe verschieben.
- 2D, 3D und Schnitt projizieren denselben gespeicherten Zustand. Eine Ansicht darf keine eigene persistierte Schattenkopie der Objekte führen.
- Abgeleitete Größen (z. B. Gesamtlängen) werden als berechenbare Werte behandelt, außer eine fachlich begründete dauerhafte Eingabe wird explizit definiert.

### Vor Festlegung des konkreten Schemas zu beantworten

- Koordinatenursprung und Orientierung bei Hallenausschnitt;
- Meter- oder Millimeter-Konvention je Grenze;
- Rechteckige Grundfläche oder allgemeine Polygon-/Zonenfläche für V1;
- Verhalten, wenn ein Bereich nachträglich verkleinert wird;
- Höhenebenen-Vorlagen und Nutzerdefinierte Ebenen;
- Versionierung und Validierung ausschließlich des neuen Projektformats; Altprojekt-Import ist für V1 ausgeschlossen und kann später separat priorisiert werden;
- welche Objekt-/Asset-IDs über Save→Reload stabil bleiben müssen.

## 7. Persistenz, Assets und AssetLab

### Projektpersistenz

Es wird genau ein autorisierter Projekt-Lese-/Schreibpfad definiert. UI, Workarea, Viewer und Fachmodule schreiben nicht mit eigenen Nebenpfaden in verschiedene Projektkopien. Manuelles Speichern, Autosave, Wiederherstellung und Fehleranzeige werden als ausdrückliche Produktregeln beschrieben; der Wireframe verspricht hier noch keine Autosave-Semantik.

### Assets und Modelle

- Projektasset-Identität und Modellinhalt sind unterscheidbar; Referenzen dürfen nicht nur auf Dateinamen beruhen.
- Laden/Validieren/Dekodieren/Exportieren erhält einen gemeinsamen Asset-I/O-Vertrag, den Viewer und AssetLab nutzen können.
- GLB/GLTF, Texturen, optionale Decoder und Thumbnails werden mit Status/Fehlerpfaden behandelt.
- Bearbeitete Transformationen werden erst dann als Projektasset gespeichert, wenn ein expliziter Export-/Speicherbefehl den bearbeiteten Inhalt korrekt serialisiert.
- AssetLab-Editoroberfläche, Geometriewerkzeuge, Host-Kommunikation und persistierte Assets bleiben einzeln verantwortliche Komponenten.
- Große Binärdaten und wiederholte Base64-Kopien werden nicht ohne messbare Notwendigkeit im allgemeinen Workarea-Modul abgelegt.
- Entscheidung über IFrame/Worker/isolation, Cache, IndexedDB und Offlineverhalten erfolgt anhand von Browser-/iOS-Tests, nicht aufgrund der Größe einer einzelnen Quelldatei.

### Neues Projektformat und Umgang mit dem Altbestand

V1 startet mit einem neuen, klar versionierten Projektformat. Vorhandene Projekte aus `main` müssen nicht weiter funktionieren und werden nicht automatisch importiert. Es gibt keine versteckte Kompatibilitätsschicht und keine Pflicht, alte SaveGames mitzuschleppen. So kann das neue Datenmodell sauber und ohne Altlasten auf den vereinbarten Arbeitsablauf zugeschnitten werden.

Falls später konkrete vorhandene Projekte übernommen werden sollen, wird deren Nutzen separat geprüft und ein eigener Importer mit Beispieldateien, Validierung und Abnahme freigegeben. Das ist keine Voraussetzung für Paket A oder B. Fehlerhafte Dateien des neuen Formats müssen klar abgelehnt werden, statt still unvollständig zu laden.

## 8. Nichtfunktionale und praktische Einsatzanforderungen

- Speichern und erneutes Öffnen erhalten alle fachlich wichtigen Daten.
- Planobjekte bleiben nach Reload in der Workarea sichtbar und stimmen mit Objektbaum und Eigenschaften überein.
- Touchbedienung blockiert keine zentrale Planaktion; relevante Eingaben funktionieren mit Safari und Desktopbrowser.
- Fehler, Speichern, Laden und laufende Arbeit haben eindeutige sichtbare Zustände.
- Deaktivierte Module blockieren weder Kernplanung noch zerstören sie Daten.
- Projekt mit leerem Plan und Projekt mit repräsentativer Objekt-/Assetlast werden auf Performance und Speicherbedarf geprüft.
- Mindestbrowser und reale Geräte werden vor Umsetzung eines Browser-/Rendertechnikentscheids festgelegt.
- Das Arbeitsziel wird nie allein durch erfolgreiche Unit-Tests als einsatzfähig erklärt.

## 9. Wenige größere, kontrollierte Umsetzungspakete

Die Reihenfolge minimiert Architekturwechsel und hält jedes Paket bis zum Nutzerablauf zusammenhängend. Nach Abschluss und Freeze eines Pakets wird der nächste Scope gegen den konkreten Remote-Head freigegeben.

### Paket A – Plattformkern und Datenvertrag

**Enthält:** Projekt-/Szenenautorität, Koordinaten/Einheiten, Halle/Planungsbereich, Höhenebenen/Layers, Modulmanifest/Host-Vertrag, Versionierung, Persistenzregeln und Testfixtures.  
**Nicht enthalten:** umfangreiche Fachwerkzeuge oder 3D-Editor.  
**Abnahme:** Schema-/Vertragsprüfungen und Roundtrip für neue Projekte; ungültige oder unbekannte Versionen des neuen Formats werden klar erkannt. Import/Migration von Altprojekten ist nicht enthalten.

### Paket B – Neue Workarea als erster End-to-End-Nutzen

**Enthält:** Einstieg, Projekt neu/öffnen, Bereich einrichten/ändern, neue responsive Shell, maßstäbliche 2D-Topansicht, Auswahl, kleine generische Objektbasis, Ebene/Layer, speichern und wieder öffnen.  
**Abnahme:** der Pflichtablauf aus Abschnitt 4 funktioniert vollständig auf dem iPad quer und iPhone hochkant; kein produktiver Import des alten Workarea-Monolithen als Architekturgrundlage.

### Paket C – Fachmodule in nutzbaren Abläufen

**Enthält:** zuerst Elektrik (Kabel-ID, Endpunkte, reale Route, Verlege-/Anschlussstatus und manuelles Messprotokoll), danach Kamera (Position/FOV, Montage und Referenz auf Kabel-ID). Mechanik bleibt ein unabhängiges späteres Fachpaket. Vollständige Auswertungen und EPLAN-Import sind nicht Teil des V1-Kamerainstallationsablaufs.  
**Abnahme:** Module unabhängig aktivierbar; jeder wichtige Objektablauf wird platziert, verändert, gespeichert und nach Reload korrekt dargestellt; deaktivierte Fachdaten bleiben erhalten.

### Paket D – Asset-Pipeline und 3D-Ansichten

**Enthält:** gemeinsame Modell-I/O-Grenze, Vorschau/Viewer, AssetLab-Editorvertrag, GLB/GLTF-Import/-Export, Textur-/Thumbnailfluss, spätere 3D-/Seiten-/Schnittansichten.  
**Abnahme:** reale Modellfixtures laden, zeigen Fehler sauber, speichern bearbeitete Änderungen bewusst und stellen Asset/Transform nach Reload korrekt wieder her; 2D- und 3D-Ansichten zeigen dasselbe Projekt.

### Paket E – Gesamtfreigabe, Gerätebeleg und Integration

**Enthält:** Paketübergreifende Fehlerbehebung, Browser-/E2E-/Datenfixtures, reale manuelle Geräteprüfung, Dokumentation, Freeze und separat freigegebene Integration.  
**Abnahme:** alle Praxistauglichkeits-Blocker sind geschlossen; klare Nachweise vom iPad quer (breite Layoutklasse) sowie iPad hochkant und iPhone hochkant (gemeinsames Hochkantlayout) liegen vor; erst dann Main-Integration.

Die Inhalte jedes Pakets können in interne Aufgaben zerlegt werden. Ihre Nutzerabläufe, Datenverträge und Abnahmen werden nicht über lose Teilpatches verteilt.

## 10. Nachweise je Paket

Für jedes Paket wird ein gleiches, schlankes Evidence-Set verlangt:

1. Ausgangsbranch und exakter Basis-Commit;
2. begrenzte geänderte Module und dokumentierte Verträge;
3. relevante automatisierte Tests (Unit/Contract/E2E, wo passend);
4. Save→Reload-Nachweis für neue oder geänderte Daten;
5. Geräte-/Browsernachweise passend zum geänderten UI;
6. bekannte Einschränkungen und nicht bestandene Checks;
7. Freeze-Commit; Integration nach Main bleibt separater Schritt.

## 11. Scope- und Wiederverwendungsregeln

- Neuaufbau-Branch enthält ausschließlich neue Dokumentation, neue Implementation und ausdrücklich freigegebene Funktionen; V1 benötigt keine Altprojekt-Datenmigration.
- Bestehender Main-Code wird nicht automatisch kopiert, repariert oder zur Laufzeit eingebunden.
- Ein vorhandenes Modul wird nur dann KEEP/PORT, wenn es einen klaren Nutzen hat, isoliert geprüft wurde und seinen Vertrag erfüllt.
- Ein UI-/Datenverhalten ohne verlässliche Save→Reload- oder Gerätebelege gilt nicht als bewährte Grundlage.
- Altes Verhalten und alte Projektdaten sind kein Kompatibilitätsvertrag für V1. Übernommene fachliche Anforderungen müssen im neuen Blueprint ausdrücklich stehen.
- Funktionen, deren Produktbedarf noch unbestätigt ist, bleiben optionale Erweiterungen statt Grundlagenabhängigkeiten.

## 12. Planungsabschluss vor Gate 2

Vor erster Produktimplementation müssen diese Entscheidungen dokumentiert und abgenommen sein:

- [x] V1-Pflichtablauf und Produktumfang sind in NEUAUFBAU_GATE1_DECISION_RECORD.md festgelegt;
- [ ] Bildschirmzustände und Navigation für beide Layoutsysteme nachvollziehbar;
- [ ] erster Projekt-/Szenen-/Asset-Datenvertrag festgelegt;
- [x] Koordinaten, Basiseinheit, Hallenbezug und Regeln zur Bereichsänderung sind in NEUAUFBAU_GATE1_DECISION_RECORD.md festgelegt;
- [ ] Ebene-/Layer- und Modulhost-Vertrag geprüft;
- [x] Speicher-/Fehlervertrag und Ausschluss des Altprojekt-Imports aus V1 sind in NEUAUFBAU_GATE1_DECISION_RECORD.md festgelegt;
- [ ] Paket A und B exakt auf Dateien/Module/Abhängigkeiten begrenzt;
- [x] Geräteklassen festgelegt: iPad quer breit; iPad hochkant und iPhone hochkant gemeinsames Hochkantlayout; iPhone quer ausgeschlossen, siehe NEUAUFBAU_GATE1_DECISION_RECORD.md;
- [ ] Grenzfälle und Abnahmedaten für Paket A/B benannt.

**Nächster sinnvoller Arbeitsschritt:** diese offenen Produkt-/Datenentscheidungen als Gate 1 schließen und daraus die exakte Scope-Freigabe für Paket A ableiten. Bis dahin kein Produktcode.


## Ergänzter Erweiterungsvertrag

Fördertechnik-Projekte sind ein späterer verbindlicher Anwendungsfall des Greenfield-Planers. Baugruppen, Komponenten und ihre räumlichen Eigenschaften liegen auf dem gemeinsamen Projekt-/Szenenmodell. Mechanik/Fördertechnik muss unabhängig von Elektrik aktivierbar sein; elektrische Anschlüsse können über den separaten Elektrikvertrag hinzukommen. Der spätere Support bedeutet keine automatische Übernahme alter Projektdaten.

Asset-Verträge unterscheiden projektinterne und globale Bibliothek. Sie führen stabile Asset-IDs, Versions-/Quellenangaben und Lizenzherkunft. Verwendete Assets bleiben im Projekt stabil, auch wenn der globale Katalog aktualisiert wird. AssetLab ist eine Bearbeitungs-/Prüfoberfläche, während Bibliotheken und Projektpersistenz eigene Datenverantwortungen haben. V1 nutzt lokale Speicherung und explizite Projektdatei-Übertragung; ein globaler Bibliotheksadapter darf künftig Cloud-Hosting ermöglichen, aber V1 verlangt weder Cloud noch Synchronisation.

Ausgabe-Architektur liest Daten aus den Fachmodulen und erzeugt rückverfolgbare Varianten wie Stückliste, Materialliste und Zeichnungsansicht. Menge, Einheit, Quellobjekt und Artikel-/Assetidentität bleiben nachvollziehbar. Dateiformate und konkrete Vorlagen sind je späterem Exportpaket zu entscheiden.

**Verbindliche Geräteklassen:** breit entspricht der Desktop-Zielanordnung und wird real auf iPad quer geprüft. Das gemeinsame Hochkantlayout wird sowohl auf iPad hochkant als auch iPhone hochkant geprüft. iPhone quer ist für den ersten Umfang ausgeschlossen. Der Erfolg der Geräteprüfung erfordert Bedienbarkeit und korrekten Save→Reload-Zustand in beiden Layoutklassen.


## Spätere Simulationsdomäne

Simulation wird als späteres, separat freizugebendes Fachmodul vorgesehen. Sie verwendet dieselbe Projekt-/Anlagenstruktur wie die Planung und erhält einen eigenen Arbeitsbereich neben Planung und Analyse. Ein Wechsel des Arbeitsbereichs wechselt Ansicht und Tätigkeit, nicht Projekt oder Datenautorität.

Das Datenmodell trennt dauerhaft gespeicherte Simulationsdefinitionen (Inputs, Outputs, Verhalten, Parameter) vom temporären Runtime-State (Laufstatus, Positionen/Bewegungen, Geschwindigkeit, aktuelle Signale sowie Sensor-/Aktorwerte). Die Runtime darf Planungsdaten nicht versehentlich überschreiben. Laufresultate werden erst nach gesonderter Festlegung gezielt persistiert und von der Analyse ausgewertet.

Fördertechnik ist ein möglicher erster Simulationsanwendungsfall, sobald Baugruppen, Ports, Achsen und Verhalten beschrieben sind. Der konkrete Simulationsumfang, 2D-/3D-Darstellung und Steuerungsintegration erhalten ein eigenes Paket-Gate. Diese Zukunftsfunktion gehört nicht zum Kamera-V1 oder Paket A und ist keine Zusage eines TIA-Ersatzes.


## Späteres Zeichnungsmodul

Das Zeichnungsmodul ist ein separater Fachbereich, der Zeichnungen aus den gemeinsamen Projekt- und Szenendaten erstellt. Die Workarea bearbeitet das Modell; das Zeichnungsmodul organisiert daraus Blätter und Ansichten. Es erzeugt keine getrennte Kopie der Planobjekte.

Vorgesehener Umfang: maßstäbliche Grundrisse, Wand-/Front-/Seitenansichten und später Schnitte, Bemaßungen, Beschriftungen, Layer-/Höhenebenensteuerung, Blattformat und Änderungsindikator, wenn Quelldaten geändert wurden. Zeichnungen müssen auf die zugrunde liegenden Objekte zurückführbar sein. Stücklisten, Materiallisten und Zeichnungsausgaben haben unterschiedliche Daten-/Validierungsregeln. Exportformat, Vorlagen, Revision und Freigabe werden erst in einem eigenen Paket-Scope festgelegt. Das Modul wird nach Projekt-/Geometriekern gebaut und gehört nicht zu Kamera-V1 oder Paket A.
