// ui/mount-ui.js
// Version: v1.0.0-mount-ui-shim (2026-02-08)
//
// WARUM?
// - Bei dir schlägt der Import aktuell fehl (404 mount-ui.js).
// - Dadurch bleibt alles auf "(lädt...)" hängen.
// - Dieses File ist ein SHIM:
//   - Wenn es ein echtes mount-ui in ../app/ui/mount-ui.js gibt -> leiten wir dahin weiter.
//   - Wenn nicht -> Minimal-Fallback, der dir wenigstens Menü + Diagnose anzeigt.
//
// HINWEIS
// - Das ist absichtlich defensiv, damit du NICHT wieder im Kreis drehst.

async function tryImport(path) {
  try {
    const mod = await import(path);
    return mod;
  } catch (e) {
    return null;
  }
}

function ensureVisible(el) {
  if (!el) return;
  el.style.display = el.style.display || "block";
}

function renderFallbackUI({ bus, store, registry, el }) {
  const { menu, view } = el || {};
  ensureVisible(menu);
  ensureVisible(view);

  if (menu) {
    menu.innerHTML = `
      <div style="padding:10px; border:1px dashed #bbb; background:#fafafa;">
        <b>⚠️ Fallback-Menü (mount-ui SHIM)</b><br/>
        Das echte UI-Mount-Modul wurde nicht gefunden.<br/>
        <small>Du siehst das, damit du nicht wieder nur "(lädt...)" hast.</small>
        <div style="margin-top:8px; display:flex; gap:8px; flex-wrap:wrap;">
          <button id="shim_btn_diag">Diagnose anzeigen</button>
          <button id="shim_btn_clear">localStorage reset</button>
        </div>
      </div>
    `;
    const btnDiag = menu.querySelector("#shim_btn_diag");
    const btnClear = menu.querySelector("#shim_btn_clear");

    btnDiag?.addEventListener("click", () => {
      if (!view) return;
      view.innerHTML =
        `<pre style="white-space:pre-wrap; font-size:12px; line-height:1.35; padding:10px; border:1px solid #ddd;">` +
        `✅ bus: ${!!bus}\n` +
        `✅ store: ${!!store}\n` +
        `✅ registry: ${!!registry}\n\n` +
        `bus keys: ${bus ? Object.keys(bus).join(", ") : "-"}\n` +
        `store keys: ${store ? Object.keys(store).join(", ") : "-"}\n` +
        `registry keys: ${registry ? Object.keys(registry).join(", ") : "-"}\n` +
        `</pre>`;
    });

    btnClear?.addEventListener("click", () => {
      try {
        localStorage.clear();
        alert("localStorage geleert. Bitte Seite neu laden.");
      } catch (e) {
        alert("Konnte localStorage nicht leeren: " + e.message);
      }
    });
  }

  if (view && !view.innerHTML.trim()) {
    view.innerHTML =
      `<div style="padding:10px; color:#444;">
        <b>UI noch nicht gemountet.</b><br/>
        Öffne oben im Fallback-Menü „Diagnose anzeigen“.
      </div>`;
  }
}

export async function mountUI(ctx) {
  // 1) Versuch: echtes UI-Modul
  const real = await tryImport("../app/ui/mount-ui.js");
  if (real?.mountUI) {
    console.log("[mount-ui shim] delegating to ../app/ui/mount-ui.js");
    return real.mountUI(ctx);
  }
  if (typeof real?.default === "function") {
    console.log("[mount-ui shim] delegating default() to ../app/ui/mount-ui.js");
    return real.default(ctx);
  }

  // 2) Fallback
  console.warn("[mount-ui shim] real mount-ui not found. Using fallback UI.");
  renderFallbackUI(ctx);
}
