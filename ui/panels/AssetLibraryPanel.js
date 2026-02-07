/**
 * ui/panels/AssetLibraryPanel.js
 * Version: v1.0.0-asset-library-v1 (2026-02-07)
 *
 * Panel: Projekt → Assets
 * =============================================================================
 * Ziel:
 * - Pro Projekt eine Asset-Bibliothek verwalten (Modelle, später Texturen, etc.)
 * - KEIN "Blender im Browser" — wir speichern nur Metadaten + Preset-Transforms.
 * - AssetLab (iframe) bleibt ein Viewer/Import/Export — die Bibliothek ist die Wahrheit.
 *
 * Warum das wichtig ist:
 * - Viele Projekte bestehen aus Komponenten (Halle, Maschinen, Fördertechnik, ...).
 * - Wir wollen diese Assets einmal sauber erfassen (Name, Pfad, Tags, Meta),
 *   und später in 2D/3D platzieren können, ohne ständig GLBs neu zu exportieren.
 *
 * Datenmodell (app.project.assets):
 * {
 *   items: [
 *     {
 *       id: "A-2026-1234",
 *       name: "Halle_40x20",
 *       type: "model/gltf-binary",          // optional
 *       src: "assets/models/halle.glb",     // optional
 *       tags: ["halle","stahlbau"],
 *       meta: { createdAt, updatedAt, bbox?, tris? },
 *       presetTransform: {
 *         pos:   [x,y,z],
 *         rot:   [rx,ry,rz], // RADIANS (intern)
 *         scale: [sx,sy,sz]
 *       }
 *     }
 *   ],
 *   folders: [],
 *   settings: {}
 * }
 *
 * UX-Philosophie:
 * - Mobile-first: numerische Presets statt fummelige Gizmos.
 * - Root-only Transform: Preset gilt für das ganze Asset (keine Mesh-Selection nötig).
 */

import { PanelBase } from "./PanelBase.js";
import { Section } from "../components/Section.js";
import { FormField } from "../components/FormField.js";
import { h } from "../components/ui-dom.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function nowIso() {
  try { return new Date().toISOString(); } catch { return ""; }
}

function makeAssetId() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const rnd = String(Math.floor(Math.random() * 10000)).padStart(4, "0");
  return `A-${yyyy}-${rnd}`;
}

function safeClone(obj) {
  // Safari/iOS kompatibel (structuredClone ist nicht überall garantiert)
  try { if (typeof structuredClone === "function") return structuredClone(obj); } catch {}
  try { return JSON.parse(JSON.stringify(obj)); } catch { return obj; }
}

function degToRad(deg) {
  const n = Number(deg);
  if (!isFinite(n)) return 0;
  return (n * Math.PI) / 180;
}

function radToDeg(rad) {
  const n = Number(rad);
  if (!isFinite(n)) return 0;
  return (n * 180) / Math.PI;
}

function parseTags(s) {
  const t = String(s || "")
    .split(",")
    .map(x => x.trim())
    .filter(Boolean);
  // unique
  return [...new Set(t)];
}

/**
 * Sorgt dafür, dass app.project.assets existiert.
 * (Migration/Fallback: alte Projekte ohne assets crashen sonst.)
 */
function ensureAssetsOnProject(project) {
  project = project || {};
  if (!project.assets || typeof project.assets !== "object") {
    project.assets = { items: [], folders: [], settings: {} };
  }
  if (!Array.isArray(project.assets.items)) project.assets.items = [];
  if (!Array.isArray(project.assets.folders)) project.assets.folders = [];
  if (!project.assets.settings || typeof project.assets.settings !== "object") project.assets.settings = {};
  return project;
}

// ---------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------

export class AssetLibraryPanel extends PanelBase {
  getTitle() { return "Projekt – Assets"; }

  getDescription() {
    const pid = this.store.get("app")?.project?.id || "";
    const count = this.store.get("app")?.project?.assets?.items?.length || 0;
    return pid ? `Projekt-ID: ${pid} · Assets: ${count}` : `Assets: ${count}`;
  }

  getToolbarConfig() {
    // Wir nutzen PanelBase-Speichern (Apply), weil wir Daten im Projekt ändern.
    return {
      showReset: true,
      showApply: true,
      note: "Assets gehören zum Projekt. PresetTransform ist numerisch (Scale/Rotation/Offset)."
    };
  }

  // -------------------------------------------------------------------------
  // Draft
  // -------------------------------------------------------------------------

  buildDraftFromStore() {
    const app = this.store.get("app") || {};
    const project = ensureAssetsOnProject(safeClone(app.project || {}));

    // Draft-Zwischenspeicher (Tab-Wechsel ohne Speichern)
    const savedDraft = app?.ui?.drafts?.assetLibrary;

    const draft = savedDraft || {
      projectId: project.id || "",
      assets: project.assets || { items: [], folders: [], settings: {} }
    };

    // Sicherstellen, dass Struktur immer stimmt
    if (!draft.assets) draft.assets = { items: [], folders: [], settings: {} };
    if (!Array.isArray(draft.assets.items)) draft.assets.items = [];

    return draft;
  }

  applyDraftToStore(draft) {
    this.store.update("app", (app) => {
      app.project = app.project || {};
      ensureAssetsOnProject(app.project);

      // Assets komplett ersetzen (einfach, robust)
      app.project.assets = safeClone(draft.assets);

      // Draft im UI merken
      app.ui = app.ui || {};
      app.ui.drafts = app.ui.drafts || {};
      app.ui.drafts.assetLibrary = safeClone(draft);

      // Meta: updatedAt an allen Assets pflegen (wenn noch nicht gesetzt)
      const now = nowIso();
      (app.project.assets.items || []).forEach(a => {
        a.meta = a.meta || {};
        if (!a.meta.createdAt) a.meta.createdAt = now;
        a.meta.updatedAt = now;
      });

      return app;
    });
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  renderBody(bodyEl, draft) {
    const section = new Section({ title: "Asset-Bibliothek" });
    section.mount(bodyEl);

    // Hinweistext (kurz und klar)
    section.body.appendChild(
      h("div", { style: { opacity: ".75", fontSize: "12px", marginBottom: "10px" } },
        "Hier verwaltest du Assets pro Projekt (Name, Pfad, Tags) + PresetTransform (Scale/Rotation/Offset)."
      )
    );

    // Actions
    const row = h("div", { style: { display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" } });

    const btnAdd = h("button", {
      type: "button",
      className: "btn-primary",
      onClick: () => {
        const id = makeAssetId();
        const now = nowIso();

        const a = {
          id,
          name: `Asset ${id}`,
          type: "model/gltf-binary",
          src: "",
          tags: [],
          meta: { createdAt: now, updatedAt: now },
          presetTransform: {
            pos:   [0, 0, 0],
            rot:   [0, 0, 0],  // radians
            scale: [1, 1, 1]
          }
        };

        draft.assets.items.push(a);
        this.setDirty(true);
        this.rerender();
      }
    }, "＋ Neues Asset");

    const btnOpenAssetLab = h("button", {
      type: "button",
      className: "bp-btn",
      onClick: () => {
        // In-App Navigation (wenn Bus das kann) – sonst fallback: Hinweis.
        const payload = { panel: "projectPanel:assetlab3d" };
        try {
          if (this.bus?.emit) this.bus.emit("ui:navigate", payload);
          else alert("AssetLab kannst du über den Projekt-Tab 'AssetLab 3D' öffnen.");
        } catch {
          alert("AssetLab kannst du über den Projekt-Tab 'AssetLab 3D' öffnen.");
        }
      }
    }, "↗︎ AssetLab öffnen");

    row.appendChild(btnAdd);
    row.appendChild(btnOpenAssetLab);
    section.body.appendChild(row);

    // List
    const list = h("div", { style: { marginTop: "12px", display: "flex", flexDirection: "column", gap: "10px" } });

    const items = draft.assets.items || [];
    if (!items.length) {
      list.appendChild(
        h("div", { style: { opacity: ".7", fontSize: "12px", padding: "10px" } },
          "Noch keine Assets. Klicke auf „Neues Asset“ oder importiere später über AssetLab."
        )
      );
    } else {
      items.forEach((asset, idx) => list.appendChild(this._renderAssetCard(draft, asset, idx)));
    }

    section.body.appendChild(list);

    // Extra Hinweis
    section.body.appendChild(
      h("div", { style: { opacity: ".65", fontSize: "12px", marginTop: "10px" } },
        "Tipp: PresetTransform ist ideal, um Scale/Rotation/Bodenversatz zu korrigieren, ohne das GLB neu zu exportieren."
      )
    );
  }

  // -------------------------------------------------------------------------
  // Card Renderer
  // -------------------------------------------------------------------------

  _renderAssetCard(draft, asset, idx) {
    const card = h("div", { className: "panel-card" });

    // Header
    const head = h("div", { style: { display: "flex", gap: "8px", alignItems: "center", marginBottom: "8px" } });
    head.appendChild(h("b", {}, asset.name || `Asset ${idx + 1}`));
    head.appendChild(h("span", { style: { opacity: ".65", fontSize: "12px" } }, asset.id || ""));

    const btnDup = h("button", {
      type: "button",
      className: "bp-btn",
      style: { marginLeft: "auto" },
      onClick: () => {
        const c = safeClone(asset);
        c.id = makeAssetId();
        c.name = (asset.name || "Asset") + " (Copy)";
        c.meta = c.meta || {};
        c.meta.createdAt = nowIso();
        c.meta.updatedAt = nowIso();
        draft.assets.items.splice(idx + 1, 0, c);
        this.setDirty(true);
        this.rerender();
      }
    }, "Duplizieren");

    const btnDel = h("button", {
      type: "button",
      className: "bp-btn",
      onClick: () => {
        if (!confirm(`Asset löschen?\n\n${asset.name || asset.id || ""}`)) return;
        draft.assets.items.splice(idx, 1);
        this.setDirty(true);
        this.rerender();
      }
    }, "Löschen");

    head.appendChild(btnDup);
    head.appendChild(btnDel);

    card.appendChild(head);

    // Fields: name, src, tags
    card.appendChild(this._field("Name", asset.name || "", (v) => { asset.name = v; this._touch(asset); }));
    card.appendChild(this._field("Quelle / Pfad (src)", asset.src || "", (v) => { asset.src = v; this._touch(asset); }, "z.B. assets/models/halle.glb"));
    card.appendChild(this._field("Tags (Komma-getrennt)", (asset.tags || []).join(", "), (v) => { asset.tags = parseTags(v); this._touch(asset); }, "halle, stahlbau, maschine"));

    // PresetTransform (numerisch)
    card.appendChild(h("div", { style: { marginTop: "10px", opacity: ".8", fontSize: "12px" } }, "PresetTransform (Root):"));

    const pt = asset.presetTransform || (asset.presetTransform = { pos:[0,0,0], rot:[0,0,0], scale:[1,1,1] });
    if (!Array.isArray(pt.pos)) pt.pos = [0,0,0];
    if (!Array.isArray(pt.rot)) pt.rot = [0,0,0];
    if (!Array.isArray(pt.scale)) pt.scale = [1,1,1];

    // Scale (uniform)
    const curScale = Number(pt.scale?.[0] ?? 1);
    card.appendChild(this._numberField("Scale (uniform)", curScale, (n) => {
      const v = isFinite(n) && n > 0 ? n : 1;
      pt.scale = [v, v, v];
      this._touch(asset);
    }));

    // Rotation Y in Grad (intern radians)
    const curRotYdeg = radToDeg(Number(pt.rot?.[1] ?? 0));
    card.appendChild(this._numberField("Rotation Y (Grad)", curRotYdeg, (n) => {
      pt.rot = [0, degToRad(n), 0];
      this._touch(asset);
    }));

    // Offset Y (Bodenversatz)
    const curOffY = Number(pt.pos?.[1] ?? 0);
    card.appendChild(this._numberField("Offset Y (Boden)", curOffY, (n) => {
      pt.pos = [0, Number(n) || 0, 0];
      this._touch(asset);
    }));

    // Quick Buttons
    const btnRow = h("div", { style: { display:"flex", gap:"8px", alignItems:"center", flexWrap:"wrap", marginTop:"8px" } });

    const btnReset = h("button", {
      type:"button",
      className:"bp-btn",
      onClick: () => {
        asset.presetTransform = { pos:[0,0,0], rot:[0,0,0], scale:[1,1,1] };
        this._touch(asset);
        this.rerender();
      }
    }, "Preset reset");

    const btnPopout = h("button", {
      type:"button",
      className:"bp-btn",
      onClick: () => {
        // Popout: direkt iframe öffnen (funktioniert auch ohne Bus-Navigation)
        const pid = this.store.get("app")?.project?.id || "unknown";
        const url = `modules/assetlab3d/iframe/index.html?projectId=${encodeURIComponent(pid)}`;
        window.open(url, "_blank");
      }
    }, "AssetLab Popout");

    btnRow.appendChild(btnReset);
    btnRow.appendChild(btnPopout);
    card.appendChild(btnRow);

    return card;
  }

  // -------------------------------------------------------------------------
  // UI helpers
  // -------------------------------------------------------------------------

  _touch(asset) {
    asset.meta = asset.meta || {};
    asset.meta.updatedAt = nowIso();
    this.setDirty(true);
  }

  _field(label, value, onChange, placeholder = "") {
    const ff = new FormField({
      label,
      input: h("input", {
        value,
        placeholder,
        onInput: (e) => onChange(e.target.value)
      })
    });
    return ff.el;
  }

  _numberField(label, value, onChange) {
    const ff = new FormField({
      label,
      input: h("input", {
        type: "number",
        value: String(value ?? 0),
        step: "0.01",
        onInput: (e) => {
          const n = Number(e.target.value);
          onChange(n);
        }
      })
    });
    return ff.el;
  }
}
