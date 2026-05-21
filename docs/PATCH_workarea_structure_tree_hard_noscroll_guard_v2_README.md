# PATCH_workarea_structure_tree_hard_noscroll_guard_v2

Datum: 2026-05-21

## Zweck

Dieser Hotfix behebt das weiterhin auftretende Springen des linken Strukturbaums beim Anklicken eines Objekts im Workarea-Viewer.

Der vorherige NoScroll-Patch hat die neue Sync-Methode beruhigt. In den älteren Strukturbaum-Patches existieren aber noch lokale `setTimeout(... scrollIntoView ...)`-Aufrufe. Diese liefen später nach und konnten den Baum trotzdem wieder zum Objekt springen lassen.

## Verhalten danach

- Klick im Viewer markiert das Objekt im Strukturbaum.
- Nötige Elternknoten werden geöffnet.
- Der linke Strukturbaum behält seine aktuelle Scrollposition.
- Klicks im Strukturbaum funktionieren weiter.
- Properties bleiben synchron.

## Technische Änderung

Zusätzlich zu den bisherigen Patch-Methoden blockiert dieses Modul `scrollIntoView()` nur für Elemente innerhalb `.wa-structure-tree`. Andere Bereiche der App bleiben davon unberührt.

Außerdem werden mögliche Scroll-Container mehrfach gesichert und wiederhergestellt, weil Safari/iPad Scrollbewegungen oft verzögert im nächsten Layout-Frame ausführt.

## Einbindung

In `index.html` nach dem vorherigen NoScroll-Patch laden:

```html
<script type="module" src="./core/workarea-structure-tree-selection-sync-noscroll.v1.js?v=1"></script>
<script type="module" src="./core/workarea-structure-tree-hard-noscroll-guard.v2.js?v=1"></script>
```
