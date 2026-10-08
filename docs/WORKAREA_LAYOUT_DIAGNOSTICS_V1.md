# Workarea Layout Diagnostics v1

Datum: 2026-05-15

## Ziel

Dieser Patch baut **noch keine finale Mobile-Shell**. Er misst zuerst zuverlässig, wie die Workarea auf verschiedenen Geräten tatsächlich gerendert wird.

Damit können wir iPhone, iPad hochkant, iPad quer und Desktop sauber unterscheiden, bevor wir das finale Mobile-/Tablet-Layout bauen.

## Neue Funktionen

### Layout-Badge

In der Workarea-Toolbar erscheint ein Badge:

- `Layout: mobile`
- `Layout: tablet`
- `Layout: desktop`

### Button `Layout JSON`

Kopiert einen kurzen Diagnose-Snapshot in die Zwischenablage. Dieser ist viel kleiner als der komplette Projekt-Snapshot.

Enthalten sind unter anderem:

- `window.innerWidth`
- `window.innerHeight`
- `devicePixelRatio`
- Orientierung: portrait/landscape
- erkannter Modus: desktop/tablet/mobile
- Dock-Zustände
- gespeicherte Workspace-Dock-Settings
- Canvas-Rechteck
- ViewportHost-Rechteck
- Shell-/Dock-Rechtecke
- Flags wie `canvasOffRight`, `canvasTooNarrow`, `leftVisibleButCollapsed`

### Button `Diag ↻`

Aktualisiert Diagnosewerte und Statuszeile manuell.

### Console Drawer

Wenn die Console geöffnet wird, steht dort eine kompakte Zusammenfassung der Layout-Diagnose.

## Breakpoint-Logik v1

- `mobile`: `innerWidth < 700` oder Phone-UA
- `tablet`: `>=700` und `<1024`, oder iPadOS hochkant unter ca. 1100 px
- `desktop`: ab Desktop-/iPad-Quer-Breite

Wichtig: Das ist Diagnose-Logik. Das finale Layout wird erst im nächsten Patch darauf aufgebaut.

## Geänderte Datei

- `ui/panels/WorkareaPanel.js`

## Test

1. Workarea auf iPhone öffnen.
2. `Layout JSON` drücken.
3. Ergebnis aus Zwischenablage hier posten.
4. Dasselbe auf iPad/Tablet hochkant.
5. Dasselbe auf iPad/Tablet quer.

Danach kann die Mobile-Shell gezielt gebaut werden, ohne Tablet und Handy zu vermischen.
