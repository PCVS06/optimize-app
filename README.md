# Optimize

A Mac workspace for Optimize’s product knowledge, customer support, and daily operations. Conversations, files, browser tools, company instructions, project instructions, and extensions work together in one branded app.

- [Staff guide](branding/HELP.md)
- [Changes](branding/CHANGELOG.md)
- [Mac builds](https://github.com/PCVS06/optimize-app/actions/workflows/optimize-mac-build.yml)
- [Releases](https://github.com/PCVS06/optimize-app/releases)
- [Report a problem](https://github.com/PCVS06/optimize-app/issues)

## Development

All Optimize development lives in **PCVS06/optimize-app**, currently on **optimize/initial-build**. Pushes to `optimize/**` run the Mac build and verification workflow. Download its **Optimize-Mac-Apple-Silicon** artifact for an internal review build. Review builds are ad-hoc signed; customer releases use the separate signing workflow.

Use Node 22 and `npm ci`. `npm run dev:desktop` starts desktop development; `npm run build:server` and `npm run build:app-deps` build shared dependencies. Read [the architecture](docs/architecture.md) and repository instructions before changing shared internals. The existing package names and protocol identifiers are retained for compatibility.

The assistant runtime is Pi. Other agent runtimes are disabled. Shopify, Gorgias, and a shared company document system are not connected yet. Company settings are per host; a team-wide settings service is not included.

## Distribution

The desktop updater reads this repository’s GitHub releases. [Release instructions](docs/release.md) cover signed Mac builds, update manifests, and draft publication. Fork packages are private and cannot be published to the upstream npm scope. Historical deployment recipes are inactive in `.github/upstream-workflows/`.

## Open-source components

Optimize is a customized derivative of [Paseo v0.8.0](https://github.com/getpaseo/paseo/tree/v0.8.0), with [Pi](https://github.com/badlogic/pi-mono) as its assistant runtime. The original Apache-2.0 [LICENSE](LICENSE), upstream authorship, and third-party notices remain applicable. Pi uses the MIT license. Optimize branding does not imply ownership of the underlying open-source components.

A full dependency license review and distribution-notice audit are still required before a commercial customer release.
