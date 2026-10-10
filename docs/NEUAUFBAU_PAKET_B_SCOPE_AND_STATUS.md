# Neuaufbau Paket B – 2D-Workarea

Stand: 10.10.2026  
Branch: `dev/planner-neuaufbau`  
Produktstand getestet: `a974918135642ad2a0650bd00d61ce1add07f4f1`  
`main`: `be0061f6cca67c30adee8b476e8ea0265707ab18` (unverändert)

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

## Automatisierte Prüfungen

Der Paket-B-Browserlauf prüft Projektanlage, Flächenmaße, Objektplatzierung/-benennung, Layer-Anlage, Undo/Redo, Speichern/Neuladen, sichtbare Objekte aus mehreren Ebenen nach Reload und Hochkant-Überlauf. Die Kalibrierungsprüfung setzt beide Punkte direkt im Bild, prüft Marker und Pixelwerte vor dem Speichern und stellt die Marker nach Reload wieder her. Die bestehende Paket-A-Suite einschließlich Projektvertrag, Kalibrierung, Dateiübertragung und Speicherung läuft zusätzlich.

## Manuelle Praxisergebnisse

Der Nutzer bestätigt die folgenden Abläufe auf dem iPhone im Hochformat und dem iPad im Querformat als ausreichend getestet:

- Grundriss kalibrieren; die A/B-Punkte auf dem Bild sehen und die Kalibrierungsansicht schließen;
- den Grundriss in der Workarea anzeigen und zoomen;
- Planobjekte platzieren, verschieben und in der Größe ändern;
- Verschieben mit Undo/Redo rückgängig machen und wiederholen;
- speichern und neu laden; die verschobene Objektposition bleibt erhalten.

Der Nutzer bewertet die auf beiden Geräten grob gesetzten Kalibrierpunkte als praktisch ausreichend. Die Mitschnitte zeigten ungefähr 165,422 mm/px auf dem iPhone und 161,412 mm/px auf dem iPad. Die Abweichung von rund 2,4 % wird im Rahmen der groben Touch-Punktwahl als plausibel akzeptiert; dies ist keine Vermessungs- oder Genauigkeitszusage.

Gerätebelege aus dem Gespräch: `ScreenRecording_10-09-2026 10-27-50_1.mp4` (iPhone) und `ScreenRecording_10-09-2026 22-47-08_1.mp4` (iPad quer), ergänzt durch die anschließende Nutzerbestätigung von Platzieren, Verschieben, Größenänderung, Undo/Redo und Save/Reload auf beiden Geräten. Der Nutzer hat ausdrücklich erklärt, dass diese Tests ausreichen; es werden keine weiteren manuellen Tests für Paket B angefordert.

Diese Abnahme gilt für den vom Nutzer getesteten Interaktionsumfang auf iPhone hochkant und iPad quer. Sie erklärt weder den gesamten Baustellenplaner noch Kamera-/Elektrofachfunktionen für einsatzbereit. `main` bleibt unverändert.

