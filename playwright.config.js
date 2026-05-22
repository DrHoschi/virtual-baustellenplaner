// playwright.config.mjs
// Version: v1.2.1-ci-webserver-baseurl-fix (2026-05-22)
//
// Diese Datei ist nur ein Alias auf die echte Konfiguration.
// Sie verhindert, dass Playwright versehentlich eine alte Minimal-Konfiguration
// ohne baseURL und ohne webServer lädt.

import config from "./playwright.config.js";

export default config;
