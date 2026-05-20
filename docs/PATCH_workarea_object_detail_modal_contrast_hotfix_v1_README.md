# PATCH_workarea_object_detail_modal_contrast_hotfix_v1

Fix für das neue Workarea-Objekt-Detailfenster.

## Problem

Auf iPhone/iPad/Safari war der Modal-Hintergrund dunkel, aber einige Texte und Buttons erbten schwarze Schrift aus der Shell. Dadurch war das Fenster kaum lesbar.

## Änderung

- `WorkareaPanel.js`: Dialog-Grundfarbe direkt auf helle Schrift gesetzt.
- `ui-workarea.css`: Modal-spezifische Kontrastregeln für Text, Buttons, Inputs, Tabellen und Debug-Code ergänzt.

## Test

- `node --check ui/panels/WorkareaPanel.js`

Nach dem Einspielen hart neu laden / Cache löschen.
