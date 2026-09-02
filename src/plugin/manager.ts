import type { AgentEvent,ToolCallContent } from "../shared/protocol.js";
import type { ToolRegistry, Tool } from "../agent/tools.js";
import type {
  Plugin,
  PluginAPI,
  PluginEventHandler,ToolCallDecision,ToolCallHandler
} from "./types.js";

export class PluginManager {
  private readonly handlers = new Map<
    AgentEvent["type"],
    PluginEventHandler[]
  >();
  private readonly toolCallHandlers: ToolCallHandler[] = [];

  constructor(
    private readonly toolRegistry: ToolRegistry,
  ) {}

  async load(plugin: Plugin): Promise<void> {
    const api: PluginAPI = {
      registerTool: (tool: Tool) => {
        this.toolRegistry.register(tool);
      },

      on: (
        eventType: AgentEvent["type"],
        handler: PluginEventHandler,
      ) => {
        const handlers = this.handlers.get(eventType) ?? [];
        handlers.push(handler);
        this.handlers.set(eventType, handlers);
      },
      onToolCall: (handler) => {
        this.toolCallHandlers.push(handler);
      },
    };

    await plugin(api);
  }

  async emit(event: AgentEvent): Promise<void> {
    const handlers = this.handlers.get(event.type) ?? [];

    for (const handler of handlers) {
      await handler(event);
    }
  }
  async beforeToolCall(
    call: ToolCallContent,
  ): Promise<ToolCallDecision> {
    for (const handler of this.toolCallHandlers) {
      const decision = await handler(call);

      if (decision.action !== "allow") {
        return decision;
      }
    }

    return { action: "allow" };
  }

}
