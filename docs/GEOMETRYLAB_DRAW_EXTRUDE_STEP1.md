# GeometryLab Draw/Extrude Step 1 — Preview

Patch: `PATCH_geometrylab_draw_extrude_step1_preview.zip`  
Datum: 2026-05-14

## Ziel

Dieser Patch ergänzt im AssetLab 3D einen ersten GeometryLab-Zeichenmodus:

```text
2D-Kontur auf X/Z-Bodenebene zeichnen
→ Kontur schließen
→ Höhe eingeben
→ 3D-Extrude-Preview erzeugen
→ noch NICHT automatisch als Projektmodell speichern
```

## Sicherheitslogik

Wie bei CMO Step 1/2 ist dieser Schritt absichtlich Preview-only:

- kein `hasModel=true`
- kein `lastImportName`
- kein IDB-Speichern
- kein `assetlab:slotUpdate`
- kein Workarea-Modell

Erst ein späterer Step übernimmt die erzeugte Geometrie als GLB in den Slot.

## Bedienung

1. AssetLab öffnen.
2. Button `2D zeichnen` drücken.
3. Im Viewer auf die Bodenebene tippen/klicken, um Punkte zu setzen.
4. Höhe im Feld `Höhe` einstellen.
5. Button `Extrude Preview` drücken.
6. Die 3D-Vorschau erscheint im Viewer.
7. Button `Zeichnung löschen` entfernt Punkte und Preview.

## Technische Umsetzung

Neue Datei:

```text
modules/geometrylab/core/draw-extrude.js
```

Geänderte Dateien:

```text
modules/assetlab3d/iframe/index.html
modules/assetlab3d/iframe/assetlab-lite.css
modules/assetlab3d/iframe/assetlab-lite.js
```

Die Punkte werden auf der X/Z-Ebene erzeugt. Die Extrusion erfolgt entlang Y.
Intern wird `THREE.ExtrudeGeometry` verwendet und anschließend von Three.js Standardkoordinaten in das Baustellenplaner-System umgemappt.

## Nächster Schritt

Step 2 sollte einen eindeutigen Button ergänzen:

```text
Geometrie als GLB übernehmen
```

Danach kann die gezeichnete Form genau wie die konvertierte CMO als echtes Slot-Modell gespeichert werden.
