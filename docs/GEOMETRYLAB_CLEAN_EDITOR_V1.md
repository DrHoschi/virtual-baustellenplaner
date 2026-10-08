# GeometryLab Clean Editor v1

Datum: 2026-05-14
Patch: `PATCH_geometrylab_clean_editor_v1.zip`

## Ziel

Der technische Draw/Extrude-Pfad war grün. Dieser Patch macht daraus einen besser bedienbaren Editor im AssetLab.

## Verbesserungen

- Toolbar in klare Gruppen aufgeteilt:
  - Datei
  - Transform
  - CMO
  - Zeichnen
  - Optionen
- GeometryLab-Editorpanel rechts im Viewer:
  - Status/Modus
  - Punktanzahl
  - Höhe
  - BoundingBox
  - Dreiecke
  - Punktliste
- Neue Editor-Buttons im Panel:
  - Undo
  - Preview
  - → GLB
  - Neu
- Hilfsgeometrie im Viewer verbessert:
  - Punkte sichtbar als Marker
  - Linien sichtbar zwischen Punkten
  - geschlossene Fläche halbtransparent sichtbar
- Höhe aktualisiert die Anzeige direkt.
- Wenn nach einer Preview weitergezeichnet wird, wird die alte Preview automatisch verworfen.

## Sicherheitslogik

Unverändert:

- Preview speichert kein Slot-Modell.
- Erst `Zeichnung → GLB` oder `→ GLB` im Editorpanel setzt den Slot auf `hasModel=true`.
- CMO-Übernahme bleibt separat.

## Geänderte Dateien

- `modules/assetlab3d/iframe/index.html`
- `modules/assetlab3d/iframe/assetlab-lite.css`
- `modules/assetlab3d/iframe/assetlab-lite.js`
- `docs/GEOMETRYLAB_CLEAN_EDITOR_V1.md`

## Test

1. Projekt-Asset-Slot öffnen.
2. AssetLab öffnen.
3. `2D zeichnen` drücken.
4. Punkte setzen.
5. Prüfen: Punktmarker, Linien und Fläche sichtbar.
6. Prüfen: Editorpanel zeigt Punkte, Höhe, BBox.
7. `Undo` testen.
8. `Preview` testen.
9. `→ GLB` testen.
10. Projekt-Assets prüfen: `Modell vorhanden`.
11. Workarea öffnen und Asset platzieren.
