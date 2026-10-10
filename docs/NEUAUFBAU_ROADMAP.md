# Neuaufbau – Roadmap

Status: Greenfield-Neuaufbau; Paket D auf `dev/planner-neuaufbau` umgesetzt, verifiziert und nach Nutzerpruefung frozen; `main` bleibt unveraendert
Stand: 10.10.2026
Autoritative Neuaufbau-Basis: `be0061f6cca67c30adee8b476e8ea0265707ab18`
Architektur: [`NEUAUFBAU_ARCHITEKTUR.md`](./NEUAUFBAU_ARCHITEKTUR.md)  
Wireframe: [`NEUAUFBAU_WIREFRAME_V0.md`](./NEUAUFBAU_WIREFRAME_V0.md)  
Umsetzungs-Blueprint: [`NEUAUFBAU_UMSETZUNGS_BLUEPRINT_V1.md`](./NEUAUFBAU_UMSETZUNGS_BLUEPRINT_V1.md)  
Modulweiter Wireframe: [`NEUAUFBAU_WIREFRAME_MODULE_V1.md`](./NEUAUFBAU_WIREFRAME_MODULE_V1.md)  
Gate-1-Entscheidungsprotokoll: [`NEUAUFBAU_GATE1_DECISION_RECORD.md`](./NEUAUFBAU_GATE1_DECISION_RECORD.md)

Diese Roadmap steuert einen echten Greenfield-Neuaufbau auf dem separaten Entwicklungsbranch. Paket A ist separat für Gate 2 autorisiert und wird dort umgesetzt; `main` bleibt bis zur Gesamtabnahme unverändert. Der neue Planer muss vorhandene Main-Projekte in V1 nicht weiterführen oder importieren. Es gibt zunächst keine Abwärtskompatibilitätsverpflichtung; ein späterer Import wäre ein separat begründetes Paket. Bestehender Code wird nicht pauschal kopiert oder repariert.

Die Oberfläche soll für den Nutzer leicht und übersichtlich wirken. Wir bauen nur Funktionen, die für den freigegebenen Praxiseinsatz gebraucht werden. Interne Modularität darf nicht zu komplizierter Bedienung oder vorsorglich eingebautem Funktionsballast führen.

## Paket-A-Stand am 08.10.2026

- Stabiler Produktstand: `main = be0061f6cca67c30adee8b476e8ea0265707ab18` (unverändert).
- Neuaufbau-Basis für Paket A: `dev/planner-neuaufbau` ab `81a73ff9d33310ddda3cfb915adb263a9a5714ce`.
- Paket A liegt isoliert unter `planner-v2/`: versionierter Projektvertrag, lokaler IndexedDB-Speicher, Projektdatei-Transfer und Grundrisskalibrierung.
- Die fünf Paket-A-Playwright-Specs (acht Browserfälle) laufen über `.github/workflows/planner-v2-paket-a.yml`, unabhängig von der bestehenden Product CI. Lauf #37810463781 bestand für den Paket-A-Quellstand `e6c323154401bb7e3bb06b83f813f2a58bf2c396`: Syntax, Importgraph und 8/8 Browserfälle. Dokumentationsänderungen danach verändern den geprüften Paket-A-Quellstand nicht.
- Reale Safari-Prüfungen stehen für iPad quer, iPad hochkant und iPhone hochkant aus. Paket A allein deckt den späteren Kamera-/Elektrikablauf nicht ab und ist nicht einsatzbereit.
- Der nächste Schritt nach grünem Paket-A-Workflow sind Gerätetest und Completion/Evidence/Freeze für Paket A. Danach beginnt Paket B mit eigener Scope-Freigabe; `main` bleibt unangetastet.

## Ziel für den ersten einsatzfähigen Stand

Der erste einsatzfähige Gesamtstand deckt den Kamera-Installationsablauf ab: Grundriss kalibrieren, 2D-Bereich festlegen, Kameraobjekte samt FOV erfassen, elektrische Kabelwege und Anschlusspunkte dokumentieren, Montage abschließen, Messgerätwert/Ist-Länge/Prüfergebnis eintragen, speichern und nach Reload vollständig wiederfinden. Der Szenenvertrag enthält von Anfang an räumliche Koordinaten, damit spätere Ansichten dieselben Objekte zeigen.

Mechanik, vollständige Material-/Bestellausgaben, EPLAN-Import, AssetLab und 3D-Ansichten werden als getrennte spätere Pakete priorisiert. Ein fachlicher Funktionsblock gilt nicht als abgeschlossen, wenn seine Objekte nur im Objektbaum oder nur vor einem Reload im Plan sichtbar sind.

## Etappen

### R0 – Architektur und Produktgrenzen

**Ergebnis:** neue Architektur- und Roadmap-Dokumente, Wireframe V0 für den Grundablauf sowie ein modulweiter Wireframe V1 mit Menüs und Hauptansichten aller vorgesehenen Bereiche in zwei Layoutsystemen (Desktop/Tablet quer und Hochkant). Begriffe Baustellenbereich, räumliche Bezugsebenen, Sichtlayer, Fachmodule und Entitlements sind festgelegt bzw. im Wireframe abgebildet.

**Prüfung:** Dokumente widersprechen weder dem gemeinsamen Raum-/Projektmodell noch der Vorgabe, dass deaktivierte Fachmodule Projektdaten erhalten.

**Status:** Planung dokumentiert; keine Produktcode-Implementation.

### R1 – Datenvertrag und tragfähige Basis

**Ergebnis:** eindeutige Projekt-/Asset-/Szenenautoritäten, Einheiten, Koordinatenursprung, Bereichsgrenzen, Höhenebenen, fachliche Sichtlayer, Modulmanifest und Persistenz- und Versionsverhalten für das neue Projektformat.

**Entscheidungspunkte vor Implementation:**

- ganzer Hallenbereich gegen Hallenausschnitt und Koordinatenbezug;
- Meter-/Millimeter-Konvention in Oberfläche, Projektspeicher und Geometrie;
- Verhältnis zwischen Projekt, Baustellenbereich, optionaler Hallengeometrie und Szene;
- Höhenebenen gegen Sichtlayer;
- Asset- und Slot-Identität im neuen Projektformat; Altprojekt-Import ist nicht Bestandteil von V1;
- Modulabhängigkeiten und Entitlement- statt UI-only-Freischaltung.

**Austritt:** Schema-/Vertragsprüfungen und Save→Reload-Tests für leere, vollständige und teilweise Projekte des neuen Formats bestehen. Altprojekt-Migration ist ausdrücklich nicht Teil dieses Austritts.

### R2 – Neue 2D-Workarea

**Ergebnis:** eigenständige neue Workarea-Shell mit maßstäblichem Plan, Zoom/Pan, Bereichsgrenze, Höhenebenenauswahl, Sichtlayern, Objektbaum, Eigenschaften und einer kleinen Werkzeugbasis.

**Erster vertikaler Ablauf:** Projekt öffnen → Bereich wählen → Objekt auf ausgewählter Höhe platzieren → auswählen/verschieben → speichern → Reload → dieselbe Position, Ebene und Auswahlzustand fachlich korrekt wiederfinden.

**Austritt:** Browser-E2E für den ganzen Ablauf; keine direkte Abhängigkeit vom alten `WorkareaPanel.base.js`; keine zweite Szene oder Persistenzautorität.

### R3 – Elektrik-Modul

**Ergebnis:** getrennt registriertes Elektrikpaket für Kabel-ID, tatsächliche Routen-/Trassengeometrie, Start-/Zielpunkte, Anschlussstatus, geplante Länge bei kalibriertem Plan sowie dokumentierte manuelle Ist-Messung.

**Austritt:** fehlende/ungültige Routen werden klar angezeigt; Speichern/Reload erhält Geometrie, Zuordnung und Messprotokoll. EPLAN-Import und vollständige Materialausgabe sind nicht Teil dieses Pakets.

### R4 – Kamera-Modul und Installationsablauf

**Ergebnis:** Kameraobjekte mit stabiler ID, Position, Drehung, horizontalem FOV, Reichweite, Montageangaben und Referenz auf Elektrik-Kabeldatensatz. Die Beispielzeichnung wird nach manueller Prüfung als 19 einzelne Kameras erfasst. Keine unbestätigte Trasse wird angezeigt.

**Austritt:** Kamera auswählen/platzieren, FOV prüfen, Kabel zuordnen, Montage und Messung erfassen, speichern/neu laden; iPad quer und iPhone hochkant.

### R5 – V1-Praxistauglichkeits-Abnahme und Freeze

**Ergebnis:** der vollständige Kamera-Installationsablauf wird mit einem kalibrierten, repräsentativen Projekt auf echten Geräten geprüft. Es gibt keinen vorausgesetzten Rechner-Test.

**Mindestnachweis:**

- Projekt anlegen/öffnen, Plan kalibrieren, Bereich und Höhenebene festlegen;
- Kameras und Kabelweg bearbeiten, Montage und Messwert speichern;
- Speichern, neu laden und Plan, Objektbaum, Kabel- und Messdaten vergleichen;
- iPad quer als breite Layoutklasse; iPad hochkant und iPhone hochkant als gemeinsame mobile Layoutklasse;
- keine einsatzblockierenden Fehler und Exact-Head-Product-CI.

**Integration:** erst nach dokumentiertem PASS / 0 einsatzblockierenden Fehlern, Completion/Evidence/Freeze und separater Prüfung einer linearen sicheren Integration.

### R6 – Mechanik-Modul

**Ergebnis:** Mechanikwerkzeuge und mechanische Objekte separat registrieren; sie nutzen dieselben Koordinaten-, Ebenen-, Auswahl- und Speicherverträge. Es besteht keine Abhängigkeit zum Elektrikpaket.

**Austritt:** Mechanikablauf funktioniert bei deaktiviertem Elektrikmodul; deaktivierte Elektrodaten bleiben erhalten.

### R7 – Material und Baustellenausgaben

**Ergebnis:** belastbare Materialzuordnung und Ausgaben mit Herkunft, Menge, Einheit und verifizierter Materialidentität. Nicht bestätigte Hersteller-/Artikelangaben bleiben offen. EPLAN-Zuordnung folgt nur bei bestätigtem Bedarf.

### R8 – Asset-Pipeline und räumliche Ansichten

**Ergebnis:** gemeinsame Modell-I/O-Grenze, GLB/GLTF-Vorschau/-Export, AssetLab und spätere 3D-/Seiten-/Schnittansichten auf derselben Szenenautorität.

**Austritt:** reale Modellfixtures laden, Fehler sauber melden und bewusst gespeicherte Transformationen nach Reload erhalten; 2D und 3D zeigen dasselbe Projekt.

### R9 – Kundenpakete und spätere Administration

**Ergebnis:** Entitlement-Matrix und Modulabhängigkeiten bleiben von Rollen/Rechten und lokaler Sichtbarkeit getrennt. Technische Modulfreischaltung wird getestet; Kaufabwicklung/Lizenzbackend benötigen ein separates Produkt-Gate.

Die Entscheidung zu V1-Ziel, modularen Grenzen, Raum-/Maßstabsvertrag, Persistenz und realen Testgeräten ist in [Gate 1](./NEUAUFBAU_GATE1_DECISION_RECORD.md) dokumentiert. Paket D ist auf dem Entwicklungsbranch abgeschlossen und in [`NEUAUFBAU_PAKET_D_COMPLETION_EVIDENCE_FREEZE.md`](./NEUAUFBAU_PAKET_D_COMPLETION_EVIDENCE_FREEZE.md) frozen. Alle weiteren Pakete benötigen weiterhin eine eigene Scope- und Implementierungsfreigabe.

## Neue Folgepunkte aus Paket-D-Praxistest

Diese Punkte wurden beim Test des deployten Paket-D-Stands sichtbar und werden separat priorisiert. Sie sind nicht Bestandteil des Paket-D-Freeze:

1. **Hallenabschnitte / Arbeitsbereiche / Präzisionszoom**
   Sehr große Hallen wie die Musterhalle brauchen später einen Weg, in fachlichen Abschnitten oder Arbeitsausschnitten zu arbeiten. Das Gesamtprojekt und der Gesamtkoordinatenbezug sollen erhalten bleiben, aber die Bedienung muss genaues Positionieren, Verschieben und Prüfen kleiner Objekte in großen Layouts ermöglichen.

2. **Menüstruktur / Objektbaum / Mockup**
   Mit Trassen, Kabeln, Kameras, Messungen und weiteren Modulen wird die Hauptoberfläche spürbar voller. Dafür ist ein eigenes UX-/Mockup-Paket vorzusehen, das Menügruppen, Objektbaum, Eigenschaften und mobile Layouts neu ordnet.

## Paket E - Arbeitsbereiche, Praezisionszoom und Menuestruktur

Paket E definiert den naechsten Praxistauglichkeitsblock nach Paket D. Ziel ist, grosse Hallen weiterhin als Gesamtprojekt zu halten, aber bearbeitbare Arbeitsbereiche/Ausschnitte fuer genaues Positionieren bereitzustellen. Objekte bleiben im Gesamtkoordinatensystem gespeichert.

Der Paket-E-Gate-1-Scope ist in [`NEUAUFBAU_PAKET_E_SCOPE_AND_STATUS.md`](./NEUAUFBAU_PAKET_E_SCOPE_AND_STATUS.md) dokumentiert. Gate 2 bleibt separat und ist noch nicht umgesetzt.

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

## Ergänzte spätere Produktpakete

Der Zielplan umfasst zusätzlich die künftige Unterstützung von Fördertechnik-Projekten, zwei Asset-Bibliotheken und mehrere Ausgabevarianten. Diese Ziele sind keine Vorziehung in den Kamera-V1-Scope:

1. Projektinterne und globale Asset-Bibliothek mit stabilen Versionen, Herkunft/Lizenz sowie einem lokalen V1-Vertrag, der eine Cloud-Quelle später zulässt.
2. Fördertechnik/Anlagen als separates Fachpaket für Baugruppen und Komponenten; mechanische Funktionen bleiben ohne Elektrik verwendbar, Elektrikanschlüsse sind optional gekoppelt.
3. Ausgabe-Pakete für Stücklisten, Materiallisten und Zeichnungsansichten. Jedes Paket bekommt konkrete Formate/Vorlagen, Herkunftsnachweise und eigene Abnahme.
4. Gemeinsame Modell-I/O/AssetLab nutzt dieselben Asset- und Bibliotheksverträge; Cloudhosting/Synchronisation folgt nur nach einem separaten Architektur- und Produktentscheid.

Die Pakete werden nach stabilem V1-Kern sequenziert und jeweils mit Save→Reload sowie realen Zielgeräten geprüft. Abnahme-Geräteklassen sind iPad quer für breit und iPad hochkant plus iPhone hochkant für dasselbe Hochkantlayout; iPhone quer ist zunächst ausgeschlossen.


## Simulation in der späteren Roadmap

Nach stabiler Planung, Fördertechnik-Baugruppen und Daten-/Portverträgen ist **Simulation** als eigener Arbeitsbereich zwischen Planung und Analyse einzuplanen. Die gemeinsame Anlage bleibt dasselbe Projekt. Ein eigenes Simulationspaket legt anschließend schrittweise Verhalten, Signale, Bewegungen, Sensor-/Aktorzustände, Start/Pause/Reset und Ergebnisanalyse fest.

Voraussetzung sind belastbare Objekt-/Baugruppenidentitäten, Anschlusspunkte und versionierte Simulationsverträge. Persistente Definition (Eingänge, Ausgänge, Verhalten, Parameter) und flüchtiger Laufzeitzustand (aktuelle Bewegung/Signale/Sensoren) werden getrennt. Analyse bleibt eine separate lesende Auswertung. Keine Implementierung im Kamera-V1; SPS-/TIA-Anbindung oder Ersatzfunktion ist kein stillschweigender Bestandteil. Eigener Paket-Scope und eigene Prüfungen vor Umsetzung.


## Zeichnungsmodul in der Roadmap

Ein eigenständiges Zeichnungsmodul ist als späteres Paket vorgesehen. Es baut auf dem stabilen Projekt-/Geometrie- und Höhenebenenvertrag auf und liefert maßstäbliche Grundrisse, Ansichten sowie später Schnitte mit Bemaßungen, Beschriftungen und Zeichnungsblättern. Es hält keine zweite Geometrieautorität.

Stücklisten, Materiallisten und Zeichnungsblätter werden als getrennte Ausgabearten behandelt. Format, Vorlagen, Revisions-/Freigabeablauf und Aktualisierung nach Modelländerungen erhalten eine eigene Definition und Abnahme. Das ist mehr als der bereits erwähnte Export von Ansichtsdateien, bleibt aber außerhalb des Kamera-V1 und wird separat priorisiert und gegatet.
