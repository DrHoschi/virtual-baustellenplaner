# Workarea Mobile Layout v2

Datum: 2026-05-15

## Befund

Die Workarea war ursprünglich als Desktop-Dreispalten-Layout aufgebaut:

```
[leftDock 320px] [center/canvas] [rightDock 360px]
```

Auf iPhone/Portrait führt das dazu, dass der Canvas rechts abgeschnitten wird und die Asset-Liste zu viel Breite verbraucht.

## Änderung

`ui/panels/WorkareaPanel.js` bekommt eine echte responsive Umschaltung:

### Desktop

```
[leftDock] [canvas] [rightDock]
```

### Mobile / Portrait

```
[Header kompakt]
[Asset-/Scene-/Library-Dock oben]
[Toolbar scrollbar]
[Canvas vollbreit darunter]
[Bottombar kompakt]
```

Zusätzlich:

- rechter Dock wird mobil ausgeblendet, damit Platz für Canvas bleibt
- Toolbar ist horizontal scrollbar
- Asset-Panel ist oben begrenzt und scrollbar
- Canvas bekommt mobile Höhe `min(54svh, 430px)` mit `min-height: 300px`
- Resize/OrientationChange triggert Reflow und Canvas-Resize
- Dock-Buttons heißen mobil allgemeiner `Panel` statt `Left`

## Test

1. iPhone Portrait öffnen
2. Workarea öffnen
3. Assets-Tab sollte oben stehen
4. Canvas muss darunter vollbreit sichtbar sein
5. Kein horizontal abgeschnittener Desktop-Canvas mehr
6. Place-Mode aktivieren und Asset platzieren
