# PATCH_workarea_structure_tree_selection_sync_noscroll_v1

## Ziel

Hotfix für den Workarea-Strukturbaum:

- Klick im Viewer wählt weiterhin das passende Objekt im Strukturbaum aus.
- Die nötigen Elternknoten werden geöffnet.
- Der markierte Eintrag wird blau hervorgehoben.
- Der linke Strukturbaum springt dabei nicht mehr automatisch zur Rollenbahn / zum Objekt.
- Die aktuelle Scrollposition im Strukturbaum bleibt erhalten.

## Warum?

Im vorherigen Stand wurde bei Viewer-Auswahl intern noch `scrollIntoView()` ausgelöst. Dadurch sprang der linke Baum jedes Mal zum ausgewählten Objekt. Das ist für die Nachbearbeitung störend, weil man die aktuelle Position im Baum verliert.

## Einbindung

In `index.html` wird dieses Modul direkt nach `workarea-structure-tree-component-nodes.v1.js` geladen:

```html
<script type="module" src="./core/workarea-structure-tree-selection-sync-noscroll.v1.js?v=1"></script>
```

## Verhalten

Viewer-Auswahl:

```text
Objekt anklicken → Baum synchronisiert Markierung → Eltern öffnen → kein Auto-Scroll
```

Strukturbaum-Auswahl:

```text
Eintrag im Baum anklicken → Auswahl/Properties wie bisher
```

## Technische Notiz

Der Patch ersetzt keine bestehenden Dateien aus `live-grouping` oder `component-nodes`. Er wird danach geladen und stabilisiert nur das Auswahl-/Scrollverhalten.
