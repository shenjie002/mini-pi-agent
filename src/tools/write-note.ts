import {  mkdir,writeFile } from "node:fs/promises";
import { relative, resolve, sep,dirname } from "node:path";
import type { Tool } from "../agent/tools.js";

export function createWriteNoteTool(workspaceRoot: string): Tool {
  return {
    definition: {
      name: "write_note",
      description: "在 workspace/notes 目录下写入 Markdown 笔记。",
      parameters: {
        type: "object",
        properties: {
          fileName: {
            type: "string",
            description: "笔记文件名，例如 agent.md",
          },
          content: {
            type: "string",
            description: "笔记内容",
          },
        },
        required: ["fileName", "content"],
      },
    },

    async execute(args) {
      const fileName =
        typeof args.fileName === "string"
          ? args.fileName.replace(/[/\\]/g, "-")
          : "note.md";

      const content =
        typeof args.content === "string"
          ? args.content
          : "";

      const notePath = resolve(workspaceRoot, "notes", fileName);
      const relativePath = relative(workspaceRoot, notePath);

      if (
        relativePath === ".." ||
        relativePath.startsWith(`..${sep}`)
      ) {
        throw new Error(`Path escapes workspace: ${fileName}`);
      }

      await mkdir(dirname(notePath), { recursive: true });
      await writeFile(notePath, `${content}\n`, "utf8");

      return {
        content: [
          {
            type: "text",
            text: `已写入 ${relativePath}`,
          },
        ],
      };
    },
  };
}
