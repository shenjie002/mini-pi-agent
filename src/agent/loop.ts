//适配器只负责“请求模型”，Loop 负责“控制流程”
// 调用模型
// → push assistant
// → 找 toolCall
// → 执行工具
// → push toolResult
// → 下一轮

import type {
  AgentMessage,
   AssistantMessage,
   ToolCallContent,
   ToolDefinition,
  ToolResultMessage,
   AgentEvent
} from "../shared/protocol.ts";
import type { Model } from "./model.ts";
import type { ToolRegistry } from "./tools.ts";
import type { ToolCallDecision } from "../plugin/types.js";

export type RunAgentLoopOptions = {
  model: Model;
  systemPrompt: string;
  messages: AgentMessage[];
  tools: ToolRegistry;
  maxTurns?: number;
  onMessage?: (message: AgentMessage) => Promise<void>;
  onEvent?: (event: AgentEvent) => void | Promise<void>;
  beforeToolCall?: (
    call: ToolCallContent,
  ) => Promise<ToolCallDecision>;
  confirmToolCall?: (
    call: ToolCallContent,
    prompt: string,
  ) => Promise<boolean>;
};

export async function runAgentLoop(options: RunAgentLoopOptions): Promise<AgentMessage[]> {
 await options.onEvent?.({ type: "agent_start" });

  const messages = [...options.messages];
  const maxTurns = options.maxTurns ?? 6;


  for (let turn = 1; turn <= maxTurns; turn++) {
      console.log(`\n--- turn ${turn} ---`);
    await  options.onEvent?.({
        type: "turn_start",
        turn,
      });

      const assistant = await options.model.complete({
        systemPrompt: options.systemPrompt,
        messages,
        tools: options.tools.definitions(),
      });
     await options.onEvent?.({
        type: "message_start",
        message: assistant,
      });
    messages.push(assistant);
   await options.onEvent?.({
      type: "message_end",
      message: assistant,
    });
      await options.onMessage?.(assistant);
      const toolCalls = assistant.content.filter(
        (block): block is ToolCallContent =>
          block.type === "toolCall",
      );

    if (toolCalls.length === 0) {
     await options.onEvent?.({
          type: "turn_end",
          turn,
        });

      await  options.onEvent?.({
          type: "agent_end",
          messages,
        });
        return messages;
      }

      for (const toolCall of toolCalls) {
        console.log(`tool call: ${toolCall.name}`);

        let toolResult: ToolResultMessage;

        try {
          const decision = options.beforeToolCall
            ? await options.beforeToolCall(toolCall)
            : { action: "allow" as const };
          let finalDecision = decision;
          if (decision.action === "confirm") {
            const approved = options.confirmToolCall
              ? await options.confirmToolCall(toolCall, decision.prompt)
              : false;

            finalDecision = approved
              ? { action: "allow" as const }
              : {
                  action: "block" as const,
                  reason: "用户拒绝了工具调用",
                };
          }
          if (decision.action !== "allow") {
            await options.onEvent?.({
              type: "tool_permission",
              toolCallId: toolCall.id,
              toolName: toolCall.name,
              action: finalDecision.action,
              reason:   finalDecision.action === "block"
                  ? finalDecision.reason
                  : undefined,
            });
          }



          if (finalDecision.action === "block") {
            toolResult = {
              role: "toolResult",
              toolCallId: toolCall.id,
              toolName: toolCall.name,
              content: [
                {
                  type: "text",
                  text: `工具调用被阻止：${finalDecision.reason}`,
                },
              ],
              timestamp: Date.now(),
              isError: true,
            };

            messages.push(toolResult);
            await options.onMessage?.(toolResult);

            continue;
          }
          await options.onEvent?.({
             type: "tool_execution_start",
             toolCallId: toolCall.id,
             toolName: toolCall.name,
           });
          const args =
            finalDecision.action === "rewrite"
              ? finalDecision.args
              : toolCall.arguments;

          const result = await options.tools.execute(
            toolCall.name,
            args,
          );
          toolResult = {
            role: "toolResult",
            toolCallId: toolCall.id,
            toolName: toolCall.name,
            content: result.content,
            timestamp: Date.now(),
            isError: false,
          };

        } catch (error) {
          toolResult = {
            role: "toolResult",
            toolCallId: toolCall.id,
            toolName: toolCall.name,
            content: [
              {
                type: "text",
                text: error instanceof Error
                  ? error.message
                  : String(error),
              },
            ],
            timestamp: Date.now(),
            isError: true,
          };

        }

        messages.push(toolResult);
       await options.onEvent?.({
          type: "tool_execution_end",
          toolCallId: toolCall.id,
          toolName: toolCall.name,
          isError: toolResult.isError,
        })
        await options.onMessage?.(toolResult);
        console.log(
          `tool result: ${toolResult.content
            .map((item) => item.text)
            .join("\n")}`,
        );

      }
      await options.onEvent?.({
         type: "turn_end",
         turn,
       });
  }

   await options.onEvent?.({
      type: "agent_end",
      messages,
    });
    throw new Error(`Agent exceeded max turns: ${maxTurns}`);

}
