import { SessionStore } from "./agent/session-store.js";

const store = new SessionStore(
  ".teaching-agent/tree-demo.jsonl",
  process.cwd(),
);

const userA = {
  role: "user" as const,
  content: [{ type: "text" as const, text: "方案 A：使用工具" }],
  timestamp: Date.now(),
};

const assistantA = {
  role: "assistant" as const,
  content: [{ type: "text" as const, text: "A：工具方案" }],
  stopReason: "stop" as const,
  timestamp: Date.now(),
};

await store.appendMessage(userA);
await store.appendMessage(assistantA);

const branchPoint = "entry_1";
store.switchLeaf(branchPoint);

const userB = {
  role: "user" as const,
  content: [{ type: "text" as const, text: "方案 B：直接回答" }],
  timestamp: Date.now(),
};

await store.appendMessage(userB);

console.log("current leaf:", store.getLeafId());
console.log("current context:");

for (const message of store.buildContext()) {
  console.log(message.role, message.content);
}
