# GeometryLab / CMO Step 2 – Mesh-Preview

Version: `v0.2.0-cmo-mesh-preview`  
Datum: 2026-05-14

## Ziel

Step 2 erweitert den bisherigen CMO-Analysepfad um eine erste echte Mesh-Vorschau.

Ablauf:

```text
CMO-Datei auswählen
→ CMO erkennen
→ Header/Analyse lesen
→ POINTS/FACETS experimentell dekodieren
→ THREE.BufferGeometry als Preview anzeigen
→ NICHT als Projektmodell speichern
```

## Neue Datei

```text
modules/geometrylab/importers/cmo-to-mesh.js
```

Wichtige Exports:

```js
parseCmoGeometry(arrayBuffer)
buildCmoPreviewObject(THREE, arrayBuffer, options)
formatCmoMeshSummary(parsed)
```

## Geänderte Datei

```text
modules/assetlab3d/iframe/assetlab-lite.js
```

Der CMO-Import ruft jetzt nach der Analyse zusätzlich den Mesh-Preview-Builder auf.
Wenn das Dekodieren klappt, erscheint im AssetLab ein echtes Preview-Mesh mit Wireframe.
Wenn das Dekodieren nicht klappt, fällt das AssetLab automatisch auf den bisherigen
Analyse-Platzhalter zurück.

## Bewusste Sicherheitsgrenze

Auch nach erfolgreicher Mesh-Preview gilt weiterhin:

```text
hasModel bleibt false
model bleibt null
lastImportName wird nicht gesetzt
kein assetlab:slotUpdate für CMO
kein IDB-Modellbuffer für CMO
kein Workarea-Asset aus CMO
```

Das ist Absicht. Step 2 ist nur visuelle Prüfung.

## Annahmen zum CMO-Format

Die ersten getesteten Dateien zeigen folgende Struktur:

```text
>POINTS
<Anzahl Punkte>
>POINTSTART
>DOUBLE
<Anzahl Double-Werte>
<Float64 little-endian x/y/z ...>

>FACETS
<Anzahl Dreiecke>
>FACETSTART
>INTEGER
<Anzahl Integer-Werte>
<Int32 little-endian Indizes ...>
```

Der aktuelle Parser geht von Dreiecks-Tripeln und 1-basierten Indizes aus,
akzeptiert aber defensiv auch 0-basierte Indizes, falls eine Datei so aufgebaut ist.

## Test-Erwartung

Bei den beiden bekannten Testdateien sollte erscheinen:

```text
CMO erkannt ... CMO Mesh-Preview ... Preview-only, noch kein GLB-Modell gespeichert
```

Danach in Projekt-Assets prüfen:

```text
CMO-Slot bleibt Kein Modell
GLB-Import funktioniert weiterhin normal
```

## Nächster Schritt

Step 3 wäre erst nach visueller Prüfung:

```text
CMO Mesh Preview → GLB exportieren → als ProjectAsset speichern → hasModel=true
```
