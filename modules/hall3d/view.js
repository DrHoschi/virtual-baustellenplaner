/**
 * modules/hall3d/view.js
 * Version: v1.0.0 (2026-02-04)
 *
 * View-Controller:
 * - Erzeugt/entsorgt die Three.js Szene sauber beim Tab-Wechsel
 * - Baut (procedural) die Demo-Halle anhand Preset
 *
 * Hinweis:
 * - THREE wird global über index.html geladen (Script-Tag).
 */

import { initScene } from "./core/scene.js";
import { ModelFactory } from "./core/model-factory.js";
import { rebuildProfiMarkers } from "./core/markers.js";
import { mergeParams, applyParamPack, computeMetrics } from "./core/param-engine.js";

export function createHall3DView({ bus, store, rootEl }) {
  let sceneCtx = null;
  let elementMeshes = null;
  let current = {
    group: null,
    paramPack: null,
    params: null,
    metrics: null
  };

  // Mini UI (v1): Ein kleines Param-Panel direkt in der Hall3D Ansicht.
  // Später wandert das in den Inspector/Workarea.
  let ui = {
    host: null,
    fields: new Map() // paramId -> input
  };

  function _makeFloatingPanel() {
    const host = document.createElement("div");
    host.style.position = "absolute";
    host.style.right = "12px";
    host.style.top = "12px";
    host.style.width = "320px";
    host.style.maxHeight = "70vh";
    host.style.overflow = "auto";
    host.style.padding = "10px";
    host.style.borderRadius = "10px";
    host.style.background = "rgba(10,12,16,.78)";
    host.style.border = "1px solid rgba(255,255,255,.12)";
    host.style.backdropFilter = "blur(6px)";
    host.style.fontFamily = "system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
    host.style.color = "#e9eef6";
    host.style.fontSize = "12px";
    host.style.zIndex = "5";
    host.style.pointerEvents = "auto";
    return host;
  }

  function _renderParamUI() {
    if (!sceneCtx?.container) return;
    if (ui.host) ui.host.remove();
    ui.fields.clear();

    const pack = current.paramPack;
    if (!pack?.ui?.groups?.length) return;

    ui.host = _makeFloatingPanel();
    const title = document.createElement("div");
    title.textContent = `Parameter – ${pack.label || pack.id}`;
    title.style.fontWeight = "700";
    title.style.marginBottom = "8px";
    ui.host.appendChild(title);

    for (const g of pack.ui.groups) {
      const gh = document.createElement("div");
      gh.textContent = g.label || g.id;
      gh.style.margin = "10px 0 6px";
      gh.style.opacity = ".85";
      gh.style.fontWeight = "600";
      ui.host.appendChild(gh);

      for (const f of g.fields || []) {
        const row = document.createElement("div");
        row.style.display = "grid";
        row.style.gridTemplateColumns = "1fr 140px";
        row.style.gap = "8px";
        row.style.alignItems = "center";
        row.style.marginBottom = "8px";

        const label = document.createElement("div");
        label.textContent = f.label || f.id;
        label.style.opacity = ".9";

        const input = document.createElement("input");
        input.type = f.type === "range" ? "range" : "number";
        if (f.min != null) input.min = String(f.min);
        if (f.max != null) input.max = String(f.max);
        if (f.step != null) input.step = String(f.step);
        input.value = String(current.params?.[f.id] ?? pack.defaults?.[f.id] ?? "0");
        input.style.width = "100%";

        // Live-Update: bei range sofort, bei number on-change + enter
        const onCommit = () => {
          const v = Number(input.value);
          bus.emit("req:hall3d:param:update", { key: f.id, value: v });
        };
        input.addEventListener("input", () => {
          if (input.type === "range") onCommit();
        });
        input.addEventListener("change", onCommit);
        input.addEventListener("keydown", (e) => {
          if (e.key === "Enter") onCommit();
        });

        row.appendChild(label);
        row.appendChild(input);
        ui.fields.set(f.id, input);
        ui.host.appendChild(row);
      }
    }

    // Metrics / BOM
    const metricsBox = document.createElement("div");
    metricsBox.style.marginTop = "10px";
    metricsBox.style.paddingTop = "10px";
    metricsBox.style.borderTop = "1px solid rgba(255,255,255,.12)";
    metricsBox.style.opacity = ".95";

    const mTitle = document.createElement("div");
    mTitle.textContent = "Stückliste / Kosten (live)";
    mTitle.style.fontWeight = "700";
    mTitle.style.marginBottom = "6px";
    metricsBox.appendChild(mTitle);

    const list = document.createElement("div");
    list.style.display = "flex";
    list.style.flexDirection = "column";
    list.style.gap = "6px";
    metricsBox.appendChild(list);

    const totals = document.createElement("div");
    totals.style.marginTop = "8px";
    totals.style.fontWeight = "700";
    metricsBox.appendChild(totals);

    const renderMetrics = () => {
      const m = current.metrics;
      list.innerHTML = "";
      if (m?.bom?.length) {
        for (const it of m.bom) {
          const line = document.createElement("div");
          const qty = Number(it.qty || 0);
          const cost = Number(it.cost || 0);
          line.textContent = `${it.label}: ${qty.toFixed(2)} ${it.unit || ""}  |  ${cost.toFixed(2)} €`;
          line.style.opacity = ".9";
          list.appendChild(line);
        }
      } else {
        const none = document.createElement("div");
        none.textContent = "(keine BOM im ParamPack)";
        none.style.opacity = ".7";
        list.appendChild(none);
      }
      const t = Number(m?.totals?.cost || 0);
      totals.textContent = `Summe: ${t.toFixed(2)} €`;
    };
    renderMetrics();
    metricsBox._renderMetrics = renderMetrics;
    ui.host.appendChild(metricsBox);

    sceneCtx.container.appendChild(ui.host);
  }

  async function mount() {
    if (sceneCtx) return; // schon gemountet
    sceneCtx = initScene({ rootEl });
    sceneCtx.mount();

    // Damit Overlay-UI (Param-Panel) korrekt positioniert werden kann
    rootEl.style.position = "relative";
    rootEl.style.overflow = "hidden";

    // Projekt/State aus Store
    // v1: Default bleibt die Demo-Halle (procedural)
    // Optional: st.modelKind === "glb" um GLB + ParamPack zu laden.
    const st = store.get("hall3d");
    const modelKind = st?.modelKind || "procedural";

    const project = {
      id: "demo",
      name: "Hall3D Demo",
      model:
        modelKind === "glb"
          ? {
              kind: "glb",
              modelId: st?.modelId || "skid_production_v1",
              params: st?.params || {}
            }
          : {
              kind: "procedural",
              presetId: st?.presetId || "hall_demo_v1",
              overrides: st?.overrides || {}
            },
      issues: [],
      tasks: []
    };

    // Modell bauen
    const built = await ModelFactory.build(project);
    if (built?.group) {
      sceneCtx.scene.add(built.group);
      current.group = built.group;
      current.paramPack = built.paramPack || null;
      current.params = built.params || null;
      current.metrics = built.metrics || null;
    }
    elementMeshes = built?.elementMeshes || [];
    rebuildProfiMarkers(sceneCtx.scene, project, elementMeshes);

    // Param UI nur anzeigen, wenn ParamPack vorhanden
    _renderParamUI();
  }

  function unmount() {
    if (!sceneCtx) return;
    try {
      sceneCtx.unmount();
    } finally {
      sceneCtx = null;
      elementMeshes = null;
      current = { group: null, paramPack: null, params: null, metrics: null };
      ui.fields.clear();
      ui.host = null;
      rootEl.innerHTML = "";
    }
  }

  // ------------------------------------------------------------
  // Live Param Updates (v1)
  // ------------------------------------------------------------
  bus.on("req:hall3d:param:update", (payload = {}) => {
    const core = store.get("core");
    if (core?.ui?.activeModule !== "hall3d") return;
    if (!payload?.key) return;

    // Store persist (damit Reload/Tabwechsel stabil bleibt)
    store.update("hall3d", (s) => {
      s.modelKind = s.modelKind || "glb";
      s.modelId = s.modelId || "skid_production_v1";
      s.params = s.params || {};
      s.params[payload.key] = payload.value;
      s.lastParamTs = Date.now();
    });

    if (!current.group || !current.paramPack) return;

    // Merge + apply
    const next = mergeParams(current.paramPack.defaults || {}, store.get("hall3d")?.params || {});
    current.params = next;
    applyParamPack(current.group, current.paramPack, current.params);
    current.metrics = computeMetrics(current.paramPack, current.params);

    // Mini-UI: Inputs synchron halten (z.B. wenn value clamped wird – später)
    const inp = ui.fields.get(payload.key);
    if (inp) inp.value = String(payload.value);

    // Metrics UI refresh (falls vorhanden)
    try {
      const metricsBox = ui.host?.querySelector?.("div")?.parentElement; // best effort
      // wir hängen render function am metricsBox an (siehe _renderParamUI)
      const any = ui.host?.querySelector?.("div");
      // safer: wir suchen nach dem Box-Element via property
      const boxes = ui.host ? Array.from(ui.host.children) : [];
      for (const b of boxes) {
        if (typeof b?._renderMetrics === "function") b._renderMetrics();
      }
    } catch (_) {
      // ignore
    }
  });

  // Optional: Rebuild Event
  bus.on("req:hall3d:rebuild", async (payload = {}) => {
    // Nur reagieren, wenn Ansicht aktiv ist (ansonsten sparen wir Ressourcen)
    const core = store.get("core");
    if (core?.ui?.activeModule !== "hall3d") return;

    store.update("hall3d", (s) => {
      if (payload.presetId) s.presetId = payload.presetId;
      if (payload.overrides) s.overrides = payload.overrides;
      s.lastBuildTs = Date.now();
    });

    // Soft-Rebuild: unmount/mount
    unmount();
    await mount();
  });

  return { mount, unmount };
}
