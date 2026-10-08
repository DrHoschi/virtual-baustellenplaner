# Baustellenplaner – Interfaces (Events + State)

Version: **v1.1.0-wizard-interfaces-v1**  
Datum: 2026-02-05

Ziel dieses Dokuments:
- **Einheitliche Event-Namen + Payloads** für Store, UI und Persistenz
- **Finales State-Schema** (ProjectState + UIState)
- Klarer Contract: *Panels besitzen keinen eigenen State*, sondern lesen/schreiben über Store/Bus

---

## 1) State-Schema (final)

### 1.1 ProjectState (Store-Key: `"project"`)

```js
{
  meta: {
    id: "P-2026-0001",
    name: "…",
    templateKey: "structure | sim_basic | analysis_basic | export_pro | …",
    createdAt: "ISO",
    updatedAt: "ISO",
    version: "1.0.0"
  },

  // project.json Äquivalent (Loader/Export)
  project: {
    id: "P-…",
    name: "…",
    modules: ["core", "layout", "hall3d"],
    pluginPack: "manifest-pack.json",
    settingsDefaults: [],
    settingsOverrides: []
  },

  // Gemergte Settings (defaults + overrides) – editierbar
  settings: { /* … */ },

  // Fachlicher Inhalt (Planung)
  model: {
    areas: [],
    objects: [],
    routes: [],
    modules: {
      // optional module buckets
      hall3d: {}
    }
  },

  // Nicht-kritisch, aber praktisch
  runtimeHints: {
    lastOpenPanel: null,
    flags: {}
  }
}
```

### 1.2 UIState (Store-Key: `"ui"`)

```js
{
  layout: {
    activePanelId: "project.general",
    panelSizes: {},
    collapsed: {}
  },
  inspector: {
    tabOrder: [],
    openTabs: [],
    filters: {},
    snapshotCollapsed: true
  },
  draft: {
    formDraftsByPanel: {}
  }
}
```

---

## 2) Commands (Bus → Store/Persist)

### 2.1 Projekt anlegen (Wizard)
**Event:** `req:project:create`

Payload:
```js
{
  templateKey: "structure",
  name: "Baustelle Musterhalle",
  type: "industriebau",
  uiPreset: "standard",
  modules: ["core","layout","hall3d"]
}
```

Callback:
- `cb:project:created` → `{ id: "P-2026-1234" }`

### 2.2 Projekt-State patchen
**Event:** `req:project:update`

Payload:
```js
{
  path: "meta.name" | "project.modules" | "settings.locale" | "model.areas" | …,
  op: "set" | "merge" | "push" | "remove",
  value: any
}
```

Callback:
- `cb:project:changed` → `{ path, op, value, state }`

### 2.3 UI-State patchen
**Event:** `req:ui:update`

Payload:
```js
{
  path: "layout.activePanelId" | "inspector.snapshotCollapsed" | …,
  op: "set" | "merge" | "push" | "remove",
  value: any
}
```

Callback:
- `cb:ui:changed` → `{ path, op, value, state }`

---

## 3) Persistenz-Events

- `cb:persist:loaded` → `{ key, meta }`
- `cb:persist:saved`  → `{ key, meta }`
- `cb:persist:status` → `{ ok: true }` oder `{ ok: false, error: "…" }`

---

## 4) Verantwortlichkeiten (Mapping)

- `app/store.js`
  - Single Source of Truth (in-memory)
  - Patch-Operationen (`req:project:update`, `req:ui:update`)
  - Emits `cb:project:changed`, `cb:ui:changed`

- `core/persist/app-persist.js`
  - Browser-only Persistenz (localStorage)
  - Autosave für Store-Keys `project` und `ui`
  - `createProject()` für Wizard

- `ui/panels/ProjectWizardPanel.js`
  - Nur UI/Flow (kein eigener Persistenz-Code)
  - Sendet `req:project:create` und reagiert auf `cb:project:created`
