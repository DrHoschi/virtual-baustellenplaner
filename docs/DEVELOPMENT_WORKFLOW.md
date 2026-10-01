# Development Workflow – Consolidated Gates

Status: **AUTHORITATIVE FOR FUTURE WORK**  
Effective: **2026-10-01**

This document defines the default development workflow for future work in `virtual-baustellenplaner`. Historical gates, freeze heads, completion records, and evidence remain valid and are not rewritten retroactively.

## Goal

Preserve the existing technical and functional safeguards while reducing repeated repository analysis and artificially separated approval steps.

The previous highly fragmented sequence of Definition, Reconciliation, Authorization, Implementation, Verification, blocker/correction sub-gates, Completion/Evidence/Freeze, Integration Reconciliation, and Integration is no longer the default for normal, clearly bounded work.

## Standard workflow

### Gate 1 – Analysis / Scope / Authorization

One combined read-only analysis and authorization pass must:

- determine and record the exact authoritative starting head;
- analyze the existing implementation and already available functionality;
- define the functional and technical scope;
- identify affected files and responsibility boundaries;
- inspect persistence, mapping, state, and architecture boundaries where relevant;
- define required focused tests and regression coverage;
- determine the minimal diff;
- authorize implementation for exactly that scope and starting head.

No implementation begins while the starting head or scope is ambiguous.

### Gate 2 – Implementation / Verification

Using the authorized scope:

- use or create the intended branch from the authorized starting head;
- implement only the authorized scope;
- make no opportunistic side changes;
- run focused tests;
- run relevant existing regression tests;
- run or evaluate Exact-Head Product CI where required;
- verify the resulting diff and scope fidelity;
- record the exact functional result head.

If implementation and verification are fully PASS, no additional standalone verification assignment is required.

A real blocker stops the gate. Corrections outside the already authorized scope require explicit reconciliation and renewed authorization before implementation.

### Gate 3 – Completion / Evidence / Freeze / Integration

After successful verification:

- document the result and relevant evidence;
- record known limitations explicitly;
- record the functional freeze head;
- update completion/freeze documentation;
- verify integration safety against the current authoritative `main`;
- verify that no foreign changes, divergence, or unexpected commits exist;
- when the integration is unambiguously a safe linear fast-forward, integrate into `main`;
- record the final authoritative `main` head.

If the integration state is not unambiguously linear and safe, stop before integration and perform a separate reconciliation.

## Stop rules

The consolidated workflow does not weaken existing safeguards. In particular:

- never work against an unclear or stale head;
- never expand scope without authorization;
- never modify unauthorized files;
- never introduce silent architecture changes;
- never introduce data migration or contract changes without explicit scope;
- never integrate across unresolved divergence or foreign changes;
- never declare PASS without defensible verification evidence;
- distinguish known baseline failures from newly introduced regressions.

## When finer gates remain required

The three-gate structure is the default, not a mandatory simplification for risky work. Separate reconciliation, authorization, verification, correction, or integration gates remain appropriate or required for:

- persistence or SaveGame contract changes;
- data-authority or central state-responsibility changes;
- schema or contract migrations;
- major architecture or module restructuring;
- safety-critical or difficult-to-reverse changes;
- broad refactors spanning many responsibility boundaries;
- unresolved baseline failures;
- divergent branches or foreign changes;
- missing or contradictory evidence;
- any case where scope or impact cannot be determined unambiguously.

## Resource rule

Repository analysis should be reused within a gate whenever the relevant head has not changed.

The same unchanged head must not be fully re-analyzed in immediately consecutive assignments without a technical reason. Small formal approval steps must not cause an additional repository pass when the exact starting head, scope, and safety boundaries are already unambiguous and documented.

## Historical continuity

All completed historical blocks retain their recorded gates, freeze heads, evidence, limitations, and integration history. This workflow change applies prospectively only.
