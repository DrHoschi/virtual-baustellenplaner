# PATCH workarea structure tree detail editor save quarantine v7

## Ziel

Der Crashlog nach v6 zeigte: `_persistSceneToStore()` für `structure-detail:memory-only:v5` wird zwar blockiert, aber danach laufen noch andere Save-Pfade:

- `assemblyprops:component-eplan:deviceTag`
- `structure-detail-editor:component:name`
- `ui:project:save` über den Autosave-Drag-Guard

v7 setzt deshalb eine Quarantäne für alle Save-/Persist-Pfade, die während der Bearbeitung im Strukturbaum-Detail-Editor entstehen.

## Erwartetes Crashlog-Verhalten

Beim Tippen im Detail-Editor sind Einträge erlaubt wie:

```text
workarea:structure-detail-save:request-blocked:v7
workarea:structure-detail-save:persist-blocked:v7
workarea:structure-detail-save:assemblyprops-blocked:v7
workarea:structure-detail-save:bus-blocked:v7
```

Nicht mehr auftreten sollten beim Tippen:

```text
workarea:save:emit { reason: "structure-detail-editor:..." }
workarea:save:emit { reason: "assemblyprops:component-eplan:..." }
```

## Ladereihenfolge

Die Datei wird bewusst nach `main.js` geladen, damit sie auch die dynamisch installierte Autosave-Guard-Methode nochmals einfangen kann.
