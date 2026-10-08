# BP-029 – Global Material Catalog Validation Infrastructure

## Status

**FROZEN**

Functional freeze head:

`689a58b14ff7bdcc5e6b548a6f2439707ff3df23`

Authorized base:

`587bec5102781b172f4c11400e1024a78ac8ab02`

Feature branch:

`feature/BP-029-global-material-catalog-validation`

## Purpose

BP-029 validation infrastructure protects the existing global material catalog authority before real material master data is admitted. It does not populate the catalog and does not introduce a second runtime or project-level material authority.

The authoritative catalog remains:

`data/global-material-catalog.v1.json`

## Frozen Validation Contract

The validator checks the existing catalog contract:

- schema `baustellenplaner.globalMaterialCatalog.v1`
- version `1.0.0`
- `materials` must be an array
- required string fields: `materialId`, `manufacturer`, `articleNumber`, `name`, `unit`
- required fields must remain non-empty after trimming
- unknown placeholders such as `?`, `unknown`, `N/A`, and `TBD` are rejected
- `materialId` must be unique
- normalized `manufacturer + articleNumber` must be unique
- equal display names are allowed and are not material identity

The validator does not guess, repair, enrich, select, or create material master data.

## Empty Catalog Contract

The existing global material catalog remains intentionally empty:

`"materials": []`

An empty catalog is explicitly valid. BP-029 validation infrastructure must therefore be deployable and fully green before any real article intake occurs.

No placeholder or invented article is required to make the catalog valid.

## Functional Diff Scope

Against authorized base `587bec5102781b172f4c11400e1024a78ac8ab02`, the functional implementation changes exactly three files:

- `scripts/global-material-catalog-check.mjs`
- `tests/bp-029-global-material-catalog-validation.spec.mjs`
- `.github/workflows/ci-checks.yml`

`data/global-material-catalog.v1.json` is unchanged.

No BP-026, BP-027, BP-028 product logic, project persistence, Workarea UI, CSS, or asset catalog is changed.

## CI Binding

Product CI contains one dedicated BP-029 step:

`BP-029 Global Material Catalog Validation`

It executes both the real-catalog validator and the focused BP-029 validation-contract test.

## Verification Evidence

Implementation Verification / Scope / Regression Gate: **PASS**

Exact functional head:

`689a58b14ff7bdcc5e6b548a6f2439707ff3df23`

Git relation to authorized base:

- ahead: 3 commits
- behind: 0
- merge base: exact authorized base
- functional diff: exactly three authorized files

Exact-Head GitHub Actions evidence:

- Workflow: **Product CI**
- Run number: **#1480**
- Run ID: `36623760772`
- Event: `push`
- Head SHA: `689a58b14ff7bdcc5e6b548a6f2439707ff3df23`
- Status: `completed`
- Conclusion: **success**

The dedicated BP-029 validation step passed. The same run also completed the existing BP-025, BP-019, BP-018, BP-017, BP-024, wizard, UI/E2E, and smoke gates successfully.

## Non-Scope Preserved

This freeze does not include:

- real material/article catalog entries
- browser CRUD for global material master data
- project persistence for global master data
- manufacturer online import or scraping
- supplier data, prices, discounts, or inventory
- packaging/order optimization
- automatic article selection
- technical variant derivation
- substitutions
- EPLAN coupling
- changes to BP-026 mapping authority
- changes to BP-027 assignment authority
- changes to BP-028 output or quantity authority

## Freeze Decision

BP-029 Validation Infrastructure is **FROZEN** at functional head:

`689a58b14ff7bdcc5e6b548a6f2439707ff3df23`

This document adds completion/evidence/freeze documentation only. The functional freeze head remains the SHA above.

Catalog population is explicitly a later, separately authorized step. Integration into `main` is also not part of this gate and requires separate Integration Reconciliation and Fast-Forward authorization.
