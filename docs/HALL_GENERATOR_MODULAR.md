# Modularer Hallengenerator (Bays) – Kurz-Doku

Stand: 2026-02-26

## Ziel
Eine **parametrierbare Stahlhalle** als stabile Basis für den späteren Hallengenerator:
- **Stützenabstand** (`bayLength`) frei einstellbar
- **Anzahl Segmente** (`bays`) frei einstellbar
- Breite, Traufhöhe, Firsthöhe etc. parametrierbar

Im Projekt gibt es dafür zwei Bausteine:
1) **Prozedurale Bays-Halle** (Three.js Primitives) – sofort nutzbar
2) Optional: **GLB Bay-Modul** (ein Segment als Modell) – für späteres Instancing

---

## 1) Prozedural (sofort nutzbar)

### Dateien
- `modules/hall3d/core/procedural-hall.js`
- `modules/hall3d/data/presets.halls.json`

### Preset
In `modules/hall3d/data/presets.halls.json` existiert:
- `hall_modular_bays_v1`

Parameter (Beispiel):
```json
{
  "presetId": "hall_modular_bays_v1",
  "overrides": {
    "bayLength": 6,
    "bays": 10,
    "width": 18,
    "eaveH": 7,
    "roofPeakH": 9
  }
}
```

### Wirkung
- Gesamtlänge = `bayLength * bays`
- Frames (Stützen + Querträger) = `bays + 1`

---

## 2) GLB Bay-Modul (optional / für Instancing)

### Datei
- `assets/models/halls/stahlhalle_modular.glb`

### Eintrag in Library
- `modules/hall3d/data/library.models.json`

Model-ID:
- `stahlhalle_bay_glb_v1`

### Idee für später
Der Hallengenerator kann das Segment entlang X instanzieren:
- Offset pro Segment = `i * bayLength`

Im GLB sind Debug-Anker enthalten:
- `ANCHOR_A` (x=0)
- `ANCHOR_B` (x=bayLength)

---

## Wo kommt was hin?

> Pfade sind **Repo-Root** relativ.

- `assets/models/halls/stahlhalle_modular.glb`
- `modules/hall3d/data/library.models.json`
- `modules/hall3d/data/presets.halls.json`
- `modules/hall3d/core/procedural-hall.js`

---

## Quick-Test
1) Patch-Dateien ins Repo kopieren
2) App starten
3) In Hall3D per Event `req:hall3d:rebuild` mit `presetId: "hall_modular_bays_v1"` rebuilden
   (oder im Store/State `hall3d.presetId` entsprechend setzen)

