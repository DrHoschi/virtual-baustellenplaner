# PATCH_assemblylab_eplan_fields_hotfix_v1

Hotfix für `PATCH_assemblylab_eplan_fields_v1`.

## Problem

Beim Auswählen einer Baugruppe im Properties-Panel konnte folgender Fehler auftreten:

```text
ReferenceError: Can't find variable: components
```

Dadurch brach das Rendern der Properties ab. Auf iOS konnte danach der Pointer-/Touch-Zustand hängen bleiben, wodurch sich die Workarea so anfühlte, als würde sie nur noch zoomen.

## Fix

Der neue EPLAN-Bauteilblock verwendet jetzt die bereits vorhandene lokale Variable `comps` statt der nicht existierenden Variable `components`.

## Geändert

- `ui/panels/WorkareaPanel.js`

## Test

```bash
node --check ui/panels/WorkareaPanel.js
```
