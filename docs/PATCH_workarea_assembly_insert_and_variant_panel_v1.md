# PATCH_workarea_assembly_insert_and_variant_panel_v1

## Ziel

Dieser Patch legt den Grundstock für intelligente Baugruppen im Baustellenplaner an.
Er ist bewusst additiv gebaut, damit der aktuelle stabile Stand nicht gefährdet wird.

Enthalten sind:

- Rollenbahn Master
- Verschiebewagen Master
- Heber Master
- Rollenbogen Master
- Varianten je Baugruppe
- Stücklisten-Vorschau je Variante
- Anschluss-/Port-Vorbereitung für spätere Kabel- und Verbindungslinien
- kleines Baugruppen-Fenster in der Workarea

## Dateien

```text
/core/workarea-assembly-catalog.v1.js
/core/workarea-assembly-insert-and-variant-panel.v1.js
/docs/PATCH_workarea_assembly_insert_and_variant_panel_v1.md
```

## Einbau in index.html

Im Bereich der bestehenden Modul-Skripte einfügen:

```html
<!-- PATCH_workarea_assembly_insert_and_variant_panel_v1 -->
<script type="module" src="./core/workarea-assembly-insert-and-variant-panel.v1.js"></script>
```

Wichtig: Der Script-Pfad ist absichtlich `./core/...`, damit er auf GitHub Pages sauber relativ funktioniert.

## Was nach dem Patch sichtbar sein sollte

Unten links erscheint ein Button:

```text
▦ Baugruppen
```

Nach Klick öffnet sich das Baugruppenfenster mit:

1. Baugruppe auswählen
2. Variante auswählen
3. Name / Bereich / Fördergruppe / Maße / Skalierung setzen
4. Stückliste ansehen
5. Ports ansehen
6. In Workarea einfügen

## Technischer Hinweis

Der Patch versucht die Baugruppe auf mehreren Wegen an die Workarea zu übergeben:

1. Direkte bekannte Workarea-Methoden, falls vorhanden
2. Bus-/Custom-Events:
   - `bp:workarea:assembly:insert`
   - `workarea:assembly:insert`
   - `workarea:add-object`
   - `workarea:object:add`
   - `workarea:scene:add-object`
3. Fallback-Warteschlange in localStorage:
   - `baustellenplaner:workarea:pending-assemblies:v1`

Damit ist der Patch CI-sicher und vorbereitet, auch wenn der konkrete Workarea-Insert-Handler später noch sauber im WorkareaPanel angebunden wird.

## Nächste sinnvolle Erweiterung

Wenn der Button und das Panel sauber laufen, sollte im nächsten Patch die echte Workarea-Integration fest verdrahtet werden:

```text
PATCH_workarea_assembly_real_scene_binding_v1
```

Dort würde dann WorkareaPanel direkt auf `bp:workarea:assembly:insert` hören und `assembly.instance` wie normale Workarea-Objekte rendern, speichern, exportieren und importieren.
