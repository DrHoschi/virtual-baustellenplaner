/**
 * ui/panels/AssetLibraryPanel.js
 * Version: v1.0.0-asset-library-stub (2026-02-07)
 *
 * Bibliotheken (Globaler Katalog)
 * ---------------------------------------------------------------------------
 * Das ist bewusst zunächst ein "Stub" (Platzhalter), damit der Tab "Bibliotheken"
 * nicht ins Leere läuft und wir eine saubere Grundlage haben.
 *
 * Idee:
 * - Hier listen wir später globale Asset-Kataloge (Standard/Pro/Industry),
 *   plus Import aus externen Quellen (GLB Packs, CAD/GLB Library, etc.).
 * - Ein Asset kann dann per "Zum Projekt hinzufügen" als Projekt-Asset
 *   referenziert werden (Reference + PresetTransform).
 */

import { PanelBase } from "./PanelBase.js";
import { h } from "../components/ui-dom.js";

export class AssetLibraryPanel extends PanelBase {
  getTitle() {
    return "Projekt – Bibliotheken";
  }

  getDescription() {
    return "Globale Asset-Kataloge (Platzhalter – wird als Nächstes ausgebaut).";
  }

  getToolbarConfig() {
    return { showReset: false, showApply: false };
  }

  buildDraftFromStore() {
    return {};
  }

  renderBody(root) {
    root.appendChild(
      h("div", { className: "bp-card" },
        h("div", { className: "bp-card__title" }, "Bibliotheken – Überblick"),
        h("div", { className: "bp-card__desc" },
          "Hier kommen später deine globalen Kataloge rein (Standard-Assets, eigene Packs, Industry-Teile, usw.)."
        ),
        h("ul", { style: { margin: "10px 0 0", paddingLeft: "18px" } },
          h("li", null, "Standard-Katalog (Read-only)"),
          h("li", null, "Eigene globale Bibliothek (du verwaltest)"),
          h("li", null, "Import/Export-Packs (ZIP/GLB/GLTF)"),
        ),
        h("div", { style: { opacity: .75, fontSize: "12px", marginTop: "10px" } },
          "Work-in-progress: Nächster Schritt ist die echte Library-Liste + 'Zum Projekt hinzufügen'."
        )
      )
    );
  }
}
