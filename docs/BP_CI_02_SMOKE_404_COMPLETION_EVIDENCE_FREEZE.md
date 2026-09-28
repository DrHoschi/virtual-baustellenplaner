# BP-CI-02 – Smoke 404 Root-Cause / Build-Info Contract – Completion / Evidence / Freeze

## Status

**FROZEN**

Functional Freeze Head:

`b3a3aa9fc310848bea23871c0f37831ce80266e7`

Authorized base:

`6a50329ff270453187c579080adaa0e785067b3f`

Maintenance branch:

`maintenance/BP-CI-02-smoke-404-root-cause`

## Purpose

BP-CI-02 resolves the long-standing Product CI Smoke-Test 404 baseline without changing product behavior or weakening general Smoke-Test failure criteria.

## Root cause

The failing test was:

`tests/smoke.spec.js` – `Baustellenplaner loads without fatal errors`

The browser emitted:

`Failed to load resource: the server responded with a status of 404 (Not Found)`

Initial Smoke output did not identify the request URL. A diagnostic-only change added failed-response evidence with HTTP status, resource type, and URL.

Exact-head Product CI #1411 on diagnostic head:

`ebf5f18f9ce01193e6cc83f4b5354973e7e5ec90`

identified the request reproducibly as:

`404 fetch http://127.0.0.1:<dynamic-port>/build-info.json`

The application shell intentionally fetches `build-info.json` for build identity. Under the established TEST-DEPLOY-01 contract this file is generated in the deployment artifact. It is not a repository-root source file and therefore is absent when the Smoke Test serves the raw repository root.

The existing UI Wiring test already recognizes this repo-root `build-info.json` 404 as an expected context-specific condition.

Therefore the baseline failure was a Smoke test-harness / deployment-contract mismatch, not evidence of a missing product source asset.

## Authorized exception contract

The Smoke Test may tolerate only the expected response satisfying all of these conditions:

- HTTP status is exactly `404`
- request resource type is exactly `fetch`
- request pathname ends with `/build-info.json`
- execution is the existing repository-root Smoke-Test context

The corresponding generic Chromium console error is ignored only when it can be paired with a captured expected `build-info.json` 404.

The exception does **not** authorize ignoring arbitrary 404 responses.

## Preserved hard-failure behavior

BP-CI-02 preserves hard failure for:

- every other `console.error`
- every `pageerror`
- non-exempt failed HTTP responses when they result in the existing error criteria
- missing required base elements
- the existing stuck-loader criterion

Failed-response diagnostics remain available for unexpected HTTP failures.

## Scope

BP-CI-02 changes only:

`tests/smoke.spec.js`

No application/product source file, deployment workflow, build-identity implementation, or product persistence/behavior was changed.

The maintenance work consists of two functional commits after the authorized base:

1. Diagnostic instrumentation:
   `ebf5f18f9ce01193e6cc83f4b5354973e7e5ec90`
2. Build-info Smoke contract reconciliation:
   `b3a3aa9fc310848bea23871c0f37831ce80266e7`

## Verification evidence

### Diagnostic CI

Product CI #1411

Exact diagnostic head:

`ebf5f18f9ce01193e6cc83f4b5354973e7e5ec90`

Evidence:

`404 fetch http://127.0.0.1:<dynamic-port>/build-info.json`

The same resource was identified on retry.

### Fix CI

Product CI #1412

Run ID:

`36385372259`

Exact head:

`b3a3aa9fc310848bea23871c0f37831ce80266e7`

Overall result:

**SUCCESS**

Relevant result:

- Smoke Tests: **PASS**

All other Product CI steps also completed successfully, including syntax/import/manifest checks, hall regressions, BP-017, BP-018, BP-019, Wizard Reopen, UI migration acceptance, and UI Wiring E2E.

No new regression failure remained on the exact functional head.

## Baseline disposition

The previously documented Product CI Smoke 404 baseline is **resolved by BP-CI-02**.

It must no longer be carried forward as a known baseline limitation after this maintenance block is integrated.

The resolution is deliberately narrow: it reconciles the repository-root Smoke harness with the already established deployment-generated `build-info.json` contract. It does not create a general HTTP-error suppression rule.

## Freeze decision

BP-CI-02 is **FROZEN** at functional head:

`b3a3aa9fc310848bea23871c0f37831ce80266e7`

Product CI #1412 is fully green on that exact head.

This completion document is evidence/metadata only. It does not modify the functional Smoke-Test fix and does not integrate BP-CI-02 into `main`.
