# BREAK REPORT – hardcut-modular v3.4.2-fix

## Problem
Auf GitHub Pages wurde **ui/panels/PanelBase.js** als sehr kleine Stub-Version ausgeliefert.
Dadurch funktionieren Panels (Draft/Render/Dirty/Save) nicht zuverlässig und Scroll-Änderungen greifen nicht.

## Fix
- ui/panels/PanelBase.js: volle PanelBase wiederhergestellt + Scroll-Wrapper (.panel-content-wrap)
- ui/css/ui-core.css: stellt sicher, dass .panel-content-wrap scrollen kann

## Deployment-Hinweis
Nach Commit/Push: GitHub Pages braucht i.d.R. 1–2 Minuten. Danach Hard Reload.
