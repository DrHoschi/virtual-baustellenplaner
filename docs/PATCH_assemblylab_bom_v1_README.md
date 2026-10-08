# PATCH_assemblylab_bom_v1

## Ziel

Dieser Patch baut auf `PATCH_assemblylab_component_roles_v1` auf und macht aus den AssemblyLab-Bauteilen eine bessere technische Stückliste.

## Enthalten

- `ui/panels/WorkareaPanel.js`
- `docs/PATCH_assemblylab_bom_v1_README.md`

## Neu

Der BOM-Tab wertet jetzt besonders `assembly.instance` aus:

- Baugruppenname
- Fördergruppe
- Ortbereich
- BMK / Tag
- Master/Variante über IDs
- Bauteilrollen, z. B. Motor, MOVIFIT, Schutz, Sensor
- Projekt-Asset- und Slot-Bezug
- Menge / UOM
- Artikelnummer, Hersteller, Lieferant, Kommentar, Preis

## Mobile Darstellung

Die alte breite BOM-Tabelle wurde durch mobile-freundliche Positionskarten ersetzt. Das ist noch nicht der finale Beauty-Stand, verhindert aber, dass die Tabelle auf dem Smartphone stark nach rechts ausläuft.

## Export

CSV und JSON enthalten jetzt zusätzlich:

- `assemblyName`
- `conveyorGroup`
- `location`
- `equipmentTag`
- `roleLabel`
- `assemblyId`
- `templateId`
- `variantId`
- `projectAssetId`
- `slotId`

## Einspielreihenfolge

1. `PATCH_assemblylab_v1`
2. `PATCH_assemblylab_mobile_polish_v1`
3. `PATCH_assemblylab_properties_v1`
4. `PATCH_assemblylab_properties_hotfix_v1`
5. `PATCH_assemblylab_component_roles_v1`
6. `PATCH_assemblylab_bom_v1`

## Checks

Getestet auf dem gepatchten Projektstand:

```bash
node --check ui/panels/WorkareaPanel.js
node scripts/syntax-check.mjs
node scripts/import-graph-check.mjs
node scripts/check-assembly-templates.mjs
```

Ergebnis: grün.
