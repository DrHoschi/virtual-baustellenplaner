# GeometryLab Draw/Extrude v0.1.2 — Normalen + Workarea Hydration Fix

Datum: 2026-05-14

## Inhalt

Dieser Patch korrigiert zwei Befunde aus dem iPad-Test:

1. **GeometryLab Extrude wirkte innen sichtbar**  
   Ursache: Nach der Achsenumlegung von Three.js `ExtrudeGeometry` auf das Baustellenplaner-System wurde die Dreiecks-Händigkeit gespiegelt. Dadurch zeigten die Normalen nach innen.

   Fix: Nach dem Mapping `(x, y2D, zDepth) -> (x, yHeight, zGround)` wird das Dreiecks-Winding gedreht und danach `computeVertexNormals()` neu ausgeführt.

2. **Workarea blieb bei „Projekt wird geladen …“ hängen**  
   Ursache: Die Hydration-Prüfung wartete noch auf `app.settings.workspace`. In echten Projekt-Snapshots kann `app.settings` aber leer sein, während `app.project.workspace.scene` gültig ist.

   Fix: Workarea blockiert nur noch, wenn keine aktive Projekt-ID vorhanden ist. Workspace-Settings werden mit Defaults behandelt und können später live nachziehen.

## Geänderte Dateien

- `modules/geometrylab/core/draw-extrude.js`
- `ui/panels/WorkareaPanel.js`

## Erwarteter Test

- Neue 2D-Kontur zeichnen, Preview erzeugen: Außenflächen sollen sichtbar sein, nicht die Innenseite.
- „Zeichnung → GLB“ ausführen: Slot bleibt weiterhin korrekt `hasModel=true`.
- Workarea öffnen: Overlay „Projekt wird geladen …“ verschwindet; Assets-Tab ist bedienbar.
