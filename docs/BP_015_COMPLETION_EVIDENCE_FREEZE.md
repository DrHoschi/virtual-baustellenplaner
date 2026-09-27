# BP-015 – Practical Cable Preparation Output – Completion / Evidence / Freeze

## Status

**FROZEN WITH KNOWN BASELINE LIMITATIONS**

Functional Freeze Head:

`ba9e84dbd983d608a4d28cc5d24b115589a1843b`

Authorized base / current main at freeze time:

`2c2dc25880848931b440e39734fec45cbdd6a3c8`

Feature branch:

`feature/BP-015-practical-cable-preparation-output`

This document records completion evidence only. It does not integrate BP-015 into `main`.

## Purpose

BP-015 adds the first practical project-wide cable-preparation output. It serializes the already existing BP-014 preparation rows as CSV for use on site without creating a second cable authority or new persistent preparation model.

## Authority and data flow

The authoritative flow remains:

`assembly.instance.cableLines[]`
→ `_getProjectCablePreparationRowsV1()`
→ existing `_getCableLineRouteAssignmentV1(...)`
→ BP-009–013 derived planning state
→ BP-015 CSV projection

A BP-015 output row is runtime-only. No `cutList[]`, `preparationOutput[]` or equivalent persistent collection is introduced.

The fachliche CableLine identity remains `assemblyId + cableLine.id`.

## Practical output contract

The CSV contains one row per active project-wide CableLine and carries the previously defined preparation context:

- assembly ID and name
- location
- conveyor group
- CableLine ID
- cable number
- cable type / cableTypeHint
- source label
- target label
- known minimum tray path
- source reserve
- target reserve
- planned required length
- cut allowance
- planned cut length

The implementation reads these values from the existing BP-014 row and its existing assignment object. It does not independently scan or recalculate routes.

### Undetermined values

Existing null semantics remain authoritative.

- unavailable `plannedRequiredLengthM` → `Bedarf unbestimmt`
- unavailable `plannedCutLengthM` → `Zuschnitt unbestimmt`

An undetermined value is not converted to `0`, estimated, rounded or replaced by manual `lengthM`.

## Delivery contract

V1 delivery format is CSV.

The existing helpers are reused:

- `_downloadTextFileV1(...)` for the text-file download
- `_copyToClipboard(...)` as the additional iPhone/iPad/Safari fallback

The same serialized CSV is used for both paths.

No XLSX/PDF generator, share-sheet integration or new filesystem mechanism is introduced.

## Existing technical Assembly JSON export

The existing technical Assembly export remains separate and unchanged:

`baustellenplaner.assemblylab.cablelist.export.v1`

Its persistent cable payload remains:

`cableLines: sceneObj.cableLines || []`

BP-015 does not extend, replace or reinterpret that schema.

## Exact implementation diff

Comparison:

`2c2dc25880848931b440e39734fec45cbdd6a3c8`
→
`ba9e84dbd983d608a4d28cc5d24b115589a1843b`

Result:

- status: ahead
- ahead: 2 commits
- behind: 0
- merge base: exactly the authorized base
- `ui/panels/WorkareaPanel.base.js`: +75 / -0
- `tests/bp-015-cable-preparation-output.spec.js`: +27 / -0
- no other files changed

## Focused BP-015 contract test

`tests/bp-015-cable-preparation-output.spec.js` protects:

- use of `_getProjectCablePreparationRowsV1()`
- CSV projection from `row.cableLine` and `row.assignment`
- explicit undetermined required/cut semantics
- use of existing download helper
- use of existing clipboard helper
- absence of new `cutList` / `preparationOutput` authority
- absence of persistence for planned required/cut lengths
- continued presence of the existing Assembly JSON schema and CableLine payload

## Exact-Head CI evidence

Exact head:

`ba9e84dbd983d608a4d28cc5d24b115589a1843b`

All 16 push workflows completed:

- 10 successful
- 6 failed

Successful evidence includes Syntax Check and the unaffected planning/workspace gates.

### Known baseline limitations

The six failures match previously documented repository baseline limitations and do not indicate a new BP-015 regression:

1. **CI Checks (Syntax + Imports + Manifest + UI Wiring)**  
   Existing smoke test fails on a 404 console error. Syntax and import-graph checks themselves pass.

2. **UI-MIG-05B Planning Left Area Gate**  
   Existing visibility assertion times out waiting for `toBeHidden()`.

3. **UI-MIG-05C Insert Sources Gate**  
   Follows the same existing 05B visibility/prerequisite failure.

4. **TECH-WA-FREEZE-01B.2 Heartbeat Gate**  
   Existing 60-second click timeout because the Planning topbar `Auswahl` button intercepts pointer events.

5. **TECH-WA-FREEZE-01B.3 RAF Abort Gate**  
   Reaches the same existing 01B.2 pointer-event failure path.

6. **TECH-WA-FREEZE-01C Mobile Viewer Stability Gate**  
   Reaches the same existing 01B.2 pointer-event failure path.

No Exact-Head CI failure was identified as newly introduced by BP-015.

## Explicit non-scope

BP-015 does not add:

- new CableLine or cut-list persistence
- drum/spool assignment
- remaining-length management
- waste optimization
- warehouse stock
- order quantities
- automatic rounding
- automatic percentage uplift
- BOM mutation
- 3D routing
- XLSX export
- PDF export

## Freeze decision

The BP-015 implementation at
`ba9e84dbd983d608a4d28cc5d24b115589a1843b`
satisfies the authorized minimal scope and output contract.

Functional status:

**FROZEN WITH KNOWN BASELINE LIMITATIONS**

The functional Freeze Head remains exactly
`ba9e84dbd983d608a4d28cc5d24b115589a1843b`.

This documentation commit is completion/evidence metadata only and must not be treated as a change to BP-015 functional behavior.
