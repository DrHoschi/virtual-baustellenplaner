# PATCH_assemblylab_properties_v1

## Ziel
Dieser Patch erweitert den Properties-Tab der Workarea für ausgewählte `assembly.instance`-Objekte.

## Funktionen
- Anzeige der ausgewählten Baugruppe mit Name, ID, Bauteilanzahl und BOM-Anzahl
- Name der Baugruppe direkt bearbeiten
- Fördergruppe direkt an der Workarea-Instanz speichern
- Ortbereich direkt an der Workarea-Instanz speichern
- BMK/Tag direkt an der Workarea-Instanz speichern
- Master-Baugruppe per Dropdown wechseln
- Variante per Dropdown wechseln
- Variante neu auf die Instanz anwenden
- Verknüpfte Variante direkt im linken AssemblyLab-Tab öffnen
- Kompakte Bauteile-Liste der ausgewählten Workarea-Baugruppe

## Speicherorte
Die technischen Felder werden an der Workarea-Instanz gespeichert:

- `sceneObj.config.conveyorGroup`
- `sceneObj.config.location`
- `sceneObj.config.area`
- `sceneObj.config.equipmentTag`
- zusätzlich einfache Kompatibilitätsfelder wie `sceneObj.conveyorGroup`, `sceneObj.location`, `sceneObj.equipmentTag`

Beim Variantenwechsel werden aktualisiert:

- `templateId`, `templateTitle`
- `variantId`, `variantTitle`
- `components`
- `componentRefs`
- `bom`
- `w`, `h`, `width`, `height`, `r`
- `assemblyLab.templateId`, `assemblyLab.variantId`

## Geprüft
- `node --check ui/panels/WorkareaPanel.js`
- `node scripts/syntax-check.mjs`
- `node scripts/import-graph-check.mjs`
- `node scripts/check-assembly-templates.mjs`
