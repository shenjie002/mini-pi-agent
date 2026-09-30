# mini-pi-agent

一个从零实现的、面向学习的 Mini Pi Agent。项目参考 Pi Agent 的分层思想，用 TypeScript 实现一个可以调用真实本地大模型、执行工具、保存会话并通过插件扩展行为的 Agent Runtime。

> This is an educational mini Agent runtime inspired by Pi Agent. It is intentionally small and focuses on understanding the core architecture rather than providing a production-ready assistant.

## 项目定位 | Project Scope

`mini-pi-agent` 不是完整的 Pi 复刻，也不是生产级 AI 编程助手。它的目标是用尽可能少的代码理解 Agent 的核心闭环：

```text
用户输入
  -> Agent Loop
  -> 模型决定是否调用工具
  -> ToolRegistry 执行工具
  -> ToolResult 回写上下文
  -> 下一轮模型请求
  -> 最终回答
```

`mini-pi-agent` is not a full Pi clone or a production coding agent. Its goal is to make the essential Agent loop easy to read and extend:

```text
User input
  -> Agent Loop
  -> Model decides whether to call a tool
  -> ToolRegistry executes the tool
  -> Tool result is added back to context
  -> Next model turn
  -> Final answer
```

## 当前实现 | Implemented

- OpenAI-compatible model adapter
- LM Studio local model support
- Agent Loop with multiple turns
- Tool calls and tool results
- `read_file` tool
- `list_files` tool
- `write_note` tool
- Workspace path safety checks
- JSONL session persistence
- Session tree with `id`, `parentId`, and `leafId`
- Basic context compaction
- Plugin manager
- Event hooks
- Tool-call interception with `allow`, `block`, and `rewrite`
- Command-line Human-in-the-Loop confirmation for tool calls
- Minimal Express HTTP API

- OpenAI-compatible model adapter
- Local model support through LM Studio
- Multi-turn Agent Loop
- Tool calls and tool results
- File reading, file listing, and note writing tools
- Workspace path protection
- JSONL session persistence
- Session tree fields: `id`, `parentId`, and `leafId`
- Basic context compaction
- Plugin manager and event hooks
- Tool-call interception: `allow`, `block`, and `rewrite`
- Command-line Human-in-the-Loop confirmation
- Minimal Express HTTP API

## Pi 三层思想 | Pi-inspired Layers

真实 Pi 可以粗略理解为三层，本项目做了对应的简化实现：

| Pi 层 | 主要职责 | 本项目对应 |
|---|---|---|
| `pi-ai` | 模型协议、消息格式、工具 schema、Provider 适配 | `src/agent/model.ts`、`src/agent/openai-compatible-model.ts` |
| `pi-agent-core` | Agent Loop、工具调用、事件、停止条件 | `src/agent/loop.ts`、`src/shared/protocol.ts` |
| `pi-coding-agent` | Session、工具、插件、运行入口 | `src/agent/session-store.ts`、`src/tools/`、`src/plugin/`、`src/index.ts` |

The real Pi architecture can be roughly viewed as three layers:

| Pi layer | Responsibility | This project |
|---|---|---|
| `pi-ai` | Model protocol, messages, tool schemas, provider adapters | `src/agent/model.ts`, `src/agent/openai-compatible-model.ts` |
| `pi-agent-core` | Agent Loop, tool execution, events, stop conditions | `src/agent/loop.ts`, `src/shared/protocol.ts` |
| `pi-coding-agent` | Sessions, tools, extensions, runtime entry points | `src/agent/session-store.ts`, `src/tools/`, `src/plugin/`, `src/index.ts` |

## 目录结构 | Structure

```text
src/
├── index.ts                         CLI 实验入口 / CLI entry
├── server.ts                        Express API 入口 / HTTP server entry
├── session-tree-demo.ts             会话树实验 / session tree demo
├── shared/
│   └── protocol.ts                  消息、工具、事件、Session 类型
├── agent/
│   ├── model.ts                     模型接口
│   ├── openai-compatible-model.ts   OpenAI-compatible 适配器
│   ├── loop.ts                      Agent 核心循环
│   ├── tools.ts                     工具注册表
│   └── session-store.ts             JSONL 会话存储与压缩
├── tools/
│   ├── read-file.ts                 读取文件
│   ├── list-files.ts                列出文件
│   └── write-note.ts                写入笔记
└── plugin/
    ├── types.ts                     插件类型与权限决策
    ├── manager.ts                   插件加载、事件分发
    ├── logger.ts                    日志插件
    └── protected-paths.ts           工具权限插件

workspace/                           Agent 可访问的安全工作区
```

## 环境要求 | Requirements

- Node.js 20+
- npm
- LM Studio
- 一个已加载并启动的 OpenAI-compatible 本地模型

This project currently expects:

- Node.js 20+
- npm
- LM Studio
- A loaded and running OpenAI-compatible local model

## LM Studio 配置 | LM Studio Configuration

当前默认配置：

```text
Base URL: http://127.0.0.1:1234/v1
Model: qwen2.5-7b-instruct-1m
API Key: 不需要
```

The default configuration is:

```text
Base URL: http://127.0.0.1:1234/v1
Model: qwen2.5-7b-instruct-1m
API Key: not required
```

如果修改了 LM Studio 地址或模型名称，请编辑：

```text
src/index.ts
src/server.ts
```

## 安装 | Installation

```bash
npm install
```

## 运行 CLI Agent | Run the CLI Agent

确保 LM Studio 已启动，然后执行：

```bash
npm run dev
```

CLI 入口当前会执行一个示例任务（也可用 `npm run dev -- '你的任务'` 提供任务），并展示：

- Agent 事件
- 模型工具调用
- 工具执行结果
- 插件日志
- 权限确认
- 最终模型回答

Start LM Studio first, then run:

```bash
npm run dev
```

The CLI demo shows Agent events, tool calls, tool results, plugin logs, permission confirmation, and the final answer.

## 运行 HTTP API | Run the HTTP API

启动服务：

```bash
npm run server
```

健康检查：

```bash
curl http://localhost:4317/api/health
```

提交 Agent 请求：

```bash
curl -X POST http://localhost:4317/api/prompt \
  -H "Content-Type: application/json" \
  -d '{"text":"请读取 README.md"}'
```

The API currently exposes:

```text
GET  /api/health
POST /api/prompt
```

## Human-in-the-Loop

对 `write_note` 等操作，插件可以要求人工确认：

```text
模型请求工具
  -> 插件返回 confirm
  -> 终端询问用户
  -> y: 执行工具
  -> n: 生成错误 toolResult，不执行工具
```

This project includes a command-line Human-in-the-Loop flow:

```text
Model requests a tool
  -> Plugin requests confirmation
  -> CLI asks the user
  -> y: execute the tool
  -> n: create an error tool result without execution
```

当前是命令行确认版，还不是前端弹窗版。

The current implementation is CLI-based, not a browser approval dialog.

## Session 与上下文压缩 | Sessions and Compaction

会话保存在：

```text
.teaching-agent/session.jsonl
```

每条消息是一个 JSONL entry，并通过以下字段表示会话关系：

```text
id        当前 entry 的唯一 ID
parentId  父 entry
leafId    当前会话末端
```

当上下文超过限制时，系统会写入 `compaction` entry，用旧消息摘要替代部分历史，并保留最近消息。

Sessions are stored as JSONL entries. The session tree uses `id`, `parentId`, and `leafId`. When the context exceeds the configured limit, a `compaction` entry summarizes older messages and keeps recent messages.

## 还未实现 | Not Implemented Yet

以下能力还没有完成：

- React 前端
- SSE 实时事件接口
- 浏览器端 Human-in-the-Loop 确认
- 真正的流式 token 输出
- 多用户和多 Session
- 完整的插件自动发现和热加载
- 生产级沙箱和权限系统
- 完整测试套件
- 环境变量配置系统
- 真实部署配置

The following features are intentionally not implemented yet:

- React frontend
- SSE event streaming API
- Browser-based Human-in-the-Loop approval
- True token streaming
- Multi-user and multi-session support
- Full plugin auto-discovery and hot reload
- Production-grade sandboxing and permissions
- Complete test suite
- Environment-based configuration system
- Production deployment configuration

## Skills（完整结构，教学版 Harness）

Skill 不是插件钩子，而是 **一份 `SKILL.md` 工作流 + 同目录的配套文件**。项目中的真实例子是：

```text
skills/agent-loop/
├── SKILL.md
├── references/agent-loop-glossary.md
├── scripts/example.sh
└── assets/template.json
```

`scripts/example.sh` 从 `assets/template.json` 读取四步 Agent Loop 模板并打印到标准输出；它是预先放在 Skill 里的脚本，**不是 Skill 运行后生成的结果**，Harness 也不会自动执行它。可由人手动运行：

```bash
sh skills/agent-loop/scripts/example.sh
```

输出只在终端显示；若将来要把脚本输出接入 Agent 对话，需另行实现并授权执行工具。

`SKILL.md` 的 frontmatter 使用 YAML，正文使用 Markdown：

```markdown
---
name: my-skill
description: 描述做什么，以及何时适用；模型依此决定是否加载。
license: MIT
compatibility: 需要 Node.js 环境
metadata:
  category: education
  version: "1"
allowed-tools: "read_skill read_skill_resource"
disable-model-invocation: false
---

# 工作流

1. 先读 references/guide.md。
2. 按参考资料完成用户的任务。
```

`name` 和 `description` 必填；其他字段可选。`allowed-tools` 是规范的**声明性字段**，本项目不会把它当成授权或自动启用工具。`disable-model-invocation: true` 会隐藏自动发现入口，仍可通过 `/skill:name` 显式调用。示例见 `skills/agent-loop/SKILL.md`、`skills/agent-loop/references/` 和 `skills/review-only/SKILL.md`。

### 当前已实现的 Skill 能力

实现位置：

```text
src/agent/skills.ts                  # SkillRegistry：发现、解析、资源索引和命令展开
src/tools/read-skill.ts              # read_skill
src/tools/list-skill-resources.ts    # list_skill_resources
src/tools/read-skill-resource.ts     # read_skill_resource
```

当前项目中的 `agent-loop` Skill 已实际包含：

```text
skills/agent-loop/
├── SKILL.md
├── references/agent-loop-glossary.md
├── scripts/example.sh
└── assets/template.json
```

因此，下面这些资源清单是 Harness 运行时从真实目录扫描得到的，不是 Skill 运行后生成的：

```text
assets/template.json [asset]
references/agent-loop-glossary.md [reference]
scripts/example.sh [script]
```

资源访问规则：

- 只能通过已登记的 Skill 名称和资源相对路径访问。
- 禁止 `..` 越界路径、绝对路径和符号链接资源。
- 当前只读取小型文本资源；不会自动执行脚本，也不会把资源写回 Skill 目录。
- `scripts/example.sh` 只能由用户手动运行，或在未来由另行授权的命令工具执行。
- `allowed-tools` 只作为 Skill 元数据展示，不会自动注册或授权工具。

对应测试位于 `src/agent/skills.test.ts`，运行：

```bash
npm run typecheck
npm test
```

### Harness 如何使用

1. CLI (`src/index.ts`) 和 HTTP (`src/server.ts`) 初始化 `SkillRegistry`，递归发现 `skills/` 下的 `SKILL.md`，并注册三个**只读**工具。
2. `skills.systemPrompt()` 仅把可自动调用的技能名称、简介和少量元数据放入系统提示，不提前注入全部正文。
3. 模型判断任务匹配时调用 `read_skill({"name":"agent-loop"})`，得到完整工作流、路径、元数据和资源清单；按需调用 `list_skill_resources({"name":"agent-loop"})` 和 `read_skill_resource({"name":"agent-loop","path":"references/agent-loop-glossary.md"})` 读取配套文本（隐藏技能不会出现在系统提示中，但已知名称时仍可读取）。
4. 显式调用时，Harness 在请求进入 Agent Loop 前执行 `skills.expandCommand(text)`，把 `/skill:agent-loop 解释工具调用` 替换为完整技能说明 + 用户参数；因此不依赖模型自行发现。HTTP 可以用：

```bash
curl -X POST http://localhost:4317/api/prompt \
  -H 'Content-Type: application/json' \
  -d '{"text":"/skill:agent-loop 解释工具调用"}'
```

CLI 从命令行参数接收任务，可用 `npm run dev -- '/skill:agent-loop 解释工具调用'` 演示显式调用；`/skill:review-only ...` 演示只在显式调用时向模型展示的技能。

资源按需列出和读取；当前没有让 Agent 自动执行脚本的工具，且技能**不能绕过已有工具的工作区限制或审批规则**。`disable-model-invocation` 只影响是否在系统提示中列出，不构成安全隔离；将来如果 Harness 注册了执行工具，仍需要独立的权限审查。示例技能可通过 `read_file` 读取 `workspace/notes/agent-loop.md`，但不能通过该工具读取项目源码 `src/`。技能目录支持嵌套发现，但未实现 Pi 的全局技能目录、包分发、热加载、信任配置及 Agent 自动执行脚本。文本资源支持读取，二进制资源暂不支持。

运行无需 LM Studio 的单元测试：`npm test`；模型自动选择技能的效果仍需连接 LM Studio 验证。

## 学习路线 | Learning Path

建议按以下顺序阅读：

1. `src/shared/protocol.ts`：理解消息和事件协议
2. `src/agent/openai-compatible-model.ts`：理解模型适配器
3. `src/agent/loop.ts`：理解 Agent 核心循环
4. `src/agent/tools.ts` 和 `src/tools/`：理解工具系统
5. `src/agent/session-store.ts`：理解 JSONL 会话和压缩
6. `src/plugin/`：理解 Pi 风格扩展机制
7. `src/server.ts`：理解如何包装成 HTTP 服务

Recommended reading order:

1. `src/shared/protocol.ts`
2. `src/agent/openai-compatible-model.ts`
3. `src/agent/loop.ts`
4. `src/agent/tools.ts` and `src/tools/`
5. `src/agent/session-store.ts`
6. `src/plugin/`
7. `src/server.ts`

## License

MIT
