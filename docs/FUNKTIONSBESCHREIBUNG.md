# Baustellenplaner – Funktions- & Architekturübersicht

Version: 1.0  
Status: Architektur-Dokumentation (Arbeitsstand)

---

# 1. Ziel des Systems

Der Baustellenplaner ist ein modular aufgebautes Projekt- und 3D-Planungssystem.

Ziel:
- Projekte strukturiert anlegen
- 2D/3D Inhalte verwalten
- Modelle (GLB oder prozedural) laden oder generieren
- Simulation und Analyse ermöglichen
- Erweiterbar über Plugin-Module

Das System ist vollständig modular aufgebaut.

---

# 2. Gesamtstruktur (High-Level)

index.html  
→ boot.js  
→ Registry  
→ FeatureGate  
→ Plugin-Loader  
→ UI + Panels  
→ Workspace / 3D Engine  

Alle Module kommunizieren über einen zentralen Event-Bus.

---

# 3. Projektfluss (User Journey)

## 3.1 Projekt anlegen (Wizard)

Modul: ProjectWizardPanel

Zweck:
- Neues Projekt anlegen
- Grunddaten erfassen:
  - Projektname
  - Kunde
  - Standort
  - Modelltyp (GLB / Procedural)
  - Dimensionen (bei Hallen z.B. Länge, Breite, Raster, Höhe)

Ergebnis:
- project.json wird erzeugt
- project.model wird gesetzt:
  - { type: "glb", path: "..." }
  - oder { type: "procedural", preset: "hall_01" }

Nach Abschluss:
→ Event: cb:project:created
→ Wechsel in Workspace

---

## 3.2 Projektliste

Modul: ProjectListPanel

Zweck:
- Bestehende Projekte anzeigen
- Öffnen
- Duplizieren
- Löschen

Speicherung:
- IndexedDB / LocalStorage (später optional Server)

---

## 3.3 Workspace (Arbeitsbereich)

Modul: WorkspacePanel

Zweck:
- Aktives Projekt anzeigen
- 3D Szene rendern
- ModelFactory laden
- Tools aktivieren

Komponenten:
- 3D Engine (Three.js)
- Kamera
- Selection
- Outline
- Marker-System
- Layer-System

Events:
- cb:model:loaded
- cb:selection:changed
- cb:simulation:start

---

# 4. ModelFactory

Verantwortlich für:
- GLB laden
- Procedural Modell generieren
- Presets anwenden

Datenquellen:
- library.models.json
- presets.halls.json

Unterscheidung:

GLB:
- Extern gespeicherte Datei
- Wird importiert

Procedural:
- Wird per Parameter generiert
- Parametrisch veränderbar

---

# 5. Registry-System

Modul: app/registry.js

Zweck:
- Zentrale Definition aller Module
- Panels
- Tools
- Topbar Buttons
- FeatureFlags

Registry ist:
→ rein deklarativ  
→ keine Logik

---

# 6. Event-Bus

Modul: app/bus.js

Zweck:
- Lose Kopplung
- Module kennen sich nicht direkt

Beispiel:

Wizard → bus.emit("cb:project:created")

Workspace → hört auf Event

---

# 7. Store (State Management)

Modul: app/store.js

Zweck:
- Zentrale Zustandsverwaltung
- project
- selection
- settings
- simulation state

Wichtig:
Kein Modul speichert global selbstständig.

---

# 8. Module & Verantwortlichkeiten

| Modul | Aufgabe | Darf nicht |
|--------|----------|-------------|
Wizard | Projekt anlegen | 3D rendern |
ProjectList | Projekte verwalten | Workspace steuern |
Workspace | Rendern & Interaktion | Projekt speichern |
ModelFactory | Modelle erzeugen/laden | UI verändern |
Registry | Definition | Logik enthalten |
Bus | Events | State speichern |
Store | State | UI rendern |

---

# 9. Plugin-System

Ziel:
Alle Panels sind Plugins.

Beispiele:
- General
- Workspace
- Simulation
- Assets
- Structure
- Analysis
- Export
- Versions
- Settings

Ein Plugin besteht aus:
- Manifest
- Panel
- optional Toolbar Buttons

Später:
Topbar ebenfalls manifestbasiert.

---

# 10. FeatureGate

Erlaubt:
- devOverride: all_on
- release: nur freigegebene Module

Zweck:
- Editionen (Hobby / Pro / Industry)

---

# 11. Geplante Erweiterungen

- Simulation-Engine
- Kollisionsanalyse
- Fördertechnik-Simulation
- Marker-Editor
- Stack-Zähler
- Versionsverwaltung
- Cloud Sync
- Export (GLB / JSON / PDF)

---

# 12. Architekturprinzipien

1. Keine direkte Modulkopplung
2. Kommunikation nur über Bus
3. State nur im Store
4. Registry ist rein deklarativ
5. UI vollständig pluginbasiert
6. Workspace ist isoliert

---

# 13. Abgrenzung

Baustellenplaner ist:

- KEIN CAD-System
- KEIN Ersatz für TIA
- KEIN vollwertiger 3D-Modeler

Er ist:

- Projektstrukturierer
- Planungs-Viewer
- Simulations-Vorbereiter
- Demonstrationsplattform

---

# 14. Langfristige Vision

- Tablet-Vorführung
- WebGL-Export
- Modulbauweise für Industrie
- Erweiterbare Plattform
- Monetarisierbare Pro-Version

---

Ende der Dokumentation.
