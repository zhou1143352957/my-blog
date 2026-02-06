---
title: Codex 5.2（GPT-5.2-Codex）使用教程：安装配置、基础到进阶实践
date: 2026-02-06 10:00:00
cover: https://i.postimg.cc/FsRxSf2K/codex-Setting.png
tags:
  - Codex
  - 工程实践
  - CLI
categories:
  - 工具
---

下面这篇教程面向有经验的开发者，目标是让你把 Codex 当成“工程执行器”来用：从安装配置到结构化工作流，再到高级技巧与排障。内容基于 OpenAI 官方资料整理。

**1. 版本定位：Codex 5.2 是什么**

GPT-5.2-Codex 是 GPT-5.2 在 Codex 场景的工程化优化版本，重点增强了长任务的上下文压缩能力、对大型代码变更（如重构与迁移）的稳定性，并改进了 Windows 环境表现，同时强化了安全能力。

Codex 是跨多端使用的工程代理：你可以在 App、IDE、CLI 等不同界面中使用同一个 Codex 账户，完成从理解到修改、再到验证的一整套工程任务。

**2. 安装与配置（CLI）**

最直接的入口是 Codex CLI。官方安装方式如下：

```bash
npm i -g @openai/codex
```

首次运行 `codex` 会提示你登录（ChatGPT 账号）或使用 API Key。CLI 在本地终端运行，可以读取、修改当前目录的文件并执行命令。由于 CLI 在本地运行，源码默认不会离开你的环境，除非你选择分享或发送。

升级方式有两种：

```bash
codex --upgrade
```

或：

```bash
npm i -g @openai/codex@latest
```

平台支持方面，CLI 正式支持 macOS 与 Linux。Windows 仍是实验支持，建议在 WSL 环境中使用。

**3. 模型选择与默认模型**

官方 changelog 指出：对已用 ChatGPT 登录的用户，CLI 与 IDE 扩展开始默认使用 `gpt-5.2-codex`。如果你需要稳定一致的模型，建议显式指定。

你可以在启动时指定：

```bash
codex --model gpt-5.2-codex
```

也可以在交互界面使用 `/model` 切换。

如果你希望长期固定默认模型，可以在 `config.toml` 中设置：

```toml
model = "gpt-5.2-codex"
```

**4. Approval Modes：安全边界与效率**

Codex CLI 的审批模式决定它能在没有确认的情况下执行到什么程度。官方定义三种模式：Auto、Read-only、Full Access。

1. Auto（默认）：允许在工作目录内读取、编辑、执行命令，但涉及目录外或网络访问会提示确认。
2. Read-only：只浏览文件并给出建议，不会改文件或跑命令。
3. Full Access：可跨目录并允许网络访问，不再逐次确认。

切换方式：在交互会话内使用 `/permissions`。

实战建议：

1. 复杂任务先用 Read-only 产出方案与风险清单。
2. 低风险、重复性的变更用 Auto 提效。
3. Full Access 只在可信仓库和隔离环境中使用。

**5. 基础使用：四段式提示法**

对有经验的开发者，最稳定的上手方式是四段式提示：

1. 目标：你要达成的最终效果。
2. 边界：不能动的地方或不允许的行为。
3. 依据：优先参考哪些文件或既有模式。
4. 验收：你能确认成功的检查点。

示例：

```text
目标：把登录模块的错误提示统一为一个错误码映射表，并替换现有散落的文案。
边界：不改 API 调用路径，不新增第三方依赖。
依据：优先参考 src/auth/ 下已有的 utils 与常量文件。
验收：编译通过，错误提示不再出现硬编码文本。
```

这种结构能减少误改与误解需求的概率，也更适合 Codex 的代理式流程。

**6. 高级技巧：用 Codex 处理长任务与重复流程**

Codex CLI 支持非交互式 `exec`，适合把常见操作脚本化：

```bash
codex exec "fix the CI failure and summarize changes"
```

这类用法适合重复流程，例如修复测试、更新文档、生成变更摘要。

更复杂的工程任务可以用“计划驱动”方式：

1. 先让 Codex 总结代码结构与关键入口。
2. 让它写出多步计划并进行风险提示。
3. 再执行改动，并在最后输出变更摘要。

Codex 会输出操作记录，你可以用 git 回滚或审查改动。

**7. 为什么优先选 GPT-5.2-Codex**

GPT-5.2-Codex 的优势集中在“工程级任务稳定性”：

1. 更适合长任务的上下文压缩与持续推理。
2. 更可靠的大规模改动能力，适合重构与迁移。
3. Windows 环境表现更好，跨平台更稳。

这也是官方在 Codex 相关更新中强调的升级重点。

**8. 常见问题与排障**

1. **为什么没有改文件**

你可能处于 Read-only 模式。切换到 Auto 再试。

2. **为什么命令没有执行**

Auto 仍需要你批准命令，只有 Full Access 才会自动执行命令。

3. **如何升级 CLI**

用 `codex --upgrade` 或 `npm i -g @openai/codex@latest`。

4. **Windows 体验不稳定**

Windows 属于实验支持，建议在 WSL 中使用。

**9. 实战示例：结构化重构流程**

目标：把分散的错误码定义集中到 `src/shared/error_codes.ts`，并全局替换硬编码。

步骤：

1. 解释：让 Codex 总结错误处理逻辑分布。
2. 计划：让 Codex 给出重构步骤与风险点。
3. 修改：在 Auto 模式执行变更。
4. 验收：执行构建或单测确认。

提示词模板：

```text
目标：把错误码统一集中到 src/shared/error_codes.ts，并替换全局硬编码。
边界：不改变 API 响应结构，不新增依赖。
依据：参考 src/shared/constants 与 src/api/error_handler。
验收：构建通过，错误提示文本不再出现硬编码。
```

**10. 小结**

Codex 5.2 的核心价值是“工程执行力”：它能在清晰目标与边界下稳定推进长任务、跨模块改动与重构。建议的工作节奏是：

1. Read-only 先探路。
2. 明确目标、边界与验收。
3. Auto 落地修改。
4. 用验收命令收尾。

当你把流程结构化，GPT-5.2-Codex 的工程能力会非常明显。
