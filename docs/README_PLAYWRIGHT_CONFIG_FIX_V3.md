# Playwright Config Fix v3

Dieses Patch-ZIP ersetzt:

- `playwright.config.js`
- `playwright.config.mjs`

Beide Dateien enthalten jetzt eine vollständige eigenständige Konfiguration.

Grund:
Der vorherige Stand hatte sehr wahrscheinlich eine Kreisreferenz:
`playwright.config.js` importiert `playwright.config.mjs`
oder umgekehrt. Dadurch entsteht:

```text
ReferenceError: Cannot access 'config' before initialization
```

Fix:
Keine Datei importiert mehr die andere. Beide definieren `defineConfig(...)`
eigenständig mit:

- `webServer`
- `baseURL`
- `trace`
- `video`
- `screenshot`
- `retries`

Danach testen:

```bash
node scripts/import-graph-check.mjs
npx playwright test tests/ui-wiring.spec.js
```
