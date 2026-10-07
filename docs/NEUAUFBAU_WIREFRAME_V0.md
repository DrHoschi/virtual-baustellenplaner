# Neuaufbau – Wireframe V0

Stand: 07.10.2026  
Zielbranch: `dev/planner-neuaufbau`  
Status: Produktablauf und Layoutentwurf; keine Produktcode-Implementation.

## Zweck und Geräteklassen

Der Wireframe definiert zwei responsive Grundlayouts:

| Layout | Geräte | Arbeitsannahme |
|---|---|---|
| Breit | Desktop und Tablet quer | Gemeinsame Informationsarchitektur, Werkzeugleisten und Arbeitsbereich |
| Hochkant | iPhone und iPad hochkant | Gemeinsamer, touch-orientierter Ablauf; iPhone wird zunächst nur hochkant ausgelegt |

Die konkreten Breakpoints und Mindestgrößen werden später technisch geprüft. Das sind zwei Layoutsysteme, nicht zwei verschiedene Produkte. Funktionen und Datenverträge bleiben gleich; die Darstellung ordnet Navigation, Werkzeuge und Eigenschaften passend zur verfügbaren Fläche an.

## Durchgängiger Nutzungsablauf

1. **Projektübersicht öffnen:** vorhandenes Projekt suchen/öffnen oder ein neues anlegen. Der Einstieg zeigt zuletzt verwendete Projekte und einen klaren „Neues Projekt“-Weg.
2. **Projekt vorbereiten:** Name und grundlegende Projektangaben festlegen. Ein bestehendes Projekt kann direkt fortgesetzt werden.
3. **Baustellenbereich festlegen:** ganze Halle oder abgegrenzten Hallenausschnitt wählen; später auch eine freie Fläche. Ein Hallenmodell ist optional. Bereich und Hallenreferenz dürfen nicht verwechselt werden.
4. **Planung öffnen:** maßstäbliche 2D-Topansicht mit sichtbarer Bereichsgrenze und aktiver Höhenebene. Erst danach werden fachliche Werkzeuge geladen.
5. **Planen und sichern:** Objekt wählen/platzieren, Höhe und Sicht-/Fachlayer getrennt steuern, Eigenschaften bearbeiten und bewusst speichern. Speichern/Status bleibt auch bei schmaler Ansicht auffindbar.
6. **Später fortsetzen:** Projekt erneut öffnen und dieselbe Bereichsgeometrie, Objekte, Höhen und Layer wiederfinden. Zukünftige 3D-/Ansichts-/Schnittansichten verwenden dieselben räumlichen Daten.

Authentifizierung, Offline-Verhalten und endgültige Speicher-/Autosave-Strategie sind offene Produkt- und Datenvertragsentscheidungen; der Wireframe behauptet hierzu noch kein Verhalten.

## Layoutregeln

### Breit: Desktop und Tablet quer

- Kopfzeile: Produkt-/Projektkontext, Rückweg zur Projektübersicht, Speicherstatus und zentrale Aktionen.
- Projektübersicht: Projektliste und Neuanlage nebeneinander; auf Tablet quer darf die Liste schmaler werden.
- Projektvorbereitung: Projektangaben und räumlicher Bereich in einer geführten Seite mit klarer Vorschau.
- Workarea: Plan als größter Bereich; Werkzeugleiste dauerhaft erreichbar; Objektbaum und Eigenschaften als einklappbare Seitenbereiche.
- Höhenebene ist als aktive Planungssteuerung sichtbar. Fach-/Sichtlayer sind ein separates Panel/Schalterfeld.
- Modulstart erfolgt aus einem einheitlichen Modulmenü. Module dürfen Kernnavigation und gemeinsame Projekt-/Raumdaten nicht duplizieren.

### Hochkant: iPhone und iPad hochkant

- Einspaltiger Ablauf mit klarer Zurück-/Weiter-Navigation und sichtbarem Projektnamen.
- Projektliste als Karten; Projektaktionen sind pro Karte direkt erreichbar.
- Bereichsauswahl als eigene Schrittseite mit gut bedienbarer Vorschau und expliziter Wahl „Ganze Halle“ / „Ausschnitt“.
- Workarea nutzt die Höhe des Displays. Die 2D-Planfläche erhält Vorrang; Werkzeuge, Ebenen, Objektbaum und Eigenschaften öffnen kontextuell als Seiten-/Bottom-Sheets.
- Aktive Höhe und Speichern müssen im Arbeitsmodus jederzeit sichtbar oder mit einem einzigen Tap erreichbar sein.
- Keine Desktop-Sidebars, die nur zusammengeschoben werden. Für Touch wird die Bedienfolge neu angeordnet, die Fachlogik bleibt identisch.

## Bildtafeln

- [Breites Layout – Desktop / Tablet quer](wireframes/neuaufbau-breit.svg)
- [Hochkantlayout – iPhone / iPad hochkant](wireframes/neuaufbau-hochkant.svg)

Die Bildtafeln zeigen je drei Zustände desselben Produkts: Projektübersicht, Bereich festlegen und Workarea. Sie sind bewusst Low-Fidelity und treffen noch keine verbindliche Farb-/Brandingentscheidung.

## Workarea-Grundstruktur

| Bereich | Aufgabe |
|---|---|
| Kopf / Projektkontext | Projekt verlassen, Titel, Speicherstatus und globale Aktionen |
| 2D-Viewport | Maßstäbliche Topansicht; Pan/Zoom und geometrische Bereichsgrenze |
| Werkzeugzugriff | Auswahl, Platzieren, Zeichnen/Messen; später nach Modul erweiterbar |
| Höhenebene | Räumliche Ebene für Platzierung und Bearbeitung |
| Sicht-/Fachlayer | Sichtbarkeit/Gruppierung unabhängig von der Höhe |
| Objektbaum | Vorhandene Planungsobjekte finden und auswählen |
| Eigenschaften | Ausgewähltes Objekt bearbeiten |
| Modulmenü | Nur für den Nutzer verfügbare Fachmodule anbieten |

Die Ansicht ist 2D, das Projektmodell bleibt räumlich: Position/Ausrichtung enthalten eine Höhe. Das ist Voraussetzung für spätere 3D-, Front-/Seiten- und Schnittansichten, nicht bereits deren Implementierung.

## Offene Entscheidungen vor dem Bau

- Welche Projektfelder sind für ein minimales neues Projekt zwingend?
- Wie werden Hallenreferenz, Baustellenbereich und ein Ausschnitt geometrisch beschrieben?
- Welche Einheiten sieht und bearbeitet der Nutzer; welche werden im Projektvertrag gespeichert?
- Welche Höhenebenen sind Standard und wie können Nutzer sie ergänzen?
- Welche Minimalwerkzeuge gehören in die gemeinsame Basis?
- Welche ersten Kundenpakete/Rollen werden durch Mechanik- und Elektrikmodule abgebildet?
- Welche Speicheraktion und welcher Wiederherstellungsweg gelten verbindlich?
- Welche konkreten Viewport-Breakpoints und iOS-Safari-Grenzen bestehen?

Diese Punkte gehören in Gate 1/den Datenvertrag. Der Wireframe ist keine Freigabe, vor deren Klärung die Produktfunktion zu implementieren.

## Nächste Prüfschritte

1. Wireframe fachlich gegen die Projektabläufe und die räumliche Architektur abstimmen.
2. Flow anhand konkreter Fälle durchspielen: neues Projekt, Projekt fortsetzen, ganze Halle, Hallenausschnitt, deaktiviertes Fachmodul.
3. Bedienbarkeit auf den Zielklassen prüfen: Desktop, Tablet quer, iPad hochkant und iPhone hochkant.
4. Erst danach Datenvertrag und Implementierungsumfang für den ersten vertikalen Ablauf festlegen.
5. Implementierung bleibt auf `dev/planner-neuaufbau`; Integration nach `main` erst nach bestandener Ende-zu-Ende-Praxisprüfung.

## Abgrenzung zum angehängten Zieldokument

Das Dokument vom 01.10.2026 wird als Bestandshistorie und Anforderungshinweis berücksichtigt. Seine Vorschläge zur Bereinigung, Wiederverwendung oder Reparatur alter Module sind keine pauschale Übernahmefreigabe. Für den Neuaufbau gilt die aktuelle Zielarchitektur: neu schneiden, bewährte Teile gezielt nachweisen, Altcode nicht zur Voraussetzung der neuen Workarea machen.
