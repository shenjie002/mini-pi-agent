export type TextContent = {
  type: "text";
  text: string;
};
export type ToolCallContent = {
  type: "toolCall";
  id: string;
  name: string;
  arguments: Record<string, unknown>;
};
export type UserMessage = {
  role: "user";
  content: TextContent[];
  timestamp: number;
};
export type AssistantMessage = {
  role: "assistant";
  content: Array<TextContent | ToolCallContent>;
  stopReason: "stop" | "toolUse";
  timestamp: number;
};
export type ToolResultMessage = {
  role: "toolResult";
  toolCallId: string;
  toolName: string;
  content: TextContent[];
  isError: boolean;
  timestamp: number;
}
export type AgentMessage =
  | UserMessage //用户输入
  | AssistantMessage// 模型回复或工具调用
  | ToolResultMessage;//工具执行结果
//它描述“模型有哪些工具可以调用
  export type ToolDefinition = {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
  export type ToolResult = {
    content: TextContent[];
  };
  export type SessionEntry =
    | {
        type: "session";
        version: 1;
        id: string;
        timestamp: string;
        cwd: string;
      }
    | {
        type: "message";
        id: string;
        parentId: string | null;
        timestamp: string;
        message: AgentMessage;
    }
    | {
        type: "compaction";
        id: string;
        parentId: string | null;
        timestamp: string;
        summary: string;
        firstKeptEntryId: string;
        tokensBefore: number;
      };
      export type AgentEvent =
        | { type: "agent_start" }
        | { type: "agent_end"; messages: AgentMessage[] }
        | { type: "turn_start"; turn: number }
        | { type: "turn_end"; turn: number }
        | { type: "message_start"; message: AgentMessage }
        | { type: "message_end"; message: AgentMessage }
        | {
            type: "tool_execution_start";
            toolCallId: string;
            toolName: string;
          }
        | {
            type: "tool_execution_end";
            toolCallId: string;
            toolName: string;
            isError: boolean;
        }
          |{
            type: "tool_permission";
            toolCallId: string;
            toolName: string;
            action: "allow" | "block" | "rewrite" | "confirm";
            reason?: string;
          }
