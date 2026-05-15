# Workarea Mobile Portrait Layout v1

Datum: 2026-05-15

## Problem

Auf iPhone/Safari Portrait wurde die Workarea weiterhin als starres Desktop-Layout gerendert:

- linker Dock ca. 320px
- Center/Canvas daneben
- rechter Dock optional daneben

Bei schmaler Bildschirmbreite lag der Canvas dadurch rechts außerhalb des sichtbaren Bereichs. Die Asset-Auswahl war links sichtbar, der Viewport aber nur angeschnitten.

## Änderung

`ui/panels/WorkareaPanel.js` bekommt ein responsives Layout:

- ab Panelbreite unter 760px wird auf Mobile/Narrow umgeschaltet
- Shell wird von Row auf Column gestellt
- linker Dock wird oben als kompakte Asset-/Scene-Leiste angezeigt
- Center/Viewport kommt darunter und bekommt eine feste mobile Höhe
- rechter Dock wird auf Mobile ausgeblendet, weil er Zusatzinformation ist
- Topbar bleibt horizontal scrollbar, statt den Viewport zu sprengen
- Resize/Orientation-Change aktualisiert das Layout

## Ziel

Auf iPhone Portrait soll die Workarea so bedienbar sein:

1. Assets oben auswählen
2. darunter den Canvas sehen
3. in Place-Mode wechseln
4. Asset im sichtbaren Canvas platzieren

## Geänderte Datei

- `ui/panels/WorkareaPanel.js`
