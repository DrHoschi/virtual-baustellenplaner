# BP-CI-01 – Completion / Evidence / Freeze

## Status

**FROZEN WITH KNOWN BASELINE LIMITATION**

Functional implementation head:

`8b60ee6316b7ad105ab01cdf6ca5c9066aae34ed`

Authorized base:

`main = 11e72cacffb717f4b6722711608a484a99844b34`

Branch:

`maintenance/BP-CI-01-workflow-consolidation`

## Scope

BP-CI-01 consolidates the active GitHub Actions landscape without changing product behavior.

Implemented scope:

- `.github/workflows/ci-checks.yml` remains the single automatic product-quality workflow and is named **Product CI**.
- The redundant standalone syntax workflow is retired.
- Historical PROJECT-UI, R2F-01, UI-MIG and TECH-WA-FREEZE workflow definitions are retired from the active CI landscape.
- Their underlying test files and scripts are retained.
- `test-deploy-01-deterministic-pages.yml` remains the separate manual exact-SHA Pages deployment workflow.
- `export-project.yml` and `export-project-light.yml` remain manual helper workflows.
- No product, Planning, cable-route, UI, test or script implementation was changed.

## Resulting workflow landscape

Exactly four workflow files remain:

1. `.github/workflows/ci-checks.yml` — Product CI; automatic on push / pull request, plus manual dispatch.
2. `.github/workflows/test-deploy-01-deterministic-pages.yml` — manual deterministic exact-SHA test deployment.
3. `.github/workflows/export-project.yml` — manual project export.
4. `.github/workflows/export-project-light.yml` — manual lightweight project export.

## Verification evidence

Verification was performed read-only against exact functional head `8b60ee6316b7ad105ab01cdf6ca5c9066aae34ed`.

Repository comparison against the authorized base showed:

- ahead by 2 commits
- behind by 0 commits
- merge base equals `11e72cacffb717f4b6722711608a484a99844b34`
- all changed paths are below `.github/workflows/`

The exact-head push produced one automatic GitHub Actions run:

- Workflow: **Product CI**
- Run ID: `36342844213`
- Exact head SHA: `8b60ee6316b7ad105ab01cdf6ca5c9066aae34ed`
- Branch: `maintenance/BP-CI-01-workflow-consolidation`
- Overall conclusion: **failure**

All Product CI steps through **UI Wiring E2E** completed successfully. The only failing step was **Smoke Tests**.

## Known baseline limitation

The failing smoke test is:

`tests/smoke.spec.js:71:1 – Baustellenplaner loads without fatal errors`

Observed error:

`Failed to load resource: the server responded with a status of 404 (Not Found)`

This is not introduced by BP-CI-01. The authorized base `main = 11e72cacffb717f4b6722711608a484a99844b34` already had the central CI workflow failing before this cleanup, together with multiple historical workflow failures.

BP-CI-01 intentionally does **not** repair the smoke-test/product baseline because that would exceed the authorized workflow-cleanup scope.

## Freeze decision

- Scope: **PASS**
- Workflow consolidation: **PASS**
- Exact-head Product CI execution: **VERIFIED**
- Product CI overall: **FAILURE – KNOWN BASELINE LIMITATION**
- BP-CI-01 regression attributable to this change: **none identified**

Therefore BP-CI-01 is frozen as:

**FROZEN WITH KNOWN BASELINE LIMITATION**

The functional freeze remains `8b60ee6316b7ad105ab01cdf6ca5c9066aae34ed`. This document records completion/evidence only and does not alter the functional implementation.
