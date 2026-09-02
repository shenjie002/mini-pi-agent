
import { SessionStore } from "./agent/session-store.js";
import {  resolve} from "node:path";
import { OpenAICompatibleModel } from "./agent/openai-compatible-model.js";
import { runAgentLoop } from "./agent/loop.js";
import { ToolRegistry } from "./agent/tools.js";
import { createReadFileTool } from "./tools/read-file.js";
import { createListFilesTool } from "./tools/list-files.js";
import { createWriteNoteTool } from "./tools/write-note.js";
import { PluginManager } from "./plugin/manager.js";
import loggerPlugin from "./plugin/logger.js";
import protectedPathsPlugin from "./plugin/protected-paths.js";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const model = new OpenAICompatibleModel(
  "http://127.0.0.1:1234/v1",
  "qwen2.5-7b-instruct-1m",
);
const tools = new ToolRegistry();
const workspaceRoot = resolve("workspace");
tools.register(createReadFileTool(workspaceRoot));
tools.register(createListFilesTool(workspaceRoot));
tools.register(createWriteNoteTool(workspaceRoot));
const store = new SessionStore(
  ".teaching-agent/session.jsonl",
  process.cwd(),
);
const readline = createInterface({
  input,
  output,
});
const userMessage = {
  role: "user" as const,
  content: [
    {
      type: "text" as const,
      text: "请写一篇 Agent Loop 笔记，保存为 secret-note.md。",
    },
  ],
  timestamp: Date.now(),
};
await store.appendMessage(userMessage);
await store.compactIfNeeded(100, 4);
const contextBeforeRun = store.buildContext();
const pluginManager = new PluginManager(tools);

await pluginManager.load(loggerPlugin);

await pluginManager.load(protectedPathsPlugin);

const messages = await runAgentLoop({
model,
systemPrompt:  `
  你是一个简洁的中文助手。
  你可以使用工具操作 workspace。
  所有工具路径必须使用相对路径。
`,
messages: contextBeforeRun,
  tools,
  beforeToolCall: (call) => pluginManager.beforeToolCall(call),
  confirmToolCall: async (call, prompt) => {
    const answer = await readline.question(
      `${prompt} [y/N] `,
    );

    return answer.trim().toLowerCase() === "y";
  },
  onMessage: (message) => store.appendMessage(message),
  onEvent:  async(event) => {
    console.log("event:", event);
     await pluginManager.emit(event);
  },
})
// const newMessages = messages.slice(contextBeforeRun.length)
// for (const message of newMessages) {
//   await store.appendMessage(message);
// }
readline.close();
