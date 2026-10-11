# Neuaufbau Paket E - Completion / Evidence / Freeze

Stand: 11.10.2026
Branch: `dev/planner-neuaufbau`
Status: **FROZEN**
`main`: bleibt unveraendert.

## Functional Freeze Head

Paket E ist funktional eingefroren auf:

`2a0e9f8b8c2c3e5825c3114d57df918a59105fa7`

Dieser Head enthaelt die Arbeitsbereich-/Ausschnitt-Domaene, Praezisionszoom, die grobe Menue-/Objektbaumordnung, den Paket-E-Testlauf und den eigenen Paket-E-CI-Workflow.

## Autorisierte Basis

Gate 2 wurde auf Basis des Paket-E-Gate-1-Scope umgesetzt. Der Scope ist in [`NEUAUFBAU_PAKET_E_SCOPE_AND_STATUS.md`](./NEUAUFBAU_PAKET_E_SCOPE_AND_STATUS.md) dokumentiert.

Die Umsetzung bleibt auf dem Entwicklungsbranch `dev/planner-neuaufbau`. Es erfolgt keine Integration nach `main`.

## Umgesetzter Funktionsumfang

Paket E ergaenzt den Neuaufbau um:

- optionalen Projektblock `workspace`;
- `workspace.workAreas` als benannte rechteckige Ausschnitte im globalen Millimeter-Koordinatensystem;
- `workspace.activeWorkAreaId` als UI-/Ansichtsreferenz;
- Validierung fuer Arbeitsbereichs-IDs, Namen, Koordinaten und Groessen;
- Arbeitsbereich anlegen, auswaehlen, bearbeiten, fokussieren und loeschen;
- Fokus auf Gesamtplan oder Arbeitsbereich;
- erhoehten Praezisionszoom fuer grosse Hallen;
- Arbeitsbereichsdarstellung im Plan ohne zweite Szenen- oder Speicherautoritaet;
- grobe Menuegruppierung fuer `Plan`, `Einfuegen` und `Bearbeiten`;
- Sidebar-Gruppierung fuer `Plan`, `Ebenen`, `Objekte`, `Trassen`, `Kabel` und `Kameras`;
- Save/Reload-Erhalt von Arbeitsbereichen und aktiver Ansicht;
- Paket-E-Browserfall fuer grosse Halle, Arbeitsbereich, Kamera im Ausschnitt und Reload;
- `.github/workflows/planner-v2-paket-e.yml` als eigener CI-Lauf fuer Paket A/B/C/D/E.

## Daten- und Koordinatenentscheidung

Arbeitsbereiche sind nur Fokus- und Navigationswerkzeuge. Sie veraendern keine Objekt-, Kamera-, Trassen- oder Kabelkoordinaten.

Fachobjekte bleiben weiterhin global gespeichert:

- Planobjekte in `objects`;
- Trassen und Kabel in `modules.electrical`;
- Kameras in `modules.camera`;
- Arbeitsbereiche in `workspace.workAreas`.

Damit bleibt die Hallen-/Projektgroesse erhalten und ein Arbeitsbereich wird keine zweite Persistenzautoritaet.

## Verification Evidence

Automatisierte Remote-Verifikation fuer Head `2a0e9f8b8c2c3e5825c3114d57df918a59105fa7`:

- GitHub Pages `build`: **PASS**
- GitHub Pages `deploy`: **PASS**
- Product CI / `checks`: **PASS**
- Planner V2 Paket A: **PASS**
- Planner V2 Paket B: **PASS**
- Planner V2 Paket C: **PASS**
- Planner V2 Paket D: **PASS**
- Planner V2 Paket E: **PASS**

Lokale Vorab-Evidence vor der Remote-Verifikation:

- `node scripts/syntax-check.mjs`: **PASS**
- `node scripts/import-graph-check.mjs`: **PASS**
- Workspace-Validator-Smoke: **PASS**
- direkter Browser-Smoke: **PASS**

Der direkte Browser-Smoke pruefte eine grosse Halle, Arbeitsbereich anlegen und fokussieren, Kamera im Ausschnitt setzen, Save/Reload und Erhalt globaler Kamerakoordinaten.

## Bekannte lokale Testumgebungsnotiz

Die lokale Playwright-Test-CLI blieb in der Container-Umgebung ohne Reporter-Ausgabe haengen. Die Ursache lag nicht im Produktcode: Chromium musste zuerst installiert werden und der lokale Testserver war nur ausserhalb der Sandbox erreichbar. Als lokale Ersatz-Evidence wurde ein direkter Chromium-Smoke ausgefuehrt. Die autoritative Browser-Verifikation erfolgte anschliessend ueber GitHub Actions und ist fuer Paket E sowie Paket A/B/C/D gruen.

## Nicht Bestandteil dieses Freeze

Paket E Gate 3 fuehrt keine neue Funktionalitaet ein und dokumentiert nur den verifizierten Stand. Nicht enthalten sind:

- automatische Hallenaufteilung;
- echte CAD-Viewport-Engine;
- zweite Szene oder zweiter Projektspeicher;
- Filterlogik, die Objekte ausserhalb des Arbeitsbereichs aus den Daten entfernt;
- vollstaendige UI-Neugestaltung;
- Mockup-Feinschliff fuer alle Module;
- 3D-, Seiten- oder Schnittansicht;
- Integration nach `main`.

## Freeze Decision

Paket E - Arbeitsbereiche, Praezisionszoom und Menuestruktur ist auf `dev/planner-neuaufbau` bei Head

`2a0e9f8b8c2c3e5825c3114d57df918a59105fa7`

**FROZEN**.

Dieser Completion-/Evidence-/Freeze-Eintrag dokumentiert den Abschluss des Pakets und die gruenen Remote-Checks. Der naechste fachliche Schritt muss separat autorisiert werden.
