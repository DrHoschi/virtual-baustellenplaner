# Neuaufbau – Zielarchitektur

Status: Gate 1 Architektur und V1-Zielumfang abgeschlossen; siehe NEUAUFBAU_GATE1_DECISION_RECORD.md. Gate 2 nicht autorisiert.
Stand: 07.10.2026
Ausgangsstand: `main = be0061f6cca67c30adee8b476e8ea0265707ab18`
Branch-Basis: `dev/planner-neuaufbau = be0061f6cca67c30adee8b476e8ea0265707ab18`
Gate-1-Entscheidungsprotokoll: NEUAUFBAU_GATE1_DECISION_RECORD.md

Dieses Dokument beschreibt die Zielarchitektur eines echten Greenfield-Neuaufbaus. Es autorisiert keine Produktcode-Implementation. `main` bleibt während des Neuaufbaus unverändert.

Der neue Planer muss vorhandene Main-Projekte zunächst **nicht weiterführen**. Für V1 gibt es keine Pflicht zur Abwärtskompatibilität oder zum Import alter Projekte/SaveGames. Es entsteht ein neues, klar definiertes Projektformat. Bestehende Abläufe, Quelldateien und Daten dienen höchstens als fachliche Hinweise; Übernahmen brauchen einen nachgewiesenen Nutzen und eine ausdrückliche Entscheidung. Ein späterer Altprojekt-Import wäre ein eigenes Produktpaket und wird nur umgesetzt, wenn dafür konkreter Bedarf besteht.

Leitlinie für das Produkt: Die innere Architektur darf modular sein; die Oberfläche und der normale Arbeitsablauf sollen trotzdem einfach und übersichtlich bleiben. In V1 kommen nur Funktionen, die den vereinbarten Arbeitsablauf tatsächlich unterstützen. Unbestätigte Zukunftsfunktionen werden nicht vorsorglich mitgebaut.

## 1. Produktgrundlage

Der zentrale räumliche Begriff ist zunächst der **Baustellenbereich**: die Fläche, auf der geplant wird. Sie kann eine gesamte Halle, einen Hallenabschnitt oder später eine andere definierte Fläche umfassen. Ein Baustellenbereich ist nicht automatisch gleichbedeutend mit einem vollständigen Hallenmodell.

Die Planung beginnt mit einer maßstäblichen 2D-Ansicht. Das zugrunde liegende räumliche Modell muss von Anfang an dreidimensional sein, damit weitere Ansichten später dieselben Objekte darstellen können.

### Räumliche Regeln

- Ein gemeinsames Projektkoordinatensystem und dokumentierte Einheiten gelten in allen Ansichten.
- Objekte besitzen eine räumliche Position und Ausrichtung; die 2D-Ansicht ist eine Projektion dieser Daten.
- Eine aktive Höhenebene bestimmt, auf welcher Höhe 2D-Objekte platziert oder bearbeitet werden.
- **Höhenebenen** beschreiben räumliche Bezugsebenen wie Boden, Wandebene, Plattform oder Dachhöhe.
- **Sicht-/Fachlayer** steuern getrennt davon Sichtbarkeit und fachliche Gruppierung, beispielsweise Mechanik, Elektrik oder Kameras.
- Höhenebenen und Sichtlayer dürfen nicht als ein gemeinsames Feld oder als parallele Szenen modelliert werden.
- Eine 2D-Platzierung muss ihre räumliche Höhe behalten und später in 3D, Ansicht oder Schnitt korrekt erscheinen.

Die endgültigen Schema- und Feldnamen werden erst nach einer eigenen Datenvertragsprüfung festgelegt. Dieser Abschnitt ist ein Architekturvertrag, noch kein autorisiertes Savegame-Schema.

## 2. Hallen- und Baustellenmodell

Der Kern speichert den Planungsbereich und seinen Bezug zu einer Halle oder einem anderen räumlichen Referenzmodell. Mindestens zu unterscheiden sind:

1. ganze Halle als Planungsbereich;
2. abgegrenzter Ausschnitt einer Halle mit nachvollziehbarem Bezug zum Gesamtkoordinatensystem;
3. später eine frei definierte oder nicht hallengebundene Baustellenfläche.

Die Hallenkonfiguration umfasst nur die Angaben, die für Umfang und räumliche Referenz benötigt werden. Ein detaillierter Tragwerks- oder Hallengenerator ist eine optionale Erweiterung. Eine einfache Planung darf nicht davon abhängen, dass ein vollständiges Hallenmodell erzeugt wurde.

Ein gemeinsamer Viewer kann Hallengeometrie und Planungsobjekte darstellen. Der Viewer besitzt keine eigene Hallen- oder Projektdatenquelle; alle Ansichten lesen dasselbe Projektmodell.

## 3. Neue Workarea

Die Workarea wird als neue, eigenständige Planungsoberfläche aufgebaut. `ui/panels/WorkareaPanel.base.js` mit rund 9.600 Zeilen wird nicht als Zielarchitektur fortgeführt. Verhalten wird nur übernommen, wenn es die festgelegten Tests und fachlichen Anforderungen erfüllt.

Die Workarea besteht aus klaren Verantwortlichkeiten:

- **Workspace-Shell:** Arbeitsbereiche, Werkzeugleisten, Objektbaum, Eigenschaften und Ansichtsbereiche zusammensetzen.
- **Projekt-/Szenenmodell:** Planungsobjekte, räumliche Positionen, Höhenebenen und Sichtlayer verwalten.
- **Viewport und Ansichten:** 2D-Plan, später 3D, Ansicht und Schnitt aus demselben Szenenmodell darstellen.
- **Eingabe und Befehle:** Auswahl, Platzierung, Verschieben, Drehen und Fachwerkzeuge als registrierte Aktionen verarbeiten.
- **Fachmodule:** eigene Objektarten, Werkzeuge, Eigenschaften und Ausgaben beitragen.
- **Persistenzadapter:** den freigegebenen Projektvertrag laden und speichern; Ansichten dürfen keine Schattenkopie der Projektdaten halten.

Die 2D-Ansicht kommt zuerst. Die Architektur legt aber keine 2D-only-Geometrie an und bindet keine Fachlogik direkt an einzelne Canvas-Zeichenroutinen.

## 4. Fachmodule und Freischaltung

Das Produkt trennt gemeinsame Basis, Fachmodule, Kundenpakete und Benutzerrollen.

- **Gemeinsame Basis:** Projekte, Planungsbereich, Koordinaten, Höhenebenen, grundlegende 2D-Planung, gemeinsamer Modulhost und notwendige Speicherfunktionen.
- **Mechanik:** mechanische Objekte, Anlagen-/Baugruppenplanung und zugehörige mechanische Ausgaben.
- **Elektrik:** Kabeltrassen, Kabel, EPLAN-Bezüge und elektrische Ausgaben.
- **Kamera/Sicherheit:** Kamerapositionen und dynamische Sichtfelder als eigenes Fachmodul.
- **Weitere Module:** Material-, Analyse-, Simulations- oder Exportfunktionen nach bestätigtem Produktbedarf.

Ein Fachmodul soll über einen versionierten Vertrag seine Abhängigkeiten, Werkzeuge, Objekt-/Datentypen, Eigenschaftenansichten, Ansichten und Anforderungen an den aktuellen Projektvertrag deklarieren. Migration meint dabei nur notwendige Änderungen zwischen Versionen des neuen Formats; ein Import alter Main-Projekte ist nicht vorausgesetzt. Ein Modul soll keine internen DOM-Elemente oder privaten Zustände eines anderen Moduls verändern.

Freischaltung ist nicht dasselbe wie lokale Aktivierung oder Benutzerrolle:

- Ein **Kundenpaket/Entitlement** bestimmt, welche Module der Kunde nutzen darf.
- Eine **Benutzerrolle/Berechtigung** bestimmt, welche Aktionen ein Benutzer im freigeschalteten Modul ausführen darf.
- Die lokale **Aktivierung** bestimmt, welche freigeschalteten Module die Person in ihrer Oberfläche eingeblendet haben möchte.
- Ein deaktiviertes Modul darf vorhandene Projektdaten nicht löschen oder stillschweigend umschreiben.
- Ein Mechanikpaket soll ohne geladene Elektrikwerkzeuge funktionieren; die gemeinsame Planungsfläche bleibt dieselbe.

Das bestehende Feature-Gate mit pauschalem Entwicklungsmodus `all_on` und einfachen Flags ist kein Kunden-Lizenzsystem. Für den Neuaufbau wird zunächst der Entitlement-Vertrag entworfen; Kaufabwicklung oder ein Lizenzserver sind nicht Teil dieser Architekturdefinition.

## 5. Hallenfunktionen im vorhandenen Stand

Im Ausgangsstand gilt `app.project.hall` als Hallenautorität. Der Hallen-Wizard verwendet die V1-Konfiguration und migriert Hallendaten; Hall3D enthält gleichzeitig 3D-Darstellung sowie Formulare zum Anlegen und Bearbeiten. Die V2-Strukturkonfiguration ergänzt weitere Tragwerksangaben. Zusätzlich existiert eine ältere `module.state.js`, obwohl das Hall3D-Modul laut eigener Logik keine separate Hallenautorität mehr führen soll.

Als mögliche Übernahmekandidaten gelten daher nur nach Prüfung:

- die zentrale Projektzuordnung der Hallendaten;
- reine Normalisierung und deterministische Ableitung von Rasterachsen;
- die fachlich verifizierten Strukturprofil- und Hallenregeln.

Die bestehende Vermischung von Hallenkonfiguration und 3D-Panel sowie historische V1/V2-Bedienpfade sind kein Zielbild. Im Neuaufbau sind Hallen-/Bereichskonfiguration und Viewer getrennte Ansichten derselben Daten.

## 6. AssetLab und GLB-Verarbeitung

Im Ausgangsstand umfasst `modules/assetlab3d/iframe/assetlab-lite.js` rund 1.700 Zeilen und 58 kB. Die Datei vereint Three.js-Ansicht und Bedienung, GLB-Laden und -Export, Transform-Steuerung, Thumbnail-Aufnahmen, IndexedDB-/Host-Kommunikation, CMO-Vorschau sowie Geometriezeichnen und Extrusion. Das Hostpanel ist zusätzlich rund 970 Zeilen groß. Eine weitere ältere Datei liegt unter `vendor/assetlab3d/assetlab-lite.js`.

Der Neuaufbau vereinheitlicht die **gemeinsame Modell-I/O-Verantwortung**, ohne daraus wieder eine große Sammeldatei zu machen:

- ein versionierter GLB-I/O-Dienst übernimmt Dateiprüfung, Laden, benötigte Loader/Decoder und Export;
- Viewer, Asset-Editor und Planungsansichten verwenden denselben Modell-I/O-Vertrag;
- AssetLab-Oberfläche, Transform-Bedienung, Asset-Persistenz, CMO-Import und Geometrieerzeugung bleiben getrennte Verantwortlichkeiten;
- Projektasset-/Slot-Identitäten und Wiederherstellung nach Reload sind zu bewahren und ausdrücklich zu testen;
- bestehende Iframe-, IndexedDB- und Base64-Fallbacks werden bewertet, aber nicht ungeprüft übernommen.

Ob AssetLab als Iframe isoliert bleibt oder in den gemeinsamen Modulhost wechselt, ist eine offene Architekturentscheidung. Sie wird anhand von Fehlerisolation, Performance, iOS/Safari, Speicherverhalten und Wartbarkeit entschieden.

## 7. Übernahmeregel

Jeder Bestandsteil wird vor Übernahme einer Kategorie zugeordnet:

- **KEEP:** fachlich und technisch belegt; unverändert nutzbar;
- **PORT:** Verhalten oder Datenvertrag ist gut, Implementierung wird in die neue Grenze übertragen;
- **REWRITE:** fachlicher Bedarf ist gültig, vorhandene Implementierung ist nicht tragfähig;
- **REVIEW:** Belege oder Eigentümerschaft sind unklar; nichts entfernen und keine Ersatzautorität schaffen.

Grüne CI oder bestandene Text-/Importverträge allein belegen keine praktische Bedienbarkeit. Für den Kernablauf sind echte Browserabläufe mit Save→Reload erforderlich.

## 8. Abnahmegrundsatz

Der Neuaufbau ist erst einsatzbereit, wenn der vereinbarte End-to-End-Ablauf auf dem iPad quer (breite Layoutklasse) sowie auf iPad hochkant und iPhone hochkant (gemeinsame mobile Layoutklasse) nachgewiesen ist. iPhone quer ist zunächst ausgeschlossen. Ein Rechner ist kein verfügbares Testgerät und kein Abnahmekriterium. Datenverlust, irreführender Speicherstatus, falsche Koordinaten/Höhen, fehlende Objekte nach Reload oder blockierte Bedienung sind einsatzblockierend.

Jede Ansicht, jedes Fachmodul und jede Freischaltung verwendet dieselben Projekt- und Szenenautoritäten. Die endgültige Integration nach `main` erfolgt erst nach Gesamtverifikation, dokumentiertem Freeze und separater sicherer Integrationsprüfung.

## 9. Erweiterungsziele: Fördertechnik, Bibliotheken und Ausgaben

Fördertechnik/Anlagen ist ein späteres eigenständiges Fachmodul auf der gemeinsamen Workarea. Es muss Baugruppen und Komponenten in 2D platzieren und über Höhen-/Layerdaten in späteren 3D-Ansichten korrekt wiederfinden lassen. Mechanische Eigenschaften und Ausgaben gehören dem Fördertechnik-/Mechanikbereich; elektrische Anschlüsse und Kabelwege bleiben optionalen Elektrikverträgen zugeordnet. Eine alte Projektdatenübernahme ist davon unabhängig und nicht Teil des Greenfield-Vertrags.

Die Asset-Verwaltung unterscheidet zwei Quellen: die projektinterne Bibliothek für projektspezifische bzw. im Projekt verwendete Assets und die globale Bibliothek für wiederverwendbare Assets. Asset-Identität, Version, Herkunft und Lizenz müssen nachvollziehbar sein. Ein Projekt muss die tatsächlich verwendete Asset-Version stabil referenzieren oder als Projekt-Snapshot sichern; eine globale Katalogänderung darf das Projekt nicht unbemerkt verändern. AssetLab bearbeitet und prüft Assets, es ist weder die Bibliothek noch eine parallele Persistenzautorität.

V1 bleibt lokal und verwendet Projektdatei-Export/Import. Die Schnittstelle für globale Assets wird so entworfen, dass später eine lokale oder cloudbasierte Quelle angebunden werden kann. Cloud-Speicherung, Multi-Device-Synchronisation und Konfliktauflösung sind ausdrücklich spätere Entscheidungen und dürfen keine Voraussetzung des Offline-/lokalen Kernablaufs werden.

Ausgaben werden als lesende, nachvollziehbare Projektionen der Fachmodule umgesetzt. Geplante Varianten umfassen Stücklisten, Materiallisten und Zeichnungsansichten; Mengen, Einheiten, Asset-/Artikelidentität und Herkunft müssen auf ihre Quelldaten zurückführbar sein. Exportformate und Vorlagen werden je Paket festgelegt; ein Exportmodul schreibt keine eigene konkurrierende Projektdatenquelle.

## 10. Geräteklassen

Es gibt zwei responsive Layoutsysteme: breit (Desktop-Zielklasse, reale Prüfung auf iPad quer) und hochkant (gemeinsame mobile Layoutklasse, Prüfung auf iPad hochkant und iPhone hochkant). iPhone quer ist zunächst nicht im Scope. Ein Rechner ist kein verfügbares reales Testgerät.


## 11. Simulation als späterer Facharbeitsbereich

Die Anwendung unterscheidet drei Tätigkeiten auf derselben Projekt-/Anlagenbasis: **Planen**, **Simulieren** und **Analysieren**. Simulation ist ein eigenständiges Modul bzw. Arbeitsbereich, keine zweite Szene und kein separates Projekt. Sie baut erst auf einer stabilen Projekt-, Geometrie-, Baugruppen-, Port- und Modulbasis auf und gehört nicht in den ersten einsatzfähigen Kamera-/Baustellenplaner-V1.

Die persistente Simulationsdefinition umfasst deklarierte Ein-/Ausgänge, Verhalten/Regeln und Parameter. Ein separater Runtime-State enthält ausschließlich den aktuellen Lauf, z. B. Start/Pause, Positionen, Geschwindigkeit, Signal- und Sensor-/Aktorzustände sowie Fehler. Laufzeitwerte werden nicht automatisch als Planungsdefinition gespeichert. Eine Analysefunktion liest gespeicherte Laufdaten bzw. definierte Ergebnisse über einen eigenen Vertrag.

Das Simulationsmodul soll über stabile Ereignis-/Schnittstellenverträge mit Fördertechnik- und weiteren Fachmodulen kommunizieren. Die Geometrie kommt aus der gemeinsamen Szene; Bewegungsachsen, Ports und Verhalten werden fachlich zugeordnet. Eine spätere virtuelle Inbetriebnahme oder SPS-Anbindung braucht ein eigenes Gate und wird nicht als Ersatz für TIA oder eine reale Steuerung vorausgesetzt.
