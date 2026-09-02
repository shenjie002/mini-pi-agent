import { readdir } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";
import type { Tool } from "../agent/tools.js";

export function createListFilesTool(workspaceRoot: string): Tool {
  return {
    definition: {
       name: "list_files",
      description: "列出安全工作区中的文件。",
      parameters: {
        type: "object",
        properties: {},
      },
    },

    async execute() {
      const names = await readdir(workspaceRoot);

      return {
        content: [
          {
            type: "text",
            text: names.join("\n"),
          },
        ],
      };
    },
  };
}
