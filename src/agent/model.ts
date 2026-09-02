import type { AgentMessage, AssistantMessage, ToolDefinition } from "../shared/protocol.ts";

export type CompleteInput = {
  systemPrompt: string;
    messages: AgentMessage[];
    tools: ToolDefinition[];
};

export interface Model {
  complete(input: CompleteInput): Promise<AssistantMessage>;
}
