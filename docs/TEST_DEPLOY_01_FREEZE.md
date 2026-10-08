# TEST-DEPLOY-01 – Completion / Freeze

Status: **FROZEN**

## Authoritative integrated baseline

- Product continuation branch: `feature/project-ui-03c-library-ownership-separation-recovery`
- Integrated TEST-DEPLOY-01 functional SHA: `4a5d8416428597c6b4177d57778840fe7a085380`
- Previous authoritative status SHA before TEST-DEPLOY-01 integration: `1518118b3afb394a681dd392e96e9de058522566`

This freeze documentation does not expand TEST-DEPLOY-01 scope and does not modify product functionality.

## Frozen scope

TEST-DEPLOY-01 provides deterministic GitHub Pages device deployment for an explicitly requested repository SHA.

Its integrated product-line delta is restricted to:

- `.github/workflows/test-deploy-01-deterministic-pages.yml`
- `ui/shell/GlobalCommandBar.js`

The deployment workflow:

- accepts an exact 40-character commit SHA,
- checks out and verifies that exact SHA,
- generates deployment `build-info.json`,
- verifies block ID, test-build number and SHA before upload,
- deploys the resulting artifact through GitHub Pages.

The Global Command Bar reads the generated deployment identity and exposes the visible form:

`BLOCK-ID · TESTBUILD n · shortSHA`

If deployment identity cannot be verified, the UI falls back to `BUILD UNVERIFIED`.

No Library, Hall3D, Planning, Project state, AssetLab, or NAV-BACK behavior belongs to this scope.

## Controlled deployment evidence

### Controlled Deployment 1

- Tested tooling SHA: `8e17e0bcbaf3054183fc8382c5744c92de46aaa9`
- Visible identity: `PROJECT-UI-03C · TESTBUILD 1 · 8e17e0bc`
- Exact requested SHA checkout: PASS
- Embedded deployment identity: PASS
- GitHub Pages deployment: PASS
- Visible device identity: PASS
- Triple Match: PASS

### Controlled Deployment 2

- Integrated product SHA: `4a5d8416428597c6b4177d57778840fe7a085380`
- Visible identity: `TEST-DEPLOY-01 · TESTBUILD 2 · 4a5d8416`
- GitHub Actions run: `34629887487`
- Exact requested SHA checkout: PASS
- Embedded deployment identity: PASS
- GitHub Pages deployment: PASS
- Visible iPad/device identity: PASS
- Triple Match: PASS

The two successful controlled deployments use different SHAs (`8e17e0bc...` and `4a5d8416...`), satisfying the original different-SHA freeze requirement.

## Completion / Freeze Gate

- Product-line reconciliation: PASS
- Product-line integration: PASS
- Integrated delta restricted to the two approved TEST-DEPLOY files: PASS
- First controlled deployment: PASS
- Second controlled deployment: PASS
- Different-SHA verification: PASS
- Triple-Match verification on both controlled deployments: PASS
- Device-visible build identity: PASS
- Scope preservation: PASS
- TEST-DEPLOY-01 blocker count: 0

`TEST-DEPLOY-01 = FROZEN / COMPLETION PASS / INTEGRATION PASS / CONTROLLED DEPLOYMENT 1 PASS / CONTROLLED DEPLOYMENT 2 PASS / TRIPLE MATCH PASS / 0 BLOCKER`

## Explicit exclusions

- `NAV-BACK-01` remains `DEFINED / NOT IMPLEMENTED` and is not changed by this freeze.
- Deferred cleanup is not performed by this freeze.
- No branch deletion, branch movement, merge to `main`, or cleanup is authorized by this document.
