---
name: agent-loop
description: 解释或排查本项目 Agent Loop、模型工具调用与工具结果回写的流程时使用。
license: MIT
compatibility: Node.js 20+；可选的 scripts/example.sh 需要 sh。
metadata: {"category":"education","version":"1"}
allowed-tools: [read_skill, list_skill_resources, read_skill_resource, read_file]
---

# Agent Loop 学习指南

## 目标

用本项目源码解释 Agent Loop 的完整闭环，不要把 Skill 误认为插件钩子。

## 工作流

1. 先调用 `read_file` 读取 workspace 中的 `notes/agent-loop.md`，作为已有学习资料。
2. 按「模型回复 → 工具调用 → 工具结果 → 再次请求模型」解释 Agent Loop，区分 user、assistant、toolResult 消息。
3. 如需配套术语说明，先调用 `list_skill_resources`，再调用 `read_skill_resource` 读取 `references/agent-loop-glossary.md`。
4. 如需结构化示例，调用 `read_skill_resource` 读取 `assets/template.json`。`scripts/example.sh` 是从该模板输出四步流程的只读演示脚本；Harness 只会把它作为文本资源提供，不会自动执行。需要人手动运行时可用 `sh skills/agent-loop/scripts/example.sh`。
5. 说明插件的权限决策发生在工具执行之前，和技能（任务说明）不是同一机制。
6. 如果无法读取上述资料，就根据当前上下文解释，不要声称已经读过文件。

## 资源约定

- `references/`：需要按需阅读的背景资料。
- `scripts/example.sh`：读取 `assets/template.json` 并向标准输出打印四步流程；只有人手动运行时才会执行。
- `assets/template.json`：流程的 JSON 模板；模型可通过 `read_skill_resource` 读取。

技能是指导，不赋予额外工具或文件权限。
