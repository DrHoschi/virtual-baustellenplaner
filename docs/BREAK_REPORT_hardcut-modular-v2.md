# BREAK REPORT – hardcut-modular-v2

Stand: 2026-02-04

## Was v2 behebt

1) **Layout hat jetzt eine echte View**
- In v1 stand bei "Baustellenlayout" nur: *"Keine View registriert"*.
- v2 liefert `modules/layout/view.js` und der Router kann "layout" mounten.

2) **Plugins sind jetzt "live" im Menü**
- `manifest-pack.json` + `plugins/*.json` werden bereits in v1 geladen und im Store abgelegt.
- v2 nutzt zusätzlich `plugin.ui.menuEntries` und erzeugt daraus Menüpunkte.
- Klick auf Plugin-Menüpunkt öffnet ein *Panel-View* als virtuelle Ansicht.

## Verhalten im UI
- Module wie `core/layout/hall3d` bleiben wie gehabt.
- Zusätzlich erscheinen Menüeinträge aus Plugins (Allgemein, Workspace, Sim, Analyse, Export, Assets, Settings …)
- Plugin-Views zeigen aktuell eine Debug-/Snapshot-Ansicht (kein fertiges Formular-UI).

## Nächster Ausbauschritt (v3+)
- Panel-Views als echte Tabs/Inspector-UI (Buttons, Icons, Docking)
- Settings-Forms aus `plugin.settings` automatisch generieren
- FeatureGate `requires` aktiv auswerten (dev/release)
