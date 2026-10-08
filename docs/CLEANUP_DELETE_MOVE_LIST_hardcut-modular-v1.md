# Cleanup – Löschen / Verschieben (Hardcut modular v1)

Ziel: **Nur noch eine saubere Struktur** ohne Doppelwelten.
Nach dem Patch laufen wir über den neuen Bootpfad (`core/loader.js`).

## 1) Sofort löschen (Doppel-/Altwelt, wird nicht mehr genutzt)

### Root `core/` – Hall3D-spezifische Dateien (Doppelung)
Diese Dateien sind die alte „Root-Core“-Welt. Die Runtime nutzt **nur noch** `modules/hall3d/core/*`.

- `core/scene.js`
- `core/model-factory.js`
- `core/markers.js`
- `core/procedural-hall.js`
- `core/model-library.js`

> **Behalten:** `core/featureGate.js` und `core/loader.js` (App-Framework)

### Root `data/` – doppelte Hall-Daten
Die Hall3D-Daten liegen nun **ausschließlich** in `modules/hall3d/data/*`.

- `data/library.models.json`
- `data/presets.halls.json`

## 2) Optional verschieben (wenn du „Legacy“ behalten willst)

Statt löschen kannst du die Altwelt auch in einen klaren Legacy-Ordner verschieben:

- `core/scene.js` → `legacy/core/scene.js`
- `core/model-factory.js` → `legacy/core/model-factory.js`
- `core/markers.js` → `legacy/core/markers.js`
- `core/procedural-hall.js` → `legacy/core/procedural-hall.js`
- `core/model-library.js` → `legacy/core/model-library.js`
- `data/*` → `legacy/data/*`

Wichtig: **Legacy darf niemals importiert werden**. Nur als Archiv.

## 3) Nichts anfassen (wird aktiv gebraucht)

- `main.js` (neu: Bootstrap)
- `core/loader.js` (neu: echte Orchestrierung)
- `core/featureGate.js`
- `app/*` (bus/store/registry/menu)
- `modules/*` (core/layout/hall3d inkl. `modules/hall3d/core/*`)
- `defaults/*`
- `manifest-pack.json` + `plugins/*`
- `projects/*`

## 4) Nächster Konsistenz-Schritt (nach dem Cleanup)

Wenn der Cleanup durch ist, gibt es nur noch:

- App-Framework in `core/*`
- Modul-Logik in `modules/<modul>/*`
- Daten in `modules/<modul>/data/*` (oder global, aber nur wenn wirklich shared)

Dann können wir im nächsten Patch:

- Plugins (Tabs/Topbar) wirklich in UI einhängen
- Module automatisch aus `modules/*/module.json` laden (statt harter Map)