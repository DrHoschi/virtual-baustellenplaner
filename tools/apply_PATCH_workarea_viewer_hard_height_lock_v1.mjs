#!/usr/bin/env node
/**
 * PATCH_workarea_viewer_hard_height_lock_v1
 * ------------------------------------------------------------
 * Zweck:
 * - Mobile Safari/iPadOS/iOS feuert beim Scrollen/Browserleisten-Wechsel
 *   reine Höhenänderungen im Viewport.
 * - Diese Höhenwechsel haben bei dir sichtbar den Viewer zwischen
 *   334 / 377 / 425 px springen lassen und danach mehrfach pagehide/reload
 *   ausgelöst.
 *
 * Dieser Patch macht den Workarea-Canvas auf Mobile bei reinen
 * Höhenwechseln hart stabil:
 * - erster Mount-Resize bleibt erlaubt
 * - reine Höhenänderung bei gleicher Breite + gleichem DPR wird ignoriert
 * - echte Breiten-/DPR-Änderungen bleiben erlaubt
 * - Touch/Scroll-Propagation im Viewport wird zusätzlich gedämpft
 */

import fs from "node:fs";
import path from "node:path";

const PATCH_ID = "PATCH_workarea_viewer_hard_height_lock_v1";
const file = path.join(process.cwd(), "ui", "panels", "WorkareaPanel.js");

function fail(msg) {
  console.error(`❌ ${PATCH_ID}: ${msg}`);
  process.exit(1);
}

function info(msg) {
  console.log(`ℹ️  ${PATCH_ID}: ${msg}`);
}

if (!fs.existsSync(file)) {
  fail(`Datei nicht gefunden: ${file}`);
}

let src = fs.readFileSync(file, "utf8");

if (src.includes("PATCH_workarea_viewer_hard_height_lock_v1")) {
  info("Patch-Markierung ist bereits vorhanden. Es wird nichts doppelt eingefügt.");
  process.exit(0);
}

let changed = false;

function replaceOnce(find, repl, label) {
  if (!src.includes(find)) fail(`Suchblock nicht gefunden: ${label}`);
  src = src.replace(find, repl);
  changed = true;
  info(`gepatcht: ${label}`);
}

/* -------------------------------------------------------------------------
 * 1) Guard-Konfiguration im Constructor verschärfen
 * ---------------------------------------------------------------------- */

replaceOnce(
`      version: "v3.0.0-mobile-resize-lock",`,
`      version: "v4.0.0-hard-height-lock",`,
"mobileResizeGuard.version"
);

replaceOnce(
`      mobilePureHeightLock: true,
      mobileStartupGrowOnce: true,
      mobileStartupGrowMs: 12000,
      mobileStartupGrowMinPx: 60,`,
`      mobilePureHeightLock: true,

      // PATCH_workarea_viewer_hard_height_lock_v1:
      // Auf iPhone/iPad/Safari darf der Viewer nach dem ersten echten Mount
      // nicht mehr durch reine Browserleisten-/Scroll-Höhenwechsel wachsen
      // oder schrumpfen. Breite/DPR-Wechsel bleiben echte Resizes.
      mobileHardHeightLock: true,

      // v3 erlaubte einmaliges Hochwachsen nach dem Mount. Genau dieses
      // Verhalten erzeugte in deinen Logs weiterhin 334 -> 425 -> 377/378.
      // Für maximale Stabilität wird es hier abgeschaltet.
      mobileStartupGrowOnce: false,
      mobileStartupGrowMs: 12000,
      mobileStartupGrowMinPx: 60,`,
"mobileResizeGuard hard height settings"
);

replaceOnce(
`      mountAt: 0,
      mobileHeightLocked: false,`,
`      mountAt: 0,
      mobileHeightLocked: false,

      // PATCH_workarea_viewer_hard_height_lock_v1:
      // Diagnosewerte für den festgehaltenen mobilen Canvas-Höhenzustand.
      hardHeightLockPx: 0,
      hardHeightLockW: 0,
      hardHeightLockDpr: 1,`,
"mobileResizeGuard hard lock diagnostics"
);

/* -------------------------------------------------------------------------
 * 2) Viewport zusätzlich gegen Scroll-/Overscroll-Kaskaden schützen
 * ---------------------------------------------------------------------- */

replaceOnce(
`    viewport.style.overflow = "hidden";
    center.appendChild(viewport);`,
`    viewport.style.overflow = "hidden";

    // PATCH_workarea_viewer_hard_height_lock_v1:
    // Safari/iOS soll im Viewer keine Seiten-Scroll-/Browserleisten-Kaskade
    // auslösen. Pointer-/Pinch-Logik läuft weiterhin über unsere Canvas-Events.
    viewport.style.touchAction = "none";
    viewport.style.overscrollBehavior = "contain";
    center.style.overscrollBehavior = "contain";

    center.appendChild(viewport);`,
"viewport touchAction / overscrollBehavior"
);

/* -------------------------------------------------------------------------
 * 3) Harte Ignore-Regel für reine mobile Höhenwechsel
 * ---------------------------------------------------------------------- */

const needleDecision = 
`    // PATCH v3: Einmaliges Hochwachsen nach Mount erlauben.
    // Direkt nach dem Öffnen meldet Safari oft zuerst eine zu kleine Höhe (z.B. 334)
    // und kurz danach die echte nutzbare Höhe (z.B. 425). Dieses eine Wachstum ist ok.
    const startupAge = now - Number(G.mountAt || 0);`;

const hardBlock =
`    // PATCH_workarea_viewer_hard_height_lock_v1:
    // Harte Regel:
    // Wenn auf Mobile nur die Höhe wechselt, aber Breite und DPR gleich bleiben,
    // ignorieren wir das immer nach dem ersten angewendeten Mount-Resize.
    // Genau diese Werte sprangen bei dir im Crashlog:
    //   334 -> 425 -> 377/378 -> 425
    // Das ist Safari-Browserleisten-/Scroll-Rauschen, kein echtes Layout.
    if (
      isMobile &&
      pureHeightChange &&
      !!G.mobileHardHeightLock &&
      !String(reason || "").includes("mount:init")
    ) {
      G.mobileHeightLocked = true;
      G.hardHeightLockPx = prevH;
      G.hardHeightLockW = prevW;
      G.hardHeightLockDpr = prevDpr;
      G.ignoredHeightNoise = (G.ignoredHeightNoise || 0) + 1;

      if (!G._lastHardHeightLogAt || now - G._lastHardHeightLogAt > 1200) {
        G._lastHardHeightLogAt = now;
        this._crashLog("workarea:viewport:resize:hard-height-lock", {
          version: G.version,
          reason,
          w: nextW,
          h: nextH,
          lockedH: prevH,
          hDelta,
          ignored: G.ignoredHeightNoise,
          finalSync: !!opts?.finalSync,
          force: !!opts?.force
        });
      }

      return { action: "ignore", why: "mobile-hard-height-lock" };
    }

`;

if (!src.includes(needleDecision)) {
  fail("Suchblock nicht gefunden: _shouldDeferOrIgnoreViewportResize startup-grow marker");
}
src = src.replace(needleDecision, hardBlock + needleDecision);
changed = true;
info("gepatcht: hard-height-lock Entscheidung");

/* -------------------------------------------------------------------------
 * 4) Beim echten Apply Diagnosewerte aktualisieren
 * ---------------------------------------------------------------------- */

replaceOnce(
`          G.lastApplied = { w, h, dpr, bw, bh };
          if (this._isMobileResizeGuardEnvironment?.() && h >= 390) {
            G.mobileHeightLocked = true;
          }`,
`          G.lastApplied = { w, h, dpr, bw, bh };

          // PATCH_workarea_viewer_hard_height_lock_v1:
          // Der zuletzt wirklich angewendete Wert ist der Lock-Anker.
          // Reine spätere Höhenwechsel werden dagegen in
          // _shouldDeferOrIgnoreViewportResize() blockiert.
          G.hardHeightLockPx = h;
          G.hardHeightLockW = w;
          G.hardHeightLockDpr = dpr;

          if (this._isMobileResizeGuardEnvironment?.()) {
            G.mobileHeightLocked = true;
          }`,
"lastApplied hard lock anchor"
);

/* -------------------------------------------------------------------------
 * 5) Header-Version minimal markieren
 * ---------------------------------------------------------------------- */

src = src.replace(
` * Version: v1.4.7-assemblylab-cablepoints-v1 (2026-05-20)`,
` * Version: v1.4.8-viewer-hard-height-lock-v1 (2026-05-20)`
);

if (!changed) {
  fail("keine Änderung durchgeführt");
}

fs.writeFileSync(file, src, "utf8");

console.log(`✅ ${PATCH_ID}: WorkareaPanel.js wurde gepatcht.`);
console.log("   Danach bitte ausführen:");
console.log("   node --check ui/panels/WorkareaPanel.js");
