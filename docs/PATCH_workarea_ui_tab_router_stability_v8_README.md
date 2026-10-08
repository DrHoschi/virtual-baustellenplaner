# PATCH_workarea_ui_tab_router_stability_v8

## Ziel
Nach v7 sind die Detail-Editor-Saves weitgehend abgefangen. Der neue Crashlog zeigt aber weiter Neustarts im Umfeld von:

- Workarea `unmount` / `viewport:unmount`
- anschließendem `viewport:mount`
- `workarea:ui:persist` wegen `leftTab`
- URL-Wechseln mit `?project=local:...`

## Inhalt

- `core/loader.js`
  - ignoriert erneute Navigation auf dasselbe aktive Panel
  - verhindert unnötiges `currentPanel.unmount()` + `mount()` bei gleicher Workarea-Auswahl

- `core/workarea-ui-tab-stability.v8.js`
  - blockiert auf Mobile/iOS den Store-Persist nur für `leftTab`/`rightTab`
  - Tabwechsel bleiben in der laufenden Sitzung erhalten
  - keine dauerhafte Speicherung der Tab-Auswahl während des Stabilitätstests
  - normale Projekt-/Scene-Saves bleiben unverändert

## Erwartung im Crashlog

Gut:

```text
loader:same-panel-select:ignored:v8
loader:same-panel-switch:ignored:v8
workarea:ui:persist:blocked:v8
workarea:unmount:trace:v8
```

Nicht mehr gut:

```text
workarea:unmount
workarea:viewport:unmount
```

direkt nach einem simplen Tabwechsel oder erneutem Klick auf das aktive Workarea-Menü.

## Test

1. Patch einspielen.
2. Safari hart neu laden.
3. Workarea öffnen.
4. Zwischen Struktur / Baugruppen / Einfügen wechseln.
5. Nicht speichern, nur 30 Sekunden beobachten.
6. Crashlog prüfen.

