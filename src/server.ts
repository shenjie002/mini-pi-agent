import express from "express";
import { resolve } from "node:path";
import { OpenAICompatibleModel } from "./agent/openai-compatible-model.js";
import { runAgentLoop } from "./agent/loop.js";
import { SessionStore } from "./agent/session-store.js";
import { ToolRegistry } from "./agent/tools.js";
import { createReadFileTool } from "./tools/read-file.js";
import { createListFilesTool } from "./tools/list-files.js";
import { createWriteNoteTool } from "./tools/write-note.js";
import { SkillRegistry } from "./agent/skills.js";
import { createReadSkillTool } from "./tools/read-skill.js";
import { createListSkillResourcesTool } from "./tools/list-skill-resources.js";
import { createReadSkillResourceTool } from "./tools/read-skill-resource.js";
import type { AgentEvent } from "./shared/protocol.js";

const app = express();
const port = 4317;

app.use(express.json());

const model = new OpenAICompatibleModel(
  "http://127.0.0.1:1234/v1",
  "qwen2.5-7b-instruct-1m",
);

const workspaceRoot = resolve("workspace");
const tools = new ToolRegistry();

tools.register(createReadFileTool(workspaceRoot));
tools.register(createListFilesTool(workspaceRoot));
tools.register(createWriteNoteTool(workspaceRoot));
const skills = new SkillRegistry(resolve("skills"));
tools.register(createReadSkillTool(skills));
tools.register(createListSkillResourcesTool(skills));
tools.register(createReadSkillResourceTool(skills));

const store = new SessionStore(
  ".teaching-agent/session.jsonl",
  process.cwd(),
);

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/api/prompt", async (req, res) => {
  const text = req.body?.text;

  if (typeof text !== "string" || !text.trim()) {
    res.status(400).json({ error: "text is required" });
    return;
  }

  let expandedText: string;
  try {
    expandedText = skills.expandCommand(text.trim());
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
    return;
  }

  const userMessage = {
    role: "user" as const,
    content: [
      {
        type: "text" as const,
        text: expandedText,
      },
    ],
    timestamp: Date.now(),
  };

  const events: AgentEvent[] = [];

  await store.appendMessage(userMessage);

  await store.compactIfNeeded(1000, 6);

  const messages = await runAgentLoop({
    model,
    systemPrompt: `
你是一个简洁的中文助手。
所有工具路径必须使用相对于 workspace 的相对路径，
例如 README.md，禁止使用绝对路径。
${skills.systemPrompt()}
`,
    messages: store.buildContext(),
    tools,
    onMessage: (message) => store.appendMessage(message),
    onEvent: (event) => {
      events.push(event);
    },
  });

  res.json({
    messages,
    events,
    leafId: store.getLeafId(),
    entries: store.getEntries(),
  });
});

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
