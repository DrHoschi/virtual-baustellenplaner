# PATCH workarea structure tree detail editor hardcut nopersist v6

## Zweck

Dieser Patch ist ein Notfall-Stabilitäts-Schnitt nach v5.

Der neue Crashlog zeigt weiterhin Reloads kurz nach:

```text
workarea:scene:persist { reason: "structure-detail:memory-only:v5" }
```

Damit ist klar: Auf iPhone/Safari ist bereits `_persistSceneToStore()` während der Eingabe zu schwer, nicht nur der danach geplante Projekt-Save.

## Änderung

`workarea-structure-tree-detail-editor-hardcut-nopersist.v6.js` wird nach v5 geladen und blockt:

- `_persistSceneToStore(reason)` für `structure-detail...`
- `_requestProjectSaveDebounced(reason)` für `structure-detail...`
- Mobile Canvas-Resize-Ausreißer mit `h <= 40`, weil im Crashlog ein angewendeter Resize auf `h:1` sichtbar war

Normale Workarea-Saves außerhalb des Detail-Editors bleiben aktiv.

## Erwartung

Beim Tippen im Strukturbaum-Detail-Editor:

- kein `workarea:scene:persist` mehr mit `structure-detail:...`
- stattdessen `workarea:scene:persist:hard-blocked:v6`
- kein Reload durch Detail-Editor-Speicherpfad

## Einschränkung

Die Änderung bleibt zunächst nur im laufenden Workarea-Speicher. Für dauerhafte Speicherung braucht der Detail-Editor danach ein sauberes Konzept:

Live ändern → dirty markieren → bewusst speichern.
