# Baustellenplaner – Interface‑Dokument (Events + Payloads)

Version: **v1.2.1 (2026‑02‑05)**

Dieses Dokument ist die **finale** Vereinbarung für Event‑Namen & Payload‑Struktur.
Alle Module/Panel‑Implementierungen richten sich daran aus.

> Hinweis: Wir halten Events bewusst „flach“ und serialisierbar.

---

## 1) Bus‑Konvention

- **Prefixe**
  - `req:*` → Anfrage (Request)
  - `cb:*` → Callback/Notification

- **Payload**
  - immer ein Plain Object
  - keine DOM‑Refs, keine Funktionen
  - wenn möglich: `{ source: "...", ts: Date.now(), ... }

---

## 2) Core: Store

### `cb:store:patch`

Wird gefeuert, wenn `store.update()` einen Patch erzeugt hat.

Payload:
```js
{ key: "app", patch: { ... }, next: { ... }, prev: { ... } }
```

### `req:store:snapshot`

Anfrage an den Store, einen Snapshot zu liefern.

Payload:
```js
{ key: "app" }
```

Antwort:

### `cb:store:snapshot`

Payload:
```js
{ key: "app", state: { ... } }
```

---

## 3) Core: Persistenz

### `cb:persist:loaded`

Wird nach dem Laden eines Projekts (oder Default) gefeuert.

Payload:
```js
{ projectId: "local_..." | "...", source: "localStorage" | "defaults" }
```

### `cb:persist:saved`

Wird nach erfolgreichem Persist‑Flush gefeuert.

Payload:
```js
{ projectId: "...", savedAt: "2026-..." }
```

---

## 4) Project Wizard

### `req:project:createLocal`

Wizard fordert an, ein Projekt im localStorage anzulegen.

Payload:
```js
{
  name: "...",
  type: "industriebau" | "conveyor_sim" | "...",
  uiPreset: "standard" | "...",
  modules: ["core","layout"],
  meta: { customer?: "...", location?: "..." }
}
```

Antwort:

### `cb:project:createdLocal`

Payload:
```js
{ projectId: "local_...", urlParam: "local:local_..." }
```

---

## 5) Project List

### `req:project:listLocal`

Optional (später): Liste nicht durch Key‑Scan, sondern über Index.

Payload:
```js
{ includeBroken: true }
```

Antwort:

### `cb:project:listLocal`

Payload:
```js
{ projects: [{ id,name,type,savedAt,modules }] }
```

---

## 6) UI

### `cb:ui:activePanelChanged`

Payload:
```js
{ anchor: "projectPanel", tabId: "wizard", key: "projectPanel:wizard" }
```

---

## 7) Hinweise zur Implementierung

- Panels besitzen **keinen** eigenen Langzeit‑State.
- Alles, was beim Tabwechsel erhalten bleiben soll, wird über `PanelBase` Draft‑Persistenz nach `app.ui.drafts[...]` geschrieben.
- Persistenz wird zentral über `core/persist/app-persist.js` erledigt.
