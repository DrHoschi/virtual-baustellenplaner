# PATCH_assemblylab_component_roles_v1

## Ziel

Dieser Patch erweitert AssemblyLab v1 um technische Bauteilrollen innerhalb einer Baugruppen-Variante.

Damit kann ein Projekt-Asset/Bauteil nicht mehr nur als generisches `component` gespeichert werden, sondern z. B. als:

- Rahmen / Grundkörper
- Rolle / Rollensatz
- Antrieb / Motor
- Riemen / Kette
- Sensor
- Steuerung / MOVIFIT
- Wartungsschalter
- Klemmkasten / Verteiler
- Stütze / Fuß
- Schutz / Gitter
- Zubehör

## Geänderte Datei

- `ui/panels/WorkareaPanel.js`

## Einspielreihenfolge

1. `PATCH_assemblylab_v1`
2. `PATCH_assemblylab_mobile_polish_v1`
3. `PATCH_assemblylab_properties_v1`
4. `PATCH_assemblylab_properties_hotfix_v1`
5. `PATCH_assemblylab_component_roles_v1`

## Technische Änderung

Neu hinzugefügt:

- `_getAssemblyComponentRolesV1()`
- `_getAssemblyRoleLabelV1(role, mode)`
- `_inferAssemblyComponentRoleV1(projectAsset, slot)`

Beim Hinzufügen eines Projekt-Assets wird eine Rolle automatisch grob aus Name/Slot/Importname abgeleitet. Sie kann im Baugruppen-Tab manuell geändert werden.

Die Rolle wird gespeichert in:

- `component.role`
- `component.roleLabel`
- `componentRefs[].role`
- `componentRefs[].roleLabel`
- `bom[].role`
- `bom[].roleLabel`
- `bom[].category`

## Sichtbar in der App

Im Baugruppen-Tab gibt es in der Bauteile-Tabelle jetzt zusätzlich die Spalte **Rolle**.

Im Properties-Tab wird bei ausgewählten Baugruppen die Rolle der Bauteile als kurze technische Bezeichnung angezeigt.

Im 2D-Viewport bekommen einzelne Rollen leichte Marker-Unterschiede:

- Sensor = runder Marker
- Antrieb/Motor = quadratischer Marker
- MOVIFIT/Steuerung = eigener farblicher Marker

Das ist noch keine endgültige Optik, sondern nur eine technische Kontrollhilfe.

## Checks

Getestet mit:

```bash
node --check ui/panels/WorkareaPanel.js
node scripts/syntax-check.mjs
node scripts/import-graph-check.mjs
node scripts/check-assembly-templates.mjs
```

Ergebnis: grün.
