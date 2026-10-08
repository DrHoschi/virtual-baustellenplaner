#!/usr/bin/env node
/**
 * PATCH_workarea_mobile_properties_light_v1
 * Datei: scripts/patch_workarea_mobile_properties_light_v1.mjs
 *
 * Zweck:
 * - WorkareaPanel.js entschärfen, damit iPad/iPhone/Safari nicht bei schweren
 *   Properties-/BOM-/Kabel-/EPLAN-Renderblöcken neu lädt.
 * - Der Patch ist absichtlich klein und defensiv:
 *   1) Header-Version aktualisieren.
 *   2) Crash-/Performance-Diagnose für Properties initialisieren.
 *   3) Property-Zähler im Select-Mode NICHT mehr teuer aus derive/flatten berechnen.
 *   4) Nach den Basisfeldern wird standardmäßig abgebrochen.
 *      Schwere Details werden nur geöffnet, wenn der Nutzer aktiv „Details öffnen“ klickt.
 *
 * Anwendung im Repository-Root:
 *   node scripts/patch_workarea_mobile_properties_light_v1.mjs
 *
 * Danach testen:
 *   node --check ui/panels/WorkareaPanel.js
 */

import fs from "node:fs";
import path from "node:path";

const file = path.join(process.cwd(), "ui", "panels", "WorkareaPanel.js");

if (!fs.existsSync(file)) {
  console.error("[PATCH] Datei nicht gefunden:", file);
  process.exit(1);
}

let src = fs.readFileSync(file, "utf8");
const original = src;

function mustReplace(label, needle, replacement) {
  if (!src.includes(needle)) {
    console.error(`\n[PATCH] Marker nicht gefunden: ${label}`);
    console.error("[PATCH] Der Patch wurde NICHT angewendet, damit keine Datei beschädigt wird.");
    process.exit(2);
  }
  src = src.replace(needle, replacement);
  console.log("[PATCH] OK:", label);
}

function insertAfter(label, needle, insertion) {
  if (!src.includes(needle)) {
    console.error(`\n[PATCH] Insert-Marker nicht gefunden: ${label}`);
    console.error("[PATCH] Der Patch wurde NICHT angewendet, damit keine Datei beschädigt wird.");
    process.exit(3);
  }
  src = src.replace(needle, needle + insertion);
  console.log("[PATCH] OK:", label);
}

// -----------------------------------------------------------------------------
// 1) Header-Version sichtbar aktualisieren.
// -----------------------------------------------------------------------------
src = src.replace(
  /Version:\s+v[^\n]+/,
  "Version: v1.4.8-workarea-mobile-properties-light-v1 (2026-05-20)"
);

// -----------------------------------------------------------------------------
// 2) Diagnose-State im Constructor ergänzen.
// -----------------------------------------------------------------------------
insertAfter(
  "constructor: _crashDiag um propertyRender erweitern",
  `      lastPersistBytes: 0
    };`,
  `

    // -------------------------------------------------------------------
    // PATCH_workarea_mobile_properties_light_v1
    // -------------------------------------------------------------------
    // Problem:
    // - Nicht nur Mobile, sondern auch die Desktop-Ansicht auf dem iPad
    //   kann abstürzen, wenn der Property-Manager zu viele DOM-Blöcke
    //   gleichzeitig rendert: EPLAN-Felder, Bauteile, Ports, Kabelpunkte,
    //   Kabelliste, editierbare Kabelfelder.
    // - iOS/Safari lädt dann oft einfach neu, ohne vorher window:error.
    //
    // Strategie:
    // - Properties rendern zuerst nur eine leichte Übersicht.
    // - Schwere Details werden erst nach aktivem Klick geöffnet.
    // - Während Touch/Drag/Pan bleiben die Properties leicht.
    // - Das gilt bewusst auch für iPad-Desktop-Modus, nicht nur für CSS-Mobile.
    this._propertyPerf = {
      version: "v1.0.0-mobile-properties-light",
      heavyOpenByObjectId: new Set(),
      lastRenderAt: 0,
      lastRenderMs: 0,
      lastMode: "",
      lastSelectionId: "",
      lastLightReason: ""
    };`
);

// -----------------------------------------------------------------------------
// 3) Schwere Zähler im Subtitel entschärfen.
//    Vorher wurde bei fehlenden Arrays direkt derive/flatten aufgerufen.
// -----------------------------------------------------------------------------
mustReplace(
  "Assembly-Properties: schwere Zähler im Header entschärfen",
  `    const cablePointCount = Array.isArray(sceneObj.cablePoints) ? sceneObj.cablePoints.length : this._deriveAssemblyCablePointsV1(sceneObj).length;
    sub.textContent = \`ID: \${sceneObj.id || "-"} · Bauteile: \${Array.isArray(sceneObj.components) ? sceneObj.components.length : 0} · BOM: \${Array.isArray(sceneObj.bom) ? sceneObj.bom.length : 0} · Ports: \${Array.isArray(sceneObj.ports) ? sceneObj.ports.length : this._flattenAssemblyPortsV1(sceneObj.components || []).length} · Kabelpunkte: \${cablePointCount}\`;`,
  `    // PATCH_workarea_mobile_properties_light_v1:
    // Hier keine derive/flatten-Aufrufe mehr. Diese Funktionen können bei
    // großen Baugruppen viele Objekte erzeugen und den Property-Render
    // unnötig teuer machen. Für die Übersicht reichen vorhandene Arrays.
    const componentCountLight = Array.isArray(sceneObj.components) ? sceneObj.components.length : 0;
    const bomCountLight = Array.isArray(sceneObj.bom) ? sceneObj.bom.length : 0;
    const portCountLight = Array.isArray(sceneObj.ports) ? sceneObj.ports.length : 0;
    const cablePointCountLight = Array.isArray(sceneObj.cablePoints) ? sceneObj.cablePoints.length : 0;
    const cableLineCountLight = Array.isArray(sceneObj.cableLines) ? sceneObj.cableLines.length : 0;
    sub.textContent = \`ID: \${sceneObj.id || "-"} · Bauteile: \${componentCountLight} · BOM: \${bomCountLight} · Ports: \${portCountLight} · Kabelpunkte: \${cablePointCountLight} · Kabel: \${cableLineCountLight}\`;`
);

// -----------------------------------------------------------------------------
// 4) Nach BMK/Tag-Basisfeld einen Light-Gate einbauen.
//    Alles darunter bleibt im Code vorhanden, wird aber nur bei aktivem Öffnen
//    schwer gerendert.
// -----------------------------------------------------------------------------
const afterBmkBlock = `    {
      const { row, host } = mkRow("BMK / Tag");
      const inp = mkInput(sceneObj.config.equipmentTag || sceneObj.equipmentTag || "");
      inp.placeholder = "z. B. -RB001";
      inp.addEventListener("change", () => {
        const v = String(inp.value || "").trim();
        sceneObj.config.equipmentTag = v;
        sceneObj.equipmentTag = v;
        this._assemblyPropsPersistScene(sceneObj, "assemblyprops:equipmentTag");
        this._setStatus(\`BMK/Tag: \${v || "-"}\`);
      });
      host.appendChild(inp);
      box.appendChild(row);
    }

`;

const lightGate = `    // -------------------------------------------------------------------
    // PATCH_workarea_mobile_properties_light_v1
    // -------------------------------------------------------------------
    // Ab hier würden normalerweise sehr viele schwere DOM-Blöcke erzeugt:
    // EPLAN-Basisfelder, Master/Variante, Bauteile, EPLAN-Bauteile, Ports,
    // Kabelpunkte, Kabelliste und Kabelliste-Felder.
    //
    // Auf iOS/Safari reicht auch im iPad-Desktop-Modus oft schon ein schwerer
    // Property-Render + Canvas + Autosave, damit Safari die Seite neu lädt.
    // Deshalb zeigen wir standardmäßig nur diese Basisfelder und laden Details
    // erst nach aktivem Nutzerklick.
    const perf = this._propertyPerf || (this._propertyPerf = {
      version: "v1.0.0-mobile-properties-light",
      heavyOpenByObjectId: new Set()
    });

    const selectedIdForHeavy = String(sceneObj.id || "");
    const modeForHeavy = String(this.state?.modeId || "");
    const heavyAllowed =
      selectedIdForHeavy &&
      perf.heavyOpenByObjectId &&
      perf.heavyOpenByObjectId.has(selectedIdForHeavy);

    const actions = document.createElement("div");
    actions.style.display = "flex";
    actions.style.flexWrap = "wrap";
    actions.style.gap = "6px";
    actions.style.paddingTop = "4px";

    const mkActionBtn = (txt) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = txt;
      b.style.height = "30px";
      b.style.borderRadius = "9px";
      b.style.padding = "0 10px";
      b.style.border = "1px solid rgba(255,255,255,.14)";
      b.style.background = "rgba(255,255,255,.07)";
      b.style.color = "inherit";
      b.style.fontSize = "12px";
      b.style.cursor = "pointer";
      return b;
    };

    const openHeavyBtn = mkActionBtn(heavyAllowed ? "Details schließen" : "Details öffnen");
    openHeavyBtn.title = heavyAllowed
      ? "Schwere Property-Blöcke wieder ausblenden"
      : "EPLAN, Bauteile, Ports, Kabelpunkte und Kabelliste nur bei Bedarf rendern";
    openHeavyBtn.addEventListener("click", () => {
      if (!perf.heavyOpenByObjectId || !(perf.heavyOpenByObjectId instanceof Set)) {
        perf.heavyOpenByObjectId = new Set();
      }
      if (heavyAllowed) perf.heavyOpenByObjectId.delete(selectedIdForHeavy);
      else perf.heavyOpenByObjectId.add(selectedIdForHeavy);
      this._crashLog?.("workarea:properties:heavy-toggle", {
        version: perf.version || "v1.0.0-mobile-properties-light",
        id: selectedIdForHeavy,
        open: !heavyAllowed,
        mode: modeForHeavy
      });
      this._renderRightPanel();
    });
    actions.appendChild(openHeavyBtn);

    const refreshLightBtn = mkActionBtn("Kabel/BOM aktualisieren");
    refreshLightBtn.title = "Berechnet Kabelpunkte/Kabelliste/BOM einmalig neu, ohne alle Detailkarten dauerhaft zu rendern";
    refreshLightBtn.addEventListener("click", () => {
      try {
        sceneObj.cablePoints = this._deriveAssemblyCablePointsV1(sceneObj);
        sceneObj.cableLines = this._deriveAssemblyCableListV1(sceneObj);
        if (typeof this._deriveAssemblyBomV1 === "function") {
          sceneObj.bom = this._deriveAssemblyBomV1(sceneObj);
        }
        this._assemblyPropsPersistScene(sceneObj, "assemblyprops:light-refresh");
        this._setStatus("Baugruppen-Daten aktualisiert");
        this._crashLog?.("workarea:properties:light-refresh", {
          id: selectedIdForHeavy,
          cablePoints: Array.isArray(sceneObj.cablePoints) ? sceneObj.cablePoints.length : 0,
          cableLines: Array.isArray(sceneObj.cableLines) ? sceneObj.cableLines.length : 0,
          bom: Array.isArray(sceneObj.bom) ? sceneObj.bom.length : 0
        });
        this._renderRightPanel();
      } catch (err) {
        console.warn("[workarea] Light refresh failed", err);
        this._setStatus("Aktualisieren fehlgeschlagen – siehe Konsole/Crashlog");
        this._crashLog?.("workarea:properties:light-refresh:error", {
          id: selectedIdForHeavy,
          message: String(err?.message || err)
        });
      }
    });
    actions.appendChild(refreshLightBtn);

    box.appendChild(actions);

    const lightHint = document.createElement("div");
    lightHint.style.fontSize = "11px";
    lightHint.style.opacity = ".70";
    lightHint.style.lineHeight = "1.35";
    lightHint.textContent = heavyAllowed
      ? "Detailmodus ist aktiv. Wenn es auf iPad/iPhone wieder instabil wird, Details schließen."
      : "Light-Modus aktiv: schwere Listen werden nicht live gerendert. Das schützt auch die iPad-Desktop-Ansicht.";
    box.appendChild(lightHint);

    if (!heavyAllowed) {
      this._crashLog?.("workarea:properties:light-render", {
        version: perf.version || "v1.0.0-mobile-properties-light",
        id: selectedIdForHeavy,
        mode: modeForHeavy,
        components: componentCountLight,
        bom: bomCountLight,
        ports: portCountLight,
        cablePoints: cablePointCountLight,
        cableLines: cableLineCountLight
      });
      return box;
    }

`;

mustReplace(
  "Assembly-Properties: Light-Gate nach BMK einfügen",
  afterBmkBlock,
  afterBmkBlock + lightGate
);

// -----------------------------------------------------------------------------
// 5) Doppelte Anwendung verhindern / Datei schreiben.
// -----------------------------------------------------------------------------
if (src === original) {
  console.log("[PATCH] Keine Änderungen notwendig.");
  process.exit(0);
}

fs.writeFileSync(file, src, "utf8");

console.log("\n[PATCH] Fertig:", file);
console.log("[PATCH] Bitte jetzt prüfen:");
console.log("        node --check ui/panels/WorkareaPanel.js");
