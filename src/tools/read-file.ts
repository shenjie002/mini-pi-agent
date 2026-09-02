import { readFile } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";
import type { Tool } from "../agent/tools.js";

export function createReadFileTool(workspaceRoot: string): Tool {
  return {
    definition: {
      name: "read_file",
      description: "读取安全工作区中的文本文件。",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string" },
        },
        required: ["path"],
      },
    },

    async execute(args) {
      const inputPath = typeof args.path === "string" ? args.path : "";
         const filePath = resolve(workspaceRoot, inputPath);
         const relativePath = relative(workspaceRoot, filePath);

         // 防止通过 ../../ 访问 workspace 之外的文件
         if (
           relativePath === ".." ||
           relativePath.startsWith(`..${sep}`) ||
           filePath === workspaceRoot
         ) {
           throw new Error(`Path escapes workspace: ${inputPath}`);
         }

         const content = await readFile(filePath, "utf8");

         return {
           content: [
             {
               type: "text",
               text: content,
             },
           ],
         };
    },
  };
}
