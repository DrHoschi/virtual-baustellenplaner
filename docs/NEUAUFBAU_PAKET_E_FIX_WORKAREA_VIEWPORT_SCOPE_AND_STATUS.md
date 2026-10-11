# Neuaufbau Paket E-Fix - Arbeitsbereich-Verhalten / sichtbaren Ausschnitt uebernehmen

Stand: 11.10.2026
Branch: `dev/planner-neuaufbau`
Gate 1: Analysis / Scope / Authorization abgeschlossen
Ausgangs-Head: `270d857f4d6050ee616ff415244e78a2557abc48`
Funktionaler Paket-E-Freeze: `2a0e9f8b8c2c3e5825c3114d57df918a59105fa7`
Funktionaler Paket-G-Freeze: `b51b20e0b69b4ea40264b646e96c44c376f956af`
`main`: bleibt unveraendert.

## Ziel

Dieser Fix-Block korrigiert das Bedienverhalten von `Arbeitsbereich setzen` bzw. `+ Arbeitsbereich`.

Der Nutzer erwartet fachlich, dass der aktuell sichtbare Plan-Ausschnitt als neuer Arbeitsbereich gespeichert wird. Das passt zum Paket-E-Ziel: Arbeitsbereiche sind gespeicherte Fokus- und Navigationsausschnitte auf dem grossen Gesamtplan.

Aktuell fuehlt sich die Funktion statisch an, weil jeder neue Arbeitsbereich nach demselben Muster entsteht. Dieser Fix soll das Verhalten an den sichtbaren Viewport koppeln.

## Ist-Zustand

Der Paket-E-Datenvertrag ist grundsaetzlich richtig:

- `workspace.workAreas[]` speichert rechteckige Ausschnitte in globalen Millimeterkoordinaten.
- `workspace.activeWorkAreaId` ist eine UI-/Ansichtsreferenz.
- Objekte, Trassen, Kabel und Kameras bleiben im Gesamtkoordinatensystem.
- Arbeitsbereiche sind keine zweite Szene und kein eigener Projektspeicher.

Die aktuelle Erzeugung eines Arbeitsbereichs in `planner-v2/src/ui/workarea-editor.v1.js` verwendet aber eine feste Ableitung aus dem Gesamtbereich:

- Breite: ungefaehr `35%` der Gesamtflaeche;
- Hoehe: ungefaehr `35%` der Gesamtflaeche;
- Position: zentriert im Gesamtplan.

Damit entsteht beim Klick auf `+ Arbeitsbereich` nicht der vom Nutzer gerade eingestellte sichtbare Ausschnitt. Das ist fuer grosse Hallen unpraktisch.

## Fachlicher Scope fuer Gate 2

Gate 2 soll spaeter genau diesen Minimalumfang umsetzen:

1. **Sichtbaren Ausschnitt uebernehmen**
   - Der Nutzer zoomt und verschiebt die Ansicht.
   - `+ Arbeitsbereich` speichert den aktuell sichtbaren SVG-/Plan-Ausschnitt.
   - Der Arbeitsbereich wird als Rechteck im globalen Koordinatensystem gespeichert.
   - Die gespeicherten Werte sind `xMm`, `yMm`, `widthMm`, `heightMm`.

2. **Arbeitsbereich auswaehlen und fokussieren**
   - Gespeicherte Arbeitsbereiche bleiben in der Arbeitsbereichsliste sichtbar.
   - Klick auf einen Arbeitsbereich setzt ihn als aktiv.
   - Die Ansicht springt exakt auf diesen gespeicherten Ausschnitt.
   - `Gesamtplan` setzt die Ansicht wieder auf den ganzen Plan.

3. **Koordinatenautoritaet bleibt unveraendert**
   - Objekte, Kameras, Trassen und Kabel behalten ihre globalen Koordinaten.
   - Der Arbeitsbereich veraendert keine Objektpositionen.
   - Der Arbeitsbereich filtert oder loescht keine Projektdaten.

4. **Save / Reload / Import / Export**
   - Der aus dem Viewport erzeugte Arbeitsbereich wird gespeichert.
   - Nach Reload bleibt der Arbeitsbereich erhalten.
   - Der aktive Arbeitsbereich darf wieder fokussiert werden.
   - Projektdatei-Export und -Import erhalten die Daten ueber den bestehenden Projektvertrag.

## Technische Leitentscheidung

Der Fix soll keine neue Datenstruktur einfuehren. Der bestehende Paket-E-Vertrag reicht aus.

Die Umsetzung soll stattdessen die aktuelle ViewBox-/Zoom-/Pan-Information in globale Millimeterwerte uebersetzen und daraus den neuen Arbeitsbereich bilden.

Voraussichtliche technische Quelle:

- `viewCenterX`
- `viewCenterY`
- `viewWidth`
- `viewHeight`
- `zoom`
- `areaLeft`
- `areaBottom`
- `areaWidth`
- `areaHeight`

Die erzeugten Rechteckwerte muessen auf den gueltigen Gesamtbereich begrenzt werden, damit keine negativen oder ausserhalb liegenden Arbeitsbereiche entstehen.

## Grenzen / Nicht Bestandteil

- Keine vollstaendige UX-/Menue-Neuordnung.
- Kein Mockup-Paket.
- Keine automatische Hallenaufteilung.
- Keine zweite Szene.
- Keine Aenderung am Projektformat.
- Keine Aenderung an Kamera-, Trassen-, Kabel- oder Messdaten.
- Keine Integration nach `main`.

## Vorgesehene Dateien fuer Gate 2

Der Gate-2-Scope soll klein bleiben:

- `planner-v2/src/ui/workarea-editor.v1.js` - Erzeugung aus sichtbarem Ausschnitt, Fokusverhalten, Statusmeldung.
- `tests/planner-v2-workareas.spec.mjs` - bestehender Paket-E-Test wird erweitert oder um einen Fix-Test ergaenzt.
- optional `docs/NEUAUFBAU_PAKET_E_FIX_WORKAREA_VIEWPORT_SCOPE_AND_STATUS.md` - Gate-2-Ergebnis nachtragen.
- optional `.github/workflows/planner-v2-paket-e.yml` - nur falls der bestehende Paket-E-Lauf angepasst werden muss.

## Abnahmekriterien fuer Gate 2

Paket E-Fix Gate 2 gilt nur dann als bestanden, wenn:

- ein stark gezoomter und verschobener sichtbarer Ausschnitt als Arbeitsbereich gespeichert wird;
- der gespeicherte Arbeitsbereich nicht wieder die statische 35%-Zentrumsgroesse erhaelt;
- die gespeicherten Werte im Gesamtkoordinatensystem liegen;
- Auswahl eines Arbeitsbereichs exakt auf dessen Ausschnitt springt;
- Wechsel zum Gesamtplan wieder den ganzen Plan zeigt;
- Objekt-/Kamera-/Trassenkoordinaten unveraendert bleiben;
- Save/Reload den sichtbasiert erzeugten Arbeitsbereich erhaelt;
- Projektimport/-export die Arbeitsbereichsdaten erhaelt;
- bestehende Paket-A/B/C/D/E/F/G-Regressionen gruen bleiben.

## Gate-1-Ergebnis

Der E-Fix ist als begrenzte Nachkorrektur des Paket-E-Arbeitsbereichsverhaltens autorisiert. Er behebt einen konkreten Bedienfehler aus dem manuellen Test und sollte vor einem groesseren UX-/Menue-Mockup umgesetzt werden.

Der naechste separate Schritt ist:

`Paket E-Fix - Gate 2 Implementation / Verification gegen exakt 270d857f4d6050ee616ff415244e78a2557abc48 auf dev/planner-neuaufbau.`

## Gate-2-Ergebnis

Paket E-Fix wurde auf `dev/planner-neuaufbau` umgesetzt:

- `+ Arbeitsbereich` erzeugt neue Arbeitsbereiche aus dem aktuell sichtbaren Plan-Ausschnitt;
- die sichtbare ViewBox wird in globale Millimeterkoordinaten uebersetzt;
- der erzeugte Ausschnitt wird auf die Gesamtflaeche des Projekts begrenzt;
- Auswahl/Fokus eines Arbeitsbereichs nutzt weiter den bestehenden Paket-E-Vertrag;
- Objekt-, Kamera-, Trassen-, Kabel- und Messdaten bleiben unveraendert im Gesamtkoordinatensystem;
- Save/Reload erhaelt den sichtbasiert erzeugten Arbeitsbereich;
- der Paket-E-Browsertest prueft nun, dass nicht mehr der statische 35%-Zentrumsausschnitt gespeichert wird;
- die sichtbare Build-Kennung steht fuer diesen Stand auf `NEUAUFBAU · PAKET E-FIX`.

Lokale Vorpruefung:

- `node scripts/syntax-check.mjs` -> PASS
- `node scripts/import-graph-check.mjs` -> PASS

Der lokale Playwright-Lauf blieb in dieser Sandbox erneut ohne Reporter-Ausgabe haengen und wurde abgebrochen. Die autoritative Browser-Verifikation erfolgt ueber GitHub Actions.

Gate 2 ist keine Freeze- oder `main`-Integration. Completion / Evidence / Freeze bleibt ein separater Gate-3-Schritt.
