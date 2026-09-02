import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { appendFile } from "node:fs/promises";
import { dirname } from "node:path";
import type {
  AgentMessage,
  SessionEntry,

} from "../shared/protocol.js";

export class SessionStore {
  private entries: SessionEntry[] = [];
  private counter = 0;
  private byId = new Map<string, SessionEntry>();
  private leafId: string | null = null;
  constructor(
    private readonly filePath: string,
    private readonly cwd: string,


  ) {
    this.loadOrCreate();
  }

  async appendMessage(message: AgentMessage): Promise<void> {
    const entry: SessionEntry = {
      type: "message",
      id: `entry_${++this.counter}`,
      parentId: this.leafId,
      timestamp: new Date().toISOString(),
      message,
    };
    this.byId.set(entry.id, entry);
    this.leafId = entry.id;

    this.entries.push(entry);

    await appendFile(
      this.filePath,
      `${JSON.stringify(entry)}\n`,
      "utf8",
    );
  }
//不要返回全部消息，改成只返回当前 leaf 的父链：
buildContext(): AgentMessage[] {
  const path: SessionEntry[] = [];
  let current = this.leafId
    ? this.byId.get(this.leafId)
    : undefined;

  while (current) {
    path.unshift(current);

    if (current.type !== "message" || !current.parentId) {
      break;
    }

    current = this.byId.get(current.parentId);
  }

  let compactionIndex = -1;

  for (let index = path.length - 1; index >= 0; index--) {
    if (path[index].type === "compaction") {
      compactionIndex = index;
      break;
    }
  }

  if (compactionIndex === -1) {
    return path
      .filter(
        (entry): entry is Extract<SessionEntry, { type: "message" }> =>
          entry.type === "message",
      )
      .map((entry) => entry.message);
  }

  const compaction = path[compactionIndex];

  if (compaction.type !== "compaction") {
    return [];
  }

  const firstKeptIndex = path.findIndex(
    (entry) => entry.id === compaction.firstKeptEntryId,
  );

  const keptMessages = path
    .slice(firstKeptIndex)
    .filter(
      (entry): entry is Extract<SessionEntry, { type: "message" }> =>
        entry.type === "message",
    )
    .map((entry) => entry.message);

  return [
    {
      role: "user",
      content: [
        {
          type: "text",
          text: `以下是旧上下文摘要：\n${compaction.summary}`,
        },
      ],
      timestamp: new Date(compaction.timestamp).getTime(),
    },
    ...keptMessages,
  ];
}


  switchLeaf(leafId: string): void {
    if (!this.byId.has(leafId)) {
      throw new Error(`Unknown entry: ${leafId}`);
    }

    this.leafId = leafId;
  }

  getLeafId(): string | null {
    return this.leafId;
  }
  getEntries(): SessionEntry[] {
    return [...this.entries];
  }
  private loadOrCreate(): void {
    mkdirSync(dirname(this.filePath), { recursive: true });

    if (!existsSync(this.filePath)) {
      const session: SessionEntry = {
        type: "session",
        version: 1,
        id: "teaching-session",
        timestamp: new Date().toISOString(),
        cwd: this.cwd,
      };

      this.entries.push(session);
      writeFileSync(
        this.filePath,
        `${JSON.stringify(session)}\n`,
        "utf8",
      );

      return;
    }

    const lines = readFileSync(this.filePath, "utf8")
      .split("\n")
      .filter(Boolean);

    for (const line of lines) {
      const entry = JSON.parse(line) as SessionEntry;
      this.entries.push(entry);

      if (entry.type === "message") {
        this.byId.set(entry.id, entry);
         this.leafId = entry.id;
        const number = Number(entry.id.replace("entry_", ""));
        this.counter = Math.max(this.counter, number);
      }
    }
  }

  private lastMessageId(): string | null {
    const messages = this.entries.filter(
      (entry): entry is Extract<SessionEntry, { type: "message" }> =>
        entry.type === "message",
    );

    return messages.at(-1)?.id ?? null;
  }
  async compactIfNeeded(
    maxChars: number,
    keepRecentMessages: number,
  ): Promise<void> {
    const context = this.buildContext();
    const totalChars = context.reduce(
      (sum, message) => sum + getMessageText(message).length,
      0,
    );

    if (totalChars <= maxChars) {
      return;
    }

    const messageEntries = this.entries.filter(
      (entry): entry is Extract<SessionEntry, { type: "message" }> =>
        entry.type === "message",
    );

    const kept = messageEntries.slice(-keepRecentMessages);
    const summarized = messageEntries.slice(0, -keepRecentMessages);

    const summary = summarized
      .map((entry) => {
        const text = getMessageText(entry.message);

        return `${entry.message.role}: ${text}`;
      })
      .join("\n");

    const firstKeptEntryId = kept[0]?.id;

    if (!firstKeptEntryId) {
      return;
    }

    const entry: SessionEntry = {
      type: "compaction",
      id: `entry_${++this.counter}`,
      parentId: this.leafId,
      timestamp: new Date().toISOString(),
      summary,
      firstKeptEntryId,
      tokensBefore: totalChars,
    };

    this.entries.push(entry);
    this.byId.set(entry.id, entry);
    this.leafId = entry.id;

    await appendFile(
      this.filePath,
      `${JSON.stringify(entry)}\n`,
      "utf8",
    );
  }

}
function getMessageText(message: AgentMessage): string {
  const texts: string[] = [];

  for (const block of message.content) {
    if (block.type === "text") {
      texts.push(block.text);
    }
  }

  return texts.join("\n");
}
