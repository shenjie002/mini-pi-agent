import type { Tool } from "../agent/tools.js";
import type { SkillRegistry } from "../agent/skills.js";

export function createReadSkillResourceTool(skills: SkillRegistry): Tool {
  return {
    definition: {
      name: "read_skill_resource",
      description: "读取已登记技能中的一个配套资源，例如 references/guide.md 或 assets/template.json。",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          path: { type: "string", description: "相对于技能目录的资源路径" },
        },
        required: ["name", "path"],
      },
    },
    async execute(args) {
      if (typeof args.name !== "string") throw new Error("Skill name is required");
      if (typeof args.path !== "string") throw new Error("Resource path is required");
      return {
        content: [{
          type: "text",
          text: skills.readResource(args.name, args.path),
        }],
      };
    },
  };
}
