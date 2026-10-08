# PATCH_mobile_autosave_after_drag_v12

Dieses Patch-ZIP ersetzt nur eine Datei:

```text
core/workarea-mobile-save-hardcut.v11.js
```

Der Dateiname bleibt absichtlich `v11.js`, damit die vorhandene `index.html` nicht erneut angepasst werden muss. Inhaltlich ist es die neue v12-Logik.

## Ziel

- In der Workarea soll nach Verschieben/Platzieren automatisch gespeichert werden.
- Der schwebende Button bleibt als Statusanzeige:
  - orange: Änderung erkannt
  - blau: speichert gerade
  - grün: gespeichert
- Kein alter v9/v10-Mehrfach-Timer mehr.
- Kein Save während Drag.
- Save erst nach `workarea:scene:persist`, damit der Store bereits den neuen Zustand enthält.
- Dirty/Status wird vor dem schweren Persist sichtbar gesetzt, damit iPhone/Safari schneller reagiert.
- Bei `pagehide`/`visibilitychange hidden` wird ein Not-Save versucht.

## Erwartete Crashlog-Zeilen

Nach Drag-Ende sollte ungefähr Folgendes kommen:

```text
workarea:mobile-save:dirty:v12
workarea:scene:persist
workarea:mobile-save:autosave-scheduled:v12
workarea:mobile-save:saving:v12
workarea:mobile-save:emit:v12
workarea:mobile-save:saved:v12
```

Nicht mehr dauerhaft:

```text
workarea:manual-save-dirty:v10-installed
workarea:mobile-manual-save:v9-installed
```

## Test

1. iPhone/iPad: Seite hart neu laden.
2. Workarea öffnen.
3. Objekt verschieben.
4. Button sollte direkt orange/blau werden und danach grün.
5. Es darf kein manueller Klick nötig sein.
6. Danach Safari/Seite neu laden und prüfen, ob die Position erhalten bleibt.

## Checks

```bash
node --check core/workarea-mobile-save-hardcut.v11.js
node scripts/import-graph-check.mjs
npx playwright test tests/ui-wiring.spec.js
```
