/**
 * ui/panels/WorkareaPanel.js
 * Version: v1.5.3-clean-target-save-structure-v3 (2026-05-23)
 *
 * Ziel:
 * - Cybermotion-Style Arbeitsbereich als datengetriebene Shell
 * - Viewport Step 4: Canvas + ResizeObserver + RenderLoop + Pan/Zoom/Grid + Selection + Hit-Test + Objekt-Drag (Dummy Scene)
 *
 * Step 5A:
 * - Assets Tab liest echte ProjectAssets aus dem Store (app.project.projectAssets)
 * - Click auf Asset -> setzt Selection (type:"projectAsset"), 0 Risiko (read-only)
 *
 * Step 5B (neu):
 * - Place-Mode: Tap im Viewport erzeugt eine Instanz (type:"asset.instance")
 * - Instanzen werden in app.project.workspace.scene.objects persistiert
 *
 * Step 5C (neu, requested):
 * - "Remember Workarea State" (NUR innerhalb Workarea, NICHT App-Startup!)
 * - Wenn du innerhalb der App zurück zur Workarea wechselst, soll Workarea
 *   den letzten Zustand wiederherstellen (Tabs/Mode/PlaceCtx).
 * - Beim kompletten Tab-Schließen (Safari) darf die App ruhig wieder auf
 *   Startseite landen – das ist NICHT Teil von 5C.
 *
 * Persistenz-Ort (bewusst klein & stabil):
 * - app.settings.ui.workarea
 *   { modeId, leftTabId, rightTabId, placeCtx:{projectAssetId,slotId} }

 * Step 5F (neu, requested):
 * - Workarea darf NICHT aus ui.drafts.* lesen.
 *   Drafts sind Editor-Puffer (WorkspaceSettingsPanel) und können beim „cold start“
 *   leer/alt sein. Workarea rendert ausschließlich aus:
 *   -> app.settings.workspace (UI/Settings) + app.project.workspace.scene.objects (Scene)
 *
 * Ziel:
 * - Nach Tab schließen + neu öffnen (iPad/Safari) siehst du wieder exakt den
 *   persistierten Workspace/Scene-Stand (Instanzen), ohne „Dummy“.

 * Step 5G (neu, requested):
 * - Hydration-Guard (iPad/Safari / Tab schließen):
 *   Beim „kalten“ Start ist der Store zwar persistent, aber die Rehydrate-Reihenfolge
 *   kann dazu führen, dass Workarea kurz mit Default-State rendert.
 *   -> UX: Spinner-Overlay anzeigen, bis activeProjectId da ist; Scene-Shape wird notfalls erzeugt.
 *   -> Danach Scene injecten (rehydrate) und Overlay ausblenden.
 *
 * WICHTIG: Du wolltest NICHT, dass die App beim Start automatisch wieder in die Workarea springt.
 *          Step 5G ändert nur die Workarea-Initialisierung, wenn du sie öffnest.

 * Step 5H (neu, requested):
 * - Typ-spezifische 2D-Renderer (Placeholder) für Scene-Objekte.
 *   -> conveyor.segment / hall.procedural / asset.glb / asset.instance
 * - Macht Reload/Tab-Schließen visuell eindeutig (kein „alles ist Kreis“).


 * Step 5I (neu, architektur-sicher):
 * - Dock-Settings aus WorkspaceSettingsPanel müssen auch dann in der Workarea ankommen,
 *   wenn das WorkareaPanel beim Speichern NICHT gemountet ist (Event würde sonst "ins Leere" gehen).
 * - Lösung:
 *   1) Workarea persistiert eigene Dock-UI (manuelle Toggles) unter app.settings.ui.workarea.dockState.
 *   2) Zusätzlich merken wir, welche Workspace-Dock-Signatur zuletzt in die UI übernommen wurde
 *      (dockState.lastWorkspaceDockSigApplied).
 *   3) Beim Mount/Init: Auto-Apply, falls Workspace-Dock-Signatur sich seit der letzten Übernahme geändert hat.
 *      -> Damit wirken Änderungen aus WorkspaceSettings zuverlässig beim nächsten Öffnen,
 *         ohne dass wir den "manual docks" Fix (v1.1.4) kaputt machen.

 *
 * WICHTIG:
 * - Debug/Checker bleiben drin.
 *
 * Neu in v1.4.6 (AssemblyLab Ports v1):
 * - Bauteile bekommen rollenbasierte Anschluss-/Port-Vorlagen.
 * - MOVIFIT/Steuerung enthaelt bewusst 400V, 24V DC, STO/Safety und Bedienpult/Safety-Ausgang als Startmodell.
 * - Ports werden an Komponenten, componentRefs und assembly.instance.ports persistiert und im Properties-Panel angezeigt.
 * - CablePoints v1 erzeugt aus Ports erste Kabelpunkte fuer 400V, 24V, Safety/STO, Motor, Profinet, Sensor und PE/PA.
 *
 * Neu in v1.4.5 (AssemblyLab BOM v1):
 * - BOM wertet AssemblyLab-Bauteile nach Baugruppe, Rolle, Asset/Slot und technischer Beschriftung aus.
 * - BOM-Export CSV/JSON enthält assemblyName, Fördergruppe, Ortbereich, BMK, Rolle und Projekt-Asset-Bezug.
 * - BOM-Ansicht nutzt mobile-freundliche Positionskarten statt breiter Tabelle.
 *
 * Neu in v1.4.2 (AssemblyLab v1):
 * - Linker Tab "Baugruppen" direkt in der Workarea.
 * - Projekt-Assets koennen als Bauteile in eine Master-Baugruppe gezogen/geklickt werden.
 * - Bauteile koennen X/Y/Rotation bekommen, Varianten werden projektgebunden gespeichert.
 * - Gespeicherte Variante kann als assembly.instance in die Workarea eingefuegt werden.
 * - Assembly-Daten bleiben als JSON erhalten; GLB-Export kommt spaeter als Ergebnis, nicht als Quelle.
 *
 * - Absichtlich kein PanelBase (Workarea ist eine eigene Shell).
 *
 * Verhalten (Tablet/iPhone-freundlich):
 * - Select-Mode:
 *    - Tap (unter Threshold) = Selection (Objekt via HitTest, sonst Punkt)
 *    - Drag auf Objekt (über Threshold) = Objekt verschieben (optional Snap)
 *    - Drag im leeren Bereich (über Threshold) = View pannen (1 Finger „wie früher“)
 * - Pan-Mode:
 *    - Drag = View pannen (sofort, ohne Threshold)
 * - Pinch (2 Finger):
 *    - Zoom um Midpoint (stabil), Pan/Drag wird dabei deaktiviert
 *
 * Neu in v1.1.4:
 * - Docks werden NICHT mehr automatisch aus Workspace-Settings auf UI-State "gedrückt".
 *   Du willst Docks manuell ein/ausblenden – Workarea respektiert das.
 * - Best-Effort Activate-Request: Wenn ein Projekt aktiv ist, sendet Workarea beim Mount
 *   ein "bitte Workarea aktivieren" Signal über den Bus. (Wiring muss in Shell angenommen werden.)
 *
 * Neu in v1.3.4 (Layout Diagnostics v1):
 * - Workarea Breakpoint-Diagnose für Desktop/Tablet/Mobile.
 * - Copy-Button für kurzen Layout-Debug-JSON.
 * - Canvas-/Dock-/Viewport-Rechtecke werden messbar, ohne kompletten Snapshot zu kopieren.
 * - WICHTIG: Dieser Patch ändert noch NICHT das finale Mobile-Layout; er misst zuerst.
 *
 * Neu in v1.1.5:
 * - Workspace Settings können gezielt Docks live anwenden:
 *   Event cb:settings:workspace:changed kann { applyDocks:true } senden
 *   -> Workarea übernimmt Dock-Defaults EINMALIG (ideal: Smartphone „alles einklappen“)
 *   -> ohne den manual-docks Fix wieder kaputt zu machen.
 */


/* ============================================================================
 * PATCH_workarea_ui_mode_dock_refactor_v1
 * --------------------------------------------------------------------------
 * Zentrale, leichte UI-Regel fuer die Workarea.
 * Ziel: Im rechten Dock nie mehr alle schweren Property-/BOM-/Elektrik-Blöcke
 * automatisch rendern. Der Property Manager zeigt nur eine Kurzkarte; schwere
 * Editorbereiche werden erst per Dialog/Overlay aufgebaut. Das entlastet iOS
 * Safari und macht Desktop/iPad/Mobil konsistenter.
 * ========================================================================== */
const WORKAREA_MODE_UI_V1 = Object.freeze({
  select: {
    leftTab: "tab.structure",
    rightTab: "tab.properties",
    leftDockCollapsed: false,
    rightDockCollapsed: false,
    label: "Auswahl",
    hint: "Objekt auswählen, kurz prüfen und bei Bedarf Details öffnen."
  },
  place: {
    leftTab: "tab.insert",
    rightTab: "tab.properties",
    leftDockCollapsed: false,
    rightDockCollapsed: false,
    label: "Einfügen",
    hint: "Links Baugruppen/Assets wählen; rechts nur Einfüge-Kurzinfo."
  },
  pan: {
    leftTab: "tab.structure",
    rightTab: "tab.properties",
    leftDockCollapsed: true,
    rightDockCollapsed: true,
    label: "Pan",
    hint: "Nur Viewer bedienen. Docks werden für maximale Fläche ausgeblendet."
  },
  edit: {
    leftTab: "tab.structure",
    rightTab: "tab.properties",
    leftDockCollapsed: false,
    rightDockCollapsed: false,
    label: "Bearbeiten",
    hint: "Kurzkarte rechts; Detailbereiche über einzelne Dialoge öffnen."
  }
});

const WORKAREA_LEFT_TABS_V1 = Object.freeze([
  { id: "tab.structure", title: "Struktur", mobileTitle: "Struktur", icon: "tree" },
  { id: "tab.insert", title: "Einfügen", mobileTitle: "Einfügen", icon: "plus" },
  { id: "tab.assemblylab", title: "Baugruppen", mobileTitle: "Baugrp.", icon: "assembly" },
  { id: "tab.assets", title: "Assets", mobileTitle: "Assets", icon: "assets" },
  { id: "tab.tools", title: "Tools", mobileTitle: "Tools", icon: "tools" }
]);

export class WorkareaPanel {
  constructor({ bus, store, rootEl, panelId, moduleKey, version } = {}) {
    this.bus = bus;
    this.store = store;
    this.rootEl = rootEl;
    this.panelId = panelId || moduleKey || "tools:workarea";
    this.version = version || "n/a";

    this._mounted = false;

    // -------------------------------------------------------------------
    // Thumbnail Cache (NEU/BUGFIX)
    // -------------------------------------------------------------------
    // Hintergrund:
    // - Für Slot-Thumbnails (dataUrl) nutzen wir _getOrCreateThumbImage().
    // - In einigen Ständen wurde _thumbCache nie initialisiert.
    //   -> Safari/iOS wirft dann: "TypeError: undefined is not an object (evaluating 'this._thumbCache.get')"
    //   -> der Render-/UI-Flow bricht ab, was indirekt Persistenz/Autosave
    //      und Panel-Rehydration sabotieren kann.
    //
    // Lösung:
    // - Cache immer im ctor initialisieren.
    // - Zusätzlich defensive Guards in _getOrCreateThumbImage().
    // - Soft-Limit, damit dataUrls nicht unendlich RAM fressen.
    this._thumbCache = new Map();
    this._thumbCacheMax = 96;
    this._thumbCacheKeys = [];

    // -------------------------------------------------------------------
    // Step 5J (NEU): Workarea Auto-Save (NUR Workarea)
    // -------------------------------------------------------------------
    // Problem (Safari/iOS):
    // - Tab-Wechsel innerhalb der SPA hält Store im RAM -> Scene bleibt sichtbar
    // - Reload / Safari schließen löscht RAM -> nur Persistenz zählt
    // - Loader/Persistor speichert aktuell NUR auf "ui:project:save" / "ui:save"
    //
    // Lösung:
    // - Immer wenn Workarea die Scene in den Store schreibt, feuern wir
    //   (gedrosselt) ein Save-Event an den globalen Persistor.
    // - Dadurch ist nach Reload/Cold-Start die Scene wieder da.
    //
    // WICHTIG:
    // - Kein globales enableAutosave() (zu viel Traffic).
    // - Debounce, damit Drag nicht jede Bewegung speichert.
    this._waAutosave = {
      enabled: true,
      debounceMs: 650,
      timer: 0,
      lastReason: "",
      mountAt: 0,
      mobileHeightLocked: false,
      // optional: wenn wir intern mal "rehydrate" Aktionen machen,
      // könnte man suppress temporär setzen. Derzeit wird Auto-Save
      // nur über _persistSceneToStore ausgelöst, daher standard: false.
      suppress: false
    };

    // -------------------------------------------------------------------
    // Crash Recorder Breadcrumbs
    // -------------------------------------------------------------------
    // Diese Zaehler schreiben NICHT jeden pointermove in localStorage, sondern
    // nur verdichtete Meilensteine. Damit koennen wir nach einem iOS/Safari-
    // Reload sehen, ob der letzte Schritt Drag, Save, Render oder UI war.
    this._crashDiag = {
      dragMoveCount: 0,
      lastDragLogAt: 0,
      resizeCount: 0,
      lastResizeLogAt: 0,
      lastPersistBytes: 0
    };

    // -------------------------------------------------------------------
    // Mobile Drag Stability v2.2 (DIREKT im WorkareaPanel)
    // -------------------------------------------------------------------
    // Warum direkt hier?
    // - Der externe Prototype-Patch kann bei ES-Module-Klassen ins Leere laufen,
    //   wenn WorkareaPanel nicht global an window hängt.
    // - Deshalb wird der Low-Power-Drag jetzt hier an der echten Quelle
    //   geschaltet: PointerDown/Move/Up + Renderloop.
    //
    // Wirkung auf iPhone/Safari:
    // - Während ein Objekt gezogen wird, wird der Canvas nicht mehr mit voller
    //   60-fps-Last neu gezeichnet.
    // - Es gibt maximal ca. 12–15 Zeichnungen pro Sekunde während Drag.
    // - Nach PointerUp wird einmal sauber final gerendert und erst danach darf
    //   der normale Loop weiterlaufen.
    this._mobileDrag = {
      version: "v2.2.0-direct-workarea-lowpower",
      enabled: true,
      lowPower: false,
      pointerId: null,
      dragObjId: null,
      enterAt: 0,
      moveCount: 0,
      renderCount: 0,
      skippedFrames: 0,
      lastRenderAt: 0,
      minRenderGapMs: 80,
      finalRenderTimer: 0
    };

    // -------------------------------------------------------------------
    // PATCH_workarea_mobile_resize_guard_v3
    // -------------------------------------------------------------------
    // Problem:
    // - iOS/Safari feuert bei Adressleiste, Bottom-Bar, Tastatur, Scroll,
    //   Panelwechsel und Property-Manager-Höhenänderungen sehr viele ResizeEvents.
    // - Bisher wurde aus ResizeObserver/window.resize direkt der Canvas neu
    //   dimensioniert und zusätzlich LayoutDiag aktualisiert.
    // - Das erzeugt auf iPhone/iPad eine Resize-/Render-Kaskade und kann Safari
    //   zum Reload zwingen, ohne dass vorher ein window:error kommt.
    //
    // Ziel:
    // - ResizeObserver wird entkoppelt.
    // - Kleine reine Höhenänderungen auf Mobile werden ignoriert.
    // - Echte Änderungen werden gedrosselt angewendet.
    // - Nach kurzer Ruhezeit gibt es trotzdem einen finalen Sync.
    // - Debug-/Crash-Logs bleiben erhalten, aber ohne Spam.
    this._mobileResizeGuard = {
      version: "v3.0.0-mobile-resize-lock",
      enabled: true,

      // Drosselung für echte Canvas-Resize-Anwendungen.
      throttleMs: 420,

      // Mobile Safari verändert oft nur die sichtbare Höhe um kleine Werte.
      // Diese Änderungen sollen nicht jedes Mal einen Canvas-Rebuild erzeugen.
      mobileHeightNoisePx: 160,

      // PATCH v3:
      // iOS/Safari klappt die Browserleisten und die mobile Bottom-/Tab-Fläche
      // gerne zwischen zwei Höhen hin und her. Wenn nur die Höhe wechselt,
      // darf das nicht permanent den Canvas neu aufbauen. Breite/DPR-Wechsel
      // bleiben weiterhin echte Resize-Ereignisse.
      mobilePureHeightLock: true,
      mobileStartupGrowOnce: true,
      mobileStartupGrowMs: 12000,
      mobileStartupGrowMinPx: 60,

      // Nach einer ignorierten/gedrosselten Änderung wird ein finaler Sync geplant.
      finalSyncMs: 1800,

      // Timer / Status
      timer: 0,
      finalTimer: 0,
      lastRequestAt: 0,
      lastApplyAt: 0,
      lastReason: "",
      mountAt: 0,
      mobileHeightLocked: false,

      // Letzte wirklich angewendete Canvas-Größe.
      lastApplied: {
        w: 0,
        h: 0,
        dpr: 1,
        bw: 0,
        bh: 0
      },

      // Zähler für Diagnose.
      requested: 0,
      applied: 0,
      ignoredHeightNoise: 0,
      throttled: 0,
      ignoredDuringGesture: 0,
      startupGrowApplied: 0
    };

    // Datenmodelle
    this.layout = null;
    this.tools = null;
    this.props = null;

    // UI refs
    this._els = {
      header: null,
      shell: null,

      // Docks/Regionen
      topbar: null,
      leftDock: null,
      center: null,
      rightDock: null,
      bottom: null,
      consoleDrawer: null,

      // Sub UI
      statusLine: null,
      layoutDiagBadge: null,
      modeSelect: null,
      leftTabsBar: null,
      rightTabsBar: null,
      leftPanelHost: null,
      rightPanelHost: null
    };

    // --- Viewport (Canvas + Resize + RenderLoop + Pan/Zoom) ---
    this._vp = {
      host: null,
      canvas: null,
      ctx2d: null,
      ro: null,
      raf: 0,
      running: false,
      w: 0,
      h: 0,
      dpr: 1,
      t0: 0,
      fps: 0,
      _fpsAcc: 0,
      _fpsN: 0,

      zoom: 1,
      offsetX: 0,
      offsetY: 0,

      pointer: {
        active: new Map(),

        // Tap-Threshold robust pro Pointer (Multi-Touch sicher)
        down: new Map(), // pointerId -> {x,y}

        // "Letzte" Koordinaten für Pan-Delta
        lastX: 0,
        lastY: 0,

        // Panning State
        isPanning: false,
        panPointerId: null, // welcher Pointer aktuell den Pan “führt”

        // Objekt-Drag State (Select-Mode)
        dragObjId: null, // Objekt, auf dem pointerdown stattfand
        dragActive: false, // wird erst nach Threshold aktiv
        dragOffset: { x: 0, y: 0 }, // world-offset zwischen Pointer und Objektzentrum

        // Flag: wurde das Objekt während Drag wirklich bewegt?
        // (damit wir am Drag-End nur dann persistieren)
        dragDirty: false,

        // Pinch State
        pinchActive: false,
        pinchDist0: 0,
        pinchZoom0: 1,
        pinchMid0: { x: 0, y: 0 }
      }
    };

    // State
    this.state = {
      modeId: "select",
      leftTabId: "tab.structure",
      rightTabId: "tab.properties",
      consoleOpen: false,

      // Dock collapse (iPad friendly)
      leftDockCollapsed: false,
      rightDockCollapsed: false,
      bottomCollapsed: false,
      fullscreen: false,

      selectionPoint: null, // { wx, wy }
      selection: this._makeDummySelection("project"),

      // Step 5B: Place-Context (Quelle für Instanzen)
      // - wird gesetzt, wenn im Assets-Tab ein ProjectAsset ausgewählt wird.
      // - slotId ist optional (Default: erster Slot mit Model / erster Slot).
      placeCtx: {
        projectAssetId: null,
        slotId: null
      }
    };

    // ------------------------------------------------------------
    // Step 5C: Workarea UI-State aus Store wiederherstellen.
    // (WICHTIG: Das beeinflusst NICHT den App-Startscreen,
    //  sondern nur den Zustand, wenn Workarea geöffnet wird.)
    // ------------------------------------------------------------
    this._restoreWorkareaUiFromStore("ctor");

    // Bus subscriptions
    this._unsubs = [];

    // Workarea Settings Cache (live aus settings:workspace)
    this._cfg = this._getWorkspaceCfgFromStore();

    // -------------------------------------------------------------------
    // Scene Objects
    // -------------------------------------------------------------------
    // Step 4 (bestehend): HitTest + Drag + Selection auf "Objekten".
    // Step 5B (NEU): Place-Mode -> Instanzierung aus ProjectAssets.
    //
    // Persistenz:
    // - Wir speichern Instanzen im Store unter app.project.workspace.scene
    //   (nur JSON), damit Reload/Pages/Snapshot stabil sind.
    // - Falls noch nichts gespeichert wurde, nutzen wir ein Dummy-Set.
    // -------------------------------------------------------------------
    this._scene = {
      objects: this._getSceneObjectsFromStoreOrDefaults()
    };

    // -------------------------------------------------------------------
    // Step 5B Stabilität (iPad/Safari / Tab schließen):
    // -------------------------------------------------------------------
    // Beim „kalten“ Start kann der Store (key:"app") beim Panel-Create
    // noch nicht vollständig rehydriert sein. Dann fallen wir auf Defaults
    // zurück, obwohl eine persistierte Scene existiert.
    //
    // Fix:
    // - Nach dem Mount rehydrieren wir die Scene best-effort erneut.
    // - Zusätzlich lauschen wir auf cb:store:changed und übernehmen die
    //   Scene, sobald sie im Store verfügbar ist.
    // -------------------------------------------------------------------
    this._sceneSync = {
      lastSig: this._sigForObjects(this._scene.objects)
    };

    // -------------------------------------------------------------------
    // Step 5G: Hydration Guard (Spinner + späteres Inject)
    // -------------------------------------------------------------------
    this._hydration = {
      ready: this._isHydratedNow(),
      overlayEl: null,
      lastReason: "ctor"
    };

    // v1.1.4: Docks NICHT automatisch vom Store steuern
    this._respectManualDocks = true;

    // v1.1.4: Best-Effort "Workarea auto-activate if project exists"
    this._didRequestActivate = false;

    // -------------------------------------------------------------------
    // v1.3.4: Layout Diagnostics / Breakpoint Guard
    // -------------------------------------------------------------------
    // Ziel:
    // - Vor dem finalen Mobile-Layout messen wir zuerst, was Browser und
    //   Workarea wirklich sehen: Viewport, DPR, Orientierung, Docks, Canvas.
    // - Tablet darf NICHT automatisch wie Handy behandelt werden.
    // - Die Diagnose ist absichtlich passiv: Sie verändert das Layout nicht.
    this._layoutDiag = {
      lastMode: "unknown",
      lastSig: "",
      lastRenderedMode: "",
      lastSnapshot: null,
      timer: 0
    };
    this._onWindowResizeForLayoutDiag = null;

    // -------------------------------------------------------------------
    // PATCH_workarea_assembly_insert_single_fire_v1
    // -------------------------------------------------------------------
    // Guard für Baugruppen-Insert aus dem schwebenden Baugruppen-Menü.
    // Ziel: Ein Klick darf exakt eine assembly.instance erzeugen.
    // Alte Patch-Stände konnten mehrere Event-Wege auslösen; daher sichern
    // wir hier zusätzlich gegen gleiche txId / gleiche ID in kurzem Zeitfenster.
    this._assemblyInsertGuard = {
      version: "v1.0.0-single-fire",
      seenTx: new Map(),
      recentIds: new Map(),
      listener: null
    };


    // -------------------------------------------------------------------
    // AssemblyLab v1 (NEU)
    // -------------------------------------------------------------------
    // Kleiner, stabiler Baugruppen-Editor direkt in der Workarea:
    // Projekt-Assets -> Bauteile -> Master-Baugruppe -> Variante -> Workarea-Instanz.
    // Die Daten werden projektgebunden unter app.project.assemblyLab gespeichert
    // und parallel nach project.assemblyLab gespiegelt, damit Export/Import robust bleibt.
    this._assemblyLabUi = {
      activeTemplateId: "asm-master-rollenbahn",
      activeVariantId: "standard",
      dropActive: false
    };
  }


  // ------------------------------------------------------------
  // Asset Catalog Helpers (Generic Catalog System)
  // ------------------------------------------------------------

  _buildCatalogIndex(catalogJson) {
    const idx = { byId: new Map(), matchers: [] };

    const items = Array.isArray(catalogJson?.items) ? catalogJson.items : [];
    for (const it of items) {
      if (!it || !it.id) continue;
      idx.byId.set(String(it.id), it);

      // autoMatch Patterns in RegExp umwandeln (defensiv)
      const patterns = Array.isArray(it?.autoMatch?.patterns) ? it.autoMatch.patterns : [];
      for (const p of patterns) {
        try {
          const re = new RegExp(String(p), "i");
          idx.matchers.push({ re, id: String(it.id) });
        } catch (e) {
          console.warn("[workarea] Catalog autoMatch pattern invalid:", p, e);
        }
      }
    }
    return idx;
  }

  _catalogGetById(id) {
    const key = String(id || "");
    return this._catalogIndex?.byId?.get(key) || null;
  }

  _catalogMatchIdByText(text) {
    const t = String(text || "").trim();
    if (!t) return null;
    const ms = Array.isArray(this._catalogIndex?.matchers) ? this._catalogIndex.matchers : [];
    for (const m of ms) {
      try {
        if (m?.re && m.re.test(t)) return m.id;
      } catch (_) {}
    }
    return null;
  }

  _resolveCatalogForSlot(projectAsset, slot) {
    // 1) explizit
    const explicit = slot?.catalogId || null;
    if (explicit) return this._catalogGetById(explicit);

    // 2) autoMatch (Catalog)
    const candidates = [
      slot?.lastImportName,
      slot?.name,
      projectAsset?.name,
      projectAsset?.id
    ];
    let matchedId = null;
    for (const c of candidates) {
      matchedId = this._catalogMatchIdByText(c);
      if (matchedId) break;
    }
    if (matchedId) {
      // Optional: Slot nachhaltig markieren (damit es deterministisch bleibt).
      // -> Wir patchen NUR den Slot (kein Persist-Wildwuchs).
      try {
        const paId = projectAsset?.id;
        const slotId = slot?.id;
        if (paId && slotId) {
          this.store.update("app", (a) => {
            const pas = Array.isArray(a?.project?.projectAssets) ? a.project.projectAssets : [];
            const pa = pas.find((x) => String(x?.id) === String(paId));
            const slots = Array.isArray(pa?.slots) ? pa.slots : [];
            const s = slots.find((x) => String(x?.id) === String(slotId));
            if (s && !s.catalogId) s.catalogId = matchedId;
          });
          this.bus.emit("ui:project:save");
        }
      } catch (e) {
        console.warn("[workarea] Could not persist slot.catalogId:", e);
      }
      return this._catalogGetById(matchedId);
    }

    return null;
  }


  /* ==========================================================================
   * Lifecycle
   * ========================================================================= */

  async mount() {
    if (!this.rootEl) return;
    this._mounted = true;

    // Root vorbereiten
    this.rootEl.innerHTML = "";
    this.rootEl.classList.add("panel-root", "wa-panel-root");
    this.rootEl.style.display = "flex";
    this.rootEl.style.flexDirection = "column";
    this.rootEl.style.minHeight = "0";
    this.rootEl.style.overflow = "hidden";

    // Header
    const header = document.createElement("div");
    header.className = "wa-panel-header";
    header.style.display = "flex";
    header.style.alignItems = "baseline";
    header.style.gap = "10px";
    header.style.padding = "8px 10px";
    header.style.borderBottom = "1px solid rgba(255,255,255,.06)";

    const h = document.createElement("div");
    h.className = "wa-panel-title";
    h.textContent = "Arbeitsbereich";
    h.style.fontWeight = "700";
    h.style.fontSize = "14px";

    const sub = document.createElement("div");
    sub.className = "wa-panel-subtitle";
    sub.textContent =
      "Cybermotion Shell (Viewport Step 4: Pan/Zoom/Grid/Select/HitTest/Drag) – datengetrieben";
    sub.style.opacity = ".65";
    sub.style.fontSize = "12px";

    header.appendChild(h);
    header.appendChild(sub);
    this.rootEl.appendChild(header);

    // Step 5C (zusätzlich zu ctor-restore):
    // Falls Store erst später "warm" ist (z.B. Project load),
    // versuchen wir beim Mount noch einmal best-effort.
    this._restoreWorkareaUiFromStore("mount");

    // Shell
    const shell = document.createElement("div");
    shell.className = "wa-shell";
    shell.style.display = "flex";
    shell.style.flex = "1 1 auto";
    shell.style.minHeight = "0";
    shell.style.overflow = "hidden";
    this.rootEl.appendChild(shell);

    // -------------------------------------------------------------------
    // Step 5G: Best-Effort „Hydration Check“ nach Mount
    // -------------------------------------------------------------------
    // Kein Polling, nur 2 kurze Checks:
    // - sofort (nach DOM)
    // - kurz später (Safari/Pages kann Persist minimal verzögern)
    try {
      setTimeout(() => this._maybeHydrate("mount:0ms"), 0);
      setTimeout(() => this._maybeHydrate("mount:250ms"), 250);
    } catch {}

    // Docks + Center
    const leftDock = document.createElement("div");
    const center = document.createElement("div");
    const rightDock = document.createElement("div");

    leftDock.className = "wa-left-dock";
    center.className = "wa-center";
    rightDock.className = "wa-right-dock";

    leftDock.style.width = "320px";
    leftDock.style.minWidth = "240px";
    leftDock.style.maxWidth = "520px";
    leftDock.style.borderRight = "1px solid rgba(255,255,255,.06)";
    leftDock.style.display = "flex";
    leftDock.style.flexDirection = "column";
    leftDock.style.minHeight = "0";
    leftDock.style.overflow = "hidden";

    center.style.flex = "1 1 auto";
    center.style.minWidth = "0";
    center.style.display = "flex";
    center.style.flexDirection = "column";
    center.style.minHeight = "0";
    center.style.overflow = "hidden";

    rightDock.style.width = "360px";
    rightDock.style.minWidth = "260px";
    rightDock.style.maxWidth = "560px";
    rightDock.style.borderLeft = "1px solid rgba(255,255,255,.06)";
    rightDock.style.display = "flex";
    rightDock.style.flexDirection = "column";
    rightDock.style.minHeight = "0";
    rightDock.style.overflow = "hidden";

    shell.appendChild(leftDock);
    shell.appendChild(center);
    shell.appendChild(rightDock);

    // Topbar
    const topbar = document.createElement("div");
    // -------------------------------------------------------------------
    // Mobile-Clean-Patch v1:
    // Die alte Topbar hatte eine feste Höhe von 44px und alle Controls
    // wurden in eine einzige horizontale Zeile gedrückt. Auf iPhone/Safari
    // lief dadurch rechts alles aus dem sichtbaren Bereich.
    // Jetzt bekommt die Topbar eine Klasse und darf auf Mobile umbrechen.
    // -------------------------------------------------------------------
    topbar.className = "wa-topbar";
    topbar.style.flex = "0 0 auto";
    topbar.style.display = "flex";
    topbar.style.alignItems = "center";
    topbar.style.gap = "10px";
    topbar.style.padding = "6px 10px";
    topbar.style.borderBottom = "1px solid rgba(255,255,255,.06)";
    topbar.style.minHeight = "44px";
    topbar.style.height = "auto";
    topbar.style.overflow = "visible";
    center.appendChild(topbar);

    // Viewport host
    const viewport = document.createElement("div");
    viewport.className = "wa-viewport-host";
    viewport.style.flex = "1 1 auto";
    viewport.style.minHeight = "0";
    viewport.style.display = "flex";
    viewport.style.position = "relative";
    viewport.style.background = "rgba(255,255,255,.02)";

    // ------------------------------------------------------------
    // Step 5G: Spinner-Overlay (solange Store nicht „ready“ ist)
    // ------------------------------------------------------------
    const overlay = document.createElement("div");
    overlay.style.position = "absolute";
    overlay.style.inset = "0";
    overlay.style.display = "flex";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    overlay.style.background = "rgba(0,0,0,.18)";
    overlay.style.backdropFilter = "blur(2px)";
    overlay.style.zIndex = "50";
    // Overlay soll Interaktionen blockieren, bis wir die Scene sicher haben.
    overlay.style.pointerEvents = "auto";

    const box = document.createElement("div");
    box.style.display = "flex";
    box.style.alignItems = "center";
    box.style.gap = "10px";
    box.style.padding = "10px 12px";
    box.style.borderRadius = "10px";
    box.style.background = "rgba(20,20,20,.55)";
    box.style.border = "1px solid rgba(255,255,255,.12)";

    const spin = document.createElement("div");
    spin.style.width = "16px";
    spin.style.height = "16px";
    spin.style.borderRadius = "50%";
    spin.style.border = "2px solid rgba(255,255,255,.25)";
    spin.style.borderTopColor = "rgba(255,255,255,.85)";
    spin.style.animation = "waSpin 900ms linear infinite";

    const txt = document.createElement("div");
    txt.textContent = "Projekt wird geladen …";
    txt.style.fontSize = "12px";
    txt.style.opacity = ".9";

    const style = document.createElement("style");
    style.textContent = "@keyframes waSpin{from{transform:rotate(0)}to{transform:rotate(360deg)}}";

    box.appendChild(spin);
    box.appendChild(txt);
    overlay.appendChild(box);
    viewport.appendChild(style);
    viewport.appendChild(overlay);

    this._hydration.overlayEl = overlay;
    this._setHydrated(this._hydration.ready, "mount:init");
    viewport.style.overflow = "hidden";
    center.appendChild(viewport);

    // Bottom
    const bottom = document.createElement("div");
    bottom.className = "wa-bottom-bar";
    bottom.style.height = "28px";
    bottom.style.flex = "0 0 auto";
    bottom.style.display = "flex";
    bottom.style.alignItems = "center";
    bottom.style.gap = "10px";
    bottom.style.padding = "0 10px";
    bottom.style.borderTop = "1px solid rgba(255,255,255,.06)";
    center.appendChild(bottom);

    // Console drawer
    const consoleDrawer = document.createElement("div");
    consoleDrawer.className = "wa-console-drawer";
    consoleDrawer.style.flex = "0 0 auto";
    consoleDrawer.style.display = "none";
    consoleDrawer.style.borderTop = "1px solid rgba(255,255,255,.06)";
    consoleDrawer.style.background = "rgba(0,0,0,.25)";
    consoleDrawer.style.padding = "8px 10px";
    consoleDrawer.style.fontFamily =
      "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace";
    consoleDrawer.style.fontSize = "12px";
    consoleDrawer.textContent = "Console Drawer (Dummy) – später: Debug Log / Events";
    center.appendChild(consoleDrawer);

    // Left/Right Dock: Tabs + Host
    const leftTabsBar = this._makeTabsBar();
    const leftPanelHost = this._makePanelHost();
    leftDock.appendChild(leftTabsBar);
    leftDock.appendChild(leftPanelHost);

    const rightTabsBar = this._makeTabsBar();
    const rightPanelHost = this._makePanelHost();
    rightDock.appendChild(rightTabsBar);
    rightDock.appendChild(rightPanelHost);

    // Save refs
    this._els.header = header;
    this._els.shell = shell;
    this._els.topbar = topbar;
    this._els.leftDock = leftDock;
    this._els.center = center;
    this._els.rightDock = rightDock;
    this._els.bottom = bottom;
    this._els.consoleDrawer = consoleDrawer;

    this._els.leftTabsBar = leftTabsBar;
    this._els.rightTabsBar = rightTabsBar;
    this._els.leftPanelHost = leftPanelHost;
    this._els.rightPanelHost = rightPanelHost;

    // Viewport canvas
    this._mountViewportCanvas(viewport);

    // v1.3.4: Layout-Diagnose initialisieren.
    // Passiv: Der erkannte Modus wird nur angezeigt/exportiert, noch nicht
    // für einen harten Umbau der Mobile-Shell verwendet.
    this._wireLayoutDiagnostics();
    this._refreshWorkareaLayoutDiagnostics("mount:init", { renderTopbar: false });

    // JSON laden (defensiv)
    try {
      this.layout = await this._loadJson("./data/workarea.layout.json");
      this.tools = await this._loadJson("./data/tools.registry.json");
      this.props = await this._loadJson("./data/properties.schemas.json");
      // Asset Catalog (deterministische Zuordnung: Slot.catalogId -> AssetDef)
      // Fallback bleibt möglich (Pattern-Match), aber Ziel ist: keine Heuristik mehr.
      this.assetCatalog = await this._loadJson("./data/assets.catalog.v1.json");
      this._catalogIndex = this._buildCatalogIndex(this.assetCatalog);

    } catch (e) {
      console.error("[workarea] JSON load FAILED:", e);
      this._setStatus(`⚠️ Workarea JSON konnte nicht geladen werden: ${String(e?.message || e)}`);
    }

    // UI
    this._renderTopbar();
    this._renderLeftTabs();
    this._renderRightTabs();
    this._renderLeftPanel();
    this._renderRightPanel();
    this._renderBottomBar();

    // Settings initial anwenden
    // - applyDocks:"auto" übernimmt Dock-Defaults nur dann, wenn WorkspaceSettings
    //   seit dem letzten Workarea-Open eine Änderung gemacht hat (siehe Step 5I).
    this._applyWorkspaceSettingsFromStore("init", { applyDocks: "auto" });
    this._applyDockVisibility();

    // Bus wiring
    this._wireBus();

    // Best-Effort activate request
    this._requestActivateWorkareaIfProjectPresent();

    // Events
    this.bus?.emit?.("cb:workarea:layout:ready", {
      panelId: this.panelId,
      layoutId: this.layout?.id || null,
      toolsId: this.tools?.id || null,
      propsId: this.props?.id || null
    });

    this._publishModeChanged("init");
    this._publishSelectionChanged("init");

    this._crashLog("workarea:ready", {
      mode: this.state?.modeId,
      objects: this._scene?.objects?.length || 0,
      layout: this._detectWorkareaLayoutMode?.()?.mode || null
    });
    this._setStatus("🟢 Workarea Shell bereit (Viewport Step 4 + Step 5A Assets)");
  }

  unmount() {
    this._crashLog("workarea:unmount", { objects: this._scene?.objects?.length || 0, mode: this.state?.modeId });
    this._unmountViewportCanvas();

    // Step 5J: Timer cleanup (Auto-Save Debounce)
    try {
      if (this._waAutosave?.timer) clearTimeout(this._waAutosave.timer);
      if (this._waAutosave) this._waAutosave.timer = 0;
    } catch {}

    // v1.3.4: Layout-Diagnose Listener/Timer aufräumen.
    try {
      if (this._layoutDiag?.timer) clearTimeout(this._layoutDiag.timer);
      if (this._layoutDiag) this._layoutDiag.timer = 0;
      if (this._onWindowResizeForLayoutDiag) {
        window.removeEventListener("resize", this._onWindowResizeForLayoutDiag);
        window.removeEventListener("orientationchange", this._onWindowResizeForLayoutDiag);
      }
      this._onWindowResizeForLayoutDiag = null;
    } catch {}

    // PATCH_workarea_mobile_resize_guard_v3:
    // Offene Resize-Timer sauber beenden, damit beim Panelwechsel kein alter
    // Resize-Flush in ein bereits unmounted Canvas läuft.
    try {
      if (this._mobileResizeGuard?.timer) clearTimeout(this._mobileResizeGuard.timer);
      if (this._mobileResizeGuard?.finalTimer) clearTimeout(this._mobileResizeGuard.finalTimer);
      if (this._mobileResizeGuard) {
        this._mobileResizeGuard.timer = 0;
        this._mobileResizeGuard.finalTimer = 0;
      }
    } catch {}

    this._mounted = false;
    try {
      for (const u of this._unsubs) {
        try {
          u?.();
        } catch {}
      }
    } catch {}
    this._unsubs = [];
    if (this.rootEl) this.rootEl.innerHTML = "";
  }

  /* ==========================================================================
   * v1.1.4: App-Wiring Helfer (Best Effort)
   * ========================================================================= */

  _requestActivateWorkareaIfProjectPresent() {
    if (this._didRequestActivate) return;
    this._didRequestActivate = true;

    const app = this.store?.get?.("app") || {};
    const activeProjectId = app?.activeProjectId || app?.activeProject?.id || null;
    if (!activeProjectId) return;

    try {
      this.bus?.emit?.("req:ui:module:activate", { moduleId: "tools:workarea", reason: "project-present" });
    } catch {}
    try {
      this.bus?.emit?.("req:ui:activeModule:set", { moduleId: "tools:workarea", reason: "project-present" });
    } catch {}
    try {
      this.bus?.emit?.("req:panel:activate", { panelId: "tools:workarea", reason: "project-present" });
    } catch {}

    this._setStatus(`ℹ️ Projekt aktiv (${activeProjectId}) – Workarea Activate-Request gesendet`);
  }

  /* ==========================================================================
   * Rendering
   * ========================================================================= */

  _renderTopbar() {
    const topbar = this._els.topbar;
    if (!topbar) return;

    topbar.innerHTML = "";
    topbar.className = "wa-topbar";

    // -------------------------------------------------------------------
    // Workarea Mobile-Clean-Patch v1
    // -------------------------------------------------------------------
    // Ziel:
    // - Desktop/Tablet behalten alle wichtigen Controls sichtbar.
    // - Mobile bekommt eine kompakte, zweizeilige Werkzeugleiste.
    // - Debug/Dock/Diagnose-Controls werden auf Mobile nicht mehr in die
    //   Hauptzeile gedrückt, sondern bleiben als eigene Gruppen vorhanden
    //   und werden über CSS platzsparend ausgeblendet.
    // -------------------------------------------------------------------

    const layoutMode = this._detectWorkareaLayoutMode();
    const isMobile = layoutMode.mode === "mobile";

    // -------------------------------------------------------------------
    // 1) Status-Gruppe: Projekt + Layout
    // -------------------------------------------------------------------
    const statusGroup = document.createElement("div");
    statusGroup.className = "wa-topbar-group wa-status-group";

    const projectPill = this._pill("Project: aktiv", "rgba(255,255,255,.06)");
    projectPill.className = `${projectPill.className || ""} wa-pill wa-project-pill`.trim();

    const layoutBadge = this._pill(
      `Layout: ${layoutMode.mode}`,
      layoutMode.mode === "mobile"
        ? "rgba(255,160,70,.18)"
        : layoutMode.mode === "tablet"
          ? "rgba(80,170,255,.16)"
          : "rgba(255,255,255,.06)"
    );
    layoutBadge.className = `${layoutBadge.className || ""} wa-pill wa-layout-pill`.trim();
    layoutBadge.title = layoutMode.reason || "Layout-Diagnose";
    this._els.layoutDiagBadge = layoutBadge;

    statusGroup.appendChild(projectPill);
    statusGroup.appendChild(layoutBadge);

    // -------------------------------------------------------------------
    // 2) Mode-Gruppe
    // -------------------------------------------------------------------
    const modeGroup = document.createElement("div");
    modeGroup.className = "wa-topbar-group wa-mode-group";

    const modeLabel = document.createElement("div");
    modeLabel.className = "wa-toolbar-label";
    modeLabel.textContent = "Mode";

    const sel = document.createElement("select");
    sel.className = "wa-mode-select";
    sel.style.height = "32px";
    sel.style.borderRadius = "10px";
    sel.style.padding = "0 10px";
    sel.style.border = "1px solid rgba(0,0,0,.14)";
    sel.style.background = "rgba(148,163,184,.24)";
    sel.style.color = "inherit";
    sel.style.fontWeight = "600";

    const modes = Array.isArray(this.tools?.modes)
      ? this.tools.modes.map((m) => ({ ...m }))
      : [
          { id: "select", title: "Select" },
          { id: "pan", title: "Pan" },
          { id: "place", title: "Place" },
          { id: "edit", title: "Edit" }
        ];

    if (!modes.find((m) => String(m?.id) === "pan")) {
      const idx = Math.max(0, modes.findIndex((m) => String(m?.id) === "select"));
      modes.splice(idx + 1, 0, { id: "pan", title: "Pan" });
    }

    for (const m of modes) {
      const o = document.createElement("option");
      o.value = m.id;
      o.textContent = m.title || m.id;
      if (m.id === this.state.modeId) o.selected = true;
      sel.appendChild(o);
    }

    sel.addEventListener("change", () => {
      const modeId = String(sel.value || "select");
      this._setMode(modeId, "ui");
    });

    this._els.modeSelect = sel;

    modeGroup.appendChild(modeLabel);
    modeGroup.appendChild(sel);

    // -------------------------------------------------------------------
    // 3) Zoom-Gruppe
    // -------------------------------------------------------------------
    const zoomGroup = document.createElement("div");
    zoomGroup.className = "wa-topbar-group wa-zoom-group";

    const zoomLabel = document.createElement("div");
    zoomLabel.className = "wa-toolbar-label";
    zoomLabel.textContent = "Zoom";

    const zoomMinus = this._btn("−", () => {
      this._setViewportZoom((this._vp.zoom || 1) / 1.15, "ui-minus");
    });
    zoomMinus.className = `${zoomMinus.className || ""} wa-small-btn wa-zoom-minus`.trim();
    zoomMinus.style.height = "32px";

    const zoomPlus = this._btn("+", () => {
      this._setViewportZoom((this._vp.zoom || 1) * 1.15, "ui-plus");
    });
    zoomPlus.className = `${zoomPlus.className || ""} wa-small-btn wa-zoom-plus`.trim();
    zoomPlus.style.height = "32px";

    const zoomSlider = document.createElement("input");
    zoomSlider.type = "range";
    zoomSlider.min = String(this._cfg?.cameraMinZoom ?? 0.25);
    zoomSlider.max = String(this._cfg?.cameraMaxZoom ?? 4);
    zoomSlider.step = "0.01";
    zoomSlider.value = String(this._vp.zoom || 1);
    zoomSlider.setAttribute("data-wk-zoom-slider", "1");
    zoomSlider.className = "wa-zoom-slider";

    const zoomVal = document.createElement("div");
    zoomVal.className = "wa-zoom-value";
    zoomVal.textContent = (this._vp.zoom || 1).toFixed(2);

    zoomSlider.addEventListener("input", () => {
      const z = Number(zoomSlider.value || 1);
      this._setViewportZoom(z, "ui-slider");
      zoomVal.textContent = (this._vp.zoom || 1).toFixed(2);
    });

    zoomGroup.appendChild(zoomLabel);
    zoomGroup.appendChild(zoomMinus);
    zoomGroup.appendChild(zoomSlider);
    zoomGroup.appendChild(zoomPlus);
    zoomGroup.appendChild(zoomVal);

    // -------------------------------------------------------------------
    // 4) Info-Gruppe: Grid + Snap
    // -------------------------------------------------------------------
    const infoGroup = document.createElement("div");
    infoGroup.className = "wa-topbar-group wa-info-group";

    const gridPill = this._pill(
      `Grid: ${this._cfg?.gridEnabled ? "on" : "off"} (${this._cfg?.gridSize || 50})`,
      "rgba(255,255,255,.06)"
    );
    gridPill.className = `${gridPill.className || ""} wa-pill wa-grid-pill`.trim();

    const snapPill = this._pill(
      `Snap: ${this._cfg?.snapEnabled ? "on" : "off"}`,
      "rgba(255,255,255,.06)"
    );
    snapPill.className = `${snapPill.className || ""} wa-pill wa-snap-pill`.trim();

    infoGroup.appendChild(gridPill);
    infoGroup.appendChild(snapPill);

    // -------------------------------------------------------------------
    // 5) Dock-Gruppe
    // -------------------------------------------------------------------
    const dockGroup = document.createElement("div");
    dockGroup.className = "wa-topbar-group wa-dock-group";

    const leftBtn = this._btn(this.state.leftDockCollapsed ? "Left ▶" : "Left ◀", () => this._toggleLeftDock());
    const rightBtn = this._btn(this.state.rightDockCollapsed ? "Right ◀" : "Right ▶", () => this._toggleRightDock());
    const bottomBtn = this._btn(this.state.bottomCollapsed ? "Bottom ▲" : "Bottom ▼", () => this._toggleBottom());
    const fsBtn = this._btn(this.state.fullscreen ? "Exit FS" : "FS", () => this._toggleFullscreen());

    leftBtn.className = `${leftBtn.className || ""} wa-dock-btn`.trim();
    rightBtn.className = `${rightBtn.className || ""} wa-dock-btn`.trim();
    bottomBtn.className = `${bottomBtn.className || ""} wa-dock-btn`.trim();
    fsBtn.className = `${fsBtn.className || ""} wa-dock-btn`.trim();

    dockGroup.appendChild(leftBtn);
    dockGroup.appendChild(rightBtn);
    dockGroup.appendChild(bottomBtn);
    dockGroup.appendChild(fsBtn);

    // -------------------------------------------------------------------
    // 6) Debug-Gruppe
    // -------------------------------------------------------------------
    const debugGroup = document.createElement("div");
    debugGroup.className = "wa-topbar-group wa-debug-group";

    const focusBtn = this._btn("Focus", () => this._setStatus("Focus (Dummy)"));
    const dummyBtn = this._btn("Dummy Select", () => this._cycleDummySelection());
    const layoutBtn = this._btn("Layout JSON", () => this._copyWorkareaLayoutDebug());
    const diagBtn = this._btn("Diag ↻", () =>
      this._refreshWorkareaLayoutDiagnostics("ui", { status: true, renderTopbar: true })
    );
    const crashBtn = this._btn("CrashLog", () => this._copyWorkareaCrashLog());

    focusBtn.className = `${focusBtn.className || ""} wa-debug-btn`.trim();
    dummyBtn.className = `${dummyBtn.className || ""} wa-debug-btn`.trim();
    layoutBtn.className = `${layoutBtn.className || ""} wa-debug-btn`.trim();
    diagBtn.className = `${diagBtn.className || ""} wa-debug-btn`.trim();
    crashBtn.className = `${crashBtn.className || ""} wa-debug-btn`.trim();
    crashBtn.title = "Crash-/Reload-Log kopieren und im Snapshot anzeigen";

    debugGroup.appendChild(focusBtn);
    debugGroup.appendChild(dummyBtn);
    debugGroup.appendChild(layoutBtn);
    debugGroup.appendChild(diagBtn);
    debugGroup.appendChild(crashBtn);

    topbar.appendChild(statusGroup);
    topbar.appendChild(modeGroup);
    topbar.appendChild(zoomGroup);
    topbar.appendChild(infoGroup);
    topbar.appendChild(dockGroup);
    topbar.appendChild(debugGroup);

    topbar.setAttribute("data-wa-layout", isMobile ? "mobile" : (layoutMode.mode || "desktop"));
  }


  /* ========================================================================
   * PATCH_workarea_ui_mode_dock_refactor_v1 – leichte Mode-/Dock-Helfer
   * ====================================================================== */

  _getModeUiConfigV1(modeId = null) {
    const id = String(modeId || this.state?.modeId || "select");
    return WORKAREA_MODE_UI_V1[id] || WORKAREA_MODE_UI_V1.select;
  }

  _applyModeDockPresetV1(modeId, reason = "mode") {
    const cfg = this._getModeUiConfigV1(modeId);

    // Tabs werden mode-basiert gesetzt. Dadurch landet Place links immer bei
    // Einfügen, Select/Edit bei Struktur und Pan räumt die Fläche frei.
    if (cfg.leftTab) this.state.leftTabId = cfg.leftTab;
    if (cfg.rightTab) this.state.rightTabId = cfg.rightTab;

    // Dock-Regel bewusst einfach: collapsed/open. „Compact“ entsteht über den
    // leichten Property-Inhalt, nicht über ein zusätzliches Layout-System.
    if (typeof cfg.leftDockCollapsed === "boolean") this.state.leftDockCollapsed = cfg.leftDockCollapsed;
    if (typeof cfg.rightDockCollapsed === "boolean") this.state.rightDockCollapsed = cfg.rightDockCollapsed;
  }

  _makePanelCardV1(title, text = "") {
    const card = document.createElement("div");
    card.className = "wa-light-card";
    card.style.border = "1px solid rgba(255,255,255,.10)";
    card.style.borderRadius = "12px";
    card.style.padding = "10px";
    card.style.background = "rgba(255,255,255,.045)";

    const h = document.createElement("div");
    h.style.fontWeight = "800";
    h.style.marginBottom = text ? "4px" : "0";
    h.textContent = title;
    card.appendChild(h);

    if (text) {
      const p = document.createElement("div");
      p.style.fontSize = "12px";
      p.style.opacity = ".78";
      p.style.lineHeight = "1.35";
      p.textContent = text;
      card.appendChild(p);
    }
    return card;
  }

  _openWorkareaModalV1(title, renderContent, { wide = false } = {}) {
    try {
      this._closeWorkareaModalV1();

      const overlay = document.createElement("div");
      overlay.className = "wa-dialog-backdrop wa-refactor-dialog-backdrop";
      overlay.setAttribute("data-wa-refactor-modal", "1");

      const dialog = document.createElement("div");
      dialog.className = "wa-dialog wa-refactor-dialog";
      if (wide) dialog.classList.add("wa-refactor-dialog-wide");

      const head = document.createElement("div");
      head.className = "wa-refactor-dialog-head";

      const h = document.createElement("div");
      h.className = "wa-refactor-dialog-title";
      h.textContent = title || "Details";

      const close = this._btn("×", () => this._closeWorkareaModalV1());
      close.className = `${close.className || ""} wa-refactor-dialog-close`.trim();
      close.title = "Fenster schließen";

      head.appendChild(h);
      head.appendChild(close);
      dialog.appendChild(head);

      const body = document.createElement("div");
      body.className = "wa-refactor-dialog-body";
      if (typeof renderContent === "function") {
        const node = renderContent();
        if (node) body.appendChild(node);
      }
      dialog.appendChild(body);
      overlay.appendChild(dialog);

      overlay.addEventListener("click", (ev) => {
        if (ev.target === overlay) this._closeWorkareaModalV1();
      });

      const mount = this.rootEl || document.body;
      mount.appendChild(overlay);
      this._activeWorkareaModalV1 = overlay;
      this._crashLog("workarea:modal:open", { title: String(title || "Details"), wide: !!wide });
    } catch (e) {
      console.error("[workarea] modal open failed", e);
      this._setStatus("⚠️ Dialog konnte nicht geöffnet werden");
    }
  }

  _closeWorkareaModalV1() {
    try {
      const el = this._activeWorkareaModalV1 || (this.rootEl || document).querySelector?.('[data-wa-refactor-modal="1"]');
      if (el && el.parentNode) el.parentNode.removeChild(el);
    } catch {}
    this._activeWorkareaModalV1 = null;
  }

  _getSceneObjectsLightV1() {
    try {
      return this._getSceneObjects();
    } catch {
      try {
        const app = this.store?.get?.("app") || {};
        const arr = app?.project?.workspace?.scene?.objects;
        return Array.isArray(arr) ? arr : [];
      } catch {
        return [];
      }
    }
  }

  _getSelectionSummaryV1() {
    const sel = this.state?.selection || null;
    const sceneObj = this._getSceneTarget?.(sel) || null;
    const obj = sceneObj || sel?.data?.object || sel?.data?.projectAsset || sel?.data || null;
    const type = sceneObj?.type || sel?.type || obj?.type || "project";
    const id = sceneObj?.id || sel?.id || obj?.id || "-";
    const name = sceneObj?.name || obj?.name || obj?.label || obj?.bmks || obj?.bmk || type;
    const loc = sceneObj?.location || sceneObj?.ort || sceneObj?.eplan?.location || sceneObj?.assembly?.location || "-";
    const fg = sceneObj?.foerdergruppe || sceneObj?.fördergruppe || sceneObj?.eplan?.function || sceneObj?.assembly?.group || "-";
    return { sel, sceneObj, type, id, name, loc, fg };
  }

  _renderLeftTabs() {
    const tabs = WORKAREA_LEFT_TABS_V1.map((t) => ({ ...t }));

    // Fallback fuer alte gespeicherte States: alte Tabs auf neue Struktur mappen.
    const aliases = {
      "tab.library": "tab.insert",
      "tab.scene": "tab.structure",
      "tab.outliner": "tab.structure"
    };
    if (aliases[this.state.leftTabId]) this.state.leftTabId = aliases[this.state.leftTabId];
    if (!tabs.some((t) => t.id === this.state.leftTabId)) this.state.leftTabId = "tab.structure";

    this._renderTabsBar(this._els.leftTabsBar, tabs, this.state.leftTabId, (tabId) => {
      this.state.leftTabId = tabId;
      this._persistWorkareaUiToStore("leftTab");
      this._renderLeftPanel();
    });
  }

  _renderRightTabs() {
    // ----------------------------------------------------------
    // Right Tabs (Properties / BOM / Outliner)
    // ----------------------------------------------------------
    // WICHTIG: Viele Nutzer haben bereits ein altes Dock-Layout im Store
    // (z.B. nur Properties/Outliner). Dann liefert _layoutTabs("rightDock")
    // eine Liste OHNE "tab.bom" – und der BOM-Tab wäre unsichtbar.
    // => Wir upgraden hier das Layout "soft": fehlende Tabs werden ergänzt,
    //    ohne bestehende Reihenfolge kaputt zu machen.
    const tabsRaw = this._layoutTabs("rightDock") || [
      { id: "tab.properties", title: "Properties" },
      { id: "tab.params", title: "Params" },
      { id: "tab.bom", title: "BOM" },
      { id: "tab.outliner", title: "Outliner" }
    ];

    // Clone + Upgrade (nicht mutieren, falls _layoutTabs() Store-Objekte teilt)
    const tabs = Array.isArray(tabsRaw) ? tabsRaw.map(t => ({ ...t })) : [];

    const hasTab = (id) => tabs.some(t => t && t.id === id);
    if (!hasTab("tab.properties")) tabs.unshift({ id: "tab.properties", title: "Properties" });
    if (!hasTab("tab.params")) tabs.splice(1, 0, { id: "tab.params", title: "Params" });
    if (!hasTab("tab.bom")) tabs.splice(2, 0, { id: "tab.bom", title: "BOM" });
    if (!hasTab("tab.outliner")) tabs.push({ id: "tab.outliner", title: "Outliner" });

    // Fallback, falls rightTabId auf einen nicht mehr existierenden Tab zeigt.
    if (!hasTab(this.state.rightTabId)) {
      this.state.rightTabId = "tab.properties";
      this._persistWorkareaUiToStore("rightTab:fallback");
    }

    this._renderTabsBar(this._els.rightTabsBar, tabs, this.state.rightTabId, (tabId) => {
      this.state.rightTabId = tabId;
      this._persistWorkareaUiToStore("rightTab");
      this._renderRightPanel();
    });
  }

  _renderLeftPanel() {
    const host = this._els.leftPanelHost;
    if (!host) return;
    host.innerHTML = "";

    const tabId = this.state.leftTabId;

    const box = document.createElement("div");
    box.style.padding = "10px";
    box.style.opacity = ".9";
    box.style.fontSize = "13px";
    box.style.paddingBottom = "calc(96px + env(safe-area-inset-bottom, 0px))";
    box.className = "wa-assemblylab-panel";

    if (tabId === "tab.structure") {
      host.appendChild(this._renderProjectStructurePanelV1());
      return;
    } else if (tabId === "tab.insert") {
      host.appendChild(this._renderInsertPanelLightV1());
      return;
    } else if (tabId === "tab.tools") {
      host.appendChild(this._renderWorkareaToolsPanelLightV1());
      return;
    } else if (tabId === "tab.library") {
      box.innerHTML =
        `<div style="font-weight:700;margin-bottom:6px;">Library (Dummy)</div>` +
        `<div style="opacity:.75;font-size:12px;margin-bottom:8px;">Später: Suche, Kategorien, Drag & Drop</div>`;

      box.appendChild(this._btn("→ In Place-Mode wechseln", () => this._setMode("place", "library")));
      box.appendChild(document.createElement("div")).style.height = "8px";
      box.appendChild(
        this._btn("Dummy Auswahl: Förderer", () => {
          this.state.selection = this._makeDummySelection("conveyor.segment");
          this._publishSelectionChanged("library");
          this._renderRightPanel();
        })
      );

      const hint = document.createElement("div");
      hint.style.marginTop = "10px";
      hint.style.opacity = ".75";
      hint.style.fontSize = "12px";
      hint.textContent = "Select-Mode: Tap=Select, Drag auf Objekt=Move, Drag leer=Pan. Pan-Mode: Drag=Pan.";
      box.appendChild(hint);
    } else if (tabId === "tab.scene") {
      box.innerHTML =
        `<div style="font-weight:700;margin-bottom:6px;">Scene (Dummy)</div>` +
        `<div style="opacity:.75;font-size:12px;">Später: Layer / Sichtbarkeit / Lock / Outliner</div>`;
    } else if (tabId === "tab.assemblylab") {
      host.appendChild(this._renderAssemblyLabPanel());
      return;
    } else if (tabId === "tab.assets") {
      // -------------------------------------------------------------------
      // Step 5A (0 Risiko):
      // - Assets Tab liest echte ProjectAssets aus dem Store (Single Source of Truth)
      // - Click auf Asset -> setzt Selection (rechts im Properties Tab sichtbar)
      //
      // Quelle:
      // - app.project.projectAssets (wie ProjectAssetsPanel es auch nutzt)
      // -------------------------------------------------------------------
      box.innerHTML =
        `<div style="font-weight:700;margin-bottom:6px;">Assets</div>` +
        `<div style="opacity:.75;font-size:12px;margin-bottom:10px;">Echte ProjectAssets aus dem Store (Step 5A). Klick = Selection.</div>`;

      const actions = document.createElement("div");
      actions.style.display = "flex";
      actions.style.gap = "6px";
      actions.style.flexWrap = "wrap";
      actions.style.marginBottom = "10px";

      actions.appendChild(
        this._btn("↻ Refresh", () => {
          this._renderLeftPanel();
          this._setStatus("Assets aktualisiert");
        })
      );

      actions.appendChild(
        this._btn("→ In Place-Mode wechseln", () => {
          this._setMode("place", "assets");
        })
      );

      box.appendChild(actions);

      const listWrap = document.createElement("div");
      listWrap.style.display = "flex";
      listWrap.style.flexDirection = "column";
      listWrap.style.gap = "8px";

      const assets = this._getProjectAssetsFromStore();

      if (!assets.length) {
        const empty = document.createElement("div");
        empty.style.opacity = ".75";
        empty.style.fontSize = "12px";
        empty.textContent = "Keine ProjectAssets im aktuellen Projekt gefunden.";
        listWrap.appendChild(empty);
      } else {
        for (const pa of assets) {
          const row = document.createElement("button");
          row.type = "button";
          row.style.display = "flex";
          row.style.alignItems = "center";
          row.style.justifyContent = "space-between";
          row.style.gap = "10px";
          row.style.padding = "8px 10px";
          row.style.borderRadius = "12px";
          row.style.border = "1px solid rgba(255,255,255,.12)";
          row.style.background = "rgba(0,0,0,.20)";
          row.style.color = "inherit";
          row.style.cursor = "pointer";
          row.style.textAlign = "left";

          const isSelected = this.state.selection?.id === pa.id && this.state.selection?.type === "projectAsset";
          if (isSelected) row.style.background = "rgba(255,255,255,.12)";

          // --------------------------------------------------------------
          // Thumbnail (NEU):
          // - Cybermotion-Style: kleine Vorschau direkt in der Liste
          // - WICHTIG: In der linken Asset-Liste wollen wir die Perspektive (wie Projekt-Assets).
          //            Top-View ist NUR fürs 2D-Layout im Viewport.
          // - Fallback: Platzhalter-Box
          // --------------------------------------------------------------
          const thumbWrap = document.createElement("div");
          thumbWrap.style.width = "42px";
          thumbWrap.style.height = "42px";
          thumbWrap.style.borderRadius = "10px";
          thumbWrap.style.overflow = "hidden";
          thumbWrap.style.border = "1px solid rgba(255,255,255,.10)";
          thumbWrap.style.background = "rgba(0,0,0,.25)";
          thumbWrap.style.flex = "0 0 auto";

          // Wir nehmen bevorzugt den Default-Slot (mit Model) und holen dessen Thumbnail.
          const defSlot = this._getDefaultSlotForProjectAsset(pa);
          const du = defSlot?.id ? this._getSlotThumbnailDataUrl(pa?.id, defSlot.id, "perspective") : null;
          if (du) {
            const img = document.createElement("img");
            img.alt = "thumb";
            img.src = du;
            img.style.width = "100%";
            img.style.height = "100%";
            img.style.objectFit = "cover";
            img.decoding = "async";
            img.loading = "lazy";
            thumbWrap.appendChild(img);
          } else {
            const ph = document.createElement("div");
            ph.style.width = "100%";
            ph.style.height = "100%";
            ph.style.display = "flex";
            ph.style.alignItems = "center";
            ph.style.justifyContent = "center";
            ph.style.fontSize = "12px";
            ph.style.opacity = ".7";
            ph.textContent = "—";
            thumbWrap.appendChild(ph);
          }

          const left = document.createElement("div");
          left.style.display = "flex";
          left.style.flexDirection = "column";
          left.style.gap = "2px";
          left.style.minWidth = "0";
          left.style.flex = "1 1 auto";

          const name = document.createElement("div");
          name.style.fontWeight = "700";
          name.style.fontSize = "13px";
          name.style.whiteSpace = "nowrap";
          name.style.overflow = "hidden";
          name.style.textOverflow = "ellipsis";
          name.textContent = pa.name || pa.id || "Asset";

          const meta = document.createElement("div");
          meta.style.opacity = ".75";
          meta.style.fontSize = "12px";
          meta.style.whiteSpace = "nowrap";
          meta.style.overflow = "hidden";
          meta.style.textOverflow = "ellipsis";

          const slotCount = Array.isArray(pa.slots) ? pa.slots.length : 0;
          const hasAnyModel = this._projectAssetHasAnyModel(pa);
          const srcKind = String(pa?.source?.kind || "-");
          meta.textContent = `Slots: ${slotCount} • ${hasAnyModel ? "hat Model" : "leer"} • src:${srcKind}`;

          left.appendChild(name);
          left.appendChild(meta);

          const right = document.createElement("div");
          right.style.display = "flex";
          right.style.gap = "6px";
          right.style.alignItems = "center";
          right.style.flex = "0 0 auto";

          const badge = this._pill(hasAnyModel ? "✔" : "—", hasAnyModel ? "rgba(0,255,128,.10)" : "rgba(255,255,255,.06)");
          badge.style.borderColor = hasAnyModel ? "rgba(0,255,128,.25)" : "rgba(255,255,255,.10)";

          const open = this._btn("Select", () => {
            this._selectProjectAsset(pa, "assets-tab");
            this._renderRightPanel();
            this._renderLeftPanel();
          });
          open.style.height = "28px";

          right.appendChild(badge);
          right.appendChild(open);

          row.appendChild(thumbWrap);
          row.appendChild(left);
          row.appendChild(right);

          row.addEventListener("click", () => {
            this._selectProjectAsset(pa, "assets-tab");
            this._renderRightPanel();
            this._renderLeftPanel();
          });

          listWrap.appendChild(row);
        }
      }

      box.appendChild(listWrap);

      const hint = document.createElement("div");
      hint.style.marginTop = "10px";
      hint.style.opacity = ".75";
      hint.style.fontSize = "12px";
      hint.textContent =
        "Hinweis: Step 5A liest nur aus dem Store und setzt Selection. Nächster Schritt (5B): Place-Mode → Instanz in Szene.";
      box.appendChild(hint);
    } else {
      box.textContent = `Unbekannter Tab: ${tabId}`;
    }

    host.appendChild(box);
  }



  /* ==========================================================================
   * AssemblyLab v1 – Projekt-Assets als Bauteile in Master-Baugruppen
   * ==========================================================================
   * Ziel dieses MVP:
   * - Eine projektgebundene Master-Baugruppe "Rollenbahn Master" anlegen.
   * - Projekt-Assets per Drag/Drop oder Button als Bauteile in die aktive
   *   Variante übernehmen.
   * - Bauteile numerisch positionieren/drehen.
   * - Variante als assembly.instance in die Workarea einfügen.
   *
   * WICHTIG:
   * - Noch kein echter GLB-Export. Die Baugruppe bleibt editierbare JSON-Struktur.
   * - GLB/Vorschau-Export kommt später aus dieser Struktur heraus.
   */

  _assemblyLabMakeId(prefix = "cmp") {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  _assemblyLabClone(value, fallback = null) {
    try {
      return value == null ? fallback : JSON.parse(JSON.stringify(value));
    } catch {
      return fallback;
    }
  }

  _assemblyLabDefaultTemplate() {
    return {
      schema: "baustellenplaner.assemblylab.template.v1",
      id: "asm-master-rollenbahn",
      name: "Rollenbahn Master",
      category: "Foerdertechnik",
      description: "Selbst zusammengestellte Master-Baugruppe aus Projekt-Assets.",
      variants: [
        {
          id: "standard",
          name: "Standard",
          components: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  _getAssemblyLabFromStore() {
    try {
      const app = this.store?.get?.("app") || {};
      const fromApp = app?.project?.assemblyLab;
      if (fromApp && typeof fromApp === "object") return this._assemblyLabClone(fromApp, null);
    } catch {}

    try {
      const project = this.store?.get?.("project") || {};
      const fromProject = project?.assemblyLab;
      if (fromProject && typeof fromProject === "object") return this._assemblyLabClone(fromProject, null);
    } catch {}

    return null;
  }

  _ensureAssemblyLabState() {
    const current = this._getAssemblyLabFromStore();
    const lab = current && typeof current === "object"
      ? current
      : {
          schema: "baustellenplaner.assemblylab.v1",
          version: "1.0.0",
          templates: [],
          updatedAt: new Date().toISOString()
        };

    lab.schema = lab.schema || "baustellenplaner.assemblylab.v1";
    lab.version = lab.version || "1.0.0";
    lab.templates = Array.isArray(lab.templates) ? lab.templates : [];

    if (!lab.templates.some((t) => t && t.id === "asm-master-rollenbahn")) {
      lab.templates.push(this._assemblyLabDefaultTemplate());
    }

    if (!this._assemblyLabUi?.activeTemplateId || !lab.templates.some((t) => t.id === this._assemblyLabUi.activeTemplateId)) {
      this._assemblyLabUi.activeTemplateId = lab.templates[0]?.id || "asm-master-rollenbahn";
    }

    const tpl = lab.templates.find((t) => t.id === this._assemblyLabUi.activeTemplateId) || lab.templates[0];
    tpl.variants = Array.isArray(tpl.variants) ? tpl.variants : [];
    if (!tpl.variants.length) {
      tpl.variants.push({ id: "standard", name: "Standard", components: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    }

    if (!this._assemblyLabUi?.activeVariantId || !tpl.variants.some((v) => v.id === this._assemblyLabUi.activeVariantId)) {
      this._assemblyLabUi.activeVariantId = tpl.variants[0]?.id || "standard";
    }

    this._persistAssemblyLabToStore(lab, "assemblylab:ensure", { silent: true });
    return lab;
  }

  _persistAssemblyLabToStore(lab, reason = "assemblylab", options = {}) {
    const clean = this._assemblyLabClone(lab, lab);
    if (!clean || typeof clean !== "object") return;
    clean.updatedAt = new Date().toISOString();

    try {
      this.store?.update?.("app", (app) => {
        const next = app && typeof app === "object" ? app : {};
        next.project = next.project && typeof next.project === "object" ? next.project : {};
        next.project.assemblyLab = clean;
        return next;
      });
    } catch {}

    try {
      this.store?.update?.("project", (project) => {
        const next = project && typeof project === "object" ? project : {};
        next.assemblyLab = clean;
        return next;
      });
    } catch {}

    if (!options?.silent) {
      this._requestProjectSaveDebounced(reason);
      this._crashLog("workarea:assemblylab:persist", {
        reason,
        templates: Array.isArray(clean.templates) ? clean.templates.length : 0
      });
    }
  }

  _updateAssemblyLab(mutator, reason = "assemblylab:update") {
    const lab = this._ensureAssemblyLabState();
    try {
      mutator?.(lab);
    } catch (err) {
      this._setStatus(`⚠️ AssemblyLab Update fehlgeschlagen: ${String(err?.message || err)}`);
      return lab;
    }
    this._persistAssemblyLabToStore(lab, reason);
    return lab;
  }

  _getActiveAssemblyLabRefs() {
    const lab = this._ensureAssemblyLabState();
    const template = lab.templates.find((t) => t.id === this._assemblyLabUi.activeTemplateId) || lab.templates[0];
    const variant = template?.variants?.find((v) => v.id === this._assemblyLabUi.activeVariantId) || template?.variants?.[0] || null;
    return { lab, template, variant };
  }

  _getAssemblyLabDefaultSlot(pa) {
    if (!pa || typeof pa !== "object") return null;
    const slots = Array.isArray(pa.slots) ? pa.slots : [];
    return slots.find((s) => this._slotHasModel?.(s)) || slots[0] || null;
  }

  /**
   * PATCH_assemblylab_component_roles_v1
   * Zentrale Rollenliste für Bauteile innerhalb einer Baugruppen-Variante.
   *
   * Wichtig:
   * - Diese Rollen sind bewusst technisch gehalten, damit wir später daraus
   *   Stückliste, Ports, Kabelpunkte, EPLAN-/BMK-Logik und Filter ableiten können.
   * - Gespeichert wird nur der stabile Key (z. B. "motor"), angezeigt wird das Label.
   */
  _getAssemblyComponentRolesV1() {
    return [
      { value: "component", label: "Bauteil", short: "Teil" },
      { value: "frame", label: "Rahmen / Grundkörper", short: "Rahmen" },
      { value: "roller", label: "Rolle / Rollensatz", short: "Rolle" },
      { value: "drive", label: "Antrieb / Motor", short: "Motor" },
      { value: "belt", label: "Riemen / Kette", short: "Riemen" },
      { value: "sensor", label: "Sensor", short: "Sensor" },
      { value: "control", label: "Steuerung / MOVIFIT", short: "MOVIFIT" },
      { value: "maintenance", label: "Wartungsschalter", short: "Wartung" },
      { value: "junction", label: "Klemmkasten / Verteiler", short: "Klemmk." },
      { value: "support", label: "Stütze / Fuß", short: "Stütze" },
      { value: "guard", label: "Schutz / Gitter", short: "Schutz" },
      { value: "accessory", label: "Zubehör", short: "Zubehör" }
    ];
  }

  _getAssemblyRoleLabelV1(role, mode = "label") {
    const key = String(role || "component");
    const hit = this._getAssemblyComponentRolesV1().find((r) => r.value === key);
    if (!hit) return key || "Bauteil";
    return mode === "short" ? (hit.short || hit.label || hit.value) : (hit.label || hit.value);
  }

  _inferAssemblyComponentRoleV1(pa, slot = null) {
    const hay = `${pa?.name || ""} ${pa?.title || ""} ${pa?.id || ""} ${slot?.name || ""} ${slot?.lastImportName || ""} ${slot?.importName || ""}`.toLowerCase();
    if (/movifit|movipro|umrichter|fu|steuer|controller|control/.test(hay)) return "control";
    if (/motor|antrieb|sew|drive|getriebe/.test(hay)) return "drive";
    if (/sensor|lichtschranke|initiator|geber|stop|langsam|schnell/.test(hay)) return "sensor";
    if (/wartung|schalter|hauptschalter|maintenance|disconnect/.test(hay)) return "maintenance";
    if (/klemm|verteiler|junction|box|klemmenkasten/.test(hay)) return "junction";
    if (/rahmen|frame|grundk[oö]rper|körper|chassis/.test(hay)) return "frame";
    if (/rolle|rollen|roller|rollerbahn/.test(hay)) return "roller";
    if (/riemen|belt|kette|chain/.test(hay)) return "belt";
    if (/st[üu]tze|fu[ßs]|support|stand/.test(hay)) return "support";
    if (/schutz|gitter|guard|zaun|fence/.test(hay)) return "guard";
    return "component";
  }


  /**
   * PATCH_assemblylab_ports_v1
   * Rollenbasierte Port-/Anschlussvorlagen fuer Baugruppen-Bauteile.
   *
   * Das ist bewusst noch keine finale Elektrokonstruktion, sondern ein stabiles
   * Startmodell fuer spaetere Kabelpunkte/Kabellisten. Die Ports werden direkt
   * am Component-Objekt gespeichert, damit Varianten und Workarea-Instanzen
   * reload-sicher bleiben.
   *
   * Hinweis aus der Praxis: MOVIFIT/MOVIPRO hat in unserem Startmodell nicht nur
   * 400V, sondern auch 24V DC und Safety/STO-Bezug. Zusaetzlich fuehren wir einen
   * Bedienpult/Safety-Output als Platzhalter, damit die spaetere Zuordnung zum
   * Sicherheitsbereich nicht verloren geht.
   */
  _getAssemblyPortTemplatesV1(role = "component") {
    const r = String(role || "component");
    const common = {
      enabled: true,
      required: false,
      voltage: "",
      signal: "",
      connector: "",
      cableHint: "",
      comment: ""
    };
    const p = (key, label, kind, direction, extra = {}) => ({
      ...common,
      key,
      label,
      kind,
      direction,
      required: true,
      ...extra
    });

    if (r === "control") {
      return [
        p("PWR_400V_IN", "400V Einspeisung", "power", "input", {
          voltage: "400V AC",
          signal: "L1/L2/L3/PE",
          cableHint: "Einspeisung / Leistung"
        }),
        p("CTRL_24V_IN", "24V DC Versorgung", "control", "input", {
          voltage: "24V DC",
          signal: "+24V/0V",
          cableHint: "Steuerspannung"
        }),
        p("STO_IN", "STO / Safety Eingang", "safety", "input", {
          voltage: "24V DC",
          signal: "STO A/B",
          cableHint: "Safety / STO"
        }),
        p("SAFETY_PANEL_OUT", "Bedienpult / Safety Ausgang", "safety", "output", {
          voltage: "24V DC",
          signal: "Safety/Enable zum Bedienpult",
          cableHint: "Bedienpult Sicherheitskreis",
          required: false
        }),
        p("MOTOR_OUT", "Motorabgang", "power", "output", {
          voltage: "400V AC",
          signal: "U/V/W/PE/Bremse optional",
          cableHint: "Motorleitung"
        }),
        p("PN_IN", "Profinet IN", "network", "input", {
          signal: "PN/ETH",
          connector: "M12/RJ45 je nach Geraet",
          cableHint: "Netzwerk"
        }),
        p("PN_OUT", "Profinet OUT", "network", "output", {
          signal: "PN/ETH",
          connector: "M12/RJ45 je nach Geraet",
          cableHint: "Netzwerk",
          required: false
        })
      ];
    }

    if (r === "drive") {
      return [
        p("MOTOR_POWER_IN", "Motor Leistung", "power", "input", {
          voltage: "400V AC",
          signal: "U/V/W/PE",
          cableHint: "vom MOVIFIT/MOVIPRO"
        }),
        p("BRAKE_IN", "Bremse 24V", "control", "input", {
          voltage: "24V DC",
          signal: "Bremse +/−",
          cableHint: "Bremsleitung optional",
          required: false
        }),
        p("PE", "PE / Potentialausgleich", "pe", "bidirectional", {
          signal: "PE/PA",
          cableHint: "Schutzleiter / PA"
        })
      ];
    }

    if (r === "sensor") {
      return [
        p("SENSOR_24V", "Sensor 24V", "control", "input", {
          voltage: "24V DC",
          signal: "+24V/0V",
          connector: "M12",
          cableHint: "Sensorleitung"
        }),
        p("SENSOR_SIGNAL", "Sensorsignal", "signal", "output", {
          voltage: "24V DC",
          signal: "DI / Signal",
          connector: "M12",
          cableHint: "Signal zur Steuerung"
        })
      ];
    }

    if (r === "maintenance") {
      return [
        p("PWR_400V_IN", "400V Eingang", "power", "input", {
          voltage: "400V AC",
          signal: "L1/L2/L3/PE",
          cableHint: "Zuleitung"
        }),
        p("PWR_400V_OUT", "400V Ausgang", "power", "output", {
          voltage: "400V AC",
          signal: "L1/L2/L3/PE",
          cableHint: "Abgang zur Baugruppe"
        }),
        p("PE", "PE / Potentialausgleich", "pe", "bidirectional", {
          signal: "PE/PA",
          cableHint: "Schutzleiter / PA"
        })
      ];
    }

    if (r === "junction") {
      return [
        p("TB_400V", "Klemmpunkt 400V", "power", "bidirectional", {
          voltage: "400V AC",
          signal: "L1/L2/L3/PE",
          cableHint: "Leistungsklemmen"
        }),
        p("TB_24V", "Klemmpunkt 24V", "control", "bidirectional", {
          voltage: "24V DC",
          signal: "+24V/0V",
          cableHint: "Steuerklemmen"
        }),
        p("TB_SAFETY", "Klemmpunkt Safety/STO", "safety", "bidirectional", {
          voltage: "24V DC",
          signal: "STO/Safety",
          cableHint: "Safety-Klemmen",
          required: false
        })
      ];
    }

    if (r === "frame" || r === "support" || r === "guard") {
      return [
        p("PE", "PE / Potentialausgleich", "pe", "bidirectional", {
          signal: "PE/PA",
          cableHint: "Potentialausgleich",
          required: false
        })
      ];
    }

    return [];
  }

  _makeAssemblyComponentPortsV1(role = "component", componentId = "", componentName = "") {
    const templates = this._getAssemblyPortTemplatesV1(role);
    return templates.map((tpl, index) => ({
      schema: "baustellenplaner.assemblylab.port.v1",
      id: `${componentId || "cmp"}:${tpl.key || `P${index + 1}`}`,
      componentId: componentId || "",
      componentName: componentName || "",
      role: String(role || "component"),
      roleLabel: this._getAssemblyRoleLabelV1(role || "component"),
      key: tpl.key || `P${index + 1}`,
      label: tpl.label || tpl.key || `Port ${index + 1}`,
      kind: tpl.kind || "signal",
      direction: tpl.direction || "bidirectional",
      voltage: tpl.voltage || "",
      signal: tpl.signal || "",
      connector: tpl.connector || "",
      cableHint: tpl.cableHint || "",
      required: tpl.required !== false,
      enabled: tpl.enabled !== false,
      comment: tpl.comment || "",
      auto: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }));
  }

  _normalizeAssemblyComponentPortsV1(component = {}) {
    const c = component && typeof component === "object" ? component : {};
    const role = String(c.role || "component");
    const name = String(c.name || c.projectAssetId || "Bauteil");
    let ports = Array.isArray(c.ports) ? c.ports : [];

    // Fuer alte Komponenten ohne Ports: Default-Ports aus der Rolle erzeugen.
    if (!ports.length) {
      ports = this._makeAssemblyComponentPortsV1(role, c.id || "", name);
    }

    return ports.map((port, index) => {
      const key = String(port?.key || port?.id || `P${index + 1}`);
      return {
        schema: "baustellenplaner.assemblylab.port.v1",
        id: String(port?.id || `${c.id || "cmp"}:${key}`),
        componentId: String(port?.componentId || c.id || ""),
        componentName: String(port?.componentName || name || ""),
        role,
        roleLabel: this._getAssemblyRoleLabelV1(role),
        key,
        label: String(port?.label || key),
        kind: String(port?.kind || "signal"),
        direction: String(port?.direction || "bidirectional"),
        voltage: String(port?.voltage || ""),
        signal: String(port?.signal || ""),
        connector: String(port?.connector || ""),
        cableHint: String(port?.cableHint || ""),
        required: port?.required !== false,
        enabled: port?.enabled !== false,
        comment: String(port?.comment || ""),
        auto: port?.auto !== false,
        updatedAt: port?.updatedAt || new Date().toISOString(),
        createdAt: port?.createdAt || new Date().toISOString()
      };
    });
  }

  _normalizeAssemblyComponentsWithPortsV1(components = []) {
    return (Array.isArray(components) ? components : []).map((cmp) => {
      const c = this._assemblyLabClone(cmp, cmp) || {};
      c.role = c.role || "component";
      c.roleLabel = this._getAssemblyRoleLabelV1(c.role);
      c.ports = this._normalizeAssemblyComponentPortsV1(c);
      return c;
    });
  }

  _flattenAssemblyPortsV1(components = []) {
    const result = [];
    for (const c of Array.isArray(components) ? components : []) {
      const ports = this._normalizeAssemblyComponentPortsV1(c);
      for (const port of ports) {
        if (port.enabled === false) continue;
        result.push({
          ...port,
          assemblyComponentId: c.id || port.componentId || "",
          componentId: c.id || port.componentId || "",
          componentName: c.name || port.componentName || "",
          projectAssetId: c.projectAssetId || null,
          slotId: c.slotId || null,
          x: Number(c.x || 0),
          y: Number(c.y || 0),
          z: Number(c.z || 0),
          rotDeg: Number(c.rotDeg || 0)
        });
      }
    }
    return result;
  }

  _formatAssemblyPortSummaryV1(ports = [], max = 5) {
    const list = (Array.isArray(ports) ? ports : []).filter((p) => p && p.enabled !== false);
    if (!list.length) return "keine Ports";
    const labels = list.slice(0, max).map((p) => {
      const parts = [p.label || p.key, p.voltage, p.direction].filter(Boolean);
      return parts.join(" · ");
    });
    if (list.length > max) labels.push(`+${list.length - max}`);
    return labels.join(" | ");
  }


  /**
   * PATCH_assemblylab_cablepoints_v1
   * Aus den rollenbasierten Ports werden erste Kabelpunkte erzeugt.
   *
   * Wichtig:
   * - Das ist noch keine automatische Quelle/Ziel-Verdrahtung und noch keine
   *   finale Kabelliste. CablePoints sind die Zwischenschicht:
   *   Port -> Kabelpunkt -> spaeter Verbindung/Kabel.
   * - MOVIFIT/MOVIPRO-Ports bekommen dadurch getrennte Punkte fuer 400V,
   *   24V, Safety/STO, Bedienpult/Safety, Motorabgang und Profinet.
   * - Manuelle Werte werden spaeter ueber die CablePoint-ID erhalten.
   */
  _getAssemblyCablePointTypesV1() {
    return [
      { value: "power_400v", label: "Power 400V", short: "400V", cableTypeHint: "Leistungskabel / 5G…" },
      { value: "dc_24v", label: "24V DC", short: "24V", cableTypeHint: "Steuerleitung 24V" },
      { value: "safety_sto", label: "Safety / STO", short: "STO", cableTypeHint: "Safety-/STO-Leitung" },
      { value: "motor", label: "Motorleitung", short: "Motor", cableTypeHint: "Motorleitung U/V/W/PE, Bremse optional" },
      { value: "profinet", label: "Profinet / Netzwerk", short: "PN", cableTypeHint: "Profinet / Ethernet" },
      { value: "sensor", label: "Sensor / Signal", short: "Sensor", cableTypeHint: "M12 Sensorleitung" },
      { value: "pe_pa", label: "PE / Potentialausgleich", short: "PE/PA", cableTypeHint: "PE / PA" },
      { value: "terminal", label: "Klemme / Verteiler", short: "Klemme", cableTypeHint: "Klemmenverdrahtung" },
      { value: "generic", label: "Allgemein", short: "Allg.", cableTypeHint: "noch festlegen" }
    ];
  }

  _getAssemblyCablePointTypeLabelV1(type, mode = "label") {
    const key = String(type || "generic");
    const hit = this._getAssemblyCablePointTypesV1().find((t) => t.value === key);
    if (!hit) return key || "Allgemein";
    return mode === "short" ? (hit.short || hit.label || hit.value) : (hit.label || hit.value);
  }

  _inferAssemblyCablePointTypeFromPortV1(port = {}) {
    const kind = String(port?.kind || "").toLowerCase();
    const rawKey = String(port?.key || port?.id || "");
    const key = rawKey.toLowerCase();
    const label = String(port?.label || "").toLowerCase();
    const voltage = String(port?.voltage || "").toLowerCase();
    const signal = String(port?.signal || "").toLowerCase();
    const cableHint = String(port?.cableHint || "").toLowerCase();
    const hay = `${kind} ${key} ${label} ${voltage} ${signal} ${cableHint}`;

    // PATCH_assemblylab_cabletype_classifier_hotfix_v1
    // ------------------------------------------------------------
    // Wichtig: Vorher wurde sehr frueh nach "PE" gesucht. Dadurch wurden
    // Anschluesse wie L1/L2/L3/PE oder U/V/W/PE faelschlich komplett als
    // Potentialausgleich klassifiziert. Deshalb pruefen wir zuerst die
    // eindeutigen Port-Keys und technischen Hauptfunktionen. PE/PA kommt
    // erst am Ende als eigener Port-Typ.
    if (/^(pn_in|pn_out|profinet_in|profinet_out)$/i.test(rawKey)) return "profinet";
    if (/^(sto_in|sto_out|safety_in|safety_out|safety_panel_out)$/i.test(rawKey)) return "safety_sto";
    if (/^(motor_out|motor_power_in|motor_power_out)$/i.test(rawKey)) return "motor";
    if (/^(pwr_400v_in|pwr_400v_out|power_400v_in|power_400v_out)$/i.test(rawKey)) return "power_400v";
    if (/^(ctrl_24v_in|ctrl_24v_out|brake_in|brake_out|24v_in|24v_out)$/i.test(rawKey)) return "dc_24v";
    if (/^(sensor_24v|sensor_signal|sensor_in|sensor_out)$/i.test(rawKey)) return "sensor";
    if (/^(pe|pa|pe_pa|potentialausgleich)$/i.test(rawKey) || kind === "pe") return "pe_pa";

    if (/profinet|ethernet|pn_|network|netzwerk/.test(hay) || kind === "network") return "profinet";
    if (/sto|safety|bedienpult|not.?halt|enable/.test(hay) || kind === "safety") return "safety_sto";
    if (/motor|u\/v\/w|u-v-w|motorabgang|motor_power/.test(hay)) return "motor";
    if (/sensor|m12|di\s*\/\s*signal|sensorsignal/.test(hay) || kind === "signal") return "sensor";
    if (/24v|24\s*v|bremse/.test(hay) || kind === "control") return "dc_24v";
    if (/400v|400\s*v|l1\/l2\/l3|leistung/.test(hay) || kind === "power") return "power_400v";
    if (/klemme|terminal|tb_/.test(hay)) return "terminal";
    if (/\b(pe|pa)\b|potential|schutzleiter/.test(hay)) return "pe_pa";
    return "generic";
  }

  _makeAssemblyCablePointIdV1(assemblyId, port, index = 0) {
    const base = String(port?.id || port?.key || `P${index + 1}`).replace(/[^a-zA-Z0-9:_-]+/g, "_");
    return `${assemblyId || "asm"}:cp:${base}`;
  }

  _makeAssemblyCablePointFromPortV1(port = {}, sceneObj = {}, index = 0, previous = null) {
    const assemblyId = String(sceneObj?.id || "");
    const inferredType = this._inferAssemblyCablePointTypeFromPortV1(port);
    // Auto-generierte Kabelpunkte duerfen nach Classifier-Hotfix neu klassifiziert
    // werden. Nur explizit manuelle CablePoints (auto:false) behalten ihren Typ.
    const previousIsManual = previous && previous.auto === false;
    const type = previousIsManual ? (previous?.type || inferredType) : inferredType;
    const typeChanged = previous && previous.type && previous.type !== type;
    const typeMeta = this._getAssemblyCablePointTypesV1().find((t) => t.value === type) || null;
    const direction = String(port?.direction || "bidirectional");
    const portLabel = String(port?.label || port?.key || `Port ${index + 1}`);
    const componentName = String(port?.componentName || "Bauteil");
    const endpointLabel = `${componentName} · ${portLabel}`;

    let sourceHint = previous?.sourceHint || "noch zuordnen";
    let targetHint = previous?.targetHint || "noch zuordnen";
    if (!previous?.sourceHint && !previous?.targetHint) {
      if (direction === "output") sourceHint = endpointLabel;
      else if (direction === "input") targetHint = endpointLabel;
      else {
        sourceHint = endpointLabel;
        targetHint = "noch zuordnen";
      }
    }

    return {
      schema: "baustellenplaner.assemblylab.cablepoint.v1",
      id: previous?.id || this._makeAssemblyCablePointIdV1(assemblyId, port, index),
      assemblyId,
      assemblyName: String(sceneObj?.name || sceneObj?.config?.name || assemblyId || "Baugruppe"),
      templateId: String(sceneObj?.templateId || sceneObj?.assemblyLab?.templateId || ""),
      variantId: String(sceneObj?.variantId || sceneObj?.assemblyLab?.variantId || ""),
      conveyorGroup: String(sceneObj?.config?.conveyorGroup || sceneObj?.conveyorGroup || ""),
      location: String(sceneObj?.config?.location || sceneObj?.location || ""),
      equipmentTag: String(sceneObj?.config?.equipmentTag || sceneObj?.equipmentTag || ""),
      componentId: String(port?.componentId || port?.assemblyComponentId || ""),
      componentName,
      componentRole: String(port?.role || "component"),
      componentRoleLabel: String(port?.roleLabel || this._getAssemblyRoleLabelV1(port?.role || "component")),
      projectAssetId: port?.projectAssetId || null,
      slotId: port?.slotId || null,
      portId: String(port?.id || ""),
      portKey: String(port?.key || ""),
      portLabel,
      type,
      typeLabel: this._getAssemblyCablePointTypeLabelV1(type),
      direction,
      voltage: String(port?.voltage || ""),
      signal: String(port?.signal || ""),
      connector: String(port?.connector || ""),
      cableHint: String(port?.cableHint || ""),
      cableTypeHint: String((typeChanged ? "" : previous?.cableTypeHint) || port?.cableTypeHint || typeMeta?.cableTypeHint || port?.cableHint || "noch festlegen"),
      sourceHint,
      targetHint,
      status: String(previous?.status || "planned"),
      required: port?.required !== false,
      enabled: previous?.enabled !== false && port?.enabled !== false,
      x: Number(port?.x || 0),
      y: Number(port?.y || 0),
      z: Number(port?.z || 0),
      rotDeg: Number(port?.rotDeg || 0),
      comment: String(previous?.comment || port?.comment || ""),
      auto: previous?.auto !== false,
      updatedAt: new Date().toISOString(),
      createdAt: previous?.createdAt || new Date().toISOString()
    };
  }

  _deriveAssemblyCablePointsV1(sceneObj = {}) {
    const ports = Array.isArray(sceneObj?.ports) && sceneObj.ports.length
      ? sceneObj.ports
      : this._flattenAssemblyPortsV1(sceneObj?.components || []);
    const previous = Array.isArray(sceneObj?.cablePoints)
      ? sceneObj.cablePoints
      : (Array.isArray(sceneObj?.cablepoints) ? sceneObj.cablepoints : []);
    const prevByPort = new Map();
    const prevById = new Map();
    for (const cp of previous) {
      if (!cp || typeof cp !== "object") continue;
      if (cp.portId) prevByPort.set(String(cp.portId), cp);
      if (cp.id) prevById.set(String(cp.id), cp);
    }

    const list = [];
    for (const [index, port] of (Array.isArray(ports) ? ports : []).entries()) {
      if (!port || port.enabled === false) continue;
      const id = this._makeAssemblyCablePointIdV1(sceneObj?.id || "", port, index);
      const prev = prevByPort.get(String(port.id || "")) || prevById.get(id) || null;
      list.push(this._makeAssemblyCablePointFromPortV1(port, sceneObj, index, prev));
    }
    return list;
  }

  _formatAssemblyCablePointSummaryV1(cablePoints = [], max = 5) {
    const list = (Array.isArray(cablePoints) ? cablePoints : []).filter((cp) => cp && cp.enabled !== false);
    if (!list.length) return "keine Kabelpunkte";
    const labels = list.slice(0, max).map((cp) => {
      const parts = [this._getAssemblyCablePointTypeLabelV1(cp.type, "short"), cp.portLabel, cp.direction].filter(Boolean);
      return parts.join(" · ");
    });
    if (list.length > max) labels.push(`+${list.length - max}`);
    return labels.join(" | ");
  }


  /**
   * PATCH_assemblylab_cablelist_v1
   * Erste automatische Kabellisten-Kandidaten aus den CablePoints.
   *
   * Wichtig:
   * - Das ist noch keine finale EPLAN-/Klemmenlogik.
   * - Die Liste verbindet typische Rollen/Ports zu plausiblen Kabeln:
   *   MOVIFIT -> Motor, 24V -> Sensor, Sensor -> Steuerung,
   *   Wartungsschalter/Schrank -> MOVIFIT, Safety/STO, Profinet, PE/PA.
   * - Manuelle Felder bleiben ueber die CableLine-ID erhalten.
   */
  _getAssemblyCableLineTypesV1() {
    return [
      { value: "power_400v", label: "400V Einspeisung", short: "400V", cableTypeHint: "Leistungskabel / 5G…" },
      { value: "motor", label: "Motorleitung", short: "Motor", cableTypeHint: "Motorleitung U/V/W/PE" },
      { value: "dc_24v", label: "24V DC", short: "24V", cableTypeHint: "Steuerleitung 24V" },
      { value: "sensor", label: "Sensorleitung", short: "Sensor", cableTypeHint: "M12 Sensorleitung" },
      { value: "safety_sto", label: "Safety / STO", short: "STO", cableTypeHint: "Safety-/STO-Leitung" },
      { value: "profinet", label: "Profinet / Netzwerk", short: "PN", cableTypeHint: "Profinet / Ethernet" },
      { value: "pe_pa", label: "PE / Potentialausgleich", short: "PE/PA", cableTypeHint: "PE / PA" },
      { value: "generic", label: "Allgemein", short: "Allg.", cableTypeHint: "noch festlegen" }
    ];
  }

  _getAssemblyCableLineTypeLabelV1(type, mode = "label") {
    const key = String(type || "generic");
    const hit = this._getAssemblyCableLineTypesV1().find((t) => t.value === key);
    if (!hit) return key || "Allgemein";
    return mode === "short" ? (hit.short || hit.label || hit.value) : (hit.label || hit.value);
  }

  _getAssemblyCableLineTypeHintV1(type) {
    const key = String(type || "generic");
    const hit = this._getAssemblyCableLineTypesV1().find((t) => t.value === key);
    return hit?.cableTypeHint || "noch festlegen";
  }

  _labelAssemblyCablePointV1(cp = {}) {
    return [cp.componentName || "Bauteil", cp.portLabel || cp.portKey || "Port"].filter(Boolean).join(" · ");
  }

  _makeAssemblyCableLineIdV1(assemblyId, type, sourceKey, targetKey, index = 0) {
    const clean = (v) => String(v || "x").replace(/[^a-zA-Z0-9:_-]+/g, "_").slice(0, 80);
    return `${assemblyId || "asm"}:cl:${clean(type)}:${clean(sourceKey)}:${clean(targetKey)}:${index}`;
  }

  _makeAssemblyCableLineCandidateV1(sceneObj = {}, cfg = {}, previous = null, index = 0) {
    const assemblyId = String(sceneObj?.id || "");
    const type = String(previous?.type || cfg.type || "generic");
    const sourceCp = cfg.sourceCp || null;
    const targetCp = cfg.targetCp || null;
    const sourceLabel = String(previous?.sourceLabel || cfg.sourceLabel || (sourceCp ? this._labelAssemblyCablePointV1(sourceCp) : "Quelle offen"));
    const targetLabel = String(previous?.targetLabel || cfg.targetLabel || (targetCp ? this._labelAssemblyCablePointV1(targetCp) : "Ziel offen"));
    const sourceKey = sourceCp?.id || sourceLabel;
    const targetKey = targetCp?.id || targetLabel;
    const id = previous?.id || this._makeAssemblyCableLineIdV1(assemblyId, type, sourceKey, targetKey, index);

    return {
      schema: "baustellenplaner.assemblylab.cableline.v1",
      id,
      assemblyId,
      assemblyName: String(sceneObj?.name || sceneObj?.config?.name || assemblyId || "Baugruppe"),
      templateId: String(sceneObj?.templateId || sceneObj?.assemblyLab?.templateId || ""),
      variantId: String(sceneObj?.variantId || sceneObj?.assemblyLab?.variantId || ""),
      conveyorGroup: String(sceneObj?.config?.conveyorGroup || sceneObj?.conveyorGroup || ""),
      location: String(sceneObj?.config?.location || sceneObj?.location || ""),
      equipmentTag: String(sceneObj?.config?.equipmentTag || sceneObj?.equipmentTag || ""),
      type,
      typeLabel: this._getAssemblyCableLineTypeLabelV1(type),
      sourceCablePointId: sourceCp?.id || previous?.sourceCablePointId || "",
      targetCablePointId: targetCp?.id || previous?.targetCablePointId || "",
      sourceComponentId: sourceCp?.componentId || previous?.sourceComponentId || "",
      targetComponentId: targetCp?.componentId || previous?.targetComponentId || "",
      sourceLabel,
      targetLabel,
      cableTypeHint: String(previous?.cableTypeHint || cfg.cableTypeHint || sourceCp?.cableTypeHint || targetCp?.cableTypeHint || this._getAssemblyCableLineTypeHintV1(type)),
      cableType: String(previous?.cableType || cfg.cableType || ""),
      cableNo: String(previous?.cableNo || cfg.cableNo || ""),
      lengthM: previous?.lengthM ?? cfg.lengthM ?? "",
      wires: String(previous?.wires || cfg.wires || ""),
      crossSection: String(previous?.crossSection || cfg.crossSection || ""),
      route: String(previous?.route || cfg.route || ""),
      status: String(previous?.status || cfg.status || "planned"),
      required: cfg.required !== false,
      enabled: previous?.enabled !== false,
      auto: previous?.auto !== false,
      comment: String(previous?.comment || cfg.comment || ""),
      eplan: {
        ...this._defaultCableLineEplanV1(sceneObj, cfg, sourceCp, targetCp),
        ...(previous?.eplan && typeof previous.eplan === "object" ? previous.eplan : {})
      },
      sourceDeviceTag: String(previous?.sourceDeviceTag || previous?.eplan?.sourceDeviceTag || cfg.sourceDeviceTag || ""),
      sourceConnection: String(previous?.sourceConnection || previous?.eplan?.sourceConnection || cfg.sourceConnection || ""),
      targetDeviceTag: String(previous?.targetDeviceTag || previous?.eplan?.targetDeviceTag || cfg.targetDeviceTag || ""),
      targetConnection: String(previous?.targetConnection || previous?.eplan?.targetConnection || cfg.targetConnection || ""),
      terminalRef: String(previous?.terminalRef || previous?.eplan?.sourceTerminal || cfg.terminalRef || ""),
      eplanPage: String(previous?.eplanPage || previous?.eplan?.pagePath || cfg.eplanPage || ""),
      createdAt: previous?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  _deriveAssemblyCableListV1(sceneObj = {}) {
    const cablePoints = Array.isArray(sceneObj?.cablePoints) && sceneObj.cablePoints.length
      ? sceneObj.cablePoints
      : this._deriveAssemblyCablePointsV1(sceneObj);
    const cps = (Array.isArray(cablePoints) ? cablePoints : []).filter((cp) => cp && cp.enabled !== false);
    const previous = Array.isArray(sceneObj?.cableLines)
      ? sceneObj.cableLines
      : (Array.isArray(sceneObj?.cableList) ? sceneObj.cableList : []);

    const prevBySignature = new Map();
    const sigFor = (type, src, dst) => `${String(type || "generic")}::${String(src || "")}::${String(dst || "")}`;
    for (const cl of previous) {
      if (!cl || typeof cl !== "object") continue;
      const sig = sigFor(cl.type, cl.sourceCablePointId || cl.sourceLabel, cl.targetCablePointId || cl.targetLabel);
      prevBySignature.set(sig, cl);
      if (cl.id) prevBySignature.set(String(cl.id), cl);
    }

    const byType = (type) => cps.filter((cp) => String(cp.type || "") === String(type));
    const byTypeDir = (type, dir) => byType(type).filter((cp) => String(cp.direction || "") === dir);
    const byTypeRole = (type, role) => byType(type).filter((cp) => String(cp.componentRole || "") === role);
    const hasRole = (cp, role) => String(cp?.componentRole || "") === role;

    const out = [];
    const add = (cfg) => {
      const type = String(cfg.type || "generic");
      const srcKey = cfg.sourceCp?.id || cfg.sourceLabel || "";
      const dstKey = cfg.targetCp?.id || cfg.targetLabel || "";
      const sig = sigFor(type, srcKey, dstKey);
      const id = this._makeAssemblyCableLineIdV1(sceneObj?.id || "", type, srcKey, dstKey, out.length);
      const prev = prevBySignature.get(sig) || prevBySignature.get(id) || null;
      out.push(this._makeAssemblyCableLineCandidateV1(sceneObj, cfg, prev, out.length));
    };

    const controlMotorOut = byType("motor").find((cp) => hasRole(cp, "control") && cp.direction === "output") || byTypeDir("motor", "output")[0] || null;
    for (const motorIn of byType("motor").filter((cp) => cp.direction === "input" && (hasRole(cp, "drive") || /motor/i.test(cp.portLabel || "")))) {
      add({ type: "motor", sourceCp: controlMotorOut, targetCp: motorIn, sourceLabel: controlMotorOut ? undefined : "MOVIFIT/MOVIPRO Motorabgang", cableTypeHint: "Motorleitung U/V/W/PE" });
    }

    const maintenanceOut = byType("power_400v").find((cp) => hasRole(cp, "maintenance") && cp.direction === "output") || null;
    for (const powerIn of byType("power_400v").filter((cp) => cp.direction === "input" && hasRole(cp, "control"))) {
      add({ type: "power_400v", sourceCp: maintenanceOut, sourceLabel: maintenanceOut ? undefined : "Wartungsschalter / Schaltschrank 400V", targetCp: powerIn, cableTypeHint: "400V Einspeisung / Leistung" });
    }

    const control24 = byType("dc_24v").find((cp) => hasRole(cp, "control")) || null;
    for (const ctrl24 of byType("dc_24v").filter((cp) => cp.direction === "input" && hasRole(cp, "control"))) {
      add({ type: "dc_24v", sourceLabel: "24V DC Netzteil / Schaltschrank", targetCp: ctrl24, cableTypeHint: "Steuerleitung 24V" });
    }
    for (const sensor24 of byType("dc_24v").filter((cp) => cp.direction === "input" && hasRole(cp, "sensor"))) {
      add({ type: "dc_24v", sourceCp: control24, sourceLabel: control24 ? undefined : "MOVIFIT/MOVIPRO 24V DC", targetCp: sensor24, cableTypeHint: "Sensorversorgung 24V" });
    }
    for (const brake24 of byType("dc_24v").filter((cp) => cp.direction === "input" && hasRole(cp, "drive") && /bremse|brake/i.test(cp.portLabel || ""))) {
      add({ type: "dc_24v", sourceLabel: "MOVIFIT/MOVIPRO Bremsausgang 24V", targetCp: brake24, cableTypeHint: "Bremsleitung 24V optional", required: false });
    }

    for (const sig of byType("sensor").filter((cp) => cp.direction === "output" && hasRole(cp, "sensor"))) {
      add({ type: "sensor", sourceCp: sig, targetLabel: "MOVIFIT/MOVIPRO DI / Steuerung", cableTypeHint: "M12 Sensorleitung / Signal" });
    }
    for (const sensorIn of byType("sensor").filter((cp) => cp.direction === "input" && hasRole(cp, "sensor"))) {
      add({ type: "sensor", sourceLabel: "MOVIFIT/MOVIPRO Sensorversorgung", targetCp: sensorIn, cableTypeHint: "M12 Sensorleitung / Versorgung" });
    }

    for (const stoIn of byType("safety_sto").filter((cp) => cp.direction === "input")) {
      add({ type: "safety_sto", sourceLabel: "Bedienpult / Safety-Kreis", targetCp: stoIn, cableTypeHint: "Safety-/STO-Leitung" });
    }
    for (const safetyOut of byType("safety_sto").filter((cp) => cp.direction === "output")) {
      add({ type: "safety_sto", sourceCp: safetyOut, targetLabel: "Bedienpult / Sicherheitsbereich", cableTypeHint: "Bedienpult Sicherheitskreis", required: false });
    }

    for (const pnIn of byType("profinet").filter((cp) => cp.direction === "input")) {
      add({ type: "profinet", sourceLabel: "Profinet vorheriges Gerät / Switch", targetCp: pnIn, cableTypeHint: "Profinet / Ethernet" });
    }
    for (const pnOut of byType("profinet").filter((cp) => cp.direction === "output")) {
      add({ type: "profinet", sourceCp: pnOut, targetLabel: "Profinet nächstes Gerät", cableTypeHint: "Profinet / Ethernet", required: false });
    }

    for (const pe of byType("pe_pa")) {
      add({ type: "pe_pa", sourceLabel: "PE/PA-Schiene / Potentialausgleich", targetCp: pe, cableTypeHint: "PE / PA" });
    }

    // Deduplizieren, falls ein Port ueber mehrere einfache Regeln getroffen wurde.
    const seen = new Set();
    return out.filter((cl) => {
      const k = `${cl.type}::${cl.sourceLabel}::${cl.targetLabel}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return cl.enabled !== false;
    });
  }

  _formatAssemblyCableListSummaryV1(cableLines = [], max = 5) {
    const list = (Array.isArray(cableLines) ? cableLines : []).filter((cl) => cl && cl.enabled !== false);
    if (!list.length) return "keine Kabelliste";
    const labels = list.slice(0, max).map((cl) => {
      const parts = [this._getAssemblyCableLineTypeLabelV1(cl.type, "short"), cl.sourceLabel, "→", cl.targetLabel].filter(Boolean);
      return parts.join(" ");
    });
    if (list.length > max) labels.push(`+${list.length - max}`);
    return labels.join(" | ");
  }


  /**
   * PATCH_assemblylab_cablelist_fields_v1
   * Editierbare Montage-/EPLAN-Felder fuer Kabellisten-Zeilen.
   *
   * Die automatische CableList bleibt weiterhin ein Vorschlag. Diese Felder
   * machen daraus eine praktische Baustellenliste: Kabelnummer, Quelle, Ziel,
   * Kabeltyp, Adern/Querschnitt, Laenge, Status und Bemerkung bleiben direkt
   * an der Workarea-Baugruppen-Instanz gespeichert.
   */
  _getAssemblyCableLineStatusOptionsV1() {
    return [
      { value: "planned", label: "geplant" },
      { value: "to_pull", label: "ziehen" },
      { value: "pulled", label: "gezogen" },
      { value: "measured", label: "gemessen" },
      { value: "connected", label: "angeschlossen" },
      { value: "checked", label: "geprüft" },
      { value: "open", label: "offen" },
      { value: "ignore", label: "ignorieren" }
    ];
  }

  _getAssemblyCableLineStatusLabelV1(status) {
    const key = String(status || "planned");
    const hit = this._getAssemblyCableLineStatusOptionsV1().find((x) => x.value === key);
    return hit?.label || key;
  }

  _ensureAssemblyCableLinesV1(sceneObj = {}) {
    if (!sceneObj || typeof sceneObj !== "object") return [];
    if (!Array.isArray(sceneObj.ports) || !sceneObj.ports.length) {
      sceneObj.ports = this._flattenAssemblyPortsV1(sceneObj.components || []);
    }
    if (!Array.isArray(sceneObj.cablePoints) || !sceneObj.cablePoints.length) {
      sceneObj.cablePoints = this._deriveAssemblyCablePointsV1(sceneObj);
    }
    if (!Array.isArray(sceneObj.cableLines) || !sceneObj.cableLines.length) {
      sceneObj.cableLines = this._deriveAssemblyCableListV1(sceneObj);
    }
    return sceneObj.cableLines;
  }

  _setAssemblyCableLineFieldV1(sceneObj = {}, lineId, field, value) {
    const lines = this._ensureAssemblyCableLinesV1(sceneObj);
    const line = lines.find((x) => String(x?.id || "") === String(lineId || ""));
    if (!line) {
      this._setStatus("⚠️ Kabelzeile nicht gefunden");
      return;
    }

    const key = String(field || "");
    if (key === "lengthM") {
      const raw = String(value ?? "").replace(",", ".").trim();
      line.lengthM = raw === "" ? "" : (Number.isFinite(Number(raw)) ? Number(raw) : raw);
    } else if (key === "enabled") {
      line.enabled = Boolean(value);
    } else if (["cableNo", "sourceLabel", "targetLabel", "cableType", "wires", "crossSection", "route", "status", "comment", "sourceDeviceTag", "sourceConnection", "targetDeviceTag", "targetConnection", "terminalRef", "eplanPage"].includes(key)) {
      line[key] = String(value ?? "");
      line.eplan = line.eplan && typeof line.eplan === "object" ? line.eplan : {};
      if (key === "sourceDeviceTag") line.eplan.sourceDeviceTag = line[key];
      if (key === "sourceConnection") line.eplan.sourceConnection = line[key];
      if (key === "targetDeviceTag") line.eplan.targetDeviceTag = line[key];
      if (key === "targetConnection") line.eplan.targetConnection = line[key];
      if (key === "terminalRef") line.eplan.sourceTerminal = line[key];
      if (key === "eplanPage") line.eplan.pagePath = line[key];
    } else {
      line[key] = value;
    }
    line.updatedAt = new Date().toISOString();
    this._assemblyPropsPersistScene(sceneObj, `assemblyprops:cableline:${key}`);
  }

  /**
   * PATCH_assemblylab_eplan_fields_v1
   * ------------------------------------------------------------
   * EPLAN-nahe Basisfelder fuer Baugruppen, Bauteile und Kabel.
   * Diese Felder sind bewusst noch neutral gehalten: Sie sollen die
   * spaetere Klemmen-/BMK-/EPLAN-Logik vorbereiten, ohne jetzt schon eine
   * starre Norm erzwingen zu muessen.
   */
  _ensureAssemblyEplanV1(sceneObj = {}) {
    if (!sceneObj || typeof sceneObj !== "object") return {};
    sceneObj.config = sceneObj.config && typeof sceneObj.config === "object" ? sceneObj.config : {};
    const current = sceneObj.eplan && typeof sceneObj.eplan === "object" ? sceneObj.eplan : {};
    sceneObj.eplan = {
      schema: "baustellenplaner.assemblylab.eplan.v1",
      plant: String(current.plant || current.installation || sceneObj.config.plant || sceneObj.name || ""),
      location: String(current.location || sceneObj.config.location || sceneObj.location || ""),
      functionText: String(current.functionText || current.function || sceneObj.config.functionText || ""),
      equipmentTag: String(current.equipmentTag || sceneObj.config.equipmentTag || sceneObj.equipmentTag || ""),
      sourceCabinet: String(current.sourceCabinet || sceneObj.config.sourceCabinet || ""),
      terminalStrip: String(current.terminalStrip || sceneObj.config.terminalStrip || ""),
      safetyArea: String(current.safetyArea || sceneObj.config.safetyArea || ""),
      pagePath: String(current.pagePath || sceneObj.config.pagePath || ""),
      comment: String(current.comment || sceneObj.config.eplanComment || ""),
      updatedAt: String(current.updatedAt || "")
    };
    return sceneObj.eplan;
  }

  _setAssemblyEplanFieldV1(sceneObj = {}, field, value) {
    const eplan = this._ensureAssemblyEplanV1(sceneObj);
    const key = String(field || "");
    if (!key) return;
    eplan[key] = String(value ?? "").trim();
    eplan.updatedAt = new Date().toISOString();
    sceneObj.config = sceneObj.config && typeof sceneObj.config === "object" ? sceneObj.config : {};
    if (key === "location") {
      sceneObj.config.location = eplan.location;
      sceneObj.location = eplan.location;
    }
    if (key === "equipmentTag") {
      sceneObj.config.equipmentTag = eplan.equipmentTag;
      sceneObj.equipmentTag = eplan.equipmentTag;
    }
    if (key === "plant") sceneObj.config.plant = eplan.plant;
    if (key === "functionText") sceneObj.config.functionText = eplan.functionText;
    if (key === "sourceCabinet") sceneObj.config.sourceCabinet = eplan.sourceCabinet;
    if (key === "terminalStrip") sceneObj.config.terminalStrip = eplan.terminalStrip;
    if (key === "safetyArea") sceneObj.config.safetyArea = eplan.safetyArea;
    if (key === "pagePath") sceneObj.config.pagePath = eplan.pagePath;
    this._assemblyPropsPersistScene(sceneObj, `assemblyprops:eplan:${key}`);
  }

  _ensureAssemblyComponentEplanV1(component = {}, sceneObj = {}) {
    if (!component || typeof component !== "object") return {};
    const asm = this._ensureAssemblyEplanV1(sceneObj);
    const current = component.eplan && typeof component.eplan === "object" ? component.eplan : {};
    const role = String(component.role || "component");
    const fallbackTag = role === "drive" ? "-M1" : role === "control" ? "-MM1" : role === "sensor" ? "-B1" : role === "maintenance" ? "-Q1" : "";
    component.eplan = {
      schema: "baustellenplaner.assemblylab.component.eplan.v1",
      plant: String(current.plant || asm.plant || ""),
      location: String(current.location || asm.location || ""),
      functionText: String(current.functionText || current.function || component.roleLabel || this._getAssemblyRoleLabelV1(role)),
      deviceTag: String(current.deviceTag || current.equipmentTag || fallbackTag),
      terminalRef: String(current.terminalRef || ""),
      connectionRef: String(current.connectionRef || ""),
      pagePath: String(current.pagePath || asm.pagePath || ""),
      comment: String(current.comment || ""),
      updatedAt: String(current.updatedAt || "")
    };
    return component.eplan;
  }

  _setAssemblyComponentEplanFieldV1(sceneObj = {}, componentId, field, value) {
    const cmp = (Array.isArray(sceneObj.components) ? sceneObj.components : []).find((c) => String(c?.id || "") === String(componentId || ""));
    if (!cmp) {
      this._setStatus("⚠️ Bauteil für EPLAN-Feld nicht gefunden");
      return;
    }
    const eplan = this._ensureAssemblyComponentEplanV1(cmp, sceneObj);
    const key = String(field || "");
    if (!key) return;
    eplan[key] = String(value ?? "").trim();
    eplan.updatedAt = new Date().toISOString();
    this._assemblyPropsPersistScene(sceneObj, `assemblyprops:component-eplan:${key}`);
  }

  _defaultCableLineEplanV1(sceneObj = {}, cfg = {}, sourceCp = null, targetCp = null) {
    const asm = this._ensureAssemblyEplanV1(sceneObj);
    const compById = new Map((Array.isArray(sceneObj.components) ? sceneObj.components : []).map((c) => [String(c?.id || ""), c]));
    const srcCmp = sourceCp?.componentId ? compById.get(String(sourceCp.componentId)) : null;
    const dstCmp = targetCp?.componentId ? compById.get(String(targetCp.componentId)) : null;
    const srcE = srcCmp ? this._ensureAssemblyComponentEplanV1(srcCmp, sceneObj) : null;
    const dstE = dstCmp ? this._ensureAssemblyComponentEplanV1(dstCmp, sceneObj) : null;
    return {
      schema: "baustellenplaner.assemblylab.cableline.eplan.v1",
      plant: String(asm.plant || ""),
      location: String(asm.location || ""),
      functionText: String(asm.functionText || cfg.typeLabel || cfg.type || ""),
      sourceDeviceTag: String(cfg.sourceDeviceTag || srcE?.deviceTag || cfg.sourceLabel || ""),
      sourceConnection: String(cfg.sourceConnection || sourceCp?.portKey || sourceCp?.portLabel || ""),
      targetDeviceTag: String(cfg.targetDeviceTag || dstE?.deviceTag || cfg.targetLabel || ""),
      targetConnection: String(cfg.targetConnection || targetCp?.portKey || targetCp?.portLabel || ""),
      sourceTerminal: String(cfg.sourceTerminal || srcE?.terminalRef || asm.terminalStrip || ""),
      targetTerminal: String(cfg.targetTerminal || dstE?.terminalRef || ""),
      pagePath: String(cfg.pagePath || asm.pagePath || ""),
      safetyArea: String(cfg.safetyArea || asm.safetyArea || ""),
      comment: String(cfg.eplanComment || "")
    };
  }

  _addProjectAssetToAssemblyVariant(projectAssetId, slotId = null, reason = "assemblylab:add-component") {
    const assets = this._getProjectAssetsFromStore();
    const pa = assets.find((a) => String(a.id) === String(projectAssetId));
    if (!pa) {
      this._setStatus("⚠️ ProjectAsset nicht gefunden");
      return;
    }

    const slot = slotId
      ? (Array.isArray(pa.slots) ? pa.slots.find((s) => String(s.id) === String(slotId)) : null)
      : this._getAssemblyLabDefaultSlot(pa);

    this._updateAssemblyLab((lab) => {
      const tpl = lab.templates.find((t) => t.id === this._assemblyLabUi.activeTemplateId) || lab.templates[0];
      const variant = tpl.variants.find((v) => v.id === this._assemblyLabUi.activeVariantId) || tpl.variants[0];
      variant.components = Array.isArray(variant.components) ? variant.components : [];

      const idx = variant.components.length;
      const inferredRole = this._inferAssemblyComponentRoleV1(pa, slot);
      const cmpId = this._assemblyLabMakeId("cmp");
      const cmpName = String(pa.name || pa.title || pa.id || "Bauteil");
      variant.components.push({
        id: cmpId,
        name: cmpName,
        role: inferredRole,
        roleLabel: this._getAssemblyRoleLabelV1(inferredRole),
        ports: this._makeAssemblyComponentPortsV1(inferredRole, cmpId, cmpName),
        projectAssetId: String(pa.id),
        slotId: slot?.id ? String(slot.id) : null,
        importName: String(slot?.lastImportName || slot?.importName || pa.name || ""),
        x: idx * 250,
        y: 0,
        z: 0,
        rotDeg: 0,
        scale: 1,
        visible: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      variant.updatedAt = new Date().toISOString();
      tpl.updatedAt = new Date().toISOString();
    }, reason);

    this._setStatus(`Bauteil hinzugefügt: ${pa.name || pa.id}`);
    this._renderLeftPanel();
  }

  _setAssemblyComponentField(componentId, field, value) {
    this._updateAssemblyLab((lab) => {
      const tpl = lab.templates.find((t) => t.id === this._assemblyLabUi.activeTemplateId) || lab.templates[0];
      const variant = tpl.variants.find((v) => v.id === this._assemblyLabUi.activeVariantId) || tpl.variants[0];
      const cmp = (variant.components || []).find((c) => c.id === componentId);
      if (!cmp) return;
      if (["x", "y", "z", "rotDeg", "scale"].includes(field)) {
        const n = Number(value);
        cmp[field] = Number.isFinite(n) ? n : 0;
      } else {
        cmp[field] = String(value || "");
        if (field === "role") {
          cmp.roleLabel = this._getAssemblyRoleLabelV1(cmp.role);
          // Ports v1: Rollenwechsel setzt die technischen Anschlussvorlagen neu.
          // Das ist in v1 bewusst einfach; spaeter kommt ein differenzierter Port-Editor.
          cmp.ports = this._makeAssemblyComponentPortsV1(cmp.role, cmp.id, cmp.name || cmp.projectAssetId || "Bauteil");
        }
      }
      cmp.updatedAt = new Date().toISOString();
      variant.updatedAt = new Date().toISOString();
      tpl.updatedAt = new Date().toISOString();
    }, `assemblylab:component:${field}`);
  }

  _deleteAssemblyComponent(componentId) {
    this._updateAssemblyLab((lab) => {
      const tpl = lab.templates.find((t) => t.id === this._assemblyLabUi.activeTemplateId) || lab.templates[0];
      const variant = tpl.variants.find((v) => v.id === this._assemblyLabUi.activeVariantId) || tpl.variants[0];
      variant.components = (variant.components || []).filter((c) => c.id !== componentId);
      variant.updatedAt = new Date().toISOString();
      tpl.updatedAt = new Date().toISOString();
    }, "assemblylab:component:delete");
    this._renderLeftPanel();
  }

  _createAssemblyLabTemplate() {
    const label = `Master Baugruppe ${new Date().toLocaleTimeString?.() || "neu"}`;
    const id = this._assemblyLabMakeId("asm-master");
    this._updateAssemblyLab((lab) => {
      lab.templates.push({
        schema: "baustellenplaner.assemblylab.template.v1",
        id,
        name: label,
        category: "Projekt",
        variants: [{ id: "standard", name: "Standard", components: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }, "assemblylab:template:create");
    this._assemblyLabUi.activeTemplateId = id;
    this._assemblyLabUi.activeVariantId = "standard";
    this._renderLeftPanel();
  }

  _createAssemblyLabVariant() {
    const id = this._assemblyLabMakeId("var");
    this._updateAssemblyLab((lab) => {
      const tpl = lab.templates.find((t) => t.id === this._assemblyLabUi.activeTemplateId) || lab.templates[0];
      const base = tpl.variants.find((v) => v.id === this._assemblyLabUi.activeVariantId) || tpl.variants[0] || { components: [] };
      tpl.variants.push({
        id,
        name: `Variante ${tpl.variants.length + 1}`,
        components: this._normalizeAssemblyComponentsWithPortsV1(this._assemblyLabClone(base.components || [], [])),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      tpl.updatedAt = new Date().toISOString();
    }, "assemblylab:variant:create");
    this._assemblyLabUi.activeVariantId = id;
    this._renderLeftPanel();
  }

  _assemblyLabComputeBounds(components = []) {
    const visible = components.filter((c) => c && c.visible !== false);
    if (!visible.length) return { w: 600, h: 220, minX: -300, minY: -110, maxX: 300, maxY: 110 };
    const xs = visible.map((c) => Number(c.x || 0));
    const ys = visible.map((c) => Number(c.y || 0));
    const minX = Math.min(...xs) - 120;
    const maxX = Math.max(...xs) + 120;
    const minY = Math.min(...ys) - 80;
    const maxY = Math.max(...ys) + 80;
    return { w: Math.max(240, maxX - minX), h: Math.max(120, maxY - minY), minX, minY, maxX, maxY };
  }

  _insertAssemblyLabVariantIntoWorkarea() {
    const { template, variant } = this._getActiveAssemblyLabRefs();
    if (!template || !variant) return;
    const components = this._normalizeAssemblyComponentsWithPortsV1(this._assemblyLabClone(variant.components || [], []));
    const bounds = this._assemblyLabComputeBounds(components);

    const instance = {
      schema: "baustellenplaner.workarea.object.assembly.v1",
      type: "assembly.instance",
      id: this._makeUniqueSceneObjectId("asm"),
      name: "RB-NEU",
      templateId: template.id,
      templateTitle: template.name,
      variantId: variant.id,
      variantTitle: variant.name,
      x: 0,
      y: 0,
      rotDeg: 0,
      rotation: 0,
      r: Math.max(40, Math.min(320, Math.max(bounds.w, bounds.h) / 2)),
      w: bounds.w,
      h: bounds.h,
      width: bounds.w,
      height: bounds.h,
      components,
      componentRefs: components.map((c) => ({
        id: c.id,
        name: c.name,
        role: c.role || "component",
        roleLabel: this._getAssemblyRoleLabelV1(c.role || "component"),
        projectAssetId: c.projectAssetId || null,
        slotId: c.slotId || null,
        portCount: Array.isArray(c.ports) ? c.ports.length : 0
      })),
      bom: components.map((c) => ({
        id: c.id,
        label: c.name || c.projectAssetId || "Bauteil",
        qty: 1,
        uom: "Stk",
        role: c.role || "component",
        roleLabel: this._getAssemblyRoleLabelV1(c.role || "component"),
        category: this._getAssemblyRoleLabelV1(c.role || "component", "short"),
        projectAssetId: c.projectAssetId || null,
        slotId: c.slotId || null,
        portCount: Array.isArray(c.ports) ? c.ports.length : 0
      })),
      ports: this._flattenAssemblyPortsV1(components),
      cablePoints: [],
      config: {
        name: "RB-NEU",
        source: "AssemblyLab v1",
        componentCount: components.length,
        lengthMm: bounds.w,
        widthMm: bounds.h
      },
      visual: {
        shape: "assemblylab-components",
        label: "RB-NEU"
      },
      assemblyLab: {
        schema: "baustellenplaner.assemblylab.instanceRef.v1",
        templateId: template.id,
        variantId: variant.id,
        createdBy: "PATCH_assemblylab_ports_v1",
        createdAt: new Date().toISOString()
      },
      meta: {
        createdBy: "PATCH_assemblylab_ports_v1",
        createdAt: new Date().toISOString()
      }
    };

    instance.cablePoints = this._deriveAssemblyCablePointsV1(instance);
    instance.cableLines = this._deriveAssemblyCableListV1(instance);
    this._handleAssemblyInsertRequest({ object: instance, txId: this._assemblyLabMakeId("tx-assemblylab") }, "assemblylab");
  }

  _renderAssemblyLabPanel() {
    const { lab, template, variant } = this._getActiveAssemblyLabRefs();
    const box = document.createElement("div");
    box.style.padding = "10px";
    box.style.display = "flex";
    box.style.flexDirection = "column";
    box.style.gap = "10px";
    box.style.fontSize = "13px";
    box.style.paddingBottom = "calc(96px + env(safe-area-inset-bottom, 0px))";
    box.className = "wa-assemblylab-panel";

    const title = document.createElement("div");
    title.style.fontWeight = "800";
    title.className = "wa-assemblylab-panel-title";
    title.textContent = "AssemblyLab v1 – Baugruppen selber bauen";
    box.appendChild(title);

    const hint = document.createElement("div");
    hint.style.opacity = ".76";
    hint.style.fontSize = "12px";
    hint.className = "wa-assemblylab-panel-hint";
    hint.textContent = "Projekt-Assets als Bauteile hinzufügen, technische Rolle wählen, X/Y/Rotation setzen, Variante speichern und als Baugruppe einfügen.";
    box.appendChild(hint);

    const topActions = document.createElement("div");
    topActions.style.display = "flex";
    topActions.style.gap = "6px";
    topActions.style.flexWrap = "wrap";
    topActions.className = "wa-assemblylab-actions";
    topActions.appendChild(this._btn("+ Master", () => this._createAssemblyLabTemplate()));
    topActions.appendChild(this._btn("+ Variante kopieren", () => this._createAssemblyLabVariant()));
    topActions.appendChild(this._btn("↻", () => this._renderLeftPanel()));
    box.appendChild(topActions);

    const mkSelect = (labelText, value, options, onChange) => {
      const wrap = document.createElement("label");
      wrap.style.display = "flex";
      wrap.style.flexDirection = "column";
      wrap.style.gap = "4px";
      const labEl = document.createElement("span");
      labEl.style.fontSize = "12px";
      labEl.style.opacity = ".75";
      labEl.textContent = labelText;
      const sel = document.createElement("select");
      sel.style.height = "30px";
      sel.style.borderRadius = "10px";
      sel.style.border = "1px solid rgba(255,255,255,.14)";
      sel.style.background = "rgba(0,0,0,.24)";
      sel.style.color = "inherit";
      sel.style.padding = "0 8px";
      sel.className = "wa-assemblylab-select";
      for (const opt of options) {
        const o = document.createElement("option");
        o.value = opt.value;
        o.textContent = opt.label;
        if (String(opt.value) === String(value)) o.selected = true;
        sel.appendChild(o);
      }
      sel.addEventListener("change", () => onChange(sel.value));
      wrap.appendChild(labEl);
      wrap.appendChild(sel);
      return wrap;
    };

    box.appendChild(mkSelect(
      "Master-Baugruppe",
      template?.id,
      lab.templates.map((t) => ({ value: t.id, label: t.name || t.id })),
      (v) => {
        this._assemblyLabUi.activeTemplateId = v;
        const t = lab.templates.find((x) => x.id === v);
        this._assemblyLabUi.activeVariantId = t?.variants?.[0]?.id || "standard";
        this._renderLeftPanel();
      }
    ));

    box.appendChild(mkSelect(
      "Variante",
      variant?.id,
      (template?.variants || []).map((v) => ({ value: v.id, label: `${v.name || v.id} (${(v.components || []).length})` })),
      (v) => {
        this._assemblyLabUi.activeVariantId = v;
        this._renderLeftPanel();
      }
    ));

    const drop = document.createElement("div");
    drop.style.border = "1px dashed rgba(255,255,255,.28)";
    drop.style.borderRadius = "14px";
    drop.style.padding = "10px";
    drop.style.background = "rgba(255,255,255,.04)";
    drop.style.minHeight = "54px";
    drop.className = "wa-assemblylab-dropzone";
    drop.innerHTML = `<div style="font-weight:700;margin-bottom:4px;">Drop-Zone Variante</div><div style="opacity:.72;font-size:12px;">ProjectAsset hier hineinziehen oder unten auf + klicken.</div>`;
    drop.addEventListener("dragover", (ev) => { ev.preventDefault(); drop.style.background = "rgba(0,128,255,.14)"; });
    drop.addEventListener("dragleave", () => { drop.style.background = "rgba(255,255,255,.04)"; });
    drop.addEventListener("drop", (ev) => {
      ev.preventDefault();
      drop.style.background = "rgba(255,255,255,.04)";
      let payload = null;
      try { payload = JSON.parse(ev.dataTransfer?.getData("application/json") || "null"); } catch {}
      if (payload?.projectAssetId) this._addProjectAssetToAssemblyVariant(payload.projectAssetId, payload.slotId, "assemblylab:drop");
    });
    box.appendChild(drop);

    const compTitle = document.createElement("div");
    compTitle.style.fontWeight = "700";
    compTitle.textContent = `Bauteile in Variante (${(variant?.components || []).length})`;
    box.appendChild(compTitle);

    const components = Array.isArray(variant?.components) ? variant.components : [];
    if (!components.length) {
      const empty = document.createElement("div");
      empty.style.opacity = ".72";
      empty.style.fontSize = "12px";
      empty.textContent = "Noch keine Bauteile. Ziehe ein ProjectAsset in die Drop-Zone.";
      box.appendChild(empty);
    } else {
      const grid = document.createElement("div");
      grid.style.display = "grid";
      grid.style.gridTemplateColumns = "1fr 96px 58px 58px 58px 34px";
      grid.style.gap = "5px";
      grid.style.alignItems = "center";
      grid.className = "wa-assemblylab-component-grid";

      const hdr = (txt) => {
        const d = document.createElement("div");
        d.style.fontSize = "11px";
        d.style.opacity = ".68";
        d.textContent = txt;
        return d;
      };
      ["Bauteil", "Rolle", "X", "Y", "Rot", ""].forEach((h) => grid.appendChild(hdr(h)));

      const mkNum = (cmp, field) => {
        const inp = document.createElement("input");
        inp.type = "number";
        inp.step = field === "rotDeg" ? "15" : "50";
        inp.value = String(Number(cmp[field] || 0));
        inp.style.width = "100%";
        inp.style.height = "28px";
        inp.style.borderRadius = "8px";
        inp.style.border = "1px solid rgba(255,255,255,.12)";
        inp.style.background = "rgba(0,0,0,.22)";
        inp.style.color = "inherit";
        inp.style.padding = "0 6px";
        inp.addEventListener("change", () => this._setAssemblyComponentField(cmp.id, field, inp.value));
        return inp;
      };

      const mkRoleSelect = (cmp) => {
        const sel = document.createElement("select");
        sel.style.width = "100%";
        sel.style.height = "28px";
        sel.style.borderRadius = "8px";
        sel.style.border = "1px solid rgba(255,255,255,.12)";
        sel.style.background = "rgba(0,0,0,.22)";
        sel.style.color = "inherit";
        sel.style.padding = "0 4px";
        for (const role of this._getAssemblyComponentRolesV1()) {
          const opt = document.createElement("option");
          opt.value = role.value;
          opt.textContent = role.short || role.label || role.value;
          if (String(cmp.role || "component") === String(role.value)) opt.selected = true;
          sel.appendChild(opt);
        }
        sel.addEventListener("change", () => this._setAssemblyComponentField(cmp.id, "role", sel.value));
        return sel;
      };

      for (const cmp of components) {
        const name = document.createElement("div");
        name.style.overflow = "hidden";
        name.style.textOverflow = "ellipsis";
        name.style.whiteSpace = "nowrap";
        name.title = `${cmp.name || cmp.id}\n${cmp.projectAssetId || ""}:${cmp.slotId || ""}`;
        name.textContent = cmp.name || cmp.id;
        grid.appendChild(name);
        grid.appendChild(mkRoleSelect(cmp));
        grid.appendChild(mkNum(cmp, "x"));
        grid.appendChild(mkNum(cmp, "y"));
        grid.appendChild(mkNum(cmp, "rotDeg"));
        const del = this._btn("×", () => this._deleteAssemblyComponent(cmp.id));
        del.style.padding = "0";
        grid.appendChild(del);
      }
      box.appendChild(grid);
    }

    const insertActions = document.createElement("div");
    insertActions.style.display = "flex";
    insertActions.style.gap = "6px";
    insertActions.style.flexWrap = "wrap";
    insertActions.className = "wa-assemblylab-insert-actions";
    const insertBtn = this._btn("✓ Variante in Workarea einfügen", () => this._insertAssemblyLabVariantIntoWorkarea());
    insertBtn.style.background = "rgba(0,128,255,.24)";
    insertBtn.className = `${insertBtn.className || ""} wa-assemblylab-insert-btn`.trim();
    insertActions.appendChild(insertBtn);
    box.appendChild(insertActions);

    const assetTitle = document.createElement("div");
    assetTitle.style.fontWeight = "700";
    assetTitle.style.marginTop = "4px";
    assetTitle.textContent = "Projekt-Assets als Bauteile";
    box.appendChild(assetTitle);

    const assets = this._getProjectAssetsFromStore();
    if (!assets.length) {
      const emptyAssets = document.createElement("div");
      emptyAssets.style.opacity = ".72";
      emptyAssets.style.fontSize = "12px";
      emptyAssets.textContent = "Keine Projekt-Assets gefunden.";
      box.appendChild(emptyAssets);
    } else {
      const list = document.createElement("div");
      list.style.display = "flex";
      list.style.flexDirection = "column";
      list.style.gap = "6px";
      list.className = "wa-assemblylab-project-assets-list";
      for (const pa of assets) {
        const slot = this._getAssemblyLabDefaultSlot(pa);
        const row = document.createElement("div");
        row.draggable = true;
        row.style.display = "grid";
        row.style.gridTemplateColumns = "1fr auto";
        row.style.gap = "6px";
        row.style.alignItems = "center";
        row.style.padding = "7px 8px";
        row.style.borderRadius = "12px";
        row.style.border = "1px solid rgba(255,255,255,.10)";
        row.style.background = "rgba(0,0,0,.18)";
        row.addEventListener("dragstart", (ev) => {
          ev.dataTransfer?.setData("application/json", JSON.stringify({ projectAssetId: pa.id, slotId: slot?.id || null }));
          ev.dataTransfer?.setData("text/plain", String(pa.name || pa.id));
        });
        const txt = document.createElement("div");
        txt.style.overflow = "hidden";
        txt.style.textOverflow = "ellipsis";
        txt.style.whiteSpace = "nowrap";
        const txtName = document.createElement("div");
        txtName.style.fontWeight = "700";
        txtName.style.overflow = "hidden";
        txtName.style.textOverflow = "ellipsis";
        txtName.style.whiteSpace = "nowrap";
        txtName.textContent = String(pa.name || pa.id || "ProjectAsset");
        const txtSlot = document.createElement("div");
        txtSlot.style.opacity = ".65";
        txtSlot.style.fontSize = "11px";
        txtSlot.textContent = `Slot: ${String(slot?.name || slot?.id || "—")}`;
        txt.appendChild(txtName);
        txt.appendChild(txtSlot);
        row.appendChild(txt);
        row.appendChild(this._btn("+", () => this._addProjectAssetToAssemblyVariant(pa.id, slot?.id || null, "assemblylab:button")));
        list.appendChild(row);
      }
      box.appendChild(list);
    }

    return box;
  }


  _renderProjectStructurePanelV1() {
    const box = document.createElement("div");
    box.className = "wa-assemblylab-panel wa-structure-panel";
    box.style.padding = "10px";
    box.style.display = "flex";
    box.style.flexDirection = "column";
    box.style.gap = "10px";
    box.style.paddingBottom = "calc(96px + env(safe-area-inset-bottom, 0px))";

    const objects = this._getSceneObjectsLightV1();
    const title = this._makePanelCardV1("Projektstruktur", "Leichter Strukturbaum. Details werden erst beim Anklicken oder über Dialoge geladen.");
    box.appendChild(title);

    const root = document.createElement("div");
    root.className = "wa-structure-tree";
    root.style.display = "flex";
    root.style.flexDirection = "column";
    root.style.gap = "6px";

    const projectName = (() => {
      try { return this.store?.get?.("app")?.project?.name || this.store?.get?.("app")?.project?.project?.name || "Projekt"; }
      catch { return "Projekt"; }
    })();

    const projectNode = this._makePanelCardV1(`▾ ${projectName}`, `${objects.length} Objekte in der Workarea`);
    root.appendChild(projectNode);

    const groups = new Map();
    for (const obj of objects) {
      const loc = String(obj?.eplan?.location || obj?.location || obj?.ort || "+A / nicht zugeordnet");
      const fg = String(obj?.foerdergruppe || obj?.fördergruppe || obj?.eplan?.function || obj?.assembly?.group || "ohne Fördergruppe");
      const key = `${loc}||${fg}`;
      if (!groups.has(key)) groups.set(key, { loc, fg, items: [] });
      groups.get(key).items.push(obj);
    }

    if (!groups.size) {
      const empty = document.createElement("div");
      empty.style.opacity = ".75";
      empty.style.fontSize = "12px";
      empty.textContent = "Noch keine Objekte platziert.";
      root.appendChild(empty);
    }

    for (const g of groups.values()) {
      const details = document.createElement("details");
      details.open = true;
      details.className = "wa-structure-group";

      const sum = document.createElement("summary");
      sum.textContent = `${g.loc} → ${g.fg} (${g.items.length})`;
      sum.style.cursor = "pointer";
      sum.style.fontWeight = "750";
      sum.style.padding = "7px 8px";
      sum.style.border = "1px solid rgba(255,255,255,.08)";
      sum.style.borderRadius = "10px";
      sum.style.background = "rgba(255,255,255,.035)";
      details.appendChild(sum);

      const list = document.createElement("div");
      list.style.display = "flex";
      list.style.flexDirection = "column";
      list.style.gap = "5px";
      list.style.margin = "6px 0 0 10px";

      for (const obj of g.items) {
        const row = document.createElement("button");
        row.type = "button";
        row.className = "wa-structure-row";
        row.style.textAlign = "left";
        row.style.border = "1px solid rgba(255,255,255,.08)";
        row.style.borderRadius = "10px";
        row.style.padding = "8px";
        row.style.background = obj?.id === this.state?.selection?.id ? "rgba(110,168,255,.18)" : "rgba(0,0,0,.18)";
        row.style.color = "inherit";
        row.style.font = "inherit";
        row.style.cursor = "pointer";
        row.innerHTML = `<strong>${this._escapeHtml(obj?.name || obj?.importName || obj?.type || "Objekt")}</strong><br><span style="opacity:.72;font-size:12px;">${this._escapeHtml(obj?.type || "object")} · ${this._escapeHtml(obj?.id || "-")}</span>`;
        row.addEventListener("click", () => {
          this._setSelectionToObject(obj, "structure");
          this.state.rightTabId = "tab.properties";
          this._renderRightTabs();
          this._renderRightPanel();
        });
        list.appendChild(row);
      }

      details.appendChild(list);
      root.appendChild(details);
    }

    box.appendChild(root);
    return box;
  }

  _renderInsertPanelLightV1() {
    const box = document.createElement("div");
    box.className = "wa-assemblylab-panel wa-insert-panel";
    box.style.padding = "10px";
    box.style.display = "flex";
    box.style.flexDirection = "column";
    box.style.gap = "10px";
    box.style.paddingBottom = "calc(96px + env(safe-area-inset-bottom, 0px))";

    box.appendChild(this._makePanelCardV1("Einfügen", "Place-Modus: Baugruppen oder Assets auswählen, dann im Viewer platzieren."));

    const actions = document.createElement("div");
    actions.style.display = "flex";
    actions.style.gap = "8px";
    actions.style.flexWrap = "wrap";
    actions.appendChild(this._btn("Baugruppen öffnen", () => { this.state.leftTabId = "tab.assemblylab"; this._renderLeftTabs(); this._renderLeftPanel(); }));
    actions.appendChild(this._btn("Assets öffnen", () => { this.state.leftTabId = "tab.assets"; this._renderLeftTabs(); this._renderLeftPanel(); }));
    actions.appendChild(this._btn("Place-Modus", () => this._setMode("place", "insert-panel")));
    box.appendChild(actions);

    const hint = document.createElement("div");
    hint.style.fontSize = "12px";
    hint.style.opacity = ".75";
    hint.textContent = "Performance-Regel: Listen werden erst geöffnet, wenn du Baugruppen oder Assets wirklich brauchst.";
    box.appendChild(hint);
    return box;
  }

  _renderWorkareaToolsPanelLightV1() {
    const box = document.createElement("div");
    box.className = "wa-assemblylab-panel wa-tools-panel";
    box.style.padding = "10px";
    box.style.display = "flex";
    box.style.flexDirection = "column";
    box.style.gap = "10px";
    box.style.paddingBottom = "calc(96px + env(safe-area-inset-bottom, 0px))";

    box.appendChild(this._makePanelCardV1("Workarea Tools", "Diagnose und Projektwerkzeuge bleiben erreichbar, aber getrennt vom normalen Bearbeiten."));
    const row = document.createElement("div");
    row.style.display = "flex";
    row.style.gap = "8px";
    row.style.flexWrap = "wrap";
    row.appendChild(this._btn("Layout JSON", () => this._copyWorkareaLayoutDebug()));
    row.appendChild(this._btn("CrashLog", () => this._copyWorkareaCrashLog()));
    row.appendChild(this._btn("Diag ↻", () => this._refreshWorkareaLayoutDiagnostics("tools", { status: true, renderTopbar: true })));
    box.appendChild(row);
    return box;
  }

  _renderRightPanel() {
    const host = this._els.rightPanelHost;
    if (!host) return;
    host.innerHTML = "";

    const tabId = this.state.rightTabId;

    if (tabId === "tab.properties") {
      host.appendChild(this._renderPropertiesPanel());
    } else if (tabId === "tab.params") {
      host.appendChild(this._renderParamsPanel());
    } else if (tabId === "tab.bom") {
      host.appendChild(this._renderBOMPanel());
    } else if (tabId === "tab.outliner") {
      const box = document.createElement("div");
      box.style.padding = "10px";
      box.innerHTML =
        `<div style="font-weight:700;margin-bottom:6px;">Outliner (Dummy)</div>` +
        `<div style="opacity:.75;font-size:12px;">Später: Objektbaum / Gruppen</div>`;
      host.appendChild(box);
    } else {
      const box = document.createElement("div");
      box.style.padding = "10px";
      box.textContent = `Unbekannter Tab: ${tabId}`;
      host.appendChild(box);
    }
  }

  _renderBottomBar() {
    const bottom = this._els.bottom;
    if (!bottom) return;
    bottom.innerHTML = "";

    const status = document.createElement("div");
    status.style.fontSize = "12px";
    status.style.opacity = ".85";
    status.textContent = "";
    this._els.statusLine = status;

    bottom.appendChild(status);
    bottom.appendChild(this._spacer());

    bottom.appendChild(this._btn("Console", () => this._toggleConsole()));
    const lm = this._detectWorkareaLayoutMode();
    bottom.appendChild(this._pill(`Layout: ${lm.mode}`, "rgba(255,255,255,.06)"));
    bottom.appendChild(this._pill(`Mode: ${this.state.modeId}`, "rgba(255,255,255,.06)"));
  }


  /* ==========================================================================
   * BOM / Stückliste (Industrie-Fokus) – MVP
   * ==========================================================================
   * - Ermittelt eine Stückliste aus project.workspace.scene.objects
   * - Preise sind projektgebunden und werden unter project.assets.settings.bom gespeichert
   *   => stabil über Reload/Export/Safari-Neustart
   * - keys:
   *    asset.instance: "<projectAssetId>:<slotId>"
   *    sonst:         "type:<type>"
   */

  _renderBOMPanelFull() {
    const box = document.createElement("div");
    box.style.padding = "10px";
    box.style.display = "flex";
    box.style.flexDirection = "column";
    box.style.gap = "10px";

    const title = document.createElement("div");
    title.style.fontWeight = "800";
    title.textContent = "BOM / Stückliste";
    box.appendChild(title);

    const hint = document.createElement("div");
    hint.style.fontSize = "12px";
    hint.style.opacity = ".75";
    hint.textContent =
      "AssemblyLab BOM v1: Bauteile werden nach Baugruppe, Rolle, Asset/Slot und Position ausgewertet. Preise und Stammdaten bleiben projektgebunden.";
    box.appendChild(hint);

    const rows = this._computeBOMRows();
    const currency = this._getBOMCurrency();
    const groups = this._groupBOMRowsByAssemblyV1(rows);

    // Actions
    const actions = document.createElement("div");
    actions.style.display = "flex";
    actions.style.gap = "6px";
    actions.style.flexWrap = "wrap";

    actions.appendChild(
      this._btn("↻ Refresh", () => {
        this._renderRightPanel();
        this._setStatus("BOM aktualisiert");
      })
    );

    actions.appendChild(
      this._btn("Export CSV", async () => {
        try {
          const csv = this._makeBOMCSV(rows, currency);
          await this._copyToClipboard(csv);
          this._setStatus("✅ BOM CSV in Clipboard");
        } catch {
          this._setStatus("⚠️ CSV Export fehlgeschlagen (Clipboard?)");
        }
      })
    );

    actions.appendChild(
      this._btn("Export BOM JSON", async () => {
        try {
          const payload = this._makeBOMExportPayload(rows, currency);
          const txt = JSON.stringify(payload, null, 2);
          await this._copyToClipboard(txt);
          this._setStatus("✅ BOM JSON in Clipboard");
        } catch {
          this._setStatus("⚠️ Export fehlgeschlagen (Clipboard?)");
        }
      })
    );

    box.appendChild(actions);

    if (!rows.length) {
      const empty = document.createElement("div");
      empty.style.opacity = ".72";
      empty.style.fontSize = "13px";
      empty.textContent = "Noch keine Stücklistenpositionen. Füge Baugruppen oder Projekt-Assets in die Workarea ein.";
      box.appendChild(empty);
      return box;
    }

    // Kurze Übersicht je Baugruppe/Quelle.
    const summary = document.createElement("div");
    summary.style.display = "flex";
    summary.style.flexDirection = "column";
    summary.style.gap = "6px";

    const summaryTitle = document.createElement("div");
    summaryTitle.style.fontWeight = "700";
    summaryTitle.style.fontSize = "13px";
    summaryTitle.textContent = "Baugruppen-Übersicht";
    summary.appendChild(summaryTitle);

    for (const g of groups) {
      const card = document.createElement("div");
      card.style.border = "1px solid rgba(255,255,255,.10)";
      card.style.background = "rgba(0,0,0,.10)";
      card.style.borderRadius = "10px";
      card.style.padding = "8px";

      const head = document.createElement("div");
      head.style.display = "flex";
      head.style.justifyContent = "space-between";
      head.style.gap = "8px";
      head.style.alignItems = "baseline";

      const name = document.createElement("div");
      name.style.fontWeight = "700";
      name.style.fontSize = "13px";
      name.textContent = g.name || "BOM";
      head.appendChild(name);

      const count = document.createElement("div");
      count.style.fontSize = "12px";
      count.style.opacity = ".74";
      count.textContent = `${g.itemCount} Positionen · ${g.qty} Stk`;
      head.appendChild(count);
      card.appendChild(head);

      const meta = document.createElement("div");
      meta.style.fontSize = "12px";
      meta.style.opacity = ".70";
      meta.style.marginTop = "3px";
      meta.textContent = [g.conveyorGroup, g.location, g.equipmentTag].filter(Boolean).join(" · ") || "ohne Fördergruppe/Ort/BMK";
      card.appendChild(meta);

      const roles = document.createElement("div");
      roles.style.fontSize = "12px";
      roles.style.opacity = ".82";
      roles.style.marginTop = "4px";
      roles.textContent = g.roles.join(" · ") || "keine Rollen";
      card.appendChild(roles);

      summary.appendChild(card);
    }
    box.appendChild(summary);

    const listTitle = document.createElement("div");
    listTitle.style.fontWeight = "700";
    listTitle.style.fontSize = "13px";
    listTitle.textContent = "Positionen";
    box.appendChild(listTitle);

    // Mobile-freundliche Karten statt breiter Tabelle.
    const list = document.createElement("div");
    list.style.display = "flex";
    list.style.flexDirection = "column";
    list.style.gap = "8px";

    let grand = 0;

    const mkInput = (placeholder, value, width = "120px") => {
      const i = document.createElement("input");
      i.type = "text";
      i.value = String(value || "");
      i.placeholder = placeholder;
      i.style.padding = "6px 8px";
      i.style.borderRadius = "10px";
      i.style.border = "1px solid rgba(255,255,255,.14)";
      i.style.background = "rgba(0,0,0,.20)";
      i.style.color = "inherit";
      i.style.fontSize = "12px";
      i.style.minWidth = width;
      return i;
    };

    for (const row of rows) {
      const unitPrice = this._getBOMUnitPrice(row.key);
      const sku = this._getBOMSKU(row.key);
      const uom = this._getBOMUOM(row.key) || row.uom || "Stk";
      const manufacturer = this._getBOMManufacturer(row.key);
      const supplier = this._getBOMSupplier(row.key);
      const comment = this._getBOMComment(row.key);
      const qty = Number(row.qty || 0) || 0;
      const sum = (unitPrice || 0) * qty;
      grand += sum;

      const card = document.createElement("div");
      card.style.border = "1px solid rgba(255,255,255,.10)";
      card.style.background = "rgba(0,0,0,.08)";
      card.style.borderRadius = "12px";
      card.style.padding = "9px";
      card.style.display = "flex";
      card.style.flexDirection = "column";
      card.style.gap = "7px";

      const top = document.createElement("div");
      top.style.display = "grid";
      top.style.gridTemplateColumns = "minmax(0, 1fr) auto";
      top.style.gap = "8px";
      top.style.alignItems = "start";

      const labelWrap = document.createElement("div");
      labelWrap.style.minWidth = "0";

      const label = document.createElement("div");
      label.style.fontWeight = "700";
      label.style.fontSize = "13px";
      label.style.overflow = "hidden";
      label.style.textOverflow = "ellipsis";
      label.style.whiteSpace = "nowrap";
      label.title = row.label || row.key;
      label.textContent = row.label || row.key;
      labelWrap.appendChild(label);

      const meta = document.createElement("div");
      meta.style.fontSize = "12px";
      meta.style.opacity = ".68";
      meta.textContent = [row.assemblyName, row.roleLabel || row.category, row.projectAssetId ? "Projekt-Asset" : row.kind].filter(Boolean).join(" · ");
      labelWrap.appendChild(meta);
      top.appendChild(labelWrap);

      const qtyBadge = document.createElement("div");
      qtyBadge.style.fontSize = "12px";
      qtyBadge.style.fontWeight = "700";
      qtyBadge.style.textAlign = "right";
      qtyBadge.textContent = `${qty} ${uom || ""}`.trim();
      top.appendChild(qtyBadge);
      card.appendChild(top);

      const priceRow = document.createElement("div");
      priceRow.style.display = "flex";
      priceRow.style.justifyContent = "space-between";
      priceRow.style.gap = "8px";
      priceRow.style.fontSize = "12px";
      priceRow.style.opacity = ".82";
      const left = document.createElement("div");
      left.textContent = row.conveyorGroup || row.location || row.equipmentTag ? [row.conveyorGroup, row.location, row.equipmentTag].filter(Boolean).join(" · ") : "";
      const right = document.createElement("div");
      right.style.fontWeight = "700";
      right.textContent = sum ? `${sum.toFixed(2)} ${currency}` : "";
      priceRow.appendChild(left);
      priceRow.appendChild(right);
      card.appendChild(priceRow);

      const fields = document.createElement("div");
      fields.style.display = "flex";
      fields.style.flexWrap = "wrap";
      fields.style.gap = "6px";

      const skuIn = mkInput("Artikel-Nr.", sku, "95px");
      skuIn.addEventListener("change", () => {
        this._setBOMLineField(row.key, "sku", String(skuIn.value || "").trim(), "bom:sku");
        this._renderRightPanel();
      });
      fields.appendChild(skuIn);

      const priceIn = mkInput("Preis", unitPrice ? String(unitPrice) : "", "82px");
      priceIn.type = "number";
      priceIn.step = "0.01";
      priceIn.inputMode = "decimal";
      priceIn.addEventListener("change", () => {
        const v = Number(priceIn.value || 0);
        const p = Number.isFinite(v) && v > 0 ? v : 0;
        this._setBOMLineField(row.key, "unitPrice", p, "bom:price");
        this._renderRightPanel();
      });
      fields.appendChild(priceIn);

      const uomSel = document.createElement("select");
      uomSel.style.padding = "6px 8px";
      uomSel.style.borderRadius = "10px";
      uomSel.style.border = "1px solid rgba(255,255,255,.14)";
      uomSel.style.background = "rgba(0,0,0,.20)";
      uomSel.style.color = "inherit";
      uomSel.style.fontSize = "12px";
      const uomOptions = ["", "Stk", "m", "kg", "Satz"];
      for (const opt of uomOptions) {
        const oel = document.createElement("option");
        oel.value = opt;
        oel.textContent = opt ? `UOM: ${opt}` : "UOM: —";
        uomSel.appendChild(oel);
      }
      uomSel.value = String(uom || "");
      uomSel.addEventListener("change", () => {
        this._setBOMLineField(row.key, "uom", String(uomSel.value || "").trim(), "bom:uom");
        this._renderRightPanel();
      });
      fields.appendChild(uomSel);

      const manIn = mkInput("Hersteller", manufacturer, "130px");
      manIn.addEventListener("change", () => {
        this._setBOMLineField(row.key, "manufacturer", String(manIn.value || "").trim(), "bom:manufacturer");
        this._renderRightPanel();
      });
      fields.appendChild(manIn);

      const supIn = mkInput("Lieferant", supplier, "130px");
      supIn.addEventListener("change", () => {
        this._setBOMLineField(row.key, "supplier", String(supIn.value || "").trim(), "bom:supplier");
        this._renderRightPanel();
      });
      fields.appendChild(supIn);

      const comIn = mkInput("Kommentar", comment, "180px");
      comIn.style.flex = "1 1 180px";
      comIn.addEventListener("change", () => {
        this._setBOMLineField(row.key, "comment", String(comIn.value || "").trim(), "bom:comment");
        this._renderRightPanel();
      });
      fields.appendChild(comIn);

      card.appendChild(fields);
      list.appendChild(card);
    }

    box.appendChild(list);

    // Footer: total + currency
    const footer = document.createElement("div");
    footer.style.marginTop = "6px";
    footer.style.display = "flex";
    footer.style.justifyContent = "space-between";
    footer.style.alignItems = "center";
    footer.style.gap = "10px";
    footer.style.flexWrap = "wrap";

    const total = document.createElement("div");
    total.style.fontWeight = "800";
    total.textContent = `Gesamt: ${grand ? grand.toFixed(2) : "—"} ${currency}`;
    footer.appendChild(total);

    const currencyWrap = document.createElement("div");
    currencyWrap.style.display = "flex";
    currencyWrap.style.gap = "6px";
    currencyWrap.style.alignItems = "center";

    const curLbl = document.createElement("div");
    curLbl.style.fontSize = "12px";
    curLbl.style.opacity = ".75";
    curLbl.textContent = "Währung:";
    currencyWrap.appendChild(curLbl);

    const curIn = document.createElement("input");
    curIn.type = "text";
    curIn.value = String(currency || "EUR");
    curIn.style.width = "70px";
    curIn.style.padding = "6px 8px";
    curIn.style.borderRadius = "10px";
    curIn.style.border = "1px solid rgba(255,255,255,.14)";
    curIn.style.background = "rgba(0,0,0,.20)";
    curIn.style.color = "inherit";
    curIn.style.fontSize = "13px";

    curIn.addEventListener("change", () => {
      const v = String(curIn.value || "EUR").trim().toUpperCase();
      this._setBOMCurrency(v || "EUR", "bom:currency");
      this._renderRightPanel();
    });

    currencyWrap.appendChild(curIn);
    footer.appendChild(currencyWrap);
    box.appendChild(footer);

    const note = document.createElement("div");
    note.style.fontSize = "12px";
    note.style.opacity = ".70";
    note.style.marginTop = "4px";
    note.textContent =
      "Hinweis: BOM v1 nutzt Baugruppen-Bauteile und Rollen. Nächster Schritt: Ports/Anschlusspunkte und Kabelpunkte.";
    box.appendChild(note);

    return box;
  }

  _groupBOMRowsByAssemblyV1(rows = []) {
    const byKey = new Map();
    const add = (row) => {
      const k = row.assemblyId ? `asm:${row.assemblyId}` : `kind:${row.kind || row.type || "other"}`;
      const cur = byKey.get(k) || {
        key: k,
        name: row.assemblyName || (row.assemblyId ? row.assemblyId : "Sonstige Positionen"),
        conveyorGroup: row.conveyorGroup || "",
        location: row.location || "",
        equipmentTag: row.equipmentTag || "",
        itemCount: 0,
        qty: 0,
        rolesSet: new Set()
      };
      cur.itemCount += 1;
      cur.qty += Number(row.qty || 0) || 0;
      if (row.roleLabel || row.category) cur.rolesSet.add(String(row.roleLabel || row.category));
      cur.conveyorGroup = cur.conveyorGroup || row.conveyorGroup || "";
      cur.location = cur.location || row.location || "";
      cur.equipmentTag = cur.equipmentTag || row.equipmentTag || "";
      byKey.set(k, cur);
    };
    for (const row of rows || []) add(row || {});
    return Array.from(byKey.values()).map((g) => ({ ...g, roles: Array.from(g.rolesSet || []) }));
  }

  _computeBOMRows() {
    const scene = this._getSceneObjectsFromStore() || [];
    const assets = this._getProjectAssetsFromStore() || [];
    const paById = new Map(assets.map((a) => [String(a.id), a]));

    const byKey = new Map();
    const clean = (s) => String(s || "").trim();
    const safeKey = (s) => clean(s).replace(/\s+/g, "_") || "na";

    const getSlotName = (pa, slotId) => {
      if (!pa || !Array.isArray(pa.slots) || !slotId) return "";
      const s = pa.slots.find((x) => String(x?.id) === String(slotId));
      return clean(s?.name);
    };

    const makeAssetLabel = (projectAssetId, slotId, fallback = "Bauteil") => {
      const paId = clean(projectAssetId);
      const pa = paId ? paById.get(paId) : null;
      const paName = clean(pa?.name) || clean(fallback) || "Asset";
      const slotName = getSlotName(pa, slotId);
      return slotName ? `${paName} · ${slotName}` : paName;
    };

    const add = (row, qtyOverride = null) => {
      const key = clean(row.key);
      if (!key) return;
      const qty = Number(qtyOverride ?? row.qty ?? 1);
      const qtySafe = Number.isFinite(qty) && qty > 0 ? qty : 1;
      const cur = byKey.get(key) || { ...row, qty: 0 };
      cur.qty += qtySafe;
      cur.kind = cur.kind || row.kind || "bom";
      cur.type = cur.type || row.type || cur.kind;
      cur.projectAssetId = cur.projectAssetId || row.projectAssetId || null;
      cur.slotId = cur.slotId || row.slotId || null;
      cur.importName = cur.importName || row.importName || null;
      cur.label = cur.label || row.label || key;
      cur.uom = cur.uom || row.uom || "Stk";
      cur.role = cur.role || row.role || "";
      cur.roleLabel = cur.roleLabel || row.roleLabel || "";
      cur.category = cur.category || row.category || cur.roleLabel || "";
      cur.assemblyId = cur.assemblyId || row.assemblyId || null;
      cur.assemblyName = cur.assemblyName || row.assemblyName || "";
      cur.templateId = cur.templateId || row.templateId || null;
      cur.variantId = cur.variantId || row.variantId || null;
      cur.conveyorGroup = cur.conveyorGroup || row.conveyorGroup || "";
      cur.location = cur.location || row.location || "";
      cur.equipmentTag = cur.equipmentTag || row.equipmentTag || "";
      byKey.set(key, cur);
    };

    const assemblyMeta = (o) => {
      const cfg = o?.config && typeof o.config === "object" ? o.config : {};
      return {
        assemblyId: o?.id || null,
        assemblyName: clean(o?.name) || clean(cfg?.name) || clean(o?.visual?.label) || "Baugruppe",
        templateId: clean(o?.templateId) || clean(o?.assemblyLab?.templateId) || null,
        variantId: clean(o?.variantId) || clean(o?.assemblyLab?.variantId) || null,
        conveyorGroup: clean(cfg?.conveyorGroup) || clean(o?.conveyorGroup),
        location: clean(cfg?.location) || clean(cfg?.area) || clean(o?.location),
        equipmentTag: clean(cfg?.equipmentTag) || clean(o?.equipmentTag)
      };
    };

    for (const o of scene) {
      if (!o) continue;

      if (o.type === "assembly.instance") {
        const meta = assemblyMeta(o);
        const components = Array.isArray(o.components) ? o.components : [];

        if (components.length) {
          for (const c of components) {
            if (!c || c.visible === false) continue;
            const role = clean(c.role) || "component";
            const roleLabel = clean(c.roleLabel) || this._getAssemblyRoleLabelV1?.(role, "short") || role;
            const paId = clean(c.projectAssetId);
            const slotId = clean(c.slotId);
            const assetLabel = makeAssetLabel(paId, slotId, c.name || roleLabel);
            const label = `${roleLabel}: ${clean(c.name) || assetLabel}`;
            const key = `asm:${safeKey(meta.assemblyId)}:role:${safeKey(role)}:${paId ? `pa:${safeKey(paId)}:${safeKey(slotId)}` : `name:${safeKey(c.name || roleLabel)}`}`;
            add({
              key,
              kind: "assembly.component",
              type: "assembly.component",
              label,
              uom: "Stk",
              role,
              roleLabel,
              category: roleLabel,
              projectAssetId: paId || null,
              slotId: slotId || null,
              importName: clean(c.importName) || null,
              ...meta
            }, 1);
          }
          continue;
        }

        // Fallback für ältere Baugruppen, die nur bom[] und keine components[] besitzen.
        if (Array.isArray(o.bom) && o.bom.length) {
          for (const line of o.bom) {
            const role = clean(line?.role) || clean(line?.category) || "component";
            const roleLabel = clean(line?.roleLabel) || clean(line?.category) || this._getAssemblyRoleLabelV1?.(role, "short") || role;
            const code = clean(line?.code) || clean(line?.id) || clean(line?.label) || clean(line?.title) || "ASSEMBLY-BOM";
            const qtyLine = Number(line?.qty ?? 1);
            const qtySafe = Number.isFinite(qtyLine) && qtyLine > 0 ? qtyLine : 1;
            const unit = clean(line?.uom) || clean(line?.unit) || "Stk";
            const paId = clean(line?.projectAssetId);
            const slotId = clean(line?.slotId);
            const title = clean(line?.label) || clean(line?.title) || makeAssetLabel(paId, slotId, code);
            const key = `asm:${safeKey(meta.assemblyId)}:bom:${safeKey(role)}:${safeKey(code)}:${paId ? `pa:${safeKey(paId)}:${safeKey(slotId)}` : ""}`;
            add({
              key,
              kind: "assembly.bom",
              type: "assembly.bom",
              label: `${roleLabel}: ${title}`,
              uom: unit,
              role,
              roleLabel,
              category: roleLabel,
              projectAssetId: paId || null,
              slotId: slotId || null,
              importName: clean(line?.importName) || null,
              ...meta
            }, qtySafe);
          }
          continue;
        }

        add({
          key: `asm:${safeKey(meta.assemblyId)}:empty`,
          kind: "assembly.instance",
          type: "assembly.instance",
          label: meta.assemblyName,
          uom: "Stk",
          role: "assembly",
          roleLabel: "Baugruppe",
          category: "Baugruppe",
          ...meta
        }, 1);
        continue;
      }

      if (o.type === "asset.instance" && o.projectAssetId) {
        const paId = String(o.projectAssetId);
        const slotId = o.slotId ? String(o.slotId) : "";
        const key = `asset:${paId}:${slotId}`;
        add({
          key,
          kind: "asset.instance",
          type: "asset.instance",
          label: makeAssetLabel(paId, slotId, o?.importName || o?.name || "Asset"),
          uom: "Stk",
          role: "asset",
          roleLabel: "Asset",
          category: "Asset",
          projectAssetId: paId,
          slotId: slotId || null,
          importName: clean(o?.importName) || null,
        }, 1);
        continue;
      }

      const t = clean(o.type) || "unknown";
      const name = clean(o?.name);
      const importName = clean(o?.importName) || "";
      const labelParts = [t];
      if (name) labelParts.push(name);
      if (importName) labelParts.push(importName);
      add({
        key: `type:${t}`,
        kind: t,
        type: t,
        label: labelParts.join(" | "),
        uom: "Stk",
        role: t,
        roleLabel: t,
        category: t,
        projectAssetId: null,
        slotId: null,
        importName: importName || null,
      }, 1);
    }

    return Array.from(byKey.values()).sort((a, b) => {
      const ga = String(a.assemblyName || "ZZZ");
      const gb = String(b.assemblyName || "ZZZ");
      if (ga !== gb) return ga.localeCompare(gb);
      const ra = String(a.roleLabel || a.category || "");
      const rb = String(b.roleLabel || b.category || "");
      if (ra !== rb) return ra.localeCompare(rb);
      return String(a.label || "").localeCompare(String(b.label || ""));
    });
  }


  _getBOMCurrency() {
    try {
      const app = this.store?.get?.("app") || {};
      const cur = app?.project?.assets?.settings?.bom?.currency;
      return String(cur || "EUR").trim() || "EUR";
    } catch {
      return "EUR";
    }
  }

  _setBOMCurrency(currency = "EUR", reason = "bom") {
    if (!this.store?.update) return;
    const cur = String(currency || "EUR").trim().toUpperCase() || "EUR";


    this.store.update("app", (app) => {
      const next = app && typeof app === "object" ? app : {};
      next.project = next.project && typeof next.project === "object" ? next.project : {};
      next.project.assets = next.project.assets && typeof next.project.assets === "object" ? next.project.assets : {};
      next.project.assets.settings = next.project.assets.settings && typeof next.project.assets.settings === "object" ? next.project.assets.settings : {};
      next.project.assets.settings.bom = next.project.assets.settings.bom && typeof next.project.assets.settings.bom === "object" ? next.project.assets.settings.bom : {};
      next.project.assets.settings.bom.currency = cur;
      return next;
    });

    try {
      this.store.update("project", (p) => {
        const proj = p && typeof p === "object" ? p : {};
        proj.assets = proj.assets && typeof proj.assets === "object" ? proj.assets : {};
        proj.assets.settings = proj.assets.settings && typeof proj.assets.settings === "object" ? proj.assets.settings : {};
        proj.assets.settings.bom = proj.assets.settings.bom && typeof proj.assets.settings.bom === "object" ? proj.assets.settings.bom : {};
        proj.assets.settings.bom.currency = cur;
        return proj;
      });
    } catch {}

    this._requestProjectSaveDebounced(`bom:currency:${reason}`);
  }

  _getBOMLineMap() {
    /**
     * BOM v2:
     * - bom.lines: { [key]: { unitPrice, sku, uom, note } }
     * Backward-Compat:
     * - bom.prices: { [key]: number }
     */
    try {
      const app = this.store?.get?.("app") || {};
      const bom = app?.project?.assets?.settings?.bom || {};
      const lines = bom?.lines && typeof bom.lines === "object" ? bom.lines : null;
      if (lines) return lines;

      const prices = bom?.prices && typeof bom.prices === "object" ? bom.prices : {};
      const map = {};
      for (const [k, v] of Object.entries(prices)) {
        const n = Number(v);
        map[String(k)] = { unitPrice: Number.isFinite(n) ? n : 0 };
      }
      return map;
    } catch {
      return {};
    }
  }

  _getBOMUnitPrice(key) {
    const k = String(key || "").trim();
    if (!k) return 0;
    const map = this._getBOMLineMap();
    const line = map?.[k];
    const n = Number(line?.unitPrice || 0);
    return Number.isFinite(n) ? n : 0;
  }

  _getBOMSKU(key) {
    const k = String(key || "").trim();
    if (!k) return "";
    const map = this._getBOMLineMap();
    return String(map?.[k]?.sku || "").trim();
  }

  _getBOMUOM(key) {
    const k = String(key || "").trim();
    if (!k) return "";
    const map = this._getBOMLineMap();
    return String(map?.[k]?.uom || "").trim();
  }



  _getBOMManufacturer(key) {
    const k = String(key || "").trim();
    if (!k) return "";
    const map = this._getBOMLineMap();
    return String(map?.[k]?.manufacturer || "").trim();
  }

  _getBOMSupplier(key) {
    const k = String(key || "").trim();
    if (!k) return "";
    const map = this._getBOMLineMap();
    return String(map?.[k]?.supplier || "").trim();
  }

  _getBOMComment(key) {
    const k = String(key || "").trim();
    if (!k) return "";
    const map = this._getBOMLineMap();
    return String(map?.[k]?.comment || map?.[k]?.note || "").trim();
  }



  _setBOMLineField(key, field, value, reason = "bom") {
    if (!this.store?.update) return;
    const k = String(key || "").trim();
    if (!k) return;

    const f = String(field || "").trim();

    // Normalisierung
    let v = value;
    if (f === "unitPrice") {
      const n = Number(v);
      v = Number.isFinite(n) && n > 0 ? n : 0;
    } else {
      v = String(v ?? "").trim();
      if (!v) v = "";
    }

    const apply = (obj) => {
      const next = obj && typeof obj === "object" ? obj : {};
      next.project = next.project && typeof next.project === "object" ? next.project : {};
      next.project.assets = next.project.assets && typeof next.project.assets === "object" ? next.project.assets : {};
      next.project.assets.settings = next.project.assets.settings && typeof next.project.assets.settings === "object" ? next.project.assets.settings : {};
      next.project.assets.settings.bom = next.project.assets.settings.bom && typeof next.project.assets.settings.bom === "object" ? next.project.assets.settings.bom : {};
      const bom = next.project.assets.settings.bom;

      bom.lines = bom.lines && typeof bom.lines === "object" ? bom.lines : {};
      bom.lines[k] = bom.lines[k] && typeof bom.lines[k] === "object" ? bom.lines[k] : {};

      if (f === "unitPrice") {
        if (v > 0) bom.lines[k].unitPrice = v;
        else delete bom.lines[k].unitPrice;

        // Backward-Compat: bom.prices spiegeln
        bom.prices = bom.prices && typeof bom.prices === "object" ? bom.prices : {};
        if (v > 0) bom.prices[k] = v;
        else delete bom.prices[k];
      } else {
        if (v) bom.lines[k][f] = v;
        else delete bom.lines[k][f];
      }

      // Cleanup: wenn line leer -> entfernen
      const line = bom.lines[k];
      if (line && typeof line === "object" && Object.keys(line).length === 0) {
        delete bom.lines[k];
      }

      return next;
    };

    // app + project parallel halten
    this.store.update("app", (app) => apply(app));
    try {
      this.store.update("project", (p0) => {
        const proj = p0 && typeof p0 === "object" ? p0 : {};
        proj.assets = proj.assets && typeof proj.assets === "object" ? proj.assets : {};
        proj.assets.settings = proj.assets.settings && typeof proj.assets.settings === "object" ? proj.assets.settings : {};
        proj.assets.settings.bom = proj.assets.settings.bom && typeof proj.assets.settings.bom === "object" ? proj.assets.settings.bom : {};
        const bom = proj.assets.settings.bom;

        bom.lines = bom.lines && typeof bom.lines === "object" ? bom.lines : {};
        bom.lines[k] = bom.lines[k] && typeof bom.lines[k] === "object" ? bom.lines[k] : {};
        if (f === "unitPrice") {
          if (v > 0) bom.lines[k].unitPrice = v;
          else delete bom.lines[k].unitPrice;

          bom.prices = bom.prices && typeof bom.prices === "object" ? bom.prices : {};
          if (v > 0) bom.prices[k] = v;
          else delete bom.prices[k];
        } else {
          if (v) bom.lines[k][f] = v;
          else delete bom.lines[k][f];
        }
        const line = bom.lines[k];
        if (line && typeof line === "object" && Object.keys(line).length === 0) {
          delete bom.lines[k];
        }

        return proj;
      });
    } catch {}

    this._requestProjectSaveDebounced(`bom:${f}:${reason}`);
  }

  _setBOMPrice(key, price, reason = "bom") {
    // Backward-Compat: bestehender Code nutzt _setBOMPrice(...)
    const v = Number(price);
    const p = Number.isFinite(v) && v > 0 ? v : 0;
    this._setBOMLineField(key, "unitPrice", p, reason);
  }


  _makeBOMExportPayload(rows, currency) {
    const cur = String(currency || "EUR").trim().toUpperCase() || "EUR";

    const items = [];
    for (const r of rows || []) {
      const key = String(r.key || "");
      const qty = Number(r.qty || 0) || 0;
      const unitPrice = this._getBOMUnitPrice(key);
      const sku = this._getBOMSKU(key);
      const uom = this._getBOMUOM(key) || r.uom || "";
      const manufacturer = this._getBOMManufacturer(key);
      const supplier = this._getBOMSupplier(key);
      const comment = this._getBOMComment(key);

      items.push({
        key,
        label: r.label || key,
        qty,
        sku: sku || "",
        uom: uom || "",
        manufacturer: manufacturer || "",
        supplier: supplier || "",
        comment: comment || "",
        unitPrice: unitPrice || 0,
        currency: cur,
        total: (unitPrice || 0) * qty,
        kind: r.kind || "",
        type: r.type || "",
        role: r.role || "",
        roleLabel: r.roleLabel || "",
        category: r.category || "",
        assemblyId: r.assemblyId || null,
        assemblyName: r.assemblyName || "",
        templateId: r.templateId || null,
        variantId: r.variantId || null,
        conveyorGroup: r.conveyorGroup || "",
        location: r.location || "",
        equipmentTag: r.equipmentTag || "",
        projectAssetId: r.projectAssetId || null,
        slotId: r.slotId || null,
        importName: r.importName || null,
      });
    }

    const total = items.reduce((a, b) => a + (Number(b.total) || 0), 0);

    return {
      schema: "baustellenplaner.bom.assemblylab.v1",
      createdAt: new Date().toISOString(),
      currency: cur,
      total,
      groups: this._groupBOMRowsByAssemblyV1(rows).map((g) => ({
        key: g.key,
        name: g.name,
        conveyorGroup: g.conveyorGroup || "",
        location: g.location || "",
        equipmentTag: g.equipmentTag || "",
        itemCount: g.itemCount || 0,
        qty: g.qty || 0,
        roles: g.roles || []
      })),
      items,
    };
  }

  _makeBOMCSV(rows, currency) {
    const cur = String(currency || "EUR").trim().toUpperCase() || "EUR";

    const esc = (v) => {
      const s = String(v ?? "");
      if (/[";\n\r]/.test(s)) return '"' + s.replaceAll('"', '""') + '"';
      return s;
    };

    const header = [
      "assemblyName",
      "conveyorGroup",
      "location",
      "equipmentTag",
      "roleLabel",
      "label",
      "qty",
      "uom",
      "sku",
      "manufacturer",
      "supplier",
      "comment",
      "unitPrice",
      "currency",
      "total",
      "kind",
      "type",
      "assemblyId",
      "templateId",
      "variantId",
      "projectAssetId",
      "slotId",
      "importName",
      "key",
    ];

    const lines = [header.map(esc).join(";")];

    for (const r of rows || []) {
      const key = String(r.key || "");
      const qty = Number(r.qty || 0) || 0;
      const unitPrice = this._getBOMUnitPrice(key);
      const total = (unitPrice || 0) * qty;

      const row = [
        r.assemblyName || "",
        r.conveyorGroup || "",
        r.location || "",
        r.equipmentTag || "",
        r.roleLabel || r.category || "",
        r.label || key,
        qty,
        this._getBOMUOM(key) || r.uom || "",
        this._getBOMSKU(key) || "",
        this._getBOMManufacturer(key) || "",
        this._getBOMSupplier(key) || "",
        this._getBOMComment(key) || "",
        unitPrice || "",
        cur,
        total || "",
        r.kind || "",
        r.type || "",
        r.assemblyId || "",
        r.templateId || "",
        r.variantId || "",
        r.projectAssetId || "",
        r.slotId || "",
        r.importName || "",
        key,
      ];

      lines.push(row.map(esc).join(";"));
    }

    return lines.join("\n");
  }


  async _copyToClipboard(text) {
    const t = String(text || "");

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(t);
        return true;
      }
    } catch {}

    try {
      const ta = document.createElement("textarea");
      ta.value = t;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      ta.style.top = "-9999px";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * PATCH_assemblylab_cablelist_export_hotfix_v1
   * Kleine, robuste Textdatei-Download-Hilfe fuer iOS/Safari/Desktop.
   *
   * Wichtig:
   * - iOS Safari zeigt Downloads nicht immer als sichtbares Popup an.
   * - Deshalb kopieren die Export-Buttons ihre Daten weiterhin zusaetzlich
   *   in die Zwischenablage.
   * - Rueckgabewert true bedeutet: Download wurde technisch angestossen, nicht
   *   zwingend, dass das Betriebssystem eine sichtbare Meldung gezeigt hat.
   */
  _downloadTextFileV1(fileName, text, mime = "text/plain;charset=utf-8") {
    try {
      const blob = new Blob([String(text || "")], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = String(fileName || "export.txt");
      a.rel = "noopener";
      a.style.position = "fixed";
      a.style.left = "-9999px";
      a.style.top = "-9999px";
      document.body.appendChild(a);
      a.click();
      window.setTimeout(() => {
        try { URL.revokeObjectURL(url); } catch {}
        try { a.remove(); } catch {}
      }, 1500);
      return true;
    } catch {
      return false;
    }
  }


  /* ==========================================================================
   * AssemblyLab Properties v1 – Baugruppen-Instanzen bearbeiten
   * ==========================================================================
   * Ziel:
   * - Wenn eine assembly.instance in der Workarea selektiert ist, zeigt der
   *   Properties-Tab nicht nur generische Transform-Daten, sondern die konkrete
   *   Baugruppen-Info: Master, Variante, Bauteile, Fördergruppe, Ortbereich.
   * - Variantenwechsel aktualisiert die Instanz in der Szene, ohne den Master
   *   selbst zu verändern.
   * - Der aktuelle AssemblyLab-Master kann direkt im linken Baugruppen-Tab
   *   geöffnet werden.
   */

  _findAssemblyLabTemplateById(templateId) {
    const lab = this._ensureAssemblyLabState();
    const id = String(templateId || "");
    return (lab.templates || []).find((t) => String(t?.id) === id) || null;
  }

  _findAssemblyLabVariantById(template, variantId) {
    const id = String(variantId || "");
    const variants = Array.isArray(template?.variants) ? template.variants : [];
    return variants.find((v) => String(v?.id) === id) || variants[0] || null;
  }

  _assemblyLabRebuildInstanceFromVariant(sceneObj, template, variant, reason = "assemblyprops:variant") {
    if (!sceneObj || !template || !variant) return false;

    const components = this._normalizeAssemblyComponentsWithPortsV1(this._assemblyLabClone(variant.components || [], []));
    const bounds = this._assemblyLabComputeBounds(components);

    sceneObj.type = "assembly.instance";
    sceneObj.schema = sceneObj.schema || "baustellenplaner.workarea.object.assembly.v1";
    sceneObj.templateId = template.id;
    sceneObj.templateTitle = template.name;
    sceneObj.variantId = variant.id;
    sceneObj.variantTitle = variant.name;

    sceneObj.components = components;
    sceneObj.componentRefs = components.map((c) => ({
      id: c.id,
      name: c.name,
      role: c.role || "component",
      roleLabel: this._getAssemblyRoleLabelV1(c.role || "component"),
      projectAssetId: c.projectAssetId || null,
      slotId: c.slotId || null,
      portCount: Array.isArray(c.ports) ? c.ports.length : 0
    }));
    sceneObj.bom = components.map((c) => ({
      id: c.id,
      label: c.name || c.projectAssetId || "Bauteil",
      qty: 1,
      uom: "Stk",
      role: c.role || "component",
      roleLabel: this._getAssemblyRoleLabelV1(c.role || "component"),
      category: this._getAssemblyRoleLabelV1(c.role || "component", "short"),
      projectAssetId: c.projectAssetId || null,
      slotId: c.slotId || null,
      portCount: Array.isArray(c.ports) ? c.ports.length : 0
    }));

    sceneObj.ports = this._flattenAssemblyPortsV1(components);
    sceneObj.cablePoints = this._deriveAssemblyCablePointsV1(sceneObj);
    sceneObj.cableLines = this._deriveAssemblyCableListV1(sceneObj);

    sceneObj.w = bounds.w;
    sceneObj.h = bounds.h;
    sceneObj.width = bounds.w;
    sceneObj.height = bounds.h;
    sceneObj.r = Math.max(40, Math.min(320, Math.max(bounds.w, bounds.h) / 2));

    sceneObj.config = sceneObj.config && typeof sceneObj.config === "object" ? sceneObj.config : {};
    sceneObj.config.componentCount = components.length;
    sceneObj.config.lengthMm = bounds.w;
    sceneObj.config.widthMm = bounds.h;
    sceneObj.config.source = sceneObj.config.source || "AssemblyLab v1";
    sceneObj.config.name = sceneObj.name || sceneObj.config.name || "Baugruppe";

    sceneObj.visual = sceneObj.visual && typeof sceneObj.visual === "object" ? sceneObj.visual : {};
    sceneObj.visual.shape = sceneObj.visual.shape || "assemblylab-components";
    sceneObj.visual.label = sceneObj.name || sceneObj.visual.label || "Baugruppe";

    sceneObj.assemblyLab = sceneObj.assemblyLab && typeof sceneObj.assemblyLab === "object" ? sceneObj.assemblyLab : {};
    sceneObj.assemblyLab.schema = sceneObj.assemblyLab.schema || "baustellenplaner.assemblylab.instanceRef.v1";
    sceneObj.assemblyLab.templateId = template.id;
    sceneObj.assemblyLab.variantId = variant.id;
    sceneObj.assemblyLab.updatedBy = "PATCH_assemblylab_cablepoints_v1";
    sceneObj.assemblyLab.updatedAt = new Date().toISOString();

    try {
      if (this.state.selection?.id === sceneObj.id) {
        this.state.selection.type = sceneObj.type;
        this.state.selection.data = this.state.selection.data && typeof this.state.selection.data === "object" ? this.state.selection.data : {};
        this.state.selection.data.meta = this.state.selection.data.meta && typeof this.state.selection.data.meta === "object" ? this.state.selection.data.meta : {};
        this.state.selection.data.meta.name = sceneObj.name;
      }
    } catch {}

    this._persistSceneToStore(reason);
    this._requestProjectSaveDebounced(reason);
    this._crashLog?.("workarea:assemblyprops:variant-applied", {
      id: sceneObj.id,
      templateId: template.id,
      variantId: variant.id,
      components: components.length
    });
    return true;
  }

  _assemblyPropsPersistScene(sceneObj, reason = "assemblyprops") {
    if (!sceneObj) return;
    sceneObj.config = sceneObj.config && typeof sceneObj.config === "object" ? sceneObj.config : {};
    sceneObj.visual = sceneObj.visual && typeof sceneObj.visual === "object" ? sceneObj.visual : {};
    sceneObj.visual.label = sceneObj.name || sceneObj.visual.label || "Baugruppe";
    sceneObj.config.name = sceneObj.name || sceneObj.config.name || "Baugruppe";
    try {
      if (this.state.selection?.data?.meta) this.state.selection.data.meta.name = sceneObj.name;
    } catch {}
    // _persistSceneToStore() schreibt Store + löst genau EINEN direkten
    // Projekt-Save aus. Kein zweiter Save-Aufruf hier.
    this._persistSceneToStore(reason);
  }

  _renderAssemblyInstancePropertiesV1(sceneObj) {
    const box = document.createElement("div");
    box.style.border = "1px solid rgba(70,150,255,.24)";
    box.style.borderRadius = "12px";
    box.style.padding = "10px";
    box.style.background = "rgba(70,150,255,.06)";
    box.style.display = "flex";
    box.style.flexDirection = "column";
    box.style.gap = "8px";

    const title = document.createElement("div");
    title.style.fontWeight = "800";
    title.textContent = `Baugruppe – ${sceneObj.name || sceneObj.id || "ausgewählt"}`;
    box.appendChild(title);

    const sub = document.createElement("div");
    sub.style.fontSize = "12px";
    sub.style.opacity = ".75";
    const cablePointCount = Array.isArray(sceneObj.cablePoints) ? sceneObj.cablePoints.length : this._deriveAssemblyCablePointsV1(sceneObj).length;
    sub.textContent = `ID: ${sceneObj.id || "-"} · Bauteile: ${Array.isArray(sceneObj.components) ? sceneObj.components.length : 0} · BOM: ${Array.isArray(sceneObj.bom) ? sceneObj.bom.length : 0} · Ports: ${Array.isArray(sceneObj.ports) ? sceneObj.ports.length : this._flattenAssemblyPortsV1(sceneObj.components || []).length} · Kabelpunkte: ${cablePointCount}`;
    box.appendChild(sub);

    const mkRow = (label) => {
      const row = document.createElement("div");
      row.style.display = "grid";
      row.style.gridTemplateColumns = "minmax(92px, .75fr) minmax(0, 1.45fr)";
      row.style.gap = "8px";
      row.style.alignItems = "center";
      row.style.fontSize = "12px";
      const l = document.createElement("div");
      l.style.opacity = ".78";
      l.textContent = label;
      const h = document.createElement("div");
      h.style.display = "flex";
      h.style.gap = "6px";
      h.style.flexWrap = "wrap";
      h.style.alignItems = "center";
      row.appendChild(l);
      row.appendChild(h);
      return { row, host: h };
    };

    const mkInput = (value, { width = "100%", type = "text", inputMode = "text" } = {}) => {
      const el = document.createElement("input");
      el.type = type;
      el.inputMode = inputMode;
      el.value = value == null ? "" : String(value);
      el.style.height = "30px";
      el.style.width = width;
      el.style.minWidth = "92px";
      el.style.borderRadius = "8px";
      el.style.padding = "0 8px";
      el.style.border = "1px solid rgba(255,255,255,.14)";
      el.style.background = "rgba(0,0,0,.22)";
      el.style.color = "inherit";
      return el;
    };

    const mkSelect = () => {
      const el = document.createElement("select");
      el.style.height = "30px";
      el.style.maxWidth = "100%";
      el.style.minWidth = "170px";
      el.style.borderRadius = "8px";
      el.style.padding = "0 8px";
      el.style.border = "1px solid rgba(255,255,255,.14)";
      el.style.background = "rgba(0,0,0,.22)";
      el.style.color = "inherit";
      return el;
    };

    sceneObj.config = sceneObj.config && typeof sceneObj.config === "object" ? sceneObj.config : {};

    // Name / technische Beschriftung
    {
      const { row, host } = mkRow("Name");
      const inp = mkInput(sceneObj.name || "");
      inp.addEventListener("change", () => {
        sceneObj.name = String(inp.value || "").trim() || sceneObj.name || "Baugruppe";
        this._assemblyPropsPersistScene(sceneObj, "assemblyprops:name");
        this._setStatus(`Baugruppe umbenannt: ${sceneObj.name}`);
        this._renderRightPanel();
      });
      host.appendChild(inp);
      box.appendChild(row);
    }

    {
      const { row, host } = mkRow("Fördergruppe");
      const inp = mkInput(sceneObj.config.conveyorGroup || sceneObj.conveyorGroup || "");
      inp.placeholder = "z. B. FG-2000";
      inp.addEventListener("change", () => {
        sceneObj.config.conveyorGroup = String(inp.value || "").trim();
        sceneObj.conveyorGroup = sceneObj.config.conveyorGroup;
        this._assemblyPropsPersistScene(sceneObj, "assemblyprops:conveyorGroup");
        this._setStatus(`Fördergruppe: ${sceneObj.config.conveyorGroup || "-"}`);
      });
      host.appendChild(inp);
      box.appendChild(row);
    }

    {
      const { row, host } = mkRow("Ortbereich");
      const inp = mkInput(sceneObj.config.location || sceneObj.config.area || sceneObj.location || "");
      inp.placeholder = "z. B. +A";
      inp.addEventListener("change", () => {
        const v = String(inp.value || "").trim();
        sceneObj.config.location = v;
        sceneObj.config.area = v;
        sceneObj.location = v;
        this._assemblyPropsPersistScene(sceneObj, "assemblyprops:location");
        this._setStatus(`Ortbereich: ${v || "-"}`);
      });
      host.appendChild(inp);
      box.appendChild(row);
    }

    {
      const { row, host } = mkRow("BMK / Tag");
      const inp = mkInput(sceneObj.config.equipmentTag || sceneObj.equipmentTag || "");
      inp.placeholder = "z. B. -RB001";
      inp.addEventListener("change", () => {
        const v = String(inp.value || "").trim();
        sceneObj.config.equipmentTag = v;
        sceneObj.equipmentTag = v;
        this._assemblyPropsPersistScene(sceneObj, "assemblyprops:equipmentTag");
        this._setStatus(`BMK/Tag: ${v || "-"}`);
      });
      host.appendChild(inp);
      box.appendChild(row);
    }

    // PATCH_assemblylab_eplan_fields_v1: Baugruppen-EPLAN-Basisfelder
    {
      const eplan = this._ensureAssemblyEplanV1(sceneObj);
      const ebox = document.createElement("div");
      ebox.style.border = "1px solid rgba(120,180,255,.16)";
      ebox.style.borderRadius = "10px";
      ebox.style.padding = "8px";
      ebox.style.background = "rgba(120,180,255,.05)";
      ebox.style.display = "grid";
      ebox.style.gridTemplateColumns = "repeat(2, minmax(0, 1fr))";
      ebox.style.gap = "6px";

      const etitle = document.createElement("div");
      etitle.style.gridColumn = "1 / -1";
      etitle.style.fontWeight = "700";
      etitle.textContent = "EPLAN-Basisfelder";
      ebox.appendChild(etitle);

      const ehint = document.createElement("div");
      ehint.style.gridColumn = "1 / -1";
      ehint.style.fontSize = "11px";
      ehint.style.opacity = ".70";
      ehint.textContent = "Vorbereitung für BMK, Ort, Funktion, Schaltschrank, Klemmen und Sicherheitsbereich.";
      ebox.appendChild(ehint);

      const addE = (label, field, placeholder) => {
        const cell = document.createElement("label");
        cell.style.display = "flex";
        cell.style.flexDirection = "column";
        cell.style.gap = "2px";
        const l = document.createElement("span");
        l.style.fontSize = "10px";
        l.style.opacity = ".65";
        l.textContent = label;
        const inp = mkInput(eplan[field] || "");
        inp.placeholder = placeholder || "";
        inp.style.height = "28px";
        inp.style.fontSize = "12px";
        inp.addEventListener("change", () => {
          this._setAssemblyEplanFieldV1(sceneObj, field, inp.value);
          this._setStatus(`EPLAN-Feld gespeichert: ${label}`);
        });
        cell.appendChild(l);
        cell.appendChild(inp);
        ebox.appendChild(cell);
      };

      addE("Anlage", "plant", "z. B. ++RB2010");
      addE("Ort", "location", "z. B. +A");
      addE("Funktion", "functionText", "z. B. Rollenbahn 2010");
      addE("BMK", "equipmentTag", "z. B. +RB1");
      addE("Quelle/Schrank", "sourceCabinet", "z. B. +BS1");
      addE("Klemmenleiste", "terminalStrip", "z. B. -XDL2");
      addE("Safety-Bereich", "safetyArea", "z. B. Bedienpult A");
      addE("Seite/Pfad", "pagePath", "z. B. 2010/01");
      box.appendChild(ebox);
    }

    // Master / Variante
    const lab = this._ensureAssemblyLabState();
    const templates = Array.isArray(lab.templates) ? lab.templates : [];
    const curTemplateId = sceneObj.templateId || sceneObj.assemblyLab?.templateId || templates[0]?.id || "";
    const curTemplate = this._findAssemblyLabTemplateById(curTemplateId) || templates[0] || null;
    const curVariantId = sceneObj.variantId || sceneObj.assemblyLab?.variantId || curTemplate?.variants?.[0]?.id || "";
    const curVariant = this._findAssemblyLabVariantById(curTemplate, curVariantId);

    {
      const { row, host } = mkRow("Master");
      const sel = mkSelect();
      for (const t of templates) {
        if (!t) continue;
        const o = document.createElement("option");
        o.value = String(t.id || "");
        o.textContent = String(t.name || t.id || "Master");
        if (String(o.value) === String(curTemplateId)) o.selected = true;
        sel.appendChild(o);
      }
      sel.addEventListener("change", () => {
        const tpl = this._findAssemblyLabTemplateById(sel.value) || templates[0];
        const v = tpl?.variants?.[0] || null;
        if (tpl && v && this._assemblyLabRebuildInstanceFromVariant(sceneObj, tpl, v, "assemblyprops:template-change")) {
          this._setStatus(`Master gewechselt: ${tpl.name || tpl.id}`);
          this._renderRightPanel();
        }
      });
      host.appendChild(sel);
      box.appendChild(row);
    }

    {
      const { row, host } = mkRow("Variante");
      const sel = mkSelect();
      const variants = Array.isArray(curTemplate?.variants) ? curTemplate.variants : [];
      for (const v of variants) {
        if (!v) continue;
        const o = document.createElement("option");
        o.value = String(v.id || "");
        const count = Array.isArray(v.components) ? v.components.length : 0;
        o.textContent = `${v.name || v.id || "Variante"} (${count})`;
        if (String(o.value) === String(curVariantId)) o.selected = true;
        sel.appendChild(o);
      }
      sel.addEventListener("change", () => {
        const v = this._findAssemblyLabVariantById(curTemplate, sel.value);
        if (curTemplate && v && this._assemblyLabRebuildInstanceFromVariant(sceneObj, curTemplate, v, "assemblyprops:variant-change")) {
          this._setStatus(`Variante gewechselt: ${v.name || v.id}`);
          this._renderRightPanel();
        }
      });
      host.appendChild(sel);
      box.appendChild(row);
    }

    // Abmessungen/Info
    {
      const info = document.createElement("div");
      info.style.borderTop = "1px dashed rgba(255,255,255,.10)";
      info.style.paddingTop = "8px";
      info.style.fontSize = "12px";
      info.style.opacity = ".82";
      const w = Math.round(Number(sceneObj.w || sceneObj.width || sceneObj.config.lengthMm || 0));
      const h = Math.round(Number(sceneObj.h || sceneObj.height || sceneObj.config.widthMm || 0));
      info.textContent = `Master: ${curTemplate?.name || sceneObj.templateTitle || "-"} · Variante: ${curVariant?.name || sceneObj.variantTitle || "-"} · Größe: ${w} × ${h}`;
      box.appendChild(info);
    }

    // Bauteile-Liste kompakt
    const comps = Array.isArray(sceneObj.components) ? sceneObj.components : [];
    const compBox = document.createElement("div");
    compBox.style.border = "1px solid rgba(255,255,255,.08)";
    compBox.style.borderRadius = "10px";
    compBox.style.padding = "8px";
    compBox.style.background = "rgba(0,0,0,.10)";

    const ct = document.createElement("div");
    ct.style.fontWeight = "700";
    ct.style.marginBottom = "6px";
    ct.textContent = `Bauteile (${comps.length})`;
    compBox.appendChild(ct);

    if (!comps.length) {
      const empty = document.createElement("div");
      empty.style.fontSize = "12px";
      empty.style.opacity = ".7";
      empty.textContent = "Diese Instanz hat noch keine Bauteile. Im Baugruppen-Tab Projekt-Assets zur Variante hinzufügen.";
      compBox.appendChild(empty);
    } else {
      for (const c of comps.slice(0, 12)) {
        const item = document.createElement("div");
        item.style.display = "grid";
        item.style.gridTemplateColumns = "1fr auto";
        item.style.gap = "8px";
        item.style.alignItems = "center";
        item.style.padding = "5px 0";
        item.style.borderTop = "1px dashed rgba(255,255,255,.06)";

        const name = document.createElement("div");
        name.style.fontSize = "12px";
        const ports = this._normalizeAssemblyComponentPortsV1(c);
        name.innerHTML = `<strong>${this._escapeHtml(c.name || c.projectAssetId || "Bauteil")}</strong><br><span style="opacity:.65">${this._escapeHtml(this._getAssemblyRoleLabelV1(c.role || "component", "short"))} · X:${Number(c.x || 0)} Y:${Number(c.y || 0)} R:${Number(c.rotDeg || 0)}°</span><br><span style="opacity:.55">Ports: ${this._escapeHtml(this._formatAssemblyPortSummaryV1(ports, 3))}</span>`;

        const ref = document.createElement("div");
        ref.style.fontSize = "11px";
        ref.style.opacity = ".62";
        ref.style.textAlign = "right";
        ref.textContent = c.projectAssetId ? "Asset" : "intern";

        item.appendChild(name);
        item.appendChild(ref);
        compBox.appendChild(item);
      }
      if (comps.length > 12) {
        const more = document.createElement("div");
        more.style.fontSize = "12px";
        more.style.opacity = ".7";
        more.style.paddingTop = "6px";
        more.textContent = `… ${comps.length - 12} weitere Bauteile`;
        compBox.appendChild(more);
      }
    }
    box.appendChild(compBox);

    // PATCH_assemblylab_eplan_fields_v1: Komponenten-EPLAN-Felder
    if (comps.length) {
      const ceBox = document.createElement("div");
      ceBox.style.border = "1px solid rgba(160,220,255,.14)";
      ceBox.style.borderRadius = "10px";
      ceBox.style.padding = "8px";
      ceBox.style.background = "rgba(160,220,255,.045)";
      const ceTitle = document.createElement("div");
      ceTitle.style.fontWeight = "700";
      ceTitle.style.marginBottom = "4px";
      ceTitle.textContent = `EPLAN Bauteile (${comps.length})`;
      ceBox.appendChild(ceTitle);
      const ceHint = document.createElement("div");
      ceHint.style.fontSize = "11px";
      ceHint.style.opacity = ".65";
      ceHint.style.marginBottom = "6px";
      ceHint.textContent = "Gerätekennzeichen und Anschluss-/Klemmenbezüge je Bauteil. Maximal 8 sichtbar; alle bleiben in der Instanz gespeichert.";
      ceBox.appendChild(ceHint);

      const addSmallLabel = (txt) => {
        const d = document.createElement("div");
        d.style.fontSize = "10px";
        d.style.opacity = ".62";
        d.style.margin = "4px 0 2px";
        d.textContent = txt;
        return d;
      };

      for (const cmp of comps.slice(0, 8)) {
        const ce = this._ensureAssemblyComponentEplanV1(cmp, sceneObj);
        const card = document.createElement("div");
        card.style.borderTop = "1px dashed rgba(255,255,255,.08)";
        card.style.padding = "6px 0";
        const head = document.createElement("div");
        head.style.fontWeight = "700";
        head.style.fontSize = "12px";
        head.textContent = `${cmp.name || cmp.id} · ${cmp.roleLabel || this._getAssemblyRoleLabelV1(cmp.role)}`;
        card.appendChild(head);

        const grid = document.createElement("div");
        grid.style.display = "grid";
        grid.style.gridTemplateColumns = "repeat(2, minmax(0, 1fr))";
        grid.style.gap = "6px";
        const addCmpField = (label, field, placeholder) => {
          const cell = document.createElement("div");
          cell.appendChild(addSmallLabel(label));
          const inp = mkInput(ce[field] || "");
          inp.placeholder = placeholder || "";
          inp.style.height = "28px";
          inp.style.fontSize = "12px";
          inp.addEventListener("change", () => {
            this._setAssemblyComponentEplanFieldV1(sceneObj, cmp.id, field, inp.value);
            this._setStatus(`Bauteil-EPLAN gespeichert: ${label}`);
          });
          cell.appendChild(inp);
          grid.appendChild(cell);
        };
        addCmpField("Gerät/BMK", "deviceTag", "z. B. -M1");
        addCmpField("Anschluss", "connectionRef", "z. B. X1");
        addCmpField("Klemme", "terminalRef", "z. B. -X1");
        addCmpField("Funktion", "functionText", "z. B. Antrieb");
        card.appendChild(grid);
        ceBox.appendChild(card);
      }
      if (comps.length > 8) {
        const more = document.createElement("div");
        more.style.fontSize = "11px";
        more.style.opacity = ".65";
        more.textContent = `… ${comps.length - 8} weitere Bauteile später einklappbar.`;
        ceBox.appendChild(more);
      }
      box.appendChild(ceBox);
    }

    // Ports / Anschlusspunkte kompakt
    const flatPorts = Array.isArray(sceneObj.ports) && sceneObj.ports.length
      ? sceneObj.ports
      : this._flattenAssemblyPortsV1(sceneObj.components || []);
    const portBox = document.createElement("div");
    portBox.style.border = "1px solid rgba(255,255,255,.08)";
    portBox.style.borderRadius = "10px";
    portBox.style.padding = "8px";
    portBox.style.background = "rgba(0,0,0,.08)";

    const pt = document.createElement("div");
    pt.style.fontWeight = "700";
    pt.style.marginBottom = "6px";
    pt.textContent = `Ports / Anschlusspunkte (${flatPorts.length})`;
    portBox.appendChild(pt);

    if (!flatPorts.length) {
      const emptyPorts = document.createElement("div");
      emptyPorts.style.fontSize = "12px";
      emptyPorts.style.opacity = ".7";
      emptyPorts.textContent = "Noch keine Ports. Rolle am Bauteil setzen oder Variante neu laden.";
      portBox.appendChild(emptyPorts);
    } else {
      for (const p of flatPorts.slice(0, 16)) {
        const item = document.createElement("div");
        item.style.display = "grid";
        item.style.gridTemplateColumns = "minmax(0, 1fr) auto";
        item.style.gap = "8px";
        item.style.alignItems = "center";
        item.style.padding = "4px 0";
        item.style.borderTop = "1px dashed rgba(255,255,255,.06)";

        const left = document.createElement("div");
        left.style.fontSize = "12px";
        left.innerHTML = `<strong>${this._escapeHtml(p.label || p.key || "Port")}</strong><br><span style="opacity:.62">${this._escapeHtml([p.componentName, p.voltage, p.signal || p.kind, p.cableHint].filter(Boolean).join(" · "))}</span>`;

        const right = document.createElement("div");
        right.style.fontSize = "11px";
        right.style.opacity = ".68";
        right.style.textAlign = "right";
        right.textContent = p.direction || "";

        item.appendChild(left);
        item.appendChild(right);
        portBox.appendChild(item);
      }
      if (flatPorts.length > 16) {
        const morePorts = document.createElement("div");
        morePorts.style.fontSize = "12px";
        morePorts.style.opacity = ".7";
        morePorts.style.paddingTop = "6px";
        morePorts.textContent = `… ${flatPorts.length - 16} weitere Ports`;
        portBox.appendChild(morePorts);
      }
    }
    box.appendChild(portBox);

    // CablePoints / Kabelpunkte kompakt
    const cablePoints = Array.isArray(sceneObj.cablePoints) && sceneObj.cablePoints.length
      ? sceneObj.cablePoints
      : this._deriveAssemblyCablePointsV1(sceneObj);
    if (!Array.isArray(sceneObj.cablePoints) || !sceneObj.cablePoints.length) {
      sceneObj.cablePoints = cablePoints;
    }

    const cpBox = document.createElement("div");
    cpBox.style.border = "1px solid rgba(255,255,255,.08)";
    cpBox.style.borderRadius = "10px";
    cpBox.style.padding = "8px";
    cpBox.style.background = "rgba(255,180,40,.07)";

    const cpt = document.createElement("div");
    cpt.style.fontWeight = "700";
    cpt.style.marginBottom = "6px";
    cpt.textContent = `Kabelpunkte (${cablePoints.length})`;
    cpBox.appendChild(cpt);

    if (!cablePoints.length) {
      const emptyCp = document.createElement("div");
      emptyCp.style.fontSize = "12px";
      emptyCp.style.opacity = ".7";
      emptyCp.textContent = "Noch keine Kabelpunkte. Ports erzeugen oder Variante neu laden.";
      cpBox.appendChild(emptyCp);
    } else {
      const grouped = new Map();
      for (const cp of cablePoints) {
        if (!cp || cp.enabled === false) continue;
        const key = String(cp.type || "generic");
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key).push(cp);
      }

      for (const [type, items] of grouped.entries()) {
        const group = document.createElement("div");
        group.style.padding = "5px 0";
        group.style.borderTop = "1px dashed rgba(255,255,255,.06)";

        const head = document.createElement("div");
        head.style.display = "flex";
        head.style.justifyContent = "space-between";
        head.style.gap = "8px";
        head.style.fontSize = "12px";
        head.innerHTML = `<strong>${this._escapeHtml(this._getAssemblyCablePointTypeLabelV1(type))}</strong><span style="opacity:.65">${items.length} Punkt(e)</span>`;
        group.appendChild(head);

        for (const cp of items.slice(0, 5)) {
          const line = document.createElement("div");
          line.style.fontSize = "11px";
          line.style.opacity = ".72";
          line.style.paddingTop = "3px";
          const st = cp.direction === "output" ? "Quelle" : (cp.direction === "input" ? "Ziel" : "Knoten");
          line.textContent = `${st}: ${cp.componentName || "Bauteil"} · ${cp.portLabel || cp.portKey || "Port"} · ${cp.cableTypeHint || cp.cableHint || "Kabeltyp offen"}`;
          group.appendChild(line);
        }
        if (items.length > 5) {
          const more = document.createElement("div");
          more.style.fontSize = "11px";
          more.style.opacity = ".65";
          more.textContent = `… ${items.length - 5} weitere`;
          group.appendChild(more);
        }
        cpBox.appendChild(group);
      }
    }
    box.appendChild(cpBox);

    // CableList / Kabelliste kompakt aus Kabelpunkten
    const cableLines = Array.isArray(sceneObj.cableLines) && sceneObj.cableLines.length
      ? sceneObj.cableLines
      : this._deriveAssemblyCableListV1(sceneObj);
    if (!Array.isArray(sceneObj.cableLines) || !sceneObj.cableLines.length) {
      sceneObj.cableLines = cableLines;
    }

    const clBox = document.createElement("div");
    clBox.style.border = "1px solid rgba(120,220,160,.16)";
    clBox.style.borderRadius = "10px";
    clBox.style.padding = "8px";
    clBox.style.background = "rgba(80,220,140,.07)";

    const clt = document.createElement("div");
    clt.style.fontWeight = "700";
    clt.style.marginBottom = "6px";
    clt.textContent = `Kabelliste / Verbindungen (${cableLines.length})`;
    clBox.appendChild(clt);

    if (!cableLines.length) {
      const emptyCl = document.createElement("div");
      emptyCl.style.fontSize = "12px";
      emptyCl.style.opacity = ".7";
      emptyCl.textContent = "Noch keine Kabelverbindungen. Erst Ports/Kabelpunkte erzeugen.";
      clBox.appendChild(emptyCl);
    } else {
      const groupedLines = new Map();
      for (const cl of cableLines) {
        if (!cl || cl.enabled === false) continue;
        const key = String(cl.type || "generic");
        if (!groupedLines.has(key)) groupedLines.set(key, []);
        groupedLines.get(key).push(cl);
      }

      for (const [type, items] of groupedLines.entries()) {
        const group = document.createElement("div");
        group.style.padding = "5px 0";
        group.style.borderTop = "1px dashed rgba(255,255,255,.06)";

        const head = document.createElement("div");
        head.style.display = "flex";
        head.style.justifyContent = "space-between";
        head.style.gap = "8px";
        head.style.fontSize = "12px";
        head.innerHTML = `<strong>${this._escapeHtml(this._getAssemblyCableLineTypeLabelV1(type))}</strong><span style="opacity:.65">${items.length} Verbindung(en)</span>`;
        group.appendChild(head);

        for (const cl of items.slice(0, 6)) {
          const line = document.createElement("div");
          line.style.fontSize = "11px";
          line.style.opacity = ".74";
          line.style.paddingTop = "3px";
          line.textContent = `${cl.sourceLabel || "Quelle offen"} → ${cl.targetLabel || "Ziel offen"} · ${cl.cableType || cl.cableTypeHint || "Kabeltyp offen"}`;
          group.appendChild(line);
        }
        if (items.length > 6) {
          const more = document.createElement("div");
          more.style.fontSize = "11px";
          more.style.opacity = ".65";
          more.textContent = `… ${items.length - 6} weitere`;
          group.appendChild(more);
        }
        clBox.appendChild(group);
      }
    }
    box.appendChild(clBox);

    // CableList Fields v1: editierbare Baustellen-/EPLAN-Felder pro Verbindung.
    const clFieldsBox = document.createElement("div");
    clFieldsBox.style.border = "1px solid rgba(90,190,255,.16)";
    clFieldsBox.style.borderRadius = "10px";
    clFieldsBox.style.padding = "8px";
    clFieldsBox.style.background = "rgba(90,190,255,.06)";

    const clFieldsTitle = document.createElement("div");
    clFieldsTitle.style.fontWeight = "700";
    clFieldsTitle.style.marginBottom = "6px";
    clFieldsTitle.textContent = `Kabelliste Felder (${cableLines.length})`;
    clFieldsBox.appendChild(clFieldsTitle);

    const clFieldsHint = document.createElement("div");
    clFieldsHint.style.fontSize = "11px";
    clFieldsHint.style.opacity = ".70";
    clFieldsHint.style.marginBottom = "6px";
    clFieldsHint.textContent = "Kabelnummer, Quelle/Ziel, Typ, Adern/Querschnitt, Länge und Status sind projektgebunden an dieser Baugruppen-Instanz gespeichert.";
    clFieldsBox.appendChild(clFieldsHint);

    const mkMiniInput = (line, field, placeholder = "", opts = {}) => {
      const el = mkInput(line?.[field] ?? "", { width: opts.width || "100%", type: opts.type || "text", inputMode: opts.inputMode || "text" });
      el.placeholder = placeholder;
      el.style.height = opts.height || "28px";
      el.style.fontSize = "12px";
      el.addEventListener("change", () => {
        this._setAssemblyCableLineFieldV1(sceneObj, line.id, field, el.value);
        this._setStatus(`Kabelliste gespeichert: ${field}`);
      });
      return el;
    };

    const mkMiniLabel = (txt) => {
      const lab = document.createElement("div");
      lab.style.fontSize = "10px";
      lab.style.opacity = ".62";
      lab.style.margin = "4px 0 2px";
      lab.textContent = txt;
      return lab;
    };

    const statusOptions = this._getAssemblyCableLineStatusOptionsV1();
    for (const cl of cableLines.filter((x) => x && x.enabled !== false).slice(0, 12)) {
      const card = document.createElement("div");
      card.style.borderTop = "1px dashed rgba(255,255,255,.08)";
      card.style.padding = "7px 0";

      const head = document.createElement("div");
      head.style.display = "flex";
      head.style.justifyContent = "space-between";
      head.style.gap = "8px";
      head.style.alignItems = "baseline";
      const h1 = document.createElement("strong");
      h1.style.fontSize = "12px";
      h1.textContent = `${this._getAssemblyCableLineTypeLabelV1(cl.type)}${cl.cableNo ? ` · ${cl.cableNo}` : ""}`;
      const h2 = document.createElement("span");
      h2.style.fontSize = "11px";
      h2.style.opacity = ".65";
      h2.textContent = this._getAssemblyCableLineStatusLabelV1(cl.status);
      head.appendChild(h1);
      head.appendChild(h2);
      card.appendChild(head);

      card.appendChild(mkMiniLabel("Kabelnummer"));
      card.appendChild(mkMiniInput(cl, "cableNo", "z. B. W-2001"));

      card.appendChild(mkMiniLabel("Quelle"));
      card.appendChild(mkMiniInput(cl, "sourceLabel", "Quelle"));

      card.appendChild(mkMiniLabel("Ziel"));
      card.appendChild(mkMiniInput(cl, "targetLabel", "Ziel"));

      const eplanMini = document.createElement("div");
      eplanMini.style.display = "grid";
      eplanMini.style.gridTemplateColumns = "repeat(2, minmax(0, 1fr))";
      eplanMini.style.gap = "6px";
      eplanMini.style.marginTop = "4px";

      const addCableEplanCell = (label, field, placeholder) => {
        const cell = document.createElement("div");
        cell.appendChild(mkMiniLabel(label));
        cell.appendChild(mkMiniInput(cl, field, placeholder));
        eplanMini.appendChild(cell);
      };
      addCableEplanCell("Quelle BMK", "sourceDeviceTag", "z. B. +BS1-XDL2");
      addCableEplanCell("Quelle Anschluss", "sourceConnection", "z. B. X1:1");
      addCableEplanCell("Ziel BMK", "targetDeviceTag", "z. B. ++RB2010-MM1");
      addCableEplanCell("Ziel Anschluss", "targetConnection", "z. B. X1:1");
      addCableEplanCell("Klemme", "terminalRef", "z. B. -XDL2");
      addCableEplanCell("Seite/Pfad", "eplanPage", "z. B. 2010/01");
      card.appendChild(eplanMini);

      const grid = document.createElement("div");
      grid.style.display = "grid";
      grid.style.gridTemplateColumns = "repeat(2, minmax(0, 1fr))";
      grid.style.gap = "6px";

      const cellType = document.createElement("div");
      cellType.appendChild(mkMiniLabel("Kabeltyp"));
      cellType.appendChild(mkMiniInput(cl, "cableType", cl.cableTypeHint || "z. B. 5G2,5"));
      grid.appendChild(cellType);

      const cellWires = document.createElement("div");
      cellWires.appendChild(mkMiniLabel("Adern"));
      cellWires.appendChild(mkMiniInput(cl, "wires", "z. B. 5G"));
      grid.appendChild(cellWires);

      const cellCross = document.createElement("div");
      cellCross.appendChild(mkMiniLabel("Querschnitt"));
      cellCross.appendChild(mkMiniInput(cl, "crossSection", "z. B. 2,5 mm²"));
      grid.appendChild(cellCross);

      const cellLen = document.createElement("div");
      cellLen.appendChild(mkMiniLabel("Länge m"));
      cellLen.appendChild(mkMiniInput(cl, "lengthM", "0", { inputMode: "decimal" }));
      grid.appendChild(cellLen);

      clFieldsBox.appendChild(card);
      clFieldsBox.appendChild(grid);

      const routeAndStatus = document.createElement("div");
      routeAndStatus.style.display = "grid";
      routeAndStatus.style.gridTemplateColumns = "minmax(0, 1.2fr) minmax(120px, .8fr)";
      routeAndStatus.style.gap = "6px";
      routeAndStatus.style.marginTop = "4px";

      const routeCell = document.createElement("div");
      routeCell.appendChild(mkMiniLabel("Trasse / Bereich"));
      routeCell.appendChild(mkMiniInput(cl, "route", "z. B. +A / Rinne 200"));
      routeAndStatus.appendChild(routeCell);

      const statusCell = document.createElement("div");
      statusCell.appendChild(mkMiniLabel("Status"));
      const statusSel = mkSelect();
      statusSel.style.minWidth = "120px";
      statusSel.style.width = "100%";
      statusSel.style.height = "28px";
      for (const opt of statusOptions) {
        const o = document.createElement("option");
        o.value = opt.value;
        o.textContent = opt.label;
        if (String(cl.status || "planned") === opt.value) o.selected = true;
        statusSel.appendChild(o);
      }
      statusSel.addEventListener("change", () => {
        this._setAssemblyCableLineFieldV1(sceneObj, cl.id, "status", statusSel.value);
        this._setStatus(`Kabelliste Status: ${this._getAssemblyCableLineStatusLabelV1(statusSel.value)}`);
        this._renderRightPanel();
      });
      statusCell.appendChild(statusSel);
      routeAndStatus.appendChild(statusCell);
      clFieldsBox.appendChild(routeAndStatus);

      card.appendChild(mkMiniLabel("Bemerkung"));
      card.appendChild(mkMiniInput(cl, "comment", "Bemerkung"));
    }

    if (cableLines.filter((x) => x && x.enabled !== false).length > 12) {
      const more = document.createElement("div");
      more.style.fontSize = "11px";
      more.style.opacity = ".65";
      more.style.paddingTop = "6px";
      more.textContent = `… weitere ${cableLines.filter((x) => x && x.enabled !== false).length - 12} Kabelzeilen werden im nächsten Ausbau einklappbar/seitig bearbeitet.`;
      clFieldsBox.appendChild(more);
    }

    box.appendChild(clFieldsBox);

    const actions = document.createElement("div");
    actions.style.display = "flex";
    actions.style.gap = "6px";
    actions.style.flexWrap = "wrap";

    actions.appendChild(this._btn("↻ Kabelpunkte neu", () => {
      sceneObj.ports = Array.isArray(sceneObj.ports) && sceneObj.ports.length ? sceneObj.ports : this._flattenAssemblyPortsV1(sceneObj.components || []);
      sceneObj.cablePoints = this._deriveAssemblyCablePointsV1(sceneObj);
      sceneObj.cableLines = this._deriveAssemblyCableListV1(sceneObj);
      this._assemblyPropsPersistScene(sceneObj, "assemblyprops:cablepoints-refresh");
      this._setStatus(`Kabelpunkte neu erzeugt: ${sceneObj.cablePoints.length}, Kabelliste: ${sceneObj.cableLines.length}`);
      this._renderRightPanel();
    }));

    actions.appendChild(this._btn("↻ Kabelliste neu", () => {
      sceneObj.ports = Array.isArray(sceneObj.ports) && sceneObj.ports.length ? sceneObj.ports : this._flattenAssemblyPortsV1(sceneObj.components || []);
      sceneObj.cablePoints = Array.isArray(sceneObj.cablePoints) && sceneObj.cablePoints.length ? sceneObj.cablePoints : this._deriveAssemblyCablePointsV1(sceneObj);
      sceneObj.cableLines = this._deriveAssemblyCableListV1(sceneObj);
      this._assemblyPropsPersistScene(sceneObj, "assemblyprops:cablelist-refresh");
      this._setStatus(`Kabelliste neu erzeugt: ${sceneObj.cableLines.length}`);
      this._renderRightPanel();
    }));

    actions.appendChild(this._btn("Export Kabelliste JSON", async () => {
      try {
        const payload = {
          schema: "baustellenplaner.assemblylab.cablelist.export.v1",
          exportedAt: new Date().toISOString(),
          assembly: {
            id: sceneObj.id || "",
            name: sceneObj.name || sceneObj.config?.name || "Baugruppe",
            templateId: sceneObj.templateId || sceneObj.assemblyLab?.templateId || "",
            variantId: sceneObj.variantId || sceneObj.assemblyLab?.variantId || "",
            conveyorGroup: sceneObj.config?.conveyorGroup || "",
            location: sceneObj.config?.location || "",
            equipmentTag: sceneObj.config?.equipmentTag || "",
            eplan: sceneObj.eplan || this._ensureAssemblyEplanV1(sceneObj)
          },
          components: (sceneObj.components || []).map((c) => ({
            id: c.id,
            name: c.name,
            role: c.role,
            roleLabel: c.roleLabel,
            projectAssetId: c.projectAssetId || null,
            slotId: c.slotId || null,
            eplan: c.eplan || this._ensureAssemblyComponentEplanV1(c, sceneObj)
          })),
          cablePoints: sceneObj.cablePoints || [],
          cableLines: sceneObj.cableLines || []
        };

        const txt = JSON.stringify(payload, null, 2);
        const safeName = String(payload.assembly.name || payload.assembly.id || "baugruppe")
          .replace(/[^a-z0-9_-]+/gi, "_")
          .replace(/^_+|_+$/g, "")
          .slice(0, 48) || "baugruppe";
        const fileName = `kabelliste_${safeName}_${new Date().toISOString().slice(0, 10)}.json`;

        const downloaded = this._downloadTextFileV1(fileName, txt, "application/json;charset=utf-8");
        const copied = await this._copyToClipboard(txt);

        if (downloaded && copied) {
          this._setStatus("✅ Kabelliste JSON exportiert + in Clipboard");
        } else if (downloaded) {
          this._setStatus("✅ Kabelliste JSON Export gestartet");
        } else if (copied) {
          this._setStatus("✅ Kabelliste JSON in Clipboard (Download blockiert?)");
        } else {
          this._setStatus("⚠️ Kabelliste Export fehlgeschlagen");
        }
      } catch (err) {
        this._setStatus(`⚠️ Kabelliste Export fehlgeschlagen: ${err?.message || "unbekannt"}`);
      }
    }));

    actions.appendChild(this._btn("Im Baugruppen-Tab öffnen", () => {
      if (curTemplate) {
        this._assemblyLabUi.activeTemplateId = curTemplate.id;
        this._assemblyLabUi.activeVariantId = curVariant?.id || curTemplate.variants?.[0]?.id || "standard";
      }
      this.state.leftTabId = "tab.assemblylab";
      this._persistWorkareaUiToStore("assemblyprops:open-assemblylab");
      this._renderLeftTabs();
      this._renderLeftPanel();
      this._setStatus("Baugruppe im AssemblyLab geöffnet");
    }));

    actions.appendChild(this._btn("↻ Variante neu laden", () => {
      if (curTemplate && curVariant && this._assemblyLabRebuildInstanceFromVariant(sceneObj, curTemplate, curVariant, "assemblyprops:reload-variant")) {
        this._setStatus("Variante neu auf Instanz angewendet");
        this._renderRightPanel();
      }
    }));

    box.appendChild(actions);
    return box;
  }

  _renderPropertiesPanel() {
    const box = document.createElement("div");
    box.className = "wa-properties-light";
    box.style.padding = "10px";
    box.style.display = "flex";
    box.style.flexDirection = "column";
    box.style.gap = "10px";

    const modeCfg = this._getModeUiConfigV1();
    const sum = this._getSelectionSummaryV1();

    box.appendChild(this._makePanelCardV1(`Properties · ${modeCfg.label || this.state.modeId}`, modeCfg.hint || "Leichte Kurzansicht."));

    const card = this._makePanelCardV1(String(sum.name || "Auswahl"), `Typ: ${sum.type} · ID: ${sum.id}`);
    const meta = document.createElement("div");
    meta.className = "wa-light-meta";
    meta.style.display = "grid";
    meta.style.gridTemplateColumns = "auto 1fr";
    meta.style.gap = "4px 10px";
    meta.style.marginTop = "8px";
    meta.style.fontSize = "12px";
    meta.innerHTML = `
      <span style="opacity:.65">Ort</span><span>${this._escapeHtml(sum.loc)}</span>
      <span style="opacity:.65">Fördergruppe</span><span>${this._escapeHtml(sum.fg)}</span>
      <span style="opacity:.65">Objekte</span><span>${this._getSceneObjectsLightV1().length}</span>`;
    card.appendChild(meta);
    box.appendChild(card);

    const actions = document.createElement("div");
    actions.className = "wa-light-actions";
    actions.style.display = "flex";
    actions.style.gap = "8px";
    actions.style.flexWrap = "wrap";

    if (sum.sceneObj) {
      actions.appendChild(this._btn("Transform", () => this._openWorkareaModalV1("Transform / Basisdaten", () => this._renderTransformDialogV1(sum.sceneObj), { wide: false })));
      actions.appendChild(this._btn("Voll-Editor", () => this._openWorkareaModalV1("Voll-Editor", () => this._renderPropertiesPanelFull(), { wide: true })));
      actions.appendChild(this._btn("Elektrik", () => this._openWorkareaModalV1("Elektrik / Kabel / EPLAN", () => this._renderElectricalDialogLightV1(sum.sceneObj), { wide: true })));
      actions.appendChild(this._btn("BOM", () => this._openWorkareaModalV1("BOM / Stückliste", () => this._renderBOMPanelFull(), { wide: true })));
      actions.appendChild(this._btn("Params", () => this._openWorkareaModalV1("Parameter", () => this._renderParamsPanelFull(), { wide: true })));
    } else if (sum.sel?.type === "projectAsset") {
      actions.appendChild(this._btn("Place", () => this._setMode("place", "properties:place")));
      actions.appendChild(this._btn("Asset-Details", () => this._openWorkareaModalV1("Asset Details", () => this._renderPropertiesPanelFull(), { wide: true })));
    } else {
      actions.appendChild(this._btn("Struktur", () => { this.state.leftTabId = "tab.structure"; this._renderLeftTabs(); this._renderLeftPanel(); }));
      actions.appendChild(this._btn("Einfügen", () => { this.state.leftTabId = "tab.insert"; this._renderLeftTabs(); this._renderLeftPanel(); }));
    }

    box.appendChild(actions);

    const note = document.createElement("div");
    note.style.fontSize = "12px";
    note.style.opacity = ".68";
    note.style.lineHeight = "1.35";
    note.textContent = "Nur diese Kurzkarte wird live gerendert. Schwere Tabellen, Kabel-/BOM-/Param-Editoren werden erst nach Button-Klick aufgebaut.";
    box.appendChild(note);
    return box;
  }

  _renderTransformDialogV1(sceneObj) {
    const box = document.createElement("div");
    box.style.display = "flex";
    box.style.flexDirection = "column";
    box.style.gap = "10px";
    box.appendChild(this._makePanelCardV1(sceneObj?.name || sceneObj?.importName || "Objekt", "Schnelle Basisbearbeitung ohne alle Detailgruppen zu laden."));

    const mkInput = (label, key, fallback = 0) => {
      const row = document.createElement("label");
      row.style.display = "grid";
      row.style.gridTemplateColumns = "110px 1fr";
      row.style.alignItems = "center";
      row.style.gap = "10px";
      row.style.fontSize = "13px";
      const span = document.createElement("span");
      span.textContent = label;
      span.style.opacity = ".75";
      const input = document.createElement("input");
      input.type = "number";
      input.value = String(Number.isFinite(Number(sceneObj?.[key])) ? Number(sceneObj[key]) : fallback);
      input.className = "wa-input";
      input.addEventListener("change", () => {
        const v = Number(input.value);
        if (!Number.isFinite(v)) return;
        sceneObj[key] = v;
        this._persistSceneToStore(`dialog:${key}`);
        this._requestProjectSaveDebounced(`dialog:${key}`);
        this._resizeViewportCanvas?.();
      });
      row.appendChild(span);
      row.appendChild(input);
      return row;
    };

    box.appendChild(mkInput("X", "x", 0));
    box.appendChild(mkInput("Y", "y", 0));
    box.appendChild(mkInput("Rotation °", "rotDeg", 0));

    const actions = document.createElement("div");
    actions.style.display = "flex";
    actions.style.gap = "8px";
    actions.style.flexWrap = "wrap";
    actions.appendChild(this._btn("Duplizieren", () => this._duplicateSceneObjectById?.(sceneObj.id, "dialog:duplicate")));
    actions.appendChild(this._btn("Löschen", () => this._deleteSceneObjectById?.(sceneObj.id, "dialog:delete")));
    box.appendChild(actions);
    return box;
  }

  _renderElectricalDialogLightV1(sceneObj) {
    const box = document.createElement("div");
    box.style.display = "flex";
    box.style.flexDirection = "column";
    box.style.gap = "10px";
    box.appendChild(this._makePanelCardV1("Elektrik / Kabel / EPLAN", "Dieser Bereich ist bewusst als Dialog ausgelagert. In v1 werden die vorhandenen Daten leicht zusammengefasst; die tiefen Editorfelder bleiben im Voll-Editor."));

    const ports = Array.isArray(sceneObj?.ports) ? sceneObj.ports : [];
    const cps = Array.isArray(sceneObj?.cablePoints) ? sceneObj.cablePoints : [];
    const rows = [
      ["BMK", sceneObj?.bmk || sceneObj?.eplan?.bmk || "-"],
      ["Ort", sceneObj?.location || sceneObj?.eplan?.location || "-"],
      ["Funktion", sceneObj?.eplan?.function || sceneObj?.foerdergruppe || "-"],
      ["Ports", String(ports.length)],
      ["Kabelpunkte", String(cps.length)]
    ];
    const table = document.createElement("div");
    table.style.display = "grid";
    table.style.gridTemplateColumns = "120px 1fr";
    table.style.gap = "6px 10px";
    table.style.fontSize = "13px";
    for (const [k, v] of rows) {
      const a = document.createElement("div"); a.style.opacity = ".65"; a.textContent = k;
      const b = document.createElement("div"); b.textContent = String(v ?? "-");
      table.appendChild(a); table.appendChild(b);
    }
    box.appendChild(table);

    const actions = document.createElement("div");
    actions.style.display = "flex";
    actions.style.gap = "8px";
    actions.style.flexWrap = "wrap";
    actions.appendChild(this._btn("Voll-Editor öffnen", () => this._openWorkareaModalV1("Voll-Editor", () => this._renderPropertiesPanelFull(), { wide: true })));
    actions.appendChild(this._btn("Refresh", () => this._renderRightPanel()));
    box.appendChild(actions);
    return box;
  }

  _renderBOMPanel() {
    const box = document.createElement("div");
    box.style.padding = "10px";
    box.style.display = "flex";
    box.style.flexDirection = "column";
    box.style.gap = "10px";
    box.appendChild(this._makePanelCardV1("BOM / Stückliste", "Die Stückliste wird nicht mehr permanent im Dock berechnet. Öffne sie nur bei Bedarf."));
    box.appendChild(this._btn("BOM-Fenster öffnen", () => this._openWorkareaModalV1("BOM / Stückliste", () => this._renderBOMPanelFull(), { wide: true })));
    return box;
  }

  _renderParamsPanel() {
    const box = document.createElement("div");
    box.style.padding = "10px";
    box.style.display = "flex";
    box.style.flexDirection = "column";
    box.style.gap = "10px";
    box.appendChild(this._makePanelCardV1("Parameter", "ParamPacks werden nur im Dialog aufgebaut, damit Scrollen und Moduswechsel leicht bleiben."));
    box.appendChild(this._btn("Parameter-Fenster öffnen", () => this._openWorkareaModalV1("Parameter", () => this._renderParamsPanelFull(), { wide: true })));
    return box;
  }

  _renderPropertiesPanelFull() {
    const box = document.createElement("div");
    box.style.padding = "10px";
    box.style.display = "flex";
    box.style.flexDirection = "column";
    box.style.gap = "10px";

    const sel = this.state.selection || this._makeDummySelection("project");
    const schema = this._getPropsSchemaForType(sel.type);

    const title = document.createElement("div");
    title.style.fontWeight = "700";
    title.textContent = schema?.title ? `Properties – ${schema.title}` : `Properties – ${sel.type}`;
    box.appendChild(title);

    const hint = document.createElement("div");
    hint.style.fontSize = "12px";
    hint.style.opacity = ".75";
    hint.textContent =
      "Properties: Auswahl bearbeiten. Bei Baugruppen werden Master, Variante, Bauteile und technische Felder direkt an der Workarea-Instanz angezeigt.";
    box.appendChild(hint);

    // -------------------------------------------------------------------
    // Step 5B: Wenn ein ProjectAsset selektiert ist, zeigen wir eine kleine
    // "Place"-Sektion (Slot-Auswahl + Hinweis).
    // -------------------------------------------------------------------
    if (sel?.type === "projectAsset") {
      const pa = sel?.data?.projectAsset;
      const slots = Array.isArray(pa?.slots) ? pa.slots : [];

      const placeBox = document.createElement("div");
      placeBox.style.border = "1px solid rgba(255,255,255,.10)";
      placeBox.style.borderRadius = "10px";
      placeBox.style.padding = "8px";
      placeBox.style.background = "rgba(255,255,255,.04)";

      const t = document.createElement("div");
      t.style.fontWeight = "700";
      t.style.marginBottom = "6px";
      t.textContent = "Place (Step 5B)";
      placeBox.appendChild(t);

      const info = document.createElement("div");
      info.style.fontSize = "12px";
      info.style.opacity = ".8";
      info.style.marginBottom = "8px";
      info.textContent = "Im Place-Mode: Tap im Viewport platziert eine Instanz (snap optional).";
      placeBox.appendChild(info);

      const row = document.createElement("div");
      row.style.display = "flex";
      row.style.gap = "8px";
      row.style.alignItems = "center";
      row.style.flexWrap = "wrap";

      const lab = document.createElement("div");
      lab.textContent = "Slot";
      lab.style.fontSize = "12px";
      lab.style.opacity = ".75";

      const slotSel = document.createElement("select");
      slotSel.style.height = "28px";
      slotSel.style.borderRadius = "8px";
      slotSel.style.padding = "0 8px";
      slotSel.style.border = "1px solid rgba(255,255,255,.12)";
      slotSel.style.background = "rgba(0,0,0,.25)";
      slotSel.style.color = "inherit";

      // Fallback: wenn keine Slots existieren, bleibt Select leer.
      const curSlotId = this.state?.placeCtx?.slotId || sel?.data?.place?.slotId || null;
      for (const s of slots) {
        const o = document.createElement("option");
        o.value = s.id;
        const has = this._slotHasModel(s);
        o.textContent = `${s.name || s.id}${has ? " (hat Model)" : " (leer)"}`;
        if (String(s.id) === String(curSlotId)) o.selected = true;
        slotSel.appendChild(o);
      }

      slotSel.addEventListener("change", () => {
        const id = String(slotSel.value || "") || null;
        this.state.placeCtx.projectAssetId = pa?.id || null;
        this.state.placeCtx.slotId = id;
        try {
          if (this.state.selection?.data?.place) this.state.selection.data.place.slotId = id;
        } catch {}
        this._persistWorkareaUiToStore("slot");
        this._setStatus(`Slot gewählt: ${id || "-"}`);
      });

      row.appendChild(lab);
      row.appendChild(slotSel);
      row.appendChild(this._btn("→ Place-Mode", () => this._setMode("place", "props")));
      placeBox.appendChild(row);

      box.appendChild(placeBox);
    }

    // -------------------------------------------------------------------
    // Step 6A (NEU): Transform-UI für selektierte Scene-Objekte
    // Ziel:
    //  - Rotation in Grad anzeigen + direkt editierbar (Tippen → Zahl eingeben)
    //  - Quick Buttons (-90 / +90 / 0)
    //  - Axis Space Toggle (Welt / Objekt) als Grundlage für spätere Gizmos
    //  - Löschen (Delete) als erste echte Edit-Aktion
    //
    // WICHTIG:
    //  - r bleibt Hit-Radius/Größe
    //  - rotDeg ist Rotation (persistiert in Scene)
    // -------------------------------------------------------------------
    const isPointSel = sel?.type === "selection.point";
    const isAssetSel = sel?.type === "projectAsset";
    const sceneObj = !isPointSel && !isAssetSel ? this._findSceneObjectById(sel?.id) : null;

    if (sceneObj?.type === "assembly.instance") {
      box.appendChild(this._renderAssemblyInstancePropertiesV1(sceneObj));
    }

    if (sceneObj) {
      const tbox = document.createElement("div");
      tbox.style.border = "1px solid rgba(255,255,255,.10)";
      tbox.style.borderRadius = "10px";
      tbox.style.padding = "8px";
      tbox.style.background = "rgba(255,255,255,.04)";

      const tt = document.createElement("div");
      tt.style.fontWeight = "700";
      tt.style.marginBottom = "6px";
      tt.textContent = "Transform (Step 6A)";
      tbox.appendChild(tt);

      // Axis Space (UI-State)
      const axisRow = document.createElement("div");
      axisRow.style.display = "flex";
      axisRow.style.alignItems = "center";
      axisRow.style.gap = "8px";
      axisRow.style.flexWrap = "wrap";

      const axisLab = document.createElement("div");
      axisLab.style.fontSize = "12px";
      axisLab.style.opacity = ".75";
      axisLab.textContent = "Achsen";

      const getAxisSpace = () => {
        try {
          const app = this.store?.get?.("app") || {};
          const v = app?.settings?.ui?.workarea?.transformUi?.axisSpace;
          return v === "object" ? "object" : "world";
        } catch {
          return "world";
        }
      };

      const setAxisSpace = (space) => {
        const s = space === "object" ? "object" : "world";
        try {
          this.store?.update?.("app", (app) => {
            const next = app && typeof app === "object" ? app : {};
            next.settings = next.settings && typeof next.settings === "object" ? next.settings : {};
            next.settings.ui = next.settings.ui && typeof next.settings.ui === "object" ? next.settings.ui : {};
            next.settings.ui.workarea = next.settings.ui.workarea && typeof next.settings.ui.workarea === "object" ? next.settings.ui.workarea : {};
            next.settings.ui.workarea.transformUi =
              next.settings.ui.workarea.transformUi && typeof next.settings.ui.workarea.transformUi === "object"
                ? next.settings.ui.workarea.transformUi
                : {};
            next.settings.ui.workarea.transformUi.axisSpace = s;
            next.settings.ui.workarea.updatedAt = new Date().toISOString();
            return next;
          });
        } catch {}
        this._setStatus(`Achsen: ${s === "object" ? "Objekt" : "Welt"}`);
      };

      const axisWorld = this._btn("Welt", () => {
        setAxisSpace("world");
        this._renderRightPanel();
      });
      const axisObj = this._btn("Objekt", () => {
        setAxisSpace("object");
        this._renderRightPanel();
      });

      const curAxis = getAxisSpace();
      axisWorld.style.background = curAxis === "world" ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.20)";
      axisObj.style.background = curAxis === "object" ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.20)";

      axisRow.appendChild(axisLab);
      axisRow.appendChild(axisWorld);
      axisRow.appendChild(axisObj);
      tbox.appendChild(axisRow);

      // Position Input (Cybermotion Level 1)
      // - X/Y direkt editierbar (Tippen → Zahl)
      // - "Snap" Button: rundet auf Grid (wenn Grid+Snap aktiv)
      // - "Reset" Button: setzt X/Y auf 0
      const posRow = document.createElement("div");
      posRow.style.display = "flex";
      posRow.style.alignItems = "center";
      posRow.style.gap = "8px";
      posRow.style.flexWrap = "wrap";
      posRow.style.marginTop = "8px";

      const posLab = document.createElement("div");
      posLab.style.fontSize = "12px";
      posLab.style.opacity = ".75";
      posLab.textContent = "Position";

      const mkNumIn = (w = 90) => {
        const el = document.createElement("input");
        el.type = "number";
        el.inputMode = "decimal";
        el.style.height = "28px";
        el.style.width = `${w}px`;
        el.style.borderRadius = "8px";
        el.style.padding = "0 8px";
        el.style.border = "1px solid rgba(255,255,255,.12)";
        el.style.background = "rgba(0,0,0,.25)";
        el.style.color = "inherit";
        return el;
      };

      const xIn = mkNumIn(90);
      const yIn = mkNumIn(90);
      xIn.value = String(Number.isFinite(Number(sceneObj.x)) ? Number(sceneObj.x) : 0);
      yIn.value = String(Number.isFinite(Number(sceneObj.y)) ? Number(sceneObj.y) : 0);

      const applyPos = (nx, ny, reason = "pos") => {
        const vx = Number(nx);
        const vy = Number(ny);
        if (!Number.isFinite(vx) || !Number.isFinite(vy)) return;
        sceneObj.x = vx;
        sceneObj.y = vy;
        try {
          if (this.state.selection?.data?.transform2d) {
            this.state.selection.data.transform2d.x = vx;
            this.state.selection.data.transform2d.y = vy;
          }
        } catch {}
        this._persistSceneToStore(reason);
        this._requestProjectSaveDebounced(reason);
        this._setStatus(`Position: X=${vx}, Y=${vy}`);
      };

      xIn.addEventListener("change", () => applyPos(xIn.value, yIn.value, "pos:input"));
      yIn.addEventListener("change", () => applyPos(xIn.value, yIn.value, "pos:input"));

      const snapToGrid = (reason = "pos:snap") => {
        const s = this._getWorkspaceSettingsSafe();
        const gs = Number(s?.grid?.size) || 10;
        const snapOn = !!(s?.grid?.enabled && s?.grid?.snap);
        // Snap nur wenn aktiv, sonst trotzdem "round" anbieten? -> wir respektieren Settings.
        if (!snapOn) {
          this._setStatus("Snap ist in WorkspaceSettings aus");
          return;
        }
        const vx = Number.isFinite(Number(sceneObj.x)) ? Number(sceneObj.x) : 0;
        const vy = Number.isFinite(Number(sceneObj.y)) ? Number(sceneObj.y) : 0;
        const rx = Math.round(vx / gs) * gs;
        const ry = Math.round(vy / gs) * gs;
        xIn.value = String(rx);
        yIn.value = String(ry);
        applyPos(rx, ry, reason);
      };

      const resetPos = () => {
        xIn.value = "0";
        yIn.value = "0";
        applyPos(0, 0, "pos:reset");
      };

      posRow.appendChild(posLab);
      posRow.appendChild(this._pill("X", "rgba(255,255,255,.06)"));
      posRow.appendChild(xIn);
      posRow.appendChild(this._pill("Y", "rgba(255,255,255,.06)"));
      posRow.appendChild(yIn);
      posRow.appendChild(this._btn("Snap", () => snapToGrid()));
      posRow.appendChild(this._btn("Reset", () => resetPos()));
      tbox.appendChild(posRow);


      // Rotation Input
      const rotRow = document.createElement("div");
      rotRow.style.display = "flex";
      rotRow.style.alignItems = "center";
      rotRow.style.gap = "8px";
      rotRow.style.flexWrap = "wrap";
      rotRow.style.marginTop = "8px";

      const rotLab = document.createElement("div");
      rotLab.style.fontSize = "12px";
      rotLab.style.opacity = ".75";
      rotLab.textContent = "Rotation (°)";

      const rotIn = document.createElement("input");
      rotIn.type = "number";
      rotIn.inputMode = "decimal";
      rotIn.style.height = "28px";
      rotIn.style.width = "90px";
      rotIn.style.borderRadius = "8px";
      rotIn.style.padding = "0 8px";
      rotIn.style.border = "1px solid rgba(255,255,255,.12)";
      rotIn.style.background = "rgba(0,0,0,.25)";
      rotIn.style.color = "inherit";
      rotIn.value = String(Number.isFinite(Number(sceneObj.rotDeg)) ? Number(sceneObj.rotDeg) : 0);
      // Rotations-Step (UI-State) – Basis für präzise Eingabe + späteres Gizmo
      const getRotStep = () => {
        try {
          const app = this.store?.get?.("app") || {};
          const v = Number(app?.settings?.ui?.workarea?.transformUi?.rotStepDeg);
          return Number.isFinite(v) && v > 0 ? v : 15;
        } catch {
          return 15;
        }
      };

      const setRotStep = (deg) => {
        const v = Number(deg);
        if (!Number.isFinite(v) || v <= 0) return;
        try {
          this.store?.update?.("app", (app) => {
            const next = app && typeof app === "object" ? app : {};
            next.settings = next.settings && typeof next.settings === "object" ? next.settings : {};
            next.settings.ui = next.settings.ui && typeof next.settings.ui === "object" ? next.settings.ui : {};
            next.settings.ui.workarea = next.settings.ui.workarea && typeof next.settings.ui.workarea === "object" ? next.settings.ui.workarea : {};
            next.settings.ui.workarea.transformUi =
              next.settings.ui.workarea.transformUi && typeof next.settings.ui.workarea.transformUi === "object"
                ? next.settings.ui.workarea.transformUi
                : {};
            next.settings.ui.workarea.transformUi.rotStepDeg = v;
            next.settings.ui.workarea.updatedAt = new Date().toISOString();
            return next;
          });
        } catch {}
      };

      const stepSel = document.createElement("select");
      stepSel.style.height = "28px";
      stepSel.style.borderRadius = "8px";
      stepSel.style.padding = "0 8px";
      stepSel.style.border = "1px solid rgba(255,255,255,.12)";
      stepSel.style.background = "rgba(0,0,0,.25)";
      stepSel.style.color = "inherit";

      const stepOptions = [1, 5, 10, 15, 30, 45, 90];
      const curStep = getRotStep();
      for (const o of stepOptions) {
        const opt = document.createElement("option");
        opt.value = String(o);
        opt.textContent = `${o}°`;
        if (o === curStep) opt.selected = true;
        stepSel.appendChild(opt);
      }
      stepSel.addEventListener("change", () => {
        setRotStep(stepSel.value);
        this._setStatus(`Rot-Step: ${Number(stepSel.value)}°`);
      });

      const bNegStep = this._btn("-step", () => applyRot((Number(sceneObj.rotDeg) || 0) - getRotStep(), "rot:-step"));
      const bPosStep = this._btn("+step", () => applyRot((Number(sceneObj.rotDeg) || 0) + getRotStep(), "rot:+step"));


      const applyRot = (deg, reason = "rot") => {
        const v = Number(deg);
        if (!Number.isFinite(v)) return;

        // Cybermotion-Level 1: Rotation immer in [0..359] normalisieren,
        // damit Eingaben wie -90 oder 450 sauber und konsistent persisted werden.
        const vNorm = ((v % 360) + 360) % 360;

        sceneObj.rotDeg = vNorm;
        try {
          if (this.state.selection?.data?.transform2d) this.state.selection.data.transform2d.rotDeg = vNorm;
        } catch {}
        this._persistSceneToStore(reason);
        this._requestProjectSaveDebounced(reason);
        this._setStatus(`Rotation: ${vNorm}°`);
      };;

      rotIn.addEventListener("change", () => applyRot(rotIn.value, "rot:input"));

      const bNeg = this._btn("-90", () => applyRot((Number(sceneObj.rotDeg) || 0) - 90, "rot:-90"));
      const bPos = this._btn("+90", () => applyRot((Number(sceneObj.rotDeg) || 0) + 90, "rot:+90"));
      const bZero = this._btn("0", () => applyRot(0, "rot:0"));

      rotRow.appendChild(rotLab);
      rotRow.appendChild(rotIn);
      rotRow.appendChild(stepSel);
      rotRow.appendChild(bNegStep);
      rotRow.appendChild(bPosStep);
      rotRow.appendChild(bNeg);
      rotRow.appendChild(bPos);
      rotRow.appendChild(bZero);
      tbox.appendChild(rotRow);

      // Duplicate + Delete
      const delRow = document.createElement("div");
      delRow.style.marginTop = "10px";

      // Duplizieren (Cybermotion-typisch): 1:1 Kopie + kleiner Offset,
      // damit man die Kopie direkt sieht.
      const dup = this._btn("⧉ Duplizieren", () => {
        try {
          this._duplicateSceneObjectById(sceneObj.id, "duplicate");
        } catch (e) {
          console.error("[workarea] duplicate failed", e);
        }
      });
      dup.style.marginRight = "8px";
      delRow.appendChild(dup);

      const del = this._btn("🗑 Löschen", () => {
        try {
          this._deleteSceneObjectById(sceneObj.id, "delete");
        } catch (e) {
          console.error("[workarea] delete failed", e);
        }
      });
      del.style.background = "rgba(255,80,80,.12)";
      del.style.borderColor = "rgba(255,80,80,.25)";
      delRow.appendChild(del);
      tbox.appendChild(delRow);

      const note = document.createElement("div");
      note.style.marginTop = "8px";
      note.style.fontSize = "12px";
      note.style.opacity = ".75";
      note.textContent = "Hinweis: In 2D sind Welt-/Objekt-Achse aktuell optisch gleich. Wir speichern das schon mit, damit später ein 3D-Gizmo (Cybermotion) sauber nachziehen kann.";
      tbox.appendChild(note);

      box.appendChild(tbox);
    }

    const groups = this._resolveSchemaGroups(schema);
    for (const g of groups) {
      const gEl = document.createElement("div");
      gEl.style.border = "1px solid rgba(255,255,255,.08)";
      gEl.style.borderRadius = "10px";
      gEl.style.padding = "8px";

      const gTitle = document.createElement("div");
      gTitle.style.fontWeight = "700";
      gTitle.style.marginBottom = "6px";
      gTitle.textContent = g.title || g.id || "Group";
      gEl.appendChild(gTitle);

      const fields = Array.isArray(g.fields) ? g.fields : [];
for (const f of fields) {
  const row = document.createElement("div");
  row.style.display = "grid";
  row.style.gridTemplateColumns = "1fr 1.2fr";
  row.style.gap = "10px";
  row.style.alignItems = "center";
  row.style.fontSize = "12px";
  row.style.padding = "6px 0";
  row.style.borderTop = "1px dashed rgba(255,255,255,.06)";

  const l = document.createElement("div");
  l.style.opacity = ".75";
  l.textContent = f.label || f.id || "";
  row.appendChild(l);

  const ctrlHost = document.createElement("div");
  ctrlHost.style.display = "flex";
  ctrlHost.style.justifyContent = "flex-end";
  ctrlHost.style.gap = "6px";
  ctrlHost.style.flexWrap = "wrap";

  // Schema-driven Control (editierbar, wenn möglich)
  const ctrl = this._renderPropFieldControl({ sel, sceneObj, field: f });
  if (ctrl) ctrlHost.appendChild(ctrl);

  row.appendChild(ctrlHost);
  gEl.appendChild(row);
}

box.appendChild(gEl);
    }

    const actions = document.createElement("div");
    actions.style.display = "flex";
    actions.style.gap = "6px";
    actions.style.flexWrap = "wrap";

    actions.appendChild(this._btn("Select: Project", () => this._setSelectionType("project")));
    actions.appendChild(this._btn("Select: Hall", () => this._setSelectionType("hall.procedural")));
    actions.appendChild(this._btn("Select: Asset", () => this._setSelectionType("asset.glb")));
    actions.appendChild(this._btn("Select: Conveyor", () => this._setSelectionType("conveyor.segment")));
    box.appendChild(actions);

return box;
  }

  // Backward-Compat: ältere Stände rufen noch _renderPropertiesDummy() auf.
  _renderPropertiesDummy() {
    return this._renderPropertiesPanel();
  }



  /* ===========================================================================
   * Workarea Layout Diagnostics v1
   * ===========================================================================
   * Dieser Block ist absichtlich passiv. Er baut das Mobile-Layout noch nicht um,
   * sondern liefert belastbare Messwerte für iPhone / iPad Hochkant / iPad Quer / Desktop.
   */

  _wireLayoutDiagnostics() {
    if (this._onWindowResizeForLayoutDiag) return;

    this._onWindowResizeForLayoutDiag = () => {
      try {
        if (this._layoutDiag?.timer) clearTimeout(this._layoutDiag.timer);

        if (this._layoutDiag) {
          this._layoutDiag.timer = setTimeout(() => {
            if (this._layoutDiag) this._layoutDiag.timer = 0;

            // PATCH_workarea_mobile_resize_guard_v3:
            // LayoutDiag darf nicht mehr direkt den Canvas resizen.
            // Erst Diagnose aktualisieren, dann Resize nur über den Guard anfragen.
            this._refreshWorkareaLayoutDiagnostics("window-resize", { renderTopbar: true });
            this._requestViewportCanvasResize("window-resize");
          }, 180);
        }
      } catch {}
    };

    try {
      window.addEventListener("resize", this._onWindowResizeForLayoutDiag, { passive: true });
      window.addEventListener("orientationchange", this._onWindowResizeForLayoutDiag, { passive: true });
    } catch {}
  }

  _detectWorkareaLayoutMode() {
    const iw = Math.max(0, Math.floor(window?.innerWidth || 0));
    const ih = Math.max(0, Math.floor(window?.innerHeight || 0));
    const sw = Math.min(iw, ih);
    const lw = Math.max(iw, ih);
    const dpr = Number(window?.devicePixelRatio || 1) || 1;
    const ua = String(navigator?.userAgent || "");
    const platform = String(navigator?.platform || "");
    const touch = Number(navigator?.maxTouchPoints || 0) || 0;
    const portrait = ih >= iw;

    // iPadOS kann sich als Macintosh melden. TouchPoints helfen als Signal.
    const looksLikeIpad = /iPad/i.test(ua) || (/Macintosh/i.test(ua) && touch > 1);
    const looksLikePhone = /iPhone|Android.*Mobile/i.test(ua);

    let mode = "desktop";
    let reason = "width>=1024 oder Desktop-Fallback";

    // Harte Phone-Zone: echte schmale iPhone-/Smartphone-Ansicht.
    if (iw < 700 || (looksLikePhone && sw < 700)) {
      mode = "mobile";
      reason = "innerWidth<700 oder Phone-UA";
    }
    // Tablet kompakt: iPad hochkant / kleine Tablets.
    else if (iw < 1024 || (looksLikeIpad && portrait && iw < 1100)) {
      mode = "tablet";
      reason = "Tablet-/Portrait-Zone: >=700 und <1024/1100";
    }
    // Tablet quer / Desktop: bewusst Desktop-artig lassen.
    else {
      mode = "desktop";
      reason = looksLikeIpad ? "iPad quer/Desktop-Breite" : "Desktop-Breite";
    }

    return {
      mode,
      reason,
      innerWidth: iw,
      innerHeight: ih,
      shortEdge: sw,
      longEdge: lw,
      dpr,
      orientation: portrait ? "portrait" : "landscape",
      touchPoints: touch,
      looksLikeIpad,
      looksLikePhone,
      userAgent: ua,
      platform
    };
  }

  _rectFor(el) {
    try {
      if (!el || typeof el.getBoundingClientRect !== "function") return null;
      const r = el.getBoundingClientRect();
      return {
        x: Math.round(r.x),
        y: Math.round(r.y),
        width: Math.round(r.width),
        height: Math.round(r.height),
        right: Math.round(r.right),
        bottom: Math.round(r.bottom),
        display: String(el.style?.display || getComputedStyle(el).display || ""),
        flex: String(el.style?.flex || "")
      };
    } catch {
      return null;
    }
  }

  _getWorkareaLayoutDebug() {
    const app = this.store?.get?.("app") || {};
    const ws = app?.settings?.workspace || null;
    const uiw = app?.settings?.ui?.workarea || null;
    const vp = this._detectWorkareaLayoutMode();

    const leftDockRect = this._rectFor(this._els.leftDock);
    const rightDockRect = this._rectFor(this._els.rightDock);
    const hostRect = this._rectFor(this._vp.host);
    const canvasRect = this._rectFor(this._vp.canvas);
    const shellRect = this._rectFor(this._els.shell);

    return {
      schema: "baustellenplaner.workarea.layoutDebug.v1",
      createdAt: new Date().toISOString(),
      viewport: vp,
      project: {
        id: app?.project?.id || app?.activeProjectId || null,
        name: app?.project?.name || ""
      },
      state: {
        modeId: this.state.modeId,
        leftTabId: this.state.leftTabId,
        rightTabId: this.state.rightTabId,
        leftDockCollapsed: !!this.state.leftDockCollapsed,
        rightDockCollapsed: !!this.state.rightDockCollapsed,
        bottomCollapsed: !!this.state.bottomCollapsed,
        fullscreen: !!this.state.fullscreen,
        consoleOpen: !!this.state.consoleOpen,
        placeCtx: { ...(this.state.placeCtx || {}) }
      },
      settings: {
        workspaceDocks: ws?.docks || null,
        workareaUi: uiw ? {
          modeId: uiw.modeId || null,
          leftTabId: uiw.leftTabId || null,
          rightTabId: uiw.rightTabId || null,
          dockState: uiw.dockState || null,
          placeCtx: uiw.placeCtx || null,
          updatedAt: uiw.updatedAt || null,
          lastReason: uiw.lastReason || null
        } : null
      },
      cfg: this._cfg || null,
      rects: {
        root: this._rectFor(this.rootEl),
        header: this._rectFor(this._els.header),
        shell: shellRect,
        topbar: this._rectFor(this._els.topbar),
        leftDock: leftDockRect,
        center: this._rectFor(this._els.center),
        rightDock: rightDockRect,
        bottom: this._rectFor(this._els.bottom),
        viewportHost: hostRect,
        canvas: canvasRect
      },
      canvasInternal: {
        cssWidth: this._vp.w || 0,
        cssHeight: this._vp.h || 0,
        dpr: this._vp.dpr || 1,
        bitmapWidth: this._vp.canvas?.width || 0,
        bitmapHeight: this._vp.canvas?.height || 0,
        zoom: this._vp.zoom || 1,
        offsetX: this._vp.offsetX || 0,
        offsetY: this._vp.offsetY || 0
      },
      scene: {
        objects: Array.isArray(this._scene?.objects) ? this._scene.objects.length : 0,
        selectedType: this.state?.selection?.type || null
      },
      flags: {
        leftVisibleButCollapsed: !!(this.state.leftDockCollapsed && leftDockRect && leftDockRect.display !== "none" && leftDockRect.width > 0),
        rightVisibleButCollapsed: !!(this.state.rightDockCollapsed && rightDockRect && rightDockRect.display !== "none" && rightDockRect.width > 0),
        canvasTooNarrow: !!(hostRect && hostRect.width < 260),
        canvasOffRight: !!(hostRect && vp.innerWidth && hostRect.right > vp.innerWidth + 4),
        shellOverflowRight: !!(shellRect && vp.innerWidth && shellRect.right > vp.innerWidth + 4)
      }
    };
  }

  _layoutDebugSig(dbg) {
    try {
      const v = dbg?.viewport || {};
      const r = dbg?.rects || {};
      const c = r.viewportHost || {};
      return [
        v.mode,
        v.innerWidth,
        v.innerHeight,
        v.orientation,
        this.state.leftDockCollapsed ? 1 : 0,
        this.state.rightDockCollapsed ? 1 : 0,
        Math.round(c.width || 0),
        Math.round(c.height || 0),
        dbg?.flags?.canvasOffRight ? 1 : 0
      ].join("|");
    } catch {
      return "";
    }
  }

  _refreshWorkareaLayoutDiagnostics(reason = "diag", opts = {}) {
    try {
      const dbg = this._getWorkareaLayoutDebug();
      const sig = this._layoutDebugSig(dbg);
      const changed = sig !== this._layoutDiag?.lastSig;

      if (this._layoutDiag) {
        this._layoutDiag.lastMode = dbg?.viewport?.mode || "unknown";
        this._layoutDiag.lastSig = sig;
        this._layoutDiag.lastSnapshot = dbg;
      }

      if (this._els.layoutDiagBadge) {
        this._els.layoutDiagBadge.textContent = `Layout: ${dbg?.viewport?.mode || "?"}`;
        this._els.layoutDiagBadge.title = `${dbg?.viewport?.reason || ""}
${dbg?.viewport?.innerWidth}×${dbg?.viewport?.innerHeight} DPR ${dbg?.viewport?.dpr}`;
      }

      // Console Drawer bekommt eine kurze, gut kopierbare Zusammenfassung.
      if (this._els.consoleDrawer) {
        const f = dbg?.flags || {};
        this._els.consoleDrawer.textContent =
          `LayoutDiag ${dbg.viewport.mode} ${dbg.viewport.innerWidth}×${dbg.viewport.innerHeight} DPR ${dbg.viewport.dpr}
` +
          `orientation=${dbg.viewport.orientation} touch=${dbg.viewport.touchPoints} reason=${dbg.viewport.reason}
` +
          `canvas=${dbg.canvasInternal.cssWidth}×${dbg.canvasInternal.cssHeight} zoom=${Number(dbg.canvasInternal.zoom || 1).toFixed(2)}
` +
          `docks L=${dbg.state.leftDockCollapsed ? "collapsed" : "open"} R=${dbg.state.rightDockCollapsed ? "collapsed" : "open"} B=${dbg.state.bottomCollapsed ? "collapsed" : "open"}
` +
          `flags canvasTooNarrow=${!!f.canvasTooNarrow} canvasOffRight=${!!f.canvasOffRight} shellOverflowRight=${!!f.shellOverflowRight}`;
      }

      if (opts?.status) {
        const f = dbg?.flags || {};
        this._setStatus(
          `📐 Layout ${dbg.viewport.mode} ${dbg.viewport.innerWidth}×${dbg.viewport.innerHeight} · ` +
          `Canvas ${dbg.canvasInternal.cssWidth}×${dbg.canvasInternal.cssHeight}` +
          (f.canvasOffRight ? " · ⚠️ Canvas rechts abgeschnitten" : "")
        );
      }

      if (opts?.renderTopbar && changed && this._mounted) {
        const oldMode = this._layoutDiag?.lastRenderedMode || "";
        const nextMode = dbg?.viewport?.mode || "";
        if (oldMode !== nextMode) {
          this._layoutDiag.lastRenderedMode = nextMode;
          this._renderTopbar();
          this._renderBottomBar();
        }
      }

      return dbg;
    } catch (e) {
      console.warn("[workarea] layout diagnostics failed", e);
      return null;
    }
  }

  async _copyWorkareaLayoutDebug() {
    try {
      const dbg = this._refreshWorkareaLayoutDiagnostics("copy", { status: false, renderTopbar: false }) || this._getWorkareaLayoutDebug();
      const ok = await this._copyToClipboard(JSON.stringify(dbg, null, 2));
      this._setStatus(ok ? "✅ Workarea Layout JSON kopiert" : "⚠️ Layout JSON konnte nicht kopiert werden");
      return ok;
    } catch (e) {
      this._setStatus(`⚠️ Layout JSON Fehler: ${String(e?.message || e)}`);
      return false;
    }
  }

  /* ==========================================================================
   * Dock collapse helpers
   * ========================================================================= */

  _applyDockVisibility() {
    const L = this._els.leftDock;
    const R = this._els.rightDock;
    const B = this._els.bottom;

    if (this.state.fullscreen) {
      if (L) L.style.display = "none";
      if (R) R.style.display = "none";
      if (B) B.style.display = "none";
      return;
    }

    if (L) L.style.display = this.state.leftDockCollapsed ? "none" : "flex";
    if (R) R.style.display = this.state.rightDockCollapsed ? "none" : "flex";
    if (B) B.style.display = this.state.bottomCollapsed ? "none" : "flex";
  }

  _toggleLeftDock() {
    this.state.leftDockCollapsed = !this.state.leftDockCollapsed;
    this._persistWorkareaUiToStore("dock:left");
    this._applyDockVisibility();
    this._renderTopbar();
    this._resizeViewportCanvas();
    this._setStatus(this.state.leftDockCollapsed ? "LeftDock eingeklappt" : "LeftDock sichtbar");
  }

  _toggleRightDock() {
    this.state.rightDockCollapsed = !this.state.rightDockCollapsed;
    this._persistWorkareaUiToStore("dock:right");
    this._applyDockVisibility();
    this._renderTopbar();
    this._resizeViewportCanvas();
    this._setStatus(this.state.rightDockCollapsed ? "RightDock eingeklappt" : "RightDock sichtbar");
  }

  _toggleBottom() {
    this.state.bottomCollapsed = !this.state.bottomCollapsed;
    this._persistWorkareaUiToStore("dock:bottom");
    this._applyDockVisibility();
    this._renderTopbar();
    this._resizeViewportCanvas();
    this._setStatus(this.state.bottomCollapsed ? "BottomBar eingeklappt" : "BottomBar sichtbar");
  }

  _toggleFullscreen() {
    this.state.fullscreen = !this.state.fullscreen;
    this._persistWorkareaUiToStore("dock:fullscreen");
    this._applyDockVisibility();
    this._renderTopbar();
    this._resizeViewportCanvas();
    this._setStatus(this.state.fullscreen ? "Fullscreen (Docks aus)" : "Fullscreen beendet");
  }

  /* ==========================================================================
   * Bus wiring
   * ========================================================================= */

  _wireBus() {
    if (!this.bus || typeof this.bus.on !== "function") return;

    const off1 = this.bus.on("req:workarea:mode:set", (msg = {}) => {
      const modeId = String(msg?.modeId || "select");
      const reason = msg?.reason || "bus";
      this._setMode(modeId, reason);
    });

    const off2 = this.bus.on("cb:scene:selection:changed", (msg = {}) => {
      void msg;
    });

    // Live Settings (Workspace → Workarea)
    // v1.1.5: msg.applyDocks === true -> Dock-Defaults EINMALIG übernehmen
    const off3 = this.bus.on("cb:settings:workspace:changed", (msg = {}) => {
      const workspace = msg?.workspace;
      if (!workspace) return;

      const applyDocks = !!msg?.applyDocks;
      const source = String(msg?.source || "bus");

      this._applyWorkspaceSettings(workspace, `bus:${source}`, { applyDocks });
    });

    // Store-Updates: wenn ProjectAssets im Store geändert werden,
    // können wir (nur wenn Assets-Tab sichtbar) die Liste live aktualisieren.
    // 0-Risiko: kein Auto-Navigation, nur Re-Render.
    const off4 = this.bus.on("cb:store:changed", (msg = {}) => {
      try {
        if (msg?.key !== "app") return;
        if (!this._mounted) return;

        // 1) Hydration Guard (Step 5G) + Scene inject
        this._maybeHydrate("store:changed");

        // 2) Assets-Liste nur rendern, wenn Assets-Tab sichtbar ist.
        if (this.state.leftTabId === "tab.assets") this._renderLeftPanel();
      } catch {}
    });

    // -------------------------------------------------------------------
    // PATCH_workarea_assembly_insert_single_fire_v1
    // -------------------------------------------------------------------
    // Canonicaler Insert-Kanal für das Baugruppen-Menü.
    // Dieser Listener hängt bewusst direkt an window, weil das Baugruppen-Menü
    // als additiver Runtime-Patch außerhalb des Panels läuft.
    const onAssemblyInsertRequest = (ev) => {
      try {
        this._handleAssemblyInsertRequest(ev?.detail || {}, "window");
      } catch (err) {
        this._crashLog("workarea:assembly-insert:error", {
          message: err?.message || String(err),
          stack: err?.stack || null
        });
      }
    };

    const assemblyInsertEventNames = [
      "workarea:assembly-insert:request",
      // Kompatibilitäts-Aliase für ältere/experimentelle Menü-Patches.
      // Damit bleibt der WorkareaPanel robust, auch wenn das schwebende
      // Baugruppen-Menü den Eventnamen leicht anders sendet.
      "workarea:assembly-insert",
      "workarea:assembly:insert",
      "bp:workarea:assembly-insert",
      "bp:assembly:insert"
    ];

    try {
      for (const eventName of assemblyInsertEventNames) {
        window.addEventListener(eventName, onAssemblyInsertRequest);
      }
      this._assemblyInsertGuard.listener = onAssemblyInsertRequest;
    } catch (err) {
      this._crashLog("workarea:assembly-insert:listener-error", { message: err?.message || String(err) });
    }

    this._unsubs.push(
      off1,
      off2,
      off3,
      off4,
      () => {
        try {
          for (const eventName of assemblyInsertEventNames) {
            window.removeEventListener(eventName, onAssemblyInsertRequest);
          }
        } catch {}
      }
    );
  }


  /* ==========================================================================
   * PATCH_workarea_assembly_insert_single_fire_v1
   * ==========================================================================
   * Zentraler, einziger Insert-Pfad für Baugruppen aus
   * /core/workarea-assembly-insert-and-variant-panel.v1.js.
   *
   * Warum hier im WorkareaPanel?
   * - Nur dieses Panel besitzt die echte Scene und Persistenzlogik.
   * - Das schwebende Baugruppen-Menü darf nur einen Wunsch senden.
   * - ID-Dedupe, Persistenz, Save, Render und Selection müssen hier passieren.
   */



  /* ==========================================================================
   * PATCH_workarea_assembly_naming_restore_v1
   * ==========================================================================
   * Problem:
   * - Der EH/Place-Mode-Patch hatte den Single-Fire-Insert repariert, aber die
   *   automatische Namensvergabe aus dem vorherigen Patch nicht mehr im finalen
   *   Insert-Pfad aufgerufen.
   * - Dadurch kamen wieder Defaultnamen aus dem Katalog in die Szene:
   *   RB-NEU, HE-NEU, VW-NEU, QF-NEU, SH-NEU, EH-NEU.
   *
   * Ziel:
   * - Beim NEUEN Einfügen bekommt jede Baugruppe wieder sofort einen freien,
   *   sprechenden Namen: RB-1, RB-2, HE-1, VW-1, QF-1, SH-1, EH-1 ...
   * - Bestehende/manuell umbenannte Objekte werden beim Laden/Speichern nicht
   *   automatisch überschrieben.
   */

  /* ==========================================================================
   * PATCH_assemblylab_properties_hotfix_v1
   * ==========================================================================
   * Kleiner Sicherheits-Helfer für Properties-HTML.
   * Der Properties-Patch nutzt _escapeHtml() in der Bauteile-Liste. In einigen
   * WorkareaPanel-Ständen gab es bisher nur _escapeRegExpText(), aber keinen
   * HTML-Escape-Helfer. Das führte beim Antippen einer assembly.instance zu
   * einem TypeError und danach zu kaputtem Pointer-/Pinch-Zustand auf iOS.
   */
  _escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  _escapeRegExpText(value) {
    return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  _normalizeAssemblyNameText(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/ä/g, "ae")
      .replace(/ö/g, "oe")
      .replace(/ü/g, "ue")
      .replace(/ß/g, "ss")
      .replace(/[\s_]+/g, "-")
      .replace(/-+/g, "-");
  }

  _getAssemblyNamingRules() {
    return [
      {
        prefix: "SH",
        tokens: ["scherenhubtisch", "scheren-hubtisch", "scissor-lift", "scissor-lift-table", "sh"]
      },
      {
        prefix: "EH",
        tokens: ["exzenterhubtisch", "exzenter-hubtisch", "exzenter", "eccentric-lift", "eccentric-lift-table", "eh"]
      },
      {
        prefix: "QF",
        tokens: ["querkette", "quer-kette", "querfoerderer", "quer-foerderer", "querfoerderer", "cross-conveyor", "chain-transfer", "qf"]
      },
      {
        prefix: "VW",
        tokens: ["verschiebewagen", "verschiebe-wagen", "transferwagen", "transfer-cart", "shuttle-car", "querwagen", "vw"]
      },
      {
        prefix: "HE",
        tokens: ["heber", "heber-master", "lifter", "lift", "hubheber", "he", "hb", "hb-neu", "he-neu"]
      },
      {
        prefix: "RB",
        tokens: ["rollenbahn", "rollenbahn-master", "rollenbahnmaster", "roller-conveyor", "rollenbock", "rollen-bock", "rollenbogen", "foerderer", "foerdertechnik-rollenbahn", "rb"]
      }
    ];
  }

  _getAssemblyNamePrefixFromObject(obj = {}) {
    const hay = this._normalizeAssemblyNameText([
      obj?.name,
      obj?.title,
      obj?.label,
      obj?.templateId,
      obj?.templateTitle,
      obj?.variantId,
      obj?.variantTitle,
      obj?.visual?.shape,
      obj?.visual?.label,
      obj?.config?.name,
      obj?.config?.kind,
      obj?.config?.type,
      obj?.meta?.name,
      obj?.meta?.title
    ].filter(Boolean).join(" "));

    for (const rule of this._getAssemblyNamingRules()) {
      for (const token of rule.tokens) {
        const t = this._normalizeAssemblyNameText(token);
        if (!t) continue;
        if (t.length <= 3) {
          const re = new RegExp(`(^|-)${this._escapeRegExpText(t)}(-|$)`, "i");
          if (re.test(hay)) return rule.prefix;
        } else if (hay.includes(t)) {
          return rule.prefix;
        }
      }
    }

    return "ASM";
  }

  _looksLikeAutoAssemblyName(name) {
    const v = String(name || "").trim();
    if (!v) return true;

    // Katalog-/Defaultnamen sind automatisch und sollen beim Einfügen ersetzt werden.
    if (/^(RB|HE|HB|VW|QF|SH|EH|RBO|ASM)[\s_-]*(NEU|NEW)$/i.test(v)) return true;
    if (/^(RB|HE|HB|VW|QF|SH|EH|RBO|ASM)-\d+$/i.test(v)) return true;
    if (/^(assembly|baugruppe|neue baugruppe)$/i.test(v)) return true;
    if (/\s+master$/i.test(v)) return true;

    return false;
  }

  _getUsedAssemblyInstanceNumbers(prefix, objects = null) {
    const used = new Set();
    const pfx = String(prefix || "ASM").trim() || "ASM";
    const re = new RegExp(`^${this._escapeRegExpText(pfx)}-(\\d+)$`, "i");
    const list = Array.isArray(objects) ? objects : (Array.isArray(this._scene?.objects) ? this._scene.objects : []);

    for (const o of list) {
      const name = String(o?.name || "").trim();
      const m = name.match(re);
      if (!m) continue;
      const n = Number(m[1]);
      if (Number.isFinite(n) && n > 0) used.add(n);
    }

    return used;
  }

  _getNextAssemblyInstanceName(obj = {}) {
    const prefix = this._getAssemblyNamePrefixFromObject(obj);
    const used = this._getUsedAssemblyInstanceNumbers(prefix);
    let n = 1;
    while (used.has(n)) n += 1;
    return `${prefix}-${n}`;
  }

  _ensureAssemblyInsertName(obj, reason = "assembly-insert") {
    if (!obj || typeof obj !== "object") return obj;
    if (String(obj.type || "") !== "assembly.instance") return obj;

    const locked = obj?.nameLocked === true || obj?.meta?.explicitName === true;
    const current = String(obj.name || "").trim();

    // Wichtig: Beim echten Menü-Insert sind RB-NEU/HE-NEU/... immer Defaultwerte.
    // Diese ersetzen wir auch dann, wenn sie aus config.name/visual.label kommen.
    if (!locked && this._looksLikeAutoAssemblyName(current)) {
      const nextName = this._getNextAssemblyInstanceName(obj);
      obj.name = nextName;
      obj.autoName = true;
      obj.nameSource = "PATCH_workarea_assembly_naming_restore_v1";
      obj.meta = obj.meta && typeof obj.meta === "object" ? obj.meta : {};
      obj.meta.autoName = true;
      obj.meta.nameSource = "PATCH_workarea_assembly_naming_restore_v1";
      obj.meta.nameReason = String(reason || "assembly-insert");
      obj.meta.nameGeneratedAt = new Date().toISOString();

      // Label ebenfalls aktualisieren, damit Viewport/Outliner nicht weiter
      // den alten NEU-Namen aus visual.label anzeigen.
      obj.visual = obj.visual && typeof obj.visual === "object" ? obj.visual : {};
      obj.visual.label = nextName;

      // config.name darf mitgeführt werden, damit spätere Param-/BOM-Ansichten
      // denselben Namen sehen.
      obj.config = obj.config && typeof obj.config === "object" ? obj.config : {};
      obj.config.name = nextName;
    }

    return obj;
  }


  _cleanupAssemblyInsertGuard(now = Date.now()) {
    const G = this._assemblyInsertGuard;
    if (!G) return;
    const maxAge = 8000;
    try {
      for (const [k, ts] of G.seenTx) {
        if (now - Number(ts || 0) > maxAge) G.seenTx.delete(k);
      }
      for (const [k, ts] of G.recentIds) {
        if (now - Number(ts || 0) > maxAge) G.recentIds.delete(k);
      }
    } catch {}
  }

  _cloneJsonSafe(value) {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch {
      return value && typeof value === "object" ? { ...value } : value;
    }
  }

  _sceneHasObjectId(id) {
    if (!id) return false;
    const sid = String(id);
    const objs = Array.isArray(this._scene?.objects) ? this._scene.objects : [];
    return objs.some((o) => o && String(o.id || "") === sid);
  }

  _makeUniqueSceneObjectId(prefix = "asm") {
    let id = this._makeId(prefix);
    let guard = 0;
    while (this._sceneHasObjectId(id) && guard < 20) {
      id = this._makeId(prefix);
      guard += 1;
    }
    return id;
  }

  _normalizeAssemblyInsertObject(raw, txId = "") {
    const obj = this._cloneJsonSafe(raw);
    if (!obj || typeof obj !== "object") return null;

    obj.type = "assembly.instance";
    obj.schema = obj.schema || "baustellenplaner.workarea.object.assembly.v1";

    // Robustheits-Fallback: Falls ein älterer Menü-Patch nicht die fertige
    // object/instance-Struktur sendet, sondern nur Template-/Variant-Daten,
    // bauen wir daraus trotzdem eine gültige assembly.instance.
    obj.templateId = obj.templateId || obj.template?.id || obj.masterId || obj.assemblyId || null;
    obj.templateTitle = obj.templateTitle || obj.template?.title || obj.templateName || obj.title || obj.name || null;
    obj.variantId = obj.variantId || obj.variant?.id || null;
    obj.variantTitle = obj.variantTitle || obj.variant?.title || null;
    if (!obj.w && !obj.width && obj.template?.defaultSize?.w) obj.w = Number(obj.template.defaultSize.w) || undefined;
    if (!obj.h && !obj.height && obj.template?.defaultSize?.h) obj.h = Number(obj.template.defaultSize.h) || undefined;
    if (!obj.config && obj.template?.defaultConfig) obj.config = this._cloneJsonSafe(obj.template.defaultConfig);
    if ((!obj.bom || !Array.isArray(obj.bom)) && Array.isArray(obj.variant?.bom)) obj.bom = this._cloneJsonSafe(obj.variant.bom);
    if ((!obj.ports || !Array.isArray(obj.ports)) && Array.isArray(obj.template?.ports)) obj.ports = this._cloneJsonSafe(obj.template.ports);
    if (!obj.name && obj.config?.name) obj.name = obj.config.name;
    if (!obj.name && obj.templateTitle) obj.name = obj.templateTitle;

    // Position: Im ersten Schritt bewusst in Workarea-Mitte (0/0), solange das
    // Baugruppen-Menü keine konkrete Drop-Position übergibt.
    obj.x = Number.isFinite(Number(obj.x)) ? Number(obj.x) : 0;
    obj.y = Number.isFinite(Number(obj.y)) ? Number(obj.y) : 0;

    // Rotation kompatibel halten: neuere Baugruppen nutzen rotation, Workarea
    // nutzt für Rendering/Drag bereits rotDeg.
    if (!Number.isFinite(Number(obj.rotDeg)) && Number.isFinite(Number(obj.rotation))) {
      obj.rotDeg = Number(obj.rotation);
    }
    if (!Number.isFinite(Number(obj.rotDeg))) obj.rotDeg = 0;
    obj.rotation = Number.isFinite(Number(obj.rotation)) ? Number(obj.rotation) : obj.rotDeg;

    // HitTest bleibt aktuell kreisförmig. Für Baugruppen brauchen wir deshalb
    // einen Radius, der groß genug zum Greifen ist, aber nicht die ganze Anlage
    // verschluckt.
    const w = Math.abs(Number(obj.w || obj.width || obj.config?.lengthMm || 0));
    const h = Math.abs(Number(obj.h || obj.height || obj.config?.widthMm || 0));
    const maxDim = Math.max(w, h, 0);
    if (!Number.isFinite(Number(obj.r)) || Number(obj.r) <= 0) {
      obj.r = Math.max(30, Math.min(320, maxDim > 0 ? maxDim / 2 : 80));
    }

    obj.meta = obj.meta && typeof obj.meta === "object" ? obj.meta : {};
    obj.meta.lastInsertTxId = txId || obj.meta.insertTxId || null;
    obj.meta.lastInsertPatch = "PATCH_workarea_assembly_insert_single_fire_v1";

    return obj;
  }

  _handleAssemblyInsertRequest(detail = {}, source = "window") {
    const now = Date.now();
    this._cleanupAssemblyInsertGuard(now);

    const G = this._assemblyInsertGuard || (this._assemblyInsertGuard = {
      version: "v1.0.0-single-fire",
      seenTx: new Map(),
      recentIds: new Map(),
      listener: null
    });

    const raw = detail?.object || detail?.instance || detail;
    const txId = String(detail?.txId || raw?.meta?.insertTxId || "").trim();
    const incomingId = String(raw?.id || "").trim();

    this._crashLog("workarea:assembly-insert:request", {
      source,
      txId: txId || null,
      id: incomingId || null,
      objects: Array.isArray(this._scene?.objects) ? this._scene.objects.length : 0
    });

    // 1) Harte txId-Sperre: gleicher Klick darf nur einmal verarbeitet werden.
    if (txId && G.seenTx.has(txId)) {
      this._crashLog("workarea:assembly-insert:duplicate-blocked", {
        source,
        reason: "same-tx",
        txId,
        id: incomingId || null
      });
      return null;
    }

    // 2) Legacy-Sperre: falls ein alter Sender mehrere Events ohne txId mit
    // gleicher ID feuert, blocken wir die Folgeevents im kurzen Zeitfenster.
    if (incomingId && G.recentIds.has(incomingId) && now - Number(G.recentIds.get(incomingId) || 0) < 2500) {
      this._crashLog("workarea:assembly-insert:duplicate-blocked", {
        source,
        reason: "same-id-window",
        txId: txId || null,
        id: incomingId
      });
      return null;
    }

    const obj = this._normalizeAssemblyInsertObject(raw, txId);
    if (!obj) {
      this._crashLog("workarea:assembly-insert:rejected", { source, reason: "invalid-object" });
      return null;
    }

    // Wenn die ID bereits in der Scene existiert, unterscheiden wir:
    // - sehr frisch gesehen -> gleicher Klick / Duplikat blocken
    // - sonst neue ID vergeben, damit echte neue Einfügungen nie alte Objekte
    //   überschreiben oder gemeinsam verschieben.
    if (obj.id && this._sceneHasObjectId(obj.id)) {
      const recent = G.recentIds.has(String(obj.id)) && now - Number(G.recentIds.get(String(obj.id)) || 0) < 2500;
      if (recent) {
        this._crashLog("workarea:assembly-insert:duplicate-blocked", {
          source,
          reason: "id-already-exists-recent",
          txId: txId || null,
          id: obj.id
        });
        return null;
      }

      const oldId = obj.id;
      obj.id = this._makeUniqueSceneObjectId("asm");
      this._crashLog("workarea:assembly-insert:id-regenerated", {
        source,
        txId: txId || null,
        oldId,
        newId: obj.id
      });
    }

    if (!obj.id) obj.id = this._makeUniqueSceneObjectId("asm");

    // Sperren erst nach erfolgreicher Normalisierung setzen.
    if (txId) G.seenTx.set(txId, now);
    if (obj.id) G.recentIds.set(String(obj.id), now);
    if (incomingId && incomingId !== obj.id) G.recentIds.set(incomingId, now);

    this._scene.objects = Array.isArray(this._scene?.objects) ? this._scene.objects : [];

    // PATCH_workarea_assembly_naming_restore_v1:
    // Vor dem Push zählen wir die bereits vorhandenen Namen und ersetzen
    // Katalog-Defaultnamen wie RB-NEU/HE-NEU/VW-NEU/QF-NEU/SH-NEU/EH-NEU.
    this._ensureAssemblyInsertName(obj, "assembly-insert:single-fire");

    this._scene.objects.push(obj);

    this._crashLog("workarea:external-insert:done", {
      reason: "assembly-insert:single-fire",
      source,
      id: obj.id,
      txId: txId || null,
      type: obj.type,
      name: obj.name || null,
      count: this._scene.objects.length,
      bom: Array.isArray(obj.bom) ? obj.bom.length : 0,
      ports: Array.isArray(obj.ports) ? obj.ports.length : 0
    });

    this._persistSceneToStore("assembly-insert:single-fire");

    try {
      this._setSelectionToObject(obj, "assembly-insert");
    } catch {}

    try {
      this._renderRightPanel();
      this._renderLeftPanel();
    } catch {}

    // Nach Menü-Insert immer zurück in Select. Damit bleibt Workarea nicht
    // im alten Place-Modus hängen und der nächste Tap verschiebt/selektiert
    // wieder eindeutig die gerade eingefügte Baugruppe.
    try {
      if (String(this.state?.modeId || "") === "place") this._setMode("select", "assembly-insert:done");
    } catch {}

    this._setStatus(`Baugruppe eingefügt: ${obj.name || obj.id}`);
    return obj;
  }

  /* ==========================================================================
   * Step 5G: Hydration Guard (Spinner + späteres Scene-Inject)
   * ==========================================================================
   * Problem:
   * - iPad/Safari kann beim „kalten“ Start den Persist-Store minimal verzögert
   *   rehydrieren.
   * - Workarea mountet dann kurz mit Default-State (Dummy), obwohl die Scene im
   *   Store existiert.
   *
   * Lösung:
   * - Overlay anzeigen, solange activeProjectId fehlt.
   * - Workspace-Settings dürfen NICHT blockieren:
   *   In echten Projektständen kann app.settings leer sein, während
   *   app.project.workspace.scene bereits gültig ist.
   * - Sobald ein Projekt aktiv ist:
   *    - Scene-Shape wird in _maybeHydrate() unter app.project sichergestellt
   *    - Scene aus Store injecten
   *    - Overlay ausblenden
   */

  _isHydratedNow() {
    try {
      const app = this.store?.get?.("app") || {};
      const pid = String(app?.activeProjectId || app?.project?.id || "").trim();
      if (!pid) return false;

      // BP 2.0 / Safari-Fix:
      // Nicht mehr auf app.settings.workspace warten. Settings können leer sein
      // oder später kommen. Workarea kann mit Defaults sofort starten.
      return true;
    } catch {
      return false;
    }
  }

  /* =====================================================================
   * Step 5K / Safari-Fix:
   * - Scene gehört projektgebunden nach: app.project.workspace.scene.objects
   * - NICHT nach app.settings.workspace.scene (Settings werden oft überschrieben)
   * ===================================================================== */

  _ensureProjectWorkspaceSceneShape(reason = "ensureProjectScene") {
    if (!this.store?.update) return false;
    try {
      const app = this.store?.get?.("app") || {};
      const pid = String(app?.activeProjectId || "").trim();
      if (!pid) return false;

      this.store.update("app", (cur) => {
        const next = cur && typeof cur === "object" ? cur : {};
        next.project = next.project && typeof next.project === "object" ? next.project : {};
        next.project.workspace = next.project.workspace && typeof next.project.workspace === "object" ? next.project.workspace : {};
        next.project.workspace.scene = next.project.workspace.scene && typeof next.project.workspace.scene === "object" ? next.project.workspace.scene : {};
        next.project.workspace.scene.objects = Array.isArray(next.project.workspace.scene.objects)
          ? next.project.workspace.scene.objects
          : [];
        return next;
      });
      return true;
    } catch {
      return false;
    }
  }

  _migrateLegacySceneIfNeeded(reason = "legacy-migrate") {
    // Einmalig: alte Stände hatten Scene in app.settings.workspace.scene.
    // Wir kopieren sie nach app.project.workspace.scene, damit sie stabil bleibt.
    if (this._sceneSync && this._sceneSync.didMigrateLegacy) return false;
    if (!this.store?.update) return false;

    try {
      const app = this.store?.get?.("app") || {};
      const legacy = app?.settings?.workspace?.scene?.objects;
      const legacyList = Array.isArray(legacy) ? legacy : null;
      if (!legacyList || legacyList.length === 0) {
        this._sceneSync = this._sceneSync || {};
        this._sceneSync.didMigrateLegacy = true;
        return false;
      }

      const projList = app?.project?.workspace?.scene?.objects;
      const projHas = Array.isArray(projList) && projList.length > 0;
      if (projHas) {
        this._sceneSync = this._sceneSync || {};
        this._sceneSync.didMigrateLegacy = true;
        return false;
      }

      // Copy legacy -> project
      this.store.update("app", (cur) => {
        const next = cur && typeof cur === "object" ? cur : {};
        next.project = next.project && typeof next.project === "object" ? next.project : {};
        next.project.workspace = next.project.workspace && typeof next.project.workspace === "object" ? next.project.workspace : {};
        next.project.workspace.scene = next.project.workspace.scene && typeof next.project.workspace.scene === "object" ? next.project.workspace.scene : {};
        next.project.workspace.scene.objects = legacyList;
        return next;
      });

      // Mirror: store.project (falls Persistor project-first ist)
      try {
        this.store.update("project", (p) => {
          const proj = p && typeof p === "object" ? p : {};
          proj.workspace = proj.workspace && typeof proj.workspace === "object" ? proj.workspace : {};
          proj.workspace.scene = proj.workspace.scene && typeof proj.workspace.scene === "object" ? proj.workspace.scene : {};
          proj.workspace.scene.objects = legacyList;
          return proj;
        });
      } catch {}

      try { this._setStatus(`🧩 Scene migriert (settings→project) (${legacyList.length}) – ${reason}`); } catch {}

      this._sceneSync = this._sceneSync || {};
      this._sceneSync.didMigrateLegacy = true;
      return true;
    } catch {
      this._sceneSync = this._sceneSync || {};
      this._sceneSync.didMigrateLegacy = true;
      return false;
    }
  }

  _setHydrated(isReady, reason = "hydration") {
    this._hydration.ready = !!isReady;
    this._hydration.lastReason = String(reason || "hydration");

    // Overlay togglen
    try {
      if (this._hydration.overlayEl) {
        this._hydration.overlayEl.style.display = this._hydration.ready
          ? "none"
          : "flex";
      }
    } catch {}

    // Statusline minimal
    try {
      if (this._els.statusLine) {
        if (!this._hydration.ready) {
          this._setStatus("⏳ Projekt wird geladen …", "warn");
        } else {
          // nicht zu aggressiv überschreiben – nur wenn wir gerade „laden“ waren
          // (User kann eigene Statusmeldungen haben)
          // -> wir lassen es still.
        }
      }
    } catch {}
  }

  _maybeHydrate(reason = "maybeHydrate") {
    if (!this._mounted) return false;

    // Step 5K: Projekt-Scene-Shape sicherstellen + Legacy-Scene migrieren
    try { this._ensureProjectWorkspaceSceneShape(reason); } catch {}
    try { this._migrateLegacySceneIfNeeded(reason); } catch {}

    const ready = this._isHydratedNow();
    if (!ready) {
      this._setHydrated(false, reason);
      return false;
    }

    // Wir sind ready -> Scene injecten (auch wenn leer)
    try {
      this._rehydrateSceneFromStore(reason, { allowEmpty: true });
    } catch {}

    this._setHydrated(true, reason);
    return true;
  }

  /* ==========================================================================
   * Step 5B Stabilität: Scene Rehydrate
   * ==========================================================================
   * Wenn Persist/Loader den Store erst NACH Panel-Erzeugung befüllt,
   * müssen wir die Scene nachziehen.
   */

  _sigForObjects(list) {
    try {
      const a = Array.isArray(list) ? list : [];
      const head = a
        .slice(0, 6)
        .map((o) => String(o?.id || "").slice(0, 32))
        .join("|");
      return `${a.length}::${head}`;
    } catch {
      return "0::";
    }
  }

  _rehydrateSceneFromStore(reason = "rehydrate", opts = {}) {
    const allowEmpty = !!opts?.allowEmpty;
    const fromStore = this._getSceneObjectsFromStore();

    if (!Array.isArray(fromStore)) return false;
    if (!allowEmpty && fromStore.length === 0) return false;

    const nextSig = this._sigForObjects(fromStore);
    if (nextSig === this._sceneSync?.lastSig) return false;

    this._scene.objects = fromStore;
    this._sceneSync.lastSig = nextSig;

    try {
      if (this._mounted) {
        this._renderRightPanel();
        this._setStatus(`🔄 Scene rehydrated (${fromStore.length}) – ${reason}`);
      }
    } catch {}

    return true;
  }

  /* ==========================================================================
   * Workspace Settings → Workarea (live)
   * ========================================================================= */

  /**
   * Step 5F: Single Source of Truth für Workspace-Konfiguration.
   * Workarea liest ausschließlich app.settings.workspace.
   * ui.drafts.* wird bewusst ignoriert (Drafts sind nur Editor-Puffer).
   */
  _getWorkspaceFromStoreStrict() {
    const app = this.store?.get?.("app") || {};
    const ws = app?.settings?.workspace || {};
    return ws && typeof ws === "object" ? ws : {};
  }

  _getWorkspaceCfgFromStore() {
    // Step 5F: Drafts werden bewusst ignoriert (Single Source of Truth).
    const ws = this._getWorkspaceFromStoreStrict();

    const gridEnabled = ws?.grid?.enabled ?? true;
    const gridSize = Number(ws?.grid?.size ?? 50) || 50;
    const snapEnabled = ws?.grid?.snap ?? true;

    const bgColor = String(ws?.background?.color || "#f2f2f2");

    const quality = String(ws?.viewport?.quality || "medium");
    const dprCap = Number(ws?.viewport?.dprCap ?? 2) || 2;

    const cam = ws?.camera || {};
    const cameraMinZoom = Number(cam.minZoom ?? 0.25) || 0.25;
    const cameraMaxZoom = Number(cam.maxZoom ?? 4) || 4;

    const docks = ws?.docks || {};
    const leftCollapsed = !!docks.leftCollapsed;
    const rightCollapsed = !!docks.rightCollapsed;
    const bottomCollapsed = !!docks.bottomCollapsed;

    return {
      gridEnabled,
      gridSize,
      snapEnabled,
      bgColor,
      quality,
      dprCap,
      docks: { leftCollapsed, rightCollapsed, bottomCollapsed },
      cameraMinZoom,
      cameraMaxZoom
    };
  }


  _applyWorkspaceSettingsFromStore(reason = "store", opts = {}) {
    // Single Source of Truth: app.settings.workspace (Step 5F)
    const app = this.store?.get?.("app") || {};
    const ws = app?.settings?.workspace || null;

    // Falls workspace noch nicht existiert (früher Mount als Rehydrate),
    // laden wir nur cfg-Defaults und wenden KEINE Docks an.
    if (!ws) {
      this._cfg = this._getWorkspaceCfgFromStore();
      this._applyCfgToUI(reason, { ...opts, applyDocks: false });
      return;
    }

    // applyDocks-Strategie:
    // - true  : explizit Docks aus Workspace übernehmen (z.B. Live-Apply aus Settings)
    // - false : Docks nicht anfassen (manual-docks Fix)
    // - "auto": beim Öffnen der Workarea nur dann übernehmen, wenn Workspace-Dock-Defaults
    //          sich seit der letzten Übernahme geändert haben (Event könnte im Settings-Panel verloren gehen).
    let applyDocks = opts?.applyDocks;

    if (applyDocks === "auto" || applyDocks === undefined) {
      const sigNow = this._dockSigFromWorkspace(ws);
      const ds = this._getWorkareaDockState();
      const sigPrev = ds?.lastWorkspaceDockSigApplied || null;

      // Wenn wir noch nie übernommen haben ODER Workspace-Signatur sich geändert hat:
      // -> Docks EINMALIG übernehmen
      applyDocks = sigNow !== sigPrev;
    } else {
      applyDocks = !!applyDocks;
    }

    this._applyWorkspaceSettings(ws, reason, { ...opts, applyDocks });
  }

  _applyWorkspaceSettings(workspace, reason = "apply", opts = {}) {
    // workspace wird nur für Dock-Signatur-Vergleich genutzt; cfg kommt strikt aus dem Store.
    this._cfg = this._getWorkspaceCfgFromStore();

    // Wenn wir Docks aus Workspace übernehmen, merken wir uns die Signatur,
    // damit Auto-Apply beim nächsten Öffnen stabil entscheiden kann.
    const applyDocks = !!opts?.applyDocks;
    if (applyDocks) {
      try {
        const sigNow = this._dockSigFromWorkspace(workspace);
        this._updateWorkareaDockSigApplied(sigNow, `apply:${reason}`);
      } catch {}
    }

    this._applyCfgToUI(reason, opts);
  }

  _applyCfgToUI(reason = "cfg", opts = {}) {
    void reason;

    const applyDocks = !!opts?.applyDocks;

    if (!this.state.fullscreen) {
      if (applyDocks) {
        this.state.leftDockCollapsed = !!this._cfg?.docks?.leftCollapsed;
        this.state.rightDockCollapsed = !!this._cfg?.docks?.rightCollapsed;
        this.state.bottomCollapsed = !!this._cfg?.docks?.bottomCollapsed;
      } else if (!this._respectManualDocks) {
        this.state.leftDockCollapsed = !!this._cfg?.docks?.leftCollapsed;
        this.state.rightDockCollapsed = !!this._cfg?.docks?.rightCollapsed;
        this.state.bottomCollapsed = !!this._cfg?.docks?.bottomCollapsed;
      }
    }

    if (this._mounted) this._applyDockVisibility();
    this._resizeViewportCanvas();

    if (applyDocks) {
      // Wenn Workspace-Docks übernommen wurden, persistieren wir den UI-Zustand,
      // damit beim nächsten Öffnen konsistent gerendert wird.
      this._persistWorkareaUiToStore("dock:apply-from-workspace");
      this._setStatus("✅ Docks aus Workspace-Settings übernommen");
      this._renderTopbar();
    }
  }

  /* ==========================================================================
   * Step 5B: Scene Persistenz + Instanzierung (Place-Mode)
   * ==========================================================================
   * Ziel:
   * - Place-Mode: Tap im Viewport erzeugt eine Instanz (Scene Object)
   * - Quelle: Selection (ProjectAsset) + optional Slot
   * - Persistenz: app.project.workspace.scene.objects (+ mirror nach store.project.workspace)
   */

  _getSceneObjectsFromStoreOrDefaults() {
    const objs = this._getSceneObjectsFromStore();
    if (Array.isArray(objs) && objs.length) return objs;
    return this._getSceneObjectsDefaults();
  }

  _getSceneObjectsDefaults() {
    // Kleines Dummy-Set, solange noch keine echte Szene im Store existiert.
    return [
      // WICHTIG: r = Hit-Radius (für HitTest/Größe im 2D-Dummy-Renderer)
      //          rotDeg = Rotation in Grad (für spätere Gizmos / 3D Achsen-Modus)
      { id: "obj-1", type: "conveyor.segment", name: "Rollenbahn A", x: -300, y: -120, r: 24, rotDeg: 0 },
      { id: "obj-2", type: "asset.glb", name: "Motor", x: 180, y: 90, r: 20, rotDeg: 0 },
      { id: "obj-3", type: "hall.procedural", name: "Halle Ecke", x: 420, y: -260, r: 28, rotDeg: 0 }
    ];
  }

  _getSceneObjectsFromStore() {
    const app = this.store?.get?.("app") || {};
    // ✅ BP 2.0: Scene ist projektgebunden
    const listProj = app?.project?.workspace?.scene?.objects;
    const listLegacy = app?.settings?.workspace?.scene?.objects;
    const list = Array.isArray(listProj)
      ? listProj
      : (Array.isArray(listLegacy) ? listLegacy : []);

    // Sanitize: nur die Felder, die wir wirklich brauchen.
    const out = [];
    for (const o of list) {
      if (!o || typeof o !== "object") continue;
      const id = String(o.id || "").trim();
      const type = String(o.type || "").trim();
      if (!id || !type) continue;
      const item = {
        id,
        type,
        name: String(o.name || id),
        x: Number(o.x || 0) || 0,
        y: Number(o.y || 0) || 0,
        r: Math.max(6, Number(o.r || 20) || 20),

        // Rotation (Grad) – bewusst getrennt von r (Hit-Radius!)
        // Default: 0
        rotDeg: Number.isFinite(Number(o.rotDeg)) ? Number(o.rotDeg) : 0,
        rotation: Number.isFinite(Number(o.rotation)) ? Number(o.rotation) : (Number.isFinite(Number(o.rotDeg)) ? Number(o.rotDeg) : 0),

        // Asset-Referenzen (optional)
        projectAssetId: o.projectAssetId ? String(o.projectAssetId) : null,
        slotId: o.slotId ? String(o.slotId) : null,
        importName: o.importName ? String(o.importName) : null,
        preset: o.preset && typeof o.preset === "object" ? o.preset : null,
        presetTransform: o.presetTransform && typeof o.presetTransform === "object" ? o.presetTransform : null,

        // Asset-Catalog/Param-Pack Felder erhalten.
        catalogId: o.catalogId ? String(o.catalogId) : null,
        assetType: o.assetType ? String(o.assetType) : null,
        propertiesType: o.propertiesType ? String(o.propertiesType) : null,
        paramPackUrl: o.paramPackUrl ? String(o.paramPackUrl) : null,
        params: o.params && typeof o.params === "object" ? this._cloneJsonSafe(o.params) : null
      };

      if (type === "assembly.instance") {
        // PATCH_workarea_assembly_place_mode_fix_v1_EH:
        // Baugruppen dürfen beim Persist/Rehydrate NICHT auf die kleinen
        // Standardfelder reduziert werden, sonst verschwinden BOM, Ports,
        // Template/Variant und die Zeichnungsgröße. Genau das erzeugte den
        // Eindruck, als bliebe nur ein leerer/alter Mittelpunkt stehen.
        const keepKeys = [
          "schema", "templateId", "templateTitle", "variantId", "variantTitle",
          "area", "conveyorGroup", "scale", "w", "h", "width", "height",
          "config", "bom", "ports", "cablePoints", "cablepoints", "cableLines", "cableList", "visual", "meta", "autoName", "nameSource",
          "components", "componentRefs", "assemblyLab"
        ];
        for (const key of keepKeys) {
          if (o[key] !== undefined && o[key] !== null) item[key] = this._cloneJsonSafe(o[key]);
        }
      }

      out.push(item);
    }
    return out;
  }

  _requestProjectSaveNow(reason = "workarea") {
    // -------------------------------------------------------------------
    // CLEAN_TARGET_SAVE_STRUCTURE_V2
    // -------------------------------------------------------------------
    // Ein echter Projekt-Save ist jetzt bewusst klein und eindeutig:
    // - keine externe Save-Manager-Schicht
    // - kein alter Save-Schedule-Timer für UI-Klicks
    // - echte Datenänderungen senden direkt "ui:project:save" an loader.js
    //
    // Dadurch kann Safari/iOS die Seite nicht zwischen "scene:persist" und
    // einem späteren Timer-Callback neu laden, ohne dass der Projektstand
    // vorher an den zentralen Persistor übergeben wurde.
    if (!this._waAutosave?.enabled) return false;
    if (this._waAutosave?.suppress) return false;
    if (!this.bus?.emit) return false;

    try {
      const saveReason = String(reason || "workarea");
      this._waAutosave.lastReason = saveReason;

      if (this._waAutosave.timer) {
        clearTimeout(this._waAutosave.timer);
        this._waAutosave.timer = 0;
      }

      this._crashLog("workarea:save:emit", {
        reason: saveReason,
        direct: true,
        storeBytes: this._estimateStoreSnapshotBytes(),
        lastPersistBytes: this._crashDiag?.lastPersistBytes || 0
      });

      this.bus.emit("ui:project:save", {
        source: "workarea",
        reason: saveReason,
        direct: true,
        ts: Date.now()
      });

      this._waAutosave.lastSavedAt = new Date().toISOString();
      this._waAutosave.lastError = null;
      return true;
    } catch (e) {
      if (this._waAutosave) this._waAutosave.lastError = e?.message || String(e);
      this._crashLog("workarea:save:emit:error", { message: e?.message || String(e), stack: e?.stack || null });
      return false;
    }
  }

  _requestProjectSaveDebounced(reason = "workarea") {
    // -------------------------------------------------------------------
    // CLEAN_TARGET_SAVE_STRUCTURE_V2
    // -------------------------------------------------------------------
    // Diese Methode bleibt als kompatibler Einstiegspunkt erhalten, damit
    // bestehende Assembly-/Property-Aufrufer nicht umgebaut werden müssen.
    // Sie darf aber KEINEN Save mehr für reine Strukturbaum-UI-Aktionen
    // auslösen. Genau diese Kette war im CrashLog sichtbar:
    // structure-ui:group-toggle -> alte Dirty-/Schedule-Kette.
    const saveReason = String(reason || "workarea");

    if (
      saveReason.startsWith("structure-ui:") ||
      saveReason === "structure" ||
      saveReason === "structure:bulk" ||
      saveReason === "group-toggle" ||
      saveReason === "object-toggle"
    ) {
      this._crashLog("workarea:save:ignored-ui-state", { reason: saveReason });
      return false;
    }

    // Für echte Datenänderungen speichern wir direkt. Die Aufrufer kommen
    // bereits nur bei Drag-End, Insert, Property-Change oder AssemblyLab-Edit.
    return this._requestProjectSaveNow(saveReason);
  }


  _persistSceneToStore(reason = "scene") {
    if (!this.store?.update) return;

    const snapshot = (this._scene?.objects || []).map((o) => {
      const item = {
        id: o.id,
        type: o.type,
        name: o.name,
        x: o.x,
        y: o.y,
        r: o.r,
        rotDeg: Number.isFinite(Number(o.rotDeg)) ? Number(o.rotDeg) : 0,
        rotation: Number.isFinite(Number(o.rotation)) ? Number(o.rotation) : (Number.isFinite(Number(o.rotDeg)) ? Number(o.rotDeg) : 0),
        projectAssetId: o.projectAssetId || null,
        slotId: o.slotId || null,
        importName: o.importName || null,
        preset: o.preset || null,
        presetTransform: o.presetTransform || null,
        catalogId: o.catalogId || null,
        assetType: o.assetType || null,
        propertiesType: o.propertiesType || null,
        paramPackUrl: o.paramPackUrl || null,
        params: o.params || null
      };

      if (String(o.type || "") === "assembly.instance") {
        const keepKeys = [
          "schema", "templateId", "templateTitle", "variantId", "variantTitle",
          "area", "conveyorGroup", "scale", "w", "h", "width", "height",
          "config", "bom", "ports", "cablePoints", "cablepoints", "cableLines", "cableList", "visual", "meta", "autoName", "nameSource",
          "components", "componentRefs", "assemblyLab"
        ];
        for (const key of keepKeys) {
          if (o[key] !== undefined && o[key] !== null) item[key] = this._cloneJsonSafe(o[key]);
        }
      }

      return item;
    });

    const persistBytes = window.BP_CRASH_RECORDER?.sizeOf?.(snapshot) || 0;
    if (this._crashDiag) this._crashDiag.lastPersistBytes = persistBytes;
    this._crashLog("workarea:scene:persist", { reason, count: snapshot.length, bytes: persistBytes });

    // 1) app.project.workspace.scene.objects (Single Source of Truth)
    this.store.update("app", (app) => {
      const next = app && typeof app === "object" ? app : {};
      next.project = next.project && typeof next.project === "object" ? next.project : {};
      next.project.workspace = next.project.workspace && typeof next.project.workspace === "object" ? next.project.workspace : {};
      next.project.workspace.scene = next.project.workspace.scene && typeof next.project.workspace.scene === "object" ? next.project.workspace.scene : {};
      next.project.workspace.scene.objects = snapshot;
      return next;
    });

    // 2) store.project.workspace.scene.objects (falls Persistor project-first ist)
    try {
      this.store.update("project", (p) => {
        const proj = p && typeof p === "object" ? p : {};
        proj.workspace = proj.workspace && typeof proj.workspace === "object" ? proj.workspace : {};
        proj.workspace.scene = proj.workspace.scene && typeof proj.workspace.scene === "object" ? proj.workspace.scene : {};
        proj.workspace.scene.objects = snapshot;
        return proj;
      });
    } catch {}

    try {
      this.bus?.emit?.("cb:scene:changed", { source: "workarea", reason, count: snapshot.length });
    } catch {}

    // CLEAN_TARGET_SAVE_STRUCTURE_V2:
    // Scene-Änderungen sind echte Projektdaten. Deshalb direkt speichern,
    // nicht erst über einen Timer. Das verhindert verlorene Baugruppen nach
    // Reload / Safari-Tab-Kill.
    this._requestProjectSaveNow(`scene:${reason}`);
  }

  _makeId(prefix = "obj") {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  _getDefaultSlotForProjectAsset(pa) {
    const slots = Array.isArray(pa?.slots) ? pa.slots : [];
    if (!slots.length) return null;
    const withModel = slots.find((s) => this._slotHasModel(s));
    return withModel || slots[0] || null;
  }

  _placeInstanceAtWorld(world, reason = "place") {
    const sel = this.state.selection;
    if (!sel || sel.type !== "projectAsset") {
      this._setStatus("⚠️ Place: Bitte zuerst ein Asset im Assets-Tab auswählen");
      return null;
    }

    const pa = sel?.data?.projectAsset;
    if (!pa) {
      this._setStatus("⚠️ Place: Asset-Data fehlt (Selection)");
      return null;
    }

    const desiredSlotId = this.state?.placeCtx?.slotId || null;
    const slots = Array.isArray(pa?.slots) ? pa.slots : [];
    let slot = desiredSlotId ? slots.find((s) => String(s?.id) === String(desiredSlotId)) : null;
    if (!slot) slot = this._getDefaultSlotForProjectAsset(pa);

    if (!slot) {
      this._setStatus("⚠️ Place: Dieses Asset hat keine Slots");
      return null;
    }
    if (!this._slotHasModel(slot)) {
      this._setStatus("⚠️ Place: Slot hat kein Model (leer)");
      return null;
    }

    const id = this._makeId("inst");
    const name = `${pa?.name || pa?.id || "Asset"} • ${slot?.name || slot?.id || "Slot"}`;

    const cat = this._resolveCatalogForSlot(pa, slot);

    const obj = {
      id,
      type: "asset.instance",
      name,
      x: Number(world.wx || 0) || 0,
      y: Number(world.wy || 0) || 0,
      r: 20,
      rotDeg: 0,

      projectAssetId: pa?.id || null,
      slotId: slot?.id || null,
      importName: slot?.lastImportName || null,
      preset: slot?.preset || null,
      presetTransform: pa?.presetTransform || null,

      // -------------------------------------------------------------------
      // Asset Catalog (deterministische Verknüpfung)
      // -------------------------------------------------------------------
      // Regel:
      //  1) Slot.catalogId (explizit) -> Catalog-Item
      //  2) Fallback: autoMatch-Pattern (Catalog) -> catalogId
      //  3) Letzter Fallback: alte Heuristik (_guessParamPackUrlForSlot)
      catalogId: cat?.id || slot?.catalogId || null,
      assetType: cat?.type || null,
      propertiesType: cat?.propertiesType || null,
      paramPackUrl: cat?.paramPackUrl || this._guessParamPackUrlForSlot(pa, slot) || null,
      params: null
    };

    this._crashLog("workarea:place", { id: obj.id, asset: obj.projectAssetId, slot: obj.slotId, x: obj.x, y: obj.y, reason });

    this._scene.objects.push(obj);
    this._persistSceneToStore(reason);

    this._setSelectionToObject(obj, "place");
    this._setStatus(`🧱 Instanz platziert: ${name}`);
    return obj;
  }

  /* ==========================================================================
   * Auto-Param-Verknüpfung (ParamPack v1)
   * ========================================================================= */

  _guessParamPackUrlForSlot(projectAsset, slot) {
    // ------------------------------------------------------------
    // Heuristik:
    // - Wenn Importname/Slotname "rollerbahn" enthält -> Rollerbahn-ParamPack
    // - Wenn Importname/Slotname "transferwagen|verschiebewagen" enthält -> Transferwagen-ParamPack
    //
    // Hintergrund:
    // - In projectAssets/slots gibt es (noch) keine stabile Catalog-ID.
    // - Die Importnamen sind jedoch in der Praxis sehr stabil (Dateiname GLB).
    // - Später: auf data/assets/*.json (Catalog) umstellen.
    // ------------------------------------------------------------
    const imp = String(slot?.lastImportName || "").toLowerCase();
    const sname = String(slot?.name || "").toLowerCase();
    const aname = String(projectAsset?.name || "").toLowerCase();

    const hay = `${imp} ${sname} ${aname}`.trim();

    if (!hay) return null;

    if (/(transferwagen|verschiebewagen|querwagen|transfercar)/i.test(hay)) {
      return "modules/hall3d/data/param-packs/transferwagen_vB_v1.parampack.json";
    }

    if (/(rollerbahn|rollenbahn|rb-?)/i.test(hay)) {
      return "modules/hall3d/data/param-packs/rollerbahn_v1.parampack.json";
    }

    return null;
  }

  _guessParamPackUrlForObject(sceneObj) {
    const imp = String(sceneObj?.importName || "").toLowerCase();
    const name = String(sceneObj?.name || "").toLowerCase();
    const hay = `${imp} ${name}`.trim();

    if (/(transferwagen|verschiebewagen|querwagen|transfercar)/i.test(hay)) {
      return "modules/hall3d/data/param-packs/transferwagen_vB_v1.parampack.json";
    }
    if (/(rollerbahn|rollenbahn|rb-?)/i.test(hay)) {
      return "modules/hall3d/data/param-packs/rollerbahn_v1.parampack.json";
    }
    return null;
  }

  /* ==========================================================================
   * State helpers
   * ========================================================================= */

  _setMode(modeId, reason = "set") {
    const prev = this.state.modeId;
    if (modeId === prev) return;

    this.state.modeId = modeId;
    this._crashLog("workarea:mode", { from: prev, to: modeId, reason });

    // PATCH_workarea_ui_mode_dock_refactor_v1:
    // Mode bestimmt jetzt zentral Tabs + Dock-Sichtbarkeit. Dadurch werden
    // schwere Bereiche nicht versehentlich dauerhaft offen gehalten.
    this._applyModeDockPresetV1(modeId, reason);

    if (this._els.modeSelect) this._els.modeSelect.value = modeId;

    this._applyDockVisibility();
    this._renderLeftTabs();
    this._renderRightTabs();
    this._renderLeftPanel();
    this._renderRightPanel();
    this._renderBottomBar();
    this._renderTopbar();

    this._publishModeChanged(reason);
    this._setStatus(`Mode: ${modeId}`);

    // Step 5C: Mode/Tab-State persistieren, damit beim Zurückwechseln
    // in die Workarea der letzte Zustand wieder da ist.
    this._persistWorkareaUiToStore(`mode:${reason}`);
  }

  /* ==========================================================================
   * Step 5C: Remember Workarea State (Tabs/Mode/PlaceCtx)
   * ==========================================================================
   * Ziel:
   * - NICHT: App beim Start auf letztes Panel springen.
   * - JA: Wenn Workarea geöffnet wird, soll sie ihren letzten Zustand laden.
   */

  _getWorkareaUiFromStore() {
    const app = this.store?.get?.("app") || {};
    const wa = app?.settings?.ui?.workarea;
    return wa && typeof wa === "object" ? wa : null;
  }


  _getWorkareaDockState() {
    const wa = this._getWorkareaUiFromStore();
    const ds = wa?.dockState;
    return ds && typeof ds === "object" ? ds : null;
  }

  _dockSigFromWorkspace(workspaceObj) {
    // Signature ausschließlich aus Workspace-Dock-Defaults.
    // -> Stabiler Vergleich, ob WorkspaceSettings "etwas geändert hat".
    try {
      const docks = workspaceObj?.docks || {};
      const l = docks.leftCollapsed ? 1 : 0;
      const r = docks.rightCollapsed ? 1 : 0;
      const b = docks.bottomCollapsed ? 1 : 0;
      return `${l}|${r}|${b}`;
    } catch {
      return "0|0|0";
    }
  }

  _updateWorkareaDockSigApplied(sig, reason = "dockSig") {
    // Update nur des Merkers (ohne Dock-UI zu verändern).
    if (!this.store?.update) return;
    const nextSig = sig == null ? null : String(sig);

    this.store.update("app", (app) => {
      const next = app && typeof app === "object" ? app : {};
      next.settings = next.settings && typeof next.settings === "object" ? next.settings : {};
      next.settings.ui = next.settings.ui && typeof next.settings.ui === "object" ? next.settings.ui : {};
      next.settings.ui.workarea = next.settings.ui.workarea && typeof next.settings.ui.workarea === "object" ? next.settings.ui.workarea : {};

      const wa = next.settings.ui.workarea;
      wa.dockState = wa.dockState && typeof wa.dockState === "object" ? wa.dockState : {};
      wa.dockState.lastWorkspaceDockSigApplied = nextSig;
      wa.dockState.lastSigUpdatedAt = new Date().toISOString();
      wa.dockState.lastSigReason = String(reason || "dockSig");

      return next;
    });
  }
  _persistWorkareaUiToStore(reason = "ui") {
    if (!this.store?.update) return;

    const payload = {
      modeId: String(this.state.modeId || "select"),
      leftTabId: String(this.state.leftTabId || "tab.structure"),
      rightTabId: String(this.state.rightTabId || "tab.properties"),

      // Dock-UI-State (manuelle Toggles innerhalb Workarea)
      dockState: {
        leftDockCollapsed: !!this.state.leftDockCollapsed,
        rightDockCollapsed: !!this.state.rightDockCollapsed,
        bottomCollapsed: !!this.state.bottomCollapsed,
        fullscreen: !!this.state.fullscreen,

        // Merker: welche Workspace-Dock-Signatur zuletzt übernommen wurde.
        // (Wird NICHT bei manuellen Toggles verändert.)
        lastWorkspaceDockSigApplied: this._getWorkareaDockState()?.lastWorkspaceDockSigApplied || null
      },

      placeCtx: {
        projectAssetId: this.state?.placeCtx?.projectAssetId || null,
        slotId: this.state?.placeCtx?.slotId || null
      },

      updatedAt: new Date().toISOString(),
      lastReason: String(reason || "ui")
    };

    this._crashLog("workarea:ui:persist", { reason, mode: payload.modeId, leftTab: payload.leftTabId, rightTab: payload.rightTabId });

    this.store.update("app", (app) => {
      const next = app && typeof app === "object" ? app : {};
      next.settings = next.settings && typeof next.settings === "object" ? next.settings : {};
      next.settings.ui = next.settings.ui && typeof next.settings.ui === "object" ? next.settings.ui : {};
      next.settings.ui.workarea = payload;
      return next;
    });
  }

  _restoreWorkareaUiFromStore(reason = "restore") {
    const wa = this._getWorkareaUiFromStore();
    if (!wa) return;

    // Guard: nur bekannte Werte übernehmen.
    const modeId = String(wa.modeId || "").trim();
    if (modeId === "select" || modeId === "pan" || modeId === "place") this.state.modeId = modeId;

    const leftTabId = String(wa.leftTabId || "").trim();
    if (leftTabId) this.state.leftTabId = leftTabId;

    const rightTabId = String(wa.rightTabId || "").trim();
    if (rightTabId) this.state.rightTabId = rightTabId;


    // Dock-UI-State (manuell in Workarea)
    const ds = wa.dockState && typeof wa.dockState === "object" ? wa.dockState : null;
    if (ds) {
      this.state.leftDockCollapsed = !!ds.leftDockCollapsed;
      this.state.rightDockCollapsed = !!ds.rightDockCollapsed;
      this.state.bottomCollapsed = !!ds.bottomCollapsed;
      this.state.fullscreen = !!ds.fullscreen;
    }

    // PlaceCtx (Asset + Slot)
    const pc = wa.placeCtx && typeof wa.placeCtx === "object" ? wa.placeCtx : null;
    if (pc) {
      this.state.placeCtx.projectAssetId = pc.projectAssetId ? String(pc.projectAssetId) : null;
      this.state.placeCtx.slotId = pc.slotId ? String(pc.slotId) : null;

      // Optional: wenn wir ein Asset im Store finden, setzen wir die Selection
      // (damit rechts sofort die Place-Sektion erscheint).
      const pid = this.state.placeCtx.projectAssetId;
      if (pid) {
        const assets = this._getProjectAssetsFromStore();
        const pa = assets.find((x) => String(x?.id) === String(pid));
        if (pa) {
          const defSlot = this._getDefaultSlotForProjectAsset(pa);
          const slotId = this.state.placeCtx.slotId || defSlot?.id || null;
          this.state.selectionPoint = null;
          this.state.selection = {
            id: pa.id || "PA-unknown",
            type: "projectAsset",
            data: {
              id: pa.id,
              type: "projectAsset",
              meta: { name: pa.name || pa.id || "Asset" },
              place: { projectAssetId: pa.id || null, slotId },
              projectAsset: pa
            }
          };
          this.state.placeCtx.slotId = slotId;
        }
      }
    }

    // Wenn UI bereits gerendert ist, aktualisieren wir die sichtbaren Teile.
    if (this._mounted) {
      try {
        if (this._els.modeSelect) this._els.modeSelect.value = this.state.modeId;
        this._renderLeftTabs();
        this._renderRightTabs();
        this._renderLeftPanel();
        this._renderRightPanel();
        this._renderBottomBar();
        this._renderTopbar();
      } catch {}
    }

    // Debug (leise): beim Mount geben wir einen kleinen Hinweis, damit du
    // sofort siehst, dass das Restore wirklich greift.
    if (reason === "mount") {
      this._setStatus("Workarea: UI-State wiederhergestellt (Step 5C)");
    }
  }

  _publishModeChanged(reason) {
    this.bus?.emit?.("cb:workarea:mode:changed", {
      modeId: this.state.modeId,
      prevModeId: null,
      reason
    });
  }

  _setSelectionType(type) {
    this.state.selection = this._makeDummySelection(type);
    this._publishSelectionChanged("ui");
    this._renderRightPanel();
  }

  _cycleDummySelection() {
    const order = ["project", "hall.procedural", "asset.glb", "conveyor.segment"];
    const cur = this.state.selection?.type || "project";
    const i = Math.max(0, order.indexOf(cur));
    const next = order[(i + 1) % order.length];
    this._setSelectionType(next);
  }

  /* ==========================================================================
   * Step 5A: ProjectAssets aus Store + Selection
   * ==========================================================================
   * Ziel:
   * - Assets Tab listet echte ProjectAssets (app.project.projectAssets)
   * - Click setzt Selection (type:"projectAsset") -> Properties rechts sichtbar
   *
   * WICHTIG:
   * - Kein Import/Write (0 Risiko). Nur Lesen + Selection-State.
   */

  
  /**
   * Slot-Thumbnail lookup (project-gebunden):
   * - sucht im aktuellen Projekt die Slot-Daten (projectAssetId + slotId)
   * - liefert dataUrl oder null
   */
  _getSlotThumbnailDataUrl(projectAssetId, slotId, preferredView = "perspective") {
    try {
      if (!projectAssetId || !slotId) return null;
      const assets = this._getProjectAssetsFromStore();
      const a = assets.find((x) => x && String(x.id) === String(projectAssetId));
      if (!a || !Array.isArray(a.slots)) return null;
      const s = a.slots.find((y) => y && String(y.id) === String(slotId));
      const t = s?.thumbnail;

      // Multi-View (Cybermotion): slot.thumbnail.views.{top/front/right/perspective}
      const pv = (typeof preferredView === "string" && preferredView) ? preferredView : "perspective";

      // 1) preferredView
      const mv = t?.views?.[pv]?.dataUrl;
      if (typeof mv === "string" && mv.startsWith("data:image")) return mv;

      // 2) defaultView
      const defKey = t?.defaultView;
      const def = defKey ? t?.views?.[defKey]?.dataUrl : null;
      if (typeof def === "string" && def.startsWith("data:image")) return def;

      // 3) perspective fallback
      const persp = t?.views?.perspective?.dataUrl;
      if (typeof persp === "string" && persp.startsWith("data:image")) return persp;

      // 4) legacy
      const du = t?.dataUrl;
      return typeof du === "string" && du.startsWith("data:image") ? du : null;
    } catch (e) {
      return null;
    }
  }

  _getOrCreateThumbImage(dataUrl) {
    if (!dataUrl) return null;
    // Defensive: Falls ein Stand ohne ctor-init oder ein "this"-Kontextfehler
    // reinkommt, darf das UI nicht crashen.
    if (!this._thumbCache || typeof this._thumbCache.get !== "function") {
      this._thumbCache = new Map();
      this._thumbCacheKeys = [];
      this._thumbCacheMax = this._thumbCacheMax || 96;
    }

    const key = String(dataUrl);
    const cached = this._thumbCache.get(key);
    if (cached) return cached;
    const img = new Image();
    img.decoding = "async";
    img.loading = "lazy";
    img.src = key;
    this._thumbCache.set(key, img);

    // Soft-LRU (einfach): wir merken die Keys in Einfügereihenfolge und
    // löschen die ältesten, sobald das Limit überschritten ist.
    if (Array.isArray(this._thumbCacheKeys)) {
      this._thumbCacheKeys.push(key);
      const limit = Math.max(16, Number(this._thumbCacheMax) || 96);
      while (this._thumbCacheKeys.length > limit) {
        const drop = this._thumbCacheKeys.shift();
        if (drop && drop !== key) this._thumbCache.delete(drop);
      }
    }

    // optional: wenn Image geladen wurde -> einmal "nachdrehen".
    // Hintergrund:
    // - Der Viewport rendert zwar per RAF dauerhaft, aber auf iOS/Safari kann
    //   ein Image-Decode "spät" kommen (oder tabbed), und wir wollen sicher
    //   sein, dass spätestens nach dem Decode ein Frame gerendert wurde.
    // - Wir rufen NUR ein leichtes 2D-Render an (kein State-Write).
    img.onload = () => {
      try {
        if (this._vp?.canvas && this._vp?.ctx2d) this._renderViewport2D(0);
      } catch {}
    };

    // optional: wenn Image Fehler -> aus Cache entfernen
    img.onerror = () => {
      this._thumbCache.delete(key);
      if (Array.isArray(this._thumbCacheKeys)) {
        const idx = this._thumbCacheKeys.indexOf(key);
        if (idx >= 0) this._thumbCacheKeys.splice(idx, 1);
      }
    };
    return img;
  }

_getProjectAssetsFromStore() {
    const app = this.store?.get?.("app") || {};
    const project = app.project || {};
    const list = Array.isArray(project.projectAssets) ? project.projectAssets : [];
    return list;
  }

  _slotHasModel(slot) {
    // Konsistent mit ProjectAssetsPanel:
    // "Hat Modelle"-Erkennung über hasModel|exportRef|model|lastImportName
    if (!slot) return false;
    if (slot.hasModel === true) return true;
    if (slot.exportRef) return true;
    if (slot.model) return true;
    if (typeof slot.lastImportName === "string" && slot.lastImportName.trim()) return true;
    return false;
  }

  _projectAssetHasAnyModel(pa) {
    const slots = Array.isArray(pa?.slots) ? pa.slots : [];
    return slots.some((s) => this._slotHasModel(s));
  }

  _selectProjectAsset(pa, reason = "select") {
    if (!pa) return;

    // Step 5B: Default Place-Context setzen (Asset + Slot)
    // - Slot: bevorzugt erster Slot mit Model
    // - Damit kann Place-Mode sofort instanziieren.
    const defSlot = this._getDefaultSlotForProjectAsset(pa);
    this.state.placeCtx.projectAssetId = pa.id || null;
    this.state.placeCtx.slotId = defSlot?.id || null;

    // Step 5C: Merken, welches Asset/Slot zuletzt für Place gewählt wurde.
    this._persistWorkareaUiToStore("selectProjectAsset");

    // SelectionPoint im Viewport nicht anfassen (wir selektieren hier ein "Asset", kein World-Punkt)
    this.state.selectionPoint = null;

    this.state.selection = {
      id: pa.id || "PA-unknown",
      type: "projectAsset",
      data: {
        id: pa.id,
        type: "projectAsset",
        meta: {
          name: pa.name || pa.id || "Asset"
        },
        place: {
          projectAssetId: pa.id || null,
          slotId: defSlot?.id || null
        },
        projectAsset: pa
      }
    };

    this._publishSelectionChanged(reason);
    this._setStatus(`Asset selektiert: ${pa.name || pa.id}`);
  }

  _publishSelectionChanged(reason) {
    const s = this.state.selection || this._makeDummySelection("project");
    this.bus?.emit?.("cb:scene:selection:changed", {
      activeId: s.id,
      ids: [s.id],
      type: s.type,
      reason
    });
  }

  _toggleConsole() {
    this.state.consoleOpen = !this.state.consoleOpen;
    if (this._els.consoleDrawer) {
      this._els.consoleDrawer.style.display = this.state.consoleOpen ? "block" : "none";
    }
    this._setStatus(this.state.consoleOpen ? "Console geöffnet" : "Console geschlossen");
  }

  _setStatus(text) {
    if (this._els.statusLine) this._els.statusLine.textContent = text || "";
  }

  _crashLog(event, data = null) {
    try {
      const rec = window.BP_CRASH_RECORDER;
      if (!rec?.log) return null;
      return rec.log(event, {
        panel: "workarea",
        mode: this.state?.modeId || null,
        objects: this._scene?.objects?.length || 0,
        ...((data && typeof data === "object") ? data : (data == null ? {} : { value: data }))
      });
    } catch {
      return null;
    }
  }

  _estimateStoreSnapshotBytes() {
    try {
      const app = this.store?.get?.("app");
      if (!app) return 0;
      return window.BP_CRASH_RECORDER?.sizeOf?.(app) || JSON.stringify(app).length || 0;
    } catch {
      return 0;
    }
  }

  async _copyWorkareaCrashLog() {
    try {
      const rec = window.BP_CRASH_RECORDER;
      if (!rec) {
        this._setStatus("Crash Recorder ist nicht aktiv");
        return;
      }

      this._crashLog("workarea:crashlog:copy-request", {
        storeBytes: this._estimateStoreSnapshotBytes(),
        canvas: { w: this._vp?.w || 0, h: this._vp?.h || 0, dpr: this._vp?.dpr || 1 },
        zoom: this._vp?.zoom || 1
      });

      const ok = await rec.copy();
      const txt = rec.showInSnapshot?.() || rec.text?.() || "";
      this._setStatus(ok ? `CrashLog kopiert (${txt.length} Zeichen)` : "CrashLog im Snapshot angezeigt, Kopieren fehlgeschlagen");
    } catch (e) {
      console.error("[workarea] crash log copy failed", e);
      this._setStatus(`CrashLog Fehler: ${String(e?.message || e)}`);
    }
  }

  /* ==========================================================================
   * Viewport: mount/unmount/loop
   * ========================================================================= */

  _mountViewportCanvas(hostEl) {
    if (!hostEl) return;

    this._vp.host = hostEl;
    this._crashLog("workarea:viewport:mount", { host: !!hostEl });

    const c = document.createElement("canvas");
    c.style.width = "100%";
    c.style.height = "100%";
    c.style.display = "block";
    c.style.touchAction = "none";
    hostEl.appendChild(c);

    const ctx = c.getContext("2d", { alpha: true, desynchronized: true });
    this._vp.canvas = c;
    this._vp.ctx2d = ctx;

    // Pointer/Wheel Events
    c.addEventListener("pointerdown", (ev) => this._onViewportPointerDown(ev), { passive: false });
    c.addEventListener("pointermove", (ev) => this._onViewportPointerMove(ev), { passive: false });
    c.addEventListener("pointerup", (ev) => this._onViewportPointerUp(ev), { passive: false });
    c.addEventListener("pointercancel", (ev) => this._onViewportPointerUp(ev), { passive: false });
    c.addEventListener("wheel", (ev) => this._onViewportWheel(ev), { passive: false });

    // PATCH_workarea_mobile_resize_guard_v3:
    // ResizeObserver darf auf iOS/Safari nicht mehr direkt den Canvas neu
    // dimensionieren. Stattdessen geht alles über den Guard.
    const ro = new ResizeObserver(() => {
      this._requestViewportCanvasResize("resize-observer");
    });
    ro.observe(hostEl);
    this._vp.ro = ro;

    // Initialer Mount darf sofort und erzwungen anwenden.
    // PATCH v3: Guard-Zähler beim Mount zurücksetzen, damit alte Mobile-
    // Höhenwechsel aus einem früheren Panel-Leben nicht weiterwirken.
    try {
      const G = this._mobileResizeGuard;
      if (G) {
        G.mountAt = performance.now();
        G.mobileHeightLocked = false;
        G.timer = 0;
        G.finalTimer = 0;
        G.lastRequestAt = 0;
        G.lastApplyAt = 0;
        G.lastApplied = { w: 0, h: 0, dpr: 1, bw: 0, bh: 0 };
        G.requested = 0;
        G.applied = 0;
        G.ignoredHeightNoise = 0;
        G.throttled = 0;
        G.ignoredDuringGesture = 0;
        G.startupGrowApplied = 0;
      }
    } catch {}

    this._resizeViewportCanvas("mount:init", { force: true });

    this._vp.running = true;
    this._vp.t0 = performance.now();
    this._vp.raf = requestAnimationFrame((t) => this._viewportLoop(t));
  }

  _unmountViewportCanvas() {
    this._crashLog("workarea:viewport:unmount", { w: this._vp?.w || 0, h: this._vp?.h || 0 });
    if (this._vp.raf) cancelAnimationFrame(this._vp.raf);
    this._vp.raf = 0;
    this._vp.running = false;

    try {
      this._vp.ro?.disconnect?.();
    } catch {}
    this._vp.ro = null;

    try {
      if (this._vp.canvas && this._vp.canvas.parentNode) {
        this._vp.canvas.parentNode.removeChild(this._vp.canvas);
      }
    } catch {}

    this._vp.canvas = null;
    this._vp.ctx2d = null;
    this._vp.host = null;
    this._vp.w = 0;
    this._vp.h = 0;
  }

  // -------------------------------------------------------------------
  // PATCH_workarea_mobile_resize_guard_v3
  // -------------------------------------------------------------------

  _isMobileResizeGuardEnvironment() {
    try {
      const lm = this._detectWorkareaLayoutMode?.();
      if (lm?.mode === "mobile" || lm?.mode === "tablet") return true;

      const ua = String(navigator?.userAgent || "");
      const touch = Number(navigator?.maxTouchPoints || 0) || 0;
      const coarse = !!window.matchMedia?.("(pointer: coarse)")?.matches;

      return /iPhone|iPad|iPod|Android/i.test(ua) || touch > 1 || coarse;
    } catch {
      return true;
    }
  }

  _getViewportHostSizeSnapshot() {
    const host = this._vp?.host;
    if (!host || typeof host.getBoundingClientRect !== "function") return null;

    const r = host.getBoundingClientRect();
    const w = Math.max(1, Math.floor(Number(r.width || 0)));
    const h = Math.max(1, Math.floor(Number(r.height || 0)));

    const cap = Number(this._cfg?.dprCap ?? 2) || 2;
    const dpr = Math.min(cap, Number(window.devicePixelRatio || 1) || 1);

    return {
      w,
      h,
      dpr,
      bw: Math.floor(w * dpr),
      bh: Math.floor(h * dpr)
    };
  }

  _requestViewportCanvasResize(reason = "resize-request", opts = {}) {
    const G = this._mobileResizeGuard;
    if (!G?.enabled) {
      this._resizeViewportCanvas(reason, opts);
      return;
    }

    G.requested = (G.requested || 0) + 1;
    G.lastRequestAt = performance.now();
    G.lastReason = String(reason || "resize-request");

    if (G.timer) clearTimeout(G.timer);

    // Kleine Verzögerung bündelt ResizeObserver-Bursts.
    G.timer = setTimeout(() => {
      G.timer = 0;
      this._resizeViewportCanvas(G.lastReason || reason, opts);
    }, 80);

    // Finaler Sync nach Ruhezeit.
    // PATCH v3: Auf Mobile NICHT mehr stumpf mit force:true erzwingen. Genau
    // dieser erzwungene Final-Sync hat in v2 die 377/425px-Höhenflips doch
    // wieder angewendet und damit eine neue Resize-Kaskade gestartet.
    if (G.finalTimer) clearTimeout(G.finalTimer);
    G.finalTimer = setTimeout(() => {
      G.finalTimer = 0;

      const mobile = this._isMobileResizeGuardEnvironment();
      this._resizeViewportCanvas(`${G.lastReason || reason}:final`, {
        ...opts,
        force: !mobile,
        finalSync: true
      });
    }, Math.max(500, Number(G.finalSyncMs || 1800)));
  }

  _shouldDeferOrIgnoreViewportResize(nextSize, reason = "resize", opts = {}) {
    const G = this._mobileResizeGuard;
    if (!G?.enabled) return { action: "apply", why: "disabled" };
    if (!nextSize) return { action: "ignore", why: "no-size" };

    const now = performance.now();
    const last = G.lastApplied || {};
    const isMobile = this._isMobileResizeGuardEnvironment();

    const prevW = Number(last.w || 0);
    const prevH = Number(last.h || 0);
    const prevDpr = Number(last.dpr || 1);

    // Erster echter Resize und Mount-Init immer anwenden.
    if (!prevW || !prevH) return { action: "apply", why: "first" };
    if (opts?.force && String(reason || "").includes("mount:init")) return { action: "apply", why: "mount-force" };

    const nextW = Number(nextSize.w || 0);
    const nextH = Number(nextSize.h || 0);
    const nextDpr = Number(nextSize.dpr || 1);

    const sameW = Math.abs(nextW - prevW) <= 1;
    const sameDpr = Math.abs(nextDpr - prevDpr) < 0.01;
    const hDelta = Math.abs(nextH - prevH);
    const pureHeightChange = sameW && sameDpr && hDelta > 0;

    const P = this._vp?.pointer;
    const activePointers = Number(P?.active?.size || 0);
    const gestureActive = activePointers > 0 || !!P?.isPanning || !!P?.isPinching || !!P?.dragActive || !!P?.dragObjId;

    // PATCH v3: Reine Mobile-Höhenwechsel während Touch/Pan/Drag nie anwenden.
    // Das verhindert Safari-Reloads durch Canvas-Rebuild mitten in einer Geste.
    if (isMobile && pureHeightChange && gestureActive) {
      G.ignoredDuringGesture = (G.ignoredDuringGesture || 0) + 1;
      G.ignoredHeightNoise = (G.ignoredHeightNoise || 0) + 1;
      if (!G._lastGestureNoiseLogAt || now - G._lastGestureNoiseLogAt > 2200) {
        G._lastGestureNoiseLogAt = now;
        this._crashLog("workarea:viewport:resize:ignored-during-gesture", {
          version: G.version,
          reason,
          w: nextW,
          h: nextH,
          prevH,
          hDelta,
          activePointers,
          ignoredDuringGesture: G.ignoredDuringGesture
        });
      }
      return { action: "ignore", why: "mobile-height-during-gesture" };
    }

    // PATCH v3: Einmaliges Hochwachsen nach Mount erlauben.
    // Direkt nach dem Öffnen meldet Safari oft zuerst eine zu kleine Höhe (z.B. 334)
    // und kurz danach die echte nutzbare Höhe (z.B. 425). Dieses eine Wachstum ist ok.
    const startupAge = now - Number(G.mountAt || 0);
    const startupGrowAllowed = !!G.mobileStartupGrowOnce &&
      !G.mobileHeightLocked &&
      Number(G.startupGrowApplied || 0) < 1 &&
      startupAge >= 0 &&
      startupAge <= Number(G.mobileStartupGrowMs || 12000) &&
      nextH > prevH &&
      hDelta >= Number(G.mobileStartupGrowMinPx || 60);

    if (isMobile && pureHeightChange && startupGrowAllowed) {
      G.startupGrowApplied = Number(G.startupGrowApplied || 0) + 1;
      return { action: "apply", why: "mobile-startup-grow-once" };
    }

    // PATCH v3: Danach reine Höhenflips auf Mobile blocken – auch wenn finalSync
    // oder throttled-flush läuft. Breite/DPR-Wechsel bleiben echte Resizes.
    if (
      isMobile &&
      pureHeightChange &&
      !!G.mobilePureHeightLock &&
      hDelta <= Number(G.mobileHeightNoisePx || 160)
    ) {
      G.mobileHeightLocked = true;
      G.ignoredHeightNoise = (G.ignoredHeightNoise || 0) + 1;

      if (!G._lastNoiseLogAt || now - G._lastNoiseLogAt > 2200) {
        G._lastNoiseLogAt = now;
        this._crashLog("workarea:viewport:resize:ignored-height-lock", {
          version: G.version,
          reason,
          w: nextW,
          h: nextH,
          prevH,
          hDelta,
          ignored: G.ignoredHeightNoise,
          finalSync: !!opts?.finalSync,
          force: !!opts?.force
        });
      }

      return { action: "ignore", why: "mobile-height-lock" };
    }

    // Nur echte Force-Resizes außerhalb der Mobile-Höhenlocks durchlassen.
    if (opts?.force) return { action: "apply", why: "force" };

    // Harte Drosselung:
    // Wenn gerade erst ein Resize angewendet wurde, wird der nächste gebündelt.
    const sinceApply = now - Number(G.lastApplyAt || 0);
    const throttleMs = Math.max(120, Number(G.throttleMs || 420));
    if (sinceApply >= 0 && sinceApply < throttleMs) {
      G.throttled = (G.throttled || 0) + 1;

      if (G.timer) clearTimeout(G.timer);
      G.timer = setTimeout(() => {
        G.timer = 0;
        this._resizeViewportCanvas(`${reason}:throttled-flush`, { finalSync: true, force: !isMobile });
      }, throttleMs - sinceApply + 30);

      return { action: "defer", why: "throttle" };
    }

    return { action: "apply", why: "normal" };
  }

  _resizeViewportCanvas(reason = "resize", opts = {}) {
    const host = this._vp.host;
    const c = this._vp.canvas;
    if (!host || !c) return;

    const size = this._getViewportHostSizeSnapshot();
    if (!size) return;

    const G = this._mobileResizeGuard;
    const decision = this._shouldDeferOrIgnoreViewportResize(size, reason, opts);

    if (decision.action === "ignore") {
      return;
    }

    if (decision.action === "defer") {
      try {
        this._crashLog("workarea:viewport:resize:deferred", {
          version: G?.version || "n/a",
          reason,
          why: decision.why,
          w: size.w,
          h: size.h,
          dpr: size.dpr,
          throttled: G?.throttled || 0
        });
      } catch {}
      return;
    }

    const { w, h, dpr, bw, bh } = size;

    if (c.width !== bw || c.height !== bh) {
      c.width = bw;
      c.height = bh;
      this._vp.w = w;
      this._vp.h = h;
      this._vp.dpr = dpr;

      try {
        if (!this._crashDiag) this._crashDiag = {};
        this._crashDiag.resizeCount = (this._crashDiag.resizeCount || 0) + 1;

        if (G) {
          G.applied = (G.applied || 0) + 1;
          G.lastApplyAt = performance.now();
          G.lastApplied = { w, h, dpr, bw, bh };
          if (this._isMobileResizeGuardEnvironment?.() && h >= 390) {
            G.mobileHeightLocked = true;
          }
        }

        const now = performance.now();
        if (!this._crashDiag.lastResizeLogAt || now - this._crashDiag.lastResizeLogAt > 1200 || opts?.force) {
          this._crashDiag.lastResizeLogAt = now;
          this._crashLog("workarea:viewport:resize", {
            version: G?.version || "legacy",
            reason,
            w,
            h,
            dpr,
            bw,
            bh,
            count: this._crashDiag.resizeCount,
            requested: G?.requested || 0,
            applied: G?.applied || 0,
            ignoredHeightNoise: G?.ignoredHeightNoise || 0,
            throttled: G?.throttled || 0,
            force: !!opts?.force
          });
        }
      } catch {}
    }

    // LayoutDiag nur noch leicht und ohne Topbar-Rebuild nachführen.
    // Dadurch entsteht keine Resize -> Diag -> Topbar -> Resize Schleife mehr.
    try {
      this._refreshWorkareaLayoutDiagnostics("viewport-resize", { renderTopbar: false });
    } catch {}
  }

  _viewportLoop(t) {
    if (!this._vp.running) return;

    const dt = Math.max(0, t - (this._vp.t0 || t));
    this._vp.t0 = t;

    if (dt > 0) {
      const fpsNow = 1000 / dt;
      this._vp._fpsAcc += fpsNow;
      this._vp._fpsN += 1;
      if (this._vp._fpsN >= 10) {
        this._vp.fps = this._vp._fpsAcc / this._vp._fpsN;
        this._vp._fpsAcc = 0;
        this._vp._fpsN = 0;
      }
    }

    this._renderViewport2DThrottled(dt, t);
    this._vp.raf = requestAnimationFrame((tt) => this._viewportLoop(tt));
  }

  _isMobileDragEnvironment() {
    try {
      const ua = String(navigator.userAgent || "");
      const coarse = !!window.matchMedia?.("(pointer: coarse)")?.matches;
      const touch = Number(navigator.maxTouchPoints || 0) > 0;
      return /iPhone|iPad|iPod|Android/i.test(ua) || coarse || touch;
    } catch {
      return true;
    }
  }

  _enterMobileDragLowPower(source, ev = null) {
    const M = this._mobileDrag;
    if (!M || !M.enabled || !this._isMobileDragEnvironment()) return;

    M.moveCount += 1;

    if (M.lowPower) return;

    M.lowPower = true;
    M.pointerId = ev?.pointerId ?? M.pointerId ?? null;
    M.dragObjId = this._vp?.pointer?.dragObjId || null;
    M.enterAt = performance.now();
    M.renderCount = 0;
    M.skippedFrames = 0;
    M.lastRenderAt = 0;

    try {
      this._crashLog("workarea:mobile-drag:low-power-enter", {
        version: M.version,
        source,
        pointerId: M.pointerId,
        dragObjId: M.dragObjId,
        objects: this._scene?.objects?.length || 0
      });
    } catch {}
  }

  _leaveMobileDragLowPower(source, ev = null) {
    const M = this._mobileDrag;
    if (!M || !M.lowPower) return;

    const duration = Math.round(performance.now() - (M.enterAt || performance.now()));
    M.lowPower = false;

    try {
      this._crashLog("workarea:mobile-drag:low-power-leave", {
        version: M.version,
        source,
        pointerId: ev?.pointerId ?? M.pointerId ?? null,
        dragObjId: M.dragObjId,
        duration,
        moveCount: M.moveCount,
        renderCount: M.renderCount,
        skippedFrames: M.skippedFrames
      });
    } catch {}

    M.pointerId = null;
    M.dragObjId = null;
    M.moveCount = 0;

    if (M.finalRenderTimer) {
      clearTimeout(M.finalRenderTimer);
      M.finalRenderTimer = 0;
    }

    M.finalRenderTimer = setTimeout(() => {
      try {
        this._renderViewport2D(0);
        this._crashLog("workarea:mobile-drag:final-render", {
          version: M.version,
          source
        });
      } catch (e) {
        this._crashLog("workarea:mobile-drag:final-render:error", {
          version: M.version,
          message: e?.message || String(e)
        });
      }
    }, 120);
  }

  _renderViewport2DThrottled(dt, now = performance.now()) {
    const M = this._mobileDrag;

    if (M?.lowPower) {
      const gap = Number(M.minRenderGapMs || 80);
      const enoughQuiet = !M.lastRenderAt || now - M.lastRenderAt >= gap;

      if (!enoughQuiet) {
        M.skippedFrames = (M.skippedFrames || 0) + 1;
        return;
      }

      M.lastRenderAt = now;
      M.renderCount = (M.renderCount || 0) + 1;
    }

    this._renderViewport2D(dt);
  }

  _renderViewport2D(dt) {
    const c = this._vp.canvas;
    const ctx = this._vp.ctx2d;
    if (!c || !ctx) return;

    const dpr = this._vp.dpr || 1;
    const w = c.width;
    const h = c.height;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const bg = String(this._cfg?.bgColor || "#f2f2f2");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    const zoom = Number(this._vp.zoom || 1);
    const ox = Number(this._vp.offsetX || 0);
    const oy = Number(this._vp.offsetY || 0);

    ctx.save();
    ctx.translate(w / 2 + ox, h / 2 + oy);
    ctx.scale(zoom, zoom);

    const gridOn = !!this._cfg?.gridEnabled;
    const baseStep = Number(this._cfg?.gridSize ?? 50) || 50;
    const step = Math.max(1, baseStep);

    const q = String(this._cfg?.quality || "medium");
    const minorA = q === "high" ? 0.1 : q === "low" ? 0.05 : 0.08;
    const majorA = q === "high" ? 0.16 : q === "low" ? 0.09 : 0.12;

    if (gridOn) {
      const invZ = 1 / Math.max(zoom, 1e-6);

      const left = (-w / 2 - ox) * invZ;
      const right = (w / 2 - ox) * invZ;
      const top = (-h / 2 - oy) * invZ;
      const bottom = (h / 2 - oy) * invZ;

      const startX = Math.floor(left / step) * step;
      const endX = Math.ceil(right / step) * step;
      const startY = Math.floor(top / step) * step;
      const endY = Math.ceil(bottom / step) * step;

      ctx.beginPath();
      ctx.strokeStyle = `rgba(0,0,0,${minorA})`;
      ctx.lineWidth = Math.max(1, Math.floor(1 * dpr)) / zoom;

      for (let x = startX; x <= endX; x += step) {
        ctx.moveTo(x, startY);
        ctx.lineTo(x, endY);
      }
      for (let y = startY; y <= endY; y += step) {
        ctx.moveTo(startX, y);
        ctx.lineTo(endX, y);
      }
      ctx.stroke();

      const major = step * 5;
      const sX2 = Math.floor(left / major) * major;
      const eX2 = Math.ceil(right / major) * major;
      const sY2 = Math.floor(top / major) * major;
      const eY2 = Math.ceil(bottom / major) * major;

      ctx.beginPath();
      ctx.strokeStyle = `rgba(0,0,0,${majorA})`;
      ctx.lineWidth = Math.max(1, Math.floor(2 * dpr)) / zoom;

      for (let x = sX2; x <= eX2; x += major) {
        ctx.moveTo(x, sY2);
        ctx.lineTo(x, eY2);
      }
      for (let y = sY2; y <= eY2; y += major) {
        ctx.moveTo(sX2, y);
        ctx.lineTo(eX2, y);
      }
      ctx.stroke();
    }

    // Crosshair
    ctx.strokeStyle = "rgba(0,0,0,0.25)";
    ctx.lineWidth = Math.max(1, Math.floor(2 * dpr)) / zoom;
    ctx.beginPath();
    ctx.moveTo(-20, 0);
    ctx.lineTo(20, 0);
    ctx.moveTo(0, -20);
    ctx.lineTo(0, 20);
    ctx.stroke();

    // -------------------------------------------------------------------
    // Step 5H (requested): Typ-spezifisches 2D Rendering
    // -------------------------------------------------------------------
    // Bisher war die Workarea bewusst „Dummy“ (alles als Kreis), damit
    // HitTest/Drag/Selection stabil ist.
    //
    // Du willst jetzt aber visuell unterscheiden können:
    //  - conveyor.segment
    //  - hall.procedural
    //  - asset.glb
    //  - asset.instance
    //
    // Das hier ist weiterhin 2D-Placeholder-Rendering (keine echte 3D
    // Geometrie), aber typ-spezifisch (Form + Label), sodass du nach
    // Reload/Tab-Schließen sofort erkennst, *was* da liegt.
    //
    // WICHTIG:
    // - Wir ändern NICHT die Daten (Scene bleibt JSON) und NICHT den
    //   HitTest-Mechanismus (r bleibt der Default Radius).
    // - Wenn später echte 3D-Preview kommt, bleibt das hier als
    //   Fallback/Debug-Overlay sinnvoll.
    // -------------------------------------------------------------------
    for (const o of this._scene?.objects || []) {
      this._drawSceneObject2D(ctx, o, { dpr, zoom });
    }

    // Selection marker
    if (this.state.selectionPoint) {
      const { wx, wy } = this.state.selectionPoint;
      ctx.beginPath();
      ctx.strokeStyle = "rgba(0,128,255,0.9)";
      ctx.lineWidth = (2 * dpr) / zoom;
      ctx.arc(wx, wy, 10, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();

    // Overlay
    ctx.fillStyle = "rgba(0,0,0,0.65)";
    ctx.font = `${Math.floor(12 * dpr)}px system-ui, -apple-system, Segoe UI, Roboto, Arial`;

    const lines = [
      `Viewport Step 4 (Pan/Zoom/Grid + HitTest + Drag)`,
      `Mode: ${this.state.modeId} | Select: Tap=Select, Drag Obj=Move, Drag leer=Pan | Pan: Drag=Pan`,
      `Grid: ${this._cfg?.gridEnabled ? "on" : "off"} (${this._cfg?.gridSize || 50})  Snap: ${
        this._cfg?.snapEnabled ? "on" : "off"
      }`,
      `Zoom: ${zoom.toFixed(2)}  Offset: ${Math.round(ox)}/${Math.round(oy)}`,
      `Size: ${this._vp.w}×${this._vp.h}  DPR:${(this._vp.dpr || 1).toFixed(2)}`,
      `dt: ${dt.toFixed(1)}ms  fps: ${this._vp.fps ? this._vp.fps.toFixed(1) : "…"}`
    ];

    const pad = Math.floor(10 * dpr);
    let y = pad + Math.floor(14 * dpr);
    for (const line of lines) {
      ctx.fillText(line, pad, y);
      y += Math.floor(16 * dpr);
    }
  }

  /* ==========================================================================
   * Step 5H: Scene 2D Renderer (typ-spezifisch)
   * ========================================================================= */

  /**
   * Zeichnet ein Scene-Objekt in der 2D Workarea.
   *
   * WICHTIG: Das ist ein Platzhalter-Renderer.
   * - Wir zeichnen bewusst simple Formen, aber pro Typ unterschiedlich.
   * - HitTest/Drag bleibt weiterhin über `o.r` (Radius) kompatibel.
   */
  _drawSceneObject2D(ctx, o, { dpr = 1, zoom = 1 } = {}) {
    if (!o) return;

    const t = String(o.type || "unknown");
    const x = Number(o.x || 0);
    const y = Number(o.y || 0);
    const r = Math.max(6, Number(o.r || 20));

    // Rotation (Grad → Rad). r bleibt Hit-Radius!
    const rotDeg = Number.isFinite(Number(o.rotDeg)) ? Number(o.rotDeg) : 0;
    const rotRad = (rotDeg * Math.PI) / 180;

    // Linienbreite in World-Space konstant halten.
    const lw = (2 * dpr) / Math.max(zoom, 1e-6);

    // Mini-Label (nur wenn wir genügend Platz haben)
    const label = String(o.name || t);

    // Helper: Label
    const drawLabel = (text, dx = 0, dy = 0) => {
      // Kleine Schrift – Weltmaßstabsstabil
      ctx.save();
      ctx.fillStyle = "rgba(0,0,0,0.75)";
      ctx.font = `${Math.max(10, Math.floor(12 * dpr))}px system-ui, -apple-system, Segoe UI, Roboto, Arial`;
      ctx.fillText(text, x + dx, y + dy);
      ctx.restore();
    };

    // Helper: Mittelpunkt
    const drawCenterDot = () => {
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.beginPath();
      ctx.arc(x, y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    };

    // Typ-spezifisch
    if (t === "conveyor.segment") {
      // Rechteck + „Rollen“ Linien
      const w = r * 3.2;
      const h = r * 1.4;
      ctx.save();
      ctx.translate(x, y);
      if (Math.abs(rotRad) > 1e-6) ctx.rotate(rotRad);

      ctx.lineWidth = lw;
      ctx.strokeStyle = "rgba(0,0,0,0.45)";
      ctx.fillStyle = "rgba(0,0,0,0.05)";
      ctx.beginPath();
      ctx.rect(-w / 2, -h / 2, w, h);
      ctx.fill();
      ctx.stroke();

      // Rollen
      ctx.strokeStyle = "rgba(0,0,0,0.25)";
      ctx.beginPath();
      const n = 6;
      for (let i = 1; i < n; i++) {
        const xx = -w / 2 + (w * i) / n;
        ctx.moveTo(xx, -h / 2);
        ctx.lineTo(xx, +h / 2);
      }
      ctx.stroke();

      ctx.restore();

      drawCenterDot();
      drawLabel(`Conveyor: ${label}`, -w / 2, -h / 2 - 6);
      return;
    }

    if (t === "hall.procedural") {
      // L-Form (Ecke)
      const w = r * 3.2;
      const h = r * 3.2;
      const th = Math.max(lw * 2.2, r * 0.45);

      ctx.save();
      ctx.translate(x, y);
      if (Math.abs(rotRad) > 1e-6) ctx.rotate(rotRad);

      ctx.lineWidth = lw;
      ctx.strokeStyle = "rgba(0,0,0,0.45)";
      ctx.fillStyle = "rgba(0,0,0,0.03)";
      ctx.beginPath();
      // Horizontaler Schenkel
      ctx.rect(-w / 2, -h / 2, w, th);
      // Vertikaler Schenkel
      ctx.rect(-w / 2, -h / 2, th, h);
      ctx.fill();
      ctx.stroke();

      ctx.restore();

      drawCenterDot();
      drawLabel(`Hall: ${label}`, -w / 2, -h / 2 - 6);
      return;
    }

    if (t === "asset.glb") {
      // „Box“-Icon (3D Asset)
      const s = r * 2.4;
      ctx.save();
      ctx.translate(x, y);
      if (Math.abs(rotRad) > 1e-6) ctx.rotate(rotRad);

      ctx.lineWidth = lw;
      ctx.strokeStyle = "rgba(0,0,0,0.45)";
      ctx.fillStyle = "rgba(0,0,0,0.04)";
      ctx.beginPath();
      ctx.rect(-s / 2, -s / 2, s, s);
      ctx.fill();
      ctx.stroke();

      // Diagonale „Kante“
      ctx.strokeStyle = "rgba(0,0,0,0.25)";
      ctx.beginPath();
      ctx.moveTo(-s / 2, 0);
      ctx.lineTo(0, -s / 2);
      ctx.lineTo(+s / 2, 0);
      ctx.lineTo(0, +s / 2);
      ctx.closePath();
      ctx.stroke();

      ctx.restore();

      drawCenterDot();
      drawLabel(`GLB: ${label}`, -s / 2, -s / 2 - 6);
      return;
    }

    if (t === "assembly.instance") {
      // Baugruppe: Rechteck aus w/h, mit einfachen Rollenlinien als Master-Preview.
      const w = Math.max(r * 2.2, Math.min(420, Math.abs(Number(o.w || o.width || o.config?.lengthMm || r * 4))));
      const h = Math.max(r * 1.0, Math.min(180, Math.abs(Number(o.h || o.height || o.config?.widthMm || r * 1.6))));

      ctx.save();
      ctx.translate(x, y);
      if (Math.abs(rotRad) > 1e-6) ctx.rotate(rotRad);

      ctx.lineWidth = lw;
      ctx.strokeStyle = "rgba(0,90,180,0.75)";
      ctx.fillStyle = "rgba(0,128,255,0.12)";
      ctx.beginPath();
      ctx.rect(-w / 2, -h / 2, w, h);
      ctx.fill();
      ctx.stroke();

      // Rollen / Segmente
      ctx.strokeStyle = "rgba(0,90,180,0.35)";
      ctx.beginPath();
      const n = Math.max(3, Math.min(10, Math.round(Number(o.config?.rollerCount || 5))));
      for (let i = 1; i < n; i++) {
        const xx = -w / 2 + (w * i) / n;
        ctx.moveTo(xx, -h / 2);
        ctx.lineTo(xx, +h / 2);
      }
      ctx.stroke();

      // AssemblyLab v1: Wenn die Baugruppe aus einzelnen Projekt-Asset-Bauteilen
      // zusammengesetzt wurde, zeigen wir die Bauteile als kleine lokale Marker.
      // Das ist noch kein echter GLB-Composite-Renderer, aber die Platzierung
      // (X/Y/Rotation) ist im Layout sofort sichtbar und bleibt editierbar.
      const comps = Array.isArray(o.components) ? o.components : [];
      if (comps.length) {
        ctx.save();
        ctx.lineWidth = Math.max(1, lw * 0.75);
        for (const c of comps) {
          if (!c || c.visible === false) continue;
          const cx = Math.max(-w / 2, Math.min(w / 2, Number(c.x || 0)));
          const cy = Math.max(-h / 2, Math.min(h / 2, Number(c.y || 0)));
          const cr = Math.max(7, Math.min(18, r * 0.18));
          ctx.save();
          ctx.translate(cx, cy);
          const crot = (Number(c.rotDeg || 0) * Math.PI) / 180;
          if (Math.abs(crot) > 1e-6) ctx.rotate(crot);
          const role = String(c.role || "component");
          ctx.fillStyle = "rgba(255,255,255,0.30)";
          ctx.strokeStyle = role === "drive" ? "rgba(220,120,0,0.90)" : role === "sensor" ? "rgba(0,150,80,0.90)" : role === "control" ? "rgba(120,70,200,0.90)" : "rgba(0,90,180,0.78)";
          ctx.beginPath();
          if (role === "sensor") {
            ctx.arc(0, 0, cr * 0.72, 0, Math.PI * 2);
          } else if (role === "drive") {
            ctx.rect(-cr, -cr, cr * 2, cr * 2);
          } else {
            ctx.rect(-cr, -cr * 0.65, cr * 2, cr * 1.3);
          }
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        }
        ctx.restore();
      }

      ctx.restore();
      drawCenterDot();
      drawLabel(`Asm: ${label}`, -w / 2, -h / 2 - 6);
      return;
    }

    if (t === "asset.instance") {
      // Instanz: Wenn Slot-Thumbnail vorhanden -> Bild rendern (echte Asset-Sichtbarkeit),
      // sonst Fallback-Kreis.

      // Im 2D-Layout (Viewport) wollen wir IMMER die Draufsicht.
      const dataUrl = this._getSlotThumbnailDataUrl(o.projectAssetId, o.slotId, "top");
      const img = dataUrl ? this._getOrCreateThumbImage(dataUrl) : null;

      // Bildgröße (world-space): orientiert sich am Hit-Radius r
      // + kleines Padding, damit das Thumb nicht "gezoomt" wirkt.
      const s = r * 3.0;
      const pad = Math.max(2, Math.round(s * 0.10));

      if (img && img.complete && img.naturalWidth > 0) {
        ctx.save();
        ctx.translate(x, y);
        if (Math.abs(rotRad) > 1e-6) ctx.rotate(rotRad);

        // Thumbnail: "cover" ohne Verzerrung, mit Padding
        // (füllt das Quadrat aus, beschneidet ggf. minimal – aber keine Stretch-Distorsion)
        const dx = -s / 2 + pad;
        const dy = -s / 2 + pad;
        const dw = s - pad * 2;
        const dh = s - pad * 2;

        // cover-rect
        const iw = img.naturalWidth || 1;
        const ih = img.naturalHeight || 1;
        const ir = iw / ih;
        const dr = dw / dh;

        let sw = iw;
        let sh = ih;
        let sx = 0;
        let sy = 0;

        if (ir > dr) {
          // Bild ist "breiter" -> links/rechts beschneiden
          sh = ih;
          sw = Math.round(ih * dr);
          sx = Math.round((iw - sw) / 2);
        } else {
          // Bild ist "höher" -> oben/unten beschneiden
          sw = iw;
          sh = Math.round(iw / dr);
          sy = Math.round((ih - sh) / 2);
        }

        ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
        ctx.restore();

        drawCenterDot();
        drawLabel(`Inst: ${label}`, -s / 2, -s / 2 - 6);
        return;
      }

      // Fallback: Kreis (stärker) + Slot-Tag
      ctx.lineWidth = lw;
      ctx.strokeStyle = "rgba(0,128,255,0.65)";
      ctx.fillStyle = "rgba(0,128,255,0.10)";
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      const slot = o.slotId ? String(o.slotId).slice(0, 6) : "";
      drawCenterDot();
      drawLabel(`Inst: ${label}${slot ? ` (${slot}…)` : ""}`, -r, -r - 6);
      return;
    }

    // Fallback (unbekannter Typ): klassischer Kreis
    ctx.beginPath();
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.lineWidth = lw;
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
    drawCenterDot();
    drawLabel(`${t}: ${label}`, -r, -r - 6);
  }

  /* ==========================================================================
   * Viewport Helpers (Pan/Zoom/Pointer)
   * ========================================================================= */

  _setViewportZoom(z, reason = "set") {
    const minZ = Number(this._cfg?.cameraMinZoom ?? 0.25) || 0.25;
    const maxZ = Number(this._cfg?.cameraMaxZoom ?? 4) || 4;
    const nz = Math.max(minZ, Math.min(maxZ, Number(z || 1)));
    this._vp.zoom = nz;

    try {
      const slider = this._els.topbar?.querySelector?.("[data-wk-zoom-slider='1']");
      if (slider) slider.value = String(nz);
    } catch {}

    this._setStatus(`Zoom: ${nz.toFixed(2)} (${reason})`);
  }

  _viewportClientToCanvasPx(ev) {
    const host = this._vp.host;
    const dpr = this._vp.dpr || 1;
    if (!host) return { x: 0, y: 0 };
    const r = host.getBoundingClientRect();
    return {
      x: (Number(ev.clientX || 0) - r.left) * dpr,
      y: (Number(ev.clientY || 0) - r.top) * dpr
    };
  }

  _screenCanvasToWorld(canvasPt) {
    const zoom = Number(this._vp.zoom || 1);
    const ox = Number(this._vp.offsetX || 0);
    const oy = Number(this._vp.offsetY || 0);

    const cx = (this._vp.canvas?.width || 0) / 2;
    const cy = (this._vp.canvas?.height || 0) / 2;

    return {
      wx: (canvasPt.x - cx - ox) / zoom,
      wy: (canvasPt.y - cy - oy) / zoom
    };
  }

  _applyZoomAtCanvasPoint(canvasPt, newZoom) {
    const minZ = Number(this._cfg?.cameraMinZoom ?? 0.25) || 0.25;
    const maxZ = Number(this._cfg?.cameraMaxZoom ?? 4) || 4;

    const oldZoom = Number(this._vp.zoom || 1);
    const nz = Math.max(minZ, Math.min(maxZ, Number(newZoom || 1)));
    if (!isFinite(nz) || nz <= 0) return;
    if (Math.abs(nz - oldZoom) < 1e-6) return;

    const ox = Number(this._vp.offsetX || 0);
    const oy = Number(this._vp.offsetY || 0);
    const cx = (this._vp.canvas?.width || 0) / 2;
    const cy = (this._vp.canvas?.height || 0) / 2;

    const wx = (canvasPt.x - cx - ox) / oldZoom;
    const wy = (canvasPt.y - cy - oy) / oldZoom;

    this._vp.zoom = nz;
    this._vp.offsetX = canvasPt.x - cx - wx * nz;
    this._vp.offsetY = canvasPt.y - cy - wy * nz;

    try {
      const slider = this._els.topbar?.querySelector?.("[data-wk-zoom-slider='1']");
      if (slider) slider.value = String(nz);
    } catch {}
  }

  _valuesToArray(it) {
    const out = [];
    for (const v of it) out.push(v);
    return out;
  }

  _findSceneObjectById(id) {
    const objs = this._scene?.objects || [];
    return objs.find((o) => o && o.id === id) || null;
  }

  _deleteSceneObjectById(id, reason = "delete") {
    if (!id) return;
    const objs = Array.isArray(this._scene?.objects) ? this._scene.objects : [];
    const before = objs.length;
    this._scene.objects = objs.filter((o) => o && o.id !== id);
    const after = this._scene.objects.length;

    // Selection resetten, damit Properties Panel nicht auf ein „totes“ Objekt zeigt
    if (before !== after) {
      try {
        this.state.selection = null;
        this.state.selectionPoint = null;
      } catch {}

      this._persistSceneToStore(reason);
      this._requestProjectSaveDebounced(reason);
      this._setStatus(`Gelöscht: ${id}`);
      this._renderRightPanel();
    }
  }

  _duplicateSceneObjectById(id, reason = "duplicate") {
    if (!id) return null;
    const src = this._findSceneObjectById(id);
    if (!src) return null;

    // Deep clone (Scene-Objekte sind JSON-safe)
    let copy = null;
    try {
      copy = JSON.parse(JSON.stringify(src));
    } catch {
      // Fallback: flache Kopie
      copy = { ...src };
    }

    // Neue ID (Typ-basiert: Instanzen behalten "inst"-Prefix)
    const prefix = String(src?.id || "").startsWith("inst-") || src?.type === "asset.instance" ? "inst" : "obj";
    copy.id = this._makeId(prefix);

    // Name: freundlich, aber eindeutig
    const baseName = String(src?.name || "Objekt");
    copy.name = `${baseName} (Kopie)`;

    // Sichtbarer Offset (Grid-Step). Wenn Snap aktiv ist, auf Grid runden.
    const step = this._getSnapStepWorld();
    copy.x = (Number(copy.x) || 0) + step;
    copy.y = (Number(copy.y) || 0) + step;
    if (this._cfg?.snapEnabled) {
      copy.x = Math.round(copy.x / step) * step;
      copy.y = Math.round(copy.y / step) * step;
    }

    // Safety: rotDeg bleibt erhalten (falls vorhanden) und wird normalisiert
    if (copy.rotDeg !== undefined) {
      const v = Number(copy.rotDeg);
      if (Number.isFinite(v)) copy.rotDeg = ((v % 360) + 360) % 360;
    }

    // Einfügen
    this._scene.objects = Array.isArray(this._scene?.objects) ? this._scene.objects : [];
    this._scene.objects.push(copy);

    // Selektiere neue Kopie
    try {
      this._setSelectionToObject(copy, "duplicate");
    } catch {}

    this._persistSceneToStore(reason);
    this._requestProjectSaveDebounced(reason);
    this._setStatus(`Dupliziert: ${src.id} → ${copy.id}`);
    this._renderRightPanel();
    return copy;
  }

  _hitTestWorldPoint(wx, wy) {
    const objs = this._scene?.objects || [];
    let best = null;
    let bestD2 = Infinity;

    for (const o of objs) {
      const dx = wx - o.x;
      const dy = wy - o.y;
      const d2 = dx * dx + dy * dy;
      const r = Math.max(1, Number(o.r || 20));
      if (d2 <= r * r && d2 < bestD2) {
        best = o;
        bestD2 = d2;
      }
    }
    return best;
  }

  _getTapThresholdPx() {
    return 6 * (this._vp.dpr || 1);
  }

  _getSnapStepWorld() {
    const base = Number(this._cfg?.gridSize ?? 50) || 50;
    return Math.max(1, base);
  }

  _applySnapToWorldPoint(world) {
    if (!this._cfg?.snapEnabled) return world;
    const step = this._getSnapStepWorld();
    world.wx = Math.round(world.wx / step) * step;
    world.wy = Math.round(world.wy / step) * step;
    return world;
  }

  _setSelectionToObject(o, reason = "viewport") {
    if (!o) return;
    this.state.selectionPoint = { wx: o.x, wy: o.y };
    this.state.selection = {
      id: o.id,
      type: o.type,
      data: {
        id: o.id,
        type: o.type,
        meta: { name: o.name },
        world: { x: o.x, y: o.y },

        // Step 6A: 2D Transform-Daten (Cybermotion-Style Basis)
        // rotDeg wird in der Scene persistiert und ist später 1:1 auf 3D/Gizmo übertragbar.
        transform2d: {
          rotDeg: Number.isFinite(Number(o.rotDeg)) ? Number(o.rotDeg) : 0
        }
      }
    };
    this._publishSelectionChanged(reason);
    this._renderRightPanel();
  }

  _setSelectionToPoint(world, reason = "viewport") {
    this.state.selectionPoint = world;
    this.state.selection = {
      id: "sel-point",
      type: "selection.point",
      data: {
        type: "selection.point",
        world: { x: world.wx, y: world.wy },
        zoom: this._vp.zoom
      }
    };
    this._publishSelectionChanged(reason);
    this._renderRightPanel();
  }

  _onViewportPointerDown(ev) {
    const c = this._vp.canvas;
    if (!c) return;

    try {
      ev.preventDefault?.();
    } catch {}
    try {
      c.setPointerCapture?.(ev.pointerId);
    } catch {}

    const pt = this._viewportClientToCanvasPx(ev);
    const P = this._vp.pointer;

    P.active.set(ev.pointerId, { x: pt.x, y: pt.y });
    P.down.set(ev.pointerId, { x: pt.x, y: pt.y });

    P.lastX = pt.x;
    P.lastY = pt.y;

    if (P.active.size === 2) {
      const pts = this._valuesToArray(P.active.values());
      const a = pts[0],
        b = pts[1];
      const dx = b.x - a.x,
        dy = b.y - a.y;

      P.pinchActive = true;
      P.pinchDist0 = Math.max(1, Math.hypot(dx, dy));
      P.pinchZoom0 = Number(this._vp.zoom || 1);
      P.pinchMid0 = { x: (a.x + b.x) * 0.5, y: (a.y + b.y) * 0.5 };

      P.isPanning = false;
      P.panPointerId = null;
      P.dragDirty = false;
      P.dragActive = false;
      P.dragObjId = null;
      return;
    }

    const modeId = String(this.state.modeId || "select");
    this._crashLog("workarea:pointerdown", { mode: modeId, pointerId: ev.pointerId, active: P.active.size });

    if (modeId === "select") {
      const world0 = this._screenCanvasToWorld(pt);
      const hit0 = this._hitTestWorldPoint(world0.wx, world0.wy);
      if (hit0) {
        P.dragObjId = hit0.id;
        P.dragOffset = { x: world0.wx - hit0.x, y: world0.wy - hit0.y };
        P.dragDirty = false;
      } else {
        P.dragObjId = null;
      }
    } else {
      P.dragObjId = null;
    }

    if (modeId === "pan") {
      P.isPanning = true;
      P.panPointerId = ev.pointerId;
    } else {
      P.isPanning = false;
      P.panPointerId = null;
    }
  }

  _onViewportPointerMove(ev) {
    const c = this._vp.canvas;
    if (!c) return;

    const P = this._vp.pointer;
    if (!P.active.has(ev.pointerId)) return;

    try {
      ev.preventDefault?.();
    } catch {}

    const pt = this._viewportClientToCanvasPx(ev);
    P.active.set(ev.pointerId, { x: pt.x, y: pt.y });

    if (P.pinchActive && P.active.size >= 2) {
      const pts = this._valuesToArray(P.active.values());
      const a = pts[0],
        b = pts[1];
      const dx = b.x - a.x,
        dy = b.y - a.y;

      const dist = Math.max(1, Math.hypot(dx, dy));
      const mid = { x: (a.x + b.x) * 0.5, y: (a.y + b.y) * 0.5 };
      const scale = dist / Math.max(1, P.pinchDist0);

      this._applyZoomAtCanvasPoint(mid, P.pinchZoom0 * scale);
      return;
    }

    if (P.active.size !== 1) return;

    const modeId = String(this.state.modeId || "select");
    const down = P.down.get(ev.pointerId);
    const thr = this._getTapThresholdPx();

    let movedFar = false;
    if (down) {
      const dx0 = pt.x - down.x;
      const dy0 = pt.y - down.y;
      movedFar = dx0 * dx0 + dy0 * dy0 > thr * thr;
    }

    if (modeId === "select" && P.dragObjId && !P.dragActive && movedFar) {
      const o = this._findSceneObjectById(P.dragObjId);
      if (o) {
        P.dragActive = true;
        P.isPanning = false;
        P.panPointerId = null;

        this._setSelectionToObject(o, "drag-start");
        this._crashLog("workarea:drag:start", { id: o.id, type: o.type, x: o.x, y: o.y });
        this._enterMobileDragLowPower("drag-start", ev);

        P.lastX = pt.x;
        P.lastY = pt.y;
      } else {
        P.dragObjId = null;
      }
    }

    if (P.dragActive && P.dragObjId) {
      this._enterMobileDragLowPower("drag-move", ev);
      const o = this._findSceneObjectById(P.dragObjId);
      if (!o) {
        P.dragActive = false;
        P.dragObjId = null;
        return;
      }

      const world = this._screenCanvasToWorld(pt);

      let nx = world.wx - (P.dragOffset?.x || 0);
      let ny = world.wy - (P.dragOffset?.y || 0);

      if (this._cfg?.snapEnabled) {
        const step = this._getSnapStepWorld();
        nx = Math.round(nx / step) * step;
        ny = Math.round(ny / step) * step;
      }

      o.x = nx;
      o.y = ny;
      P.dragDirty = true;
      try {
        const now = performance.now();
        if (!this._crashDiag) this._crashDiag = {};
        this._crashDiag.dragMoveCount = (this._crashDiag.dragMoveCount || 0) + 1;
        if (!this._crashDiag.lastDragLogAt || now - this._crashDiag.lastDragLogAt > 900) {
          this._crashDiag.lastDragLogAt = now;
          this._crashLog("workarea:drag:move", { id: o.id, x: o.x, y: o.y, moves: this._crashDiag.dragMoveCount });
        }
      } catch {}

      this.state.selectionPoint = { wx: o.x, wy: o.y };
      if (this.state.selection?.id === o.id) {
        try {
          this.state.selection.data.world.x = o.x;
          this.state.selection.data.world.y = o.y;
        } catch {}
      }
      return;
    }

    if (modeId === "pan") {
      if (!P.isPanning) {
        P.isPanning = true;
        P.panPointerId = ev.pointerId;
        P.lastX = pt.x;
        P.lastY = pt.y;
      }
    } else {
      if (!P.isPanning && movedFar && !P.dragObjId) {
        P.isPanning = true;
        P.panPointerId = ev.pointerId;
        P.lastX = pt.x;
        P.lastY = pt.y;
      }
    }

    if (P.isPanning && P.panPointerId === ev.pointerId) {
      this._vp.offsetX = Number(this._vp.offsetX || 0) + (pt.x - P.lastX);
      this._vp.offsetY = Number(this._vp.offsetY || 0) + (pt.y - P.lastY);
      P.lastX = pt.x;
      P.lastY = pt.y;
    }
  }

  _onViewportPointerUp(ev) {
    const P = this._vp.pointer;

    // -------------------------------------------------------------------
    // Tap-Gesten (unter Threshold)
    // - Select-Mode: Objekt selektieren oder Selection-Point setzen
    // - Place-Mode: Objekt selektieren oder Instanz platzieren
    // -------------------------------------------------------------------
    const modeIdNow = String(this.state.modeId);
    this._crashLog("workarea:pointerup", { mode: modeIdNow, pointerId: ev.pointerId, dragActive: !!P.dragActive, pinchActive: !!P.pinchActive });

    if ((modeIdNow === "select" || modeIdNow === "place") && !P.pinchActive && !P.dragActive) {
      const last = P.active.get(ev.pointerId);
      const down = P.down.get(ev.pointerId);

      if (last && down) {
        const dx = last.x - down.x;
        const dy = last.y - down.y;
        const thr = this._getTapThresholdPx();

        if (dx * dx + dy * dy <= thr * thr) {
          const world = this._screenCanvasToWorld(last);
          this._applySnapToWorldPoint(world);

          const hit = this._hitTestWorldPoint(world.wx, world.wy);

          if (hit) {
            // Immer selektierbar (auch im Place-Mode)
            this._setSelectionToObject(hit, "tap");
          } else if (modeIdNow === "place") {
            // Place-Mode: Instanz platzieren
            this._placeInstanceAtWorld(world, "place-tap");
          } else {
            // Select-Mode: nur Point Selection
            this._setSelectionToPoint(world, "tap");
          }
        }
      }
    }

    if (P.dragActive && P.dragObjId) {
      const o = this._findSceneObjectById(P.dragObjId);
      if (o) {
        this._setSelectionToObject(o, "drag-end");
        this._crashLog("workarea:drag:end", { id: o.id, x: o.x, y: o.y, dirty: !!P.dragDirty, moves: this._crashDiag?.dragMoveCount || 0 });
        if (this._crashDiag) this._crashDiag.dragMoveCount = 0;

        // Step 5J: Persist + Auto-Save erst am Drag-End (nicht bei jedem Move)
        // -> damit Objekt-Positionen nach Reload/Cold-Start korrekt bleiben.
        if (P.dragDirty) {
          this._persistSceneToStore("drag-end");
        }
      }
      this._leaveMobileDragLowPower("drag-end", ev);
      P.dragDirty = false;
      P.dragActive = false;
      P.dragObjId = null;
    }

    P.active.delete(ev.pointerId);
    P.down.delete(ev.pointerId);

    if (P.panPointerId === ev.pointerId) {
      P.isPanning = false;
      P.panPointerId = null;
    }

    if (P.active.size < 2) {
      P.pinchActive = false;
      P.pinchDist0 = 0;
    }

    if (P.active.size === 0) {
      P.isPanning = false;
      P.panPointerId = null;
      P.dragActive = false;
      P.dragObjId = null;
      this._leaveMobileDragLowPower("pointer-all-up", ev);
    }
  }

  _onViewportWheel(ev) {
    const c = this._vp.canvas;
    if (!c) return;

    try {
      ev.preventDefault?.();
    } catch {}

    const pt = this._viewportClientToCanvasPx(ev);
    const dy = Number(ev.deltaY || 0);
    const factor = Math.exp(-dy * 0.0015);

    this._applyZoomAtCanvasPoint(pt, Number(this._vp.zoom || 1) * factor);
  }

  /* ==========================================================================
   * JSON + schema helpers
   * ========================================================================= */

  async _loadJson(url) {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`loadJson: ${res.status} ${res.statusText} (${url})`);
    return await res.json();
  }

  _layoutTabs(regionKey) {
    try {
      const reg = this.layout?.root?.regions?.[regionKey];
      if (!reg) return null;
      if (!Array.isArray(reg.tabs)) return null;
      return reg.tabs.map((t) => ({ id: t.id, title: t.title || t.id, icon: t.icon || null }));
    } catch {
      return null;
    }
  }

  _getMode(modeId) {
    const modes = Array.isArray(this.tools?.modes) ? this.tools.modes : [];
    return modes.find((m) => m && m.id === modeId) || null;
  }

  _getPropsSchemaForType(type) {
    const types = this.props?.types || {};
    return types?.[type] || (type === "project" ? types?.project : null) || this.props?.fallback || null;
  }

  _resolveSchemaGroups(schema) {
    if (!schema) return [];
    const out = [];

    const commonIds = Array.isArray(schema.includeCommon) ? schema.includeCommon : [];
    if (commonIds.length) {
      const commons = Array.isArray(this.props?.commonGroups) ? this.props.commonGroups : [];
      for (const id of commonIds) {
        const g = commons.find((x) => x && x.id === id);
        if (g) out.push(g);
      }
    }

    if (Array.isArray(schema.groups)) out.push(...schema.groups);
    return out;
  }

  _getByPath(obj, path) {
    if (path === "$") return obj;
    if (!path || typeof path !== "string") return undefined;
    const parts = path.split(".").filter(Boolean);
    let cur = obj;
    for (const p of parts) {
      if (cur == null) return undefined;
      cur = cur[p];
    }
    return cur;
  }

  _makeDummySelection(type) {
    if (type === "project") {
      return {
        id: "proj-1",
        type: "project",
        data: {
          id: "P-2026-0001",
          type: "project",
          meta: { name: "Demo Project" },
          project: { id: "P-2026-0001", name: "Demo Project", timezone: "Europe/Berlin" },
          transform: { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } }
        }
      };
    }
    if (type === "hall.procedural") {
      return {
        id: "hall-1",
        type,
        data: {
          id: "hall-1",
          type,
          meta: { name: "Halle" },
          params: { length: 40, width: 20, eaveHeight: 6, bay: 5 },
          view: { grid: { enabled: true }, snap: { enabled: false } },
          transform: { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } }
        }
      };
    }
    if (type === "asset.glb") {
      return {
        id: "asset-1",
        type,
        data: {
          id: "asset-1",
          type,
          meta: { name: "GLB Asset" },
          source: { uri: "assets/models/demo.glb", slotId: "SLOT-001" },
          render: { castShadow: true, receiveShadow: true },
          transform: { position: { x: 100, y: 0, z: 50 }, rotation: { x: 0, y: 90, z: 0 }, scale: { x: 1, y: 1, z: 1 } }
        }
      };
    }
    if (type === "conveyor.segment") {
      return {
        id: "conv-1",
        type,
        data: {
          id: "conv-1",
          type,
          meta: { name: "Rollenbahn Segment" },
          params: { speed: 0.8, direction: "forward" },
          sensors: { a: { offset: { x: 10, y: 0, z: 0 } }, b: { offset: { x: 200, y: 0, z: 0 } } },
          transform: { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } }
        }
      };
    }
    return {
      id: "obj-1",
      type,
      data: {
        id: "obj-1",
        type,
        meta: { name: "Unknown" },
        transform: { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } }
      }
    };
  }

/* ==========================================================================
 * Properties – Schema-driven Controls (NEU)
 * ==========================================================================
 * Ziel (Step 2):
 * - properties.schemas.json ist die Quelle der Wahrheit.
 * - Der Properties-Tab rendert die passenden Gruppen/Felder nach Type.
 * - Für Scene-Objekte werden Änderungen in app.settings.workspace.scene.objects persistiert.
 *
 * Hinweis:
 * - Selection-Objekte (project/projectAsset/selection.point) bleiben read-only,
 *   weil sie (noch) keine persistente Edit-API besitzen.
 */

_isSceneSelection(sel) {
  if (!sel?.id) return false;
  return !!this._findSceneObjectById(sel.id);
}

_getSceneTarget(sel) {
  const o = this._findSceneObjectById(sel?.id);
  return o || null;
}

_getPropValue({ sel, sceneObj, path }) {
  // Scene-Objekt: wir unterstützen "virtuelle" Pfade (transform/meta) + echte Nested-Props.
  if (sceneObj) {
    return this._getSceneValueByPath(sceneObj, path);
  }
  // Fallback: Selection-Daten (read-only)
  return this._getByPath(sel?.data, path);
}

_setPropValue({ sel, sceneObj, path, value, reason = "props" }) {
  if (!sceneObj) return false; // aktuell nur Scene editierbar
  return this._setSceneValueByPath(sceneObj, path, value, reason);
}

_getSceneValueByPath(obj, path) {
  const p = String(path || "");
  if (!p || p === "$") return obj;

  // Meta / Identity
  if (p === "meta.name") return obj.name;
  if (p === "id") return obj.id;
  if (p === "type") return obj.type;

  // Transform Adapter (2D → pseudo-3D)
  if (p === "transform.position") return { x: obj.x || 0, y: obj.y || 0, z: 0 };
  if (p === "transform.position.x") return obj.x || 0;
  if (p === "transform.position.y") return obj.y || 0;
  if (p === "transform.position.z") return 0;

  // rotDeg ist unsere persistierte 2D-Rotation; wir hängen sie an rotation.z
  if (p === "transform.rotation.z") return Number.isFinite(Number(obj.rotDeg)) ? Number(obj.rotDeg) : 0;
  if (p === "transform.rotation.x") return 0;
  if (p === "transform.rotation.y") return 0;
  if (p === "transform.rotation") return { x: 0, y: 0, z: Number.isFinite(Number(obj.rotDeg)) ? Number(obj.rotDeg) : 0 };

  if (p.startsWith("transform.scale")) {
    // v1: Scene-Objekte haben keine Skalierung; default=1
    if (p === "transform.scale") return { x: 1, y: 1, z: 1 };
    return 1;
  }

  // Default: echte Properties am Objekt (params.*, sensors.*, etc.)
  return this._getByPath(obj, p);
}

_setSceneValueByPath(obj, path, value, reason = "props") {
  const p = String(path || "");
  if (!p || p === "$") return false;

  // Identity/meta
  if (p === "meta.name") {
    obj.name = String(value || "");
    // auch Selection-View updaten (damit UI sofort stimmt)
    try {
      if (this.state.selection?.data?.meta) this.state.selection.data.meta.name = obj.name;
    } catch {}
    this._persistSceneToStore(`props:name:${reason}`);
    return true;
  }

  // Transform Adapter
  if (p === "transform.position.x") {
    const v = Number(value);
    if (!Number.isFinite(v)) return false;
    obj.x = v;
    this._persistSceneToStore(`props:posx:${reason}`);
    return true;
  }
  if (p === "transform.position.y") {
    const v = Number(value);
    if (!Number.isFinite(v)) return false;
    obj.y = v;
    this._persistSceneToStore(`props:posy:${reason}`);
    return true;
  }
  if (p === "transform.rotation.z") {
    const v = Number(value);
    if (!Number.isFinite(v)) return false;
    obj.rotDeg = ((v % 360) + 360) % 360;
    try {
      if (this.state.selection?.data?.transform2d) this.state.selection.data.transform2d.rotDeg = obj.rotDeg;
    } catch {}
    this._persistSceneToStore(`props:rotz:${reason}`);
    return true;
  }

  // Default: Nested property write (params.*, sensors.*, etc.)
  this._setByPath(obj, p, value);
  this._persistSceneToStore(`props:${p}:${reason}`);
  return true;
}

_renderPropFieldControl({ sel, sceneObj, field }) {
  const f = field || {};
  const type = String(f.type || "text");
  const path = String(f.path || "");

  const isScene = !!sceneObj;
  const isEditable = isScene && type !== "readonly" && type !== "json";

  const mkInputBase = () => {
    const el = document.createElement("input");
    el.style.height = "28px";
    el.style.borderRadius = "8px";
    el.style.padding = "0 8px";
    el.style.border = "1px solid rgba(255,255,255,.12)";
    el.style.background = "rgba(0,0,0,.25)";
    el.style.color = "inherit";
    el.style.minWidth = "120px";
    return el;
  };

  const cur = this._getPropValue({ sel, sceneObj, path });

  // READONLY
  if (!isEditable && type !== "toggle" && type !== "select") {
    const d = document.createElement("div");
    d.style.opacity = ".9";
    d.style.textAlign = "right";
    d.style.whiteSpace = "nowrap";
    if (type === "json") {
      try {
        d.textContent = JSON.stringify(cur ?? null);
      } catch {
        d.textContent = String(cur ?? "");
      }
    } else {
      d.textContent = cur === undefined ? "-" : String(cur);
    }
    return d;
  }

  // TOGGLE
  if (type === "toggle") {
    const btn = this._btn(Boolean(cur) ? "On" : "Off", () => {
      const next = !Boolean(this._getPropValue({ sel, sceneObj, path }));
      this._setPropValue({ sel, sceneObj, path, value: next, reason: "toggle" });
      this._requestProjectSaveDebounced("props:toggle");
      this._renderRightPanel();
    });
    btn.style.minWidth = "72px";
    btn.style.background = Boolean(cur) ? "rgba(0,255,128,.10)" : "rgba(0,0,0,.20)";
    btn.style.borderColor = Boolean(cur) ? "rgba(0,255,128,.25)" : "rgba(255,255,255,.10)";
    return btn;
  }

  // SELECT
  if (type === "select") {
    const selEl = document.createElement("select");
    selEl.style.height = "28px";
    selEl.style.borderRadius = "8px";
    selEl.style.padding = "0 8px";
    selEl.style.border = "1px solid rgba(255,255,255,.12)";
    selEl.style.background = "rgba(0,0,0,.25)";
    selEl.style.color = "inherit";
    selEl.style.minWidth = "140px";

    const opts = Array.isArray(f.options) ? f.options : [];
    for (const o of opts) {
      const opt = document.createElement("option");
      opt.value = String(o);
      opt.textContent = String(o);
      if (String(cur) === String(o)) opt.selected = true;
      selEl.appendChild(opt);
    }
    selEl.addEventListener("change", () => {
      this._setPropValue({ sel, sceneObj, path, value: String(selEl.value), reason: "select" });
      this._requestProjectSaveDebounced("props:select");
    });
    return selEl;
  }

  // VEC3 (Scene: position/rotation/scale)
  if (type === "vec3") {
    const wrap = document.createElement("div");
    wrap.style.display = "flex";
    wrap.style.gap = "6px";
    wrap.style.justifyContent = "flex-end";

    const mk = (axis) => {
      const el = mkInputBase();
      el.type = "number";
      el.inputMode = "decimal";
      el.style.minWidth = "78px";
      el.placeholder = axis.toUpperCase();
      return el;
    };

    const vx = this._getPropValue({ sel, sceneObj, path: path + ".x" });
    const vy = this._getPropValue({ sel, sceneObj, path: path + ".y" });
    const vz = this._getPropValue({ sel, sceneObj, path: path + ".z" });

    const xIn = mk("x");
    const yIn = mk("y");
    const zIn = mk("z");

    xIn.value = String(Number.isFinite(Number(vx)) ? Number(vx) : 0);
    yIn.value = String(Number.isFinite(Number(vy)) ? Number(vy) : 0);
    zIn.value = String(Number.isFinite(Number(vz)) ? Number(vz) : 0);

    const apply = () => {
      this._setPropValue({ sel, sceneObj, path: path + ".x", value: xIn.value, reason: "vec3" });
      this._setPropValue({ sel, sceneObj, path: path + ".y", value: yIn.value, reason: "vec3" });
      this._setPropValue({ sel, sceneObj, path: path + ".z", value: zIn.value, reason: "vec3" });
      this._requestProjectSaveDebounced("props:vec3");
    };

    xIn.addEventListener("change", apply);
    yIn.addEventListener("change", apply);
    zIn.addEventListener("change", apply);

    wrap.appendChild(xIn);
    wrap.appendChild(yIn);
    wrap.appendChild(zIn);
    return wrap;
  }

  // NUMBER / TEXT (default)
  const inEl = mkInputBase();
  inEl.type = type === "number" ? "number" : "text";
  inEl.inputMode = type === "number" ? "decimal" : "text";
  if (type === "number") {
    if (Number.isFinite(Number(f.min))) inEl.min = String(f.min);
    if (Number.isFinite(Number(f.max))) inEl.max = String(f.max);
    if (Number.isFinite(Number(f.step))) inEl.step = String(f.step);
  }

  inEl.value = cur === undefined || cur === null ? "" : String(cur);

  inEl.addEventListener("change", () => {
    const v = type === "number" ? Number(inEl.value) : String(inEl.value);
    this._setPropValue({ sel, sceneObj, path, value: v, reason: "input" });
    this._requestProjectSaveDebounced("props:input");
  });

  return inEl;
}

/* ==========================================================================
 * Params Tab (NEU) – ParamPack v1 in Workarea sichtbar machen
 * ==========================================================================
 * Ziel (Step 3):
 * - ParamPack laden (fetch, cached in param-engine.js)
 * - Parameter am selektierten Scene-Objekt speichern (obj.params + obj.paramPackUrl)
 * - Kennzahlen/BOM (computeMetrics) anzeigen
 *
 * WICHTIG:
 * - v1 ist READ/WRITE auf Param-Werte, aber ohne 3D-Apply (Workarea ist 2D).
 * - 3D-Apply bleibt in Hall3D / AssetLab3D (später: Workarea-3D).
 */

async _loadParamEngine() {
  // Lazy dynamic import, damit Workarea nicht hart an Hall3D gekoppelt ist.
  if (this._paramEngine) return this._paramEngine;
  try {
    const mod = await import("../../modules/hall3d/core/param-engine.js");
    this._paramEngine = mod;
    return mod;
  } catch (e) {
    console.error("[workarea] ParamEngine import failed", e);
    return null;
  }
}

_renderParamsPanelFull() {
  const box = document.createElement("div");
  box.style.padding = "10px";
  box.style.display = "flex";
  box.style.flexDirection = "column";
  box.style.gap = "10px";

  const title = document.createElement("div");
  title.style.fontWeight = "700";
  title.textContent = "Params (ParamPack v1)";
  box.appendChild(title);

  const sel = this.state.selection || this._makeDummySelection("project");
  const sceneObj = this._getSceneTarget(sel);

  const hint = document.createElement("div");
  hint.style.fontSize = "12px";
  hint.style.opacity = ".75";
  hint.textContent =
    "Hier siehst du ParamPack v1 direkt in der Workarea (2D). Parameter werden am Scene-Objekt gespeichert und sind damit projektgebunden und reload-sicher.";
  box.appendChild(hint);

  if (!sceneObj) {
    const warn = document.createElement("div");
    warn.style.opacity = ".85";
    warn.textContent = "⚠️ Bitte ein Scene-Objekt im Viewport selektieren (z.B. eine platzierte Instanz).";
    box.appendChild(warn);
    return box;
  }

  // Pack-Auswahl (v1: nur 1 Beispiel-Pack – später dynamisch aus Registry)
  const packRow = document.createElement("div");
  packRow.style.display = "flex";
  packRow.style.gap = "8px";
  packRow.style.alignItems = "center";
  packRow.style.flexWrap = "wrap";

  const packLbl = document.createElement("div");
  packLbl.style.fontSize = "12px";
  packLbl.style.opacity = ".75";
  packLbl.textContent = "ParamPack";
  packRow.appendChild(packLbl);

  const packSel = document.createElement("select");
  packSel.style.height = "28px";
  packSel.style.borderRadius = "8px";
  packSel.style.padding = "0 8px";
  packSel.style.border = "1px solid rgba(255,255,255,.12)";
  packSel.style.background = "rgba(0,0,0,.25)";
  packSel.style.color = "inherit";
  packSel.style.minWidth = "240px";

  const packOptions = [
    {
      id: "skid_production_v1",
      label: "skid_production_v1 (Demo)",
      url: "modules/hall3d/data/param-packs/skid_production_v1.parampack.json"
    },
    {
      id: "rollerbahn_v1",
      label: "rollerbahn_v1 (Rollenbahn)",
      url: "modules/hall3d/data/param-packs/rollerbahn_v1.parampack.json"
    },
    {
      id: "transferwagen_vB_v1",
      label: "transferwagen_vB_v1 (Verschiebewagen)",
      url: "modules/hall3d/data/param-packs/transferwagen_vB_v1.parampack.json"
    }
  ];

  const guessedUrl = this._guessParamPackUrlForObject(sceneObj);

  // Wenn Objekt noch keinen ParamPack gesetzt hat, aber wir einen Kandidaten
  // erkennen: automatisch setzen + persistieren.
  if (!sceneObj.paramPackUrl && guessedUrl) {
    sceneObj.paramPackUrl = guessedUrl;
    this._persistSceneToStore("auto:paramPackUrl");
  }

  const curUrl = String(sceneObj.paramPackUrl || guessedUrl || packOptions[0].url);
  for (const p of packOptions) {
    const o = document.createElement("option");
    o.value = p.url;
    o.textContent = p.label;
    if (String(p.url) === curUrl) o.selected = true;
    packSel.appendChild(o);
  }

  packSel.addEventListener("change", () => {
    sceneObj.paramPackUrl = String(packSel.value || "");
    this._persistSceneToStore("params:pack");
    this._requestProjectSaveDebounced("params:pack");
    this._renderRightPanel();
  });

  packRow.appendChild(packSel);
  box.appendChild(packRow);

  const params = (sceneObj.params && typeof sceneObj.params === "object") ? sceneObj.params : (sceneObj.params = {});
  const status = document.createElement("div");
  status.style.fontSize = "12px";
  status.style.opacity = ".75";
  status.textContent = `Objekt: ${sceneObj.type} • ${sceneObj.id}`;
  box.appendChild(status);

  // Async Pack laden + UI rendern (ohne async/await im Render-Flow zu blocken)
  const mount = document.createElement("div");
  mount.textContent = "Lade ParamPack …";
  mount.style.opacity = ".8";
  box.appendChild(mount);

  (async () => {
    const engine = await this._loadParamEngine();
    if (!engine) {
      mount.textContent = "⚠️ ParamEngine konnte nicht geladen werden.";
      return;
    }

    try {
      const pack = await engine.loadParamPack(curUrl);
      if (!pack) {
        mount.textContent = "⚠️ ParamPack leer/ungültig.";
        return;
      }

      // Merge defaults + overrides (sceneObj.params sind die Overrides)
      const merged = engine.mergeParams(pack.defaults, params);

      mount.innerHTML = "";

      // UI Groups
      const groups = Array.isArray(pack?.ui?.groups) ? pack.ui.groups : [];
      for (const g of groups) {
        const gEl = document.createElement("div");
        gEl.style.border = "1px solid rgba(255,255,255,.08)";
        gEl.style.borderRadius = "10px";
        gEl.style.padding = "8px";

        const gt = document.createElement("div");
        gt.style.fontWeight = "700";
        gt.style.marginBottom = "6px";
        gt.textContent = g.label || g.id || "Group";
        gEl.appendChild(gt);

        const fields = Array.isArray(g.fields) ? g.fields : [];
        for (const f of fields) {
          const row = document.createElement("div");
          row.style.display = "grid";
          row.style.gridTemplateColumns = "1fr 1.2fr";
          row.style.gap = "10px";
          row.style.alignItems = "center";
          row.style.fontSize = "12px";
          row.style.padding = "6px 0";
          row.style.borderTop = "1px dashed rgba(255,255,255,.06)";

          const lab = document.createElement("div");
          lab.style.opacity = ".75";
          lab.textContent = f.label || f.id || "";
          row.appendChild(lab);

          const ctrlHost = document.createElement("div");
          ctrlHost.style.display = "flex";
          ctrlHost.style.justifyContent = "flex-end";

          const id = String(f.id || "");
          const fType = String(f.type || "number");
          const cur = merged[id];

          const mk = () => {
            const el = document.createElement("input");
            el.style.height = "28px";
            el.style.borderRadius = "8px";
            el.style.padding = "0 8px";
            el.style.border = "1px solid rgba(255,255,255,.12)";
            el.style.background = "rgba(0,0,0,.25)";
            el.style.color = "inherit";
            el.style.minWidth = "160px";
            return el;
          };

          let ctrl = null;

          if (fType === "range") {
            const wrap = document.createElement("div");
            wrap.style.display = "flex";
            wrap.style.gap = "8px";
            wrap.style.alignItems = "center";

            const range = mk();
            range.type = "range";
            range.style.minWidth = "140px";
            range.min = String(Number.isFinite(Number(f.min)) ? f.min : 0);
            range.max = String(Number.isFinite(Number(f.max)) ? f.max : 100);
            range.step = String(Number.isFinite(Number(f.step)) ? f.step : 1);
            range.value = String(Number.isFinite(Number(cur)) ? cur : 0);

            const num = mk();
            num.type = "number";
            num.inputMode = "decimal";
            num.style.minWidth = "90px";
            num.min = range.min;
            num.max = range.max;
            num.step = range.step;
            num.value = range.value;

            const apply = (v) => {
              const n = Number(v);
              if (!Number.isFinite(n)) return;
              sceneObj.params[id] = n;
              this._persistSceneToStore("params:change");
              this._requestProjectSaveDebounced("params:change");
              this._renderRightPanel();
            };

            range.addEventListener("input", () => {
              num.value = range.value;
            });
            range.addEventListener("change", () => apply(range.value));
            num.addEventListener("change", () => {
              range.value = num.value;
              apply(num.value);
            });

            wrap.appendChild(range);
            wrap.appendChild(num);
            ctrl = wrap;
          } else {
            const inp = mk();
            inp.type = "number";
            inp.inputMode = "decimal";
            if (Number.isFinite(Number(f.min))) inp.min = String(f.min);
            if (Number.isFinite(Number(f.max))) inp.max = String(f.max);
            if (Number.isFinite(Number(f.step))) inp.step = String(f.step);
            inp.value = String(Number.isFinite(Number(cur)) ? cur : 0);

            inp.addEventListener("change", () => {
              const n = Number(inp.value);
              if (!Number.isFinite(n)) return;
              sceneObj.params[id] = n;
              this._persistSceneToStore("params:change");
              this._requestProjectSaveDebounced("params:change");
              this._renderRightPanel();
            });

            ctrl = inp;
          }

          if (ctrl) ctrlHost.appendChild(ctrl);
          row.appendChild(ctrlHost);
          gEl.appendChild(row);
        }

        mount.appendChild(gEl);
      }

      // Metrics
      const metrics = engine.computeMetrics(pack, engine.mergeParams(pack.defaults, sceneObj.params || {}));

      const mBox = document.createElement("div");
      mBox.style.border = "1px solid rgba(255,255,255,.08)";
      mBox.style.borderRadius = "10px";
      mBox.style.padding = "8px";
      mBox.style.marginTop = "8px";

      const mt = document.createElement("div");
      mt.style.fontWeight = "700";
      mt.style.marginBottom = "6px";
      mt.textContent = "Kennzahlen (computeMetrics)";
      mBox.appendChild(mt);

      const rows = Array.isArray(metrics?.bom) ? metrics.bom : [];
      if (!rows.length) {
        const none = document.createElement("div");
        none.style.opacity = ".75";
        none.style.fontSize = "12px";
        none.textContent = "Keine BOM Items im ParamPack.";
        mBox.appendChild(none);
      } else {
        const grid = document.createElement("div");
        grid.style.display = "grid";
        grid.style.gridTemplateColumns = "1fr 70px 70px 70px";
        grid.style.gap = "6px";
        grid.style.alignItems = "center";
      grid.className = "wa-assemblylab-component-grid";

        const hdr = (t) => {
          const d = document.createElement("div");
          d.style.fontSize = "12px";
          d.style.opacity = ".75";
          d.style.fontWeight = "700";
          d.textContent = t;
          return d;
        };

        grid.appendChild(hdr("Item"));
        grid.appendChild(hdr("Qty"));
        grid.appendChild(hdr("Unit"));
        grid.appendChild(hdr("Cost"));

        for (const r of rows) {
          const a = document.createElement("div");
          a.textContent = String(r.label || r.id);
          const b = document.createElement("div");
          b.style.textAlign = "right";
          b.textContent = Number.isFinite(Number(r.qty)) ? Number(r.qty).toFixed(2) : String(r.qty || 0);
          const c = document.createElement("div");
          c.style.textAlign = "right";
          c.textContent = String(r.unit || "");
          const d = document.createElement("div");
          d.style.textAlign = "right";
          d.textContent = Number.isFinite(Number(r.cost)) ? Number(r.cost).toFixed(2) : String(r.cost || 0);

          grid.appendChild(a);
          grid.appendChild(b);
          grid.appendChild(c);
          grid.appendChild(d);
        }

        mBox.appendChild(grid);

        const tot = document.createElement("div");
        tot.style.marginTop = "6px";
        tot.style.fontWeight = "700";
        tot.textContent = `Total Cost: ${Number(metrics?.totals?.cost || 0).toFixed(2)}`;
        mBox.appendChild(tot);
      }

      const actions = document.createElement("div");
      actions.style.display = "flex";
      actions.style.gap = "6px";
      actions.style.flexWrap = "wrap";
      actions.style.marginTop = "8px";

      actions.appendChild(
        this._btn("Copy Metrics JSON", async () => {
          try {
            await this._copyToClipboard(JSON.stringify(metrics, null, 2));
            this._setStatus("✅ Metrics JSON in Clipboard");
          } catch {
            this._setStatus("⚠️ Copy fehlgeschlagen");
          }
        })
      );

      mBox.appendChild(actions);
      mount.appendChild(mBox);

    } catch (e) {
      console.error("[workarea] params render failed", e);
      mount.textContent = "⚠️ Fehler beim Laden/Rendere von ParamPack.";
    }
  })();

  return box;
}

  /* ==========================================================================
   * Tiny UI helpers
   * ========================================================================= */

  _makeTabsBar() {
    const bar = document.createElement("div");
    bar.style.flex = "0 0 auto";
    bar.style.display = "flex";
    bar.style.gap = "6px";
    bar.style.padding = "8px 10px";
    bar.style.borderBottom = "1px solid rgba(255,255,255,.06)";
    bar.style.overflowX = "auto";
    bar.style.minHeight = "44px";
    bar.className = "wa-tabs-bar";
    return bar;
  }

  _makePanelHost() {
    const host = document.createElement("div");
    host.style.flex = "1 1 auto";
    host.style.minHeight = "0";
    host.style.overflow = "auto";
    host.className = "wa-panel-host";
    return host;
  }

  _renderTabsBar(barEl, tabs, activeId, onSelect) {
    if (!barEl) return;
    barEl.innerHTML = "";

    for (const t of tabs) {
      const b = document.createElement("button");
      b.type = "button";
      const useMobileTitle = (typeof window !== "undefined" && window.matchMedia && window.matchMedia("(max-width: 699px)").matches);
      b.textContent = (useMobileTitle && t.mobileTitle) ? t.mobileTitle : (t.title || t.id);
      b.dataset.tabId = String(t.id || "");
      b.className = "wa-tabs-btn";
      b.style.height = "28px";
      b.style.borderRadius = "10px";
      b.style.padding = "0 10px";
      b.style.border = "1px solid rgba(255,255,255,.12)";
      b.style.background = t.id === activeId ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.20)";
      b.style.color = "inherit";
      b.style.cursor = "pointer";
      b.style.whiteSpace = "nowrap";

      b.addEventListener("click", () => onSelect(String(t.id)));
      barEl.appendChild(b);
    }
  }

  _btn(label, onClick) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.style.height = "28px";
    b.style.borderRadius = "10px";
    b.style.padding = "0 10px";
    b.style.border = "1px solid rgba(255,255,255,.12)";
    b.style.background = "rgba(0,0,0,.20)";
    b.style.color = "inherit";
    b.style.cursor = "pointer";
    b.addEventListener("click", () => {
      try {
        onClick?.();
      } catch (e) {
        console.error("[workarea] button handler failed:", e);
      }
    });
    return b;
  }

  _pill(text, bg) {
    const p = document.createElement("div");
    p.textContent = text;
    p.style.height = "28px";
    p.style.display = "inline-flex";
    p.style.alignItems = "center";
    p.style.padding = "0 10px";
    p.style.borderRadius = "10px";
    p.style.border = "1px solid rgba(255,255,255,.10)";
    p.style.background = bg || "rgba(255,255,255,.06)";
    p.style.fontSize = "12px";
    p.style.opacity = ".9";
    return p;
  }

  _spacer() {
    const s = document.createElement("div");
    s.style.flex = "1 1 auto";
    return s;
  }
}
