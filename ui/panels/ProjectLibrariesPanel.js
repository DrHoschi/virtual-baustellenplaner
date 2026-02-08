/**
 * ui/panels/ProjectLibrariesPanel.js
 * Version: v1.0.0-clean-standard (2026-02-08)
 *
 * Panel: Projekt → Bibliotheken
 * ============================================================================
 * Zweck
 * -----
 * Bibliotheken sind der globale Katalog:
 * - Standard-Modelle
 * - Varianten-Sets
 * - Presets/Beispiele
 *
 * Dieses Panel ist (noch) ein sauberer Platzhalter:
 * - Wir zeigen, welche Bibliotheken später aktivierbar sind.
 * - Wir vermeiden Crashs, wenn das Menü den Tab schon anbietet.
 */

import { PanelBase } from "./PanelBase.js";
import { Section } from "../components/Section.js";
import { h, clear } from "../components/ui-dom.js";

export class ProjectLibrariesPanel extends PanelBase {
  getTitle() { return "Projekt – Bibliotheken"; }

  getDescription() {
    const app = this.store.get("app") || {};
    return `Projekt-ID: ${app?.project?.id || "?"}`;
  }

  buildDraftFromStore() {
    // Noch keine editierbaren Felder → Draft leer
    return { ok: true };
  }

  applyDraftToStore() {
    // Nichts zu speichern (Platzhalter)
  }

  getToolbarConfig() {
    // Platzhalter: kein Apply/Reset
    return { showApply: false, showReset: false, note: "Bibliotheken kommen als nächster Ausbauschritt." };
  }

  renderBody(bodyEl) {
    clear(bodyEl);

    const sec = new Section({
      title: "Globale Bibliotheken (Katalog)",
      description: "Hier wählen wir später aus, welche Bibliotheken im Projekt verfügbar sind (Standard + eigene Kataloge)."
    });

    sec.append(
      h("div", { style: { fontSize: "13px", opacity: ".8" } },
        "Status: Platzhalter (Clean-Standard).",
        h("ul", {},
          h("li", {}, "Aktivieren/Deaktivieren von Library-Sets (IDs)"),
          h("li", {}, "Favoriten / Tags / Suche"),
          h("li", {}, "„Asset aus Library ins Projekt übernehmen“ (Bind/Clone)"),
          h("li", {}, "Version-Lock pro Bibliothek (später)")
        )
      )
    );

    bodyEl.appendChild(sec.el);
  }
}
