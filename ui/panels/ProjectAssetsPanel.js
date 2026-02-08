/**
 * ui/panels/ProjectAssetsPanel.js
 * Version: v1.0.0-clean-standard (2026-02-08)
 *
 * Panel: Projekt → Projekt-Assets
 * ============================================================================
 * Zweck
 * -----
 * Dieses Panel ist die "Projekt-spezifische" Asset-Liste.
 * Hier liegen NUR die Assets, die im aktuellen Projekt benutzt/gebunden werden.
 *
 * Warum existiert das neben "Bibliotheken"?
 * - Bibliotheken = globaler Katalog (Standard-Assets, Varianten, Presets)
 * - Projekt-Assets = die im Projekt tatsächlich verwendete Auswahl/Variante
 *
 * Minimaler Funktionsumfang (Clean-Standard Patch)
 * ------------------------------------------------
 * - Liest/zeigt: app.settings.projectAssets (Array)
 * - "In AssetLab öffnen" (setzt Kontext + navigiert zum AssetLab Panel)
 * - "Entfernen" (löscht Eintrag aus projectAssets)
 * - "Dummy hinzufügen" (damit man UI sofort testen kann, ohne Upload-Flow)
 *
 * Datenformat (bewusst tolerant)
 * ------------------------------
 * Wir erzwingen (noch) kein festes Schema, weil das Projekt gerade im Aufbau ist.
 * Erwartet wird grob so etwas:
 *   {
 *     id: "A-0001",
 *     name: "Rollenbahn 2m",
 *     src: "assets/models/roller.glb" | "data:..." | "library:<id>",
 *     presetTransform: { sx, sy, sz, ryDeg, ox, oy, oz }
 *   }
 *
 * NOTE:
 * - Persistenz macht core/persist/app-persist.js automatisch (via store.update("app", ...)).
 */

import { PanelBase } from "./PanelBase.js";
import { Section } from "../components/Section.js";
import { FormField } from "../components/FormField.js";
import { h, clear } from "../components/ui-dom.js";

function safeClone(obj) {
  try {
    if (typeof structuredClone === "function") return structuredClone(obj);
  } catch { /* ignore */ }
  try { return JSON.parse(JSON.stringify(obj)); } catch { return obj; }
}

function uid(prefix = "A") {
  // Einfacher ID-Generator (reicht für localStorage-Projekte)
  const n = Math.floor(Math.random() * 1e9).toString(16).toUpperCase().padStart(8, "0");
  return `${prefix}-${n}`;
}

function getProjectAssets(app) {
  const a = app?.settings?.projectAssets;
  return Array.isArray(a) ? a : [];
}

export class ProjectAssetsPanel extends PanelBase {
  getTitle() { return "Projekt – Projekt-Assets"; }

  getDescription() {
    const app = this.store.get("app") || {};
    const cnt = getProjectAssets(app).length;
    return `Projekt-ID: ${app?.project?.id || "?"} · Assets im Projekt: ${cnt}`;
  }

  buildDraftFromStore() {
    const app = this.store.get("app") || {};
    const draft = (app?.ui?.drafts?.projectAssets) ? safeClone(app.ui.drafts.projectAssets) : null;

    // Draft-First: wenn Draft existiert, nutzt PanelBase ihn weiter
    if (draft && typeof draft === "object") return draft;

    return {
      projectAssets: safeClone(getProjectAssets(app))
    };
  }

  applyDraftToStore(draft) {
    // Speichern schreibt in app.settings.projectAssets + legt Draft ab
    this.store.update("app", (app) => {
      app.settings = app.settings || {};
      app.settings.projectAssets = Array.isArray(draft?.projectAssets) ? safeClone(draft.projectAssets) : [];

      app.ui = app.ui || {};
      app.ui.drafts = app.ui.drafts || {};
      app.ui.drafts.projectAssets = safeClone(draft);
    });
  }

  renderBody(bodyEl, draft) {
    clear(bodyEl);

    const assets = Array.isArray(draft?.projectAssets) ? draft.projectAssets : [];
    const topRow = h("div", { style: { display: "flex", gap: "8px", alignItems: "center", marginBottom: "10px" } });

    // --- Buttons (Test + UX) ---
    const btnAddDummy = h("button", {
      className: "bp-btn",
      type: "button",
      onclick: () => {
        assets.push({
          id: uid("A"),
          name: "Dummy-Asset (Test)",
          src: "placeholder://dummy",
          presetTransform: { sx: 1, sy: 1, sz: 1, ryDeg: 0, ox: 0, oy: 0, oz: 0 }
        });
        this.draft.projectAssets = assets;
        this.markDirty();
        this._rerender();
      }
    }, "＋ Dummy hinzufügen");

    const hint = h("span", { style: { marginLeft: "auto", opacity: ".75", fontSize: "12px" } },
      "Tipp: Hier werden später Upload/Import/Bindungs-Flows ergänzt."
    );

    topRow.appendChild(btnAddDummy);
    topRow.appendChild(hint);
    bodyEl.appendChild(topRow);

    // --- Liste ---
    const sec = new Section({
      title: "Assets im Projekt",
      description: "Diese Liste ist projekt-spezifisch. Von hier aus kannst du ein Asset im AssetLab öffnen."
    });

    if (!assets.length) {
      sec.append(
        h("div", { style: { opacity: ".75", fontSize: "13px" } },
          "Noch keine Projekt-Assets. Nutze „Dummy hinzufügen“ oder später den Import-Flow."
        )
      );
      bodyEl.appendChild(sec.el);
      return;
    }

    // Kleine Tabelle/Rows (ohne extra CSS-Abhängigkeiten)
    const list = h("div", { style: { display: "flex", flexDirection: "column", gap: "10px" } });

    assets.forEach((a, idx) => {
      const row = h("div", {
        style: {
          border: "1px solid rgba(0,0,0,.08)",
          borderRadius: "10px",
          padding: "10px",
          display: "flex",
          gap: "10px",
          alignItems: "center",
          flexWrap: "wrap"
        }
      });

      const left = h("div", { style: { minWidth: "240px" } },
        h("div", { style: { fontWeight: "700" } }, a?.name || "(ohne Name)"),
        h("div", { style: { fontSize: "12px", opacity: ".75" } },
          `id: ${a?.id || "?"} · src: ${a?.src || "(leer)"}`
        )
      );

      // Preset kurz anzeigen (später ausbauen)
      const pt = a?.presetTransform || {};
      const presetMini = h("div", { style: { fontSize: "12px", opacity: ".8" } },
        `Preset: S(${pt.sx ?? 1},${pt.sy ?? 1},${pt.sz ?? 1}) · Ry=${pt.ryDeg ?? 0}° · O(${pt.ox ?? 0},${pt.oy ?? 0},${pt.oz ?? 0})`
      );

      const btnOpen = h("button", {
        className: "bp-btn",
        type: "button",
        onclick: () => {
          // 1) Kontext setzen (damit AssetLab weiß, welches Projekt-Asset gemeint ist)
          this.store.update("app", (app) => {
            app.ui = app.ui || {};
            app.ui.assetlab = app.ui.assetlab || {};
            app.ui.assetlab.context = {
              mode: "projectAsset",
              projectAssetId: a?.id || null
            };
          });

          // 2) Navigation: auf Panel "AssetLab 3D"
          // (das ist genau das moduleKey-Format aus core/loader.js: panel:<anchor>:<tabId>)
          this.bus?.emit("ui:menu:select", { moduleKey: "panel:projectPanel:assetlab3d" });
        }
      }, "In AssetLab öffnen");

      const btnRemove = h("button", {
        className: "bp-btn",
        type: "button",
        onclick: () => {
          assets.splice(idx, 1);
          this.draft.projectAssets = assets;
          this.markDirty();
          this._rerender();
        }
      }, "Entfernen");

      row.appendChild(left);
      row.appendChild(presetMini);
      row.appendChild(btnOpen);
      row.appendChild(btnRemove);

      list.appendChild(row);
    });

    sec.append(list);
    bodyEl.appendChild(sec.el);

    // --- Hinweis / Next Steps ---
    bodyEl.appendChild(
      h("div", { style: { marginTop: "10px", opacity: ".65", fontSize: "12px" } },
        "Next: Upload/Import (GLB/GLTF), Binden an Bibliothek-Assets, Versionierung, Exportpaket (Projekt.json + Assets)."
      )
    );
  }
}
