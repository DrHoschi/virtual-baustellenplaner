# Playwright Config Fix v2

Ursache des Fehlers:

`ReferenceError: Cannot access 'config' before initialization`

Das passiert, wenn `playwright.config.js` versehentlich sich selbst importiert:

```js
import config from "./playwright.config.js";
export default config;
```

Korrektur:

- `playwright.config.js` ist wieder die echte Haupt-Konfiguration.
- `playwright.config.mjs` importiert nur diese Haupt-Konfiguration.
- Der Static-Server und `baseURL` sind in `playwright.config.js` definiert.

Nach dem Einspielen bitte ausführen:

```bash
node scripts/import-graph-check.mjs
npx playwright test tests/ui-wiring.spec.js
```
