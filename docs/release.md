# Optimize releases

The release repository is **PCVS06/optimize-app**. Do not publish fork packages to the upstream npm scope or deploy inherited Paseo infrastructure. The desktop app and bundled runtime update together; standalone npm self-updates are disabled.

## Review builds

Push a verified source commit to `optimize/**`. **Optimize Mac build** runs formatting, shared builds, type checks, lint, focused tests, packaged startup, and UI smoke checks. Its Apple Silicon archive is ad-hoc signed for internal review. It is not the customer update channel.

## Signed customer releases

Before the first customer release, finish the dependency-license and modified-file notice audit and configure these repository secrets: `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_ID`, `APPLE_PASSWORD`, and `APPLE_TEAM_ID`. Use the distribution certificate and account authorized for Optimize.

Prepare the next version with the workspace version scripts, update `branding/CHANGELOG.md`, commit the changes to the Optimize repository, and confirm that commit’s Mac build is green. Show the version and release notes for review before creating or publishing the release tag. Do not include unrelated changes in a release commit.

After release authorization, tag that exact commit as `vX.Y.Z` and push the tag to this repository. Run **Optimize Mac release**, selecting the same tag. The workflow checks the version, signs and notarizes the app, verifies native startup, and uploads a DMG, ZIP, and `latest-mac.yml` to an Optimize draft release. It refuses to overwrite an already published release. The current release target is Apple Silicon; Intel packaging is not yet configured in this workflow.

Install and check the draft’s app before publishing the draft in GitHub. Publishing makes its update manifest available to installed Optimize apps. Signing credentials and a published release have not been configured by the review-build workflow.

## Update ownership

`packages/desktop/electron-builder.yml` embeds the owner and repository used by the updater. Keep it pointed at `PCVS06/optimize-app`. Update assets and release notes must come from this repository. Keep upstream source available for reference or deliberately reviewed merges, but never use its release feed.

The inherited deployment and release workflows are stored outside `.github/workflows/`; GitHub does not execute them. The active Optimize workflows are the entry points for building and distributing this app.
