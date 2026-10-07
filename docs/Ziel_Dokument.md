# Ziel-Dokument – Virtueller Baustellenplaner

Stand: 07.10.2026  
Autoritative Basis bei dieser Aktualisierung: `main = 643d31873ebb59b390635688599b8a37b080f93a`

## 1. Zweck dieses Dokuments

Dieses Dokument beschreibt das aktuelle Zielbild des Baustellenplaners, den bereits erreichten belastbaren Produktstand und die noch offenen Entwicklungsschwerpunkte. Es ersetzt den veralteten Neustart-/Bereinigungsplan vom Mai 2026.

Maßgeblich für den tatsächlichen Implementierungsstand ist immer das Repository auf dem aktuellen autoritativen `main`. Einzelne Completion-/Evidence-/Freeze-Dokumente bleiben die Detailautorität für bereits abgeschlossene Blöcke. Dieses Dokument ist die übergeordnete Produkt- und Priorisierungsorientierung und darf keinen abweichenden zweiten technischen Wahrheitsstand erzeugen.

## 2. Produktziel

Der Baustellenplaner soll ein praktisch einsetzbares Planungswerkzeug für reale Industriebaustellen werden. Schwerpunkt ist nicht eine allgemeine 3D-Demo, sondern ein durchgängiger Arbeitsablauf von der Hallen-/Anlagenplanung über Kabeltrassen und Materialbedarf bis zu belastbaren Baustellenunterlagen.

Der Zielablauf ist:

`Projekt/Halle → Planungsfläche → Anlagen/Objekte → Kabeltrassen → Klassifikation und Bearbeitung → Halterungen/Formteile/Zubehör → Materialzuordnung → Mengen-/Materialauswertung → Export/Baustellennutzung`

Desktop, iPad und iPhone müssen dabei dieselben fachlichen Autoritäten verwenden. Mobile Oberflächen dürfen kompakter sein, aber keine zweite Daten- oder Funktionslogik einführen.

## 3. Aktueller belastbarer Produktstand

### 3.1 Planungsfläche und responsive Workarea

Die Workarea ist als zentrale Planungsoberfläche etabliert. Objektbaum, Einfügen, Eigenschaften, kompakte mobile Bedienung und responsive Zustände wurden über die bisherigen UI-/R2-Blöcke stabilisiert.

Die Workarea wird schrittweise modularisiert, ohne fachliche Autoritäten zu verändern:

- BP-RF-01 hat die bestehende Kabeltrassen-Domäne aus `WorkareaPanel.base.js` in ein eigenes Workarea-Modul ausgelagert. `cable-tray.route` bleibt die fachliche Datenautorität.
- BP-RF-02 hat die bestehenden Workarea-Layout-Diagnostics in ein eigenes Modul ausgelagert. State- und Listener-Autoritäten bleiben unverändert.

Diese Refactorings sind Strukturarbeit, keine neue Produktfunktionalität.

### 3.2 Praktische Kabeltrassenplanung

Die frühere Zielaussage, reale Kabelwege seien noch nicht im Modell verankert, ist überholt.

Der aktuelle Produktstand besitzt eine fachliche Kabeltrassenkette mit unter anderem:

- manueller Trassengeometrie auf Basis von `cable-tray.route`;
- realer geometrischer Längenermittlung;
- Breiten-/Trassenklassifikation;
- Bearbeitung von Trassenpunkten und Endpunkten;
- Kabel-/Routenzuordnung und Kontinuitätslogik;
- Materialvorbereitung für Kabelrinnen und Zubehör;
- Halterungsplanung und Halterungstypen;
- Halterungsmaterial-Zusammensetzung;
- Formteil-/Junction-Autorität und Formteil-Materialvorbereitung;
- kombinierter Materialausgabe.

Die früher geplante reine Unterscheidung „200 mm gegen 100 mm“ ist damit nicht mehr das Produktziel. Breite und weitere fachliche Eigenschaften gehören zur Route und müssen erweiterbar bleiben.

### 3.3 Material- und Artikelkette

Die Materialkette ist inzwischen deutlich weiter als im alten Ziel-Dokument.

Vorhanden sind:

- fachliche Materialbedarfe aus der Trassenplanung;
- kombinierte Materialausgabe für Rinne, Zubehör, Halterungsmaterial und Formteile;
- globale Materialstammdaten-Autorität in `data/global-material-catalog.v1.json`;
- deterministische Material-/Artikelidentität und Mapping;
- responsive manuelle Materialzuordnung in der Workarea;
- article-aware Gesamtmaterialausgabe mit `Material_ID`, Hersteller und Artikelnummer;
- Validierung des globalen Materialkatalogs in der Produkt-CI;
- erster verifizierter realer Niedax-Artikelbestand.

Der erste verifizierte Artikelbestand umfasst derzeit bewusst nur drei reale Niedax-Artikel: RD 100, RD 200 und RW 60. Weitere Hersteller-/Artikelvarianten dürfen nicht geraten oder aus uneindeutigen Bezeichnungen automatisch erzeugt werden.

### 3.4 Persistenz und Datenautoritäten

Der heutige Stand wird nicht mehr nach dem alten Plan „alles neu in ein Clean-Projekt kopieren“ behandelt. Die bestehende Repository-Architektur und die über die BP-Blöcke festgelegten Autoritäten werden weiterentwickelt.

Wesentliche Grundsätze:

- keine zweite Datenautorität für dieselbe Fachinformation;
- bestehende Projekt-/Store-/Persistenzpfade werden wiederverwendet;
- `cable-tray.route` bleibt die Route-Autorität;
- Materialzuordnungen verwenden die bereits definierten Mapping-/Composition-Autoritäten;
- globale Hersteller-/Artikelstammdaten werden nicht als Kopie in jedes Projekt geschrieben;
- Save→Reload-Verhalten gehört bei persistenter Funktionalität zur Verification.

Schema-, Contract- oder Persistenzmigrationen sind keine beiläufigen Änderungen und benötigen weiterhin einen ausdrücklich bestimmten Scope.

### 3.5 Qualitätssicherung

Die Produktentwicklung besitzt inzwischen fokussierte BP-Vertragstests und eine Product-CI. Bekannte Baseline-Probleme und neu verursachte Regressionen müssen getrennt bewertet werden.

Ein PASS darf nur auf belastbarer Evidence beruhen. Historische Freeze-Heads und Completion-/Evidence-Dokumente bleiben gültig und werden durch dieses Ziel-Dokument nicht rückwirkend verändert.

## 4. Noch offene Produktziele

### 4.1 Kabeltrassen fachlich vervollständigen

Die vorhandene Trassenkette ist die Basis für die weitere Baustellentauglichkeit. Noch offene fachliche Erweiterungen sollen auf den bestehenden Autoritäten aufbauen und nicht als paralleles Trassensystem entstehen.

Ein bereits vorbereiteter nächster fachlicher Punkt ist die Belastungs-/Ausführungsklasse einer Kabelrinne (`tray.dutyClass`, BP-031). Sie soll die vorhandenen Eigenschaften wie Breite, Trassentyp und Route-Klasse ergänzen, nicht ersetzen. Vor einer Umsetzung ist der aktuelle `main` erneut als Ausgangs-Head zu verwenden; alte, noch nicht integrierte Arbeitsstände sind nicht automatisch autoritativ.

Danach sind weitere reale Baustellenmerkmale nach praktischem Nutzen zu priorisieren, beispielsweise technische Varianten, Deckel/Trennstege, belastbare Formteil- und Halterungszuordnung sowie die für Bestellung und Montage nötigen Eigenschaften.

### 4.2 Materialstammdaten ausbauen

Der globale Katalog soll kontrolliert mit real verifizierten Artikeln erweitert werden. Priorität haben die tatsächlich auf Baustellen verwendeten Kabelrinnen-, Deckel-, Trennsteg-, Halterungs- und Befestigungsartikel.

Offen bzw. ausdrücklich noch nicht pauschal gelöst sind unter anderem:

- schwere/begehbare Rinnenvarianten;
- schwere bzw. Anti-Rutsch-Deckel;
- höhere Trennstegvarianten;
- C-Schienen;
- weitere Niedax-Artikel;
- Hilti-/andere Herstellerartikel;
- technische Variantenauswahl.

Hersteller, Artikelnummern und technische Eigenschaften müssen verifiziert sein. Automatische Artikelwahl darf erst entstehen, wenn die dafür notwendigen technischen Eingaben und Entscheidungsregeln eindeutig modelliert sind.

### 4.3 Baustellentaugliche Ausgabe

Die bestehende kombinierte Materialausgabe und CSV-Kette soll zu einer praktisch nutzbaren Baustellen-/Bestellunterlage weiterentwickelt werden.

Ziel sind nachvollziehbare Positionen mit Herkunft, Menge, Einheit, Materialidentität und – soweit eindeutig zugeordnet – Hersteller/Artikelnummer. Spätere Erweiterungen können zusätzliche Exportformate, Bestell-/Verpackungslogik oder projektspezifische Listen umfassen, dürfen aber die Mengenautoritäten nicht duplizieren.

### 4.4 Reale Assets und Anlagenbezug

Die globale Asset-Bibliothek soll schrittweise mit den tatsächlich benötigten Anlagen-/Elektrokomponenten und vorhandenen GLB-Modellen wachsen. Artikelstammdaten, 3D-Assets und Projektinstanzen sind getrennte Verantwortlichkeiten und dürfen nicht zu einem einzigen unklaren Datenmodell vermischt werden.

Langfristiges Ziel bleibt, reale Anlagenkomponenten, Anschlusspunkte/Ports und Kabelwege so zu verbinden, dass geplante Wege und Materialbedarf aus dem Modell nachvollziehbar sind.

### 4.5 EPLAN-/Elektrodaten

EPLAN-Daten bleiben ein wichtiges späteres Integrationsziel, sind aber nicht die geometrische Wahrheitsquelle für reale Verlegewege.

Ziel ist eine kontrollierte Verknüpfung von Kabel-/Geräteidentität aus Elektroplanungsdaten mit Modellobjekten, Ports und geplanten Routen. EPLAN-Längen können Vergleichs- oder Ausgangsdaten sein; die tatsächliche geplante Weglänge wird aus der Baustellenplanung abgeleitet.

### 4.6 Camera Planning / FOV

Als kommender fachlicher Produktblock ist eine Kamera-Planungsdomäne für die Workarea vorgemerkt. Gate 1 – Analysis / Scope / Authorization wurde am 07.10.2026 read-only gegen `main = 643d31873ebb59b390635688599b8a37b080f93a` abgeschlossen. Noch ist keine Implementation autorisiert oder integriert.

Geplanter Kern für einen späteren Gate-2-Block:

- neues Scene-Objekt `camera.instance` innerhalb der bestehenden Workarea-Scene;
- Wiederverwendung der vorhandenen Positionierung, Selektion, Drag-, Rotations- und Persistenzmechanismen;
- dynamischer 2D-Sichtsektor/FOV aus Kameraposition, `rotDeg`, horizontalem Öffnungswinkel und Reichweite;
- Reichweite in Metern auf Basis der vorhandenen Millimeter-Weltkoordinaten;
- generische Kameratypen Thermal, Farbe und Bispektral;
- schnelle Presets beispielsweise 25°, 40°, 60° und 90°, ohne den manuellen FOV-Wert einzuschränken;
- Kamera-Properties für Typ, Bezeichnung, horizontalen FOV, Reichweite sowie vorbereitete Felder für Montagehöhe, vertikalen FOV und Neigung;
- Objektbaumdarstellung und vollständiges Save→Reload-Verhalten;
- eigene fachliche Modulgrenze, bevorzugt in `ui/workarea/workarea-camera-planning.v1.js`, statt neuen großen Kamera-Code direkt in `WorkareaPanel.base.js` einzubauen.

Das Kamerasymbol selbst kann später als Asset/PNG dargestellt werden. Sichtfeld, Winkel und Reichweite dürfen jedoch nicht fest in das PNG eingebrannt werden, sondern müssen als abgeleitete Geometrie von der Workarea erzeugt werden. Bispektrale Kameras sollen langfristig getrennte Thermal-/RGB-Kanäle mit eigenen technischen Parametern unterstützen.

Ausdrücklich nicht Bestandteil des ersten Camera-Planning-Blocks sind Herstellerbibliotheken, automatische Kamerapositionierung, Kollisions-/Sichtbehinderungsberechnung, Wand-/Raum-Clipping oder eine vollständige vertikale 3D-Abdeckungsberechnung. Diese Erweiterungen folgen erst auf einer stabilen V1-Basis.

Wichtiger technischer Hinweis aus Gate 1: Die aktuelle Scene-Persistenz erzeugt einen gefilterten Snapshot. Ein späterer Gate-2-Block muss den `camera`-Datenblock deshalb ausdrücklich in die bestehende Persistenz aufnehmen, damit die technischen Kameradaten nach Reload erhalten bleiben. Das FOV soll außerdem nicht die initialen Viewport-Bounds vergrößern und nicht selbst als riesige Hit-Test-Fläche wirken.

### 4.7 Architektur weiter entlasten

Die begonnenen BP-RF-Refactorings sollen bei echtem Nutzen fortgesetzt werden. Ziel ist eine wartbare Workarea mit klar getrennten Domänen, ohne Verhalten, State- oder Persistenzautoritäten unnötig neu zu erfinden.

Refactoring ist kein Selbstzweck. Produktblöcke mit unmittelbarem Baustellennutzen haben Vorrang, sofern die bestehende Struktur ihre sichere Umsetzung zulässt.

## 5. Nicht mehr gültige Ziele aus dem Mai-Stand

Folgende Aussagen des alten Ziel-Dokuments gelten nicht mehr als aktuelle Arbeitsanweisung:

- kein Neustart durch Kopieren in `projects/P-2026-0002-clean`;
- keine pauschale Version-1.0.0-Freigabe mit Stichtag 22.05.2026;
- keine Annahme, Kabeltrassen und geometrische Längenmessung müssten erst grundsätzlich erfunden werden;
- keine pauschale Festlegung auf eine einzige 200-/100-mm-VASS-Darstellung als vollständiges Trassenmodell;
- keine alte AssetLab-Rotations-/Thumbnail-Liste als aktuelle Haupt-Roadmap;
- keine pauschale Ablösung der heutigen Persistenz- und Workarea-Autoritäten durch die im Mai vorgeschlagene Clean-Struktur.

Historische Dokumentation darf als Entstehungsgeschichte erhalten bleiben, bestimmt aber nicht den heutigen Produktstand.

## 6. Entwicklungsworkflow ab 01.10.2026

Für zukünftige normale Produkt-, UI-, Test-, Dokumentations- und Refactoring-Blöcke gilt der konsolidierte Drei-Gate-Workflow aus `docs/DEVELOPMENT_WORKFLOW.md`:

1. **Gate 1 – Analysis / Scope / Authorization**
2. **Gate 2 – Implementation / Verification**
3. **Gate 3 – Completion / Evidence / Freeze / Integration**

Repository-Analysen desselben unveränderten Heads werden innerhalb eines Gates wiederverwendet. Künstliche Zwischenfreigaben sollen keine erneuten vollständigen Repository-Durchgänge auslösen.

Die Sicherheitsregeln bleiben bestehen: exakter Ausgangs-Head, Minimal-Scope, keine stillen Nebenänderungen, belastbare Verification und keine Integration bei Divergenz oder ungeklärten Fremdänderungen.

Bei Persistenz-/Schema-/Contract-Änderungen, zentralen State-/Autoritätsänderungen, großen Refactorings, divergierenden Branches, widersprüchlicher Evidence oder sonst unklarem Risiko dürfen und sollen weiterhin feinere Gates verwendet werden.

## 7. Priorisierungsregel

Der nächste Entwicklungsblock wird nicht allein nach fortlaufender BP-Nummer gewählt. Maßgeblich ist der größte noch fehlende Nutzen für den realen Baustelleneinsatz bei vertretbarem technischen Risiko.

Bei der Auswahl sind insbesondere zu prüfen:

1. Was fehlt dem realen Ablauf auf der Baustelle noch?
2. Ist die dafür notwendige Datenautorität bereits vorhanden?
3. Kann die Funktion als klarer Minimal-Diff umgesetzt werden?
4. Verbessert sie Planung, Montage, Materialermittlung oder Ausgabe unmittelbar?
5. Muss vorher ein technischer Refactor erfolgen, damit die Änderung sicher bleibt?

## 8. Nächster Entscheidungsstand

Mit dieser Aktualisierung ist die alte Mai-Roadmap nicht mehr die Grundlage für die nächste Arbeit.

Der nächste Produktblock soll gegen den dann aktuellen autoritativen `main` im neuen **Gate 1 – Analysis / Scope / Authorization** bestimmt werden. Dabei sind mindestens zwei Kandidatengruppen gegeneinander zu prüfen:

- **fachlicher Ausbau der Kabeltrasse**, insbesondere die bereits vorbereitete Belastungs-/Ausführungsklasse BP-031 (`tray.dutyClass`);
- **weitere praktische Material-/Artikelabdeckung** auf Basis der bestehenden BP-026 bis BP-030 Kette.

Weitere Refactorings sind ebenfalls zulässig, wenn die Analyse zeigt, dass sie für die nächste sichere Produktentwicklung tatsächlich erforderlich sind.

Es wird in diesem Ziel-Dokument bewusst noch kein zukünftiger Block als bereits autorisiert erklärt. Autorisierung erfolgt erst gegen den dann exakten `main` innerhalb von Gate 1.

---

Dieses Dokument ist ab 01.10.2026 die aktuelle übergeordnete Ziel- und Priorisierungsbeschreibung des Baustellenplaners. Das Repository auf `main`, die fachlichen Datenautoritäten und die jeweiligen Completion-/Evidence-/Freeze-Dokumente bleiben für konkrete Implementierungsdetails maßgeblich.