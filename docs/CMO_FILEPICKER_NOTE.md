# CMO Filepicker Hinweis

Der erste CMO-Step enthielt bereits `.cmo` in der `accept`-Liste. Einige Browser, vor allem iOS/Safari/Dateien-App, filtern proprietäre Dateitypen trotzdem zu streng. Deshalb wird der `accept`-Filter im AssetLab-Upload entfernt.

Die Dateityp-Prüfung bleibt im Import-Code:
- GLB/GLTF läuft über den normalen Import
- CMO wird über den CMO-Reader erkannt
- Unbekannte Dateien werden vom Importer abgelehnt bzw. als Fehler gemeldet
