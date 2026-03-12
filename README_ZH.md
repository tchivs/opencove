<div align="center">

# OpenCove 🌌

**专为 Agents、任务、知识与研究所设计的无限画布工作台。**

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Status](https://img.shields.io/badge/status-alpha-orange.svg)]()
[![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey)]()
[![English](https://img.shields.io/badge/Language-English-blue) ](./README.md)

<img src="./assets/images/opencove_header_readme.jpg" alt="OpenCove Header" width="100%" />

</div>

## 📖 什么是 OpenCove？

OpenCove 是一款面向 AI 时代的**空间化开发工作台**。它打破了传统开发工具中被割裂的标签页和终端窗口，提供了一个近乎无边界的 2D 画布。

在这里，你的 **AI Agents（如 Claude Code / Codex）**、**终端（Terminals）**、**任务（Tasks）** 以及 **笔记（Notes）** 都可以同处于一个视觉平面。你可以将人类的思考规划与 Agent 的自动执行进行空间化的组织，让一切工作流直观可见。

<img src="./assets/images/opencove_app_preview_readme.jpg" alt="OpenCove App Preview" width="100%" />

## ✨ 核心特性

- **🌌 无限空间画布**：抛弃拥挤的多面板布局（Panes/Tabs），自由摆放你的终端、代码、文档和各类 Agent 窗口，构建全局视野。
- **🤖 原生支持 Agent CLI**：内置针对 `Claude Code` 和 `Codex` 等 CLI 工具的深度优化。轻松启动、并排对比、实时监控各个 Agent 的执行状态。
- **🧠 空间化的上下文管理**：让任务规划与实际执行的代码处在同一视野。讨论路径与代码改动不再被隐藏在聊天历史的角落里。
- **💾 状态持久与空间记忆**：像真实的办公桌一样，OpenCove 会记住你的布局、视口位置、终端状态以及 Agent 的上下文。即使重启应用，工作现场依然完好如初。
- **🗂️ 细粒度的工作区隔离**：基于目录、项目或 Git Worktrees 划分独立的工作流，确保上下文严格隔离，互不干扰。

## 💡 为什么选择 OpenCove？

在传统的开发或与常规 AI 助手的协作模式中，上下文总是随着对话历史的滚动迅速流失，或者被隐藏在无数次切屏中。

| 痛点 (传统模式) | 解决方案 (OpenCove 模式) |
| :--- | :--- |
| **线性对话容易失忆**：长对话中重要决策和上下文常被淹没。 | **空间持久化**：关键进度、笔记和执行情况以卡片形式常驻画布。 |
| **单线程的开发流**：多任务并行时，频繁切窗容易打断思路流。 | **多维并行**：各个 Agent 终端独立执行，全局视野一览无余，互不抢占焦点。 |
| **黑盒化与失控感**：难以直观跟进后台 Agent 究竟在干什么。| **执行过程全透明**：所有的 Terminal 交互动向都在画布上实时呈现。 |

## 🚀 快速上手

*OpenCove 目前处于 Alpha 测试阶段，欢迎极客与早期接受者体验。*

### 下载客户端

我们提供了两种维度的预编译版本：

- **Stable (稳定版)**：适合常规开发与体验。
- **Nightly (每日构建版)**：包含最新特性，适合尝鲜与测试。

请前往 [GitHub Releases](https://github.com/DeadWaveWave/opencove/releases) 下载适用于 macOS、Windows 或 Linux 的安装包。

> **⚠️ macOS 用户注意**：
> 当前发布版本暂未进行 Apple Developer ID 签名与公证。若首次打开时被 Gatekeeper 拦截，请在终端执行以下命令放行：
> ```bash
> xattr -dr com.apple.quarantine /Applications/OpenCove.app
> ```

### 源码编译

#### 环境依赖

- Node.js `>= 22`
- pnpm `>= 9`
- （推荐）全局安装 `Codex` 或 `Claude Code` 以充分体验完整的 Agent 工作流。

#### 构建步骤

```bash
# 1. 克隆仓库
git clone https://github.com/DeadWaveWave/opencove.git
cd opencove

# 2. 安装依赖
pnpm install

# 3. 启动开发模式
pnpm dev
```

> 更多底层构建与打包发布说明，请查阅 [RELEASING.md](docs/RELEASING.md)。

## 🏗️ 技术架构

OpenCove 致力于探索现代化的技术选型与极致的客户端性能体验：

- **核心框架**：Electron + React + TypeScript (`electron-vite` 驱动)
- **画布引擎**：基于 `@xyflow/react` 打造流畅的无限画布。
- **原生终端**：使用 `xterm.js` 搭配 `node-pty` 提供强大的跨平台 PTY 运行时。
- **工程保障**：`Vitest` 与 `Playwright` 构筑了坚实的组件级与 E2E 回归测试防线。

## 🤝 参与贡献

OpenCove 是一项长期演进的开源企划，我们需要你的加入，共同定义 AI 时代工具链的全新形态。无论你想探讨架构、提交代码还是报告 Bug，都可以参考以下指南：

- [贡献指南 (CONTRIBUTING.md)](./CONTRIBUTING.md)
- [行为准则 (CODE_OF_CONDUCT.md)](./CODE_OF_CONDUCT.md)
- [获取支持 (SUPPORT.md)](./SUPPORT.md)

---

<div align="center">

<p>基于现代 Web 标准构建，探索下一代人机协同体验。<br>由 OpenCove 团队倾注 ❤️ 设计开发。</p>

[![MIT License](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

</div>
