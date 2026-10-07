# Neuaufbau – Roadmap

Status: Gate‑1 Planungsroadmap für `dev/planner-neuaufbau`
Stand: 07.10.2026
Autoritative Neuaufbau-Basis: `be0061f6cca67c30adee8b476e8ea0265707ab18`
Architektur: [`NEUAUFBAU_ARCHITEKTUR.md`](./NEUAUFBAU_ARCHITEKTUR.md)  
Wireframe: [`NEUAUFBAU_WIREFRAME_V0.md`](./NEUAUFBAU_WIREFRAME_V0.md)

Diese Roadmap steuert den Neuaufbau auf dem separaten Entwicklungsbranch. `main` bleibt der unveränderte Rückfall- und Referenzstand, bis die Gesamtabnahme bestanden ist. Bestehender Code wird nicht pauschal kopiert oder repariert; Übernahmen folgen der KEEP / PORT / REWRITE / REVIEW-Regel der Architektur.

## Ziel für den ersten einsatzfähigen Stand

Ein Nutzer kann ein Projekt öffnen, einen ganzen Hallenbereich oder einen Hallenausschnitt als maßstäblichen Baustellenbereich festlegen, in 2D planen, Objekte auf einer gewählten Höhenebene platzieren, speichern und nach erneutem Öffnen unverändert weiterarbeiten. Der Szenenvertrag enthält von Anfang an räumliche Koordinaten, damit zusätzliche Ansichten später dieselben Objekte zeigen.

Der erste einsatzfähige Gesamtstand wird anschließend um die tatsächlich benötigten Mechanik- und Elektrikabläufe, Materialausgabe und 3D-Ansichten erweitert. Ein fachlicher Funktionsblock gilt nicht als abgeschlossen, wenn seine Objekte nur im Objektbaum oder nur vor einem Reload im Viewer sichtbar sind.

## Etappen

### R0 – Architektur und Produktgrenzen

**Ergebnis:** neue Architektur- und Roadmap-Dokumente sowie Wireframe V0 für den Einstieg bis zur Workarea in zwei Layoutsystemen (Desktop/Tablet quer und Hochkant). Begriffe Baustellenbereich, räumliche Bezugsebenen, Sichtlayer, Fachmodule und Entitlements sind festgelegt bzw. im Wireframe abgebildet.

**Prüfung:** Dokumente widersprechen weder dem gemeinsamen Raum-/Projektmodell noch der Vorgabe, dass deaktivierte Fachmodule Projektdaten erhalten.

**Status:** Planung dokumentiert; keine Produktcode-Implementation.

### R1 – Datenvertrag und tragfähige Basis

**Ergebnis:** eindeutige Projekt-/Asset-/Szenenautoritäten, Einheiten, Koordinatenursprung, Bereichsgrenzen, Höhenebenen, fachliche Sichtlayer, Modulmanifest und Persistenz-/Migrationsverhalten.

**Entscheidungspunkte vor Implementation:**

- ganzer Hallenbereich gegen Hallenausschnitt und Koordinatenbezug;
- Meter-/Millimeter-Konvention in Oberfläche, Projektspeicher und Geometrie;
- Verhältnis zwischen Projekt, Baustellenbereich, optionaler Hallengeometrie und Szene;
- Höhenebenen gegen Sichtlayer;
- Asset- und Slot-Identität sowie Umgang mit bestehenden SaveGames;
- Modulabhängigkeiten und Entitlement- statt UI-only-Freischaltung.

**Austritt:** Schema-/Vertragsprüfungen, Migration alter gültiger Daten und Save→Reload-Tests für leere, vollständige und teilweise Projekte bestehen.

### R2 – Neue 2D-Workarea

**Ergebnis:** eigenständige neue Workarea-Shell mit maßstäblichem Plan, Zoom/Pan, Bereichsgrenze, Höhenebenenauswahl, Sichtlayern, Objektbaum, Eigenschaften und einer kleinen Werkzeugbasis.

**Erster vertikaler Ablauf:** Projekt öffnen → Bereich wählen → Objekt auf ausgewählter Höhe platzieren → auswählen/verschieben → speichern → Reload → dieselbe Position, Ebene und Auswahlzustand fachlich korrekt wiederfinden.

**Austritt:** Browser-E2E für den ganzen Ablauf; keine direkte Abhängigkeit vom alten `WorkareaPanel.base.js`; keine zweite Szene oder Persistenzautorität.

### R3 – Mechanik-Modul

**Ergebnis:** Mechanikwerkzeuge und mechanische Objekte werden separat in die neue Workarea registriert. Asset-/Baugruppenplatzierung nutzt dieselben Koordinaten, Ebenen, Auswahl- und Speicherregeln wie der Kern.

**Austritt:** Mechanikablauf funktioniert bei deaktiviertem Elektrikmodul; ein Projekt mit vorhandenen Elektrodaten verliert diese Daten beim Öffnen nicht.

### R4 – Gemeinsame Modell-I/O und AssetLab

**Ergebnis:** GLB-Laden/Export und benötigte Decoder sind als klarer, wiederverwendbarer Vertrag verfügbar. AssetLab wird nach geprüften Verantwortlichkeiten getrennt: Modellvorschau/Transformation, Persistenz, CMO-Import und Geometrieerzeugung.

**Austritt:** geprüfter GLB-Import, Transformation, Speichern/Export und Wiederherstellung aus dem Asset-Slot; Import-/Exportfehler sind sichtbar und führen nicht zu falschem Speicherstatus.

**Offene Umsetzung:** Iframe-Isolation gegen gemeinsame Shell anhand von iOS/Safari, Speichernutzung, Fehlerisolation und Wartbarkeit entscheiden.

### R5 – Gemeinsame räumliche Ansichten

**Ergebnis:** 3D-Ansicht aus dem bestehenden räumlichen Szenenmodell; später nach Bedarf Ansichten und Schnitte. 2D und 3D schreiben nicht getrennte Objektpositionen.

**Austritt:** Objekt auf Höhenebene in 2D platzieren, in 3D auf derselben Höhe sehen, Höhe ändern, speichern/reloaden und in beiden Ansichten konsistent wiederfinden.

### R6 – Elektrik-Modul

**Ergebnis:** Trassen, Kabel, EPLAN-Bezüge und elektrische Auswertungen als getrenntes Fachmodul. Bestehende fachliche Verträge werden einzeln geprüft und bei Bedarf portiert oder neu implementiert.

**Austritt:** Trasse zeichnen und bearbeiten, Kabel-/Routenbezug prüfen, Speichern/Reload, Längen und zugehörige Materialbedarfe fachlich nachvollziehen. Mechanik bleibt ohne Elektrik nutzbar.

### R7 – Material, Ausgabe und weitere Fachmodule

**Ergebnis:** Modulgrenzen für Materialzuordnung/-ausgabe, Kamera/Sicherheit, Analyse oder Simulation werden entsprechend Produktbedarf ergänzt. Camera Planning / FOV wird anhand seines bestehenden Scope neu gegen den Neuaufbau geprüft.

**Austritt:** jede Fachausgabe hat Herkunft, Menge, Einheit und Materialidentität; nicht verifizierte Hersteller-/Artikelangaben werden nicht erzeugt.

### R8 – Kundenpakete, Berechtigungen und Modulfreischaltung

**Ergebnis:** Entitlement-Matrix ordnet Pakete Modulen und Abhängigkeiten zu; Benutzerrollen regeln Aktionen separat. Lokale Modulaktivierung kann nur vorhandene Freischaltungen verbergen/anzeigen.

**Austritt:** Mechaniknutzer kann mit nur Mechanikpaket planen; Elektrikwerkzeuge werden nicht geladen/angeboten; gespeicherte Daten deaktivierter Module bleiben erhalten. Eine Kaufabwicklung oder ein Lizenzbackend wird separat autorisiert und ist kein Ersatz für die Architekturgrenze.

### R9 – Praxistauglichkeits-Abnahme und Integration

**Prüfgeräte:** Rechner, iPad und iPhone; für mobile Nutzung Hoch- und Querformat.

**Mindestnachweis:**

- End-to-End Projekt öffnen/anlegen, Bereich definieren, Ebene wählen, Objekt platzieren/bearbeiten;
- fachliche Hauptabläufe aller als V1 freigegebenen Module;
- Speichern, Seite neu laden und Projekt erneut öffnen;
- Objektbaum, Planansicht und 3D-Ansicht stimmen räumlich überein;
- Moduldeaktivierung erhält die nicht geladenen Fachdatensätze;
- keine einsatzblockierenden Fehler, belastbare Speicheranzeige und Exact-Head-Product-CI;
- manuelle Evidenz auf echten Mobilgeräten.

**Integration:** erst nach dokumentiertem PASS / 0 einsatzblockierenden Fehlern, Completion/Evidence/Freeze und separater Prüfung einer linearen sicheren Integration.

## Teststrategie über alle Etappen

1. Reine Modelltests für Koordinaten, Ebenen, Bereichsgrenzen, Normalisierung und Ableitungen.
2. Modulvertragstests für Abhängigkeiten, Aktivierung, Rechte und Datenaufbewahrung.
3. Browser-E2E für echte Nutzerabläufe statt nur Tests, die Quelltextzeichenfolgen suchen.
4. Save→Reload-Tests mit Projektfixtures: leer, teilweise aufgebaut, vollständig sowie Modul deaktiviert.
5. Regressionsprüfungen nur für übernommene fachliche Regeln.
6. Browser-E2E mit mobilen Viewports plus manuelle Tests auf echten Geräten.
7. Exact-Head-CI und dokumentierte Basisfehler getrennt von neuen Fehlern.

## Arbeitsregeln

- Jede Etappe wird vor Implementation gegen ihren exakten Branch-Head und Datenvertrag eingegrenzt.
- Keine Codeübernahme, kein Löschen und keine Schemaänderung ohne Klassifizierung und expliziten Scope.
- Ein Modul darf gemeinsame Projekt-/Szenendaten nicht duplizieren.
- Fehler oder ungeklärte Speicher-/Datenverträge stoppen die betroffene Etappe.
- `main` wird erst nach Gesamtfreigabe geändert; diese Roadmap autorisiert keine Code-Implementation.