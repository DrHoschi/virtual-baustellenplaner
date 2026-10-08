# Param-Engine v1 (Hall3D) – Live-Parameter + Stückliste

Stand: 2026-02-26

## Ziel

Diese v1 macht zwei Dinge **sofort lauffähig**:

1. **B) Parameter visuell im 3D ändern**
   - Skalierung / Position / Rotation / Sichtbarkeit von Sub-Nodes (per Name)
2. **C) Parameter für Berechnungen nutzen**
   - BOM (Stückliste) + Kostenberechnung über sichere Mini-Expressions (ohne `eval`)

## Wo ist das integriert?

- `modules/hall3d/core/param-engine.js` – Apply + Metrics
- `modules/hall3d/core/param-math.js` – Expression Parser/Evaluator
- `modules/hall3d/core/model-factory.js` – lädt optional ParamPack + wendet an
- `modules/hall3d/view.js` – kleines Floating-Param-Panel (v1), live apply + live BOM

## ParamPack Format

Ein ParamPack ist ein JSON, das am Modell-Eintrag referenziert wird:

`modules/hall3d/data/library.models.json`

```json
{
  "id": "skid_production_v1",
  "url": "./assets/models/logistics/skid_production_v1.glb",
  "paramPackUrl": "./modules/hall3d/data/param-packs/skid_production_v1.parampack.json"
}
```

### Inhalte im ParamPack

- `defaults` – Defaultwerte
- `ui.groups[]` – UI-Felder (für das v1 Floating Panel)
- `apply` – Regeln für 3D
  - `root.scale/position/rotate`
  - `nodes[]` per `name` (z.B. `RepairFlap`)
- `bom.items[]` – Stückliste + Kosten

## Live-Update Flow

1. Nutzer ändert Feld im Param-Panel
2. Event: `req:hall3d:param:update` `{ key, value }`
3. `hall3d/view.js`:
   - schreibt in `store.hall3d.params`
   - merged defaults + overrides
   - `applyParamPack(group, pack, params)`
   - `computeMetrics(pack, params)`

## Hinweis: Node-Namen im GLB

Für Node-Regeln muss im GLB ein Mesh/Node mit exakt dem Namen existieren,
z.B. `RepairFlap`. Wenn der Name im Modell anders ist, musst du den
`name` im ParamPack anpassen.

## Nächste Ausbaustufen (v2+)

- Deep-Validation gegen Schema
- Clamping/Units
- Param UI in Inspector + Workarea (statt Hall3D Overlay)
- Instanz-Overrides im Projektlayout (mehrere Skids/Rollenbahnen)
- Export: BOM/Costs in CSV/PDF
