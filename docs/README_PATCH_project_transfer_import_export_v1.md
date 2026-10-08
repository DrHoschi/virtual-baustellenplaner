# PATCH_project_transfer_import_export_v1

## Inhalt

- `main.js`  
  Lädt den Projekt-Transfer optional nach erfolgreichem App-Start.

- `core/project-transfer.js`  
  Neues Tool für selektiven Projekt-Export und Import.

## Neue Funktion

Im Debug-/Snapshot-Bereich erscheint ein Button:

`Projekt Transfer`

Darüber öffnet sich ein Dialog mit:

- JSON-Export
- ZIP-Export
- Import von JSON/ZIP
- Auswahl, welche Projektteile exportiert werden sollen:
  - Projekt-Assets und Slots
  - Thumbnails
  - Workarea-Scene / platzierte Objekte
  - Projekt- und UI-Einstellungen
  - UI-Zustand
  - AssetLab-Kontext
  - CrashLog
  - lokale Modellbuffer soweit verfügbar

## Grundstock/Template exportieren

Für einen Projekt-Grundstock einfach abwählen:

- `Workarea: platzierte Objekte / Scene`

Optional zusätzlich abwählen:

- `UI-Zustand`
- `CrashLog / Diagnose`

## Import

Der Import legt standardmäßig eine neue lokale Projektkopie an und setzt sie als aktives Projekt.
Danach wird die App mit `?project=local:<NEUE_ID>` neu geöffnet.

## Hinweis v1

Die v1 exportiert Store-, Projekt-, Settings-, UI-, Workarea-, Thumbnail- und bekannte localStorage-Modellbuffer.
Eine vollständige IndexedDB-GLB-Extraktion ist für v2 vorgesehen.

## Syntaxcheck

Ausgeführt:

```bash
node --check main.js
node --check core/project-transfer.js
```
