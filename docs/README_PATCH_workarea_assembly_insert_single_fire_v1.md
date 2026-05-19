# PATCH_workarea_assembly_insert_single_fire_v1

## Ziel

Dieser Patch behebt den Fehler, dass ein einziger Klick auf **„In Workarea einfügen“** mehrere Baugruppen erzeugt hat.
Im Crashlog war sichtbar:

- `objects:1` mit `reason:"external-add-object"`
- danach mehrfach `objects:2/3/4` mit `reason:"assembly-insert:window"`
- alle mit derselben ID, z. B. `asm-mpce5ika-4ktsif`

Dadurch lagen mehrere Kopien übereinander und beim Verschieben wirkte es so, als bliebe in der Mitte immer noch eine Rollenbahn stehen.

## Geänderte Dateien

1. `core/workarea-assembly-insert-and-variant-panel.v1.js`
   - alter Mehrfach-Fallback entfernt
   - keine direkte Scene-Manipulation mehr
   - nur noch ein kanonischer Event pro Klick:
     - `workarea:assembly-insert:request`
   - jeder Klick bekommt eine `txId`

2. `ui/panels/WorkareaPanel.js`
   - neuer zentraler Listener für `workarea:assembly-insert:request`
   - Duplicate-Guard gegen gleiche `txId`
   - Duplicate-Guard gegen gleiche Objekt-ID im kurzen Zeitfenster
   - vorhandene ID in der Scene wird blockiert oder bei echtem neuen Insert regeneriert
   - Persist/Save/Selection/Render nur noch über WorkareaPanel
   - einfacher 2D-Renderer für `assembly.instance`

3. `index.html`
   - Cache-Buster für die Assembly-Scripte ergänzt:
     - `?v=singlefire1`
   - `main.js` Cache-Version auf `v=348`

## Erwarteter Crashlog nach einem Insert

Nach einem Klick darf nur noch ein Insert-Done erscheinen:

```text
workarea:assembly-insert:request
workarea:external-insert:done { reason:"assembly-insert:single-fire", count:1 }
workarea:scene:persist { reason:"assembly-insert:single-fire" }
```

Nicht mehr:

```text
objects:1
objects:2
objects:3
objects:4
```

## Test

1. Projekt öffnen.
2. Workarea öffnen.
3. Baugruppen-Menü öffnen.
4. Rollenbahn Master auswählen.
5. Genau einmal „In Workarea einfügen“ drücken.
6. Menü schließen.
7. Es darf nur eine Baugruppe in der Mitte liegen.
8. Verschieben: Es darf kein zweites Objekt an der alten Mitte stehen bleiben.
9. CrashLog prüfen: `workarea:external-insert:done` darf für diesen Klick nur einmal auftauchen.

## Syntax-Check

Ausgeführt:

```bash
node --check main.js
node --check core/workarea-assembly-insert-and-variant-panel.v1.js
node --check ui/panels/WorkareaPanel.js
```
