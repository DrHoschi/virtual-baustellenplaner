# BREAK REPORT – hardcut-modular-v3.2

Datum: 2026-02-04

## Ziel
- **Sichtbarer Speicherbutton** im Panel („💾 Speichern“)
- Änderungen bleiben erhalten:
  - beim Tab-Wechsel (Remount)
  - nach Reload (Browser)
- Grundlage für alle weiteren Tabs/Editoren.

## Was wurde geändert

### 1) Panel Toolbar (UI)
- `ui/components/Toolbar.js`
  - Toolbar ist jetzt **sticky** (immer sichtbar auf Mobile)
  - Button heißt „💾 Speichern“ (statt Apply)
  - Statusanzeige: 🟡 Ungespeichert / 🟢 Gespeichert (Uhrzeit)

### 2) PanelBase (Dirty/Save)
- `ui/panels/PanelBase.js`
  - `markDirty()` / `markSaved()`
  - Status in Toolbar
  - Reset & Speichern zentral vereinheitlicht

### 3) Projekt → Allgemein
- `ui/panels/ProjectGeneralPanel.js`
  - jede Änderung markiert `Ungespeichert`
  - Speichern schreibt in `store.update("app", ...)`

### 4) Persistenz (Browser)
- `core/persist/app-persist.js` (NEU)
  - Speichert `app.project` und `app.settings` in localStorage
  - Key: `baustellenplaner:project:<projectId>`
  - Auto-Save über `cb:store:changed` (debounced)

### 5) Loader
- `core/loader.js`
  - lädt persisted state beim Start und merged als Override
  - aktiviert Auto-Save Persistor

## Was ist NICHT enthalten
- Kein „project.json überschreiben“ (Static Hosting).
- Export (Download) kommt als nächster Patch (v4).

## Abnahmetest
1. Projekt → Allgemein öffnen
2. Name ändern → Status zeigt 🟡 Ungespeichert
3. 💾 Speichern klicken → 🟢 Gespeichert (Zeit)
4. Tab wechseln → zurück → Wert bleibt
5. Seite neu laden → Wert bleibt
