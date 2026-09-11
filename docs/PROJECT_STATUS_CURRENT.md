# PROJECT STATUS CURRENT

Status authority for the Baustellenplaner repository.

## NEW CHAT RULE

Before any development decision, branch action, code change, cleanup, merge, freeze, deployment change, or roadmap continuation, read this file first and verify its referenced branch/SHA against GitHub.

Do not infer the current product state from `main`, an older chat summary, a branch name, or an older deployment.

## Current authority

- Status block: `PROJECT-STATE-01C – Authoritative Project Status Document`
- Last frozen product block: `PROJECT-UI-03C – Library Ownership Separation & Surface Consolidation`
- Frozen 03C functional SHA: `b68096e83524fc87d73492d49dc113c670a31d2b`
- 03C freeze documentation SHA / reconciled product continuation baseline before this status document: `b192246a6e0444e865eaeeca6ef1fcc59a4f6432`
- Authoritative continuation branch: `feature/project-ui-03c-library-ownership-separation-recovery`
- Rule: after this status-document commit, the branch head containing this file is the authoritative continuation SHA until a later explicitly reconciled status update supersedes it.

`main` is NOT the current product authority. At PROJECT-STATE-01B it was `c99ba02eca963d3366e662866b491bfa4c1d5325` and served as the TEST-DEPLOY bootstrap/workflow line.

## Frozen product scope

`PROJECT-UI-03C = FROZEN / COMPLETION PASS / REGRESSION PASS / DEVICE PASS / 0 BLOCKER`

03C separates project-owned library references from the global library catalog. Its functional delta over the Hall/Planning baseline `118ac1990770a7f1507996acff5524875f172389` is restricted to:

- `ui/panels/AssetLibraryPanel.js`
- `ui/panels/ProjectLibrariesPanel.js`
- `ui/panels/panel-registry.js`

Preservation gates passed for Project Overview/Assets, Planning/Workarea, Hall3D including hall creation/edit persistence, AssetLab, and open-project state.

Hall3D remains an existing preserved capability owned by Planning → Hall Context. Missing or changing navigation visibility must never be interpreted as authorization to delete Hall3D, its data, or its assets.

## Open separate work

### NAV-BACK-01 – Contextual Back Visibility & Validity Contract

Status: `DEFINED / NOT IMPLEMENTED`

- Global Shell owns the upper Back control.
- It is a contextual-return control, not browser history and not a generic previous-screen action.
- It may be visible only with a valid contextual return session.
- Project → Bibliotheken → Globaler Bibliothekskatalog is defined to become a contextual transition returning to `projectPanel:libraries` while preserving project context.
- Stale/non-functional Back visibility is forbidden by the contract.
- This finding is separate from frozen PROJECT-UI-03C and must not retroactively expand 03C scope.

### TEST-DEPLOY-01 – Deterministic Device Deployment

Status: `IMPLEMENTED / FIRST CONTROLLED DEPLOYMENT PASS / NOT FROZEN`

- Tooling/test line: `feature/test-deploy-01-deterministic-device-deploy`
- Tested tooling SHA: `8e17e0bcbaf3054183fc8382c5744c92de46aaa9`
- First controlled deployment: `PROJECT-UI-03C · TESTBUILD 1 · 8e17e0bc` = PASS.
- Triple Match was confirmed: expected SHA = deployed SHA = visible device build identity.
- Original TEST-DEPLOY-01 freeze contract still requires a second controlled deployment using a different SHA before TEST-DEPLOY-01 itself may be frozen.
- TEST-DEPLOY-01 is a parallel open tooling line and is NOT the product continuation authority.

## Deferred cleanup

Status: `DEFERRED CLEANUP / DO NOT DELETE YET`

Known candidates include:

- accidental branch `noop` at `b68096e83524fc87d73492d49dc113c670a31d2b`
- wrong-baseline branch `feature/project-ui-03c-library-ownership-separation`
- old patch/audit/technical intermediate branches
- bootstrap/test branches after their authority and history requirements have been reconciled
- old open PR(s), including historical PR #2, require explicit review before closing/removal

No item in this section is authorized for deletion merely because it is listed here.

## Historical authority notes

- `feature/project-ui-04a-existing-project-hall-creation-entry` / `118ac1990770a7f1507996acff5524875f172389` is the Hall/Planning predecessor of the correct 03C recovery line.
- Correct 03C functional SHA `b68096e...` is exactly three commits above `118ac199...` and changes only the three Library files listed above.
- Freeze documentation `b192246a...` is exactly one documentation-only commit above `b68096e...`.
- TEST-DEPLOY SHA `8e17e0bc...` and freeze-documentation SHA `b192246a...` are sibling lines from common functional ancestor `b68096e...`; TEST-DEPLOY must not silently replace product authority.

## Development safety rules

1. Verify this file and its current branch head before acting in a new chat.
2. No branch creation, switching, moving, merging, deletion, cleanup, or code modification unless the current explicitly authorized step requires it.
3. Reconcile/define first; implementation only after explicit authorization.
4. Freeze only after the applicable completion/regression/device/CI gates pass.
5. Preserve existing capabilities unless an explicit approved scope says otherwise.
6. Do not use `main` as product authority unless a later reconciliation explicitly changes that rule.
7. Keep product authority and deployment/tooling authority separate until explicitly integrated.

## Exact next permitted step

After PROJECT-STATE-01C is verified, no product implementation is implicitly authorized.

The next step must be explicitly selected and authorized from the remaining open work. Current known candidates are:

- finish/reconcile `TEST-DEPLOY-01`,
- implement the separately defined `NAV-BACK-01`, or
- perform a separately scoped cleanup reconciliation before any deletion.

Until that selection is made: `0 CLEANUP / 0 TEST-DEPLOY INTEGRATION / 0 NAV-BACK IMPLEMENTATION / 0 NEW PRODUCT BLOCK`.
