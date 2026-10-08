# GeometryLab / CMO Import – Step 1

Stand: 2026-05-14  
Patch: `geometrylab-cmo-step1`

## Ziel

Dieser Schritt legt die sichere Grundlage für den späteren Modellbauer:

```text
CMO-Datei hochladen
→ Format erkennen
→ Metadaten / Thumbnail lesen
→ Analyse im AssetLab anzeigen
→ noch NICHT als echtes Projektmodell speichern
```

## Warum noch kein echtes Modell?

Die getestete Datei `1-2 TVR 2F Ø003.cmo` enthält zwar sichtbare Marker wie:

```text
REPP3D-CM-BIN014
>THUMBNAIL_RGB
>BEGIN_OBJECT
>POINTS
>FACETS
>UVSEL_S
>BEGIN_OBJECT_CAMERA
>BEGIN_OBJECT_LIGHT
```

Die eigentlichen Punkt- und Facet-Daten liegen aber binär kodiert vor. Deshalb macht Step 1 nur eine robuste Analyse. Erst Step 2 dekodiert `POINTS` und `FACETS` und erzeugt daraus eine `THREE.BufferGeometry`.

## Neue Datei

```text
modules/geometrylab/importers/cmo-reader.js
```

Wichtige Funktionen:

```js
detectCmo(arrayBuffer)
analyzeCmoBuffer(arrayBuffer)
readCmoThumbnail(arrayBuffer)
cmoThumbnailToDataUrl(arrayBuffer)
formatCmoSummary(report)
```

## Geänderte Dateien

```text
modules/assetlab3d/iframe/assetlab-lite.js
modules/assetlab3d/iframe/index.html
ui/panels/AssetLab3DPanel.js
```

## Verhalten im AssetLab

- Import-Button akzeptiert jetzt `.cmo` zusätzlich zu `.glb` und `.gltf`.
- Bei `.cmo` wird eine Analyse-Vorschau im Viewer erzeugt.
- Eingebettete CMO-Thumbnails werden, falls vorhanden, auf einer kleinen Vorschaukarte angezeigt.
- Der Host erhält `assetlab:cmoAnalysis` nur für Statusanzeige.
- Es wird absichtlich kein `assetlab:slotUpdate` mit `kind: import` gesendet.

Damit wird verhindert, dass ein Slot fälschlich als `hasModel = true` gespeichert wird, obwohl noch kein GLB-/Mesh-Modell existiert.

## Nächster Schritt

Step 2 sollte ein eigenes Modul ergänzen:

```text
modules/geometrylab/importers/cmo-to-mesh.js
```

Geplante Aufgaben:

1. Binärblöcke nach `>POINTSTART` / `>DOUBLE` dekodieren.
2. Facet-Indizes nach `>FACETSTART` / `>INTEGER` dekodieren.
3. `THREE.BufferGeometry` erzeugen.
4. Vorschau als echtes Mesh anzeigen.
5. GLB exportieren und erst dann als normales Projekt-Asset speichern.
