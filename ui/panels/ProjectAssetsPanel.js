/**
 * ui/panels/ProjectAssetsPanel.js
 * Version: v1.0.1-project-assets-migration (2026-02-08)
 *
 * Projekt-Assets
 * ---------------------------------------------------------------------------
 * Ziel dieser Panel-Logik:
 * - Zeigt ALLE Assets, die in einem Projekt verwendet werden (Referenz + PresetTransform)
 * - Dient als "Projekt-spezifische" Schicht über einer globalen Bibliothek
 * - Öffnet AssetLab 3D in einem eindeutigen Kontext (projectAssetId)
 *
 * WICHTIG (Robustheit / Migration):
 * - In den letzten Patches gab es Namens-/Pfadwechsel ("Eigene Assets" → "Projekt-Assets").
 * - Wenn ältere Projekte ihre Liste unter einem Legacy-Pfad gespeichert haben,
 *   migrieren wir diese beim Öffnen einmalig nach:
 *   app.settings.projectSettings.assets.projectAssets
 *
 * Datenmodell (minimal, erweiterbar):
 * app.settings.projectSettings.assets.projectAssets = [
 *   {
 *     id: "PA-...",
 *     name: "...",
 *     source: { kind: "upload"|"library"|"assetlab"|"standalone", refId?: "..." },
 *     preset: { scale: 1, rotYDeg: 0, offsetY: 0 },
 *     meta: { createdAt: ISOString }
 *   }
 * ]
 */

import { PanelBase } from "./PanelBase.js";
import { h } from "../components/ui-dom.js";

// ---------------------------------------------------------------------------
// Kleine Helfer
// ---------------------------------------------------------------------------

const clampNum = (v, def = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
};

const safeClone = (obj) => {
  try { return JSON.parse(JSON.stringify(obj)); } catch { return obj; }
};

/**
 * Liest eine tief verschachtelte Property sicher.
 * Beispiel: getByPath(app, ["settings","projectSettings","assets","projectAssets"], [])
 */
function getByPath(root, pathArr, fallback) {
  let cur = root;
  for (const k of pathArr) {
    if (!cur || typeof cur !== "object" || !(k in cur)) return fallback;
    cur = cur[k];
  }
  return (cur === undefined) ? fallback : cur;
}

/**
 * Stellt sicher, dass ein Pfad existiert (Objekte werden angelegt).
 * Liefert das Objekt am Ende des Pfads zurück.
 */
function ensureObjPath(root, pathArr) {
  let cur = root;
  for (const k of pathArr) {
    cur[k] = (cur[k] && typeof cur[k] === "object") ? cur[k] : {};
    cur = cur[k];
  }
  return cur;
}

function uid(prefix = "PA") {
  // ausreichend für local-only IDs
  return `${prefix}-${Math.random().toString(16).slice(2)}-${Date.now().toString(16)}`;
}

// ---------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------

export class ProjectAssetsPanel extends PanelBase {
  getTitle() { return "Projekt – Projekt-Assets"; }

  getDescription() {
    const pid = this.store.get("app")?.project?.id || "";
    return pid ? `Assets im Projekt: ${pid}` : "Assets im Projekt";
  }

  getToolbarConfig() {
    // Wir nutzen hier bewusst NICHT die PanelBase-Apply/Reset Buttons,
    // weil die Liste eher "live" gepflegt wird.
    return {
      showReset: false,
      showApply: false,
      note: "Projekt-Assets = im Projekt verwendete Assets (Referenz + PresetTransform)."
    };
  }

  // -------------------------------------------------------------------------
  // Draft
  // -------------------------------------------------------------------------

  buildDraftFromStore() {
    // ------------------------------------------------------------
    // MIGRATION: Legacy-Pfade → Canon
    // ------------------------------------------------------------
    this._migrateLegacyIfNeeded();

    const app = this.store.get("app") || {};

    // Ziel-Pfad (NEU)
    const targetPath = ["settings", "projectSettings", "assets", "projectAssets"];
    const list = getByPath(app, targetPath, null);

    // Legacy-Pfade (ALT) – falls früher anders benannt
    const legacyCandidates = [
      ["settings", "projectSettings", "assets", "assets"],
      ["settings", "projectSettings", "ownAssets"],
      ["settings", "projectSettings", "assets", "ownAssets"],
      ["settings", "projectSettings", "assets", "items"],
    ];

    // Migration nur, wenn Ziel leer/fehlend ist UND ein Legacy-Pfad Daten hat.
    let migrated = false;
    let finalList = Array.isArray(list) ? list : [];

    if (!Array.isArray(list) || list.length === 0) {
      for (const p of legacyCandidates) {
        const legacy = getByPath(app, p, null);
        if (Array.isArray(legacy) && legacy.length) {
          finalList = legacy;
          migrated = true;
          break;
        }
      }
    }

    // Migration anwenden (einmalig) – wir schreiben in den Store zurück,
    // damit die UI ab jetzt konsistent den neuen Pfad benutzt.
    if (migrated) {
      this.store.update("app", (a) => {
        const dst = ensureObjPath(a, ["settings", "projectSettings", "assets"]);
        dst.projectAssets = safeClone(finalList);
      });
    }

    // Draft-Format
    return {
      projectAssets: safeClone(finalList || [])
    };
  }

  applyDraftToStore(draft) {
    // Live-Sync: PanelBase-Toolbar ist deaktiviert, trotzdem speichern wir zentral.
    this.store.update("app", (app) => {
      const assets = ensureObjPath(app, ["settings", "projectSettings", "assets"]);
      assets.projectAssets = safeClone(draft.projectAssets || []);

      // optional: Draft merken, damit Tab-Wechsel den Zustand behält
      app.ui = app.ui || {};
      app.ui.drafts = app.ui.drafts || {};
      app.ui.drafts.projectAssets = safeClone(draft);
    });
  }

  // -------------------------------------------------------------------------
  // Rendering
  // -------------------------------------------------------------------------

  renderBody(root, draft) {
    const dirty = () => this.markDirty();
    const sync = () => this.applyDraftToStore(draft);

    // --- Header / Actions ---
    const row = h("div", {
      style: {
        display: "flex",
        gap: "8px",
        flexWrap: "wrap",
        alignItems: "center",
        marginBottom: "10px"
      }
    });

    const btnAddDummy = h("button", {
      className: "bp-btn",
      type: "button",
      onclick: () => {
        draft.projectAssets = draft.projectAssets || [];
        draft.projectAssets.push({
          id: uid("PA"),
          name: "Dummy Asset",
          source: { kind: "standalone" },
          preset: { scale: 1, rotYDeg: 0, offsetY: 0 },
          meta: { createdAt: new Date().toISOString() }
        });
        dirty();
        sync();
        this.rerender();
      }
    }, "+ Dummy-Asset");

    const btnOpenStandalone = h("button", {
      className: "bp-btn",
      type: "button",
      onclick: () => {
        // Öffnet AssetLab ohne Kontext (nur Viewer/Import/Export)
        this.bus.emit("ui:navigate", { panel: "projectPanel:assetlab3d", payload: { context: null } });
      }
    }, "↗ AssetLab öffnen (Standalone)");

    const hint = h("div", {
      style: { opacity: ".7", fontSize: "12px", marginLeft: "auto" }
    }, "Projekt-Assets = im Projekt verwendete Assets (Referenz + PresetTransform)." );

    row.appendChild(btnAddDummy);
    row.appendChild(btnOpenStandalone);
    row.appendChild(hint);

    // --- Liste ---
    const listWrap = h("div", { style: { display: "grid", gap: "10px" } });

    const items = Array.isArray(draft.projectAssets) ? draft.projectAssets : [];

    if (!items.length) {
      listWrap.appendChild(
        h("div", { style: { opacity: ".75", padding: "10px 0" } },
          "(Noch keine Projekt-Assets) – füge ein Dummy-Asset hinzu oder importiere später aus der Bibliothek."
        )
      );
    }

    const renderItem = (it) => {
      const card = h("div", {
        style: {
          border: "1px solid rgba(0,0,0,.08)",
          borderRadius: "10px",
          padding: "10px",
          background: "rgba(255,255,255,.65)"
        }
      });

      const title = h("div", { style: { fontWeight: "600" } }, it?.name || "(ohne Name)");
      const sub = h("div", { style: { opacity: ".75", fontSize: "12px", marginBottom: "8px" } },
        `Asset-ID: ${it?.id || "?"}  ·  Quelle: ${it?.source?.kind || "?"}`
      );

      const actions = h("div", { style: { display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "10px" } });
      const btnOpen = h("button", {
        className: "bp-btn",
        type: "button",
        onclick: () => {
          // Kontext in Store ablegen (robust – AssetLabPanel kann das lesen)
          this.store.update("app", (app) => {
            app.ui = app.ui || {};
            app.ui.assetlab = app.ui.assetlab || {};
            app.ui.assetlab.context = { type: "projectAsset", projectAssetId: it.id };
          });

          // Navigation
          this.bus.emit("ui:navigate", {
            panel: "projectPanel:assetlab3d",
            payload: { context: { type: "projectAsset", projectAssetId: it.id } }
          });
        }
      }, "🧰 In AssetLab öffnen");

      const btnDel = h("button", {
        className: "bp-btn",
        type: "button",
        onclick: () => {
          if (!confirm("Projekt-Asset wirklich löschen?")) return;
          draft.projectAssets = (draft.projectAssets || []).filter((x) => x?.id !== it.id);
          dirty();
          sync();
          this.rerender();
        }
      }, "🗑 Löschen");

      actions.appendChild(btnOpen);
      actions.appendChild(btnDel);

      // Preset-Felder (numerisch)
      const grid = h("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "8px" } });

      const mkNum = (label, getVal, setVal) => {
        const inp = h("input", {
          type: "number",
          className: "bp-input",
          value: String(getVal()),
          step: "0.1",
          oninput: (ev) => {
            setVal(ev.target.value);
            dirty();
            sync();
          }
        });
        return h("div", {},
          h("div", { style: { fontSize: "12px", opacity: ".75", marginBottom: "4px" } }, label),
          inp
        );
      };

      it.preset = it.preset || { scale: 1, rotYDeg: 0, offsetY: 0 };

      grid.appendChild(mkNum("Scale (uniform)",
        () => clampNum(it.preset.scale, 1),
        (v) => { it.preset.scale = clampNum(v, 1); }
      ));
      grid.appendChild(mkNum("Rot Y (°)",
        () => clampNum(it.preset.rotYDeg, 0),
        (v) => { it.preset.rotYDeg = clampNum(v, 0); }
      ));
      grid.appendChild(mkNum("Offset Y", 
        () => clampNum(it.preset.offsetY, 0),
        (v) => { it.preset.offsetY = clampNum(v, 0); }
      ));

      const btnResetPreset = h("button", {
        className: "bp-btn",
        type: "button",
        onclick: () => {
          it.preset = { scale: 1, rotYDeg: 0, offsetY: 0 };
          dirty();
          sync();
          this.rerender();
        }
      }, "Preset reset");

      card.appendChild(title);
      card.appendChild(sub);
      card.appendChild(actions);
      card.appendChild(grid);
      card.appendChild(h("div", { style: { marginTop: "8px" } }, btnResetPreset));

      return card;
    };

    items.forEach((it) => listWrap.appendChild(renderItem(it)));

    // --- Compose ---
    root.appendChild(row);
    root.appendChild(listWrap);
  }
// ===========================================================================
// Migration + Diagnose
// ===========================================================================

/**
 * Migrates legacy project assets to the canonical path if (and only if)
 * the canonical list is currently empty.
 */
_migrateLegacyIfNeeded() {
  const app = this.store.get("app") || {};

  const canon = getByPath(app, CANON_PATH, null);
  const canonArr = Array.isArray(canon) ? canon : [];
  if (canonArr.length > 0) return; // Ziel hat schon Daten → nix tun

  // Versuche Legacy-Pfade in sinnvoller Reihenfolge
  for (const p of LEGACY_PATHS) {
    const legacy = getByPath(app, p, null);
    if (!Array.isArray(legacy) || legacy.length === 0) continue;

    // Copy → Canon
    this.store.update("app", (a) => {
      a.settings = a.settings || {};
      a.settings.projectSettings = a.settings.projectSettings || {};
      a.settings.projectSettings.assets = a.settings.projectSettings.assets || {};
      a.settings.projectSettings.assets.projectAssets = safeClone(legacy);
    });

    console.warn("[ProjectAssetsPanel] Migrated legacy projectAssets from:", p.join("."));
    return;
  }
}

/**
 * Liefert eine kleine Diagnose, damit man sofort sieht, wo Daten (evtl.) liegen.
 */
_diagnosePaths() {
  const app = this.store.get("app") || {};
  const out = [];

  const canon = getByPath(app, CANON_PATH, []);
  out.push({ path: CANON_PATH.join("."), count: Array.isArray(canon) ? canon.length : 0, kind: "canon" });

  for (const p of LEGACY_PATHS) {
    const v = getByPath(app, p, []);
    out.push({ path: p.join("."), count: Array.isArray(v) ? v.length : 0, kind: "legacy" });
  }
  return out;
}

}
