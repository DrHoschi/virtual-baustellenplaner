# PATCH_workarea_stability_mobile_v1

Ziel: iPhone/iPad-Stabilität nach den datenreichen AssemblyLab-/Kabel-/EPLAN-Erweiterungen verbessern.

## Änderungen

1. **Schwere Workarea-Modi werden nicht mehr als Startmodus gespeichert**
   - `place`, `edit`, `measure`, `sim` bleiben in der aktuellen Sitzung nutzbar.
   - Beim Persistieren des Workarea-UI-States wird als stabiler Startmodus nur `select` oder `pan` gespeichert.
   - Dadurch startet die Workarea nach Reload/Crash nicht mehr direkt in `place` oder `edit` und baut nicht sofort schwere Properties/Place-Kontexte auf.

2. **Place-Asset wird beim Restore nicht mehr automatisch als schwere Selection aufgebaut**
   - Place-Kontext-IDs bleiben gespeichert.
   - Die komplette ProjectAsset-Struktur wird beim Mount aber nicht mehr automatisch in die Selection gelegt, solange der Startmodus nicht `place` ist.

3. **Identische Scene-Snapshots werden nicht erneut gespeichert**
   - `_persistSceneToStore()` vergleicht den letzten Scene-Snapshot.
   - Wenn sich nichts geändert hat, wird Store/Projekt-Save übersprungen.
   - CrashLog-Ereignis: `workarea:scene:persist:skip-same`.

## Testplan

1. Patch einspielen.
2. Seite hart neu laden.
3. Workarea muss im Select-Modus starten, nicht dauerhaft in Place/Edit hängen bleiben.
4. In Place wechseln, ein paarmal tippen, dann zurück in Select.
5. Seite neu laden: Start wieder Select.
6. Objekt auswählen, Edit/Properties öffnen.
7. Keine `window:error` prüfen.
8. CrashLog prüfen: weniger große `workarea:scene:persist`-Events, optional `workarea:scene:persist:skip-same`.

## Enthaltene Datei

- `ui/panels/WorkareaPanel.js`
