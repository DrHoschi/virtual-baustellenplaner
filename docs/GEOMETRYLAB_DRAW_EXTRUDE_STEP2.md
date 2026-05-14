# GeometryLab Draw/Extrude Step 2 — GLB übernehmen

Patch: `PATCH_geometrylab_draw_extrude_step2_glb_takeover.zip`

## Ziel

Die in Step 1 erzeugte 2D-Zeichnung/Extrude-Preview kann jetzt bewusst als echtes GLB-Projektmodell übernommen werden.

## Ablauf

```text
2D zeichnen
→ Extrude Preview
→ Zeichnung als GLB übernehmen
→ GLB wird erzeugt
→ Slot wird aktualisiert
→ hasModel=true
→ Thumbnail wird erzeugt
```

## Sicherheitslogik

Der normale Speicherbutton übernimmt weiterhin keine Preview automatisch.
Nur der neue Button `Zeichnung als GLB übernehmen` setzt den Slot auf `hasModel=true`.

## Geänderte Dateien

```text
modules/assetlab3d/iframe/index.html
modules/assetlab3d/iframe/assetlab-lite.js
docs/GEOMETRYLAB_DRAW_EXTRUDE_STEP2.md
```

## Hinweis

Die erzeugten GLBs enthalten `userData.geometryLab` mit Quelle, Höhe und Punktanzahl.
Das ist eine Vorbereitung, damit spätere Bearbeiten-Funktionen die Geometrie wiedererkennen können.
