/**
 * Baustellenplaner – Minimal Event Bus
 * Datei: app/bus.js
 * Version: v1.0.0 (2026-02-03)
 *
 * Ziel:
 * - Ultraleichter Event-Bus (on/off/emit)
 * - Keine Abhängigkeiten
 * - Sauber für modulare Architektur (Module sprechen nur über Bus)
 *
 * Nutzung:
 *   import { createBus } from "./bus.js";
 *   const bus = createBus();
 *   bus.on("ping", (payload) => console.log(payload));
 *   bus.emit("ping", { ok: true });
 */

export function createBus() {
  /** @type {Map<string, Set<Function>>} */
  const listeners = new Map();

  function on(eventName, handler) {
    if (!listeners.has(eventName)) listeners.set(eventName, new Set());
    listeners.get(eventName).add(handler);
    // Rückgabe = Unsubscribe-Funktion (praktisch für UI-Teardown)
    return () => off(eventName, handler);
  }

  function off(eventName, handler) {
    const set = listeners.get(eventName);
    if (!set) return;
    set.delete(handler);
    if (set.size === 0) listeners.delete(eventName);
  }

  function emit(eventName, payload) {
    const set = listeners.get(eventName);
    if (!set) return;
    // Kopie, damit Handler während emit unsubscriben dürfen
    [...set].forEach((fn) => {
      try {
        fn(payload);
      } catch (err) {
        // Debug-freundlich: Fehler nicht verschlucken, aber Bus nicht killen
        console.error(`[bus] handler error for "${eventName}"`, err);
      }
    });
  }

  function clearAll() {
    listeners.clear();
  }

  return { on, off, emit, clearAll };
}
