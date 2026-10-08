# GeometryLab / CMO Step 3 – CMO-Preview als GLB übernehmen

Version: v0.3.0 / 2026-05-14

## Ziel

Dieser Patch schließt den ersten CMO-Importpfad ab:

```text
CMO-Datei auswählen
→ CMO analysieren
→ POINTS/FACETS als Mesh-Preview anzeigen
→ Benutzer klickt „CMO als GLB übernehmen“
→ sauberes GLB wird erzeugt
→ GLB wird wie ein normaler Import im Slot gespeichert
→ Projekt-Assets zeigt „Modell vorhanden“
```

## Wichtiges Sicherheitsverhalten

Der normale Button „Speichern“ übernimmt eine CMO weiterhin nicht automatisch als Modell.

Erst der neue Button im AssetLab löst die echte Konvertierung aus:

```text
CMO als GLB übernehmen
```

Dadurch bleibt die Trennung eindeutig:

```text
Speichern = Preset/UI/Projekt speichern
CMO als GLB übernehmen = echtes Projektmodell erzeugen
```

## Geänderte Dateien

```text
modules/assetlab3d/iframe/index.html
modules/assetlab3d/iframe/assetlab-lite.js
modules/geometrylab/importers/cmo-to-mesh.js
ui/panels/AssetLab3DPanel.js
docs/GEOMETRYLAB_CMO_STEP3.md
```

## Verhalten im Detail

Beim CMO-Import bleibt Step 2 erhalten:

```text
- Analyse anzeigen
- Mesh-Preview anzeigen
- Slot bleibt zunächst hasModel=false
```

Bei Klick auf „CMO als GLB übernehmen“ passiert dann:

```text
1. CMO wird aus dem gespeicherten RAM-Buffer nochmal sauber als Mesh gebaut
2. Debug-Achsen werden nicht exportiert
3. Wireframe-Debug-Meshes werden nicht exportiert
4. eingebettetes Thumbnail-Plane wird nicht exportiert
5. GLTFExporter erzeugt ein binäres GLB
6. das GLB wird im Viewer neu geladen
7. persistAndNotifyHost speichert es wie einen normalen GLB-Import
8. Slot bekommt hasModel=true
9. lastImportName wird z. B. Messe Stand.converted.glb
10. Thumbnail wird aus dem übernommenen GLB erzeugt
```

## Testablauf

```text
1. Projekt öffnen
2. Projekt-Assets öffnen
3. leeren Slot wählen
4. AssetLab öffnen
5. Messe Stand.cmo importieren
6. prüfen: Mesh-Preview sichtbar, Projekt-Assets noch „Kein Modell“
7. Button „CMO als GLB übernehmen“ klicken
8. zurück zu Projekt-Assets
9. prüfen: Slot zeigt Modell vorhanden + converted.glb + Thumbnail
10. Workarea öffnen und Asset platzieren
```

## Erwartung

```text
CMO vor Übernahme: hasModel=false
CMO nach Übernahme: hasModel=true
lastImportName: *.converted.glb
thumbnail: vorhanden
Workarea: platzierbar wie normaler GLB-Import
```

## Bekannte Grenzen

```text
- Materialien/Farben/Texturen aus CMO werden noch nicht übernommen.
- CMO-Objekte werden als graue Standard-Meshes exportiert.
- Koordinaten/Achsen entsprechen der aktuellen Parser-Annahme.
- Für spätere Bearbeitung/Zeichnen folgt ein separates GeometryLab.
```
