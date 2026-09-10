# Optimize

Optimize is a company-branded fork of [Paseo](https://github.com/getpaseo/paseo), based on **v0.8.0** (`b8e24677e12b226c7c38c1c3a40649daa9f1152f`). It keeps Paseo's workspace, conversation, file, terminal, voice, scheduling, plugin, and remote-connection features, with **Pi as its only production agent runtime**.

This first build establishes the full app before choosing which other features to simplify. Shopify, Gorgias, team identity, and company documents are not connected yet.

- Company mark and colors come from [optimize.bike](https://www.optimize.bike/). Original source: [branding/optimize-logo.svg](branding/optimize-logo.svg). Jost is bundled with its SIL Open Font License.
- The Mac app is **Optimize.app**, bundle identifier `bike.optimize.desktop`. Its daemon uses `~/.optimize` and `127.0.0.1:6771`. The optional desktop CLI installs as `optimize`, and agent links use `optimize://`.
- Internal `@getpaseo/*` package names, plugin APIs, configuration keys, and the renderer origin remain compatible with Paseo. Historical provider source and tests remain in the fork for upstream comparison; other production provider registrations, alternative-agent installation catalog, and non-Pi terminal presets are removed.
- Pi itself runs through its native RPC interface and uses your existing Pi models, authentication, packages, and extensions. Install and sign into Pi before starting a task. The app does not bundle model credentials.
- The editable company prompt is seeded into the daemon configuration. Its readable source is [branding/system-prompt.md](branding/system-prompt.md). It does not enforce permissions; future business connectors need their own authorization checks.
- Update downloads point to this fork. No public Optimize update channel has been published.

## Build and run on Mac

Requires Node 22, npm, and Xcode Command Line Tools. Run `npm ci`, then `npm run dev:desktop` for development. Checkout development keeps its own `.dev/paseo-home` state.

Build a local Apple Silicon review app with:

```sh
npm run build:desktop -- --publish never --mac --arm64 --dir -c.mac.identity=- -c.mac.notarize=false -c.mac.hardenedRuntime=false
```

The app is produced in `packages/desktop/release/mac-arm64/Optimize.app`. This uses development signing for review, with hardened runtime disabled for the ad-hoc build because it has no Developer ID team. The production builder configuration retains hardened runtime. Distribution to staff still requires a Developer ID certificate and Apple notarization. `npm run brand:assets` regenerates branded app icons from the original SVG mark; ICNS generation requires macOS.

The **Optimize Mac build** workflow builds the app, checks types and lint, runs focused Pi and desktop tests, and launches the packaged app to verify its renderer, managed daemon, and terminal. Its artifact is an app ZIP, not a published release.

## Upstream documentation and license

The original Paseo documentation follows. Upstream instructions describing other agent runtimes apply to Paseo; Optimize's production registry is Pi-only. Apache-2.0 licensing and upstream attribution are preserved. Optimize's brand assets are not relicensed by this fork.

---

<p align="center">
  <img src="packages/website/public/logo.svg" width="64" height="64" alt="Paseo logo">
</p>

<h1 align="center">Paseo</h1>

<p align="center">
  <a href="README.md">English</a> ·
  <a href="README.zh-CN.md">简体中文</a> ·
  <a href="README.ja.md">日本語</a> ·
  <a href="README.ko.md">한국어</a>
</p>

<p align="center">
  <a href="https://github.com/getpaseo/paseo/stargazers">
    <img src="https://img.shields.io/github/stars/getpaseo/paseo?style=flat&logo=github" alt="GitHub stars">
  </a>
  <a href="https://github.com/getpaseo/paseo/releases">
    <img src="https://img.shields.io/github/v/release/getpaseo/paseo?style=flat&logo=github" alt="GitHub release">
  </a>
  <a href="https://x.com/moboudra">
    <img src="https://img.shields.io/badge/%40moboudra-555?logo=x" alt="X">
  </a>
  <a href="https://discord.gg/jz8T2uahpH">
    <img src="https://img.shields.io/badge/Discord-555?logo=discord" alt="Discord">
  </a>
  <a href="https://www.reddit.com/r/PaseoAI/">
    <img src="https://img.shields.io/badge/Reddit-555?logo=reddit" alt="Reddit">
  </a>
</p>

<p align="center">One interface for Claude Code, Codex, Copilot, OpenCode, and Pi agents.</p>

<p align="center">
  <img src="https://paseo.sh/hero-mockup.png" alt="Paseo app screenshot" width="100%">
</p>

<p align="center">
  <img src="https://paseo.sh/mobile-mockup.png" alt="Paseo mobile app" width="100%">
</p>

Run agents in parallel on your own machines. Ship from your phone or your desk.

- **Self-hosted:** Agents run on your machine with your full dev environment. Use your tools, your configs, and your skills.
- **Multi-provider:** Claude Code, Codex, Copilot, OpenCode, and Pi through the same interface. Pick the right model for each job.
- **Voice control:** Dictate tasks or talk through problems in voice mode. Hands-free when you need it.
- **Cross-device:** iOS, Android, desktop, web, and CLI. Start work at your desk, check in from your phone, script it from the terminal.
- **Privacy-first:** Paseo doesn't have any telemetry, tracking, or forced log-ins.

## Plugins

Add themes, workspace panels, commands, settings screens, and coding-agent providers with trusted
TypeScript plugins. Install from a local directory or Git repository with `paseo plugin add <source>`.

See the [plugin docs](https://paseo.sh/docs/plugins) for your Paseo version, or start with the
[0.8 beta quickstart](https://paseo.sh/docs/plugins/v0.8). Plugins run with access to your daemon
machine and inside connected clients; install only code you trust.

## Getting Started

Paseo runs a local server called the daemon that manages your coding agents. Clients like the desktop app, mobile app, web app, and CLI connect to it.

### Prerequisites

You need at least one agent CLI installed and configured with your credentials:

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code)
- [Codex](https://github.com/openai/codex)
- [GitHub Copilot](https://github.com/features/copilot/cli/)
- [OpenCode](https://github.com/anomalyco/opencode)
- [Pi](https://pi.dev)

### Desktop app (recommended)

Download it from [paseo.sh/download](https://paseo.sh/download) or the [GitHub releases page](https://github.com/getpaseo/paseo/releases). Open the app and the daemon starts automatically. Nothing else to install.

To connect from your phone, open **Settings → your host → Pair Device**.

### CLI / headless

Install the CLI and start Paseo:

```bash
npm install -g @getpaseo/cli
paseo
```

Paseo starts locally, then asks whether to enable the end-to-end encrypted relay for device pairing. If you decline, connect directly over TCP, Tailscale, or another VPN. This path is useful for servers and remote machines.

For full setup and configuration, see:

- [Docs](https://paseo.sh/docs)
- [Connectivity guide](https://paseo.sh/docs/connectivity)
- [Configuration reference](https://paseo.sh/docs/configuration)

### Docker

Run the Paseo daemon and self-hosted web UI in Docker:

```bash
docker run -d --name paseo \
  -p 6767:6767 \
  -e PASEO_PASSWORD=change-me \
  -v "$PWD/paseo-home:/home/paseo" \
  -v "$PWD:/workspace" \
  ghcr.io/getpaseo/paseo:latest
```

Open `http://localhost:6767` after it starts. Extend the base image with the agent CLIs you use, then provide credentials through environment variables or the persistent `/home/paseo` volume. See the [Docker documentation](docs/docker.md) for full setup details.

## CLI

Everything you can do in the app, you can do from the terminal.

```bash
paseo run --provider claude/opus-4.6 "implement user authentication"
paseo run --provider codex/gpt-5.5 --worktree feature-x "implement feature X"

paseo ls                           # list running agents
paseo attach abc123                # stream live output
paseo send abc123 "also add tests" # follow-up task

# run on a remote daemon; --cwd is a path on that host
paseo run --host workstation.local:6767 --cwd /workspace "run the full test suite"
```

See the [full CLI reference](https://paseo.sh/docs/cli) for more.

## TypeScript SDK

Build issue integrations, dashboards, and orchestration services with `@getpaseo/client`:

```ts
import { createPaseoClient } from "@getpaseo/client";

const client = createPaseoClient({ url: "ws://127.0.0.1:6767/ws" });
await client.connect();

const agent = await client.agents.create({
  config: { provider: "codex/gpt-5.5" },
  cwd: "/Users/me/dev/storefront",
  prompt: "Review the current diff and name the riskiest change.",
});

const result = await agent.waitForFinish();
console.log(result.lastMessage);

await client.close();
```

See the [SDK quickstart](https://paseo.sh/docs/sdk/quickstart), [recipes](https://paseo.sh/docs/sdk/recipes), and [API reference](https://paseo.sh/docs/sdk/reference).

## Skills

Skills teach your agent to use Paseo to orchestrate other agents.

```bash
npx skills add getpaseo/paseo
```

Then use them in any agent conversation:

- `/paseo-handoff` — hand off work between agents. I use this to plan with Claude and then handoff to Codex to implement.
- `/paseo-advisor` — spin up a single agent as an advisor for a second opinion, without delegating the work itself.
- `/paseo-committee` — form a committee of two contrasting agents to step back, do root cause analysis, and produce a plan.

## Development

Quick monorepo package map:

- `packages/server`: Paseo daemon (agent process orchestration, WebSocket API, MCP server)
- `packages/app`: Expo client (iOS, Android, web)
- `packages/cli`: `paseo` CLI for daemon and agent workflows
- `packages/desktop`: Electron desktop app
- `packages/relay`: Relay transport and encryption used by the daemon and clients
- `packages/website`: Marketing site and documentation (`paseo.sh`)

Common commands:

```bash
# run all local dev services
npm run dev

# run individual surfaces
npm run dev:server
npm run dev:app
npm run dev:desktop
npm run dev:website

# build the server stack
npm run build:server

# repo-wide checks
npm run typecheck
```

## Related projects

- [getpaseo/paseo-relay](https://github.com/getpaseo/paseo-relay) — official distributed relay, written in Elixir
- [paseo-vscode](https://marketplace.visualstudio.com/items?itemName=hinnes.paseo-vscode) — VS Code extension

## License

Apache-2.0
