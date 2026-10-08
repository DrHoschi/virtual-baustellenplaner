# Baustellenplaner – State‑Schema (1 Seite, final)

Version: **v1.2.0 (2026‑02‑05)**

Ziel: **Single Source of Truth** = `app/store.js`.

Dieses Dokument beschreibt den *minimalen* stabilen State, den wir für Wizard,
Projekt‑Metadaten, Persistenz, UX‑Status (Dirty / SavedAt) und Projektliste brauchen.

---

## 1) Store‑Namespaces

Der Store hält mehrere Top‑Keys. Wir nutzen bewusst ein einfaches Namens‑Schema:

```js
store.get("core") // Core & Debug
store.get("app")  // App‑State (SSOT)
```

Nur `app` wird persistiert (in Teilen).

---

## 2) app‑State (SSOT)

```js
app = {
  project: {
    id: "P-2026-0001",        // aus project.json oder localStorage‑Projekt
    name: "...",
    type: "industriebau",
    customer: "...",
    location: "...",
    // ... weitere Metadaten
  },

  settings: {
    // Ergebnis aus Defaults + Overrides (JSON Merge)
  },

  plugins: {
    pack: { packId, version, plugins: [...] },
    manifests: [ ... ],
    gate: { appMode: "dev", enabled: true }
  },

  ui: {
    drafts: {
      // Panel‑Drafts (unapplied Form Inputs)
      "project.general": { ... },
      "project.wizard":  { ... }
    },

    // "Gespeicherter" Wizard‑Zwischenstand (Apply‑Button)
    wizardDraft: {
      name: "...",
      type: "industriebau",
      uiPreset: "standard",
      modules: ["core", "layout"]
    }
  }
}
```

**Wichtig:**
- `ui.drafts[...]` ist *UX‑Komfort* (Tabwechsel/Reload ohne Datenverlust).
- `ui.wizardDraft` ist *bewusstes* Speichern im Wizard (💾).

---

## 3) Persistenz (localStorage)

### 3.1 Projektdateien (Wizard‑Anlage)

Wizard erzeugt eine **Projektdatei** (das ist das, was später als `project.json` exportiert wird):

```
baustellenplaner:projectfile:<PROJECT_ID>
```

Inhalt: `schema, id, name, type, createdAt, uiPreset, modules, ...`

### 3.2 App‑Persistenz (Session‑State)

`core/persist/app-persist.js` speichert App‑State pro Projekt:

```
baustellenplaner:project:<PROJECT_ID>
```

Aktuell persistieren wir:
- `app.project`
- `app.settings`
- `app.ui.drafts` *(damit Formular‑Drafts stabil bleiben)*

---

## 4) Verantwortung / Dateimapping

**Verantwortungen sind strikt getrennt:**

- `app/store.js`
  - State halten, `get/update/set`, Events feuern

- `core/persist/app-persist.js`
  - Speichern/Laden (`localStorage`) + Debounce

- `ui/panels/*.js`
  - Nur UI/Flow
  - Kein eigener State‑Besitz (außer kurzfristige Render‑Refs)
  - Drafts gehen über Store (`app.ui...`)

- `ui/components/Toolbar.js`
  - UI‑Darstellung von Status + Save
  - `__setApplyEnabled` wird durch PanelBase gesteuert

---

## 5) Dirty‑/Save‑Semantik (UX)

PanelBase führt:
- `this._dirty` (true/false)
- `this._savedAt` (ISO/Zeitstring)

Regeln:
- Eingabe => `markDirty()` => Save‑Button aktiv
- Apply => `applyDraftToStore()` + `savedAt` setzen + Save‑Button deaktiv
- Reset => Draft aus Store neu laden + Save‑Button deaktiv

---

## 6) Nächste Ausbaustufe (geplant)

- Projektliste als "Index" (zusätzlich zu Key‑Scan):
  - `baustellenplaner:projects:index` (Array von IDs + Meta)

- Multi‑Project Switcher (ohne Reload) – optional später.
