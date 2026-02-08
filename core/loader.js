// core/loader.js
// Version: v2.0.0-clean-bootstrap (2026-02-08)
//
// ZWECK
// - Zentraler, expliziter Einstiegspunkt der App
// - KEINE impliziten Side-Effects
// - KEINE globalen Abhängigkeiten
//
// WICHTIG
// - Diese Datei wird als ES Module geladen
// - startApp() MUSS exportiert sein
// - index.html ruft startApp() explizit auf

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import { mountUI } from './ui/mount-ui.js';
import { initRegistry } from './registry.js';
import { initBus } from './bus.js';
import { initStore } from './store.js';

// ---------------------------------------------------------------------------
// Interner Status (lokal, NICHT global)
// ---------------------------------------------------------------------------

let booted = false;

// ---------------------------------------------------------------------------
// Öffentliche API
// ---------------------------------------------------------------------------

/**
 * Startet die komplette Anwendung.
 * Diese Funktion ist der EINZIGE erlaubte Einstiegspunkt.
 */
export async function startApp() {
  if (booted) {
    console.warn('[loader] startApp() called twice – ignored');
    return;
  }

  booted = true;

  try {
    // 1) Core-Systeme initialisieren
    initBus();
    initStore();
    initRegistry();

    // 2) UI mounten
    await mountUI();

    // 3) Sichtbares Lebenszeichen für Tests & Debug
    signalReady();

    console.info('[loader] App successfully started');
  } catch (err) {
    console.error('[loader] FATAL during startApp()', err);
    showFatalError(err);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function signalReady() {
  const el = document.getElementById('active');
  if (el) {
    el.textContent = 'bereit';
  }
}

/**
 * Zeigt einen klaren Fehler im UI an
 * (statt still zu sterben)
 */
function showFatalError(err) {
  const el = document.getElementById('active');
  if (el) {
    el.textContent = 'Fehler beim Start';
    el.style.color = 'red';
  }
}
