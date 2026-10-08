# PATCH_workarea_structure_tree_component_nodes_v1

Datum: 2026-05-21

## Ziel

Der vorhandene Workarea-Strukturbaum wird erweitert:

```text
Projekt
└─ Ort / Lastspannung
   └─ Fördergruppe
      └─ Objekt / Baugruppe
         ├─ Objekt-Basisdaten
         ├─ Mechanik
         ├─ Antrieb / Motor
         ├─ Steuerung / MOVIFIT
         ├─ Sensorik
         ├─ Wartung / Sicherheit
         ├─ Klemmkasten / Verteiler
         ├─ Anschlüsse / Ports
         └─ Stückliste / Material
```

## Verhalten

- Der Patch hängt sich nach `workarea-structure-tree-live-grouping.v1.js` ein.
- Der bestehende Orts-/Fördergruppenbaum bleibt erhalten.
- Unter jedem Workarea-Objekt werden vorhandene `components`, `componentRefs`, `ports` und `bom` als leichte Navigationsknoten dargestellt.
- Klick auf einen Unterknoten öffnet rechts im Properties-Dock eine gezielte Detailkarte.
- Die Detailkarte ist absichtlich leicht gehalten; Voll-Editor, Elektrikdialog und BOM bleiben über Buttons erreichbar.

## Geänderte Dateien

- `index.html`
  - neues Modul eingebunden:
    `./core/workarea-structure-tree-component-nodes.v1.js?v=1`

## Neue Dateien

- `core/workarea-structure-tree-component-nodes.v1.js`
- `docs/PATCH_workarea_structure_tree_component_nodes_v1_README.md`

## Tests

Ausgeführt:

```bash
node --check core/workarea-structure-tree-component-nodes.v1.js
node --check core/workarea-structure-tree-live-grouping.v1.js
node --check ui/panels/WorkareaPanel.js
find core ui app modules -name '*.js' -print0 | xargs -0 -n1 node --check
```

Alle Syntax-Checks ohne Fehler.

## Hinweis

Dieser Patch ist bewusst als Zusatzmodul gebaut. Dadurch bleibt der vorherige Strukturbaum-Patch unangetastet und kann bei Bedarf einzeln deaktiviert werden.
