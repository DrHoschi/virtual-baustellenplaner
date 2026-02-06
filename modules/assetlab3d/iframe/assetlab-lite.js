/* ========================================================================== */
/*  AssetLab 3D (Lite) — iOS Embed Scroll-Lock Bridge (Patch-Block)            */
/*  Version: v1.0.1-scrolllock-bridge (2026-02-06)                              */
/*                                                                            */
/*  Zweck:                                                                     */
/*  - Im eingebetteten Baustellenplaner (scrollender Host + iframe + WebGL)    */
/*    friert iOS Safari gerne ein (kein Orbit/kein Scroll zurück).             */
/*  - Lösung: iframe meldet dem Host, wann er Scroll sperren/entsperren soll.  */
/*                                                                            */
/*  Erwartete Voraussetzungen im assetlab-lite.js:                              */
/*  - Es gibt `projectId` (aus Query)                                          */
/*  - Es gibt eine Funktion `hostPost(type, payload)` ODER du nutzt            */
/*    `window.parent.postMessage(...)` direkt                                  */
/*  - Es gibt `renderer` (THREE.WebGLRenderer)                                 */
/*                                                                            */
/*  Message: iframe -> host                                                    */
/*  - type: "assetlab:lockScroll", payload: { lock:true|false, projectId }     */
/* ========================================================================== */

/* -------------------------------------------------------------------------- */
/* WHERE TO INSERT:                                                            */
/* 1) NACHDEM `projectId` verfügbar ist UND nachdem du `renderer` erstellt hast */
/*    (also nachdem `renderer.domElement` existiert).                           */
/* -------------------------------------------------------------------------- */

// --- Helper: Host-Post (Fallback, falls du keine hostPost-Funktion hast) ---
const __hostPost = (type, payload) => {
  try {
    // Wenn du schon hostPost hast, kannst du hier einfach hostPost(type,payload) nutzen.
    if (typeof hostPost === "function") {
      hostPost(type, payload);
      return;
    }
    // Fallback: direkt an Parent posten (same-origin empfohlen)
    window.parent?.postMessage({ type, payload }, window.location.origin);
  } catch (e) {
    // bewusst leise – darf nie crashen
  }
};

// --- Scroll-Lock State (damit wir nicht spammen) ---
const __scrollLockState = { locked: false };

// --- Lock/Unlock Funktionen ---
const __lockHostScroll = () => {
  if (__scrollLockState.locked) return;
  __scrollLockState.locked = true;
  __hostPost("assetlab:lockScroll", { lock: true, projectId });
};

const __unlockHostScroll = () => {
  if (!__scrollLockState.locked) return;
  __scrollLockState.locked = false;
  __hostPost("assetlab:lockScroll", { lock: false, projectId });
};

// --------------------------------------------------------------------------
// iOS Touch Handling:
// - Wichtig: Canvas/Viewport soll Touch-Gesten "für sich" beanspruchen.
// - `touch-action:none` hilft v.a. auf iOS, dass Safari nicht scrollt/zoomt.
// --------------------------------------------------------------------------
try {
  // Canvas-Element
  const __canvas = renderer?.domElement;

  if (__canvas) {
    __canvas.style.touchAction = "none";
    __canvas.style.webkitTouchCallout = "none";
    __canvas.style.webkitUserSelect = "none";
    __canvas.style.userSelect = "none";

    // 1) Pointer Events (modern, oft ausreichend)
    __canvas.addEventListener("pointerdown", __lockHostScroll, { passive: true });
    __canvas.addEventListener("pointerup", __unlockHostScroll, { passive: true });
    __canvas.addEventListener("pointercancel", __unlockHostScroll, { passive: true });
    __canvas.addEventListener("pointerleave", __unlockHostScroll, { passive: true });

    // 2) Touch Events (iOS liefert manchmal kein pointerup sauber)
    __canvas.addEventListener("touchstart", __lockHostScroll, { passive: true });
    __canvas.addEventListener("touchend", __unlockHostScroll, { passive: true });
    __canvas.addEventListener("touchcancel", __unlockHostScroll, { passive: true });

    // 3) Sicherheitsnetz: Wenn Tab/Focus wechselt → unlock
    window.addEventListener("blur", __unlockHostScroll, { passive: true });
    window.addEventListener("pagehide", __unlockHostScroll, { passive: true });

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) __unlockHostScroll();
    }, { passive: true });
  }
} catch (e) {
  // nie crashen
}

// --------------------------------------------------------------------------
// OPTIONAL (empfohlen): Lock auch bei Orbit/Drag-Start (falls du Controls hast)
// --------------------------------------------------------------------------
try {
  // Wenn du OrbitControls nutzt und `controls` heißt:
  // controls.addEventListener("start", __lockHostScroll);
  // controls.addEventListener("end", __unlockHostScroll);

  if (typeof controls !== "undefined" && controls?.addEventListener) {
    controls.addEventListener("start", __lockHostScroll);
    controls.addEventListener("end", __unlockHostScroll);
  }
} catch (e) {
  // ignore
}

/* -------------------------------------------------------------------------- */
/* END PATCH                                                                   */
/* -------------------------------------------------------------------------- */
