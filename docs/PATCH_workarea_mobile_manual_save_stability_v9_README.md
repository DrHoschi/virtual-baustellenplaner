# PATCH_workarea_mobile_manual_save_stability_v9

Ziel: iPhone/Safari stabilisieren, nachdem v7/v8 die Detail-Editor- und Tab-Persist-Pfade bereits entschärft haben.

## Änderung

- `main.js` lädt den alten `workarea-autosave-drag-guard.v1_3.js` auf Mobile/iOS nicht mehr.
- `core/workarea-mobile-manual-save-stability.v9.js` schaltet die Workarea auf Mobile in einen Manual-Save-Modus.
- Automatische Workarea-Projekt-Saves werden blockiert.
- Pending Autosave-/Idle-Timer werden nach Pointer-Ereignissen gelöscht.
- Ein kleiner mobiler Button **Speichern** löst einen bewussten Projekt-Save aus.
- `index.html` lädt v9 direkt vor `main.js`.

## Erwartete Crashlog-Meldungen

Gut:

```text
workarea:autosave:disabled-mobile:v9
workarea:autosave:blocked-mobile:v9
workarea:autosave:timers-cleared:v9
workarea:manual-save-button:ready:v9
workarea:manual-save:requested:v9
```

Nicht mehr gut im normalen mobilen Arbeiten:

```text
workarea:save:global-input
workarea:save:idle-scheduled
workarea:save:rescheduled-after-gesture
workarea:save:emit
```

Ausnahme: `workarea:save:emit` darf nach Klick auf den manuellen Speichern-Button erscheinen.

## Test

1. Patch einspielen.
2. Safari hart neu laden.
3. Workarea öffnen.
4. Tabs wechseln, Objekt anklicken, Detailfelder testen.
5. 30–60 Sekunden warten.
6. Seite darf nicht neu laden.
7. Erst danach den Button **Speichern** drücken.
8. Crashlog prüfen.

