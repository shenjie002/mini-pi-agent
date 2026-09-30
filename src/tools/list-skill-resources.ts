import type { Tool } from "../agent/tools.js";
import type { SkillRegistry } from "../agent/skills.js";

export function createListSkillResourcesTool(skills: SkillRegistry): Tool {
  return {
    definition: {
      name: "list_skill_resources",
      description: "列出已登记技能目录中的配套资源，例如 references、scripts、assets 文件。",
      parameters: {
        type: "object",
        properties: { name: { type: "string" } },
        required: ["name"],
      },
    },
    async execute(args) {
      if (typeof args.name !== "string") throw new Error("Skill name is required");
      const resources = skills.listResources(args.name);
      return {
        content: [{
          type: "text",
          text: resources.length === 0
            ? "(no bundled resources)"
            : resources.map((resource) => `${resource.path} [${resource.kind}]`).join("\n"),
        }],
      };
    },
  };
}
