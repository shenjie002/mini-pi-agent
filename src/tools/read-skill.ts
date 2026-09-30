import type { Tool } from "../agent/tools.js";
import type { SkillRegistry } from "../agent/skills.js";

export function createReadSkillTool(skills: SkillRegistry): Tool {
  return {
    definition: {
      name: "read_skill",
      description: "按名称读取已登记技能的完整 SKILL.md，包括工作流、声明元数据和资源清单。仅当任务匹配技能简介时使用。",
      parameters: {
        type: "object",
        properties: { name: { type: "string" } },
        required: ["name"],
      },
    },
    async execute(args) {
      if (typeof args.name !== "string") throw new Error("Skill name is required");
      return { content: [{ type: "text", text: skills.read(args.name) }] };
    },
  };
}
