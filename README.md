<div align="center">

# OpenCove 🌌

**Your infinite canvas workspace for agents, tasks, knowledge, and research.**

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Status](https://img.shields.io/badge/status-alpha-orange.svg)]()
[![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey)]()
[![简体中文](https://img.shields.io/badge/Language-%E7%AE%80%E4%BD%93%E4%B8%AD%E6%96%87-blue)](./README_ZH.md)

<img src="./assets/images/opencove_header_readme.jpg" alt="OpenCove Header" width="100%" />

</div>

## 📖 What is OpenCove?

OpenCove is a **spatial development workspace** built for the AI era. It reimagines traditional development tools by replacing split-panels and disjointed tabs with a virtually boundless 2D canvas.

Here, your **AI Agents (like Claude Code / Codex)**, **Terminals**, **Tasks**, and **Notes** exist on the same visual plane. By organizing human intuition and agent-driven automation spatially, OpenCove allows you to see the true context of your work at all times.

<img src="./assets/images/opencove_app_preview_readme.jpg" alt="OpenCove App Preview" width="100%" />

## ✨ Highlights

- **🌌 Infinite Spatial Canvas**: Break free from rigid layouts. Freely arrange terminals, docs, and agent interfaces to construct a holistic view of your workflow.
- **🤖 Native CLI Agent Support**: Deeply optimized for CLI AI tools like `Claude Code` and `Codex`. Easily spawn them, compare them side-by-side, and monitor their state live.
- **🧠 Visualized Context Management**: Keep your task planning and actual execution side by side. Crucial context no longer gets buried inside scrolling chat histories.
- **💾 Persistent State & Memory**: OpenCove remembers the scene. Your viewport, layout, terminal output, and agent states survive project switches and restarts, picking up right where you left off.
- **🗂️ Fine-Grained Workspace Isolation**: Separate your workstreams natively using directories and git worktrees, ensuring that context never bleeds across projects.

## 💡 Why OpenCove?

In traditional dev environments or linear chat bots, context is quickly lost to scrolling or tucked away in hidden tabs.

| Pain Point (Traditional) | The OpenCove Workspace |
| :--- | :--- |
| **Linear Amnesia**: Context gets buried in endless chat histories. | **Spatial Context**: Crucial decisions and active tasks stay visible on the canvas. |
| **Single-Pane Bottlenecks**: Switching tabs breaks your train of thought. | **Parallel Execution**: Observe multiple agents working simultaneously without losing focus. |
| **Opaque Automation**: It's hard to follow what background agents are doing. | **Transparent Actions**: Terminal executions and side-effects are rendered right before your eyes. |

## 🚀 Getting Started

*OpenCove is currently in Alpha. We welcome early adopters and power users to test it out.*

### Download

We distribute pre-compiled binaries via our [GitHub Releases](https://github.com/DeadWaveWave/opencove/releases) page:

- **Stable Build**: Recommended for general users.
- **Nightly Build**: Contains the bleeding-edge features.

Downloads are available for macOS, Windows, and Linux (`.dmg`, `.exe`, `.zip`, etc.).

> **⚠️ macOS Users Note**:
> The current releases are **not signed or notarized** with an Apple Developer ID. If Gatekeeper blocks the app, run this in your terminal:
> ```bash
> xattr -dr com.apple.quarantine /Applications/OpenCove.app
> ```

### Building from Source

#### Prerequisites
- Node.js `>= 22`
- pnpm `>= 9`
- (Recommended) Globally install `Claude Code` or `Codex` to experience full agent workflows.

#### Build Instructions

```bash
# 1. Clone the repository
git clone https://github.com/DeadWaveWave/opencove.git
cd opencove

# 2. Install dependencies
pnpm install

# 3. Start the dev environment
pnpm dev
```

> See [RELEASING.md](docs/RELEASING.md) for more packager and build documentation.

## 🏗️ Technical Architecture

OpenCove is built with modern, high-performance web standards:

- **Framework**: Electron + React + TypeScript (via `electron-vite`)
- **Canvas Engine**: `@xyflow/react` for buttery smooth infinite canvas interactions.
- **Underlying Terminal**: `xterm.js` and `node-pty` powering full-fledged PTY runtimes.
- **Testing**: `Vitest` and `Playwright` for robust unit and E2E regression testing.

## 🤝 Contributing

OpenCove is open source. We need your help to define what the IDE of the AI intelligence era should look like.
Read our guidelines below:

- [Contributing Guidelines (CONTRIBUTING.md)](./CONTRIBUTING.md)
- [Code of Conduct (CODE_OF_CONDUCT.md)](./CODE_OF_CONDUCT.md)
- [Support (SUPPORT.md)](./SUPPORT.md)

---

<div align="center">

<p>Redefining dev environments for the modern web.<br>Built with ❤️ by the OpenCove Team.</p>

[![MIT License](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

</div>
