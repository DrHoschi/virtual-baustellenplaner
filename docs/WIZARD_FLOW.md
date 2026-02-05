# Baustellenplaner – Wizard‑Flow (Text + Mini‑Mock)

Version: **v1.2.1 (2026‑02‑05)**

Ziel: Ein neues Projekt **browser‑only** als JSON im `localStorage` erzeugen und direkt öffnen.

---

## 1) Grundidee

Der Wizard hat zwei Arten von „Speichern“:

1) **💾 Speichern** (oben in der Toolbar)
   - schreibt den aktuellen Form‑Draft in den Store (`app.ui.wizardDraft`)
   - dient als „Zwischenstand“ und aktiviert zusätzlich die Draft‑Persistenz

2) **„Projekt anlegen (localStorage)“** (unten)
   - erzeugt eine echte `project.json`‑ähnliche Projektdatei
   - legt sie unter `baustellenplaner:projectfile:<id>` ab
   - setzt `?project=local:<id>` und lädt die Seite neu

---

## 2) States (Wizard‑intern)

Wir halten den Wizard UI‑seitig bewusst simpel. Technisch reicht:

- **DRAFT** (Eingaben ändern)
- **DIRTY** (ungespeichert)
- **SAVED** (nur Draft gespeichert)
- **CREATED** (Projektdatei erzeugt → Reload)

Die Zustände werden bereits durch `PanelBase` (dirty/savedAt) und den Store abgedeckt.

---

## 3) Datenfluss

### 3.1 Eingabe ändern

User ändert ein Feld → `markDirty()` → Save‑Button aktiv.

Außerdem: Draft wird automatisch in `app.ui.drafts["project.wizard"]` gepuffert (iOS‑Reload/Tab‑Wechsel‑sicher).

### 3.2 💾 Speichern

`applyDraftToStore(draft)`:

- validiert Minimalanforderungen (z. B. Name nicht leer)
- schreibt in `app.ui.wizardDraft`
- setzt „Gespeichert (Uhrzeit)“
- leert persisted draft (weil Daten jetzt im Store sind)

### 3.3 Projekt anlegen

- nimmt bevorzugt `app.ui.wizardDraft`
  - fallback: aktueller Panel‑Draft
- erstellt `{ schema, id, name, type, createdAt, uiPreset, modules }`
- `localStorage.setItem("baustellenplaner:projectfile:<id>", JSON.stringify(project))`
- navigiert auf `?project=local:<id>` (Reload)

---

## 4) Mini‑Mock (Layout)

```
┌───────────────────────────────────────────┐
│ Projekt – Neu (Wizard)                    │
│  [↩︎ Reset]   [💾 Speichern]   🟡 Ungespe… │
│  Hinweis: localStorage JSON, Export später│
├───────────────────────────────────────────┤
│ Projektbasis                               │
│  Projektname   [______________________]    │
│  Projekt‑Typ    [ Industriebau        ▼]    │
│  UI Preset      [ Standard            ▼]    │
├───────────────────────────────────────────┤
│ Module (Startpaket)                        │
│  [x] Core (core)           deps: –         │
│  [x] Baustellenlayout      deps: core      │
│  [ ] 3D Halle              deps: core      │
├───────────────────────────────────────────┤
│ Fertig                                     │
│  [ Projekt anlegen (localStorage) ]        │
└───────────────────────────────────────────┘
```

---

## 5) Nächste Ausbaustufe (optional)

- Projekt anlegen **ohne Reload** (Session‑Switch) – später.
- „Vorlagen“ (Templates) pro Projekt‑Typ.
- Automatischer Eintrag in „Projektliste“ (Index‑Key) zusätzlich zum Key‑Scan.
