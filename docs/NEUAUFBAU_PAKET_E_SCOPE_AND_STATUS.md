# Neuaufbau Paket E - Arbeitsbereiche, Praezisionszoom und Menuestruktur

Stand: 10.10.2026
Branch: `dev/planner-neuaufbau`
Gate 1: Definition / Scope abgeschlossen
Ausgangs-Head: `37b5a73522cb9e52f349ad3dcb331fb3febdba33`
`main`: bleibt unveraendert.

## Ziel

Paket E definiert die naechste Praxistauglichkeitsstufe nach Paket D. Der deployte Paket-D-Stand zeigt, dass Kamera platzieren, drehen und verschieben funktioniert. Beim realen Test mit einer grossen Musterhalle wurde aber sichtbar, dass die Bedienung fuer sehr grosse Layouts und eine wachsende Moduloberflaeche noch besser strukturiert werden muss.

Paket E soll deshalb zwei Themen fachlich festlegen, bevor weitere Funktionen in die Oberflaeche kommen:

- bearbeitbare Arbeitsbereiche / Ausschnitte mit Praezisionszoom fuer grosse Hallen;
- grobe Menue-, Objektbaum- und Eigenschaftenstruktur fuer Trassen, Kabel, Kameras, Messungen und spaetere Module.

Diese Datei autorisiert noch keine Implementation.

## Ausgangslage

Der aktuelle Neuaufbau kann:

- Projekte anlegen, speichern, neu laden und exportieren/importieren;
- 2D-Workarea mit Ebenen und generischen Planobjekten darstellen;
- Trassen zeichnen und Kabel zuordnen;
- Kameras platzieren, drehen, verschieben, mit FOV darstellen und optional Kabel-IDs zuordnen.

Das praktische Problem ist nicht die Datenhaltung, sondern die Bedienbarkeit in grossen Hallen:

- Die Gesamtflaeche kann so gross sein, dass Objekte im normalen View zu klein oder zu ungenau verschiebbar werden.
- Weiteres Zoomen / Panen muss praxistauglich bleiben, ohne Objektkoordinaten zu veraendern.
- Die Hauptoberflaeche wird mit jedem Fachpaket voller.

## Fachlicher Umfang fuer Gate 2

Gate 2 soll spaeter genau diesen Minimalumfang umsetzen:

1. **Arbeitsbereiche / Ausschnitte**
   - Ein Projekt behaelt seine volle Hallen-/Projektgroesse.
   - Optional koennen benannte Arbeitsbereiche definiert werden, z. B. `Nord`, `Einfahrt`, `Achse 1-4` oder `Kamerabereich Tor`.
   - Ein Arbeitsbereich beschreibt einen rechteckigen Ausschnitt im bestehenden Gesamtkoordinatensystem.
   - Objekte werden weiterhin mit ihren globalen X/Y/Z-Koordinaten gespeichert.
   - Ein Arbeitsbereich filtert oder fokussiert die Ansicht, ist aber keine zweite Szene und kein eigener Projektspeicher.

2. **Praezisionszoom / Navigation**
   - Zoomen und Pannen muss fuer sehr grosse Hallen ausreichend fein werden.
   - Die Ansicht darf auf einen Arbeitsbereich springen koennen.
   - Platzieren und Verschieben von Objekten muss auch bei grossem Projektmassstab genau genug bedienbar sein.
   - Der sichtbare Ausschnitt darf keine gespeicherten Objektkoordinaten verschieben oder normalisieren.

3. **Menue- und Objektbaumstruktur**
   - Werkzeuge und Listen sollen grob nach Fachbereichen geordnet werden.
   - Vorgesehene Gruppen fuer V1:
     - `Plan`;
     - `Trassen`;
     - `Kabel`;
     - `Kameras`;
     - `Messung`;
     - `Eigenschaften`.
   - Die bisherige Funktionalitaet bleibt erreichbar.
   - Die Struktur muss auf Desktop/iPad quer sowie iPad/iPhone hochkant sinnvoll bedienbar bleiben.

4. **Mockup-/UX-Regeln**
   - Gate 2 soll ohne grossen Designumbau auskommen, aber die Zielstruktur dokumentieren.
   - Falls die Umsetzung mehr als eine kleine Umordnung erfordert, ist zuerst ein Mockup-/Wireframe-Zwischenschritt vorzuziehen.
   - Sichtbare Bedienhilfen duerfen knapp sein, sollen aber keine langen Erklaertexte in die Arbeitsflaeche bringen.

## Datenvertrag V1

Arbeitsbereiche werden als optionale Projektdaten gedacht. Bestehende Projekte ohne Arbeitsbereiche bleiben gueltig.

Vorgesehener Modulblock:

```json
{
  "workspace": {
    "workAreas": [
      {
        "id": "workarea-...",
        "name": "Einfahrt Nord",
        "xMm": 0,
        "yMm": 0,
        "widthMm": 12000,
        "heightMm": 8000,
        "note": ""
      }
    ],
    "activeWorkAreaId": "workarea-..."
  }
}
```

Vertragsregeln:

- `workAreas` ist optional.
- Arbeitsbereich-IDs muessen innerhalb des Projekts eindeutig sein.
- `xMm`, `yMm`, `widthMm` und `heightMm` sind Millimeterwerte im bestehenden Gesamtkoordinatensystem.
- `widthMm` und `heightMm` muessen groesser 0 sein.
- Objekte, Trassen, Kabel und Kameras behalten ihre bestehenden globalen Koordinaten und Referenzen.
- `activeWorkAreaId` ist eine UI-/Ansichtsreferenz und darf bei ungueltigem Wert ignoriert oder bereinigt werden.
- Arbeitsbereiche duerfen keine zweite Persistenzautoritaet fuer Fachobjekte werden.

## Bedienregeln

- Der Nutzer kann weiterhin im Gesamtplan arbeiten.
- Ein Arbeitsbereich ist ein Fokus-/Navigationswerkzeug, kein Pflichtschritt.
- Beim Oeffnen eines Arbeitsbereichs wird die Ansicht auf dessen Ausschnitt gesetzt.
- Objektlisten duerfen optional nach sichtbarem Arbeitsbereich gefiltert oder hervorgehoben werden, aber versteckte Objekte duerfen nicht geloescht werden.
- Das UI muss klar anzeigen, ob man im Gesamtplan oder in einem Arbeitsbereich arbeitet.
- Mobile Hochkantansichten sollen die wichtigsten Aktionen zuerst zeigen: Auswahl, Eigenschaften, Speichern, Bereich wechseln.

## Grenzen / Nicht Bestandteil von Paket E

- Keine neue Geometrie- oder Szenenautoritaet.
- Keine automatische Hallenaufteilung.
- Keine echte CAD-Viewport-Engine.
- Keine 3D-Ansicht, Seitenansicht oder Schnittdarstellung.
- Keine Migration alter Main-Projekte.
- Keine vollstaendige UI-Neugestaltung aller Module.
- Kein Kunden-/Rechtemodell.
- Keine Integration nach `main`.

## Vorgesehene Dateien fuer Gate 2

Der Gate-2-Scope soll klein bleiben. Voraussichtliche Maximaldateien:

- `planner-v2/src/domain/project-document.v1.js` - optionaler Workspace-/Arbeitsbereichsvertrag, falls noetig.
- `planner-v2/src/domain/project-validation.v1.js` - Validierung optionaler Arbeitsbereiche.
- `planner-v2/src/ui/workarea-editor.v1.js` - Bereichsauswahl, View-Fokus, Zoom-/Pan-Grenzen, grobe Menueordnung.
- `planner-v2/src/ui/planner.css` - Layout-/Menueanpassungen.
- `tests/planner-v2-workareas.spec.mjs` - Browserfaelle fuer Arbeitsbereich, Zoom/Fokus, Save/Reload.
- optional `.github/workflows/planner-v2-paket-e.yml` - eigener Paket-E-Lauf, falls Gate 2 neue Tests ergaenzt.

## Abnahmekriterien fuer Gate 2

Paket E Gate 2 gilt nur dann als bestanden, wenn mindestens folgende Faelle geprueft sind:

- Projekt mit grosser Halle bleibt im Gesamtmassstab erhalten.
- Arbeitsbereich kann angelegt oder aus Default-Daten geladen werden.
- Wechsel in einen Arbeitsbereich fokussiert die Ansicht.
- Objekte/Kameras bleiben global korrekt positioniert.
- Kamera oder Objekt laesst sich im fokussierten Ausschnitt genauer verschieben.
- Save/Reload erhaelt Arbeitsbereiche und aktive Ansicht sinnvoll.
- Menuegruppen sind auf Desktop/iPad quer und mobilem Hochkantlayout erreichbar.
- Paket-A/B/C/D-Tests bleiben gruen.

## Gate-1-Ergebnis

Paket E ist als naechster Definition-/Umsetzungsblock nach Paket D festgelegt. Der naechste separate Schritt ist:

`Paket E - Gate 2 Implementation / Verification gegen exakt 37b5a73522cb9e52f349ad3dcb331fb3febdba33 auf dev/planner-neuaufbau.`
