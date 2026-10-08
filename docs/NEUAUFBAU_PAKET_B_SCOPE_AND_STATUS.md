# Neuaufbau Paket B – 2D-Workarea

Stand: 08.10.2026  
Branch: `dev/planner-neuaufbau`  
Status: Umsetzung und Verifikation laufen; `main` bleibt unverändert.  
Ausgangsstand: `1b571433af8adfdb774843fed07e58301946d33c`

## Ziel

Paket B macht die Paket-A-Projektgrundlage zu einer tatsächlich bearbeitbaren 2D-Workarea. Ein leeres Raster allein gilt nicht als Ergebnis.

## Lieferumfang

- Baustellenbereich als ganze Halle, Hallenteil oder freie Fläche mit editierbarer Breite und Länge;
- PNG/JPEG-Grundriss als Hintergrund und Zwei-Punkt-Maßstab mit direkter Punktwahl auf dem Bild, sichtbaren A/B-Markern, Zoom, Verschieben und Feinjustierung;
- 2D-Ansicht mit Maßraster, Flächenumriss, Einpassen, Zoom und Verschieben der Ansicht;
- generische Planobjekte mit Objekt-ID, Position X/Y, Breite/Tiefe, Drehung und Ebene;
- Objekt auswählen, auf der Fläche verschieben, in einer Objektliste wiederfinden und im Eigenschaftenbereich bearbeiten; Objekte aller sichtbaren Ebenen bleiben unabhängig von der aktiven Platzierungsebene sichtbar;
- Ebenen anlegen, auswählen, Höhe in Millimetern festlegen und Sichtbarkeit schalten; die Objekthöhe folgt der aktiven Ebene;
- Undo/Redo sowie Speichern und Wiederherstellen nach Neuladen;
- breite Layoutprüfung auf iPad quer/Desktop-Klasse sowie Hochkantprüfung auf iPhone/iPad.

Kameratypen/FOV, Kabeltrassen, Kabelverbindungen, Messprotokolle, 3D-Ansicht, Cloud-Synchronisierung, Kundenschlüssel und globale Assetbibliothek bleiben separate Folgepakete. Generische Planobjekte sind nur die neutrale Grundlage; sie behaupten keine Kamera- oder Elektrofachfunktion.

## Datenvertrag

Projekte behalten `baustellenplaner.rebuild.project`, Formatversion 1, Millimeter und `x-right-y-up-z-up`. `layers[]` ergänzt Ebene-ID, Namen, Höhe in mm und Sichtbarkeit. `objects[]` erhält stabile IDs, Typ, Modul, Layer-ID, Lage, Abmessungen und Drehung. Alte Paket-A-Projekte ohne `layers[]` werden beim Öffnen mit einer Bodenebene ergänzt; Paket-A-Projekte und deren Dateien bleiben lesbar.

Die Objektgeometrie wird relativ zum Projektursprung gespeichert. Ein kalibrierter Grundriss bestimmt die Pixel-zu-mm-Transformation. Ohne bestätigten Maßstab werden keine belastbaren Weglängen angezeigt; Objektplatzierung ist bis zu bestätigten Flächenmaßen oder Kalibrierung gesperrt.

## Prüfungen

Der Paket-B-Browserlauf prüft Projektanlage, Flächenmaße, Objektplatzierung/-benennung, Layer-Anlage, Undo/Redo, Speichern/Neuladen, sichtbare Objekte aus mehreren Ebenen nach Reload und Hochkant-Überlauf. Die Kalibrierungsprüfung setzt beide Punkte direkt im Bild, prüft Marker und Pixelwerte vor dem Speichern und stellt die Marker nach Reload wieder her. Die bestehende Paket-A-Suite einschließlich Projektvertrag, Kalibrierung, Dateiübertragung und Speicherung läuft zusätzlich. Der Browserlauf ersetzt nicht die reale Safari-Abnahme auf iPhone und iPad.
