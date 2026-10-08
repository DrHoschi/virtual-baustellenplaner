# PATCH_workarea_assembly_scene_binding_v1

Stand: 2026-05-19

## Ziel

Dieser Patch verbindet das Baugruppen-Fenster wirklich mit der Workarea-Scene.
Nach Klick auf **„In Workarea einfügen“** wird ein echtes `assembly.instance` in `app.project.workspace.scene.objects` gespeichert.

## Enthaltene Dateien

- `index.html`
- `ui/panels/WorkareaPanel.js`
- `core/workarea-assembly-scene-binding.v1.js`
- `core/workarea-assembly-catalog.v1.js`
- `core/workarea-assembly-insert-and-variant-panel.v1.js`
- `core/assemblies/*.js`
- `data/assembly-templates.v1.json`
- Dokumentation und optionale Checks

## Was wurde repariert

1. Die Workarea stellt ihre echte Instanz global als Bridge bereit:
   - `window.__workareaPanel`
   - `window.__WORKAREA_PANEL__`
   - `window.baustellenplanerWorkarea`

2. Die Workarea akzeptiert externe Scene-Objekte über:
   - `addSceneObject()`
   - `insertSceneObject()`
   - `addObject()`
   - `insertObject()`
   - Bus/Event: `bp:workarea:assembly:insert`
   - Bus/Event: `workarea:assembly:insert`

3. `_persistSceneToStore()` speichert nicht mehr nur die alten Asset-Felder, sondern erhält bei Baugruppen auch:
   - `assemblyId`
   - `templateId`
   - `variantId`
   - `config`
   - `params`
   - `bom`
   - `ports`
   - `components`
   - `assemblyMeta`

4. `assembly.instance` wird in der 2D-Workarea als schematische Baugruppe gerendert.

## Erwarteter CrashLog

Nach dem Laden:

```text
workarea:assembly-binding:ready
workarea:assembly-panel:ready
```

Nach Klick auf **In Workarea einfügen**:

```text
workarea:assembly:inserted-direct
workarea:external-insert:done
workarea:scene:persist
```

## CI-Test

Empfohlen:

```bash
node --check ui/panels/WorkareaPanel.js
node --check core/workarea-assembly-scene-binding.v1.js
node --check core/workarea-assembly-catalog.v1.js
node --check core/workarea-assembly-insert-and-variant-panel.v1.js
npx playwright test tests/ui-wiring.spec.js
```
