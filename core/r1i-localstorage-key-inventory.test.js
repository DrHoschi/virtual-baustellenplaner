/**
 * R1i DIAGNOSTIC ONLY
 *
 * Inventory of LocalStorage key sizes after an explicit QuotaExceededError.
 * Logs key names and character counts only; never logs stored values.
 * Runs once, no polling and no mutations/deletions.
 */

function collectLocalStorageInventory() {
  const entries = [];
  let totalValueChars = 0;
  let totalKeyChars = 0;

  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = String(localStorage.key(i) || "");
      const value = localStorage.getItem(key) || "";
      const valueChars = value.length;
      const keyChars = key.length;
      totalValueChars += valueChars;
      totalKeyChars += keyChars;
      entries.push({ key, valueChars, totalChars: keyChars + valueChars });
    }
  } catch (error) {
    return {
      error: error?.message || String(error),
      keys: entries.length,
      totalValueChars,
      totalKeyChars,
      totalChars: totalValueChars + totalKeyChars,
      approxUtf16Bytes: (totalValueChars + totalKeyChars) * 2,
      largest: []
    };
  }

  entries.sort((a, b) => b.totalChars - a.totalChars);

  return {
    keys: entries.length,
    totalValueChars,
    totalKeyChars,
    totalChars: totalValueChars + totalKeyChars,
    approxUtf16Bytes: (totalValueChars + totalKeyChars) * 2,
    largest: entries.slice(0, 15)
  };
}

function logInventory() {
  try {
    window.BP_CRASH_RECORDER?.log?.(
      "diag:r1i:localstorage-key-inventory",
      collectLocalStorageInventory()
    );
  } catch {}
}

// Crash recorder is normally available before this diagnostic chain executes.
// The short delay keeps the measurement out of the startup hot path.
setTimeout(logInventory, 1200);
