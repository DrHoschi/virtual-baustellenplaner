# BP-030 – First Verified Article Batch Intake

## Status

**FROZEN**

Functional freeze head:

`e0e516f743c5679fb695ef4516274c898b707d15`

Authorized base:

`bac172ae7d3110fee1311a64988d9cedd4193009`

Feature branch:

`feature/BP-030-first-verified-article-batch`

## Purpose

BP-030 introduces the first deliberately small batch of verified real material master data into the existing global material catalog authority. It does not change catalog validation, mapping, assignment, output, UI, project persistence, or quantity authority.

The authoritative catalog remains:

`data/global-material-catalog.v1.json`

## Frozen Functional Scope

Against authorized base `bac172ae7d3110fee1311a64988d9cedd4193009`, the functional implementation changes exactly one file:

- `data/global-material-catalog.v1.json`

No validator, test, workflow, mapping, UI, persistence, or product-code file is changed by the functional BP-030 commit.

## Verified Article Batch

Exactly three Niedax articles are admitted:

1. `mat.niedax.rd-100.v1`
   - manufacturer: `Niedax`
   - articleNumber: `RD 100`
   - name: `Deckel für Kabelrinne/-leiter, 102×3000 mm, t=0,75 mm, Stahl bandverzinkt`
   - unit: `m`

2. `mat.niedax.rd-200.v1`
   - manufacturer: `Niedax`
   - articleNumber: `RD 200`
   - name: `Deckel für Kabelrinne/-leiter, 202×3000 mm, t=0,75 mm, Stahl bandverzinkt`
   - unit: `m`

3. `mat.niedax.rw-60.v1`
   - manufacturer: `Niedax`
   - articleNumber: `RW 60`
   - name: `Trennsteg, 55×3000 mm, t=0,75 mm, Stahl bandverzinkt`
   - unit: `m`

No other material article is part of this freeze.

## BP-029 Validation Boundary

The BP-029 validation infrastructure remains unchanged.

The existing validator therefore evaluates the real three-article catalog without any BP-030 exception, relaxation, or test-boundary modification.

## Verification Evidence

Implementation Verification / Scope / Regression Gate: **PASS**

Exact functional head:

`e0e516f743c5679fb695ef4516274c898b707d15`

Git relation to authorized base:

- ahead: 1 commit
- behind: 0
- merge base: exact authorized base
- functional diff: exactly one authorized file

Exact-Head GitHub Actions evidence:

- Workflow: **Product CI**
- Run number: **#1484**
- Run ID: `36673184034`
- Event: `push`
- Head SHA: `e0e516f743c5679fb695ef4516274c898b707d15`
- Status: `completed`
- Conclusion: **success**

The existing `BP-029 Global Material Catalog Validation` step completed successfully against the populated three-article catalog. The same Exact-Head Product CI also completed the existing BP-025, BP-019, BP-018, BP-017, BP-024, wizard, UI/E2E, and smoke gates successfully.

## Non-Scope Preserved

This freeze does not include:

- additional Niedax articles
- heavy or walkable cable-tray variants
- heavy / anti-slip covers
- unresolved 90/95 mm divider variants
- C-rails
- Hilti or Würth articles
- automatic article selection
- mapping changes
- BP-026 identity-resolution changes
- BP-027 assignment UI changes
- BP-028 output changes
- quantity-authority changes
- browser catalog CRUD
- project persistence for global master data

## Freeze Decision

BP-030 First Verified Article Batch Intake is **FROZEN** at functional head:

`e0e516f743c5679fb695ef4516274c898b707d15`

This document adds completion/evidence/freeze documentation only. The functional freeze head remains the SHA above.

Integration into `main` is not part of this gate and requires a separate read-only Integration Reconciliation followed by separately authorized Fast-Forward integration.
