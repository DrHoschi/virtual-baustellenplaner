# Break Report – hardcut-modular-v1 (2026-02-04)

Dieses Patch-ZIP stellt den **Hard-Cut auf die modulare Architektur** her.
Der bisherige Blueprint-Demo-Flow aus `main.js` wird **bewusst ersetzt**.

## Neuer Single-Entry Bootpfad

`index.html → main.js → core/loader.js → project.json → defaults → plugins → modules → UI/Views`

### Was sich geändert hat

1. **main.js** ist jetzt nur noch Bootstrap
   - lädt `startApp()` aus `core/loader.js`
   - Projekt kann per Query-Param gesetzt werden: `/?project=projects/P-2026-0001/project.json`

2. **core/loader.js** ist jetzt „echt“
   - lädt `project.json`
   - merged Defaults → Overrides
   - lädt `manifest-pack.json` + alle `plugins/*.json`
   - registriert Module aus `project.modules[]` über `MODULE_IMPORTS`
   - rendert Menü + startet minimalen View-Router

3. **project.json** steuert aktive Module
   - `projects/P-2026-0001/project.json` enthält jetzt zusätzlich `hall3d`
   - `pluginPack` ist gesetzt

## Sichtbarer Effekt (Proof)

- Im **Store Snapshot** siehst du:
  - `app.project`
  - `app.settings`
  - `app.plugins.pack` + `app.plugins.manifests`

Damit ist bewiesen: **Defaults + Plugins sind wirklich live geladen**.

## Was als Nächstes kommt (nicht in v1)

- Plugin-Manifeste (Tabs/Topbar) wirklich in UI integrieren
- Module-Import-Map automatisch aus `modules/*/module.json` generieren
- Dev-Testbutton (`btnAddArea`) als Dev-Plugin in Inspector/Tools auslagern
