import type {
  AgentMessage,
  AssistantMessage,
  ToolDefinition,
} from "../shared/protocol.ts";
import type { CompleteInput, Model } from "./model.ts";

export class OpenAICompatibleModel implements Model {
  constructor(
    private readonly baseUrl: string,
    private readonly modelName: string,
  ) {}

  async complete(input: CompleteInput): Promise<AssistantMessage> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.modelName,
        messages: [
          {
            role: "system",
            content: input.systemPrompt,
          },
          ...input.messages.map(toOpenAIMessage),
        ],
        tools: input.tools.map(toOpenAITool),
         tool_choice: "auto",
      }),
    });

    if (!response.ok) {
      throw new Error(`Model request failed: ${response.status}`);
    }

    const data = (await response.json()) as {
      choices?: Array<{
         message?: {
           content?: string | null;
           tool_calls?: Array<{
             id: string;
             type: "function";
             function: {
               name: string;
               arguments: string;
             };
           }>;
         };
       }>;
    };

    const message = data.choices?.[0]?.message;
    if (!message) {
      throw new Error("Model returned no message");
    }
    const content = [];
    if (typeof message.content === "string" && message.content.length > 0) {
      content.push({
        type: "text" as const,
        text: message.content,
      });
    }
    for (const toolCall of message.tool_calls ?? []) {
      let args: Record<string, unknown>;

      try {
        args = JSON.parse(toolCall.function.arguments);
      } catch {
        throw new Error(`Invalid tool arguments: ${toolCall.function.arguments}`);
      }

      content.push({
        type: "toolCall" as const,
        id: toolCall.id,
        name: toolCall.function.name,
        arguments: args,
      });
    }
    return {
      role: "assistant",
      content,
      timestamp: Date.now(),
       stopReason: message.tool_calls?.length ? "toolUse" : "stop",
    };
  }
}

function toOpenAIMessage(message: AgentMessage) {
  if (message.role === "user") {
    return {
      role: "user",
      content: message.content
        .map((item) => item.text)
        .join("\n"),
    };
  }

  if (message.role === "assistant") {
    const text = message.content
       .filter((item) => item.type === "text")
       .map((item) => item.text)
       .join("\n");
    const toolCalls = message.content
       .filter((item) => item.type === "toolCall")
       .map((item) => ({
         id: item.id,
         type: "function" as const,
         function: {
           name: item.name,
           arguments: JSON.stringify(item.arguments),
         },
       }));
    return {
      role: "assistant",
      content: text || null,
         ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
      timestamp: Date.now(),
    };
  }

  return {
    role: "tool",
    tool_call_id: message.toolCallId,
    content: message.content
      .map((item) => item.text)
      .join("\n"),
  };
}
function toOpenAITool(tool: ToolDefinition) {
  return {
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  };
}
