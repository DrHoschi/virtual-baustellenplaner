# Neuaufbau Paket E-Fix Gate 3 - Completion / Evidence / Freeze

Datum: 2026-10-14

## Autorisierte Basis

- Repository: `DrHoschi/virtual-baustellenplaner`
- Branch: `dev/planner-neuaufbau`
- Funktionaler Freeze-Head: `62634aa38c51ab7aa6d2fd2975f6773afe003036`
- Main-Head zum Freeze-Zeitpunkt: `be0061f6cca67c30adee8b476e8ea0265707ab18`
- Scope: Paket E-Fix / Gate 2B - Arbeitsbereich exakt als sichtbaren Viewer-Ausschnitt speichern und fokussieren
- Status: funktional abgeschlossen und fuer den Entwicklungsbranch eingefroren

Dieser Gate-3-Abschluss dokumentiert nur Completion, Evidence und Freeze. Es erfolgt keine Integration nach `main`. `main` bleibt unveraendert, bis eine separate Integration ausdruecklich freigegeben wird.

## Ausgangsproblem

Der Arbeitsbereich sollte aus Sicht des Nutzers den aktuell sichtbaren Viewer-Ausschnitt speichern. Auf kleinen Projekten funktionierte die vorherige Korrektur scheinbar, bei grossen Hallen bzw. geladenen und kalibrierten Grundrissbildern wurden aber weiterhin falsche Bereiche erzeugt oder fokussiert.

Die Ursache war, dass der sichtbare Viewer-Ausschnitt technisch auf die abstrakte Hallenflaeche begrenzt bzw. als Hallen-Schnittmenge behandelt wurde. Bei einem kalibrierten Grundriss kann das Planbild gegenueber der abstrakten Hallenflaeche durch Ursprung/Kalibrierpunkt verschoben sein. Dadurch war die gespeicherte Hallen-Schnittmenge nicht zwingend identisch mit dem sichtbaren Bildausschnitt.

## Umgesetzte Korrektur

Die Arbeitsbereichslogik wurde auf den fachlichen Zweck reduziert: Arbeitsbereiche sind Navigations-/Kameraausschnitte im Viewer.

Umgesetzt wurde:

- `+ Arbeitsbereich` speichert den tatsaechlich sichtbaren SVG-/Viewer-Ausschnitt als globale Koordinaten;
- der gespeicherte Bereich wird nicht mehr auf `siteArea` begrenzt;
- der Bereich wird nicht mehr in Hallengrenzen verschoben;
- negative bzw. ausserhalb der abstrakten Hallenflaeche liegende Koordinaten sind fuer Arbeitsbereiche zulaessig;
- das Anlegen eines Arbeitsbereichs springt nicht mehr automatisch in einen neuen Fokuszustand;
- `Ausschnitt fokussieren` nutzt die gespeicherte Breite/Hoehe unverkuerzt;
- Regressionstests erwarten den exakten sichtbaren Viewer-Ausschnitt statt einer Hallen-Schnittmenge.

## Geaenderte Dateien im Gate-2B-Fix

Funktionaler Head `62634aa38c51ab7aa6d2fd2975f6773afe003036` enthaelt die relevanten Aenderungen in:

- `planner-v2/src/ui/workarea-editor.v1.js`
- `tests/planner-v2-workareas.spec.mjs`
- `docs/NEUAUFBAU_PAKET_E_FIX_WORKAREA_VIEWPORT_SCOPE_AND_STATUS.md`

Dieser Gate-3-Commit ergaenzt nur diese Evidence-/Freeze-Dokumentation.

## Automatische Verification

Alle relevanten Remote-Pruefungen gegen `62634aa38c51ab7aa6d2fd2975f6773afe003036` sind gruen:

| Workflow | Status | Run |
| --- | --- | --- |
| Planner V2 Paket E | success | https://github.com/DrHoschi/virtual-baustellenplaner/actions/runs/38423093640 |
| Product CI | success | https://github.com/DrHoschi/virtual-baustellenplaner/actions/runs/38423093754 |
| pages build and deployment | success | https://github.com/DrHoschi/virtual-baustellenplaner/actions/runs/38423089381 |
| TEST-DEPLOY-01 Deterministic Pages Test Deployment | success | https://github.com/DrHoschi/virtual-baustellenplaner/actions/runs/38424968354 |


Lokal wurden vor der Veroeffentlichung zusaetzlich ausgefuehrt:

- `node scripts/syntax-check.mjs` - gruen
- `node scripts/import-graph-check.mjs` - gruen

Hinweis: Der lokale Playwright-Lauf hing in der Sandboxumgebung ohne verwertbare Ausgabe. Die relevante Playwright-/Workflow-Verifikation erfolgte deshalb ueber den Remote-Workflow `Planner V2 Paket E`.

## Manuelle Verification

Manueller iPhone-Test nach Remote-Deploy: bestanden.

Bestaetigtes Nutzerfeedback:

> Okay, jetzt hat's geklappt.

Damit ist der grosse-Halle-Fall, der zuvor die falschen Arbeitsbereiche zeigte, praktisch verifiziert.

## Freeze-Entscheidung

Paket E-Fix Gate 3 ist hiermit fuer den Entwicklungsbranch abgeschlossen.

Eingefroren wird:

- funktionaler Stand: `62634aa38c51ab7aa6d2fd2975f6773afe003036`
- Branch: `dev/planner-neuaufbau`
- Verhalten: Arbeitsbereich = sichtbarer Viewer-Ausschnitt, nicht Hallen-Schnittmenge
- manueller Status: iPhone-Test bestanden
- Remote-Status: relevante Workflows gruen

Nicht Teil dieses Freezes:

- keine `main`-Integration;
- keine weitere UX-Ueberarbeitung des Arbeitsbereich-Panels;
- keine Paket-C-/Kabeltrassen-Umsetzung;
- keine neue Kamera-/FOV-Implementation.

## Naechster separater Schritt

Nach diesem Freeze ist der naechste fachlich separate Schritt wieder eine neue Gate-Freigabe, z. B.:

- Paket C Fortsetzung / Kabel- und Trassenplanung auf `dev/planner-neuaufbau`; oder
- separat autorisierte Integration dieses eingefrorenen Entwicklungsstands nach `main`.

Bis zu einer solchen separaten Freigabe bleibt `main` unveraendert.
