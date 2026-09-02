import type { AgentEvent,ToolCallContent } from "../shared/protocol.js";
import type { Tool } from "../agent/tools.js";

export type PluginEventHandler = (
  event: AgentEvent,
) => void | Promise<void>;

export type PluginAPI = {
  registerTool(tool: Tool): void;

  on(
    eventType: AgentEvent["type"],
    handler: PluginEventHandler,
  ): void;
  onToolCall(handler: ToolCallHandler): void;

};

export type Plugin = (
  api: PluginAPI,
) => void | Promise<void>;
export type ToolCallDecision =
  | { action: "allow" }
  | { action: "block"; reason: string }
  | {
      action: "rewrite";
      args: Record<string, unknown>;
      reason?: string;
    }| {
          action: "confirm";
          prompt: string;
        };

export type ToolCallHandler = (
  call: ToolCallContent,
) => ToolCallDecision | Promise<ToolCallDecision>;
