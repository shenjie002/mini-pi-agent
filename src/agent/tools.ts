import type {
  ToolDefinition,
  ToolResult,
} from "../shared/protocol.ts";

export type Tool = {
  definition: ToolDefinition;
  execute(args: Record<string, unknown>): Promise<ToolResult>;
};

export class ToolRegistry {
  private tools = new Map<string, Tool>();
//注册工具
  register(tool: Tool): void {
    this.tools.set(tool.definition.name, tool);
  }
// 把工具说明交给模型
  definitions(): ToolDefinition[] {
    return Array.from(this.tools.values()).map((tool) => tool.definition);
  }
//根据工具名执行工具
  async execute(
    name: string,
    args: Record<string, unknown>,
  ): Promise<ToolResult> {
    const tool = this.tools.get(name);

    if (!tool) {
      throw new Error(`Tool not found: ${name}`);
    }

    return tool.execute(args);
  }
}
