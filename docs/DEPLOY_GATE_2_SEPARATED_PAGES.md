# Deploy Gate 2 — separated Pages delivery

Implementation base: `469a9ff25e255b4d2c6daf5bd2dec295ccad404c`.
Implementation branch: `fix/deploy-gate-2-separated-pages`.
No main integration. No Paket C or H runtime modifications.

## One complete artifact

- `/virtual-baustellenplaner/`: exact main source `be0061f6cca67c30adee8b476e8ea0265707ab18`.
- `/virtual-baustellenplaner/planner-v2/`: authorized exact source SHA, initially functional Paket H freeze `d68affb043024f544cb104666f6f93d2c0e52866`.
- Each entry has its own `build-info.json`. Neuaufbau has static expandable Builddetails with branch, full source SHA and build label; its runtime source remains unchanged.
- The delivery script exports Git trees, refuses a changed main baseline, rejects non-exact SHA and requires test source ancestry in origin/dev/planner-neuaufbau. It never republishes a previous artifact or copies a working tree.
- The main entry remains byte-identical. Only deployment metadata, `.nojekyll`, the reserved test subtree and removal of `.github` differ from the main source tree.

## Required hosting configuration before any deployment

1. Settings > Pages > Build and deployment > Source: **GitHub Actions**. This replaces the competing branch/Jekyll publisher.
2. Settings > Environments > github-pages > Deployment branches and tags: allow only `fix/deploy-gate-2-separated-pages` for this rollout. Existing copies of the old workflow on main/dev must not be able to deploy. Do not allow all branches.
3. Let any old in-flight deployment finish/cancel it before the first combined publication.

The connector does not expose Pages administration. These settings require an administrator or an explicitly authorized browser fallback. The new deploy job additionally reads Pages configuration and fails closed unless build_type is workflow.

## Verification and rollout

Push to the isolated implementation branch builds/verifies an artifact only; deployment is skipped. Manual workflow dispatch uses the existing workflow filename and must select the implementation branch. Inputs for first rollout:

- commit_sha: d68affb043024f544cb104666f6f93d2c0e52866
- block_id: Paket-H
- test_build: 6
- publish: true, only after the configuration above is verified

Local test checks both exact identities, unchanged main entry, all frozen planner-v2 source files except the intentional index identity overlay, malformed/empty input rejection, and refusal to overwrite an existing output. YAML/syntax and Git whitespace checks supplement it. Remote CI, actual deployment and real device evidence must be recorded separately; local success is not deployment evidence.

On iPhone portrait and iPad portrait/landscape open the test subpath and inspect Builddetails: branch dev/planner-neuaufbau, SHA d68affb043024f544cb104666f6f93d2c0e52866, Paket-H / 6. Verify the main entry separately. Then test existing Paket C cable/tray creation, editing, save/reload and project export/import. No complete device matrix has been claimed.

No automatic deployment on future dev pushes is enabled by this block. Main and development branch refs remain unchanged during this isolated implementation. Subsequent delivery ownership/branch changes require a deliberate configuration update.
