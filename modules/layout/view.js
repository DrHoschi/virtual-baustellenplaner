/**
 * modules/layout/view.js
 * Version: v1.0.0-hardcut-modular-v2 (2026-02-04)
 *
 * Minimaler Layout-View (Demo/Proof)
 * ------------------------------------------------------------
 * Zweck:
 * - Im hardcut-v1 gab es für "layout" keine View → Placeholder-Text.
 * - In v2 liefern wir eine echte (wenn auch simple) View.
 *
 * Features:
 * - Listet "areas" aus store.layout.areas
 * - Button: erzeugt Dummy-Area (feuert req:layout:addArea)
 * - Reagiert auf cb:layout:changed & cb:store:changed
 */

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

function prettyJson(obj) {
  try { return JSON.stringify(obj, null, 2); } catch { return String(obj); }
}

export function createLayoutView({ bus, store, rootEl }) {
  if (!rootEl) throw new Error("createLayoutView: rootEl fehlt");

  let mounted = false;
  let unsub = [];

  function render() {
    if (!mounted) return;
    const state = store.get("layout") || { areas: [] };

    rootEl.innerHTML = "";

    const wrap = el("div", "layout-view");
    wrap.style.padding = "12px";

    const h = el("h3", null, "Layout – Areas");
    h.style.margin = "0 0 8px";

    const btn = el("button", null, "Dummy-Area hinzufügen");
    btn.type = "button";
    btn.style.margin = "0 0 10px";
    btn.addEventListener("click", () => {
      const area = {
        id: `A-${Date.now()}`,
        name: "Dummy Area",
        points: [
          { x: 10, y: 10 },
          { x: 80, y: 10 },
          { x: 80, y: 60 },
          { x: 10, y: 60 }
        ]
      };
      bus.emit("req:layout:addArea", area);
    });

    const listTitle = el("div", null, `Anzahl: ${state.areas?.length || 0}`);
    listTitle.style.opacity = ".75";
    listTitle.style.margin = "0 0 8px";

    const list = el("div");
    list.style.display = "grid";
    list.style.gap = "8px";

    (state.areas || []).forEach((a) => {
      const card = el("div");
      card.style.border = "1px solid #ddd";
      card.style.borderRadius = "12px";
      card.style.padding = "10px";

      const t = el("div", null, `${a.name || "Area"} (${a.id})`);
      t.style.fontWeight = "700";

      const pre = el("pre");
      pre.style.margin = "8px 0 0";
      pre.style.background = "#0b1020";
      pre.style.color = "#d8e2ff";
      pre.style.borderRadius = "10px";
      pre.style.padding = "10px";
      pre.textContent = prettyJson(a);

      card.appendChild(t);
      card.appendChild(pre);
      list.appendChild(card);
    });

    wrap.appendChild(h);
    wrap.appendChild(btn);
    wrap.appendChild(listTitle);
    wrap.appendChild(list);

    rootEl.appendChild(wrap);
  }

  return {
    async mount() {
      mounted = true;

      // Render sofort
      render();

      // Auf Änderungen reagieren
      const h1 = bus.on("cb:layout:changed", render);
      const h2 = bus.on("cb:store:changed", render);
      unsub.push(h1, h2);
    },
    unmount() {
      mounted = false;
      unsub.forEach((fn) => {
        try { if (typeof fn === "function") fn(); } catch (_) {}
      });
      unsub = [];
      rootEl.innerHTML = "";
    }
  };
}
